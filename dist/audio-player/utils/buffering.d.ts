/**
 * Pure decision helpers for the buffering ("loading") spinner.
 *
 * The media element fires `waiting`/`stalled` during passive preload too — even
 * while paused or idle at 0:00 — which previously stranded the play button on a
 * spinner. This encodes the rule that buffering only represents *active* (or
 * pending) playback waiting, so the logic stays unit-testable without a DOM.
 *
 * Even when playback IS active, `waiting`/`stalled` fire routinely on brief
 * network blips and between auto-advanced tracks. Showing the spinner for those
 * sub-second hiccups makes a healthy player look broken, so the engine debounces
 * the spinner: a `waiting` only flips `isBuffering` true once the stall has
 * persisted past {@link BUFFERING_SPINNER_DELAY_MS}, and any resolution
 * (`playing`/`canplay`/pause/ended/error/source-reset) cancels the pending flip.
 *
 * Because the engine applies this gate (and clears buffering on
 * pause/ended/error/source-reset), the resulting `isBuffering` flag is an
 * accurate source of truth: the UI can render the spinner directly from it
 * without re-gating on `isPlaying` (which would hide the spinner during the
 * initial pending-play load, e.g. the Web Audio backend emits `waiting` before
 * `play`).
 */
/**
 * How long a `waiting`/`stalled` stall must persist before the spinner shows.
 * Tuned so routine mid-playback blips and track-to-track handoffs never flash a
 * spinner, while a genuine stall still surfaces one promptly.
 */
export declare const BUFFERING_SPINNER_DELAY_MS = 300;
export interface BufferingIntent {
    /** The engine currently considers itself playing. */
    isPlaying: boolean;
    /** The backend media element reports a paused state. */
    isPaused: boolean;
    /** A `play()` attempt is in flight (promise not yet settled). */
    hasPendingPlay: boolean;
}
/**
 * Whether a `waiting`/`stalled` event should be treated as real buffering.
 *
 * True only when playback is actually active or a play attempt is pending;
 * passive preload while paused must not show a spinner.
 */
export declare function shouldEnterBuffering({ isPlaying, isPaused, hasPendingPlay, }: BufferingIntent): boolean;
/** A pending, cancelable flip of the buffering spinner to "on". */
export interface BufferingDebounce {
    /**
     * Arm the spinner flip if it is not already armed. Deliberately a no-op when
     * a flip is already pending, so the delay measures from the *first* stall in
     * a run of `waiting`/`stalled` events, not the last.
     */
    schedule(show: () => void): void;
    /**
     * Cancel a pending flip. Call alongside every buffering reset
     * (`playing`/`canplay`/pause/ended/error/source-reset) so a stale timer can
     * never strand the spinner after playback resumes.
     */
    cancel(): void;
}
/**
 * Build a debouncer for the buffering spinner. Kept pure (injectable timers) so
 * the schedule/cancel/don't-restart contract is unit-testable without a DOM,
 * while the engine wires it to the real media events.
 */
export declare function createBufferingDebounce(delayMs?: number, scheduler?: {
    setTimer: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
}): BufferingDebounce;
//# sourceMappingURL=buffering.d.ts.map