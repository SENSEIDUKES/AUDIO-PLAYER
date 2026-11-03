/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../WebAudioBackend"
import { sharedAudioBufferCache, sharedAudioStorageCache } from "../audioCaches"
import { retainAudioContext } from "../sharedAudioContext"

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

function installAudioContext() {
    const node = () => ({
        gain: { value: 1 },
        pan: { value: 0 },
        positionX: { value: 0 },
        positionY: { value: 0 },
        positionZ: { value: 0 },
        orientationX: { value: 0 },
        orientationY: { value: 0 },
        orientationZ: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
    })
    const buffer = { duration: 30, length: 300, numberOfChannels: 1 } as AudioBuffer
    const start = vi.fn()
    const context = {
        state: "suspended" as AudioContextState,
        currentTime: 0,
        destination: {},
        createPanner: vi.fn(node),
        createGain: vi.fn(node),
        createStereoPanner: vi.fn(node),
        createBufferSource: vi.fn(() => ({
            ...node(),
            playbackRate: { value: 1 },
            start,
            stop: vi.fn(),
        })),
        decodeAudioData: vi.fn(async () => buffer),
        resume: vi.fn(async () => {
            context.state = "running"
        }),
        suspend: vi.fn(async () => {
            context.state = "suspended"
        }),
        close: vi.fn(async () => {
            context.state = "closed"
        }),
    }
    vi.stubGlobal(
        "AudioContext",
        vi.fn(function () {
            return context
        })
    )
    return { context, buffer, start }
}

const backends: WebAudioBackend[] = []
function createBackend() {
    const backend = new WebAudioBackend({
        requested: "webaudio",
        active: "webaudio",
        didFallback: false,
        capabilities: WEBAUDIO_CAPABILITIES,
    })
    backend.setSource("pending.mp3")
    backends.push(backend)
    return backend
}

describe("Web Audio pending playback cancellation", () => {
    beforeEach(() => {
        sharedAudioBufferCache.clear()
        vi.spyOn(sharedAudioStorageCache, "getArrayBuffer").mockResolvedValue(null)
        vi.spyOn(sharedAudioStorageCache, "putArrayBuffer").mockResolvedValue(undefined)
    })

    afterEach(() => {
        for (const backend of backends.splice(0)) backend.destroy()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        sharedAudioBufferCache.clear()
    })

    it.each(["download", "decode"])(
        "cancels during %s but keeps the buffer for later Play",
        async (stage) => {
            const { context, buffer, start } = installAudioContext()
            const download = deferred<ArrayBuffer>()
            const decode = deferred<AudioBuffer>()
            const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({
                ok: true,
                arrayBuffer: () => download.promise,
            }))
            vi.stubGlobal("fetch", fetchMock)
            if (stage === "decode") context.decodeAudioData.mockReturnValueOnce(decode.promise)
            const backend = createBackend()
            const playing = vi.fn()
            const play = vi.fn()
            backend.addEventListener("playing", playing)
            backend.addEventListener("play", play)
            const result = backend.play().catch((error: unknown) => error)
            await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
            if (stage === "decode") {
                download.resolve(new ArrayBuffer(8))
                await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce())
            }

            backend.pause()
            expect(context.suspend).toHaveBeenCalledOnce()
            expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
            if (stage === "download") download.resolve(new ArrayBuffer(8))
            else decode.resolve(buffer)

            expect(await result).toMatchObject({ name: "AbortError" })
            expect(backend.isPaused()).toBe(true)
            expect(start).not.toHaveBeenCalled()
            expect(play).not.toHaveBeenCalled()
            expect(playing).not.toHaveBeenCalled()
            expect(backend.getDecodedData()).toBe(buffer)

            await backend.play()
            expect(start).toHaveBeenCalledOnce()
            expect(playing).toHaveBeenCalledOnce()
            expect(fetchMock).toHaveBeenCalledOnce()
            expect(context.decodeAudioData).toHaveBeenCalledOnce()
        }
    )

    it.each(["resolve", "reject"])(
        "cancels while context resume is pending (%s)",
        async (outcome) => {
            const { context, buffer, start } = installAudioContext()
            const resume = deferred<void>()
            context.resume.mockImplementationOnce(() => resume.promise)
            sharedAudioBufferCache.set("pending.mp3", buffer)
            const backend = createBackend()
            const result = backend.play().catch((error: unknown) => error)
            backend.pause()
            if (outcome === "resolve") {
                context.state = "running"
                resume.resolve()
            } else resume.reject(new Error("resume blocked"))

            expect(await result).toMatchObject({ name: "AbortError" })
            await vi.waitFor(() => expect(context.state).toBe("suspended"))
            expect(start).not.toHaveBeenCalled()
            expect(backend.isPaused()).toBe(true)
            expect(backend.getDecodedData()).toBe(buffer)
        }
    )

    it("allows a new Play during the same download without stale playback releasing its demand", async () => {
        const { context, start } = installAudioContext()
        const download = deferred<ArrayBuffer>()
        const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: () => download.promise }))
        vi.stubGlobal("fetch", fetchMock)
        const backend = createBackend()
        const first = backend.play().catch((error: unknown) => error)
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
        backend.pause()
        const second = backend.play()
        download.resolve(new ArrayBuffer(8))

        expect(await first).toMatchObject({ name: "AbortError" })
        await second
        expect(start).toHaveBeenCalledOnce()
        expect(backend.isPaused()).toBe(false)
        expect(context.state).toBe("running")
        expect(context.suspend).toHaveBeenCalledOnce()
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it("releases only its own demand when another context owner is playing", async () => {
        const { context, buffer, start } = installAudioContext()
        const other = retainAudioContext(window.AudioContext)
        try {
            await other.setActive(true)
            sharedAudioBufferCache.set("pending.mp3", buffer)
            const backend = createBackend()
            const result = backend.play().catch((error: unknown) => error)
            backend.pause()

            expect(await result).toMatchObject({ name: "AbortError" })
            expect(start).not.toHaveBeenCalled()
            expect(context.suspend).not.toHaveBeenCalled()
            expect(context.state).toBe("running")
            await other.setActive(false)
            expect(context.suspend).toHaveBeenCalledOnce()
        } finally {
            other.release()
        }
    })

    it("does not let a cancelled resume failure suspend a newer Play", async () => {
        const { context, buffer, start } = installAudioContext()
        const resume = deferred<void>()
        context.resume.mockImplementationOnce(() => resume.promise)
        sharedAudioBufferCache.set("pending.mp3", buffer)
        const backend = createBackend()
        const first = backend.play().catch((error: unknown) => error)
        backend.pause()
        await backend.play()
        resume.reject(new Error("old resume failed"))

        expect(await first).toMatchObject({ name: "AbortError" })
        expect(start).toHaveBeenCalledOnce()
        expect(backend.isPaused()).toBe(false)
        expect(context.state).toBe("running")
        expect(context.suspend).not.toHaveBeenCalled()
    })

    it("honors Pause from a synchronous load listener before acquiring playback demand", async () => {
        const { context, buffer, start } = installAudioContext()
        sharedAudioBufferCache.set("pending.mp3", buffer)
        const backend = createBackend()
        backend.addEventListener("loadstart", () => backend.pause())

        await expect(backend.play()).rejects.toMatchObject({ name: "AbortError" })
        expect(context.resume).not.toHaveBeenCalled()
        expect(start).not.toHaveBeenCalled()
        expect(backend.getDecodedData()).toBe(buffer)
    })
})
