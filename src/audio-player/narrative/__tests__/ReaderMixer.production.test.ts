// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReaderMixer } from "../ReaderMixer"
import type { ReaderMixer, ReaderMixerOptions } from "../ReaderMixer"
import type { Track } from "../../types"
import {
    FakeAudio,
    FakeAudioContext,
    flushMicrotasks,
    setOnline,
    setUserActivation,
    setVisibility,
} from "./fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))

const SCORE: Track = {
    id: "score",
    title: "Score",
    artist: "",
    audioFile: "https://audio.test/score.mp3",
}
const NEXT: Track = {
    id: "next",
    title: "Next",
    artist: "",
    audioFile: "https://audio.test/next.mp3",
}
const RAIN = { id: "rain", label: "Rain", sources: [{ url: "https://audio.test/rain.mp3" }] }
const CUE = "https://audio.test/cue.mp3"
const elements = (track: Track) => FakeAudio.withSrc(track.audioFile!)
const latest = (track: Track) => {
    const decks = elements(track)
    return decks[decks.length - 1]
}
const mixers: ReaderMixer[] = []
function mixer(options: ReaderMixerOptions = {}): ReaderMixer {
    const result = createReaderMixer({
        atmospheres: [RAIN],
        fadeMs: 0,
        atmosphereFadeMs: 0,
        ...options,
    })
    mixers.push(result)
    return result
}
async function settle(ms = 40): Promise<void> {
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(ms)
}

describe("ReaderMixer production recovery", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeAudio.reset()
        FakeAudioContext.instances = []
        vi.stubGlobal("Audio", FakeAudio)
        vi.stubGlobal("AudioContext", FakeAudioContext)
        setVisibility("visible")
        setOnline(true)
        setUserActivation(true)
    })
    afterEach(() => {
        for (const instance of mixers.splice(0)) instance.dispose()
        delete (navigator as Navigator & { audioSession?: unknown }).audioSession
        Reflect.deleteProperty(navigator, "userActivation")
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it.each(["element", "auto", "web-audio"] as const)(
        "uses anonymous CORS on every %s layer",
        async (routing) => {
            FakeAudio.volumeLocked = true
            const instance = mixer({ routing })
            instance.playSoundscape(SCORE)
            instance.setAtmosphere(RAIN)
            instance.playCue(CUE)
            await settle()
            for (const url of [SCORE.audioFile!, RAIN.sources[0].url, CUE]) {
                expect(FakeAudio.withSrc(url)[0].crossOrigin).toBe("anonymous")
            }
        }
    )

    it("opts out for a non-CORS host without routing unreadable media into Web Audio", async () => {
        FakeAudio.volumeLocked = true
        const instance = mixer({ crossOrigin: null })
        instance.playSoundscape(SCORE)
        instance.playCue(CUE)
        await settle()
        expect(latest(SCORE).crossOrigin).toBeNull()
        expect(FakeAudio.withSrc(CUE)[0].crossOrigin).toBeNull()
        expect(instance.getState()).toMatchObject({ routing: "element", volumeControl: "on-off" })
        expect(FakeAudioContext.instances).toHaveLength(0)
    })

    it("downgrades only the failing auto layer once, keeping the old mix until the retry plays", async () => {
        FakeAudio.volumeLocked = true
        const instance = mixer({ loopMaxRetries: 0 })
        instance.playSoundscape(SCORE)
        instance.setAtmosphere(RAIN)
        await settle()
        const old = latest(SCORE)
        FakeAudio.playBehavior = "pending"
        instance.playSoundscape(NEXT)
        const routed = latest(NEXT)
        routed.error = { code: 4 } as MediaError
        routed.dispatch("error")
        const fallback = latest(NEXT)
        expect(fallback).not.toBe(routed)
        expect(fallback.crossOrigin).toBeNull()
        expect(old.paused).toBe(false)
        expect(old.src).toBe(SCORE.audioFile)
        expect(FakeAudioContext.instances[0].routedElements).not.toContain(fallback)
        expect(instance.getState().layers).toMatchObject({
            soundscapes: { routing: "element" },
            atmosphere: { routing: "web-audio" },
        })
        expect(instance.getState().volumeControl).toBe("on-off")
        fallback.dispatch("error")
        expect(instance.getState().layers.soundscapes.status).toBe("failed")
        expect(elements(NEXT)).toHaveLength(0)
        expect(old.paused).toBe(false)
    })

    it("never downgrades explicit web-audio routing", async () => {
        const instance = mixer({ routing: "web-audio", loopMaxRetries: 0 })
        FakeAudio.playBehavior = "pending"
        instance.playSoundscape(SCORE)
        latest(SCORE).dispatch("error")
        expect(instance.getState().layers.soundscapes).toMatchObject({
            status: "failed",
            routing: "web-audio",
        })
        await flushMicrotasks()
    })

    it("does not extend a cue's original deadline when retrying a CORS failure", async () => {
        FakeAudio.volumeLocked = true
        FakeAudio.playBehavior = "pending"
        const instance = mixer()
        instance.playCue(CUE)
        const routed = FakeAudio.withSrc(CUE)[0]
        await vi.advanceTimersByTimeAsync(1000)
        routed.dispatch("error")
        const fallback = FakeAudio.withSrc(CUE)[0]
        expect(fallback).not.toBe(routed)
        expect(fallback.crossOrigin).toBeNull()
        await vi.advanceTimersByTimeAsync(500)
        expect(instance.getState().activeCues).toBe(0)
        expect(fallback.src).toBe("")
    })

    it("primes touch spares and retries loops on touchend, never pointerdown or Escape", async () => {
        FakeAudio.playBehavior = "not-allowed"
        const instance = mixer()
        instance.playSoundscape(SCORE)
        await flushMicrotasks()
        const count = FakeAudio.created.length
        const calls = latest(SCORE).playCalls
        setUserActivation(false)
        document.dispatchEvent(new Event("pointerdown"))
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
        expect(FakeAudio.created).toHaveLength(count)
        expect(latest(SCORE).playCalls).toBe(calls)
        setUserActivation(true)
        FakeAudio.playBehavior = "resolve"
        document.dispatchEvent(new Event("touchend"))
        expect(FakeAudio.created.slice(count)).toHaveLength(8)
        expect(FakeAudio.created.slice(count).every((el) => el.loadActivations[0])).toBe(true)
        await settle()
        expect(instance.getState().layers.soundscapes.status).toBe("playing")
    })

    it("does not fill the unlock pool when transient activation is explicitly inactive", () => {
        const instance = mixer()
        const count = FakeAudio.created.length
        setUserActivation(false)
        instance.unlock()
        expect(FakeAudio.created).toHaveLength(count)
    })

    it("bounds hung play attempts, retries the same URL with backoff, and keeps the old score", async () => {
        const instance = mixer({ loopAttemptTimeoutMs: 1000, loopRetryDelayMs: 100 })
        instance.playSoundscape(SCORE)
        await settle()
        const old = latest(SCORE)
        FakeAudio.playBehavior = "pending"
        instance.playSoundscape(NEXT)
        const first = latest(NEXT)
        await vi.advanceTimersByTimeAsync(999)
        expect(first.src).toBe(NEXT.audioFile)
        await vi.advanceTimersByTimeAsync(1)
        expect(first.src).toBe("")
        expect(elements(NEXT)).toHaveLength(0)
        await vi.advanceTimersByTimeAsync(100)
        expect(elements(NEXT)).toHaveLength(1)
        await vi.advanceTimersByTimeAsync(1000 + 200 + 1000)
        expect(instance.getState().layers.soundscapes).toMatchObject({
            status: "failed",
            current: "id:score",
            requested: "id:next",
        })
        expect(old.paused).toBe(false)
        expect(old.volume).toBeCloseTo(0.25)
        expect(old.src).toBe(SCORE.audioFile)
    })

    it("bounds a positive-trim metadata wait too", async () => {
        const instance = mixer({ loopAttemptTimeoutMs: 1000, loopMaxRetries: 0 })
        instance.playSoundscape(SCORE, { trimStartMs: 2000 })
        const deck = latest(SCORE)
        expect(deck.playCalls).toBe(0)
        await vi.advanceTimersByTimeAsync(1000)
        expect(instance.getState().layers.soundscapes.status).toBe("failed")
        expect(deck.src).toBe("")
    })

    it("recovers failed wanted loops on online without replacing the old score early", async () => {
        const instance = mixer({ loopRetryDelayMs: 10 })
        instance.playSoundscape(SCORE)
        await settle()
        const old = latest(SCORE)
        setOnline(false)
        FakeAudio.playBehavior = "reject"
        instance.playSoundscape(NEXT)
        instance.setAtmosphere(RAIN)
        await settle(40)
        expect(instance.getState().layers.soundscapes.status).toBe("failed")
        expect(instance.getState().layers.atmosphere.status).toBe("failed")
        expect(old.paused).toBe(false)
        FakeAudio.playBehavior = "resolve"
        setOnline(true)
        expect(old.src).toBe(SCORE.audioFile)
        await settle()
        expect(instance.getState().layers.soundscapes).toMatchObject({
            status: "playing",
            current: "id:next",
        })
        expect(instance.getState().layers.atmosphere.status).toBe("playing")
        instance.stopAll({ fadeMs: 0 })
        await settle()
        setOnline(true)
        expect(elements(NEXT)).toHaveLength(0)
        expect(FakeAudio.withSrc(RAIN.sources[0].url)).toHaveLength(0)
    })

    it("restarts a failed single-source loop at its previous currentTime", async () => {
        const instance = mixer({ loopRetryDelayMs: 10 })
        instance.playSoundscape(SCORE)
        await settle()
        const old = latest(SCORE)
        old.currentTime = 12.5
        old.error = { code: 2 } as MediaError
        old.dispatch("error")
        await vi.advanceTimersByTimeAsync(10)
        const retry = latest(SCORE)
        expect(retry).not.toBe(old)
        expect(retry.playCalls).toBe(0)
        retry.duration = 100
        retry.dispatch("loadedmetadata")
        await settle()
        expect(retry.currentTime).toBe(12.5)
        expect(instance.getState().layers.soundscapes.status).toBe("playing")
    })

    it("clears a stall watchdog on playing and retries a stall that persists", async () => {
        const instance = mixer({ loopAttemptTimeoutMs: 1000, loopRetryDelayMs: 10 })
        instance.playSoundscape(SCORE)
        await settle()
        const deck = latest(SCORE)
        deck.dispatch("waiting")
        await vi.advanceTimersByTimeAsync(900)
        deck.dispatch("playing")
        await vi.advanceTimersByTimeAsync(200)
        expect(deck.src).toBe(SCORE.audioFile)
        deck.currentTime = 4
        deck.dispatch("stalled")
        await vi.advanceTimersByTimeAsync(1010)
        expect(deck.src).toBe("")
        expect(latest(SCORE)).not.toBe(deck)
        latest(SCORE).duration = 100
        latest(SCORE).dispatch("loadedmetadata")
        await settle()
        expect(latest(SCORE).currentTime).toBe(4)
    })

    it("frees all six stalled cue slots at 1.5 seconds and stops late play resolutions", async () => {
        let finish: (() => void) | undefined
        FakeAudio.playBehavior = () =>
            new Promise<void>((resolve) => {
                finish = resolve
            })
        const instance = mixer()
        for (let i = 0; i < 6; i++) expect(instance.playCue(CUE)).toBe(true)
        expect(instance.playCue(CUE)).toBe(false)
        const last = FakeAudio.withSrc(CUE)[5]
        await vi.advanceTimersByTimeAsync(1500)
        expect(instance.getState().activeCues).toBe(0)
        finish!()
        await flushMicrotasks()
        expect(last.paused).toBe(true)
        expect(last.src).toBe("")
        FakeAudio.playBehavior = "resolve"
        expect(instance.playCue(CUE)).toBe(true)
        await settle()
        const playing = FakeAudio.withSrc(CUE)[0]
        playing.dispatch("waiting")
        await vi.advanceTimersByTimeAsync(1500)
        expect(instance.getState().activeCues).toBe(0)
        expect(playing.src).toBe("")
    })

    it("drops cues whose media plays while the output context is still blocked", async () => {
        const instance = mixer({ routing: "web-audio" })
        const ctx = FakeAudioContext.instances[0]
        ctx.resumeBehavior = "reject"
        instance.playCue(CUE)
        await flushMicrotasks()
        await vi.advanceTimersByTimeAsync(1500)
        expect(instance.getState().activeCues).toBe(0)
        ctx.resumeBehavior = "resolve"
        document.dispatchEvent(new Event("click"))
        expect(FakeAudio.withSrc(CUE)).toHaveLength(0)
        expect(ctx.state).toBe("suspended")
    })

    it("suspends idle or muted output and only owns the session while audible", async () => {
        const session = { type: "ambient" }
        Object.defineProperty(navigator, "audioSession", { configurable: true, value: session })
        const instance = mixer({ routing: "web-audio" })
        const ctx = FakeAudioContext.instances[0]
        expect(session.type).toBe("ambient")
        document.dispatchEvent(new Event("click"))
        expect(ctx.resumeCalls).toBe(0)
        instance.setMasterEnabled(false)
        instance.playSoundscape(SCORE)
        await settle()
        expect(ctx.resumeCalls).toBe(0)
        expect(session.type).toBe("ambient")
        instance.setMasterEnabled(true)
        await settle()
        expect(ctx.state).toBe("running")
        expect(session.type).toBe("playback")
        instance.setMasterEnabled(false)
        await flushMicrotasks()
        expect(ctx.state).toBe("suspended")
        expect(session.type).toBe("ambient")
        instance.setMasterEnabled(true)
        await settle()
        instance.stopAll({ fadeMs: 0 })
        await settle()
        expect(instance.getState().layers.soundscapes).toMatchObject({
            status: "idle",
            requested: null,
        })
        expect(elements(SCORE)).toHaveLength(0)
        expect(ctx.state).toBe("suspended")
        expect(session.type).toBe("ambient")
    })

    it("honors audioSessionType null", async () => {
        const session = { type: "ambient" }
        Object.defineProperty(navigator, "audioSession", { configurable: true, value: session })
        const instance = mixer({ routing: "web-audio", audioSessionType: null })
        instance.playSoundscape(SCORE)
        await settle()
        expect(session.type).toBe("ambient")
    })

    it("does not wake a context for zero-volume cues or ask for gestures for muted loops", async () => {
        const instance = mixer({ routing: "web-audio" })
        const ctx = FakeAudioContext.instances[0]
        expect(instance.playCue(CUE, { volume: 0 })).toBe(false)
        expect(ctx.resumeCalls).toBe(0)
        instance.setMasterEnabled(false)
        FakeAudio.playBehavior = "not-allowed"
        instance.playSoundscape(SCORE)
        await settle()
        expect(instance.getState().needsGesture).toBe(false)
        expect(ctx.resumeCalls).toBe(0)
    })

    it("suspends hidden output, drops cues, and resumes loops in place on return", async () => {
        const instance = mixer({ routing: "web-audio" })
        instance.playSoundscape(SCORE)
        instance.playCue(CUE)
        await settle()
        const ctx = FakeAudioContext.instances[0]
        const deck = latest(SCORE)
        deck.currentTime = 7
        setVisibility("hidden")
        await flushMicrotasks()
        expect(ctx.state).toBe("suspended")
        expect(instance.getState().activeCues).toBe(0)
        expect(instance.playCue(CUE)).toBe(false)
        setVisibility("visible")
        await settle()
        expect(ctx.state).toBe("running")
        expect(deck.currentTime).toBe(7)
        expect(deck.paused).toBe(false)
    })

    it("reports interrupted as needing a gesture and resumes when it becomes resumable", async () => {
        const instance = mixer({ routing: "web-audio" })
        instance.playSoundscape(SCORE)
        await settle()
        const ctx = FakeAudioContext.instances[0]
        ctx.resumeBehavior = "interrupted"
        ctx.setState("interrupted")
        await flushMicrotasks()
        expect(instance.getState().needsGesture).toBe(true)
        ctx.resumeBehavior = "resolve"
        ctx.setState("suspended")
        await settle()
        expect(ctx.state).toBe("running")
        expect(instance.getState().needsGesture).toBe(false)
    })

    it("reports a system pause truthfully and recovers on an activation event", async () => {
        const instance = mixer()
        instance.playSoundscape(SCORE)
        await settle()
        const deck = latest(SCORE)
        deck.pause()
        expect(instance.getState().layers.soundscapes.status).toBe("paused")
        document.dispatchEvent(new Event("click"))
        await settle()
        expect(deck.paused).toBe(false)
        expect(instance.getState().layers.soundscapes.status).toBe("playing")
    })

    it("reports non-autoplay resume failure and recovers from online", async () => {
        const instance = mixer({ loopMaxRetries: 0 })
        instance.playSoundscape(SCORE)
        await settle()
        setVisibility("hidden")
        FakeAudio.playBehavior = "reject"
        setVisibility("visible")
        await settle()
        expect(instance.getState().layers.soundscapes).toMatchObject({
            status: "failed",
            failure: "decode failure",
        })
        FakeAudio.playBehavior = "resolve"
        setOnline(true)
        await settle()
        expect(instance.getState().layers.soundscapes.status).toBe("playing")
    })

    it("cancels pending backoff on stop and disposal", async () => {
        const instance = mixer({ loopRetryDelayMs: 100 })
        FakeAudio.playBehavior = "reject"
        instance.playSoundscape(SCORE)
        await flushMicrotasks()
        instance.stopAll({ fadeMs: 0 })
        await vi.advanceTimersByTimeAsync(1000)
        expect(elements(SCORE)).toHaveLength(0)
        instance.playSoundscape(SCORE)
        await flushMicrotasks()
        instance.dispose()
        setOnline(true)
        await vi.advanceTimersByTimeAsync(1000)
        expect(elements(SCORE)).toHaveLength(0)
        expect(vi.getTimerCount()).toBe(0)
    })
})
