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
    MediaSource,
    PlayerFace,
    RepeatMode,
    Track,
} from "../audio-player"
import { getPropertyDefaults } from "../audio-player"
import { NO_LUCK_COVER, NO_LUCK_ART } from "./data"

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
    theme: Required<Omit<AudioPlayerTheme, "glowColor">>
    backgroundImageSrc: string
    /** Unified background media (image/video). Supersedes backgroundImageSrc. */
    backgroundMedia: MediaSource | null
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
    /** Unified artwork media (image/video). Supersedes `art`. */
    artMedia: MediaSource | null
}

export interface WorkshopFaceDefinition {
    id: WorkshopFaceId
    label: string
    description: string
    /** The library `PlayerFace` this workshop face maps to — used to look up the
        shared property registry that drives the panel. */
    playerFace: PlayerFace
    /** Session faces render inside an AudioSessionProvider in the preview
        shell, which also receives the active plugins. */
    sessionBased: boolean
    /** @deprecated Superseded by the shared property registry (per-property
        `faces`). Retained so older code/presets keep type-checking. */
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
    // Seed editor defaults from the shared registry so they always track the
    // library. Demo-specific media (the No Luck cover/art) layer on top.
    const d = getPropertyDefaults() as {
        theme: WorkshopSettings["theme"]
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
    }
    return {
        theme: { ...d.theme },
        backgroundImageSrc: NO_LUCK_COVER,
        backgroundMedia: null,
        blurSize: d.blurSize,
        darkenAmount: d.darkenAmount,
        titleFont: { ...d.titleFont },
        artistFont: { ...d.artistFont },
        autoPlay: d.autoPlay,
        shuffle: d.shuffle,
        repeatMode: d.repeatMode,
        showTracklist: d.showTracklist,
        showVolume: d.showVolume,
        showWaveform: d.showWaveform,
        art: NO_LUCK_ART,
        artMedia: null,
    }
}

export const WORKSHOP_FACES: readonly WorkshopFaceDefinition[] = [
    {
        id: "audio-player",
        label: "Main AudioPlayer",
        description:
            "The full release player — playlist, lyrics, background art, waveform, and every theme prop.",
        playerFace: "portable",
        sessionBased: false,
        controls: ["theme", "background", "typography", "behavior", "display"],
        render: ({ settings, tracks, plugins }) => (
            <AudioPlayer
                tracks={tracks}
                plugins={plugins}
                {...settings.theme}
                backgroundImage={{ src: settings.backgroundImageSrc }}
                backgroundMedia={settings.backgroundMedia}
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
            "Rich now-playing card with core transport, progress, volume, and the SAP controller behind “…”.",
        playerFace: "fullCard",
        sessionBased: true,
        controls: ["theme", "display"],
        render: ({ settings }) => (
            <FullCardPlayer
                showVolume={settings.showVolume}
                backgroundMedia={settings.backgroundMedia}
                blurSize={settings.blurSize}
                darkenAmount={settings.darkenAmount}
                artMedia={settings.artMedia}
                titleFont={settings.titleFont}
                artistFont={settings.artistFont}
                {...settings.theme}
            />
        ),
    },
    {
        id: "sticky-bottom",
        label: "StickyBottomPlayer",
        description:
            "Persistent playback bar. Pinned to the viewport in production; previewed inline here.",
        playerFace: "stickyBottom",
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
        playerFace: "miniSidebar",
        sessionBased: true,
        controls: ["theme", "art"],
        render: ({ settings }) => (
            <MiniSidebarPlayer
                art={settings.art}
                artMedia={settings.artMedia}
                {...settings.theme}
            />
        ),
    },
    {
        id: "vault-row",
        label: "VaultRowPlayer",
        description:
            "Slim Vault list rows — pressing play in any row drives the shared session.",
        playerFace: "vaultRow",
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
        playerFace: "seaCard",
        sessionBased: true,
        controls: ["theme", "art"],
        render: ({ settings, tracks }) => (
            <div className="workshop__sea">
                {tracks.slice(0, 4).map((t) => (
                    <SeaCardPlayer
                        key={t.id ?? t.title}
                        track={t}
                        art={settings.art}
                        artMedia={settings.artMedia}
                        tag="SEA"
                        titleFont={settings.titleFont}
                        artistFont={settings.artistFont}
                        {...settings.theme}
                    />
                ))}
            </div>
        ),
    },
]
