/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AudioBackend } from "../AudioBackend"
import { createAudioBackend } from "../AudioBackendFactory"
import { sharedAudioBufferCache, sharedAudioStorageCache } from "../audioCaches"
import { FakeAudioContext } from "../../../narrative/__tests__/fakeMedia"

const backends = new Set<AudioBackend>()
let audio: HTMLAudioElement

function createBackend(kind: "html5" | "webaudio" = "webaudio") {
    const backend = createAudioBackend(kind, { audioRef: { current: audio } })
    backends.add(backend)
    return backend
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: Error) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

beforeEach(() => {
    audio = document.createElement("audio")
    FakeAudioContext.instances = []
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(new Uint8Array([1])))
    )
    vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
    vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
        this: HTMLMediaElement
    ) {
        this.dispatchEvent(new Event("play"))
        return Promise.resolve()
    })
})

afterEach(() => {
    for (const backend of backends) backend.destroy()
    backends.clear()
    sharedAudioBufferCache.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("backend selection", () => {
    it.each(["window", "AudioContext", "fetch"])("falls back when %s is unavailable", (missing) => {
        vi.stubGlobal(missing, undefined)
        const backend = createBackend()
        expect(backend.getInfo()).toMatchObject({
            requested: "webaudio",
            active: "html5",
            didFallback: true,
            fallbackReason: expect.any(String),
            capabilities: { stereoPanning: false },
        })
    })

    it("supports the prefixed AudioContext constructor", () => {
        vi.stubGlobal("AudioContext", undefined)
        vi.stubGlobal("webkitAudioContext", FakeAudioContext)
        expect(createBackend().getInfo()).toMatchObject({ active: "webaudio", didFallback: false })
    })

    it("does not probe or construct Web Audio for an HTML5 request", () => {
        const ctor = vi.fn(function () {
            throw new Error("must not construct")
        })
        vi.stubGlobal("AudioContext", ctor)
        expect(createBackend("html5").getInfo()).toMatchObject({
            requested: "html5",
            active: "html5",
            didFallback: false,
        })
        expect(ctor).not.toHaveBeenCalled()
        expect(console.warn).not.toHaveBeenCalled()
    })
})

describe("runtime context fallback", () => {
    it("preserves settings and listeners when context construction fails", async () => {
        vi.stubGlobal(
            "AudioContext",
            vi.fn(function () {
                throw new DOMException("Context quota exhausted", "NotSupportedError")
            })
        )
        const backend = createBackend()
        const played = vi.fn()
        const removed = vi.fn()
        backend.addEventListener("play", played)
        backend.addEventListener("play", removed)
        backend.removeEventListener("play", removed)
        backend.setSource("track.mp3")
        backend.setVolume(0.6)
        backend.setMuted(true)
        backend.setOutputGain?.(0.5)
        backend.setRate(1.75)
        backend.setLoop(true)
        const getInfo = backend.getInfo
        const setVolume = backend.setVolume

        await backend.play()
        expect(backend.kind).toBe("html5")
        expect(backend.getInfo()).toMatchObject({
            requested: "webaudio",
            active: "html5",
            didFallback: true,
            fallbackReason: expect.stringContaining("quota"),
        })
        expect(backend.getMediaElement()).toBe(audio)
        expect(audio.getAttribute("src")).toBe("track.mp3")
        expect(audio.volume).toBeCloseTo(0.3)
        expect(audio.muted).toBe(true)
        expect(audio.playbackRate).toBe(1.75)
        expect(audio.loop).toBe(true)
        expect(played).toHaveBeenCalledOnce()
        expect(removed).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
        setVolume(0.2)
        expect(audio.volume).toBeCloseTo(0.1)
        expect(getInfo().active).toBe("html5")
        await backend.play()
        expect(played).toHaveBeenCalledTimes(2)
        expect(console.warn).toHaveBeenCalledOnce()
    })

    it.each(["reject", "closed"])("falls back when resume %s", async (failure) => {
        vi.stubGlobal(
            "AudioContext",
            class extends FakeAudioContext {
                override resume() {
                    if (failure === "reject")
                        return Promise.reject(
                            new DOMException("Cannot resume", "InvalidStateError")
                        )
                    this.state = "closed"
                    return Promise.resolve()
                }
            }
        )
        const backend = createBackend()
        backend.setSource("track.mp3")
        await backend.play()
        expect(backend.getInfo()).toMatchObject({ active: "html5", didFallback: true })
        expect(audio.play).toHaveBeenCalledOnce()
        expect(FakeAudioContext.instances[0].state).toBe("closed")
    })

    it("recovers a passive load without evicting healthy stored audio or emitting a terminal error", async () => {
        vi.stubGlobal(
            "AudioContext",
            class extends FakeAudioContext {
                override createPanner(): ReturnType<FakeAudioContext["createPanner"]> {
                    throw new DOMException("Node creation refused", "InvalidStateError")
                }
            }
        )
        vi.mocked(sharedAudioStorageCache.getArrayBuffer).mockResolvedValue(new ArrayBuffer(4))
        const remove = vi.spyOn(sharedAudioStorageCache, "delete").mockResolvedValue()
        const backend = createBackend()
        const error = vi.fn()
        backend.addEventListener("error", error)
        backend.setSource("offline.mp3")
        backend.load()
        await vi.waitFor(() => expect(backend.getInfo().active).toBe("html5"))
        expect(audio.load).toHaveBeenCalledOnce()
        expect(audio.play).not.toHaveBeenCalled()
        expect(remove).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
        expect(FakeAudioContext.instances[0].state).toBe("closed")
    })

    it.each(["denied", "suspended"])(
        "keeps ordinary autoplay blocking (%s) recoverable in Web Audio",
        async (failure) => {
            vi.stubGlobal(
                "AudioContext",
                class extends FakeAudioContext {
                    constructor() {
                        super()
                        this.resumeBehavior = () =>
                            failure === "denied"
                                ? Promise.reject(
                                      new DOMException("Tap required", "NotAllowedError")
                                  )
                                : Promise.resolve()
                    }
                }
            )
            const backend = createBackend()
            backend.setSource("track.mp3")
            await expect(backend.play()).rejects.toMatchObject({ name: "NotAllowedError" })
            expect(backend.getInfo()).toMatchObject({ active: "webaudio", didFallback: false })
            expect(audio.play).not.toHaveBeenCalled()
            FakeAudioContext.instances[0].resumeBehavior = "resolve"
            await backend.play()
            expect(backend.isPaused()).toBe(false)
        }
    )

    it.each(["pause", "source", "destroy"])(
        "does not fall back after %s cancels a pending resume",
        async (action) => {
            const resume = deferred<void>()
            vi.stubGlobal(
                "AudioContext",
                class extends FakeAudioContext {
                    constructor() {
                        super()
                        this.resumeBehavior = () => resume.promise
                    }
                }
            )
            const backend = createBackend()
            backend.setSource("track.mp3")
            const playing = backend.play()
            if (action === "pause") backend.pause()
            else if (action === "source") backend.setSource("other.mp3")
            else backend.destroy()
            resume.reject(new Error("context failed after cancellation"))
            await expect(playing).rejects.toMatchObject({ name: "AbortError" })
            expect(backend.getInfo()).toMatchObject({ active: "webaudio", didFallback: false })
            expect(audio.play).not.toHaveBeenCalled()
        }
    )

    it.each(["network", "decode"])("does not switch backend for a %s failure", async (failure) => {
        if (failure === "network")
            vi.mocked(fetch).mockRejectedValue(new TypeError("Network failed"))
        else
            vi.spyOn(FakeAudioContext.prototype, "decodeAudioData").mockRejectedValue(
                new Error("Unsupported codec")
            )
        const backend = createBackend()
        backend.setSource("broken.mp3")
        await expect(backend.play()).rejects.toMatchObject({ name: "NotSupportedError" })
        expect(backend.getInfo()).toMatchObject({ active: "webaudio", didFallback: false })
        expect(backend.getError()).toBe(failure)
        expect(audio.play).not.toHaveBeenCalled()
    })

    it("restores position after fallback metadata and supports teardown/revival", async () => {
        const backend = createBackend()
        sharedAudioBufferCache.set("track.mp3", { duration: 30 } as AudioBuffer)
        backend.setSource("track.mp3")
        await backend.play()
        backend.pause()
        backend.setCurrentTime(7)
        FakeAudioContext.instances[0].resumeBehavior = "reject"
        await backend.play()
        expect(backend.getInfo().didFallback).toBe(true)
        Object.defineProperty(audio, "duration", { configurable: true, value: 30 })
        audio.dispatchEvent(new Event("loadedmetadata"))
        expect(backend.getCurrentTime()).toBe(7)
        backend.destroy()
        backend.destroy()
        backend.setSource("next.mp3")
        await backend.play()
        expect(audio.getAttribute("src")).toBe("next.mp3")
        expect(backend.getInfo().active).toBe("html5")
    })

    it("honors Pause from a synchronous fallback load listener", async () => {
        vi.stubGlobal(
            "AudioContext",
            vi.fn(function () {
                throw new Error("context failed")
            })
        )
        const backend = createBackend()
        backend.setSource("track.mp3")
        backend.addEventListener("loadstart", () => backend.pause())
        vi.mocked(audio.load).mockImplementation(() => audio.dispatchEvent(new Event("loadstart")))
        await expect(backend.play()).rejects.toMatchObject({ name: "AbortError" })
        expect(audio.play).not.toHaveBeenCalled()
        expect(backend.getInfo().active).toBe("html5")
    })

    it("keeps the Web Audio failure visible when an advanced host has no mounted fallback element", async () => {
        vi.stubGlobal(
            "AudioContext",
            vi.fn(function () {
                throw new Error("context failed")
            })
        )
        const backend = createAudioBackend("webaudio", { audioRef: { current: null } })
        backends.add(backend)
        backend.setSource("track.mp3")
        await expect(backend.play()).rejects.toMatchObject({ name: "NotSupportedError" })
        expect(backend.getInfo()).toMatchObject({ active: "webaudio", didFallback: false })
    })

    it("forwards the documented spatial API through the factory facade", async () => {
        const backend = createBackend()
        backend.setSource("spatial.mp3")
        backend.setPos(3, 0, -2)
        backend.setLiteMode(true)
        await backend.play()
        expect(backend.supportsSpatial()).toBe(true)
        expect(backend.getInfo().capabilities.stereoPanning).toBe(true)
        backend.setStereo(0.3)
        expect(backend.getStereo()).toBe(0.3)
        expect(backend.getPos()).toEqual([3, 0, -2])
        expect(backend.isLiteMode()).toBe(true)
        expect(backend.getAudioContext?.()).not.toBeNull()
    })
})
