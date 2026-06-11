import { describe, expect, it } from "vitest"
import type { TrackAnalysis } from "../../types"
import {
    PRO_CONFIDENCE_MIN,
    bpmCompatibility,
    computeTransitionPoints,
    normalizeRhythmConfidence,
    planTransition,
    snapToBeat,
} from "../transitionPlanner"

/** Evenly spaced beats: `count` beats every `intervalMs` starting at `startMs`. */
function beatGrid(startMs: number, intervalMs: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => startMs + i * intervalMs)
}

function confidentAnalysis(overrides: Partial<TrackAnalysis> = {}): TrackAnalysis {
    return {
        bpm: 120,
        beats: beatGrid(0, 500, 480), // 4 minutes of 120 BPM
        energy: 0.7,
        trimStartMs: 0,
        trimEndMs: 0,
        confidence: 0.9,
        ...overrides,
    }
}

describe("normalizeRhythmConfidence", () => {
    it("maps the raw 0–5.32 scale to 0..1", () => {
        expect(normalizeRhythmConfidence(0)).toBe(0)
        expect(normalizeRhythmConfidence(2.66)).toBeCloseTo(0.5, 2)
        expect(normalizeRhythmConfidence(5.32)).toBe(1)
    })

    it("clamps out-of-range and invalid input", () => {
        expect(normalizeRhythmConfidence(9)).toBe(1)
        expect(normalizeRhythmConfidence(-1)).toBe(0)
        expect(normalizeRhythmConfidence(NaN)).toBe(0)
    })
})

describe("bpmCompatibility", () => {
    it("scores identical tempos as 1", () => {
        expect(bpmCompatibility(128, 128)).toBe(1)
    })

    it("recognizes double- and half-time relationships", () => {
        expect(bpmCompatibility(85, 170)).toBe(1)
        expect(bpmCompatibility(170, 85)).toBe(1)
    })

    it("scores 120 vs 124 as mixable within the 8% tolerance", () => {
        const score = bpmCompatibility(120, 124)
        expect(score).toBeGreaterThan(0.5)
        expect(score).toBeLessThan(1)
    })

    it("scores 100 vs 133 as incompatible", () => {
        expect(bpmCompatibility(100, 133)).toBe(0)
    })

    it("returns 0 for missing or invalid tempos", () => {
        expect(bpmCompatibility(undefined, 120)).toBe(0)
        expect(bpmCompatibility(120, undefined)).toBe(0)
        expect(bpmCompatibility(0, 120)).toBe(0)
        expect(bpmCompatibility(120, NaN)).toBe(0)
    })
})

describe("snapToBeat", () => {
    const beats = [1000, 1500, 2000, 2500]

    it("snaps to the nearest beat within the drift limit", () => {
        expect(snapToBeat(1980, beats, 500)).toBe(2000)
        expect(snapToBeat(1700, beats, 500)).toBe(1500)
    })

    it("returns the target unchanged when no beat is close enough", () => {
        expect(snapToBeat(5000, beats, 500)).toBe(5000)
        expect(snapToBeat(0, beats, 500)).toBe(0)
    })

    it("handles an empty beat list", () => {
        expect(snapToBeat(1234, [], 500)).toBe(1234)
    })
})

describe("computeTransitionPoints", () => {
    const durationMs = 240_000

    it("snaps the fade start to the beat grid", () => {
        const analysis = { bpm: 120, beats: beatGrid(0, 500, 480) }
        const trims = { trimStartMs: 0, trimEndMs: 0 }
        const { transitionOutMs } = computeTransitionPoints(analysis, trims, durationMs, 5500)
        // Target 234500 sits exactly on the grid.
        expect(transitionOutMs).toBe(234_500)
        expect(transitionOutMs % 500).toBe(0)
    })

    it("never starts the fade inside the end-safety window", () => {
        const analysis = { bpm: 120, beats: [durationMs - 100] }
        const trims = { trimStartMs: 0, trimEndMs: 0 }
        const { transitionOutMs } = computeTransitionPoints(analysis, trims, durationMs, 2500)
        expect(transitionOutMs).toBeLessThanOrEqual(durationMs - 2000)
    })

    it("respects the tail trim", () => {
        const analysis = { bpm: 120, beats: beatGrid(0, 500, 480) }
        const trims = { trimStartMs: 0, trimEndMs: 10_000 }
        const { transitionOutMs } = computeTransitionPoints(analysis, trims, durationMs, 5500)
        expect(transitionOutMs).toBe(224_500)
    })

    it("enters on the first beat shortly after the trim start", () => {
        const analysis = { bpm: 120, beats: [800, 1300, 1800] }
        const trims = { trimStartMs: 500, trimEndMs: 0 }
        const { transitionInMs } = computeTransitionPoints(analysis, trims, durationMs, 5500)
        expect(transitionInMs).toBe(800)
    })

    it("falls back to the trim start when the first beat is too far in", () => {
        const analysis = { bpm: 120, beats: [9000] }
        const trims = { trimStartMs: 500, trimEndMs: 0 }
        const { transitionInMs } = computeTransitionPoints(analysis, trims, durationMs, 5500)
        expect(transitionInMs).toBe(500)
    })
})

describe("planTransition", () => {
    const durationAMs = 240_000
    const baseFadeMs = 5500

    it("falls back to Lite when either side lacks confidence", () => {
        const weak = confidentAnalysis({ confidence: PRO_CONFIDENCE_MIN - 0.1 })
        const strong = confidentAnalysis()
        for (const [a, b] of [
            [weak, strong],
            [strong, weak],
            [null, strong],
            [strong, null],
        ] as const) {
            const plan = planTransition(a, b, durationAMs, baseFadeMs)
            expect(plan.usedPro).toBe(false)
            expect(plan.fadeMs).toBe(baseFadeMs)
        }
    })

    it("Lite fallback reproduces trim-based timing", () => {
        const outgoing = confidentAnalysis({ confidence: 0, trimEndMs: 10_000 })
        const incoming = confidentAnalysis({ confidence: 0, trimStartMs: 2000 })
        const plan = planTransition(outgoing, incoming, durationAMs, baseFadeMs)
        expect(plan.fadeStartMsInA).toBe(durationAMs - 10_000 - baseFadeMs)
        expect(plan.deckStartMsInB).toBe(2000)
    })

    it("extends the blend for BPM-compatible high-energy pairs", () => {
        const plan = planTransition(
            confidentAnalysis({ energy: 0.9 }),
            confidentAnalysis({ energy: 0.9 }),
            durationAMs,
            baseFadeMs
        )
        expect(plan.usedPro).toBe(true)
        expect(plan.fadeMs).toBeGreaterThanOrEqual(9000)
        expect(plan.fadeMs).toBeLessThanOrEqual(12_000)
    })

    it("keeps the base fade for compatible low-energy pairs", () => {
        const plan = planTransition(
            confidentAnalysis({ energy: 0.2 }),
            confidentAnalysis({ energy: 0.3 }),
            durationAMs,
            baseFadeMs
        )
        expect(plan.usedPro).toBe(true)
        expect(plan.fadeMs).toBe(baseFadeMs)
    })

    it("shortens the fade for BPM-incompatible pairs", () => {
        const plan = planTransition(
            confidentAnalysis({ bpm: 100 }),
            confidentAnalysis({ bpm: 133 }),
            durationAMs,
            baseFadeMs
        )
        expect(plan.usedPro).toBe(true)
        expect(plan.fadeMs).toBeGreaterThanOrEqual(2500)
        expect(plan.fadeMs).toBeLessThanOrEqual(3500)
    })

    it("caps the blend to what a short outgoing track can carry", () => {
        // 30s track, high energy: an uncapped plan would ask for 9-12s.
        const shortDurationMs = 30_000
        const beats = Array.from({ length: 60 }, (_, i) => i * 500)
        const plan = planTransition(
            confidentAnalysis({ energy: 0.9, beats }),
            confidentAnalysis({ energy: 0.9 }),
            shortDurationMs,
            baseFadeMs
        )
        expect(plan.usedPro).toBe(true)
        expect(plan.fadeMs).toBeLessThanOrEqual(shortDurationMs - 2000)
    })

    it("starts the fade on a beat of the outgoing track", () => {
        const plan = planTransition(
            confidentAnalysis(),
            confidentAnalysis(),
            durationAMs,
            baseFadeMs
        )
        expect(plan.usedPro).toBe(true)
        expect(plan.fadeStartMsInA % 500).toBe(0)
    })

    it("parks the incoming deck at its precomputed entry point", () => {
        const incoming = confidentAnalysis({ transitionInMs: 1500, trimStartMs: 1000 })
        const plan = planTransition(confidentAnalysis(), incoming, durationAMs, baseFadeMs)
        expect(plan.deckStartMsInB).toBe(1500)
    })
})
