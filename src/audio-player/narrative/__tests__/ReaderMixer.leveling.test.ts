// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createReaderMixer, type ReaderMixer } from "../ReaderMixer"
import { FakeAudio, FakeAudioContext, flushMicrotasks, setVisibility } from "./fakeMedia"

const scores = {
    title: "Score",
    artist: "",
    audioFile: "https://a.test/music.mp3",
    loudness: { lufs: -10, peakDb: 0.7, kind: "integrated" as const },
}
let mixer: ReaderMixer
beforeEach(() => {
    vi.useFakeTimers()
    FakeAudio.reset()
    FakeAudioContext.instances = []
    vi.stubGlobal("Audio", FakeAudio)
    vi.stubGlobal("AudioContext", FakeAudioContext)
    setVisibility("visible")
})
afterEach(() => {
    mixer?.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
async function settle() {
    await flushMicrotasks()
    vi.advanceTimersByTime(50)
    await flushMicrotasks()
}

it("levels scores and individual cues before their layer gain, and switches off live", async () => {
    mixer = createReaderMixer({ routing: "web-audio", fadeMs: 0 })
    mixer.playSoundscape(scores)
    await settle()
    const ctx = FakeAudioContext.instances[0]
    const music = ctx.gains[3]
    expect(ctx.gains[0].gain.value).toBe(0.25)
    expect(music.gain.value).toBeCloseTo(Math.pow(10, -10 / 20))
    const cue = { lufs: -34, peakDb: -30, kind: "momentary-max" as const }
    mixer.playCue("https://a.test/cue.mp3", { loudness: cue, volume: 0.5 })
    expect(ctx.gains[4].gain.value).toBeCloseTo(0.5 * Math.pow(10, 12 / 20))
    expect(ctx.gains[2].gain.value).toBe(0.75)
    mixer.setLeveling(false)
    expect(music.gain.value).toBe(1)
    expect(ctx.gains[4].gain.value).toBe(0.5)
    mixer.setLeveling(true)
    expect(music.gain.value).toBeCloseTo(Math.pow(10, -10 / 20))
})

it("has a summed-output limiter, not one limiter per layer", () => {
    mixer = createReaderMixer({ routing: "web-audio" })
    const ctx = FakeAudioContext.instances[0]
    expect(ctx.compressors).toHaveLength(1)
    const limiter = ctx.compressors[0]
    expect(limiter.threshold.value).toBe(-1)
    expect(limiter.knee.value).toBe(0)
    expect(limiter.ratio.value).toBe(20)
    expect(ctx.gains.slice(0, 3).every((bus) => bus.connections[0] === limiter)).toBe(true)
    expect(limiter.connections).toEqual([ctx.destination])
})

it("releases a context lease if limiter construction fails before the element fallback", async () => {
    const compressor = vi.spyOn(FakeAudioContext.prototype, "createDynamicsCompressor")
    compressor.mockImplementation(() => {
        throw new Error("No compressor")
    })
    try {
        mixer = createReaderMixer()
        await flushMicrotasks()
        expect(mixer.getState().routing).toBe("element")
        expect(FakeAudioContext.instances[0].state).toBe("closed")
    } finally {
        compressor.mockRestore()
    }
})

it("attenuates elements, applies no boosts, and cannot level volume-locked iPhones", async () => {
    mixer = createReaderMixer({ routing: "element", fadeMs: 0 })
    mixer.playSoundscape(scores)
    await settle()
    expect(FakeAudio.withSrc(scores.audioFile)[0].volume).toBeCloseTo(0.25 * Math.pow(10, -10 / 20))
    mixer.playCue("https://a.test/quiet.mp3", {
        loudness: { lufs: -40, peakDb: -30, kind: "momentary-max" },
    })
    expect(FakeAudio.withSrc("https://a.test/quiet.mp3")[0].volume).toBe(0.75)
    mixer.dispose()
    FakeAudio.volumeLocked = true
    mixer = createReaderMixer({ routing: "element", fadeMs: 0 })
    mixer.playSoundscape(scores)
    await settle()
    expect(mixer.getState().volumeControl).toBe("on-off")
    expect(FakeAudio.withSrc(scores.audioFile).find((audio) => !audio.paused)?.volume).toBe(1)
})
