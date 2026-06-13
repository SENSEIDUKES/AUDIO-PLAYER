import { afterEach, describe, expect, it, vi } from "vitest"
import type { Track } from "../../types"
import { getTrackTrims } from "../silenceAnalysis"
import {
    configureTrackAnalysis,
    ensureSmartTrackAnalysis,
    getSmartTrackAnalysis,
    resetTrackAnalysisCacheForTests,
} from "../trackAnalysis"

/** Mono 44.1kHz constant-amplitude buffer standing in for a decoded track. */
function fakeBuffer(durationS: number, amplitude = 0.1): AudioBuffer {
    const sampleRate = 44100
    const length = Math.round(durationS * sampleRate)
    const data = new Float32Array(length).fill(amplitude)
    return {
        sampleRate,
        length,
        duration: durationS,
        numberOfChannels: 1,
        getChannelData: () => data,
    } as unknown as AudioBuffer
}

function track(id: string): Track {
    return { id, title: id, artist: "test", audioFile: `https://example.test/${id}.mp3` }
}

afterEach(() => {
    resetTrackAnalysisCacheForTests()
    configureTrackAnalysis({ rhythm: null, decode: null, persist: true })
})

describe("ensureSmartTrackAnalysis", () => {
    it("analyzes a short track as a single segment and fills rhythm fields", async () => {
        const decode = vi.fn(async () => fakeBuffer(120))
        const rhythm = vi.fn(async (_s: Float32Array, _sr: number, offsetMs: number) => ({
            bpm: 120,
            ticksMs: [offsetMs + 500, offsetMs + 1000, offsetMs + 1500],
            confidenceRaw: 4.0,
        }))
        configureTrackAnalysis({ decode, rhythm, persist: false })

        const analysis = await ensureSmartTrackAnalysis(track("short"))
        expect(rhythm).toHaveBeenCalledTimes(1)
        expect(analysis?.bpm).toBe(120)
        expect(analysis?.beats).toEqual([500, 1000, 1500])
        expect(analysis?.confidence).toBeCloseTo(4.0 / 5.32, 3)
        expect(analysis?.transitionInMs).toBe(500)
        expect(analysis?.transitionOutMs).toBeDefined()
        expect(analysis?.energy).toBeGreaterThan(0)
    })

    it("analyzes head and tail segments of a long track at the right offsets", async () => {
        const durationS = 300
        const decode = vi.fn(async () => fakeBuffer(durationS))
        const offsets: number[] = []
        const rhythm = vi.fn(async (_s: Float32Array, _sr: number, offsetMs: number) => {
            offsets.push(offsetMs)
            return { bpm: 128, ticksMs: [offsetMs + 469], confidenceRaw: 4.5 }
        })
        configureTrackAnalysis({ decode, rhythm, persist: false })

        const analysis = await ensureSmartTrackAnalysis(track("long"))
        expect(rhythm).toHaveBeenCalledTimes(2)
        expect(offsets[0]).toBe(0) // head starts at the trim start
        expect(offsets[1]).toBe(durationS * 1000 - 120_000) // tail covers the last 120s
        expect(analysis?.bpm).toBe(128)
        expect(analysis?.beats).toEqual([469, 180_469])
    })

    it("keeps the tail tempo when head and tail are in a half/double relationship", async () => {
        const decode = vi.fn(async () => fakeBuffer(300))
        let call = 0
        const rhythm = vi.fn(async (_s: Float32Array, _sr: number, offsetMs: number) => ({
            bpm: call++ === 0 ? 85 : 170,
            ticksMs: [offsetMs + 500],
            confidenceRaw: 4.0,
        }))
        configureTrackAnalysis({ decode, rhythm, persist: false })

        const analysis = await ensureSmartTrackAnalysis(track("halftime"))
        expect(analysis?.bpm).toBe(170)
    })

    it("penalizes confidence when head and tail disagree about tempo", async () => {
        const decode = vi.fn(async () => fakeBuffer(300))
        let call = 0
        const rhythm = vi.fn(async (_s: Float32Array, _sr: number, offsetMs: number) => ({
            bpm: call++ === 0 ? 100 : 133,
            ticksMs: [offsetMs + 500],
            confidenceRaw: 4.0,
        }))
        configureTrackAnalysis({ decode, rhythm, persist: false })

        const analysis = await ensureSmartTrackAnalysis(track("clash"))
        expect(analysis?.confidence).toBeCloseTo((4.0 / 5.32) * 0.7, 3)
    })

    it("returns a trims-only result with zero confidence when rhythm fails", async () => {
        const decode = vi.fn(async () => fakeBuffer(120))
        const rhythm = vi.fn(async () => null)
        configureTrackAnalysis({ decode, rhythm, persist: false })

        const analysis = await ensureSmartTrackAnalysis(track("norhythm"))
        expect(analysis).not.toBeNull()
        expect(analysis?.confidence).toBe(0)
        expect(analysis?.bpm).toBeUndefined()
        expect(analysis?.trimStartMs).toBe(0)
        expect(analysis?.transitionOutMs).toBe(120_000 - 5500)
    })

    it("resolves null when decoding fails", async () => {
        configureTrackAnalysis({ decode: async () => null, rhythm: async () => null, persist: false })
        const analysis = await ensureSmartTrackAnalysis(track("broken"))
        expect(analysis).toBeNull()
    })

    it("analyzes each track once and serves repeats from the cache", async () => {
        const decode = vi.fn(async () => fakeBuffer(120))
        const rhythm = vi.fn(async (_s: Float32Array, _sr: number, offsetMs: number) => ({
            bpm: 120,
            ticksMs: [offsetMs + 500],
            confidenceRaw: 4.0,
        }))
        configureTrackAnalysis({ decode, rhythm, persist: false })

        const t = track("cached")
        const [a, b] = await Promise.all([ensureSmartTrackAnalysis(t), ensureSmartTrackAnalysis(t)])
        const c = await ensureSmartTrackAnalysis(t)
        expect(decode).toHaveBeenCalledTimes(1)
        expect(a).toBe(b)
        expect(b).toBe(c)
    })

    it("seeds the trim cache before rhythm extraction finishes", async () => {
        const decode = vi.fn(async () => fakeBuffer(120))
        let release!: () => void
        const gate = new Promise<null>((resolve) => {
            release = () => resolve(null)
        })
        configureTrackAnalysis({ decode, rhythm: () => gate, persist: false })

        const t = track("seeded")
        const job = ensureSmartTrackAnalysis(t)
        // Trims become readable while rhythm is still pending.
        await vi.waitFor(() => expect(getTrackTrims(t)).toEqual({ trimStartMs: 0, trimEndMs: 0 }))
        expect(getSmartTrackAnalysis(t)).toBeNull()
        release()
        await job
        expect(getSmartTrackAnalysis(t)).not.toBeNull()
    })

    it("exposes settled results synchronously through getSmartTrackAnalysis", async () => {
        const decode = vi.fn(async () => fakeBuffer(120))
        configureTrackAnalysis({ decode, rhythm: async () => null, persist: false })

        const t = track("sync")
        expect(getSmartTrackAnalysis(t)).toBeNull()
        await ensureSmartTrackAnalysis(t)
        expect(getSmartTrackAnalysis(t)?.trimStartMs).toBe(0)
    })
})
