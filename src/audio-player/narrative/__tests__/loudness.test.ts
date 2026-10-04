import { describe, expect, it } from "vitest"
import { computeLoudnessGain, measureLoudnessPcm } from "../loudness"

const measurement = (lufs: number, peakDb = -30) => ({ lufs, peakDb, kind: "integrated" as const })
const sine = (rate: number, seconds: number, amplitude = 1) =>
    Float32Array.from(
        { length: rate * seconds },
        (_, i) => amplitude * Math.sin((2 * Math.PI * 997 * i) / rate)
    )

describe("source leveling", () => {
    it("converts LU differences to amplitude before the layer level", () => {
        expect(computeLoudnessGain(measurement(-10), "integrated").gain).toBeCloseTo(
            Math.pow(10, -10 / 20)
        )
        expect(
            computeLoudnessGain({ lufs: -8, peakDb: -3, kind: "momentary-max" }, "momentary-max")
                .gain
        ).toBeCloseTo(Math.pow(10, -6 / 20))
    })
    it("caps boosts at twelve dB and marks the short re-export list", () => {
        const result = computeLoudnessGain(measurement(-47.1, -27), "integrated")
        expect(result.requestedGainDb).toBeCloseTo(27.1)
        expect(result.appliedGainDb).toBe(12)
        expect(result.tooQuietToLevel).toBe(true)
        expect(result.gain).toBeCloseTo(3.9810717)
    })
    it("caps by sample-peak headroom, including decoded peaks above zero", () => {
        expect(computeLoudnessGain(measurement(-31, -8.2), "integrated").appliedGainDb).toBeCloseTo(
            7.2
        )
        expect(computeLoudnessGain(measurement(-24, 0.7), "integrated").appliedGainDb).toBeCloseTo(
            -1.7
        )
    })
    it("plays missing, mismatched, disabled and invalid values at unity", () => {
        expect(computeLoudnessGain(undefined, "integrated").gain).toBe(1)
        expect(computeLoudnessGain(measurement(-40), "momentary-max").gain).toBe(1)
        expect(computeLoudnessGain(measurement(-40), "integrated", { enabled: false }).gain).toBe(1)
        expect(computeLoudnessGain(measurement(NaN), "integrated").gain).toBe(1)
    })
    it("only attenuates on the element route and respects owner references/caps", () => {
        expect(computeLoudnessGain(measurement(-40), "integrated", {}, "element").gain).toBe(1)
        expect(
            computeLoudnessGain(measurement(-10), "integrated", {}, "element").appliedGainDb
        ).toBe(-10)
        expect(
            computeLoudnessGain(measurement(-30), "integrated", {
                maxBoostDb: 3,
                loopReferenceLufs: -24,
            }).appliedGainDb
        ).toBe(3)
    })
})

describe("loudness calibration and gates", () => {
    it.each([44100, 48000, 96000])(
        "full-scale 997 Hz in one channel is −3.01 LUFS at %i Hz",
        (rate) => {
            const result = measureLoudnessPcm([sine(rate, 3)], rate)
            expect(result.lufs).toBeCloseTo(-3.01, 2)
            expect(result.peakDb).toBeCloseTo(0, 3)
        }
    )
    it("integrated gating excludes silence, absolute-gated and relative-gated quiet blocks", () => {
        const rate = 8000
        const steady = sine(rate, 20)
        const withSilence = new Float32Array(rate * 40)
        withSilence.set(steady)
        const result = measureLoudnessPcm([withSilence], rate)
        expect(result.lufs! - measureLoudnessPcm([steady], rate).lufs!).toBeGreaterThan(-0.05)
        const withQuiet = new Float32Array(withSilence)
        withQuiet.set(sine(rate, 20, 0.01), rate * 20)
        expect(measureLoudnessPcm([withQuiet], rate).lufs).toBeCloseTo(result.lufs!, 2)
        expect(measureLoudnessPcm([sine(rate, 3, 0.00001)], rate).lufs).toBeNull()
        expect(measureLoudnessPcm([new Float32Array(rate)], rate)).toEqual({
            kind: "integrated",
            lufs: null,
            peakDb: null,
        })
    })
    it("uses the loudest 400 ms for cues and pads a shorter cue", () => {
        const rate = 48000
        const mixed = sine(rate, 5, 0.25)
        mixed.set(sine(rate, 1), rate * 4)
        const maximum = measureLoudnessPcm([mixed], rate, { kind: "momentary-max" })
        expect(maximum.lufs).toBeCloseTo(-3.01, 2)
        expect(measureLoudnessPcm([mixed], rate).lufs!).toBeLessThan(maximum.lufs! - 3)
        expect(
            measureLoudnessPcm([sine(rate, 0.1)], rate, { kind: "momentary-max" }).lufs
        ).toBeCloseTo(-9.03, 1)
    })
    it("weights independent channels, excludes LFE, and records raw sample overshoots", () => {
        const rate = 48000
        const pcm = sine(rate, 2)
        expect(measureLoudnessPcm([pcm, pcm], rate).lufs).toBeCloseTo(0, 2)
        const silent = new Float32Array(pcm.length)
        expect(
            measureLoudnessPcm([silent, silent, silent, pcm, silent, silent], rate).lufs
        ).toBeNull()
        expect(measureLoudnessPcm([sine(rate, 2, 1.2)], rate).peakDb).toBeCloseTo(
            20 * Math.log10(1.2)
        )
        expect(() => measureLoudnessPcm([pcm, new Float32Array(1)], rate)).toThrow()
        expect(() => measureLoudnessPcm([pcm], rate, { channelWeights: [NaN] })).toThrow()
    })
})
