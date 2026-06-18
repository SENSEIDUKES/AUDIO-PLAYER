import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    AudioStorageCache,
    HTML5AudioPool,
    PersistentAudioCache,
    LRUAudioCache,
    sharedAudioBufferCache,
    sharedAudioStorageCache,
} from "../audioCaches"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../WebAudioBackend"

function fakeBuffer(id: string): AudioBuffer {
    return { id } as unknown as AudioBuffer
}

const originalAudio = globalThis.Audio
const originalCaches = globalThis.caches
const originalFetch = globalThis.fetch
const originalWindow = (globalThis as { window?: Window }).window

afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(globalThis, "Audio", {
        configurable: true,
        writable: true,
        value: originalAudio,
    })
    Object.defineProperty(globalThis, "caches", {
        configurable: true,
        writable: true,
        value: originalCaches,
    })
    Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch,
    })
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: originalWindow,
    })
    sharedAudioBufferCache.clear()
})

describe("LRUAudioCache", () => {
    it("moves cache hits to the most-recently-used position", () => {
        const cache = new LRUAudioCache(2)
        const first = fakeBuffer("first")
        const second = fakeBuffer("second")
        const third = fakeBuffer("third")

        cache.set("one.mp3", first)
        cache.set("two.mp3", second)
        expect(cache.get("one.mp3")).toBe(first)

        cache.set("three.mp3", third)

        expect(cache.get("two.mp3")).toBeNull()
        expect(cache.get("one.mp3")).toBe(first)
        expect(cache.get("three.mp3")).toBe(third)
    })

    it("clears all decoded buffers", () => {
        const cache = new LRUAudioCache(2)
        cache.set("one.mp3", fakeBuffer("first"))

        cache.clear()

        expect(cache.get("one.mp3")).toBeNull()
    })

    it("keeps the default cache bounded across a 20-track playlist", () => {
        const cache = new LRUAudioCache()
        for (let index = 0; index < 20; index += 1) {
            cache.set(`track-${index}.mp3`, fakeBuffer(`track-${index}`))
        }

        expect(cache.get("track-0.mp3")).toBeNull()
        expect(cache.get("track-7.mp3")).toBeNull()
        expect(cache.get("track-8.mp3")).not.toBeNull()
        expect(cache.get("track-19.mp3")).not.toBeNull()
    })
})

describe("AudioStorageCache", () => {
    it("provides the PersistentAudioCache implementation name from the Definition of Done", () => {
        expect(new PersistentAudioCache()).toBeInstanceOf(PersistentAudioCache)
        expect(new AudioStorageCache()).toBeInstanceOf(PersistentAudioCache)
    })

    it("reads cached audio as an ArrayBuffer", async () => {
        const data = new ArrayBuffer(4)
        const match = vi.fn(async () => new Response(data))
        const open = vi.fn(async () => ({ match }))
        Object.defineProperty(globalThis, "caches", {
            configurable: true,
            writable: true,
            value: { open },
        })

        const cache = new AudioStorageCache()

        expect(await cache.getArrayBuffer("song.mp3")).toEqual(data)
        expect(open).toHaveBeenCalledWith("seihouse-audio-vault-v1")
        expect(match).toHaveBeenCalledWith("song.mp3")
    })

    it("fails storage writes gracefully", async () => {
        const put = vi.fn(async () => {
            throw new Error("quota")
        })
        const open = vi.fn(async () => ({ put }))
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        Object.defineProperty(globalThis, "caches", {
            configurable: true,
            writable: true,
            value: { open },
        })

        const cache = new AudioStorageCache()

        await expect(
            cache.putArrayBuffer("song.wav", new ArrayBuffer(4))
        ).resolves.toBeUndefined()
        expect(warn).toHaveBeenCalled()
    })
})

describe("HTML5AudioPool", () => {
    it("releases elements by clearing src and reloading", () => {
        const audio = {
            paused: true,
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn(),
            preload: "",
            src: "song.mp3",
        } as unknown as HTMLAudioElement
        Object.defineProperty(globalThis, "Audio", {
            configurable: true,
            writable: true,
            value: vi.fn(function AudioMock() {
                return audio
            }),
        })

        const pool = new HTML5AudioPool(1)
        const acquired = pool.acquire()
        pool.release(acquired)

        expect(acquired.src).toBe("")
        expect(audio.pause).toHaveBeenCalled()
        expect(audio.removeAttribute).toHaveBeenCalledWith("src")
        expect(audio.load).toHaveBeenCalled()

    })
})

class FakeWebAudioNode {
    gain = { value: 1 }
    pan = { value: 0 }
    positionX = { value: 0 }
    positionY = { value: 0 }
    positionZ = { value: 0 }
    orientationX = { value: 0 }
    orientationY = { value: 0 }
    orientationZ = { value: 0 }
    panningModel = "HRTF"
    distanceModel = "inverse"
    refDistance = 1
    maxDistance = 10000
    rolloffFactor = 1
    coneInnerAngle = 360
    coneOuterAngle = 360
    coneOuterGain = 0
    connect = vi.fn()
    disconnect = vi.fn()
}

function installWebAudioContext(
    decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer>
) {
    const context = {
        state: "running" as AudioContextState,
        destination: {},
        currentTime: 0,
        createPanner: vi.fn(() => new FakeWebAudioNode()),
        createGain: vi.fn(() => new FakeWebAudioNode()),
        createStereoPanner: vi.fn(() => new FakeWebAudioNode()),
        createBufferSource: vi.fn(() => new FakeWebAudioNode()),
        decodeAudioData: vi.fn(decodeAudioData),
        resume: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
    }
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: {
            AudioContext: vi.fn(function AudioContextMock() {
                return context
            }),
        },
    })
    return context
}

function createWebAudioBackend(): WebAudioBackend {
    return new WebAudioBackend({
        requested: "webaudio",
        active: "webaudio",
        didFallback: false,
        capabilities: WEBAUDIO_CAPABILITIES,
    })
}

describe("WebAudioBackend cache integration", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        sharedAudioBufferCache.clear()
    })

    it("fetches with CORS mode and only writes persistent cache after decode succeeds", async () => {
        const decoded = fakeBuffer("decoded")
        installWebAudioContext(async () => decoded)
        const put = vi
            .spyOn(sharedAudioStorageCache, "putArrayBuffer")
            .mockResolvedValue()
        const data = new ArrayBuffer(8)
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => data,
        })) as unknown as typeof fetch

        const backend = createWebAudioBackend()
        backend.setSource("https://cdn.example.test/song.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise

        expect(fetch).toHaveBeenCalledWith(
            "https://cdn.example.test/song.mp3",
            expect.objectContaining({ mode: "cors" })
        )
        expect(put).toHaveBeenCalledWith("https://cdn.example.test/song.mp3", data)
        expect(
            sharedAudioBufferCache.get("https://cdn.example.test/song.mp3")
        ).toBe(decoded)
        backend.destroy()
    })

    it("loads previously persisted audio without a network fetch", async () => {
        const decoded = fakeBuffer("persisted")
        const data = new ArrayBuffer(8)
        const context = installWebAudioContext(async () => decoded)
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(data)
        globalThis.fetch = vi.fn() as unknown as typeof fetch

        const backend = createWebAudioBackend()
        backend.setSource("https://cdn.example.test/persisted.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise

        expect(fetch).not.toHaveBeenCalled()
        expect(context.decodeAudioData).toHaveBeenCalledWith(data)
        expect(
            sharedAudioBufferCache.get("https://cdn.example.test/persisted.mp3")
        ).toBe(decoded)
        backend.destroy()
    })

    it("preloads network audio into the shared LRU cache", async () => {
        const decoded = fakeBuffer("preloaded")
        installWebAudioContext(async () => decoded)
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        })) as unknown as typeof fetch

        const backend = createWebAudioBackend()
        backend.preload("https://cdn.example.test/next.mp3")
        const pending = (backend as unknown as {
            preloadPromises: Map<string, Promise<AudioBuffer | null>>
        }).preloadPromises.get("https://cdn.example.test/next.mp3")
        await pending

        expect(
            sharedAudioBufferCache.get("https://cdn.example.test/next.mp3")
        ).toBe(decoded)
        backend.destroy()
    })

    it("does not persist network data when decode fails", async () => {
        installWebAudioContext(async () => {
            throw new Error("corrupt")
        })
        const put = vi
            .spyOn(sharedAudioStorageCache, "putArrayBuffer")
            .mockResolvedValue()
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        })) as unknown as typeof fetch
        const onError = vi.fn()

        const backend = createWebAudioBackend()
        backend.addEventListener("error", onError)
        backend.setSource("https://cdn.example.test/corrupt.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise

        expect(put).not.toHaveBeenCalled()
        expect(
            sharedAudioBufferCache.get("https://cdn.example.test/corrupt.mp3")
        ).toBeNull()
        expect(backend.getError()).toBe("decode")
        expect(onError).toHaveBeenCalled()
        backend.destroy()
    })

    it("clears decoded buffers on destroy", () => {
        const backend = createWebAudioBackend()
        sharedAudioBufferCache.set("song.mp3", fakeBuffer("decoded"))

        backend.destroy()

        expect(sharedAudioBufferCache.get("song.mp3")).toBeNull()
    })
})
