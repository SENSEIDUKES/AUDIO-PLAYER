import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    AudioStorageCache,
    HTML5AudioPool,
    PersistentAudioCache,
    LRUAudioCache,
    sharedAudioBufferCache,
    sharedAudioStorageCache,
} from "../audioCaches"
import {
    configureAudioResources,
    getAudioResourcePolicy,
    getAudioResourceStats,
} from "../audioResources"
import { invalidateAudioCache } from "../audioCaches"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../WebAudioBackend"

function fakeBuffer(id: string): AudioBuffer {
    return { id } as unknown as AudioBuffer
}

function sizedBuffer(bytes: number): AudioBuffer {
    return {
        length: bytes / Float32Array.BYTES_PER_ELEMENT,
        numberOfChannels: 1,
    } as AudioBuffer
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

type LoadingBackend = {
    loadPromise: Promise<void>
    preloadPromises: Map<string, Promise<AudioBuffer | null>>
}

const originalAudio = globalThis.Audio
const originalCaches = globalThis.caches
const originalFetch = globalThis.fetch
const originalWindow = (globalThis as { window?: Window }).window
const backends = new Set<WebAudioBackend>()

afterEach(() => {
    for (const backend of backends) backend.destroy()
    backends.clear()
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
        expect(cache.get("track-15.mp3")).toBeNull()
        expect(cache.get("track-16.mp3")).not.toBeNull()
        expect(cache.get("track-19.mp3")).not.toBeNull()
        expect(cache.getStats().decodedBufferCount).toBe(4)
    })

    it("should track stats and lruOrder correctly", () => {
        const cache = new LRUAudioCache(3)
        const dummyBuffer1 = { length: 44100, numberOfChannels: 2 } as AudioBuffer
        const dummyBuffer2 = { length: 88200, numberOfChannels: 2 } as AudioBuffer

        cache.set("a", dummyBuffer1)
        cache.set("b", dummyBuffer2)

        const stats = cache.getStats()
        expect(stats.decodedBufferCount).toBe(2)
        expect(stats.lruOrder).toEqual(["a", "b"])
        // approx bytes = length * channels * 4
        expect(stats.decodedBufferBytes).toBe(44100 * 2 * 4 + 88200 * 2 * 4)
    })

    it("should update lruOrder on get", () => {
        const cache = new LRUAudioCache(3)
        const dummyBuffer = { length: 1, numberOfChannels: 1 } as AudioBuffer

        cache.set("a", dummyBuffer)
        cache.set("b", dummyBuffer)
        cache.set("c", dummyBuffer)

        expect(cache.getStats().lruOrder).toEqual(["a", "b", "c"])

        cache.get("a")
        expect(cache.getStats().lruOrder).toEqual(["b", "c", "a"])
    })

    it("should setMaxSize and enforce immediately", () => {
        const cache = new LRUAudioCache(3)
        const dummyBuffer = { length: 1, numberOfChannels: 1 } as AudioBuffer

        cache.set("a", dummyBuffer)
        cache.set("b", dummyBuffer)
        cache.set("c", dummyBuffer)

        cache.setMaxSize(1)
        expect(cache.getStats().decodedBufferCount).toBe(1)
        expect(cache.getStats().lruOrder).toEqual(["c"])
    })

    it("should prune unused buffers but keep requested recent count", () => {
        const cache = new LRUAudioCache(5)
        const dummyBuffer = { length: 1, numberOfChannels: 1 } as AudioBuffer

        cache.set("a", dummyBuffer)
        cache.set("b", dummyBuffer) // old, should be evicted
        cache.set("c", dummyBuffer) // active queue (kept)
        cache.set("d", dummyBuffer) // recent 2
        cache.set("e", dummyBuffer) // recent 1

        cache.prune(["c"], 2)

        const stats = cache.getStats()
        expect(stats.lruOrder).toEqual(["c", "d", "e"])
    })

    it("evicts the least-recently-used buffers when the byte budget is exceeded", () => {
        const cache = new LRUAudioCache(10, 12)

        cache.set("a", sizedBuffer(4))
        cache.set("b", sizedBuffer(4))
        cache.get("a")
        cache.set("c", sizedBuffer(8))

        expect(cache.get("b")).toBeNull()
        expect(cache.getStats()).toEqual({
            decodedBufferCount: 2,
            decodedBufferBytes: 12,
            lruOrder: ["a", "c"],
        })
    })

    it("defaults to a 250 MiB decoded-buffer budget", () => {
        const cache = new LRUAudioCache(10)
        const mib = 1024 * 1024

        cache.set("older", sizedBuffer(200 * mib))
        cache.set("newer", sizedBuffer(60 * mib))

        expect(cache.get("older")).toBeNull()
        expect(cache.getStats()).toEqual({
            decodedBufferCount: 1,
            decodedBufferBytes: 60 * mib,
            lruOrder: ["newer"],
        })
    })

    it("updates byte accounting when entries are replaced, deleted, and cleared", () => {
        const cache = new LRUAudioCache(10, 12)

        cache.set("a", sizedBuffer(8))
        cache.set("b", sizedBuffer(4))
        cache.set("a", sizedBuffer(4))
        cache.set("c", sizedBuffer(4))

        expect(cache.getStats().decodedBufferBytes).toBe(12)
        expect(cache.getStats().lruOrder).toEqual(["b", "a", "c"])

        cache.delete("b")
        expect(cache.getStats().decodedBufferBytes).toBe(8)

        cache.clear()
        expect(cache.getStats()).toEqual({
            decodedBufferCount: 0,
            decodedBufferBytes: 0,
            lruOrder: [],
        })
    })

    it("does not retain a single buffer larger than the byte budget", () => {
        const cache = new LRUAudioCache(4, 8)

        cache.set("oversized", sizedBuffer(12))

        expect(cache.get("oversized")).toBeNull()
        expect(cache.getStats().decodedBufferBytes).toBe(0)
    })
})

describe("AudioStorageCache", () => {
    it("provides the PersistentAudioCache implementation name from the Definition of Done", () => {
        expect(new PersistentAudioCache()).toBeInstanceOf(PersistentAudioCache)
        expect(new AudioStorageCache()).toBeInstanceOf(PersistentAudioCache)
    })

    it("reads cached audio as an ArrayBuffer", async () => {
        const data = new ArrayBuffer(4)
        const match = vi.fn(
            async () =>
                new Response(data, { headers: { "X-SEI-Audio-Saved": Date.now().toString() } })
        )
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

        await expect(cache.putArrayBuffer("song.wav", new ArrayBuffer(4))).resolves.toBeUndefined()
        expect(warn).toHaveBeenCalled()
    })

    it("writes the source ArrayBuffer without explicitly cloning it", async () => {
        const put = vi.fn(async (_url: RequestInfo | URL, _response: Response) => undefined)
        const open = vi.fn(async () => ({ put }))
        Object.defineProperty(globalThis, "caches", {
            configurable: true,
            writable: true,
            value: { open },
        })
        const buffer = new Uint8Array([1, 2, 3, 4]).buffer

        await new AudioStorageCache().putArrayBuffer("song.wav", buffer)

        expect(put).toHaveBeenCalledTimes(1)
        const [, response] = put.mock.calls[0]
        expect(response.headers.get("Content-Length")).toBe("4")
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]))
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

    it("should track stats correctly", () => {
        Object.defineProperty(globalThis, "Audio", {
            configurable: true,
            writable: true,
            value: vi.fn(),
        })
        const pool = new HTML5AudioPool(3)
        expect(pool.getStats().preloadElementCount).toBe(0)

        pool.acquire()
        expect(pool.getStats().preloadElementCount).toBe(1)

        pool.acquire()
        expect(pool.getStats().preloadElementCount).toBe(2)
    })

    describe("ownership", () => {
        const createAudio = () =>
            ({
                paused: true,
                pause: vi.fn(),
                removeAttribute: vi.fn(),
                load: vi.fn(),
                preload: "",
                src: "",
            }) as unknown as HTMLAudioElement

        beforeEach(() => {
            Object.defineProperty(globalThis, "Audio", {
                configurable: true,
                writable: true,
                value: vi.fn(function AudioMock() {
                    return createAudio()
                }),
            })
        })

        it("hands paused elements to one owner at a time", () => {
            const pool = new HTML5AudioPool(2)
            const first = pool.acquire()
            const second = pool.acquire()

            expect(second).not.toBe(first)
            first.src = "first.mp3"
            second.src = "second.mp3"
            expect(first.src).toBe("first.mp3")
        })

        it("keeps one owner's preload intact when the other owner releases", () => {
            const pool = new HTML5AudioPool(2)
            const first = pool.acquire()
            const second = pool.acquire()
            first.src = "first.mp3"
            second.src = "second.mp3"

            pool.release(first)
            pool.release(first)

            expect(second.src).toBe("second.mp3")
            expect(second.load).not.toHaveBeenCalled()
            expect(first.src).toBe("")
        })

        it("ignores releases of elements that are not checked out", () => {
            const pool = new HTML5AudioPool(1)
            const audio = pool.acquire()
            pool.release(audio)
            const next = pool.acquire()
            next.src = "next.mp3"
            const stranger = createAudio()
            stranger.src = "stranger.mp3"

            pool.release(stranger)

            expect(stranger.src).toBe("stranger.mp3")
            expect(stranger.load).not.toHaveBeenCalled()
        })

        it("never reuses an owned element when the pool is exhausted", () => {
            const pool = new HTML5AudioPool(1)
            const owned = pool.acquire()
            owned.src = "owned.mp3"
            const overflow = pool.acquire()

            expect(overflow).not.toBe(owned)
            expect(owned.src).toBe("owned.mp3")
            expect(pool.getStats().preloadElementCount).toBe(1)

            pool.release(overflow)
            expect(pool.acquire()).not.toBe(overflow)
        })

        it("reuses released elements", () => {
            const pool = new HTML5AudioPool(1)
            const audio = pool.acquire()
            pool.release(audio)

            expect(pool.acquire()).toBe(audio)
            expect(pool.getStats().preloadElementCount).toBe(1)
        })
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

function installWebAudioContext(decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer>) {
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
    const backend = new WebAudioBackend({
        requested: "webaudio",
        active: "webaudio",
        didFallback: false,
        capabilities: WEBAUDIO_CAPABILITIES,
    })
    backends.add(backend)
    return backend
}

describe("WebAudioBackend cache integration", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        sharedAudioBufferCache.clear()
    })

    it("fetches with CORS mode and only writes persistent cache after decode succeeds", async () => {
        const decoded = fakeBuffer("decoded")
        installWebAudioContext(async () => decoded)
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
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
        expect(sharedAudioBufferCache.get("https://cdn.example.test/song.mp3")).toBe(decoded)
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
        expect(sharedAudioBufferCache.get("https://cdn.example.test/persisted.mp3")).toBe(decoded)
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
        const pending = (
            backend as unknown as {
                preloadPromises: Map<string, Promise<AudioBuffer | null>>
            }
        ).preloadPromises.get("https://cdn.example.test/next.mp3")
        await pending

        expect(sharedAudioBufferCache.get("https://cdn.example.test/next.mp3")).toBe(decoded)
        backend.destroy()
    })

    it("does not persist network data when decode fails", async () => {
        installWebAudioContext(async () => {
            throw new Error("corrupt")
        })
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
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
        expect(sharedAudioBufferCache.get("https://cdn.example.test/corrupt.mp3")).toBeNull()
        expect(backend.getError()).toBe("decode")
        expect(onError).toHaveBeenCalled()
        backend.destroy()
    })

    it.each(["disk", "response", "download", "decode", "persist"])(
        "reuses a preload across a track change while %s is pending",
        async (stage) => {
            const reached = deferred<void>()
            const resume = deferred<void>()
            const wait = async (at: string) => {
                if (stage !== at) return
                reached.resolve()
                await resume.promise
            }
            const decoded = sizedBuffer(16)
            const data = new ArrayBuffer(8)
            const context = installWebAudioContext(async () => {
                await wait("decode")
                return decoded
            })
            vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockImplementation(async () => {
                await wait("disk")
                return null
            })
            const put = vi
                .spyOn(sharedAudioStorageCache, "putArrayBuffer")
                .mockImplementation(async () => wait("persist"))
            globalThis.fetch = vi.fn(async () => {
                await wait("response")
                return {
                    ok: true,
                    arrayBuffer: async () => {
                        await wait("download")
                        return data
                    },
                }
            }) as unknown as typeof fetch
            const backend = createWebAudioBackend()
            const loading = backend as unknown as LoadingBackend
            const url = "https://cdn.example.test/next.mp3"
            backend.setSource("current.mp3")
            backend.preload(url)
            const pending = loading.preloadPromises.get(url)
            await reached.promise

            backend.setSource(url)
            backend.load()
            resume.resolve()
            await Promise.all([pending, loading.loadPromise])

            expect(backend.getDecodedData()).toBe(decoded)
            expect(backend.getError()).toBeNull()
            expect(fetch).toHaveBeenCalledOnce()
            expect(context.decodeAudioData).toHaveBeenCalledOnce()
            expect(put).toHaveBeenCalledExactlyOnceWith(url, data)
            expect(sharedAudioBufferCache.get(url)).toBe(decoded)
            backend.destroy()
        }
    )

    it("keeps active and queued aggressive preloads across track changes", async () => {
        const resume = deferred<void>()
        const decoded = sizedBuffer(16)
        const context = installWebAudioContext(async () => {
            await resume.promise
            return decoded
        })
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        const loading = backend as unknown as LoadingBackend
        const urls = ["next.mp3", "second.mp3", "third.mp3"]
        for (const url of urls) backend.preload(url)
        const pending = [...loading.preloadPromises.values()]
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(2))

        backend.setSource(urls[0])
        backend.load()
        resume.resolve()
        await Promise.all([...pending, loading.loadPromise])
        for (const url of urls) {
            backend.setSource(url)
            backend.load()
            await loading.loadPromise
            expect(backend.getDecodedData()).toBe(decoded)
            expect(sharedAudioBufferCache.get(url)).toBe(decoded)
        }

        expect(fetch).toHaveBeenCalledTimes(3)
        expect(context.decodeAudioData).toHaveBeenCalledTimes(3)
        expect(put).toHaveBeenCalledTimes(3)
        backend.destroy()
    })

    it("keeps a replacement preload registered when the released decode finishes", async () => {
        const oldDecode = deferred<AudioBuffer>()
        const newDecode = deferred<AudioBuffer>()
        const context = installWebAudioContext(() => newDecode.promise)
        context.decodeAudioData.mockReturnValueOnce(oldDecode.promise)
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        const loading = backend as unknown as LoadingBackend
        backend.preload("next.mp3")
        const oldPending = loading.preloadPromises.get("next.mp3")
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())

        backend.releasePreload()
        backend.preload("next.mp3")
        const newPending = loading.preloadPromises.get("next.mp3")
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(2))
        oldDecode.resolve(sizedBuffer(8))
        const oldResult = await oldPending
        const registered = loading.preloadPromises.get("next.mp3")
        const writesBeforeReplacement = put.mock.calls.length

        backend.setSource("next.mp3")
        backend.load()
        const decoded = sizedBuffer(16)
        newDecode.resolve(decoded)
        await loading.loadPromise
        expect(oldResult).toBeNull()
        expect(registered).toBe(newPending)
        expect(writesBeforeReplacement).toBe(0)
        expect(backend.getDecodedData()).toBe(decoded)
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(context.decodeAudioData).toHaveBeenCalledTimes(2)
        expect(put).toHaveBeenCalledOnce()
        backend.destroy()
    })

    it("does not adopt a preload after its loading track has been replaced", async () => {
        const pendingDecode = deferred<AudioBuffer>()
        const active = sizedBuffer(16)
        const context = installWebAudioContext(async () => active)
        context.decodeAudioData.mockReturnValueOnce(pendingDecode.promise)
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        const loading = backend as unknown as LoadingBackend
        const canplay = vi.fn()
        backend.addEventListener("canplay", canplay)
        backend.preload("next.mp3")
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())
        backend.setSource("next.mp3")
        backend.load()
        const adopted = loading.loadPromise
        backend.setSource("other.mp3")
        backend.load()
        await loading.loadPromise

        const preloaded = sizedBuffer(8)
        pendingDecode.resolve(preloaded)
        await adopted
        expect(backend.getDecodedData()).toBe(active)
        expect(canplay).toHaveBeenCalledOnce()
        expect(sharedAudioBufferCache.get("next.mp3")).toBe(preloaded)
        backend.destroy()
    })

    it("retries a failed adopted preload through the normal load path", async () => {
        const pendingDecode = deferred<AudioBuffer>()
        const decoded = sizedBuffer(16)
        const context = installWebAudioContext(async () => decoded)
        context.decodeAudioData.mockReturnValueOnce(pendingDecode.promise)
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        const onError = vi.fn()
        backend.addEventListener("error", onError)
        backend.preload("next.mp3")
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())
        backend.setSource("next.mp3")
        backend.load()
        pendingDecode.reject(new Error("preload failed"))
        await (backend as unknown as LoadingBackend).loadPromise

        expect(backend.getDecodedData()).toBe(decoded)
        expect(backend.getError()).toBeNull()
        expect(onError).not.toHaveBeenCalled()
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(context.decodeAudioData).toHaveBeenCalledTimes(2)
        expect(put).toHaveBeenCalledOnce()
        backend.destroy()
    })

    it.each(["releasePreload", "destroy"] as const)(
        "%s cancels a preload decode without caching its result",
        async (action) => {
            const pendingDecode = deferred<AudioBuffer>()
            const context = installWebAudioContext(() => pendingDecode.promise)
            vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
            const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
            globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
            const backend = createWebAudioBackend()
            backend.preload("next.mp3")
            const pending = (backend as unknown as LoadingBackend).preloadPromises.get("next.mp3")
            await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())

            backend[action]()
            pendingDecode.resolve(sizedBuffer(16))
            expect(await pending).toBeNull()
            expect(sharedAudioBufferCache.has("next.mp3")).toBe(false)
            expect(put).not.toHaveBeenCalled()
            backend.destroy()
        }
    )

    it("preserves other players' decoded buffers until the last cache owner is destroyed", () => {
        const context = installWebAudioContext(async () => sizedBuffer(16))
        globalThis.fetch = vi.fn()
        const decoded = sizedBuffer(16)
        sharedAudioBufferCache.set("song.mp3", decoded)
        const first = createWebAudioBackend()
        const second = createWebAudioBackend()
        for (const backend of [first, second]) {
            backend.setSource("song.mp3")
            backend.load()
        }

        first.destroy()
        first.destroy()
        expect(first.getDecodedData()).toBeNull()
        expect(second.getDecodedData()).toBe(decoded)
        expect(sharedAudioBufferCache.get("song.mp3")).toBe(decoded)
        second.load()
        expect(second.getDecodedData()).toBe(decoded)
        expect(fetch).not.toHaveBeenCalled()
        expect(context.decodeAudioData).not.toHaveBeenCalled()

        second.destroy()
        expect(sharedAudioBufferCache.getStats().decodedBufferCount).toBe(0)
    })

    it("retains cached preload hits and reacquires cache ownership after revival", async () => {
        const decoded = sizedBuffer(16)
        const context = installWebAudioContext(async () => decoded)
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const first = createWebAudioBackend()
        const second = createWebAudioBackend()
        first.preload("song.mp3")
        await (first as unknown as LoadingBackend).preloadPromises.get("song.mp3")
        second.preload("song.mp3")
        first.destroy()
        expect(sharedAudioBufferCache.get("song.mp3")).toBe(decoded)

        first.setSource("song.mp3")
        first.load()
        second.destroy()
        expect(sharedAudioBufferCache.get("song.mp3")).toBe(decoded)
        expect(first.getDecodedData()).toBe(decoded)
        expect(fetch).toHaveBeenCalledOnce()
        expect(context.decodeAudioData).toHaveBeenCalledOnce()
        first.destroy()
        expect(sharedAudioBufferCache.getStats().decodedBufferCount).toBe(0)
    })

    it("does not let an unused backend evict a live player's cache", () => {
        const decoded = sizedBuffer(16)
        sharedAudioBufferCache.set("song.mp3", decoded)
        const active = createWebAudioBackend()
        active.setSource("song.mp3")
        active.load()

        createWebAudioBackend().destroy()
        expect(sharedAudioBufferCache.get("song.mp3")).toBe(decoded)
        active.destroy()
        expect(sharedAudioBufferCache.getStats().decodedBufferCount).toBe(0)
    })
})

describe("WebAudioBackend lite mode switching", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    type Internals = { panner: FakeWebAudioNode; stereoPanner: unknown; gain: FakeWebAudioNode }

    function createBackendWithGraph(options: { stereoPanner: boolean }) {
        const context = installWebAudioContext(async () => fakeBuffer("unused"))
        if (!options.stereoPanner) {
            ;(context as Partial<typeof context>).createStereoPanner = undefined
        }
        const backend = createWebAudioBackend()
        ;(backend as unknown as { ensureContext(): AudioContext }).ensureContext()
        return { backend, internals: backend as unknown as Internals }
    }

    it("reconnects the new panner to the stereo panner when supported", () => {
        const { backend, internals } = createBackendWithGraph({ stereoPanner: true })
        const oldPanner = internals.panner
        const stereoPanner = internals.stereoPanner

        backend.setLiteMode(true)

        expect(internals.panner).not.toBe(oldPanner)
        expect(internals.panner.panningModel).toBe("equalpower")
        expect(oldPanner.disconnect).toHaveBeenCalledWith()
        expect(internals.panner.connect).toHaveBeenCalledWith(stereoPanner)
        expect(backend.getInfo().capabilities.stereoPanning).toBe(true)
        backend.destroy()
    })

    it("falls back to the gain node when the context has no stereo panner", () => {
        const { backend, internals } = createBackendWithGraph({ stereoPanner: false })
        const oldPanner = internals.panner
        expect(internals.stereoPanner).toBeNull()
        expect(backend.getInfo().capabilities.stereoPanning).toBe(false)

        expect(() => backend.setLiteMode(true)).not.toThrow()
        expect(internals.panner.panningModel).toBe("equalpower")
        expect(internals.panner.connect).toHaveBeenCalledWith(internals.gain)
        expect(() => backend.setLiteMode(false)).not.toThrow()
        expect(internals.panner.panningModel).toBe("HRTF")

        expect(internals.panner).not.toBe(oldPanner)
        expect(oldPanner.disconnect).toHaveBeenCalledWith()
        expect(internals.panner.connect).toHaveBeenCalledWith(internals.gain)
        backend.destroy()
    })

    it("applies stored spatial settings to the initial graph and updates live settings", () => {
        installWebAudioContext(async () => fakeBuffer("unused"))
        const backend = createWebAudioBackend()
        expect(backend.getAudioContext()).toBeNull()
        expect(backend.supportsSpatial()).toBe(true)
        backend.setStereo(0.4)
        backend.setPos(1, 2, 3)
        backend.setOrientation(-1, 0.5, 0)
        backend.setDistanceModel("linear")
        backend.setRefDistance(2)
        backend.setMaxDistance(50)
        backend.setRolloffFactor(0.5)
        backend.setConeInnerAngle(60)
        backend.setConeOuterAngle(120)
        backend.setConeOuterGain(0.3)
        backend.setLiteMode(true)
        ;(backend as unknown as { ensureContext(): AudioContext }).ensureContext()
        const internals = backend as unknown as Internals
        expect(internals.panner).toMatchObject({
            panningModel: "equalpower",
            distanceModel: "linear",
            refDistance: 2,
            maxDistance: 50,
            rolloffFactor: 0.5,
            coneInnerAngle: 60,
            coneOuterAngle: 120,
            coneOuterGain: 0.3,
            positionX: { value: 1 },
            positionY: { value: 2 },
            positionZ: { value: 3 },
            orientationX: { value: -1 },
            orientationY: { value: 0.5 },
            orientationZ: { value: 0 },
        })
        expect(internals.stereoPanner).toMatchObject({ pan: { value: 0.4 } })
        backend.setStereo(5)
        backend.setPos(4, 5, 6)
        backend.setOrientation(0, 1, 0)
        backend.setDistanceModel("exponential")
        backend.setRefDistance(-1)
        backend.setMaxDistance(-1)
        backend.setRolloffFactor(-1)
        backend.setConeInnerAngle(400)
        backend.setConeOuterAngle(-1)
        backend.setConeOuterGain(2)
        expect(backend.getStereo()).toBe(1)
        expect(backend.getPos()).toEqual([4, 5, 6])
        expect(backend.getOrientation()).toEqual([0, 1, 0])
        expect(backend.getDistanceModel()).toBe("exponential")
        expect(backend.getRefDistance()).toBe(0)
        expect(backend.getMaxDistance()).toBe(0)
        expect(backend.getRolloffFactor()).toBe(0)
        expect(backend.getConeInnerAngle()).toBe(360)
        expect(backend.getConeOuterAngle()).toBe(0)
        expect(backend.getConeOuterGain()).toBe(1)
        expect(internals.panner).toMatchObject({
            distanceModel: "exponential",
            refDistance: 0,
            maxDistance: 0,
            rolloffFactor: 0,
            coneInnerAngle: 360,
            coneOuterAngle: 0,
            coneOuterGain: 1,
            positionX: { value: 4 },
            positionY: { value: 5 },
            positionZ: { value: 6 },
            orientationX: { value: 0 },
            orientationY: { value: 1 },
            orientationZ: { value: 0 },
        })
        expect(backend.getAudioContext()).not.toBeNull()
        backend.destroy()
        expect(backend.getAudioContext()).toBeNull()
    })

    it.each([true, false])(
        "keeps a playing source connected when lite mode changes (stereo=%s)",
        async (stereo) => {
            const decoded = { duration: 30, length: 1, numberOfChannels: 1 } as AudioBuffer
            const context = installWebAudioContext(async () => decoded)
            if (!stereo) (context as Partial<typeof context>).createStereoPanner = undefined
            const source = Object.assign(new FakeWebAudioNode(), {
                start: vi.fn(),
                stop: vi.fn(),
                playbackRate: { value: 1 },
                onended: null,
            })
            context.createBufferSource.mockReturnValue(source)
            const backend = createWebAudioBackend()
            sharedAudioBufferCache.set("spatial.mp3", decoded)
            backend.setSource("spatial.mp3")
            await backend.play()
            const internals = backend as unknown as Internals
            const oldPanner = internals.panner
            backend.setPos(2, 0, -3)
            backend.setLiteMode(true)
            expect(source.disconnect).toHaveBeenCalledWith(oldPanner)
            expect(source.connect).toHaveBeenLastCalledWith(internals.panner)
            expect(internals.panner.connect).toHaveBeenCalledWith(
                stereo ? internals.stereoPanner : internals.gain
            )
            expect(internals.panner.positionX.value).toBe(2)
            expect(internals.panner.positionZ.value).toBe(-3)
            expect(backend.isLiteMode()).toBe(true)
            expect(backend.isPaused()).toBe(false)
            const currentPanner = internals.panner
            backend.setLiteMode(true)
            expect(internals.panner).toBe(currentPanner)
            backend.setLiteMode(false)
            expect(internals.panner.panningModel).toBe("HRTF")
            expect(source.start).toHaveBeenCalledOnce()
            backend.destroy()
        }
    )
})

describe("Web Audio cache recovery and resource admission", () => {
    const defaults = getAudioResourcePolicy()
    afterEach(() => configureAudioResources(defaults))

    it("preserves healthy disk bytes when the decoded-size policy rejects them", async () => {
        configureAudioResources({ maxDecodedBytes: 8 })
        installWebAudioContext(async () => sizedBuffer(12))
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(new ArrayBuffer(1))
        const remove = vi.spyOn(sharedAudioStorageCache, "delete").mockResolvedValue()
        globalThis.fetch = vi.fn()
        const backend = createWebAudioBackend()
        backend.setSource("offline.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise
        expect(backend.getError()).toBe("src-not-supported")
        expect(remove).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
        configureAudioResources({ maxDecodedBytes: 16 })
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise
        expect(backend.getDecodedData()).not.toBeNull()
        expect(backend.getError()).toBeNull()
        expect(fetch).not.toHaveBeenCalled()
        backend.destroy()
    })

    it("evicts corrupt disk bytes and retries network once without emitting a recoverable error", async () => {
        const decoded = fakeBuffer("fresh")
        const context = installWebAudioContext(async () => decoded)
        context.decodeAudioData.mockRejectedValueOnce(new Error("bad disk bytes"))
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(new ArrayBuffer(4))
        const remove = vi.spyOn(sharedAudioStorageCache, "delete").mockResolvedValue()
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2])))
        const backend = createWebAudioBackend()
        const error = vi.fn()
        backend.addEventListener("error", error)
        backend.setSource("repaired.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise
        expect(remove).toHaveBeenCalledWith("repaired.mp3")
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
            "repaired.mp3",
            expect.objectContaining({ cache: "reload" })
        )
        expect(context.decodeAudioData).toHaveBeenCalledTimes(2)
        expect(put).toHaveBeenCalledOnce()
        expect(error).not.toHaveBeenCalled()
        expect(backend.getDecodedData()).toBe(decoded)
        backend.destroy()
    })

    it("reports one terminal error when fresh bytes also fail decoding", async () => {
        installWebAudioContext(async () => {
            throw new Error("bad bytes")
        })
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(new ArrayBuffer(4))
        vi.spyOn(sharedAudioStorageCache, "delete").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        const error = vi.fn()
        backend.addEventListener("error", error)
        backend.setSource("broken.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise
        expect(fetch).toHaveBeenCalledOnce()
        expect(error).toHaveBeenCalledOnce()
        expect(backend.getError()).toBe("decode")
        backend.destroy()
    })

    it("bounds concurrent preloads through decode and does not cache a cancelled decode", async () => {
        configureAudioResources({ maxConcurrentLoads: 1 })
        let finish!: (buffer: AudioBuffer) => void
        const context = installWebAudioContext(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
        const first = createWebAudioBackend()
        const second = createWebAudioBackend()
        first.preload("first.mp3")
        second.preload("second.mp3")
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())
        expect(fetch).toHaveBeenCalledOnce()
        expect(getAudioResourceStats()).toMatchObject({
            activeLoads: 1,
            queuedLoads: 1,
            inFlightEncodedBytes: 6,
            decodingReservedBytes: defaults.maxDecodedBytes,
        })
        first.releasePreload()
        second.releasePreload()
        finish(fakeBuffer("cancelled"))
        await vi.waitFor(() => expect(getAudioResourceStats().activeLoads).toBe(0))
        expect(getAudioResourceStats().queuedLoads).toBe(0)
        expect(fetch).toHaveBeenCalledOnce()
        expect(sharedAudioBufferCache.has("first.mp3")).toBe(false)
        first.destroy()
        second.destroy()
    })

    it("rejects an oversized decoded buffer before cache insertion or playback adoption", async () => {
        configureAudioResources({ maxDecodedBytes: 8 })
        installWebAudioContext(async () => sizedBuffer(12))
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        backend.setSource("large.mp3")
        backend.load()
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise
        expect(backend.getError()).toBe("src-not-supported")
        expect(backend.getDecodedData()).toBeNull()
        expect(sharedAudioBufferCache.has("large.mp3")).toBe(false)
        expect(put).not.toHaveBeenCalled()
        expect(getAudioResourceStats().inFlightEncodedBytes).toBe(0)
        backend.destroy()
    })

    it("tracks resident buffers separately and prevents invalidated work from repopulating caches", async () => {
        let finish!: (buffer: AudioBuffer) => void
        const context = installWebAudioContext(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        vi.spyOn(sharedAudioStorageCache, "delete").mockResolvedValue()
        const put = vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue()
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1])))
        const backend = createWebAudioBackend()
        backend.setSource("replaced.mp3")
        backend.load()
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())
        await invalidateAudioCache("replaced.mp3")
        finish(sizedBuffer(16))
        await (backend as unknown as { loadPromise: Promise<void> }).loadPromise
        expect(sharedAudioBufferCache.has("replaced.mp3")).toBe(false)
        expect(put).not.toHaveBeenCalled()
        expect(getAudioResourceStats().activeBufferBytes).toBe(16)
        backend.clearSource()
        expect(getAudioResourceStats().activeBufferBytes).toBe(0)
        backend.destroy()
    })
})
