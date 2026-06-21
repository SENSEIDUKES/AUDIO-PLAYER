import { AudioSpriteManifest } from '../core/audio/AudioSpriteEngine';
/** Narration playback phase the host (reader app) can drive or observe. */
export type NarrationState = "idle" | "playing" | "paused";
/** Coarse soundscape activity for the face's indicator dot. */
export type SoundscapeIndicatorState = "silent" | "ambient" | "narrating";
export interface UseNarrativeAudioOptions {
    /** Logical chapter id — used only for change detection / host wiring. */
    chapterId?: string;
    /** Current scene mood label (e.g. "rain", "battle"). Drives crossfades. */
    sceneMood?: string;
    /** Ambience clip name within `ambienceManifest` to loop for this scene. */
    ambientProfile?: string;
    /** Optional one-shot/loop FX or music clip name within the manifest. */
    fxClip?: string;
    /** Whether the FX clip loops. Defaults to false (one-shot). */
    fxLoop?: boolean;
    /** Packed ambience/FX clips. Without it, the hook is narration-only. */
    ambienceManifest?: AudioSpriteManifest;
    /** Narration phase hint. When omitted, derived from session playback. */
    narrationState?: NarrationState;
    /** 0..1 — scales ambience level and duck depth. Defaults to 1. */
    intensity?: number;
    /** Target ambience level, 0..1. Defaults to 0.6. */
    ambienceVolume?: number;
    /** Target narration level, 0..1. Defaults to the current session volume. */
    narrationVolume?: number;
    /** How far to duck ambience under narration, 0..1. Defaults to 0.6. */
    duckAmount?: number;
    /** Crossfade duration for mood/profile changes, ms. Defaults to 1200. */
    crossfadeMs?: number;
}
export interface NarrativeAudioController {
    /** Whether narration is currently playing. */
    isPlaying: boolean;
    /** Whether narration is muted. */
    isMuted: boolean;
    /** Whether a narration track is loaded and controllable. */
    hasNarration: boolean;
    /** Whether an ambience layer is active (manifest loaded + profile playing). */
    hasAmbience: boolean;
    /** Current scene mood label (echoed for the indicator). */
    mood: string | undefined;
    /** Coarse activity for the soundscape indicator. */
    indicatorState: SoundscapeIndicatorState;
    /** Current ambience level, 0..1. */
    ambienceVolume: number;
    /** Current narration level, 0..1. */
    narrationVolume: number;
    /** Toggle narration play/pause via the shared session. */
    togglePlay: () => void;
    /** Toggle narration mute via the shared session. */
    toggleMute: () => void;
    /** Set the ambience layer level (drives the sprite master gain). */
    setAmbienceVolume: (value: number) => void;
    /** Set the narration level (drives the session volume). */
    setNarrationVolume: (value: number) => void;
}
/**
 * Headless orchestrator for the Narrative face. It layers three audio sources
 * over existing SAP primitives without changing engine behavior:
 *
 * - **Narration / voice** → the shared global session (`useAudioSession`). The
 *   current session track is the narration; play/pause/mute/volume all route to
 *   it, so any other SAP face stays in sync.
 * - **Ambience loop + FX** → a private `AudioSpriteEngine`. The `ambientProfile`
 *   names a looping clip in `ambienceManifest`; `fxClip` is an optional extra
 *   layer.
 *
 * Behaviors it wires for story playback:
 * - **Ducking** — while narration plays, ambience fades to
 *   `ambienceVolume * (1 - duckAmount)` (scaled by `intensity`), and restores on
 *   pause.
 * - **Crossfade** — when `sceneMood`/`ambientProfile` changes, the old ambience
 *   instance fades out (and stops) while the new clip fades in.
 *
 * With no `ambienceManifest`, ambience is inert and the face is a narration-only
 * transport. The reader app feeds scene metadata in via the options; the UI does
 * not need to change.
 */
export declare function useNarrativeAudio(options?: UseNarrativeAudioOptions): NarrativeAudioController;
//# sourceMappingURL=useNarrativeAudio.d.ts.map