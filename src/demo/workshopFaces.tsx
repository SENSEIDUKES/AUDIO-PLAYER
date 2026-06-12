import type { CSSProperties, ReactNode } from "react"
import {
    AudioPlayer,
    FullCardPlayer,
    VaultRowPlayer,
    StickyBottomPlayer,
    MiniSidebarPlayer,
    SeaCardPlayer,
} from "../audio-player"
import type {
    AudioPlayerPlugin,
    AudioPlayerTheme,
    RepeatMode,
    Track,
} from "../audio-player"
import { OG_DEFAULTS, NO_LUCK_COVER, NO_LUCK_ART, SEA_THEME } from "./data"

export type WorkshopFaceId =
    | "audio-player"
    | "full-card"
    | "sticky-bottom"
    | "mini-sidebar"
    | "vault-row"
    | "sea-card"

/** Control groups the panel can render; a face opts into the ones that apply. */
export type WorkshopControlGroup =
    | "theme"       // the 6 AudioPlayerTheme colors (every face)
    | "background"  // backgroundImage src / blurSize / darkenAmount
    | "typography"  // titleFont / artistFont
    | "behavior"    // autoPlay / shuffle / repeatMode
    | "display"     // showTracklist / showVolume / showWaveform
    | "art"         // cover art / gradient for skins with an `art` prop

/* Flat, JSON-serializable settings superset shared by every face. Each face
   reads only the slices it supports, so switching faces keeps your edits. */
export interface WorkshopSettings {
    theme: Required<AudioPlayerTheme>
    backgroundImageSrc: string
    blurSize: number
    darkenAmount: number
    titleFont: CSSProperties
    artistFont: CSSProperties
    autoPlay: boolean
    shuffle: boolean
    repeatMode: RepeatMode
    showTracklist: boolean
    showVolume: boolean
    showWaveform: boolean
    /** CSS background-image value (url(...) or gradient) for skin art props. */
    art: string
}

export interface WorkshopFaceDefinition {
    id: WorkshopFaceId
    label: string
    description: string
    /** Session faces render inside an AudioSessionProvider in the preview
        shell, which also receives the active plugins. */
    sessionBased: boolean
    /** Which control-panel groups apply to this face. */
    controls: readonly WorkshopControlGroup[]
    /** Render the live preview. `plugins` is only consumed by the standalone
        AudioPlayer face — session faces get plugins via the provider. */
    render: (ctx: {
        settings: WorkshopSettings
        tracks: Track[]
        plugins: readonly AudioPlayerPlugin[]
    }) => ReactNode
}

export function defaultWorkshopSettings(): WorkshopSettings {
    return {
        theme: { ...SEA_THEME },
        backgroundImageSrc: NO_LUCK_COVER,
        blurSize: OG_DEFAULTS.blurSize ?? 20,
        darkenAmount: OG_DEFAULTS.darkenAmount ?? 45,
        titleFont: { ...(OG_DEFAULTS.titleFont as CSSProperties) },
        artistFont: { ...(OG_DEFAULTS.artistFont as CSSProperties) },
        autoPlay: false,
        shuffle: false,
        repeatMode: "off",
        showTracklist: true,
        showVolume: true,
        showWaveform: false,
        art: NO_LUCK_ART,
    }
}

export const WORKSHOP_FACES: readonly WorkshopFaceDefinition[] = [
    {
        id: "audio-player",
        label: "Main AudioPlayer",
        description:
            "The full release player — playlist, lyrics, background art, waveform, and every theme prop.",
        sessionBased: false,
        controls: ["theme", "background", "typography", "behavior", "display"],
        render: ({ settings, tracks, plugins }) => (
            <AudioPlayer
                tracks={tracks}
                plugins={plugins}
                {...settings.theme}
                backgroundImage={{ src: settings.backgroundImageSrc }}
                blurSize={settings.blurSize}
                darkenAmount={settings.darkenAmount}
                titleFont={settings.titleFont}
                artistFont={settings.artistFont}
                autoPlay={settings.autoPlay}
                shuffle={settings.shuffle}
                repeatMode={settings.repeatMode}
                showTracklist={settings.showTracklist}
                showVolume={settings.showVolume}
                showWaveform={settings.showWaveform}
            />
        ),
    },
    {
        id: "full-card",
        label: "FullCardPlayer",
        description:
            "Rich now-playing card with transport, progress, volume, and shuffle/repeat toggles.",
        sessionBased: true,
        controls: ["theme", "display"],
        render: ({ settings }) => (
            <FullCardPlayer showVolume={settings.showVolume} {...settings.theme} />
        ),
    },
    {
        id: "sticky-bottom",
        label: "StickyBottomPlayer",
        description:
            "Persistent playback bar. Pinned to the viewport in production; previewed inline here.",
        sessionBased: true,
        controls: ["theme", "display"],
        render: ({ settings }) => (
            <StickyBottomPlayer
                fixed={false}
                showVolume={settings.showVolume}
                {...settings.theme}
            />
        ),
    },
    {
        id: "mini-sidebar",
        label: "MiniSidebarPlayer",
        description: "Condensed sidebar widget: art block, track meta, play/next.",
        sessionBased: true,
        controls: ["theme", "art"],
        render: ({ settings }) => (
            <MiniSidebarPlayer art={settings.art} {...settings.theme} />
        ),
    },
    {
        id: "vault-row",
        label: "VaultRowPlayer",
        description:
            "Slim Vault list rows — pressing play in any row drives the shared session.",
        sessionBased: true,
        controls: ["theme"],
        render: ({ settings, tracks }) => (
            <div className="workshop__vault">
                {tracks.map((t, i) => (
                    <VaultRowPlayer
                        key={t.id ?? t.title}
                        track={t}
                        number={i + 1}
                        {...settings.theme}
                    />
                ))}
            </div>
        ),
    },
    {
        id: "sea-card",
        label: "SeaCardPlayer",
        description:
            "Embeddable SEA marketplace cards with overlaid play buttons.",
        sessionBased: true,
        controls: ["theme", "art"],
        render: ({ settings, tracks }) => (
            <div className="workshop__sea">
                {tracks.slice(0, 4).map((t) => (
                    <SeaCardPlayer
                        key={t.id ?? t.title}
                        track={t}
                        art={settings.art}
                        tag="SEA"
                        {...settings.theme}
                    />
                ))}
            </div>
        ),
    },
]
