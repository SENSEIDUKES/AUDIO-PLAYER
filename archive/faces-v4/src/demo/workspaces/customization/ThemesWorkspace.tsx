import { useEffect, useMemo, useState } from "react"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    MiniSidebarPlayer,
    PROPERTY_REGISTRY,
    SeaCardPlayer,
    StickyBottomPlayer,
    createAutoThemePlugin,
    rgbToCss,
} from "../../../audio-player"
import type { ArtworkPalette, AudioPlayerTheme } from "../../../audio-player"
import { NO_LUCK_ART, OG_BG, noLuckTracks } from "../../data"
import { PropertyControl } from "../../panel/PropertyControl"
import { THEME_PRESETS } from "../../panel/SchemaPanel"
import { defaultWorkshopSettings } from "../../workshopFaces"
import { Button, ButtonRow, Note, Panel, SplitLayout, Switch } from "../../workshop/ui"

/* Themes: one set of theme props applied to several faces at once, so a color
   decision reads across the whole family. Auto Theme instead derives the
   palette from artwork on the player it runs on. */

type Theme = Required<AudioPlayerTheme>

const THEME_DESCRIPTORS = PROPERTY_REGISTRY.filter((d) => d.propPath.startsWith("theme."))

function PaletteSwatches({ palette }: { palette: ArtworkPalette | null }) {
    if (!palette)
        return <p className="wk-panel__hint">No palette yet — press play on the portable player.</p>
    const swatches: [string, string][] = [
        ["Primary", rgbToCss(palette.primary)],
        ["Secondary", rgbToCss(palette.secondary)],
        ["Accent", rgbToCss(palette.accent)],
    ]
    return (
        <ul className="wk-chip-list" aria-label="Extracted palette">
            {swatches.map(([label, color]) => (
                <li key={label} className="wk-tag">
                    <span className="wk-dot" style={{ background: color }} aria-hidden="true" />
                    {label} {color}
                </li>
            ))}
            <li className="wk-tag">{palette.isDark ? "Dark artwork" : "Light artwork"}</li>
        </ul>
    )
}

export function ThemesWorkspace() {
    const [theme, setTheme] = useState<Theme>(() => defaultWorkshopSettings().theme)
    const [autoTheme, setAutoTheme] = useState(false)
    const [palette, setPalette] = useState<ArtworkPalette | null>(null)
    const [copied, setCopied] = useState(false)

    const autoThemePlugins = useMemo(
        () =>
            autoTheme
                ? [
                      createAutoThemePlugin({
                          name: "registry-auto-theme",
                          onPaletteChange: (next) => setPalette(next),
                      }),
                  ]
                : [],
        [autoTheme]
    )

    const setPath = (propPath: string, value: unknown) => {
        const key = propPath.replace(/^theme\./, "") as keyof Theme
        setTheme((prev) => ({ ...prev, [key]: value }))
    }

    useEffect(() => {
        if (!copied) return
        const timer = setTimeout(() => setCopied(false), 1500)
        return () => clearTimeout(timer)
    }, [copied])

    const copy = () => {
        void navigator.clipboard
            ?.writeText(JSON.stringify(theme, null, 4))
            .then(() => setCopied(true))
            .catch(() => undefined)
    }

    return (
        <SplitLayout
            stage={
                <>
                    <AudioSessionProvider initialQueue={noLuckTracks}>
                        <div className="wk-stage-grid">
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">FullCardPlayer</p>
                                <FullCardPlayer {...theme} />
                            </div>
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">SeaCardPlayer</p>
                                <SeaCardPlayer
                                    track={noLuckTracks[0]}
                                    art={NO_LUCK_ART}
                                    tag="SEA"
                                    {...theme}
                                />
                                <p className="wk-stage-card__title" style={{ marginTop: 16 }}>
                                    MiniSidebarPlayer
                                </p>
                                <MiniSidebarPlayer art={NO_LUCK_ART} {...theme} />
                            </div>
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">StickyBottomPlayer (inline)</p>
                            <StickyBottomPlayer fixed={false} {...theme} />
                        </div>
                    </AudioSessionProvider>
                    <div className="wk-stage-card">
                        <p className="wk-stage-card__title">
                            Portable AudioPlayer {autoTheme ? "· Auto Theme from its artwork" : ""}
                        </p>
                        <AudioPlayer
                            key={autoTheme ? "auto" : "manual"}
                            title="Theme preview"
                            artist="SEIHouse"
                            tracks={noLuckTracks.slice(0, 3)}
                            backgroundImage={{ src: OG_BG }}
                            darkenAmount={40}
                            plugins={autoThemePlugins}
                            {...theme}
                        />
                        {autoTheme && <PaletteSwatches palette={palette} />}
                    </div>
                </>
            }
            controls={
                <>
                    <Panel title="Presets">
                        <ButtonRow>
                            {THEME_PRESETS.map((preset) => (
                                <Button
                                    key={preset.label}
                                    onClick={() =>
                                        setTheme((prev) => ({ ...prev, ...preset.theme }))
                                    }
                                >
                                    {preset.label}
                                </Button>
                            ))}
                            <Button
                                variant="ghost"
                                onClick={() => setTheme(defaultWorkshopSettings().theme)}
                            >
                                Reset
                            </Button>
                        </ButtonRow>
                    </Panel>
                    <Panel
                        title="Colors"
                        hint="Every theme prop from the shared property registry."
                    >
                        <div className="framer-panel wk-embedded-panel">
                            {THEME_DESCRIPTORS.map((descriptor) => (
                                <PropertyControl
                                    key={descriptor.id}
                                    descriptor={descriptor}
                                    value={
                                        theme[
                                            descriptor.propPath.replace(
                                                /^theme\./,
                                                ""
                                            ) as keyof Theme
                                        ]
                                    }
                                    onSet={setPath}
                                />
                            ))}
                        </div>
                    </Panel>
                    <Panel title="Auto Theme">
                        <Switch
                            label="Derive colors from artwork"
                            hint="Runs on the portable player, whose artwork allows pixel reads"
                            checked={autoTheme}
                            onChange={(next) => {
                                setAutoTheme(next)
                                setPalette(null)
                            }}
                        />
                        <Note tone="placeholder">
                            Auto Theme reads the artwork's pixels, so the image host must allow it.
                            The No Luck cover host does not, so this uses the sample artwork.
                        </Note>
                    </Panel>
                    <Panel title="Export">
                        <Button onClick={copy}>
                            {copied ? "Copied!" : "Copy theme as props (JSON)"}
                        </Button>
                        <pre className="wk-pre">{JSON.stringify(theme, null, 2)}</pre>
                    </Panel>
                </>
            }
        />
    )
}
