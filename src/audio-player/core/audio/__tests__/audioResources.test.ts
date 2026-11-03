import { afterEach, describe, expect, it, vi } from "vitest"
import {
    AudioResourceLimitError,
    estimateWavDecodedBytes,
    configureAudioResources,
    getAudioResourcePolicy,
    readBoundedAudio,
    recommendAudioBackend,
} from "../audioResources"
import { PersistentAudioCache, invalidateAudioCache, sharedAudioBufferCache } from "../audioCaches"

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

function disk() {
    const entries = new Map<string, Response>()
    const cache = {
        match: vi.fn(async (key: string) => entries.get(key)?.clone()),
        put: vi.fn(async (key: string, value: Response) => {
            entries.set(key, value)
        }),
        delete: vi.fn(async (key: string) => entries.delete(key)),
        keys: vi.fn(async () => [...entries.keys()]),
    }
    const removeCache = vi.fn(async () => {
        entries.clear()
        return true
    })
    vi.stubGlobal("caches", { open: vi.fn(async () => cache), delete: removeCache })
    return { entries, cache, removeCache }
}

describe("persistent audio retention", () => {
    it("preserves valid offline bytes when a read exceeds a temporary memory limit", async () => {
        const { entries, cache } = disk()
        const store = new PersistentAudioCache()
        await store.putArrayBuffer("a", new ArrayBuffer(4))
        expect(await store.getArrayBuffer("a", 2)).toBeNull()
        expect(entries.has("a")).toBe(true)
        expect(cache.delete).not.toHaveBeenCalled()
        expect(await store.getArrayBuffer("a", 4)).toEqual(new ArrayBuffer(4))
    })

    it("ignores undefined retention options while applying defined options", async () => {
        const { entries } = disk()
        const store = new PersistentAudioCache()
        await store.configureRetention({ maxEntries: 1, maxBytes: undefined, maxAgeMs: undefined })
        await store.putArrayBuffer("a", new ArrayBuffer(1))
        await store.putArrayBuffer("b", new ArrayBuffer(1))
        expect([...entries.keys()]).toEqual(["b"])
        expect(await store.getArrayBuffer("b")).not.toBeNull()
    })

    it("expires old and legacy entries and enforces entry and byte retention", async () => {
        const { entries } = disk()
        const now = vi.spyOn(Date, "now").mockReturnValue(1000)
        const store = new PersistentAudioCache()
        await store.configureRetention({ maxEntries: 2, maxBytes: 6, maxAgeMs: 100 })
        await store.putArrayBuffer("a", new ArrayBuffer(2))
        await store.putArrayBuffer("b", new ArrayBuffer(2))
        await store.putArrayBuffer("c", new ArrayBuffer(2))
        expect([...entries.keys()]).toEqual(["b", "c"])
        await store.putArrayBuffer("d", new ArrayBuffer(5))
        expect([...entries.keys()]).toEqual(["d"])
        now.mockReturnValue(1100)
        expect(await store.getArrayBuffer("d")).toBeNull()
        entries.set("legacy", new Response(new ArrayBuffer(1)))
        expect(await store.getArrayBuffer("legacy")).toBeNull()
        expect(entries.size).toBe(0)
    })

    it("clears memory and disk for one URL or the whole cache", async () => {
        const { entries, removeCache } = disk()
        entries.set("a", new Response(new ArrayBuffer(1)))
        entries.set("b", new Response(new ArrayBuffer(1)))
        sharedAudioBufferCache.set("a", { length: 1, numberOfChannels: 1 } as AudioBuffer)
        await invalidateAudioCache(" a ")
        expect(sharedAudioBufferCache.has("a")).toBe(false)
        expect([...entries.keys()]).toEqual(["b"])
        await invalidateAudioCache()
        expect(entries.size).toBe(0)
        expect(removeCache).toHaveBeenCalledWith("seihouse-audio-vault-v1")
    })

    it("serializes deletion after an in-flight write", async () => {
        const { cache, entries } = disk()
        let finish!: () => void
        cache.put.mockImplementationOnce(async (key, value) => {
            await new Promise<void>((resolve) => {
                finish = resolve
            })
            entries.set(key, value)
        })
        const store = new PersistentAudioCache()
        const write = store.putArrayBuffer("a", new ArrayBuffer(2))
        await vi.waitFor(() => expect(cache.put).toHaveBeenCalledOnce())
        const remove = store.delete("a")
        finish()
        await Promise.all([write, remove])
        expect(entries.size).toBe(0)
    })

    it("allows storage to be disabled and rejects invalid retention", async () => {
        const { entries } = disk()
        const store = new PersistentAudioCache()
        await store.putArrayBuffer("a", new ArrayBuffer(1))
        await store.configureRetention({ maxEntries: 0 })
        await store.putArrayBuffer("b", new ArrayBuffer(1))
        expect(entries.size).toBe(0)
        await expect(store.configureRetention({ maxAgeMs: NaN })).rejects.toThrow(RangeError)
    })
})

describe("audio download admission", () => {
    it("ignores undefined resource options and applies updates atomically", () => {
        const original = getAudioResourcePolicy()
        try {
            configureAudioResources({
                maxConcurrentLoads: 1,
                maxEncodedBytes: undefined,
                maxDecodedBytes: undefined,
            })
            expect(getAudioResourcePolicy()).toEqual({ ...original, maxConcurrentLoads: 1 })
            expect(() =>
                configureAudioResources({ maxConcurrentLoads: 2, maxEncodedBytes: 0 })
            ).toThrow(RangeError)
            expect(getAudioResourcePolicy()).toEqual({ ...original, maxConcurrentLoads: 1 })
        } finally {
            configureAudioResources(original)
        }
    })

    it("rejects declared oversize before reading the body", async () => {
        const cancel = vi.fn()
        const response = new Response(new ReadableStream({ cancel }), {
            headers: { "Content-Length": "100" },
        })
        await expect(readBoundedAudio(response, 4)).rejects.toBeInstanceOf(AudioResourceLimitError)
        expect(cancel).toHaveBeenCalledOnce()
    })

    it.each([undefined, "1"])(
        "bounds chunked downloads even with missing or false size (%s)",
        async (length) => {
            const cancel = vi.fn()
            const response = new Response(
                new ReadableStream({
                    start(controller) {
                        controller.enqueue(new Uint8Array(3))
                        controller.enqueue(new Uint8Array(3))
                    },
                    cancel,
                }),
                { headers: length ? { "Content-Length": length } : {} }
            )
            await expect(readBoundedAudio(response, 4)).rejects.toBeInstanceOf(
                AudioResourceLimitError
            )
            expect(cancel).toHaveBeenCalledOnce()
        }
    )

    it("cancels a pending read when the source is released", async () => {
        const abort = new AbortController()
        const cancel = vi.fn()
        const response = new Response(new ReadableStream({ cancel }))
        const pending = readBoundedAudio(response, 4, abort.signal)
        abort.abort()
        await expect(pending).rejects.toMatchObject({ name: "AbortError" })
        expect(cancel).toHaveBeenCalledOnce()
    })

    it("prefers streaming for long, unknown and oversized assets", () => {
        expect(recommendAudioBackend({})).toBe("html5")
        expect(recommendAudioBackend({ durationSeconds: 120 })).toBe("html5")
        expect(recommendAudioBackend({ durationSeconds: 10 })).toBe("webaudio")
        expect(
            recommendAudioBackend({
                durationSeconds: 10,
                decodedBytes: getAudioResourcePolicy().maxDecodedBytes + 1,
            })
        ).toBe("html5")
        expect(() => configureAudioResources({ maxConcurrentLoads: 0 })).toThrow(RangeError)
    })
})

it.each([1, 3, 0xfffe])(
    "estimates PCM/float expansion and defers extensible WAV (format %i)",
    (format) => {
        const data = new ArrayBuffer(44)
        const view = new DataView(data)
        view.setUint32(0, 0x52494646)
        view.setUint32(8, 0x57415645)
        view.setUint32(12, 0x666d7420)
        view.setUint32(16, 16, true)
        view.setUint16(20, format, true)
        view.setUint16(22, 2, true)
        view.setUint32(24, 24000, true)
        view.setUint16(32, 4, true)
        view.setUint32(36, 0x64617461)
        view.setUint32(40, 96000, true)
        expect(estimateWavDecodedBytes(data, 48000)).toBe(format === 0xfffe ? null : 384000)
        expect(estimateWavDecodedBytes(new ArrayBuffer(4), 48000)).toBeNull()
    }
)
