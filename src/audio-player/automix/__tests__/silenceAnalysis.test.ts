import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Track } from "../../types"

const decodeMocks = vi.hoisted(() => ({
    fetchAndDecodeTrack: vi.fn(),
}))

vi.mock("../decodeTrack", () => ({
    fetchAndDecodeTrack: decodeMocks.fetchAndDecodeTrack,
}))

let createSceneMixEngine: typeof import("../../narrative/SceneMixEngine").createSceneMixEngine
let ensureSourceAnalysis: typeof import("../silenceAnalysis").ensureSourceAnalysis
let ensureTrackAnalysis: typeof import("../silenceAnalysis").ensureTrackAnalysis

class PolicyAudio {
    loop = false
    preload = ""
    crossOrigin: string | null = null
    muted = false
    paused = true
    readyState = 0
    duration = Number.NaN
    currentTime = 0
    src = ""
    error: MediaError | null = null
    volume = 1

    addEventListener(): void {}
    removeEventListener(): void {}
    load(): void {}
    pause(): void {
        this.paused = true
    }
    play(): Promise<void> {
        this.paused = false
        return Promise.resolve()
    }
    removeAttribute(): void {
        this.src = ""
    }
}

function audibleBuffer(): AudioBuffer {
    const samples = new Float32Array(20_000).fill(0.1)
    return {
        sampleRate: 1000,
        length: samples.length,
        duration: 20,
        numberOfChannels: 1,
        getChannelData: () => samples,
    } as unknown as AudioBuffer
}

describe("silence analysis source selection", () => {
    beforeEach(async () => {
        decodeMocks.fetchAndDecodeTrack.mockReset()
        decodeMocks.fetchAndDecodeTrack.mockResolvedValue(audibleBuffer())
        vi.stubGlobal("Audio", PolicyAudio as unknown as typeof Audio)
        vi.resetModules()

        const analysisModule = await import("../silenceAnalysis")
        ensureSourceAnalysis = analysisModule.ensureSourceAnalysis
        ensureTrackAnalysis = analysisModule.ensureTrackAnalysis
        const sceneMixModule = await import("../../narrative/SceneMixEngine")
        createSceneMixEngine = sceneMixModule.createSceneMixEngine
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("normalizes and deduplicates analysis for one concrete source URL", async () => {
        const first = ensureSourceAnalysis(" /analysis/source-a.mp3 ")
        const second = ensureSourceAnalysis("http://localhost/analysis/source-a.mp3")

        expect(second).toBe(first)
        await expect(first).resolves.toEqual({ trimStartMs: 0, trimEndMs: 0 })
        expect(decodeMocks.fetchAndDecodeTrack).toHaveBeenCalledTimes(1)
        expect(decodeMocks.fetchAndDecodeTrack).toHaveBeenCalledWith(
            "http://localhost/analysis/source-a.mp3",
        )
    })

    it("retains automatic Automix analysis through the primary track source", async () => {
        const track: Track = {
            id: "AUTOMIX_SOURCE_ANALYSIS",
            title: "Automix source",
            artist: "t",
            audioFile: "/analysis/automix-primary.mp3",
            fallbackSources: ["/analysis/automix-fallback.mp3"],
        }

        await expect(ensureTrackAnalysis(track)).resolves.toEqual({
            trimStartMs: 0,
            trimEndMs: 0,
        })
        expect(decodeMocks.fetchAndDecodeTrack).toHaveBeenCalledTimes(1)
        expect(decodeMocks.fetchAndDecodeTrack).toHaveBeenCalledWith(
            "http://localhost/analysis/automix-primary.mp3",
        )
    })

    it("resolves analysis failures to natural-start fallback", async () => {
        decodeMocks.fetchAndDecodeTrack.mockRejectedValueOnce(new Error("decode failed"))

        await expect(
            ensureSourceAnalysis("/analysis/source-failure.mp3"),
        ).resolves.toBeNull()
    })

    it("does not enter the decode pipeline when SceneMix analysis is off", async () => {
        const mix = createSceneMixEngine({ analysisPolicy: "off" })
        mix.crossfadeTo({
            id: "SCENE_ANALYSIS_OFF",
            title: "Analysis off",
            artist: "t",
            audioFile: "/analysis/scene-off.mp3",
        })
        await Promise.resolve()

        expect(decodeMocks.fetchAndDecodeTrack).not.toHaveBeenCalled()
        mix.dispose()
    })

    it("does not enter the decode pipeline when SceneMix receives a trim", async () => {
        const mix = createSceneMixEngine()
        mix.crossfadeTo(
            {
                id: "SCENE_PRECOMPUTED_TRIM",
                title: "Precomputed trim",
                artist: "t",
                audioFile: "/analysis/scene-precomputed.mp3",
            },
            { trimStartMs: 1250 },
        )

        expect(decodeMocks.fetchAndDecodeTrack).not.toHaveBeenCalled()
        mix.dispose()
    })
})
