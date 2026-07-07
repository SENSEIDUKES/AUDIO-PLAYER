import { AudioPlayerEngine, Track } from '../types';
/**
 * Automix Lite: opt-in two-deck crossfade transitions between queued tracks.
 *
 * The hook deliberately does NOT touch the engine's internals. The engine's
 * single <audio> element ("deck A") stays the source of truth; this hook owns
 * one detached, never-rendered second element ("deck B") that only exists
 * around a transition. The lifecycle is:
 *
 *   idle ──(near end of A)──▶ preloading: deck B loads the next track and is
 *        parked at its silence-trimmed start; silence analysis runs.
 *   preloading ──(fade window)──▶ fading: deck B plays while an equal-power
 *        ramp swaps the audible balance from A to B over AUTOMIX_FADE_MS.
 *   fading ──(ramp done / A ended)──▶ handoff: the host advances its queue
 *        exactly like a normal end-of-track advance, the engine reloads the
 *        main element with B's URL (HTTP-cached — deck B just fetched it),
 *        the hook time-syncs the main element to deck B and, on its first
 *        'playing', flips the audio back to the main element and releases the
 *        deck. From here on, playback is indistinguishable from normal mode.
 *
 * Anything unexpected — pause, seek away, manual next/previous, queue edits,
 * deck errors, blocked play(), unsupported programmatic volume (iOS Safari) —
 * cancels the transition, restores the engine volume, and falls back to the
 * existing end-of-track behavior. With `enabled` false the hook is inert.
 */
/** Crossfade duration. Conservative fixed value for V1. */
export declare const AUTOMIX_FADE_MS = 5500;
export interface UseAutomixOptions {
    engine: AudioPlayerEngine;
    /** Master switch. When false the hook does nothing at all. */
    enabled: boolean;
    /** The host's source identity key (its `sourceKey`). */
    sourceKey: string;
    currentTrack: Track | null;
    /**
     * The track that would play after the current one, already resolved by the
     * host through its own shuffle/repeat order. Pass `null` when there is no
     * automixable next track (single-track mode, repeat-one, end of queue, or
     * the next index equals the current one).
     */
    nextTrack: Track | null;
    /** Internal callers can suppress the compatibility warning. */
    suppressDeprecatedWarning?: boolean;
    /**
     * Advance the queue to the next track using the host's normal end-of-track
     * path (deferred play + index change). Must NOT route back through the
     * host's `onEnded` guard, or the advance would suppress itself.
     */
    requestAdvance: () => void;
}
export interface AutomixController {
    /** True while a crossfade or handoff is in progress. */
    isTransitioning: boolean;
    /**
     * Must be called first inside the host's end-of-track advance handler.
     * Returns true when automix already advanced (or is advancing) the queue,
     * in which case the host must skip its own advance.
     */
    handleTrackEnded: () => boolean;
}
export declare function useAutomix(options: UseAutomixOptions): AutomixController;
//# sourceMappingURL=useAutomix.d.ts.map