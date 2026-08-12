import { describe, expect, it } from "vitest"
import type { TrackAnalysis } from "../../../types"
import { toAgentScoutAudioEvidence } from "../agentScoutContract"

function completedAnalysis(overrides: Partial<TrackAnalysis> = {}): TrackAnalysis {
    return {
        durationMs: 120_000,
        sampleRateHz: 44_100,
        channelCount: 2,
        peakDbfs: -1,
        rmsDbfs: -14,
        crestFactorDb: 13,
        rmsRangeDb: 8,
        clippingSampleRatio: 0,
        silenceRatio: 0.02,
        stereoCorrelation: 0.5,
        waveformRmsDbfs: Array(32).fill(-18),
        energy: 0.6,
        bpm: 120,
        beats: [500, 1_000],
        confidence: 0.9,
        trimStartMs: 200,
        trimEndMs: 500,
        ...overrides,
    }
}

describe("toAgentScoutAudioEvidence", () => {
    it("keeps finite optional rhythm and stereo measurements", () => {
        expect(toAgentScoutAudioEvidence(completedAnalysis())).toMatchObject({
            bpm: 120,
            stereoCorrelation: 0.5,
        })
    })

    it("normalizes non-finite optional measurements to null", () => {
        expect(
            toAgentScoutAudioEvidence(
                completedAnalysis({ bpm: Number.NaN, stereoCorrelation: Number.POSITIVE_INFINITY })
            )
        ).toMatchObject({
            bpm: null,
            stereoCorrelation: null,
        })
    })
})
