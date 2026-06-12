import { StrictMode, useEffect, useMemo, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { createRoot } from "react-dom/client"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    VaultRowPlayer,
    StickyBottomPlayer,
    MiniSidebarPlayer,
    SeaCardPlayer,
    createAnalyticsPlugin,
    createAutomixProPlugin,
    createKeyboardShortcutPlugin,
    createLyricsPlugin,
    createSleepTimerPlugin,
    formatTime,
    getTrackAnalysis,
    useAudioPlayer,
    useAudioSession,
    useSAPPropGetters,
    PluginRegistryProvider,
    useActivePluginInstances,
    PluginManagerPanel,
} from "../audio-player"
import type { AudioBackendKind, AudioPlayerProps, Track } from "../audio-player"
import "./audio-player-lab.css"

/* ----------------------------- OG Framer defaults ----------------------------- */
const OG_DEFAULTS: AudioPlayerProps = {
    audioFile:
        "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
    backgroundColor: "rgba(255, 255, 255, 0)",
    accentColor: "#FFFFFF",
    textColor: "#FFFFFF",
    progressColor: "#000000",
    trackColor: "#CCCCCC",
    autoPlay: false,
    loop: false,
    title: "Audio Track",
    artist: "Artist Name",
    titleFont: {
        fontSize: "24px",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: "1.2em",
    },
    artistFont: {
        fontSize: "15px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        lineHeight: "1.3em",
    },
    playIconColor: "#000000",
    blurSize: 20,
    purchaseUrl: "",
    backgroundImage: {
        src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
    },
    darkenAmount: 45,
    lyrics: "",
    showTracklist: false,
}

const SAMPLE =
    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"
const BROKEN = "https://example.com/this-track-does-not-exist.mp3"
const OG_BG =
    "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg"

// All three share the same SAMPLE URL to validate the sourceKey fix:
// switching between First Light → Midnight Run → Aurora must reset
// currentTime, duration, and buffered even though the src is unchanged.
const playlist: Track[] = [
    { id: "track-1", title: "First Light", artist: "SEIHouse", audioFile: SAMPLE, lyrics: "Verse one\nVerse two\nChorus line", purchaseUrl: "https://example.com/buy/first-light" },
    { id: "track-2", title: "Midnight Run", artist: "SEIHouse", audioFile: SAMPLE, lyrics: "Late night city glow\nNeon on the wall", purchaseUrl: "https://example.com/buy/midnight-run" },
    { id: "track-3", title: "Signal Lost", artist: "SEIHouse", audioFile: BROKEN, lyrics: "(unreachable)" },
    { id: "track-4", title: "Aurora", artist: "SEIHouse", audioFile: SAMPLE },
]

/* rgba/hex normalizer: <input type=color> only accepts 7-char hex, but the
   audio player uses hex AND rgba() strings. Fall back to white for anything
   the picker can't render so the user still sees a swatch. */
function normalizeColor(value: string | undefined, fallback = "#000000"): string {
    if (!value) return fallback
    const v = value.trim()
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v
    // extract rgb/rgba into hex
    const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) {
        const r = Number(m[1]).toString(16).padStart(2, "0")
        const g = Number(m[2]).toString(16).padStart(2, "0")
        const b = Number(m[3]).toString(16).padStart(2, "0")
        return `#${r}${g}${b}`
    }
    return fallback
}

/* ----------------------------- Reusable lab chrome ----------------------------- */
function FeedHeader({ author, label }: { author: string; label: string }) {
    return (
        <div className="lab-feed__meta">
            <div className="lab-feed__meta-avatar" />
            <div>
                <div className="lab-feed__meta-author">{author}</div>
                <div style={{ fontSize: 12, color: "var(--lab-text-faint)" }}>
                    {label}
                </div>
            </div>
        </div>
    )
}

function Checklist() {
    return (
        <div className="lab-checklist">
            <div className="lab-checklist__title">Run through these before merging</div>
            <div className="lab-checklist__item"><strong>Playback</strong> — play, pause, end-of-track advance.</div>
            <div className="lab-checklist__item"><strong>Scrubber</strong> — click, drag, keyboard (←/→, Shift = 30s).</div>
            <div className="lab-checklist__item"><strong>Volume / Mute</strong> — slider, mute toggle, drag-from-zero.</div>
            <div className="lab-checklist__item"><strong>Errors</strong> — broken URL, missing audio, retry.</div>
            <div className="lab-checklist__item"><strong>Layout</strong> — phone, sidebar, sticky, narrow cards.</div>
            <div className="lab-checklist__item"><strong>Keyboard</strong> — Space, J, K, L, N, P scoped to player.</div>
        </div>
    )
}

function PhoneFrame({ children, art, topLeft, topRight }: { children: ReactNode; art: string; topLeft: string; topRight: string }) {
    return (
        <div className="lab-phone">
            <div className="lab-phone__notch" />
            <div className="lab-phone__screen">
                <div className="lab-phone__top">
                    <span>{topLeft}</span>
                    <span>{topRight}</span>
                </div>
                <div className="ap-art lab-phone__art" style={{ backgroundImage: art }} />
                {children}
                <div className="lab-phone__handle" />
            </div>
        </div>
    )
}

function RapidStep({ n, title, body }: { n: number; title: string; body: string }) {
    return (
        <div className="lab-rapid__step">
            <div className="lab-rapid__step-num">{n}</div>
            <div><strong>{title}</strong> — {body}</div>
        </div>
    )
}

/* ----------------------------- Framer-style control panel ----------------------------- */
type CustomizerState = Required<
    Pick<
        AudioPlayerProps,
        | "title" | "artist" | "audioFile" | "lyrics" | "purchaseUrl"
        | "backgroundColor" | "accentColor" | "textColor" | "progressColor"
        | "trackColor" | "playIconColor" | "blurSize" | "darkenAmount"
        | "autoPlay" | "loop" | "shuffle" | "repeatMode" | "showTracklist"
    >
> & {
    titleFont: NonNullable<AudioPlayerProps["titleFont"]>
    artistFont: NonNullable<AudioPlayerProps["artistFont"]>
    backgroundImage: NonNullable<AudioPlayerProps["backgroundImage"]>
    playlistMode: boolean
    tracks: Track[]
}

const FONT_WEIGHTS = [
    { value: 300, label: "Light" },
    { value: 400, label: "Regular" },
    { value: 500, label: "Medium" },
    { value: 600, label: "Semibold" },
    { value: 700, label: "Bold" },
    { value: 800, label: "Extrabold" },
]

const COLOR_PRESETS: { label: string; state: Partial<CustomizerState> }[] = [
    {
        label: "OG Glass",
        state: {
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
        state: {
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
        state: {
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
        state: {
            accentColor: "#ff5a55",
            textColor: "#FFFFFF",
            progressColor: "#ff5a55",
            trackColor: "rgba(255,90,85,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(40,16,16,0.6)",
        },
    },
]

function FramerControlPanel({
    state,
    onChange,
    onReset,
}: {
    state: CustomizerState
    onChange: (next: CustomizerState) => void
    onReset: () => void
}) {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        tracks: true, background: true, typography: false, colors: true, behavior: true, presets: true,
    })
    const [copied, setCopied] = useState(false)

    const toggleGroup = (key: string) =>
        setOpenGroups((g) => ({ ...g, [key]: !g[key] }))

    const set = <K extends keyof CustomizerState>(key: K, value: CustomizerState[K]) =>
        onChange({ ...state, [key]: value })

    const setFont = (which: "titleFont" | "artistFont", patch: Partial<CSSProperties>) =>
        onChange({ ...state, [which]: { ...state[which], ...patch } })

    const buildJsx = (): string => {
        const lines: string[] = ["<AudioPlayer"]
        const skip: Array<keyof CustomizerState> = [
            "titleFont",
            "artistFont",
            "backgroundImage",
            "tracks",
            "playlistMode",
        ]
        const scalarKeys: Array<keyof CustomizerState> = [
            "title", "artist", "audioFile", "lyrics", "purchaseUrl",
            "backgroundColor", "accentColor", "textColor", "progressColor",
            "trackColor", "playIconColor", "blurSize", "darkenAmount",
            "autoPlay", "loop", "shuffle", "repeatMode", "showTracklist",
        ]
        const formatScalar = (v: unknown): string => {
            if (typeof v === "string") return `"${v}"`
            if (typeof v === "boolean" || typeof v === "number") return `{${String(v)}}`
            return `{${JSON.stringify(v)}}`
        }
        for (const k of scalarKeys) {
            if (skip.includes(k)) continue
            const v = state[k]
            if (v === "" || v === undefined) continue
            if (state.playlistMode && (k === "title" || k === "artist" || k === "audioFile" || k === "lyrics" || k === "purchaseUrl")) continue
            lines.push(`    ${k}={${formatScalar(v)}}`)
        }
        if (state.playlistMode && state.tracks.length > 0) {
            const trackObjs = state.tracks
                .map((t) => {
                    const parts: string[] = []
                    parts.push(`title: "${t.title}"`)
                    if (t.artist) parts.push(`artist: "${t.artist}"`)
                    parts.push(`audioFile: "${t.audioFile}"`)
                    if (t.lyrics) parts.push(`lyrics: "${t.lyrics}"`)
                    if (t.purchaseUrl) parts.push(`purchaseUrl: "${t.purchaseUrl}"`)
                    return `{ ${parts.join(", ")} }`
                })
                .join(",\n        ")
            lines.push(`    tracks={[\n        ${trackObjs}\n    ]}`)
        }
        if (state.titleFont) {
            const f = state.titleFont
            lines.push(
                `    titleFont={{ fontSize: "${f.fontSize ?? ""}", fontWeight: ${f.fontWeight ?? 500}, letterSpacing: "${f.letterSpacing ?? ""}", lineHeight: "${f.lineHeight ?? ""}" }}`
            )
        }
        if (state.artistFont) {
            const f = state.artistFont
            lines.push(
                `    artistFont={{ fontSize: "${f.fontSize ?? ""}", fontWeight: ${f.fontWeight ?? 500}, letterSpacing: "${f.letterSpacing ?? ""}", lineHeight: "${f.lineHeight ?? ""}" }}`
            )
        }
        if (state.backgroundImage?.src) {
            lines.push(`    backgroundImage={{ src: "${state.backgroundImage.src}" }}`)
        }
        lines.push("/>")
        return lines.join("\n")
    }

    const handleCopy = async () => {
        const text = buildJsx()
        try {
            if (navigator.clipboard) await navigator.clipboard.writeText(text)
        } catch { /* ignore */ }
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    const applyPreset = (preset: typeof COLOR_PRESETS[number]) =>
        onChange({ ...state, ...preset.state })

    return (
        <aside className="framer-panel" aria-label="OG Framer property controls">
            <div className="framer-panel__head">
                <p className="framer-panel__title">Audio Player · Properties</p>
                <div className="framer-panel__actions">
                    <button type="button" className="framer-panel__btn framer-panel__btn--accent" onClick={onReset}>
                        Reset
                    </button>
                </div>
            </div>
            <div className="framer-panel__body">
                <ControlGroup id="tracks" openGroups={openGroups} onToggle={toggleGroup} title="Tracks / content">
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-title">Title</label>
                        <input id="fr-title" className="framer-panel__input" value={state.title} onChange={(e) => set("title", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-artist">Artist</label>
                        <input id="fr-artist" className="framer-panel__input" value={state.artist} onChange={(e) => set("artist", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-audio">Audio File</label>
                        <input id="fr-audio" className="framer-panel__input" value={state.audioFile} onChange={(e) => set("audioFile", e.target.value)} placeholder="https://… or mp3/wav/ogg" />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-purchase">Purchase Link</label>
                        <input id="fr-purchase" className="framer-panel__input" value={state.purchaseUrl} onChange={(e) => set("purchaseUrl", e.target.value)} />
                    </div>
                    <div className="framer-panel__row framer-panel__row--col"><label className="framer-panel__label" htmlFor="fr-lyrics">Lyrics</label>
                        <textarea id="fr-lyrics" className="framer-panel__textarea" value={state.lyrics} onChange={(e) => set("lyrics", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-tracklist">Show Tracklist</label>
                        <button id="fr-tracklist" type="button"
                            className={`framer-panel__toggle${state.showTracklist ? " framer-panel__toggle--on" : ""}`}
                            onClick={() => set("showTracklist", !state.showTracklist)}
                            aria-pressed={state.showTracklist}
                            aria-label="Toggle tracklist visibility" />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-playlist">Playlist Mode</label>
                        <button id="fr-playlist" type="button"
                            className={`framer-panel__toggle${state.playlistMode ? " framer-panel__toggle--on" : ""}`}
                            onClick={() => set("playlistMode", !state.playlistMode)}
                            aria-pressed={state.playlistMode}
                            aria-label="Toggle playlist mode" />
                    </div>
                    {state.playlistMode && (
                        <div className="framer-panel__tracks">
                            <div className="framer-panel__tracks-head">
                                <span>Tracks ({state.tracks.length})</span>
                                <button
                                    type="button"
                                    className="framer-panel__btn"
                                    onClick={() =>
                                        set("tracks", [
                                            ...state.tracks,
                                            {
                                                title: `Track ${state.tracks.length + 1}`,
                                                artist: state.artist || "SEIHouse",
                                                audioFile: SAMPLE,
                                            },
                                        ])
                                    }
                                >
                                    + Add
                                </button>
                            </div>
                            <div className="framer-panel__tracks-list">
                                {state.tracks.map((t, i) => (
                                    <div key={i} className="framer-panel__track">
                                        <div className="framer-panel__track-num">{i + 1}</div>
                                        <div className="framer-panel__track-fields">
                                            <input
                                                className="framer-panel__input"
                                                value={t.title}
                                                placeholder="Title"
                                                onChange={(e) => {
                                                    const next = [...state.tracks]
                                                    next[i] = { ...t, title: e.target.value }
                                                    set("tracks", next)
                                                }}
                                            />
                                            <input
                                                className="framer-panel__input"
                                                value={t.artist}
                                                placeholder="Artist"
                                                onChange={(e) => {
                                                    const next = [...state.tracks]
                                                    next[i] = { ...t, artist: e.target.value }
                                                    set("tracks", next)
                                                }}
                                            />
                                            <input
                                                className="framer-panel__input"
                                                value={t.audioFile}
                                                placeholder="Audio URL"
                                                onChange={(e) => {
                                                    const next = [...state.tracks]
                                                    next[i] = { ...t, audioFile: e.target.value }
                                                    set("tracks", next)
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="framer-panel__track-remove"
                                            onClick={() =>
                                                set(
                                                    "tracks",
                                                    state.tracks.filter((_, idx) => idx !== i)
                                                )
                                            }
                                            aria-label={`Remove track ${i + 1}`}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="framer-panel__preset-row">
                                <button
                                    type="button"
                                    className="framer-panel__preset"
                                    onClick={() =>
                                        set("tracks", [
                                            { title: "First Light", artist: "SEIHouse", audioFile: SAMPLE },
                                            { title: "Midnight Run", artist: "SEIHouse", audioFile: SAMPLE },
                                            { title: "Signal Lost", artist: "SEIHouse", audioFile: BROKEN },
                                            { title: "Aurora", artist: "SEIHouse", audioFile: SAMPLE },
                                        ])
                                    }
                                >
                                    Sample playlist
                                </button>
                                <button
                                    type="button"
                                    className="framer-panel__preset framer-panel__preset--warn"
                                    onClick={() => set("tracks", [])}
                                >
                                    Clear tracks
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="framer-panel__preset-row">
                        <button type="button" className="framer-panel__preset" onClick={() => set("audioFile", SAMPLE)}>Valid sample</button>
                        <button type="button" className="framer-panel__preset framer-panel__preset--err" onClick={() => set("audioFile", BROKEN)}>Broken URL</button>
                        <button type="button" className="framer-panel__preset framer-panel__preset--warn" onClick={() => set("audioFile", "")}>Empty source</button>
                        <button type="button" className="framer-panel__preset" onClick={() => set("backgroundImage", { src: OG_BG })}>OG background</button>
                    </div>
                </ControlGroup>

                <ControlGroup id="background" openGroups={openGroups} onToggle={toggleGroup} title="Background">
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-bg">Image URL</label>
                        <input id="fr-bg" className="framer-panel__input" value={state.backgroundImage.src} onChange={(e) => set("backgroundImage", { ...state.backgroundImage, src: e.target.value })} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-blur">Blur Size</label>
                        <input id="fr-blur" className="framer-panel__range" type="range" min={0} max={50} step={1} value={state.blurSize} onChange={(e) => set("blurSize", Number(e.target.value))} />
                    </div>
                    <div className="framer-panel__value">{state.blurSize}px</div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-darken">Darken Image</label>
                        <input id="fr-darken" className="framer-panel__range" type="range" min={0} max={100} step={1} value={state.darkenAmount} onChange={(e) => set("darkenAmount", Number(e.target.value))} />
                    </div>
                    <div className="framer-panel__value">{state.darkenAmount}%</div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-bgcolor">Background Color</label>
                        <input id="fr-bgcolor" className="framer-panel__color" type="color" value={normalizeColor(state.backgroundColor, "#ffffff")} onChange={(e) => set("backgroundColor", e.target.value)} />
                    </div>
                </ControlGroup>

                <ControlGroup id="typography" openGroups={openGroups} onToggle={toggleGroup} title="Typography">
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-titlesz">Title Size</label>
                        <input id="fr-titlesz" className="framer-panel__input" value={state.titleFont.fontSize ?? ""} onChange={(e) => setFont("titleFont", { fontSize: e.target.value })} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-titlew">Title Weight</label>
                        <select id="fr-titlew" className="framer-panel__select" value={String(state.titleFont.fontWeight ?? 500)} onChange={(e) => setFont("titleFont", { fontWeight: Number(e.target.value) })}>
                            {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                        </select>
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-titlels">Title Tracking</label>
                        <input id="fr-titlels" className="framer-panel__input" value={state.titleFont.letterSpacing ?? ""} onChange={(e) => setFont("titleFont", { letterSpacing: e.target.value })} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-titlelh">Title Leading</label>
                        <input id="fr-titlelh" className="framer-panel__input" value={state.titleFont.lineHeight ?? ""} onChange={(e) => setFont("titleFont", { lineHeight: e.target.value })} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-artistsz">Artist Size</label>
                        <input id="fr-artistsz" className="framer-panel__input" value={state.artistFont.fontSize ?? ""} onChange={(e) => setFont("artistFont", { fontSize: e.target.value })} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-artistw">Artist Weight</label>
                        <select id="fr-artistw" className="framer-panel__select" value={String(state.artistFont.fontWeight ?? 500)} onChange={(e) => setFont("artistFont", { fontWeight: Number(e.target.value) })}>
                            {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                        </select>
                    </div>
                </ControlGroup>

                <ControlGroup id="colors" openGroups={openGroups} onToggle={toggleGroup} title="Colors">
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-accent">Button Color</label>
                        <input id="fr-accent" className="framer-panel__color" type="color" value={normalizeColor(state.accentColor)} onChange={(e) => set("accentColor", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-icon">Play Icon Color</label>
                        <input id="fr-icon" className="framer-panel__color" type="color" value={normalizeColor(state.playIconColor)} onChange={(e) => set("playIconColor", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-text">Text Color</label>
                        <input id="fr-text" className="framer-panel__color" type="color" value={normalizeColor(state.textColor, "#ffffff")} onChange={(e) => set("textColor", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-progress">Progress Color</label>
                        <input id="fr-progress" className="framer-panel__color" type="color" value={normalizeColor(state.progressColor)} onChange={(e) => set("progressColor", e.target.value)} />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-track">Track Color</label>
                        <input id="fr-track" className="framer-panel__color" type="color" value={normalizeColor(state.trackColor)} onChange={(e) => set("trackColor", e.target.value)} />
                    </div>
                </ControlGroup>

                <ControlGroup id="behavior" openGroups={openGroups} onToggle={toggleGroup} title="Behavior">
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-autoplay">Auto Play</label>
                        <button id="fr-autoplay" type="button"
                            className={`framer-panel__toggle${state.autoPlay ? " framer-panel__toggle--on" : ""}`}
                            onClick={() => set("autoPlay", !state.autoPlay)}
                            aria-pressed={state.autoPlay}
                            aria-label="Toggle autoplay" />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-shuffle">Shuffle</label>
                        <button id="fr-shuffle" type="button"
                            className={`framer-panel__toggle${state.shuffle ? " framer-panel__toggle--on" : ""}`}
                            onClick={() => set("shuffle", !state.shuffle)}
                            aria-pressed={state.shuffle}
                            aria-label="Toggle shuffle" />
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-repeat">Repeat Mode</label>
                        <select id="fr-repeat" className="framer-panel__select" value={state.repeatMode} onChange={(e) => set("repeatMode", e.target.value as CustomizerState["repeatMode"])}>
                            <option value="off">Off</option>
                            <option value="all">All</option>
                            <option value="one">One</option>
                        </select>
                    </div>
                    <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="fr-loop">Legacy Loop</label>
                        <button id="fr-loop" type="button"
                            className={`framer-panel__toggle${state.loop ? " framer-panel__toggle--on" : ""}`}
                            onClick={() => set("loop", !state.loop)}
                            aria-pressed={state.loop}
                            aria-label="Toggle legacy loop" />
                    </div>
                </ControlGroup>

                <ControlGroup id="presets" openGroups={openGroups} onToggle={toggleGroup} title="Theme presets">
                    <div className="framer-panel__preset-row">
                        {COLOR_PRESETS.map((p) => (
                            <button key={p.label} type="button" className="framer-panel__preset" onClick={() => applyPreset(p)}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </ControlGroup>
            </div>
            <div className="framer-panel__footer">
                <button
                    type="button"
                    className={`framer-panel__copy${copied ? " framer-panel__copy--ok" : ""}`}
                    onClick={handleCopy}
                >
                    {copied ? "Copied!" : "Copy props as JSX"}
                </button>
            </div>
        </aside>
    )
}

/* Top-level so React keeps the same component identity across renders.
   Defining it inside FramerControlPanel would unmount/remount the inputs
   on every keystroke, which is what caused the "only one character" bug. */
function ControlGroup({
    id,
    title,
    openGroups,
    onToggle,
    children,
}: {
    id: string
    title: string
    openGroups: Record<string, boolean>
    onToggle: (id: string) => void
    children: ReactNode
}) {
    return (
        <div className={`framer-panel__group${openGroups[id] ? " framer-panel__group--open" : ""}`}>
            <div
                className="framer-panel__group-head"
                onClick={() => onToggle(id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onToggle(id)
                    }
                }}
            >
                <span>{title}</span>
                <span className="framer-panel__chevron">▶</span>
            </div>
            <div className="framer-panel__group-body">{children}</div>
        </div>
    )
}

/* ----------------------------- Live customizer (panel + player) ----------------------------- */
function defaultState(): CustomizerState {
    return {
        title: OG_DEFAULTS.title ?? "Audio Track",
        artist: OG_DEFAULTS.artist ?? "Artist Name",
        audioFile: OG_DEFAULTS.audioFile ?? SAMPLE,
        lyrics: OG_DEFAULTS.lyrics ?? "",
        purchaseUrl: OG_DEFAULTS.purchaseUrl ?? "",
        backgroundColor: OG_DEFAULTS.backgroundColor ?? "rgba(255,255,255,0)",
        accentColor: OG_DEFAULTS.accentColor ?? "#FFFFFF",
        textColor: OG_DEFAULTS.textColor ?? "#FFFFFF",
        progressColor: OG_DEFAULTS.progressColor ?? "#000000",
        trackColor: OG_DEFAULTS.trackColor ?? "#CCCCCC",
        playIconColor: OG_DEFAULTS.playIconColor ?? "#000000",
        blurSize: OG_DEFAULTS.blurSize ?? 20,
        darkenAmount: OG_DEFAULTS.darkenAmount ?? 45,
        autoPlay: OG_DEFAULTS.autoPlay ?? false,
        loop: OG_DEFAULTS.loop ?? false,
        shuffle: OG_DEFAULTS.shuffle ?? false,
        repeatMode: OG_DEFAULTS.repeatMode ?? "off",
        showTracklist: OG_DEFAULTS.showTracklist ?? false,
        titleFont: { ...(OG_DEFAULTS.titleFont as CSSProperties) },
        artistFont: { ...(OG_DEFAULTS.artistFont as CSSProperties) },
        backgroundImage: { ...(OG_DEFAULTS.backgroundImage as { src: string; alt?: string }) },
        playlistMode: false,
        tracks: [
            { title: "First Light", artist: "SEIHouse", audioFile: SAMPLE },
            { title: "Midnight Run", artist: "SEIHouse", audioFile: SAMPLE },
            { title: "Aurora", artist: "SEIHouse", audioFile: SAMPLE },
        ],
    }
}

function LiveCustomizer() {
    const [state, setState] = useState<CustomizerState>(defaultState)

    return (
        <>
            <FramerControlPanel
                state={state}
                onChange={setState}
                onReset={() => setState(defaultState())}
            />
            <div className="lab-feed__panel">
                <FeedHeader author="@seihouse" label="Live preview · tweak the panel →" />
                <h3 className="lab-feed__title">{state.title || "Untitled"}</h3>
                <div className="lab-feed__stats">
                    <span>Customizer</span>
                    <span>·</span>
                    <span>Real AudioPlayer</span>
                </div>
                <div className="lab-feed__player">
                    <AudioPlayer
                        {...(state.playlistMode && state.tracks.length > 0
                            ? { tracks: state.tracks }
                            : {
                                  title: state.title,
                                  artist: state.artist,
                                  audioFile: state.audioFile,
                                  lyrics: state.lyrics,
                                  purchaseUrl: state.purchaseUrl,
                              })}
                        backgroundColor={state.backgroundColor}
                        accentColor={state.accentColor}
                        textColor={state.textColor}
                        progressColor={state.progressColor}
                        trackColor={state.trackColor}
                        playIconColor={state.playIconColor}
                        blurSize={state.blurSize}
                        darkenAmount={state.darkenAmount}
                        autoPlay={state.autoPlay}
                        loop={state.loop}
                        shuffle={state.shuffle}
                        repeatMode={state.repeatMode}
                        showTracklist={state.showTracklist}
                        titleFont={state.titleFont}
                        artistFont={state.artistFont}
                        backgroundImage={state.backgroundImage}
                    />
                </div>
            </div>
        </>
    )
}

/* ----------------------------- Global session (one engine, many skins) ----------------------------- */
const SEA_THEME = {
    accentColor: "#7C5CFF",
    progressColor: "#7C5CFF",
    trackColor: "rgba(124,92,255,0.25)",
    playIconColor: "#0b0b12",
    textColor: "#FFFFFF",
    backgroundColor: "rgba(20,20,28,0.6)",
}

const SEA_ARTS = [
    "linear-gradient(135deg,#FF7AC6,#7C5CFF)",
    "linear-gradient(135deg,#22D3A6,#0EA5E9)",
    "linear-gradient(135deg,#F59E0B,#EF4444)",
    "linear-gradient(135deg,#A855F7,#EC4899)",
]

/* Raw, intentionally unstyled controls built from the headless prop getters.
   Reads the SAME session as every skin above it (useAudioSession), so it
   proves the adapter drives the one shared <audio> element instead of
   creating a second engine. */
function HeadlessAdapterProbe() {
    const session = useAudioSession()
    const {
        getPlayButtonProps,
        getMuteButtonProps,
        getPreviousButtonProps,
        getNextButtonProps,
        getSeekBackwardButtonProps,
        getSeekForwardButtonProps,
        getProgressBarProps,
    } = useSAPPropGetters(session)

    return (
        <div>
            <p>
                Headless adapter probe — raw <code>useSAPPropGetters</code>{" "}
                buttons over the same session (open the console to see the
                custom <code>onClick</code> fire before SAP toggles):
            </p>
            <button
                {...getPlayButtonProps({
                    onClick: () => console.log("Custom trigger"),
                })}
            >
                Toggle
            </button>{" "}
            <button {...getMuteButtonProps()}>Mute</button>{" "}
            <button {...getPreviousButtonProps()}>Prev</button>{" "}
            <button {...getNextButtonProps()}>Next</button>{" "}
            <button {...getSeekBackwardButtonProps()}>-10s</button>{" "}
            <button {...getSeekForwardButtonProps()}>+10s</button>
            <div {...getProgressBarProps()}>
                {formatTime(session.currentTime)} /{" "}
                {formatTime(session.duration)} —{" "}
                {session.currentTrack?.title ?? "(no track)"}
            </div>
        </div>
    )
}

/* Every skin below shares ONE AudioSessionProvider — and therefore one <audio>
   element and one queue. Pressing play / seeking / switching tracks in any skin
   updates all the others live. */
function GlobalSessionSection() {
    return (
        <section className="lab-section">
            <h2 className="lab-section__title">
                8. Global session — one source, many skins
                <small>Shared engine</small>
            </h2>
            <p className="lab-section__desc">
                All of the players below read from a single{" "}
                <code>AudioSessionProvider</code>. There is exactly one{" "}
                <code>&lt;audio&gt;</code> element and one queue, so playing,
                pausing, seeking, or switching tracks in any skin instantly
                syncs to every other skin. Click a Vault row or a SEA card to
                jump the whole session to that track.
            </p>
            <div className="lab-section__grid">
                <AudioSessionProvider initialQueue={playlist}>
                    <div className="lab-session">
                        <div className="lab-session__main">
                            <FullCardPlayer {...SEA_THEME} />
                            <div className="lab-session__sea">
                                {playlist.map((t, i) => (
                                    <SeaCardPlayer
                                        key={`${t.title}-${i}`}
                                        track={t}
                                        art={SEA_ARTS[i % SEA_ARTS.length]}
                                        tag={t.audioFile === BROKEN ? "broken" : "SEA"}
                                        {...SEA_THEME}
                                    />
                                ))}
                            </div>
                        </div>
                        <aside className="lab-session__side">
                            <h4 className="lab-app__sidebar-title">Now playing</h4>
                            <MiniSidebarPlayer {...SEA_THEME} />
                            <h4 className="lab-app__sidebar-title">The Vault</h4>
                            <div className="lab-session__vault">
                                {playlist.map((t, i) => (
                                    <VaultRowPlayer
                                        key={`${t.title}-${i}`}
                                        track={t}
                                        number={i + 1}
                                        {...SEA_THEME}
                                    />
                                ))}
                            </div>
                        </aside>
                    </div>
                    {/* fixed={false} so the bar previews inline instead of
                        covering the whole lab page. */}
                    <div className="lab-session__sticky">
                        <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                    </div>
                    <HeadlessAdapterProbe />
                </AudioSessionProvider>
            </div>
        </section>
    )
}

/* ----------------------------- Plugin architecture demo ----------------------------- */
function PluginArchitectureSection() {
    const [events, setEvents] = useState<string[]>([])
    const [activeLyric, setActiveLyric] = useState("Waiting for playback…")

    const keyboardPlugins = useMemo(
        () => [
            createKeyboardShortcutPlugin({
                name: "demo-keyboard-shortcuts",
                enablePlaylistKeys: false,
            }),
        ],
        []
    )

    const threePlugins = useMemo(
        () => [
            createKeyboardShortcutPlugin({
                name: "demo-triple-keyboard",
                enablePlaylistKeys: true,
            }),
            createAnalyticsPlugin({
                name: "demo-triple-analytics",
                includeTimeUpdates: false,
                send: (event) => {
                    setEvents((prev) =>
                        [
                            `${new Date(event.timestamp).toLocaleTimeString()} · ${event.type}`,
                            ...prev,
                        ].slice(0, 6)
                    )
                },
            }),
            createLyricsPlugin({
                name: "demo-triple-lyrics",
                lyrics: "[00:00.00]Plugin-ready player\n[00:06.00]Keyboard, analytics, and lyrics\n[00:12.00]Hooks stay isolated\n[00:18.00]Playback keeps running",
                onLineChange: (line) => {
                    setActiveLyric(line?.text ?? "Waiting for playback…")
                },
            }),
            createSleepTimerPlugin({ name: "demo-triple-sleep-timer" }),
        ],
        []
    )

    return (
        <section className="lab-section">
            <h2 className="lab-section__title">
                9. Plugin architecture
                <small>0 · 1 · 4 plugins</small>
            </h2>
            <p className="lab-section__desc">
                These players exercise the new lifecycle plugin system. One runs
                with no plugins, one registers keyboard shortcuts, and one stacks
                keyboard, analytics, lyric-sync, and sleep-timer plugins. Plugin failures are
                isolated by the manager so playback stays stable.
            </p>
            <div className="lab-section__grid">
                <div className="lab-states">
                    <div className="lab-state">
                        <h3 className="lab-state__title">0 plugins</h3>
                        <p className="lab-state__desc">
                            Baseline playback. No optional plugins are registered.
                        </p>
                        <div className="lab-state__player">
                            <AudioPlayer
                                title="Plugin Baseline"
                                artist="SEIHouse"
                                audioFile={SAMPLE}
                                accentColor="#ffffff"
                                progressColor="#ffffff"
                                backgroundColor="rgba(20,20,28,0.6)"
                            />
                        </div>
                    </div>
                    <div className="lab-state">
                        <h3 className="lab-state__title">1 plugin</h3>
                        <p className="lab-state__desc">
                            Focus the player and use Space/K plus arrow/J/L
                            seeking via <code>KeyboardShortcutPlugin</code>.
                        </p>
                        <div className="lab-state__player">
                            <AudioPlayer
                                title="Keyboard Plugin"
                                artist="SEIHouse"
                                audioFile={SAMPLE}
                                plugins={keyboardPlugins}
                                accentColor="#22D3A6"
                                progressColor="#22D3A6"
                                backgroundColor="rgba(16,28,22,0.6)"
                            />
                        </div>
                    </div>
                    <div className="lab-state">
                        <h3 className="lab-state__title">4 plugins</h3>
                        <p className="lab-state__desc">
                            Keyboard shortcuts, analytics callbacks, lyric
                            synchronization, and sleep timer UI run together.
                        </p>
                        <div className="lab-state__player">
                            <AudioPlayer
                                tracks={playlist}
                                showTracklist
                                repeatMode="all"
                                plugins={threePlugins}
                                accentColor="#7C5CFF"
                                progressColor="#7C5CFF"
                                backgroundColor="rgba(20,20,28,0.6)"
                            />
                        </div>
                        <div className="lab-state__note">
                            lyric: {activeLyric}
                        </div>
                        <div className="lab-state__note">
                            events: {events.length > 0 ? events.join(" · ") : "none yet"}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ----------------------------- Automix Pro demo ----------------------------- */
// Clean playlist (no broken track) so transitions actually fire back to back.
const proPlaylist: Track[] = playlist.filter((t) => t.audioFile !== BROKEN)

function AutomixProSection() {
    const [transitioning, setTransitioning] = useState(false)
    const [readout, setReadout] = useState("analyzing…")

    const proPlugins = useMemo(
        () => [
            createAutomixProPlugin({
                name: "demo-automix-pro",
                onTransitionChange: setTransitioning,
            }),
        ],
        []
    )

    // Poll the synchronous analysis cache so the metadata becomes visible as
    // soon as each track settles.
    useEffect(() => {
        const fmt = (n: number | undefined, digits = 2) =>
            n === undefined ? "–" : n.toFixed(digits)
        const tick = () => {
            const lines = proPlaylist.map((t) => {
                const a = getTrackAnalysis(t)
                if (!a) return `${t.title}: pending`
                return (
                    `${t.title}: bpm ${fmt(a.bpm, 1)} · conf ${fmt(a.confidence)} · ` +
                    `energy ${fmt(a.energy)} · beats ${a.beats?.length ?? 0} · ` +
                    `in ${a.transitionInMs ?? "–"}ms · out ${a.transitionOutMs ?? "–"}ms`
                )
            })
            setReadout(lines.join("\n"))
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <section className="lab-section">
            <h2 className="lab-section__title">
                11. Automix Pro
                <small>beat-near · energy-aware</small>
            </h2>
            <p className="lab-section__desc">
                <code>createAutomixProPlugin()</code> analyzes each track in a
                worker (essentia.js BPM/beat extraction, lazy-loaded WASM) and
                drives crossfade timing from the metadata: fades start on a
                beat, BPM-compatible high-energy pairs blend longer, tempo
                clashes fade short, and low-confidence pairs fall back to
                Automix Lite. Note the player&apos;s own Automix Lite switch
                stays off — the plugin owns the transitions here.
            </p>
            <div className="lab-section__grid">
                <div className="lab-states">
                    <div className="lab-state">
                        <h3 className="lab-state__title">
                            Pro transitions {transitioning ? "· crossfading…" : ""}
                        </h3>
                        <div className="lab-state__player">
                            <AudioPlayer
                                tracks={proPlaylist}
                                showTracklist
                                repeatMode="all"
                                plugins={proPlugins}
                                accentColor="#F4B860"
                                progressColor="#F4B860"
                                backgroundColor="rgba(28,22,14,0.6)"
                            />
                        </div>
                        <pre
                            className="lab-state__note"
                            style={{ whiteSpace: "pre-wrap", userSelect: "text" }}
                        >
                            {readout}
                        </pre>
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ----------------------------- Audio backend demo ----------------------------- */
/* Headless engine instance whose only job is to surface getBackendInfo() for
   the selected backend — including the auto-fallback fields when Web Audio is
   unavailable. */
function BackendInfoReadout({ backend }: { backend: AudioBackendKind }) {
    const engine = useAudioPlayer({ src: "", audioBackend: backend })
    return (
        <pre
            className="lab-state__note"
            style={{ whiteSpace: "pre-wrap", userSelect: "text" }}
        >
            {JSON.stringify(engine.getBackendInfo(), null, 2)}
        </pre>
    )
}

function AudioBackendSection() {
    const [backend, setBackend] = useState<AudioBackendKind>("html5")

    return (
        <section className="lab-section">
            <h2 className="lab-section__title">
                10. Audio backend
                <small>html5 · webaudio</small>
            </h2>
            <p className="lab-section__desc">
                The same player running on either playback backend. HTML5 Audio
                (default) streams progressively; the Web Audio backend downloads
                and decodes the full file for sample-accurate timing and
                reliable volume (including iOS Safari). The backend is fixed at
                mount, so switching remounts the player via <code>key</code>.
                The broken track exercises each backend&apos;s error path.
            </p>
            <div className="lab-section__grid">
                <div className="lab-states">
                    <div className="lab-state">
                        <h3 className="lab-state__title">
                            Backend: {backend}
                        </h3>
                        <div className="framer-panel__preset-row">
                            {(["html5", "webaudio"] as const).map((kind) => (
                                <button
                                    key={kind}
                                    type="button"
                                    className={`framer-panel__preset${backend === kind ? " framer-panel__preset--warn" : ""}`}
                                    onClick={() => setBackend(kind)}
                                    aria-pressed={backend === kind}
                                >
                                    {kind}
                                </button>
                            ))}
                        </div>
                        <div className="lab-state__player">
                            <AudioPlayer
                                key={backend}
                                audioBackend={backend}
                                tracks={playlist}
                                showTracklist
                                repeatMode="all"
                                accentColor="#0EA5E9"
                                progressColor="#0EA5E9"
                                backgroundColor="rgba(14,30,40,0.6)"
                            />
                        </div>
                        <div className="lab-state__note">
                            expect: identical UX on both backends · webaudio
                            shows full buffer after decode · broken track
                            reports a network error under webaudio
                        </div>
                        <BackendInfoReadout key={`info-${backend}`} backend={backend} />
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ----------------------------- Plugin registry section ----------------------------- */
function PluginRegistrySection() {
    const plugins = useActivePluginInstances()
    const [lyricLine, setLyricLine] = useState("")

    useEffect(() => {
        const el = document.getElementById("registry-lyrics-line")
        if (el) {
            const observer = new MutationObserver(() => setLyricLine(el.textContent ?? ""))
            observer.observe(el, { characterData: true, childList: true, subtree: true })
            setLyricLine(el.textContent ?? "")
            return () => observer.disconnect()
        }
    }, [])

    return (
        <section className="lab-section">
            <h2 className="lab-section__title">
                12. Plugin registry
                <small>browse · install · toggle</small>
            </h2>
            <p className="lab-section__desc">
                The <code>PluginRegistryProvider</code> wraps a registry of
                built-in SEIHouse plugins. Browse available plugins, install
                them, and toggle them active/inactive. Active plugins are
                passed into the <code>AudioPlayer</code> below — install the
                keyboard plugin to control playback with Space/J/K/L, or add
                analytics to see console.table output.
            </p>
            <div className="lab-section__grid">
                <div className="lab-plugin-registry-section">
                    <PluginManagerPanel />
                    <div className="lab-plugin-registry-player">
                        <h3 className="lab-plugin-registry-player__title">
                            AudioPlayer with active registry plugins
                            <span className="lab-plugin-manager__badge">
                                {plugins.length} active
                            </span>
                        </h3>
                        <AudioPlayer
                            tracks={playlist}
                            showTracklist
                            repeatMode="all"
                            plugins={plugins}
                            accentColor="#7C5CFF"
                            progressColor="#7C5CFF"
                            backgroundColor="rgba(20,20,28,0.6)"
                        />
                        <div
                            id="registry-lyrics-line"
                            className="lab-plugin-registry-player__lyric-line"
                        >
                            {lyricLine || "Install Lyrics Sync to see synced text here"}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

/* ----------------------------- Waveform demo ----------------------------- */
function WaveformSection() {
    const [backend, setBackend] = useState<AudioBackendKind>("html5")

    return (
        <section className="lab-section">
            <h2 className="lab-section__title">
                13. Waveform
                <small>wavesurfer.js scrubber</small>
            </h2>
            <p className="lab-section__desc">
                <code>showWaveform</code> swaps the progress bar for a
                wavesurfer.js waveform that doubles as the scrubber. The engine
                stays the only playback owner — wavesurfer just renders peaks
                and forwards clicks/drags. Under <code>webaudio</code> the
                peaks come from the already-decoded buffer (after the first
                play); under <code>html5</code> the file is fetched and decoded
                separately for analysis (requires CORS). While peaks load — or
                for the broken track — the plain progress bar renders in the
                same slot.
            </p>
            <div className="lab-section__grid">
                <div className="lab-states">
                    <div className="lab-state">
                        <h3 className="lab-state__title">
                            Backend: {backend}
                        </h3>
                        <div className="framer-panel__preset-row">
                            {(["html5", "webaudio"] as const).map((kind) => (
                                <button
                                    key={kind}
                                    type="button"
                                    className={`framer-panel__preset${backend === kind ? " framer-panel__preset--warn" : ""}`}
                                    onClick={() => setBackend(kind)}
                                    aria-pressed={backend === kind}
                                >
                                    {kind}
                                </button>
                            ))}
                        </div>
                        <div className="lab-state__player">
                            <AudioPlayer
                                key={backend}
                                audioBackend={backend}
                                showWaveform
                                tracks={playlist}
                                showTracklist
                                repeatMode="all"
                                accentColor="#F59E0B"
                                progressColor="#F59E0B"
                                trackColor="rgba(245,158,11,0.3)"
                                backgroundColor="rgba(40,30,14,0.6)"
                            />
                        </div>
                        <div className="lab-state__note">
                            expect: waveform appears once peaks are ready ·
                            click + drag scrub seek the engine (audio seeks on
                            release) · keyboard ←/→ on the waveform works ·
                            broken track stays a plain bar · webaudio decodes
                            on first load, so its waveform can appear after the
                            first play (immediately in dev, where StrictMode
                            pre-loads)
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}


/* ----------------------------- Demo mode shell ----------------------------- */
type DemoMode = "product" | "lab"

function ModeToggle({ mode, onModeChange }: { mode: DemoMode; onModeChange: (mode: DemoMode) => void }) {
    return (
        <nav className="demo-mode" aria-label="Demo view mode">
            <div>
                <p className="demo-mode__eyebrow">SEIHouse Audio Player</p>
                <strong className="demo-mode__title">Preview surface</strong>
            </div>
            <div className="demo-mode__actions" role="group" aria-label="Switch preview mode">
                <button
                    type="button"
                    className={`demo-mode__button${mode === "product" ? " demo-mode__button--active" : ""}`}
                    onClick={() => onModeChange("product")}
                    aria-pressed={mode === "product"}
                >
                    ProductPreview
                </button>
                <button
                    type="button"
                    className={`demo-mode__button${mode === "lab" ? " demo-mode__button--active" : ""}`}
                    onClick={() => onModeChange("lab")}
                    aria-pressed={mode === "lab"}
                >
                    Lab / QA
                </button>
            </div>
        </nav>
    )
}

function ProductPreview() {
    return (
        <main className="product-preview" aria-labelledby="product-preview-title">
            <section className="product-preview__hero">
                <div className="product-preview__copy">
                    <div className="product-preview__pill">Production target · Marketplace player</div>
                    <h1 id="product-preview-title" className="product-preview__title">
                        A focused audio storefront for one release.
                    </h1>
                    <p className="product-preview__lede">
                        This is the polished target layout customers should see first: one cohesive release page, one visual language, and one embedded SEIHouse player with playlist, lyrics, and purchase affordances ready to ship.
                    </p>
                    <div className="product-preview__metrics" aria-label="Release highlights">
                        <span><strong>3</strong> tracks</span>
                        <span><strong>Lossless</strong> preview</span>
                        <span><strong>Framer</strong> ready</span>
                    </div>
                </div>

                <div className="product-preview__stage">
                    <div className="product-preview__art" aria-hidden="true">
                        <div className="product-preview__orb product-preview__orb--one" />
                        <div className="product-preview__orb product-preview__orb--two" />
                        <div className="product-preview__vinyl" />
                    </div>
                    <div className="product-preview__player-card">
                        <div className="product-preview__release-meta">
                            <span>Featured release</span>
                            <strong>Signals From The House</strong>
                        </div>
                        <AudioPlayer
                            tracks={playlist.filter((track) => track.audioFile !== BROKEN)}
                            showTracklist
                            repeatMode="all"
                            accentColor="#22D3A6"
                            progressColor="#22D3A6"
                            trackColor="rgba(34,211,166,0.22)"
                            playIconColor="#07100d"
                            textColor="#FFFFFF"
                            backgroundColor="rgba(9, 12, 18, 0.68)"
                            backgroundImage={{ src: OG_BG }}
                            darkenAmount={58}
                            blurSize={24}
                        />
                    </div>
                </div>
            </section>

            <section className="product-preview__details" aria-label="Product details">
                <article>
                    <span>01</span>
                    <h2>Single destination</h2>
                    <p>One art direction, one release story, and one player treatment instead of competing demo patterns.</p>
                </article>
                <article>
                    <span>02</span>
                    <h2>Real component</h2>
                    <p>The hero uses the same production AudioPlayer and playlist data as the QA lab, so the preview stays honest.</p>
                </article>
                <article>
                    <span>03</span>
                    <h2>QA preserved</h2>
                    <p>Switch to Lab / QA for card grids, mobile, broken states, stress flows, backend checks, and plugin coverage.</p>
                </article>
            </section>
        </main>
    )
}

function DemoApp() {
    const [mode, setMode] = useState<DemoMode>("product")

    return (
        <>
            <ModeToggle mode={mode} onModeChange={setMode} />
            {mode === "product" ? <ProductPreview /> : <Lab />}
        </>
    )
}

/* ----------------------------- Lab page ----------------------------- */
function Lab() {
    return (
        <div className="lab-shell">
            <header className="lab-header">
                <div>
                    <h1 className="lab-header__title">Audio Player Lab / QA</h1>
                    <p className="lab-header__sub">
                        Manually exercise the portable SEIHouse audio player
                        across card grids, mobile previews, broken states,
                        stress tests, backend checks, and plugin coverage.
                        Every player on this page is a real AudioPlayer
                        component; only the surrounding chrome is fake.
                    </p>
                </div>
                <div className="lab-header__chip">Lab / QA environment</div>
            </header>

            <Checklist />

            {/* ============== 1. Live customizer (replaces the old hero image) ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    1. Live customizer
                    <small>OG Framer controls</small>
                </h2>
                <p className="lab-section__desc">
                    Tweak the audio player’s props in the Framer-style control
                    panel on the left. The player on the right updates live,
                    and you can copy the current config as a JSX snippet.
                </p>
                <div className="lab-section__grid">
                    <div className="lab-feed">
                        <LiveCustomizer />
                    </div>
                </div>
            </section>

            {/* ============== 2. Album / marketplace grid ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    2. Album / marketplace cards
                    <small>Grid</small>
                </h2>
                <p className="lab-section__desc">
                    Multiple compact players stacked in a card grid. Tests
                    overflow handling, price chips, and identical players
                    coexisting without z-index or focus leaks.
                </p>
                <div className="lab-section__grid">
                    <div className="lab-grid">
                        {[
                            { t: "Aurora", a: "SEIHouse", price: "$1.29", art: "linear-gradient(135deg,#FF7AC6,#7C5CFF)" },
                            { t: "Drift", a: "SEIHouse", price: "$0.99", art: "linear-gradient(135deg,#22D3A6,#0EA5E9)", mod: "b" },
                            { t: "Ember", a: "SEIHouse", price: "$1.49", art: "linear-gradient(135deg,#F59E0B,#EF4444)", mod: "c" },
                            { t: "Velvet", a: "SEIHouse", price: "Free", art: "linear-gradient(135deg,#A855F7,#EC4899)", mod: "d" },
                        ].map((c) => (
                            <article key={c.t} className="lab-card">
                                <div className={`ap-art lab-card__art${c.mod ? ` lab-card__art--${c.mod}` : ""}`} style={{ backgroundImage: c.art }} />
                                <div className="lab-card__body">
                                    <div className="lab-card__head">
                                        <div style={{ minWidth: 0 }}>
                                            <h4 className="lab-card__title">{c.t}</h4>
                                            <p className="lab-card__artist">{c.a}</p>
                                        </div>
                                        <span className="lab-card__price">{c.price}</span>
                                    </div>
                                    <div className="lab-card__player">
                                        <AudioPlayer title={c.t} artist={c.a} audioFile={SAMPLE} showVolume={false}
                                            accentColor="#ffffff" progressColor="#ffffff" backgroundColor="rgba(20,20,28,0.6)" />
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============== 3. Sidebar widget + main content ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    3. Sidebar widget inside a dashboard
                    <small>Layout stress</small>
                </h2>
                <p className="lab-section__desc">
                    A persistent mini-player in a left sidebar plus a list of
                    related tracks on the right.
                </p>
                <div className="lab-section__grid">
                    <div className="lab-app">
                        <aside className="lab-app__sidebar">
                            <h4 className="lab-app__sidebar-title">Now playing</h4>
                            <div className="lab-app__player">
                                <AudioPlayer title="Sidebar Player" artist="SEIHouse" audioFile={SAMPLE}
                                    accentColor="#22D3A6" progressColor="#22D3A6" backgroundColor="rgba(20,28,24,0.6)" showTracklist={false} />
                            </div>
                            <h4 className="lab-app__sidebar-title">Browse</h4>
                            <nav className="lab-app__nav">
                                <div className="lab-app__nav-item lab-app__nav-item--active">Home</div>
                                <div className="lab-app__nav-item">Discover</div>
                                <div className="lab-app__nav-item">Library</div>
                                <div className="lab-app__nav-item">Radio</div>
                            </nav>
                        </aside>
                        <div className="lab-app__main">
                            <h4 className="lab-app__sidebar-title">Up next in this session</h4>
                            {[
                                { t: "First Light", a: "SEIHouse", cta: "Playing", mod: "" },
                                { t: "Midnight Run", a: "SEIHouse", cta: "Play", mod: "b" },
                                { t: "Aurora", a: "SEIHouse", cta: "Play", mod: "c" },
                            ].map((r) => (
                                <div key={r.t} className="lab-app__row">
                                    <div className={`lab-app__row-thumb${r.mod ? ` lab-app__row-thumb--${r.mod}` : ""}`} />
                                    <div className="lab-app__row-meta">
                                        <div className="lab-app__row-title">{r.t}</div>
                                        <div className="lab-app__row-sub">{r.a}</div>
                                    </div>
                                    <div className="lab-app__row-cta">{r.cta}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== 4. Mobile / phone preview ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    4. Mobile preview
                    <small>Responsive</small>
                </h2>
                <p className="lab-section__desc">
                    The player is rendered inside a phone-shaped frame. Use
                    Chrome devtools device emulation on top of this for true
                    touch / safe-area behavior.
                </p>
                <div className="lab-section__grid">
                    <div className="lab-mobile-row">
                        <PhoneFrame topLeft="9:41" topRight="Now playing" art="linear-gradient(135deg,#7C5CFF,#22D3A6)">
                            <div className="lab-phone__player">
                                <AudioPlayer title="On The Go" artist="SEIHouse" audioFile={SAMPLE}
                                    accentColor="#ffffff" progressColor="#ffffff" backgroundColor="rgba(20,20,28,0.55)" />
                            </div>
                        </PhoneFrame>
                        <PhoneFrame topLeft="9:41" topRight="Playlist" art="linear-gradient(135deg,#F59E0B,#EF4444)">
                            <div className="lab-phone__player">
                                <AudioPlayer tracks={playlist} showTracklist shuffle repeatMode="all"
                                    accentColor="#ffffff" progressColor="#ffffff" backgroundColor="rgba(20,20,28,0.55)" />
                            </div>
                        </PhoneFrame>
                    </div>
                </div>
            </section>

            {/* ============== 5. State tests ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    5. State tests
                    <small>Error · missing · playlist</small>
                </h2>
                <p className="lab-section__desc">
                    Each panel isolates one state. Watch for the right banner
                    or disabled controls, then exercise the recovery path.
                </p>
                <div className="lab-section__grid">
                    <div className="lab-states">
                        <div className="lab-state">
                            <h3 className="lab-state__title lab-state__title--err">Broken audio URL</h3>
                            <p className="lab-state__desc">Confirms the error banner, the message, and that the <strong>Retry</strong> button surfaces a fresh load attempt.</p>
                            <div className="lab-state__player">
                                <AudioPlayer title="Network down" artist="SEIHouse" audioFile={BROKEN}
                                    accentColor="#ff5a55" progressColor="#ff5a55" backgroundColor="rgba(40,16,16,0.6)" />
                            </div>
                            <div className="lab-state__note">expect: red error banner + Retry · play disabled · progress empty</div>
                        </div>
                        <div className="lab-state">
                            <h3 className="lab-state__title lab-state__title--warn">Empty audio source</h3>
                            <p className="lab-state__desc">An empty string triggers the <strong>"Audio file missing"</strong> banner. All transport controls must be disabled.</p>
                            <div className="lab-state__player">
                                <AudioPlayer title="Placeholder" artist="SEIHouse" audioFile=""
                                    accentColor="#F59E0B" progressColor="#F59E0B" backgroundColor="rgba(30,25,16,0.6)" />
                            </div>
                            <div className="lab-state__note">expect: warning banner · no scrub · mute + skip disabled</div>
                        </div>
                        <div className="lab-state">
                            <h3 className="lab-state__title lab-state__title--ok">Playlist with mixed validity</h3>
                            <p className="lab-state__desc">Switch to the broken track to see the playlist keep state but show the error banner for that source only.</p>
                            <div className="lab-state__player">
                                <AudioPlayer tracks={playlist} showTracklist repeatMode="one"
                                    accentColor="#22D3A6" progressColor="#22D3A6" backgroundColor="rgba(16,28,22,0.6)" />
                            </div>
                            <div className="lab-state__note">expect: switching tracks resets time · broken track shows error · EQ on active row</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== 6. Rapid interaction panel ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    6. Rapid interaction
                    <small>Stress test</small>
                </h2>
                <p className="lab-section__desc">Spam every control. Verify the player never locks up, the scrubber never stutters, and state stays internally consistent.</p>
                <div className="lab-section__grid">
                    <div className="lab-rapid">
                        <div className="lab-rapid__player">
                            <AudioPlayer title="Spam me" artist="SEIHouse" audioFile={SAMPLE}
                                accentColor="#7C5CFF" progressColor="#7C5CFF" backgroundColor="rgba(20,20,28,0.6)"
                                showTracklist={false} lyrics="spam\nthe\nkeys" />
                        </div>
                        <div className="lab-rapid__steps">
                            <RapidStep n={1} title="Play / pause" body="Tap quickly 10+ times. Play icon should never desync with the audio element." />
                            <RapidStep n={2} title="Scrub" body="Drag the thumb across the full bar, then click both ends. Time updates only on pointer up." />
                            <RapidStep n={3} title="Skip +/-10s" body="Mash back10 / fwd10. Time stays within bounds; no NaN in the timer." />
                            <RapidStep n={4} title="Volume / mute" body="Slide volume to 0, click mute, click unmute, drag back up. Audio should restore to previous level." />
                            <RapidStep n={5} title="Keyboard" body="Focus the player and press Space, J, K, L, N, P. Shortcuts must not fire when a button has focus." />
                            <RapidStep n={6} title="Lyrics / share" body="Toggle lyrics; open the ... menu and click Share (clipboard path on desktop). The 'copied' badge should disappear after 2s." />
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== 7. Sticky inside scroll ============== */}
            <section className="lab-section">
                <h2 className="lab-section__title">
                    7. Sticky player inside a scrollable list
                    <small>Overflow</small>
                </h2>
                <p className="lab-section__desc">Confirms the player doesn't break out of its container and that its menu button still sits above sibling content when used inside an <code>overflow: auto</code> scroller.</p>
                <div className="lab-section__grid">
                    <div className="lab-sticky-wrap">
                        <div className="lab-sticky">
                            <AudioPlayer title="Sticky test" artist="SEIHouse" audioFile={SAMPLE}
                                accentColor="#ffffff" progressColor="#ffffff" backgroundColor="rgba(20,20,28,0.6)" />
                        </div>
                        <div className="lab-sticky__filler">
                            <h4>Long content #1</h4>
                            <p>Keep scrolling. The player should stay pinned to the top of the scroll container.</p>
                            <h4>Long content #2</h4>
                            <p>The menu button uses z-index 10 inside the player; outside it the lab styles should not leak over the player root.</p>
                            <h4>Long content #3</h4>
                            <p>Resize the window narrower than 480px. The track title font should shrink and the scrubber thumb should grow slightly.</p>
                            <h4>Long content #4</h4>
                            <p>Toggle system reduced-motion. The pulsing play button and equalizer bars should freeze.</p>
                            <h4>Long content #5</h4>
                            <p>End of scroll region.</p>
                        </div>
                    </div>
                </div>
            </section>

            <GlobalSessionSection />

            <footer className="lab-footer">
                <p>Tip: focus a player and use <kbd>Space</kbd> <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>N</kbd> <kbd>P</kbd> for playback shortcuts scoped to the player root.</p>
            </footer>

            <PluginArchitectureSection />

            <AudioBackendSection />

            <AutomixProSection />

            {/* ============== 12. Plugin registry ============== */}
            <PluginRegistryProvider>
                <PluginRegistrySection />
            </PluginRegistryProvider>

            <WaveformSection />
        </div>
    )
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <DemoApp />
    </StrictMode>
)
