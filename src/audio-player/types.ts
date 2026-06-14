import type { CSSProperties, ReactNode } from "react"
import type { AudioPlayerPlugin } from "./core/plugins/PluginInterface"
import type { AudioBackendInfo, AudioBackendKind } from "./core/audio/AudioBackend"

/** A single playable track. */
export interface Track {
    /**
     * Stable unique identifier. When provided, the engine uses it (instead of
     * title + audioFile) to distinguish between tracks that share the same URL.
     * Strongly recommended once you have a real library of tracks.
     */
    id?: string
    title: string
    artist: string
    audioFile: string
    purchaseUrl?: string
    lyrics?: string
    /**
     * Precomputed waveform peaks (per-channel arrays of 0–1 amplitudes).
     * When present, the waveform renders instantly with no decode/download.
     */
    peaks?: number[][]
    /** Duration in seconds matching `peaks`. Required for peaks-only rendering. */
    waveformDuration?: number
}

/** Theme colors. Applied to the player root as CSS custom properties. */
export interface AudioPlayerTheme {
    /** Buttons, thumb, accents. */
    accentColor?: string
    /** Icon color sitting on top of the accent-filled play button. */
    playIconColor?: string
    /** Primary text (title / time). */
    textColor?: string
    /** Filled portion of the progress bar. */
    progressColor?: string
    /** Unfilled portion of the progress bar. */
    trackColor?: string
    /** Player background tint (sits over the optional background image). */
    backgroundColor?: string
    /**
     * Ambient glow color around the player root. Defaults to transparent
     * (no glow); the Auto Theme plugin sets it from the artwork.
     */
    glowColor?: string
}

export interface BackgroundImage {
    src: string
    alt?: string
}

export interface AudioPlayerProps extends AudioPlayerTheme {
    /** Playlist. When non-empty, the player runs in playlist mode. */
    tracks?: Track[]

    /** Single-track fields (used when `tracks` is empty). */
    audioFile?: string
    title?: string
    artist?: string
    purchaseUrl?: string
    lyrics?: string

    /** Playback behavior. */
    autoPlay?: boolean
    /**
     * Legacy single-source loop toggle. Kept for backwards compatibility; when
     * `repeatMode` is omitted, `loop={true}` initializes repeat-one behavior.
     */
    loop?: boolean
    /** Initial playlist shuffle state. */
    shuffle?: boolean
    /** Initial repeat behavior. Defaults to `"one"` when `loop` is true. */
    repeatMode?: RepeatMode
    /** Initial Automix Lite (crossfade transitions) state. Playlist mode only. */
    automix?: boolean
    /** Optional lifecycle plugins. Empty by default. */
    plugins?: readonly AudioPlayerPlugin[]
    /**
     * Playback backend. `"html5"` (default) streams through an `<audio>`
     * element; `"webaudio"` decodes the full file for sample-accurate timing
     * and reliable volume. Falls back to html5 (with a console warning) when
     * Web Audio is unavailable. Fixed at mount — remount (e.g. via `key`) to
     * switch.
     */
    audioBackend?: AudioBackendKind

    /** Presentation. */
    backgroundImage?: BackgroundImage
    /** Backdrop/background-image blur in px. */
    blurSize?: number
    /** Darken overlay over the background image, 0–100. */
    darkenAmount?: number
    showTracklist?: boolean
    /**
     * Show the volume slider. Defaults to `true` on desktop and `false` on
     * mobile/touch devices (e.g. iOS Safari), where programmatic volume is
     * ignored and the mute button is the reliable control. Pass an explicit
     * boolean to override the per-device default.
     */
    showVolume?: boolean
    /**
     * Render a wavesurfer.js waveform as the scrubber instead of the plain
     * progress bar. Lazy-loads wavesurfer; falls back to the progress bar
     * while peaks are loading or unavailable. Default false.
     */
    showWaveform?: boolean
    /** Waveform canvas height in px. Default 48. */
    waveformHeight?: number

    /** Typography (inline style objects). */
    titleFont?: CSSProperties
    artistFont?: CSSProperties

    /** Passthrough style/class for the root element. */
    className?: string
    style?: CSSProperties
}

/** Options accepted by the `useAudioPlayer` engine hook. */
export interface UseAudioPlayerOptions {
    /** Current source URL. Changing it loads a new track. */
    src: string
    /**
     * Opaque key that identifies the logical track. When two consecutive tracks
     * share the same `src` URL (e.g. identical audio files in a playlist), the
     * engine would not detect the track change from `src` alone. Setting a
     * unique `sourceKey` — e.g. `"${index}:${track.id ?? track.title}"` — forces
     * the reset/load lifecycle even when the URL is unchanged.
     * Defaults to `src` when omitted.
     */
    sourceKey?: string
    autoPlay?: boolean
    loop?: boolean
    /** Fired when the current track reaches its end. */
    onEnded?: () => void
    /** Playback backend. Defaults to `"html5"`. Fixed at mount. */
    audioBackend?: AudioBackendKind
}

/**
 * Conservative silence trims computed for a track by the Automix Lite
 * analysis. Milliseconds measured from the natural start/end of the file.
 */
export interface TrackTrims {
    trimStartMs: number
    trimEndMs: number
}

/**
 * Per-track metadata computed by the Automix Pro analysis. All fields are
 * optional: a partial result (e.g. trims without rhythm) is still usable, and
 * `confidence` tells consumers how much to trust the rhythm fields.
 */
export interface TrackAnalysis {
    /** Estimated tempo in beats per minute. */
    bpm?: number
    /** Beat positions in milliseconds of track time (head + tail segments only). */
    beats?: number[]
    /** Reserved for bar-start positions. Unfilled in v1. */
    downbeats?: number[]
    /** Mean loudness of the trimmed region mapped to 0..1. */
    energy?: number
    /** Silence trims, same semantics as `TrackTrims`. */
    trimStartMs?: number
    trimEndMs?: number
    /** Beat-snapped position where an incoming deck should start playing. */
    transitionInMs?: number
    /** Beat-snapped position where an outgoing crossfade should start. */
    transitionOutMs?: number
    /** Rhythm reliability, 0..1. 0 means trims-only / rhythm unavailable. */
    confidence?: number
}

/** A single buffered range reported by the <audio> element. */
export interface BufferedRange {
    /** Inclusive start time in seconds. */
    start: number
    /** Exclusive end time in seconds. */
    end: number
}

/** Everything the UI needs from the engine hook. */
export interface AudioPlayerEngine {
    audioRef: React.RefObject<HTMLAudioElement>

    // State
    isPlaying: boolean
    currentTime: number
    duration: number
    /** Seconds buffered ahead (end of the furthest buffered range). */
    buffered: number
    /** All buffered ranges for advanced UIs (e.g. multi-segment progress). */
    bufferedRanges: BufferedRange[]
    volume: number
    isMuted: boolean
    isBuffering: boolean
    isSeeking: boolean
    hasError: boolean
    errorMessage: string
    hasAudio: boolean
    /**
     * True when the host environment reports that the browser will not honor
     * programmatic volume changes (e.g. iOS Safari). Consumers can use this to
     * display a fallback hint and rely on the mute control only.
     */
    volumeUnsupported: boolean
    /**
     * True when the most recent autoplay attempt was blocked by the browser.
     * The UI can show a "tap to play" affordance so users know why nothing
     * started and how to recover.
     */
    autoplayBlocked: boolean

    // Actions
    play: (reportError?: boolean) => void
    pause: () => void
    toggle: () => void
    seek: (time: number) => void
    seekBy: (delta: number) => void
    setSeeking: (active: boolean) => void
    setVolume: (value: number) => void
    toggleMute: () => void
    retry: () => void
    /** Imperatively reload + play (used by playlist track changes). */
    loadAndPlay: () => void
    /** Acknowledge the autoplay-blocked flag after presenting a UI affordance. */
    dismissAutoplayBlocked: () => void

    // Preload / cache-warm a specific track without switching playback to it.
    preload: (track: Track) => void
    // Explicitly clear the active source, stop playback, and release refs.
    unload: () => void
    // Smoothly ramp volume to a target level over a duration (ms).
    fade: (to: number, durationMs: number) => void
    /** Which playback backend is running, whether it fell back, and what it can do. */
    getBackendInfo: () => AudioBackendInfo
    /**
     * Decoded PCM for the active source when the backend has it (webaudio
     * after load; null on html5). Used for waveform rendering.
     */
    getDecodedData: () => AudioBuffer | null
}

/** How the global session behaves when a track ends. */
export type RepeatMode = "off" | "all" | "one"

/**
 * The global audio session. A superset of `AudioPlayerEngine`: anything that
 * accepts an `AudioPlayerEngine` (e.g. the presentational `ProgressBar` /
 * `VolumeControl` wiring) also accepts a `SessionEngine`. On top of the engine
 * it adds a queue and queue navigation so many UI skins can share one
 * `<audio>` element and stay in sync.
 */
export interface SessionEngine extends AudioPlayerEngine {
    /** The current playback queue. */
    queue: Track[]
    /** Index of the active track in `queue`, or -1 when the queue is empty. */
    currentIndex: number
    /** The active track, or null when the queue is empty. */
    currentTrack: Track | null
    /** Whether playback order is shuffled. */
    shuffle: boolean
    /** Repeat behavior at the end of a track. */
    repeatMode: RepeatMode
    /** Whether Automix Lite (two-deck crossfade transitions) is enabled. */
    automix: boolean
    /** True when there is a track to advance to. */
    canNext: boolean
    /** True when there is a track to go back to. */
    canPrevious: boolean

    /** Replace the queue. Optionally start at `startIndex` and begin playing. */
    setQueue: (tracks: Track[], startIndex?: number, autoPlay?: boolean) => void
    /** Jump to and play a queued track by index. */
    playTrack: (index: number) => void
    /** Append a track to the end of the queue (no playback change). */
    enqueue: (track: Track) => void
    /** Play a track immediately: jump to it if already queued, else append + play. */
    playNow: (track: Track) => void
    /** Advance to the next track (honors shuffle / repeat). */
    next: () => void
    /** Go to the previous track (restarts the current track if past 3s). */
    previous: () => void
    /** Empty the queue and stop playback. */
    clearQueue: () => void
    /** Move an item within the queue (drag-and-drop reorder). */
    moveQueueItem: (fromIndex: number, toIndex: number) => void
    /** Remove a track from the queue by index. No-op for the active track. */
    removeFromQueue: (index: number) => void
    /** Toggle shuffled playback order. */
    toggleShuffle: () => void
    /** Cycle repeat mode: off → all → one → off. */
    cycleRepeat: () => void
    /** Toggle Automix Lite crossfade transitions. */
    toggleAutomix: () => void
}

/** Props for `AudioSessionProvider`. */
export interface AudioSessionProviderProps {
    children: ReactNode
    /** Tracks the session starts with. */
    initialQueue?: Track[]
    /** Index within `initialQueue` to start on. Defaults to 0. */
    initialIndex?: number
    /** Best-effort autoplay of the first track on mount. */
    autoPlay?: boolean
    /** Initial repeat mode. Defaults to "off". */
    repeatMode?: RepeatMode
    /** Initial shuffle state. Defaults to false. */
    shuffle?: boolean
    /** Initial Automix Lite state. Defaults to false. */
    automix?: boolean
    /** Optional lifecycle plugins for the shared session. Empty by default. */
    plugins?: readonly AudioPlayerPlugin[]
    /** Playback backend for the shared session. Defaults to `"html5"`. */
    audioBackend?: AudioBackendKind
}