import { useMemo, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
    AudioPlayer,
    FullCardPlayer,
    VaultRowPlayer,
    StickyBottomPlayer,
    MiniSidebarPlayer,
    SeaCardPlayer,
    NarrativeFace,
    SAPController,
    buildVaultTrackArcActions,
    useAudioSession,
} from "../audio-player"
import type {
    ArcCommandHost,
    AudioPlayerPlugin,
    AudioPlayerTheme,
    MediaSource,
    PlayerFace,
    RepeatMode,
    Track,
    VaultCategory,
    WorkspaceRoute,
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
    | "narrative"

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

/* Rotating categories so the Vault preview shows the classification color
   system across several types at once. */
const WORKSHOP_VAULT_CATEGORIES: VaultCategory[] = [
    "demo",
    "beat",
    "mix",
    "master",
    "toFinish",
    "arcNote",
]

/* Real share commands for a Vault row's arc: Email opens a prefilled mail
   draft, URL copies the track link. */
function workshopShareCommands(track: Track): ArcCommandHost["commands"] {
    const url = track.audioFile ?? ""
    return {
        "share.email": () => {
            window.location.href = `mailto:?subject=${encodeURIComponent(
                `${track.title} — ${track.artist ?? ""}`
            )}&body=${encodeURIComponent(url)}`
        },
        "share.url": () => {
            void navigator.clipboard?.writeText(url)
        },
    }
}

/* The workshop's Vault preview: rows carry the standardized command wheel with
   the Vault face's dedicated Vault arm (Vault / Playback / Share / Agents) and
   route workspace leaves into one shared SAP Controller instance owned here. */
function WorkshopVaultRows({
    tracks,
    theme,
}: {
    tracks: Track[]
    theme: AudioPlayerTheme
}) {
    const s = useAudioSession()
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    // No Studio Scout entitlement in the workshop — Agents › Scout routes to
    // its free Demo tier.
    const arcActions = useMemo(
        () => buildVaultTrackArcActions({ entitlements: { studioScout: false } }),
        []
    )
    return (
        <div className="workshop__vault">
            {tracks.map((t, i) => {
                // Tag rows with rotating categories so the classification
                // color system is visible in the workshop preview.
                const tagged: Track = {
                    ...t,
                    vaultCategory:
                        WORKSHOP_VAULT_CATEGORIES[i % WORKSHOP_VAULT_CATEGORIES.length],
                }
                return (
                    <VaultRowPlayer
                        key={tagged.id ?? tagged.title}
                        track={tagged}
                        number={i + 1}
                        actions={arcActions}
                        commands={workshopShareCommands(tagged)}
                        onOpenWorkspace={setRoute}
                        {...theme}
                    />
                )
            })}
            <SAPController
                open={route !== null}
                route={route ?? "options"}
                onClose={() => setRoute(null)}
                // Live session playback state so the arc's Playback › Controls
                // section shows real switches, not the empty placeholder.
                playback={{
                    shuffle: s.shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode: s.repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix: s.automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                {...theme}
            />
        </div>
    )
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
            "Slim Vault list rows — classification color fills the whole row and the Arc button is the action surface.",
        playerFace: "vaultRow",
        sessionBased: true,
        controls: ["theme"],
        render: ({ settings, tracks }) => (
            <WorkshopVaultRows tracks={tracks} theme={settings.theme} />
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
    {
        id: "narrative",
        label: "NarrativeFace",
        description:
            "Faceless story/reader surface — soundscape indicator, play/pause, mute, and ambience + voice levels. No artwork or music chrome; embeds as a tiny inline overlay. Drives narration on the shared session.",
        playerFace: "narrative",
        sessionBased: true,
        controls: ["theme"],
        render: ({ settings }) => (
            <NarrativeFace
                chapterId="ch-01"
                sceneMood="rain"
                ambientProfile="rain-loop"
                intensity={0.6}
                showExpand
                onExpand={() => console.log("open soundscape settings")}
                {...settings.theme}
            />
        ),
    },
]
