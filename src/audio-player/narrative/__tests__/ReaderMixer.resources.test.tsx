// @vitest-environment jsdom
import { StrictMode, Suspense } from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReaderMixer, type ReaderMixer } from "../ReaderMixer"
import { ReaderMixerProvider, useReaderMixer } from "../ReaderMixerContext"
import { AudioSpriteEngine } from "../../core/audio/AudioSpriteEngine"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../../core/audio/WebAudioBackend"
import {
    FakeAudio,
    FakeAudioContext,
    flushMicrotasks,
    setVisibility,
    setUserActivation,
} from "./fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))
const CUE = "https://audio.test/cue.mp3"
const mixers: ReaderMixer[] = []
function mixer(options: Parameters<typeof createReaderMixer>[0] = {}) {
    const instance = createReaderMixer({ routing: "web-audio", fadeMs: 0, ...options })
    mixers.push(instance)
    return instance
}
function Consumer() {
    const instance = useReaderMixer()
    return <span>{instance.isDisposed() ? "disposed" : "ready"}</span>
}
function Discarded(): never {
    throw new Promise<void>(() => {})
}

describe("ReaderMixer resources", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeAudio.reset()
        FakeAudioContext.instances = []
        vi.stubGlobal("Audio", FakeAudio)
        vi.stubGlobal("AudioContext", FakeAudioContext)
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
        )
        setVisibility("visible")
    })
    afterEach(() => {
        cleanup()
        for (const instance of mixers.splice(0)) instance.dispose()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        Reflect.deleteProperty(navigator, "userActivation")
    })

    it("leaves exactly one owned mixer after StrictMode commits and none after unmount", () => {
        const view = render(
            <StrictMode>
                <ReaderMixerProvider options={{ routing: "web-audio" }}>
                    <Consumer />
                </ReaderMixerProvider>
            </StrictMode>
        )
        expect(view.container.textContent).toBe("ready")
        expect(FakeAudioContext.instances.filter((ctx) => ctx.state !== "closed")).toHaveLength(1)
        view.unmount()
        expect(FakeAudioContext.instances.every((ctx) => ctx.state === "closed")).toBe(true)
    })

    it("does not create audio resources in a discarded Suspense render", () => {
        render(
            <Suspense fallback="waiting">
                <ReaderMixerProvider options={{ routing: "web-audio" }}>
                    <Consumer />
                </ReaderMixerProvider>
                <Discarded />
            </Suspense>
        )
        expect(FakeAudioContext.instances).toHaveLength(0)
        expect(FakeAudio.created).toHaveLength(0)
    })

    it("keeps caller-owned mixers alive when their provider unmounts", () => {
        const instance = mixer()
        const view = render(
            <ReaderMixerProvider mixer={instance}>
                <Consumer />
            </ReaderMixerProvider>
        )
        view.unmount()
        expect(instance.isDisposed()).toBe(false)
    })

    it("shares a context with narration and sprites without an idle mixer suspending their playback", async () => {
        const instance = mixer()
        const backend = new WebAudioBackend({
            requested: "webaudio",
            active: "webaudio",
            didFallback: false,
            capabilities: WEBAUDIO_CAPABILITIES,
        })
        const sprite = new AudioSpriteEngine()
        try {
            await sprite.load({ src: "pack.mp3", clips: { rain: { offset: 0, duration: 2 } } })
            backend.setSource("voice.mp3")
            await backend.play()
            const id = sprite.play("rain", { loop: true })!
            expect(FakeAudioContext.instances).toHaveLength(1)
            const ctx = FakeAudioContext.instances[0]
            instance.setMasterEnabled(false)
            await flushMicrotasks()
            expect(ctx.state).toBe("running")
            backend.pause()
            await flushMicrotasks()
            expect(ctx.state).toBe("running")
            instance.dispose()
            expect(ctx.state).toBe("running")
            sprite.stop(id)
            await flushMicrotasks()
            expect(ctx.state).toBe("suspended")
            backend.destroy()
            expect(ctx.state).toBe("suspended")
            sprite.dispose()
            expect(ctx.state).toBe("closed")
        } finally {
            backend.destroy()
            sprite.dispose()
        }
    })

    it("retains at most eight idle cue URLs and two elements per URL, disconnecting and reconnecting captured sinks", async () => {
        const instance = mixer()
        for (let url = 0; url < 9; url++) {
            for (let copy = 0; copy < 3; copy++) instance.playCue(`${CUE}?${url}`)
            await flushMicrotasks()
            for (const element of FakeAudio.withSrc(`${CUE}?${url}`)) element.dispatch("ended")
        }
        expect(FakeAudio.withSrc(`${CUE}?0`)).toHaveLength(0)
        for (let url = 1; url < 9; url++) expect(FakeAudio.withSrc(`${CUE}?${url}`)).toHaveLength(2)
        const ctx = FakeAudioContext.instances[0]
        expect(ctx.mediaSources.every((source) => source.connections.length === 0)).toBe(true)
        const captured = ctx.routedElements.length
        const reused = FakeAudio.withSrc(`${CUE}?8`)[0]
        instance.playCue(`${CUE}?8`)
        await flushMicrotasks()
        expect(reused.paused).toBe(false)
        expect(ctx.routedElements).toHaveLength(captured)
        expect(ctx.mediaSources.filter((source) => source.connections.length)).toHaveLength(1)
    })

    it("preloads a bounded chapter cache with consistent CORS, no slot or session demand, and no reload at trigger time", async () => {
        const instance = mixer()
        instance.preloadCues([
            CUE,
            ` ${CUE} `,
            ...Array.from({ length: 12 }, (_, index) => `${CUE}?${index}`),
        ])
        expect(FakeAudio.created.filter((audio) => audio.src)).toHaveLength(8)
        expect(instance.getState().activeCues).toBe(0)
        const ctx = FakeAudioContext.instances[0]
        expect(ctx.resumeCalls).toBe(0)
        expect(ctx.routedElements).toHaveLength(0)
        const loaded = FakeAudio.withSrc(CUE)[0]
        expect(loaded.crossOrigin).toBe("anonymous")
        expect(loaded.loadCalls).toBe(1)
        loaded.readyState = 4
        FakeAudio.playBehavior = (audio) =>
            audio.readyState >= 4 ? Promise.resolve() : new Promise<void>(() => {})
        expect(instance.playCue(CUE)).toBe(true)
        await flushMicrotasks()
        expect(loaded.paused).toBe(false)
        expect(loaded.loadCalls).toBe(1)
        await vi.advanceTimersByTimeAsync(1500)
        expect(instance.getState().activeCues).toBe(1)
        instance.playCue(`${CUE}?cold`)
        await vi.advanceTimersByTimeAsync(1500)
        expect(FakeAudio.withSrc(`${CUE}?cold`)).toHaveLength(0)
    })

    it("primes preloaded cue elements on touchend so a later trigger needs no new tap", async () => {
        setUserActivation(false)
        const instance = mixer()
        instance.preloadCues([CUE])
        const loaded = FakeAudio.withSrc(CUE)[0]
        document.dispatchEvent(new Event("pointerdown"))
        expect(loaded.loadActivations).toEqual([false])
        setUserActivation(true)
        document.dispatchEvent(new Event("touchend"))
        expect(loaded.loadActivations).toEqual([false, true])
        setUserActivation(false)
        FakeAudio.playBehavior = (audio) =>
            audio.loadActivations.includes(true)
                ? Promise.resolve()
                : Promise.reject(new DOMException("Needs activation", "NotAllowedError"))
        expect(instance.playCue(CUE)).toBe(true)
        await flushMicrotasks()
        expect(loaded.paused).toBe(false)
        expect(instance.getState().activeCues).toBe(1)
    })

    it("keeps audio and preference subscribers immediate while coalescing persistence callbacks", async () => {
        const save = vi.fn()
        const live = vi.fn()
        const instance = mixer({ routing: "element", onPreferencesChange: save })
        instance.subscribePreferences(live)
        instance.playSoundscape({
            id: "rain",
            title: "Rain",
            artist: "",
            audioFile: "https://audio.test/rain.mp3",
        })
        await flushMicrotasks()
        await vi.advanceTimersByTimeAsync(40)
        for (const level of [0.3, 0.5, 0.7]) {
            instance.setLayerLevel("soundscapes", level)
            expect(FakeAudio.withSrc("https://audio.test/rain.mp3")[0].volume).toBe(level)
            await vi.advanceTimersByTimeAsync(100)
        }
        expect(live).toHaveBeenCalledTimes(3)
        expect(save).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(200)
        expect(save).toHaveBeenCalledTimes(1)
        expect(save.mock.calls[0][0].layers.soundscapes.level).toBe(0.7)
    })

    it("flushes pending persistence on pagehide and dispose once, with an opt-out for immediate callbacks", async () => {
        const save = vi.fn()
        const instance = mixer({ onPreferencesChange: save })
        instance.setLayerLevel("cues", 0.4)
        window.dispatchEvent(new Event("pagehide"))
        expect(save).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(500)
        expect(save).toHaveBeenCalledTimes(1)
        instance.setLayerLevel("cues", 0.6)
        instance.dispose()
        expect(save).toHaveBeenCalledTimes(2)
        expect(vi.getTimerCount()).toBe(0)
        const immediate = mixer({ onPreferencesChange: save, preferencesDebounceMs: 0 })
        immediate.setLayerLevel("cues", 0.5)
        expect(save).toHaveBeenCalledTimes(3)
    })
})
