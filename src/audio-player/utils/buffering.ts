/**
 * Pure decision helper for the buffering ("loading") spinner.
 *
 * The media element fires `waiting`/`stalled` during passive preload too — even
 * while paused or idle at 0:00 — which previously stranded the play button on a
 * spinner. This encodes the rule that buffering only represents *active* (or
 * pending) playback waiting, so the logic stays unit-testable without a DOM.
 *
 * Because the engine applies this gate (and clears buffering on
 * pause/ended/error/source-reset), the resulting `isBuffering` flag is an
 * accurate source of truth: the UI can render the spinner directly from it
 * without re-gating on `isPlaying` (which would hide the spinner during the
 * initial pending-play load, e.g. the Web Audio backend emits `waiting` before
 * `play`).
 */

export interface BufferingIntent {
    /** The engine currently considers itself playing. */
    isPlaying: boolean
    /** The backend media element reports a paused state. */
    isPaused: boolean
    /** A `play()` attempt is in flight (promise not yet settled). */
    hasPendingPlay: boolean
}

/**
 * Whether a `waiting`/`stalled` event should be treated as real buffering.
 *
 * True only when playback is actually active or a play attempt is pending;
 * passive preload while paused must not show a spinner.
 */
export function shouldEnterBuffering({
    isPlaying,
    isPaused,
    hasPendingPlay,
}: BufferingIntent): boolean {
    return isPlaying || hasPendingPlay || !isPaused
}
