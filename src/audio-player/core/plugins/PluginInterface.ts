import type { AudioPlayerEngine, RepeatMode, Track } from "../../types"
import type {
    AudioSpriteInstanceId,
    AudioSpriteManifest,
    AudioSpritePlayOptions,
} from "../audio/AudioSpriteEngine"

/** Restricted sound-effects surface for Vault Radio and plugin-layer sounds. */
export interface PluginSoundLayer {
    /** Load one sprite pack whose manifest maps names to offset/duration clips. */
    loadSpritePack: (manifest: AudioSpriteManifest, pack?: string) => Promise<void>
    /** Play a named clip and return its active instance id, or null when unavailable. */
    playSprite: (
        clipName: string,
        options?: AudioSpritePlayOptions & { pack?: string }
    ) => AudioSpriteInstanceId | null
    /** Stop one active sprite instance by id. */
    stopSprite: (id: AudioSpriteInstanceId) => void
    /** Fade one active sprite instance to a target volume over the given duration. */
    fadeSprite: (id: AudioSpriteInstanceId, toVolume: number, durationMs: number) => void
    /** Stop every instance owned by this facade or scope; other scopes are independent. */
    stopAllSprites: () => void
    /** Acquire an isolated named-pack lifetime. The caller must dispose it. */
    createScope?: () => PluginSoundScope
    /** Reason for the latest rejected play, when supplied by a policy-aware host. */
    getLastSkipReason?: () => string | undefined
}

/** One manifest's sounds; disposing it never stops another plugin's sounds. */
export interface PluginSoundScope extends PluginSoundLayer {
    dispose: () => void
}

/** Playback/control surface exposed to plugins without coupling them to React. */
export interface PluginPlayerContext {
    /** Latest headless engine/session state. Read lazily because it changes often. */
    getEngine: () => AudioPlayerEngine
    /** Root element for scoped DOM behavior. Null for headless/global sessions. */
    getRootElement: () => HTMLElement | null
    /**
     * Private event channel for this player/session. Cue plugins dispatch and listen here
     * instead of on `window`, so several players on one page cannot trigger each other.
     */
    getEventTarget?: () => EventTarget
    /**
     * Live playback position in seconds, read from the backend rather than the throttled
     * `getEngine().currentTime` state. Plugins that need accurate timing while the page is
     * hidden (when animation frames stop) should poll this.
     */
    getPlaybackPosition?: () => number
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
    /**
     * Restricted SAP-native audio sprite layer for Vault Radio and plugin-only
     * sounds. This is not a primary-track playback engine and intentionally
     * exposes no raw Web Audio internals.
     */
    sounds?: PluginSoundLayer
    /** Optional playlist/session metadata for analytics and advanced plugins. */
    getQueue?: () => Track[]
    getCurrentIndex?: () => number
    getRepeatMode?: () => RepeatMode
    getShuffle?: () => boolean
}

export type PluginHookName =
    "onTrackLoad" | "onPlay" | "onPause" | "onStop" | "onSeek" | "onTimeUpdate" | "onTrackEnded"

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
