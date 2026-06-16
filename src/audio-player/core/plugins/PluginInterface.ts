import type { AudioPlayerEngine, RepeatMode, Track } from "../../types"

/** Playback/control surface exposed to plugins without coupling them to React. */
export interface PluginPlayerContext {
    /** Latest headless engine/session state. Read lazily because it changes often. */
    getEngine: () => AudioPlayerEngine
    /** Root element for scoped DOM behavior. Null for headless/global sessions. */
    getRootElement: () => HTMLElement | null
    /** Current rendered/managed audio element. */
    getAudioElement: () => HTMLAudioElement | null
    /** Active track, or null when no track is loaded. */
    getCurrentTrack: () => Track | null
    /** Resolved next track according to the host queue/repeat/shuffle rules. */
    getNextTrack: () => Track | null
    /** Opaque source identity key used by the engine load lifecycle. */
    getSourceKey: () => string
    /** Advance through the host's normal queue path. Used by transition plugins. */
    requestAdvance?: () => void
    /** Optional queue navigation helpers for shortcut/control plugins. */
    next?: () => void
    previous?: () => void
    /** Optional playlist/session metadata for analytics and advanced plugins. */
    getQueue?: () => Track[]
    getCurrentIndex?: () => number
    getRepeatMode?: () => RepeatMode
    getShuffle?: () => boolean
}

export type PluginHookName =
    | "onTrackLoad"
    | "onPlay"
    | "onPause"
    | "onStop"
    | "onSeek"
    | "onTimeUpdate"
    | "onTrackEnded"

export type PluginHookArgs = {
    onTrackLoad: [track: Track | null]
    onPlay: []
    onPause: []
    onStop: []
    onSeek: [position: number]
    onTimeUpdate: [position: number]
    onTrackEnded: [track: Track | null]
}

export type PluginHookResult = boolean | void

/**
 * Standard SEIHouse audio plugin interface.
 *
 * `init` and `destroy` are required. Lifecycle hooks are optional and isolated:
 * a throwing plugin is logged and skipped without crashing playback.
 */
export interface AudioPlayerPlugin {
    /** Unique registration name. Registering another plugin with this name replaces it. */
    name: string
    /** True when the plugin owns keyboard shortcut handling for this player. */
    handlesKeyboardShortcuts?: boolean
    /**
     * True for the Waveform plugin: tells a standalone player to render the
     * wavesurfer waveform scrubber instead of the plain progress bar (subject to
     * the player's "Show Waveform" toggle). Pure marker — no playback behavior.
     */
    providesWaveform?: boolean
    init: (playerInstance: PluginPlayerContext) => void | (() => void)
    destroy: () => void
    onTrackLoad?: (track: Track | null) => PluginHookResult
    onPlay?: () => PluginHookResult
    onPause?: () => PluginHookResult
    onStop?: () => PluginHookResult
    onSeek?: (position: number) => PluginHookResult
    onTimeUpdate?: (position: number) => PluginHookResult
    /** Return true to claim/suppress the host's normal end-of-track advance. */
    onTrackEnded?: (track: Track | null) => PluginHookResult
}
