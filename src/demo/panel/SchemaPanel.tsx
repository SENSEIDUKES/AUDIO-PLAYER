import { useState } from "react"
import type { ReactNode } from "react"
import type { AudioPlayerTheme, PropertyGroup } from "../../audio-player"
import {
    PROPERTY_GROUPS,
    PROPERTY_GROUP_LABELS,
    getByPropPath,
    getPropertiesForGroup,
    setByPropPath,
} from "../../audio-player"
import type { WorkshopFaceDefinition, WorkshopSettings } from "../workshopFaces"
import { PropertyControl } from "./PropertyControl"

const THEME_PRESETS: {
    label: string
    theme: Partial<AudioPlayerTheme>
}[] = [
    {
        label: "OG Glass",
        theme: {
            accentColor: "#FFFFFF",
            textColor: "#FFFFFF",
            progressColor: "#000000",
            trackColor: "#CCCCCC",
            playIconColor: "#000000",
            backgroundColor: "rgba(255, 255, 255, 0)",
        },
    },
    {
        label: "SEI Purple",
        theme: {
            accentColor: "#7C5CFF",
            textColor: "#FFFFFF",
            progressColor: "#7C5CFF",
            trackColor: "rgba(124,92,255,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(20,20,28,0.6)",
        },
    },
    {
        label: "Neon Green",
        theme: {
            accentColor: "#22D3A6",
            textColor: "#FFFFFF",
            progressColor: "#22D3A6",
            trackColor: "rgba(34,211,166,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(16,28,22,0.6)",
        },
    },
    {
        label: "Error Red",
        theme: {
            accentColor: "#ff5a55",
            textColor: "#FFFFFF",
            progressColor: "#ff5a55",
            trackColor: "rgba(255,90,85,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(40,16,16,0.6)",
        },
    },
]

/* Top-level so React keeps stable component identity across renders (avoids
   the unmount-on-keystroke input bug). */
function Section({
    id,
    title,
    open,
    onToggle,
    children,
}: {
    id: string
    title: string
    open: boolean
    onToggle: (id: string) => void
    children: ReactNode
}) {
    return (
        <section className={`framer-panel__section${open ? " framer-panel__section--open" : ""}`}>
            <button
                type="button"
                className="framer-panel__section-head"
                onClick={() => onToggle(id)}
                aria-expanded={open}
            >
                <span>{title}</span>
                <span className="framer-panel__chevron">▶</span>
            </button>
            <div className="framer-panel__section-body">{children}</div>
        </section>
    )
}

/**
 * The unified, schema-driven Properties panel. It renders the four sections
 * (Content / Appearance / Playback / Advanced) by mapping the shared property
 * registry for the active face — no hand-written per-face controls. Empty
 * sections hide themselves.
 */
export function SchemaPanel({
    face,
    settings,
    onChange,
    onReset,
}: {
    face: WorkshopFaceDefinition
    settings: WorkshopSettings
    onChange: (next: WorkshopSettings) => void
    onReset: () => void
}) {
    const [open, setOpen] = useState<Record<string, boolean>>({
        content: true,
        appearance: true,
        playback: true,
        advanced: false,
    })
    const [copied, setCopied] = useState(false)

    const toggle = (id: string) =>
        setOpen((o) => ({ ...o, [id]: !o[id] }))

    const setPath = (propPath: string, value: unknown) =>
        onChange(
            setByPropPath(
                settings as unknown as Record<string, unknown>,
                propPath,
                value
            ) as unknown as WorkshopSettings
        )

    const applyThemePreset = (theme: Partial<AudioPlayerTheme>) =>
        onChange({ ...settings, theme: { ...settings.theme, ...theme } })

    const buildJsx = (): string => {
        const t = settings.theme
        const lines = [
            "<AudioPlayer",
            "    tracks={tracks}",
            `    accentColor={"${t.accentColor}"}`,
            `    playIconColor={"${t.playIconColor}"}`,
            `    textColor={"${t.textColor}"}`,
            `    progressColor={"${t.progressColor}"}`,
            `    trackColor={"${t.trackColor}"}`,
            `    backgroundColor={"${t.backgroundColor}"}`,
            t.glowColor && t.glowColor !== "transparent"
                ? `    glowColor={"${t.glowColor}"}`
                : null,
            t.glowIntensity !== undefined && t.glowIntensity !== 100
                ? `    glowIntensity={${t.glowIntensity}}`
                : null,
            t.buttonOpacity !== undefined && t.buttonOpacity !== 0
                ? `    buttonOpacity={${t.buttonOpacity}}`
                : null,
            settings.backgroundMedia
                ? `    backgroundMedia={${JSON.stringify(settings.backgroundMedia)}}`
                : `    backgroundImage={{ src: "${settings.backgroundImageSrc}" }}`,
            `    blurSize={${settings.blurSize}}`,
            `    darkenAmount={${settings.darkenAmount}}`,
            `    autoPlay={${settings.autoPlay}}`,
            `    shuffle={${settings.shuffle}}`,
            `    repeatMode={"${settings.repeatMode}"}`,
            `    showTracklist={${settings.showTracklist}}`,
            `    showVolume={${settings.showVolume}}`,
            `    showWaveform={${settings.showWaveform}}`,
            "/>",
        ]
        return lines.filter((l): l is string => l !== null).join("\n")
    }

    const handleCopy = async () => {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(buildJsx())
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
            }
        } catch {
            /* ignore */
        }
    }

    return (
        <aside className="framer-panel" aria-label="Face properties">
            <div className="framer-panel__head">
                <p className="framer-panel__title">{face.label} · Properties</p>
                <div className="framer-panel__actions">
                    <button
                        type="button"
                        className="framer-panel__btn framer-panel__btn--accent"
                        onClick={onReset}
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div className="framer-panel__body">
                {PROPERTY_GROUPS.map((group: PropertyGroup) => {
                    const props = getPropertiesForGroup(face.playerFace, group)
                    if (props.length === 0) return null
                    return (
                        <Section
                            key={group}
                            id={group}
                            title={PROPERTY_GROUP_LABELS[group]}
                            open={open[group] ?? false}
                            onToggle={toggle}
                        >
                            {props.map((d) => (
                                <PropertyControl
                                    key={d.id}
                                    descriptor={d}
                                    value={getByPropPath(
                                        settings as unknown as Record<string, unknown>,
                                        d.propPath
                                    )}
                                    onSet={setPath}
                                />
                            ))}
                            {group === "appearance" && (
                                <div className="framer-panel__preset-row">
                                    {THEME_PRESETS.map((p) => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            className="framer-panel__preset"
                                            onClick={() => applyThemePreset(p.theme)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Section>
                    )
                })}
            </div>

            {face.playerFace === "portable" && (
                <div className="framer-panel__footer">
                    <button
                        type="button"
                        className={`framer-panel__copy${copied ? " framer-panel__copy--ok" : ""}`}
                        onClick={handleCopy}
                    >
                        {copied ? "Copied!" : "Copy props as JSX"}
                    </button>
                </div>
            )}
        </aside>
    )
}
