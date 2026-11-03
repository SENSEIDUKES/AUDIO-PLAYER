// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReaderMixer, type ReaderMixer } from "../ReaderMixer"
import { ElementSpriteEngine } from "../ElementSpriteEngine"
import {
    FakeAudio,
    FakeAudioContext,
    flushMicrotasks,
    setVisibility,
    setUserActivation,
} from "./fakeMedia"
import type { PluginSoundScope } from "../../core/plugins/PluginInterface"

const pack = {
    src: "/pack.wav",
    clips: { chime: { offset: 1, duration: 1 }, loop: { offset: 2, duration: 1, loop: true } },
}
const owned: ReaderMixer[] = []
function mixer(options: Parameters<typeof createReaderMixer>[0] = {}) {
    const instance = createReaderMixer({ idleTimeoutMs: null, ...options })
    owned.push(instance)
    return instance
}
async function loadElement(scope: PluginSoundScope, name = "named") {
    const pending = scope.loadSpritePack(pack, name)
    await flushMicrotasks()
    const element = FakeAudio.withSrc(pack.src).slice(-1)[0]!
    element.duration = 4
    element.dispatch("loadedmetadata")
    element.readyState = 2
    element.dispatch("loadeddata")
    await pending
    return element
}
beforeEach(() => {
    vi.useFakeTimers()
    FakeAudio.reset()
    FakeAudioContext.instances = []
    vi.stubGlobal("Audio", FakeAudio)
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(new Uint8Array(12)))
    )
    setVisibility("visible")
    setUserActivation(true)
})
afterEach(() => {
    for (const instance of owned.splice(0)) instance.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("reader-owned sprite scopes", () => {
    it("uses the cue bus and one concurrency cap for native sprites and URL cues", async () => {
        const instance = mixer({ routing: "web-audio", maxConcurrentCues: 2 })
        const scope = instance.createCueSoundScope()
        await scope.loadSpritePack(pack, "named")
        const id = scope.playSprite("chime", { pack: "named" })!
        expect(id).toBeTruthy()
        expect(instance.playCue("/other.wav")).toBe(true)
        expect(scope.playSprite("chime", { pack: "named" })).toBeNull()
        expect(scope.getLastSkipReason?.()).toBe("concurrency-limit")
        expect(instance.getState().activeCues).toBe(2)
        const ctx = FakeAudioContext.instances[0]
        const bus = ctx.buses()[2]
        expect(ctx.gains.some((gain) => gain.connections.includes(bus))).toBe(true)
        instance.setLayerLevel("cues", 0.2)
        expect(bus.gain.value).toBeCloseTo(0.2)
        scope.stopSprite(id)
        expect(instance.getState().activeCues).toBe(1)
        instance.stopCues()
        expect(instance.getState().activeCues).toBe(0)
        expect(scope.playSprite("chime", { pack: "named" })).toBeTruthy()
    })

    it("keeps identically named clips and stops independent across named packs", async () => {
        const instance = mixer({ routing: "web-audio" })
        const scope = instance.createCueSoundScope()
        await scope.loadSpritePack(pack, "first")
        await scope.loadSpritePack(
            { ...pack, src: "/other.wav", clips: { chime: { offset: 2, duration: 1 } } },
            "second"
        )
        const first = scope.playSprite("chime", { pack: "first", loop: true })!
        const second = scope.playSprite("chime", { pack: "second", loop: true })!
        expect(FakeAudioContext.instances[0].sources.map((source) => source.loopStart)).toEqual([
            1, 2,
        ])
        scope.stopSprite(first)
        expect(instance.getState().activeCues).toBe(1)
        scope.stopSprite(second)
        expect(instance.getState().activeCues).toBe(0)
    })

    it("master, visibility, and scope disposal cannot revive stopped native sprites", async () => {
        const instance = mixer({ routing: "web-audio" })
        const scope = instance.createCueSoundScope()
        await scope.loadSpritePack(pack, "named")
        const voiceBefore = instance.getState().preferences.layers.voice
        scope.playSprite("loop", { pack: "named" })
        instance.setMasterEnabled(false)
        expect(instance.getState().activeCues).toBe(0)
        expect(scope.playSprite("chime", { pack: "named" })).toBeNull()
        expect(instance.getState().preferences.layers.voice).toEqual(voiceBefore)
        instance.setMasterEnabled(true)
        scope.playSprite("loop", { pack: "named" })
        setVisibility("hidden")
        expect(instance.getState().activeCues).toBe(0)
        expect(scope.playSprite("chime", { pack: "named" })).toBeNull()
        setVisibility("visible")
        expect(instance.getState().activeCues).toBe(0)
        scope.dispose()
        scope.dispose()
        expect(instance.isDisposed()).toBe(false)
        expect(scope.playSprite("chime", { pack: "named" })).toBeNull()
    })

    it.each(["idle", "sleep"] as const)(
        "stops sprite loops on %s and skips new cues until resumed",
        async (policy) => {
            const instance = mixer({
                routing: "web-audio",
                idleTimeoutMs: policy === "idle" ? 50 : null,
                idleFadeMs: 0,
                sleepFadeMs: 0,
                sleepTimerChoices: [
                    { id: "quick", label: "Short", kind: "duration", durationMs: 50 },
                ],
            })
            const scope = instance.createCueSoundScope()
            await scope.loadSpritePack(pack, "named")
            scope.playSprite("loop", { pack: "named" })
            if (policy === "sleep") instance.setSleepTimer("quick")
            await vi.advanceTimersByTimeAsync(1100)
            expect(instance.getState().activeCues).toBe(0)
            expect(scope.playSprite("chime", { pack: "named" })).toBeNull()
            expect(scope.getLastSkipReason?.()).toBe("session-inactive")
            if (policy === "idle") document.dispatchEvent(new Event("scroll"))
            else instance.resumeAudio()
            expect(scope.playSprite("chime", { pack: "named" })).toBeTruthy()
        }
    )

    it("drops a native cue at the start deadline without starting after a later gesture", async () => {
        const instance = mixer({ routing: "web-audio", cueStartTimeoutMs: 50 })
        const ctx = FakeAudioContext.instances[0]
        ctx.resumeBehavior = "reject"
        const scope = instance.createCueSoundScope(),
            onError = vi.fn(),
            onStarted = vi.fn()
        await scope.loadSpritePack(pack, "named")
        scope.playSprite("chime", { pack: "named", onError, onStarted })
        await vi.advanceTimersByTimeAsync(60)
        expect(onError).toHaveBeenCalledWith("start-timeout")
        expect(instance.getState().activeCues).toBe(0)
        ctx.resumeBehavior = "resolve"
        instance.unlock()
        await flushMicrotasks()
        expect(onStarted).not.toHaveBeenCalled()
    })

    it("plays bounded element segments and returns their concurrency slots", async () => {
        const instance = mixer({ routing: "element", maxConcurrentCues: 1 })
        const scope = instance.createCueSoundScope()
        const element = await loadElement(scope)
        const ended = vi.fn(() => expect(instance.getState().activeCues).toBe(0))
        const id = scope.playSprite("chime", { pack: "named", volume: 0.5, onEnded: ended })
        await flushMicrotasks()
        expect(element.currentTime).toBe(1)
        expect(element.playCalls).toBe(1)
        expect(element.volume).toBeCloseTo(0.375)
        expect(instance.playCue("/other.wav")).toBe(false)
        element.currentTime = 2
        element.dispatch("timeupdate")
        expect(element.paused).toBe(true)
        expect(instance.getState().activeCues).toBe(0)
        expect(ended).toHaveBeenCalledTimes(1)
        scope.stopSprite(id!)
        expect(instance.playCue("/other.wav")).toBe(true)
    })

    it("seeks element loops back to their clip, fades, and cancels on hide", async () => {
        const instance = mixer({ routing: "element" })
        const scope = instance.createCueSoundScope()
        const element = await loadElement(scope)
        const id = scope.playSprite("loop", { pack: "named" })!
        await flushMicrotasks()
        element.currentTime = 3
        element.dispatch("timeupdate")
        await flushMicrotasks()
        expect(element.currentTime).toBe(2)
        expect(element.playCalls).toBe(2)
        scope.fadeSprite(id, 0.2, 100)
        await vi.advanceTimersByTimeAsync(120)
        expect(element.volume).toBeCloseTo(0.15)
        setVisibility("hidden")
        expect(element.paused).toBe(true)
        await vi.advanceTimersByTimeAsync(2000)
        setVisibility("visible")
        expect(element.playCalls).toBe(2)
        expect(instance.getState().activeCues).toBe(0)
    })

    it("restarts a looping element at media end within the permitted duration tolerance", async () => {
        const instance = mixer({ routing: "element", maxConcurrentCues: 1 })
        const scope = instance.createCueSoundScope()
        const pending = scope.loadSpritePack(
            { ...pack, clips: { tail: { offset: 2, duration: 2.008, loop: true } } },
            "named"
        )
        await flushMicrotasks()
        const element = FakeAudio.withSrc(pack.src).slice(-1)[0]
        element.duration = 4
        element.dispatch("loadedmetadata")
        element.readyState = 2
        element.dispatch("loadeddata")
        await pending
        const id = scope.playSprite("tail", { pack: "named" })!
        await flushMicrotasks()
        element.currentTime = 4
        element.dispatch("ended")
        await flushMicrotasks()
        expect(element.currentTime).toBe(2)
        expect(element.playCalls).toBe(2)
        expect(element.paused).toBe(false)
        expect(instance.getState().activeCues).toBe(1)
        scope.stopSprite(id)
        expect(instance.playCue("/next.wav")).toBe(true)
    })

    it("rejects a failed element seek without playing the file from zero", async () => {
        const instance = mixer({ routing: "element" })
        const scope = instance.createCueSoundScope()
        const element = await loadElement(scope),
            onError = vi.fn()
        Object.defineProperty(element, "currentTime", {
            get: () => 0,
            set: () => {
                throw new Error("seek")
            },
        })
        expect(scope.playSprite("chime", { pack: "named", onError })).toBeNull()
        expect(onError).toHaveBeenCalledWith("seek-failed")
        expect(element.playCalls).toBe(0)
        expect(instance.getState().activeCues).toBe(0)
    })

    it("auto retries failed decoded packs as element clips", async () => {
        const instance = mixer({ routing: "auto" })
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS")))
        const scope = instance.createCueSoundScope()
        const element = await loadElement(scope)
        expect(scope.playSprite("chime", { pack: "named" })).toBeTruthy()
        await flushMicrotasks()
        expect(element.playCalls).toBe(1)
        expect(instance.getState().layers.cues.routing).toBe("element")
        expect(element.crossOrigin).toBeNull()
    })

    it("cancels element loading and never revives a late play promise", async () => {
        const engine = new ElementSpriteEngine({ startTimeoutMs: 50, onActiveCountChange: vi.fn() })
        const loading = engine.load(pack)
        await flushMicrotasks()
        engine.dispose()
        await expect(loading).rejects.toMatchObject({ name: "AbortError" })
        const instance = mixer({ routing: "element" }),
            scope = instance.createCueSoundScope()
        const element = await loadElement(scope)
        let finish!: () => void
        FakeAudio.playBehavior = () =>
            new Promise<void>((resolve) => {
                finish = resolve
            })
        scope.playSprite("chime", { pack: "named" })
        scope.dispose()
        finish()
        await flushMicrotasks()
        expect(element.paused).toBe(true)
        expect(instance.getState().activeCues).toBe(0)
    })
})
