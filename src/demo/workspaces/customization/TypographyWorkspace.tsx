import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import {
    AudioSessionProvider,
    FullCardPlayer,
    PROPERTY_REGISTRY,
    SeaCardPlayer,
    StickyBottomPlayer,
    TrackMetadata,
    VaultRowPlayer,
} from "../../../audio-player"
import type { Track, TrackMetadataVariant } from "../../../audio-player"
import { NO_LUCK_ART, SEA_THEME, noLuckTracks } from "../../data"
import { PropertyControl } from "../../panel/PropertyControl"
import { defaultWorkshopSettings } from "../../workshopFaces"
import { Note, Panel, RangeField, SplitLayout, Switch, TextField } from "../../workshop/ui"

/* Typography and metadata: the shared TrackMetadata block in every density,
   the optional extended metadata fields, marquee scrolling, and the title and
   artist fonts on the faces that take them. */

const VARIANTS: readonly TrackMetadataVariant[] = ["hero", "compact", "bar", "row"]
const FONT_DESCRIPTORS = PROPERTY_REGISTRY.filter(
    (d) => d.id === "titleFont" || d.id === "artistFont"
)

interface Fields {
    title: string
    artist: string
    featured: string
    versionLabel: string
    albumTitle: string
    releaseTitle: string
    explicit: boolean
}

const INITIAL: Fields = {
    title: "Heartbreak Hotel",
    artist: "SENSEI",
    featured: "",
    versionLabel: "Extended Mix",
    albumTitle: "No Luck",
    releaseTitle: "No Luck (Deluxe)",
    explicit: true,
}

function toTrack(fields: Fields): Track {
    const featured = fields.featured
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    return {
        ...noLuckTracks[2],
        title: fields.title,
        artist: fields.artist,
        featuredArtists: featured.length ? featured : undefined,
        versionLabel: fields.versionLabel || undefined,
        albumTitle: fields.albumTitle || undefined,
        releaseTitle: fields.releaseTitle || undefined,
        explicit: fields.explicit,
    }
}

export function TypographyWorkspace() {
    const [fields, setFields] = useState<Fields>(INITIAL)
    const [marquee, setMarquee] = useState(true)
    const [width, setWidth] = useState(320)
    const [fonts, setFonts] = useState<{ titleFont: CSSProperties; artistFont: CSSProperties }>(
        () => {
            const d = defaultWorkshopSettings()
            return { titleFont: d.titleFont, artistFont: d.artistFont }
        }
    )
    const track = useMemo(() => toTrack(fields), [fields])

    // Faces read the session's queue once, so rebuild it shortly after edits.
    const [sessionTrack, setSessionTrack] = useState(track)
    useEffect(() => {
        const timer = setTimeout(() => setSessionTrack(track), 400)
        return () => clearTimeout(timer)
    }, [track])

    const set = (key: keyof Fields) => (value: string) =>
        setFields((prev) => ({ ...prev, [key]: value }))

    return (
        <SplitLayout
            stage={
                <>
                    <div className="wk-stage-card">
                        <p className="wk-stage-card__title">
                            TrackMetadata · every density at {width}px
                        </p>
                        <div className="wk-meta-grid">
                            {VARIANTS.map((variant) => (
                                <div
                                    key={variant}
                                    className="wk-meta-cell"
                                    style={{ width, maxWidth: "100%" }}
                                >
                                    <span className="wk-meta-cell__label">{variant}</span>
                                    <TrackMetadata
                                        track={track}
                                        variant={variant}
                                        enableMarquee={
                                            marquee && (variant === "hero" || variant === "compact")
                                        }
                                        showTertiary={variant === "hero"}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <AudioSessionProvider
                        key={JSON.stringify(sessionTrack)}
                        initialQueue={[sessionTrack]}
                    >
                        <div className="wk-stage-grid">
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">FullCardPlayer</p>
                                <FullCardPlayer {...fonts} art={NO_LUCK_ART} {...SEA_THEME} />
                            </div>
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">SeaCardPlayer</p>
                                <SeaCardPlayer
                                    track={sessionTrack}
                                    art={NO_LUCK_ART}
                                    tag="SEA"
                                    {...fonts}
                                    {...SEA_THEME}
                                />
                            </div>
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">Bar and row</p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                            <VaultRowPlayer track={sessionTrack} number={1} {...SEA_THEME} />
                        </div>
                    </AudioSessionProvider>
                </>
            }
            controls={
                <>
                    <Panel
                        title="Metadata"
                        hint="Optional Track fields; faces degrade gracefully without them."
                    >
                        <TextField label="Title" value={fields.title} onChange={set("title")} />
                        <TextField label="Artist" value={fields.artist} onChange={set("artist")} />
                        <TextField
                            label="Featured artists (comma-separated)"
                            value={fields.featured}
                            placeholder="e.g. Nova, Kiri"
                            onChange={set("featured")}
                        />
                        <TextField
                            label="Version label"
                            value={fields.versionLabel}
                            onChange={set("versionLabel")}
                        />
                        <TextField
                            label="Album"
                            value={fields.albumTitle}
                            onChange={set("albumTitle")}
                        />
                        <TextField
                            label="Release (hero only)"
                            value={fields.releaseTitle}
                            onChange={set("releaseTitle")}
                        />
                        <Switch
                            label="Explicit"
                            checked={fields.explicit}
                            onChange={(explicit) => setFields((prev) => ({ ...prev, explicit }))}
                        />
                    </Panel>
                    <Panel title="Layout">
                        <RangeField
                            label="Metadata width"
                            value={width}
                            min={140}
                            max={640}
                            step={10}
                            unit="px"
                            onChange={setWidth}
                        />
                        <Switch
                            label="Marquee on long titles"
                            hint="Hero and compact only; off when the system asks for reduced motion"
                            checked={marquee}
                            onChange={setMarquee}
                        />
                    </Panel>
                    <Panel
                        title="Fonts"
                        hint="titleFont / artistFont, on the faces that accept them."
                    >
                        <div className="framer-panel wk-embedded-panel">
                            {FONT_DESCRIPTORS.map((descriptor) => (
                                <PropertyControl
                                    key={descriptor.id}
                                    descriptor={descriptor}
                                    value={fonts[descriptor.id as "titleFont" | "artistFont"]}
                                    onSet={(_path, value) =>
                                        setFonts((prev) => ({
                                            ...prev,
                                            [descriptor.id]: value as CSSProperties,
                                        }))
                                    }
                                />
                            ))}
                        </div>
                    </Panel>
                    <Note>
                        Faces rebuild their session shortly after each edit, so playback restarts.
                    </Note>
                </>
            }
        />
    )
}
