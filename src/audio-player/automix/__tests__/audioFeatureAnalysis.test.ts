import { describe, expect, it } from "vitest"
import { extractAudioFeatures, SCOUT_WAVEFORM_BIN_COUNT } from "../audioFeatureAnalysis"

function fakeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
    return {
        sampleRate,
        length: channels[0]?.length ?? 0,
        duration: (channels[0]?.length ?? 0) / sampleRate,
        numberOfChannels: channels.length,
        getChannelData: (channel: number) => channels[channel],
    } as unknown as AudioBuffer
}

describe("extractAudioFeatures", () => {
    it("measures levels, waveform, and correlated stereo from decoded PCM", () => {
        const sampleRate = 1_000
        const left = Float32Array.from({ length: 2_000 }, (_, index) =>
            index % 2 === 0 ? 0.1 : -0.1
        )
        const right = Float32Array.from(left)

        const features = extractAudioFeatures(fakeBuffer([left, right], sampleRate), {
            trimStartMs: 0,
            trimEndMs: 0,
        })

        expect(features).not.toBeNull()
        expect(features?.durationMs).toBe(2_000)
        expect(features?.sampleRateHz).toBe(sampleRate)
        expect(features?.channelCount).toBe(2)
        expect(features?.peakDbfs).toBeCloseTo(-20, 1)
        expect(features?.rmsDbfs).toBeCloseTo(-20, 1)
        expect(features?.crestFactorDb).toBeCloseTo(0, 1)
        expect(features?.stereoCorrelation).toBeCloseTo(1, 3)
        expect(features?.waveformRmsDbfs).toHaveLength(SCOUT_WAVEFORM_BIN_COUNT)
        expect(features?.waveformRmsDbfs.every((level) => level === -20)).toBe(true)
        expect(features?.silenceRatio).toBe(0)
    })

    it("reports anti-correlated stereo and clipping from the analyzed samples", () => {
        const left = Float32Array.from({ length: 1_000 }, (_, index) => (index % 2 === 0 ? 1 : -1))
        const right = Float32Array.from(left, (sample) => -sample)

        const features = extractAudioFeatures(fakeBuffer([left, right], 1_000), {
            trimStartMs: 0,
            trimEndMs: 0,
        })

        expect(features?.stereoCorrelation).toBeCloseTo(-1, 3)
        expect(features?.clippingSampleRatio).toBe(1)
        expect(features?.peakDbfs).toBe(0)
    })

    it("reports the source channel count while measuring only the first two channels", () => {
        const left = Float32Array.from({ length: 100 }, (_, index) =>
            index % 2 === 0 ? 0.25 : -0.25
        )
        const right = Float32Array.from(left)
        const ignoredSurroundChannel = new Float32Array(100).fill(1)

        const features = extractAudioFeatures(
            fakeBuffer([left, right, ignoredSurroundChannel], 1_000),
            {
                trimStartMs: 0,
                trimEndMs: 0,
            }
        )

        expect(features?.channelCount).toBe(3)
        expect(features?.peakDbfs).toBeCloseTo(-12.04, 2)
        expect(features?.clippingSampleRatio).toBe(0)
        expect(features?.stereoCorrelation).toBeCloseTo(1, 3)
    })

    it("excludes measured trim regions from its PCM statistics", () => {
        const samples = new Float32Array(2_000)
        samples.fill(1, 0, 500)
        samples.fill(0.5, 500, 1_500)
        samples.fill(1, 1_500)

        const features = extractAudioFeatures(fakeBuffer([samples], 1_000), {
            trimStartMs: 500,
            trimEndMs: 500,
        })

        expect(features?.peakDbfs).toBeCloseTo(-6.02, 2)
        expect(features?.rmsDbfs).toBeCloseTo(-6.02, 2)
        expect(features?.clippingSampleRatio).toBe(0)
        expect(features?.stereoCorrelation).toBeNull()
    })

    it("preserves Automix energy as the mean louder-channel window RMS", () => {
        const left = new Float32Array(100)
        left.fill(0.1, 0, 50)
        left.fill(0.2, 50)
        const right = new Float32Array(100).fill(0.05)

        const features = extractAudioFeatures(fakeBuffer([left, right], 1_000), {
            trimStartMs: 0,
            trimEndMs: 0,
        })

        expect(features?.energy).toBeCloseTo((0.1 + 0.2) / 2 / 0.35, 4)
    })
})
