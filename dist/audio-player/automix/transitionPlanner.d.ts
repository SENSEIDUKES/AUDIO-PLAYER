import { TrackAnalysis, TrackTrims } from '../types';
/** Below this normalized confidence a track's rhythm data is not trusted. */
export declare const PRO_CONFIDENCE_MIN = 0.55;
export interface TransitionPlan {
    /** Crossfade duration. */
    fadeMs: number;
    /** Position in the outgoing track where the ramp should start. */
    fadeStartMsInA: number;
    /** Position where the incoming deck should be parked before the fade. */
    deckStartMsInB: number;
    /** False when the pair fell back to Automix Lite constants. */
    usedPro: boolean;
}
/** Map RhythmExtractor2013's raw confidence (0–5.32) to 0..1. */
export declare function normalizeRhythmConfidence(raw: number): number;
/**
 * Score how mixable two tempos are, 0..1. Considers half- and double-time
 * relationships (85 vs 170 BPM scores 1). Score falls linearly from 1 at a
 * perfect match to 0 at `tolerancePct` relative error.
 */
export declare function bpmCompatibility(a?: number, b?: number, tolerancePct?: number): number;
/**
 * Return the beat nearest `targetMs`, or `targetMs` itself when no beat is
 * within `maxDriftMs`.
 */
export declare function snapToBeat(targetMs: number, beatsMs: readonly number[], maxDriftMs: number): number;
/**
 * Compute beat-snapped transition points for one track.
 *
 * `transitionOutMs` is where a crossfade of `fadeMs` should start so it ends
 * at the trimmed end: snapped to the nearest beat (within one beat interval),
 * but never later than `trimmedEnd − FADE_END_SAFETY_MS`. `transitionInMs` is
 * the first beat shortly after the trim start, where an incoming deck lands
 * on the grid instead of mid-beat.
 */
export declare function computeTransitionPoints(analysis: Pick<TrackAnalysis, "beats" | "bpm">, trims: TrackTrims, durationMs: number, fadeMs: number): {
    transitionInMs: number;
    transitionOutMs: number;
};
/**
 * Decide fade length and timing for an outgoing/incoming pair.
 *
 * Policy: when both tracks carry trusted rhythm data, BPM-compatible
 * high-energy pairs get a long beat-snapped blend (9–12s, scaled by energy),
 * compatible low-energy pairs keep the base fade, and BPM-incompatible pairs
 * get a short fade (2.5–3.5s) so the tempo clash stays brief. When either
 * side's confidence is below `confidenceMin` the plan reproduces Automix
 * Lite: base fade ending at the trimmed end, deck parked at the trim start.
 */
export declare function planTransition(outgoing: TrackAnalysis | null, incoming: TrackAnalysis | null, durationAMs: number, baseFadeMs: number, confidenceMin?: number): TransitionPlan;
//# sourceMappingURL=transitionPlanner.d.ts.map