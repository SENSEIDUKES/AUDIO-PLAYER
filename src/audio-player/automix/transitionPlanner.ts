import type { TrackAnalysis, TrackTrims } from "../types"

/**
 * Pure transition math for Automix Pro. No DOM, no Web Audio — everything
 * here is deterministic and unit-tested. The orchestrator uses
 * `computeTransitionPoints` to bake default transition points into a
 * `TrackAnalysis`; `AutomixPlugin` calls `planTransition` at preload time to
 * pick the actual fade length and timing for a specific track pair.
 */

/** RhythmExtractor2013 ("multifeature") reports confidence on a 0–5.32 scale. */
const RAW_CONFIDENCE_MAX = 5.32
/** Below this normalized confidence a track's rhythm data is not trusted. */
export const PRO_CONFIDENCE_MIN = 0.55
/** BPM compatibility at/above this allows an extended beat-aware blend. */
const COMPAT_BLEND_MIN = 0.5
/** Mean pair energy at/above this stretches the blend toward the maximum. */
const HIGH_ENERGY_MIN = 0.5
/** Hard bounds for any Pro fade. */
const FADE_MIN_MS = 2500
const FADE_MAX_MS = 12_000
/** Extended blend range used for BPM-compatible, high-energy pairs. */
const LONG_BLEND_MIN_MS = 9000
/** Never start a fade closer than this to the trimmed end of the track. */
const FADE_END_SAFETY_MS = 2000
/** How far past the trim start an incoming track may wait for its first beat. */
const ENTRY_BEAT_WINDOW_MS = 2000
/** Beat interval assumed when a track has beats but no usable BPM. */
const DEFAULT_BEAT_INTERVAL_MS = 500

export interface TransitionPlan {
    /** Crossfade duration. */
    fadeMs: number
    /** Position in the outgoing track where the ramp should start. */
    fadeStartMsInA: number
    /** Position where the incoming deck should be parked before the fade. */
    deckStartMsInB: number
    /** False when the pair fell back to Automix Lite constants. */
    usedPro: boolean
}

/** Map RhythmExtractor2013's raw confidence (0–5.32) to 0..1. */
export function normalizeRhythmConfidence(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) return 0
    return Math.min(1, raw / RAW_CONFIDENCE_MAX)
}

/**
 * Score how mixable two tempos are, 0..1. Considers half- and double-time
 * relationships (85 vs 170 BPM scores 1). Score falls linearly from 1 at a
 * perfect match to 0 at `tolerancePct` relative error.
 */
export function bpmCompatibility(a?: number, b?: number, tolerancePct = 8): number {
    if (!a || !b || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
        return 0
    }
    const tolerance = tolerancePct / 100
    let best = 0
    for (const multiplier of [1, 2, 0.5]) {
        const relativeError = Math.abs(a * multiplier - b) / b
        const score = Math.max(0, 1 - relativeError / tolerance)
        if (score > best) best = score
    }
    return best
}

/**
 * Return the beat nearest `targetMs`, or `targetMs` itself when no beat is
 * within `maxDriftMs`.
 */
export function snapToBeat(targetMs: number, beatsMs: readonly number[], maxDriftMs: number): number {
    let best = targetMs
    let bestDrift = Infinity
    for (const beat of beatsMs) {
        const drift = Math.abs(beat - targetMs)
        if (drift < bestDrift) {
            bestDrift = drift
            best = beat
        }
    }
    return bestDrift <= maxDriftMs ? best : targetMs
}

function beatIntervalMs(bpm: number | undefined): number {
    if (!bpm || !Number.isFinite(bpm) || bpm <= 0) return DEFAULT_BEAT_INTERVAL_MS
    return 60_000 / bpm
}

/**
 * Compute beat-snapped transition points for one track.
 *
 * `transitionOutMs` is where a crossfade of `fadeMs` should start so it ends
 * at the trimmed end: snapped to the nearest beat (within one beat interval),
 * but never later than `trimmedEnd − FADE_END_SAFETY_MS`. `transitionInMs` is
 * the first beat shortly after the trim start, where an incoming deck lands
 * on the grid instead of mid-beat.
 */
export function computeTransitionPoints(
    analysis: Pick<TrackAnalysis, "beats" | "bpm">,
    trims: TrackTrims,
    durationMs: number,
    fadeMs: number
): { transitionInMs: number; transitionOutMs: number } {
    const beats = analysis.beats ?? []
    const interval = beatIntervalMs(analysis.bpm)
    const trimmedEndMs = Math.max(0, durationMs - trims.trimEndMs)

    const latestStart = trimmedEndMs - FADE_END_SAFETY_MS
    const target = trimmedEndMs - fadeMs
    let transitionOutMs = snapToBeat(target, beats, interval)
    transitionOutMs = Math.min(transitionOutMs, latestStart)
    transitionOutMs = Math.max(transitionOutMs, trims.trimStartMs)

    let transitionInMs = trims.trimStartMs
    let firstBeatIn = Infinity
    for (const beat of beats) {
        if (beat >= trims.trimStartMs && beat < firstBeatIn) firstBeatIn = beat
    }
    if (firstBeatIn - trims.trimStartMs <= ENTRY_BEAT_WINDOW_MS) {
        transitionInMs = firstBeatIn
    }

    return { transitionInMs, transitionOutMs }
}

function trimsOf(analysis: TrackAnalysis | null): TrackTrims {
    return {
        trimStartMs: analysis?.trimStartMs ?? 0,
        trimEndMs: analysis?.trimEndMs ?? 0,
    }
}

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
export function planTransition(
    outgoing: TrackAnalysis | null,
    incoming: TrackAnalysis | null,
    durationAMs: number,
    baseFadeMs: number,
    confidenceMin = PRO_CONFIDENCE_MIN
): TransitionPlan {
    const trimsA = trimsOf(outgoing)
    const trimsB = trimsOf(incoming)
    const trimmedEndAMs = Math.max(0, durationAMs - trimsA.trimEndMs)

    const litePlan: TransitionPlan = {
        fadeMs: baseFadeMs,
        fadeStartMsInA: Math.max(trimmedEndAMs - baseFadeMs, 0),
        deckStartMsInB: trimsB.trimStartMs,
        usedPro: false,
    }

    const confidenceA = outgoing?.confidence ?? 0
    const confidenceB = incoming?.confidence ?? 0
    if (!outgoing || !incoming || confidenceA < confidenceMin || confidenceB < confidenceMin) {
        return litePlan
    }

    const compatibility = bpmCompatibility(outgoing.bpm, incoming.bpm)
    const meanEnergy = ((outgoing.energy ?? 0.5) + (incoming.energy ?? 0.5)) / 2

    let fadeMs: number
    if (compatibility >= COMPAT_BLEND_MIN) {
        if (meanEnergy >= HIGH_ENERGY_MIN) {
            const lift = Math.min(1, (meanEnergy - HIGH_ENERGY_MIN) / (1 - HIGH_ENERGY_MIN))
            fadeMs = Math.round(LONG_BLEND_MIN_MS + (FADE_MAX_MS - LONG_BLEND_MIN_MS) * lift)
        } else {
            fadeMs = baseFadeMs
        }
    } else {
        // Tempo clash: keep it short, shorter the worse the mismatch.
        fadeMs = Math.round(FADE_MIN_MS + 1000 * (compatibility / COMPAT_BLEND_MIN))
    }
    // Never plan a blend longer than the outgoing track can actually carry,
    // or short tracks would end mid-fade with an abrupt cutoff.
    const availableMs = trimmedEndAMs - trimsA.trimStartMs
    const maxFadeMs = Math.max(
        FADE_MIN_MS,
        Math.min(FADE_MAX_MS, availableMs - FADE_END_SAFETY_MS)
    )
    fadeMs = Math.min(maxFadeMs, Math.max(FADE_MIN_MS, fadeMs))

    const pointsA = computeTransitionPoints(outgoing, trimsA, durationAMs, fadeMs)
    const deckStartMsInB = incoming.transitionInMs ?? trimsB.trimStartMs

    return {
        fadeMs,
        fadeStartMsInA: pointsA.transitionOutMs,
        deckStartMsInB,
        usedPro: true,
    }
}
