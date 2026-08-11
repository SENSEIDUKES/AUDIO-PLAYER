/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import React, { StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import type {
    AudioPlayerEngine,
    FallbackSourceEvent,
    TrackSource,
    TrackSourceResolution,
    TrackSourceResolver
} from "../types"
import { useAudioPlayer } from "../useAudioPlayer"

type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
}

class FakeAudioNode {
    gain = { value: 1 }
    pan = { value: 0 }
    positionX = { value: 0 }
    positionY = { value: 0 }
    positionZ = { value: 0 }
    orientationX = { value: 0 }
    orientationY = { value: 0 }
    orientationZ = { value: 0 }
    connect = vi.fn()
    disconnect = vi.fn()
}

class FakeBufferSource extends FakeAudioNode {
    buffer: AudioBuffer | null = null
    loop = false
    playbackRate = { value: 1 }
    onended: (() => void) | null = null
    start = vi.fn()
    stop = vi.fn()
}

function installAudioContext() {
    const sources: FakeBufferSource[] = []
    const context = {
        state: "running" as AudioContextState,
        destination: {},
        currentTime: 0,
        createPanner: vi.fn(() => new FakeAudioNode()),
        createGain: vi.fn(() => new FakeAudioNode()),
        createStereoPanner: vi.fn(() => new FakeAudioNode()),
        createBufferSource: vi.fn(() => {
            const source = new FakeBufferSource()
            sources.push(source)
            return source
        }),
        decodeAudioData: vi.fn(async () => ({ duration: 60 }) as AudioBuffer),
        resume: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined)
    }
    vi.stubGlobal(
        "AudioContext",
        vi.fn(function AudioContextMock() {
            return context
        })
    )
    return { context, sources }
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

describe("useAudioPlayer sourceResolver", () => {
    let container: HTMLDivElement
    let root: Root
    let playSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        container = document.createElement("div")
        root = createRoot(container)
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 1)
        )
        vi.stubGlobal("cancelAnimationFrame", vi.fn())
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        playSpy = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockImplementation(function (this: HTMLMediaElement) {
                this.dispatchEvent(new Event("play"))
                return Promise.resolve()
            })
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
            this: HTMLMediaElement
        ) {
            this.dispatchEvent(new Event("pause"))
        })
    })

    afterEach(async () => {
        await React.act(async () => root.unmount())
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    function createHarness(sourceResolver: TrackSourceResolver) {
        let engine: AudioPlayerEngine | null = null

        function Harness({
            sourceKey,
            sources,
            onFallbackSource,
            audioBackend = "html5"
        }: {
            sourceKey: string
            sources: readonly TrackSource[]
            onFallbackSource?: (event: FallbackSourceEvent) => void
            audioBackend?: "html5" | "webaudio"
        }) {
            engine = useAudioPlayer({
                src: sources[0]?.url ?? "",
                sources,
                sourceKey,
                sourceResolver,
                onFallbackSource,
                audioBackend
            })
            return <audio ref={engine.audioRef} src={engine.currentSrc || undefined} />
        }

        return {
            Harness,
            get engine() {
                return engine!
            }
        }
    }

    it("attaches a blob-style URL only after resolution and queues play while pending", async () => {
        const pending = deferred<TrackSourceResolution>()
        const release = vi.fn()
        const resolver = vi.fn<TrackSourceResolver>(() => pending.promise)
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="chapter-1"
                    sources={[
                        { url: "indexeddb://narration/chapter-1", type: "audio/mpeg" }
                    ]}
                />
            )
        })

        const audio = container.querySelector("audio")!
        expect(harness.engine.currentSrc).toBe("")
        expect(audio.getAttribute("src")).toBeNull()
        expect(resolver).toHaveBeenCalledWith(
            { url: "indexeddb://narration/chapter-1", type: "audio/mpeg" },
            expect.any(AbortSignal)
        )

        await React.act(async () => harness.engine.play())
        expect(playSpy).not.toHaveBeenCalled()

        await React.act(async () => {
            pending.resolve({
                url: "blob:https://audio.test/chapter-1",
                release
            })
            await pending.promise
        })

        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/chapter-1")
        expect(audio.getAttribute("src")).toBe("blob:https://audio.test/chapter-1")
        expect(playSpy).toHaveBeenCalledTimes(1)

        const resolverCalls = resolver.mock.calls.length
        await React.act(async () => {
            harness.engine.preload({
                title: "Next",
                artist: "Narrator",
                audioFile: "https://cdn.test/next.mp3"
            })
        })
        expect(resolver).toHaveBeenCalledTimes(resolverCalls)

        await React.act(async () => {
            harness.engine.unload()
            harness.engine.unload()
        })
        expect(release).toHaveBeenCalledTimes(1)
        expect(harness.engine.currentSrc).toBe("")
    })

    it("aborts replacement work, releases a late stale result immediately, and never attaches it", async () => {
        const pendingA = deferred<TrackSourceResolution>()
        const pendingB = deferred<TrackSourceResolution>()
        const pendingC = deferred<TrackSourceResolution>()
        const releases = [vi.fn(), vi.fn(), vi.fn()]
        const signals: AbortSignal[] = []
        const pendingByUrl = new Map([
            ["a.mp3", pendingA],
            ["b.mp3", pendingB],
            ["c.mp3", pendingC]
        ])
        const resolver: TrackSourceResolver = (source, signal) => {
            signals.push(signal)
            return pendingByUrl.get(source.url)!.promise
        }
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(<harness.Harness sourceKey="a" sources={[{ url: "a.mp3" }]} />)
        })
        await React.act(async () => {
            root.render(<harness.Harness sourceKey="b" sources={[{ url: "b.mp3" }]} />)
        })
        expect(signals[0]?.aborted).toBe(true)

        await React.act(async () => {
            pendingA.resolve({
                url: "blob:https://audio.test/a",
                release: releases[0]
            })
            await pendingA.promise
        })
        expect(releases[0]).toHaveBeenCalledTimes(1)
        expect(harness.engine.currentSrc).toBe("")

        await React.act(async () => {
            pendingB.resolve({
                url: "blob:https://audio.test/b",
                release: releases[1]
            })
            await pendingB.promise
        })
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/b")

        await React.act(async () => {
            root.render(<harness.Harness sourceKey="c" sources={[{ url: "c.mp3" }]} />)
        })
        expect(releases[1]).toHaveBeenCalledTimes(1)

        await React.act(async () => {
            pendingC.resolve({
                url: "blob:https://audio.test/c",
                release: releases[2]
            })
            await pendingC.promise
        })
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/c")

        await React.act(async () => root.unmount())
        root = createRoot(container)
        expect(releases[2]).toHaveBeenCalledTimes(1)
        expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true)
    })

    it("routes resolver rejection through fallback handling", async () => {
        const fallback = vi.fn()
        const resolver = vi.fn<TrackSourceResolver>(async (source) => {
            if (source.url === "primary.mp3") throw new Error("offline miss")
            return { url: "blob:https://audio.test/fallback", release: vi.fn() }
        })
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="fallback"
                    sources={[{ url: "primary.mp3" }, { url: "backup.mp3" }]}
                    onFallbackSource={fallback}
                />
            )
        })

        expect(fallback).toHaveBeenCalledWith(
            expect.objectContaining({
                failedSource: "primary.mp3",
                nextSource: "backup.mp3",
                sourceIndex: 1
            })
        )
        expect(resolver).toHaveBeenCalledTimes(2)
        expect(harness.engine.currentSourceIndex).toBe(1)
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/fallback")
        expect(harness.engine.hasError).toBe(false)
    })

    it("releases the active result exactly once when the backend advances to a fallback", async () => {
        const releases = [vi.fn(), vi.fn()]
        const fallback = vi.fn()
        const resolver = vi.fn<TrackSourceResolver>(async (source) => ({
            url: `blob:https://audio.test/${source.url}`,
            release: source.url === "primary.mp3" ? releases[0] : releases[1]
        }))
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="backend-fallback"
                    sources={[{ url: "primary.mp3" }, { url: "backup.mp3" }]}
                    onFallbackSource={fallback}
                />
            )
        })
        const audio = container.querySelector("audio")!
        Object.defineProperty(audio, "error", {
            configurable: true,
            value: {
                code: 2,
                MEDIA_ERR_ABORTED: 1,
                MEDIA_ERR_NETWORK: 2,
                MEDIA_ERR_DECODE: 3,
                MEDIA_ERR_SRC_NOT_SUPPORTED: 4
            }
        })

        await React.act(async () => audio.dispatchEvent(new Event("error")))

        expect(releases[0]).toHaveBeenCalledTimes(1)
        expect(fallback).toHaveBeenCalledWith(
            expect.objectContaining({ failedSource: "primary.mp3" })
        )
        expect(harness.engine.currentSourceIndex).toBe(1)
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/backup.mp3")
        expect(releases[1]).not.toHaveBeenCalled()
    })

    it("re-resolves an active private URL on retry and releases the expired result", async () => {
        const releases = [vi.fn(), vi.fn()]
        let attempt = 0
        const resolver = vi.fn<TrackSourceResolver>(async () => {
            const index = attempt++
            return {
                url: "blob:https://audio.test/retry",
                release: releases[index]
            }
        })
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="retry"
                    sources={[{ url: "private://chapter" }]}
                />
            )
        })
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/retry")

        await React.act(async () => harness.engine.retry())

        expect(resolver).toHaveBeenCalledTimes(2)
        expect(releases[0]).toHaveBeenCalledTimes(1)
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/retry")
        expect(container.querySelector("audio")!.getAttribute("src")).toBe(
            "blob:https://audio.test/retry"
        )
        expect(playSpy).toHaveBeenCalledTimes(1)
    })

    it("continues live playback after an asynchronously resolved track change", async () => {
        const pending = deferred<TrackSourceResolution>()
        const resolver = vi.fn<TrackSourceResolver>((source) =>
            source.url === "live-a.mp3"
                ? Promise.resolve("blob:https://audio.test/live-a")
                : pending.promise
        )
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="live-a"
                    sources={[{ url: "live-a.mp3" }]}
                />
            )
        })
        await React.act(async () => harness.engine.play())
        expect(harness.engine.isPlaying).toBe(true)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="live-b"
                    sources={[{ url: "live-b.mp3" }]}
                />
            )
        })
        expect(harness.engine.currentSrc).toBe("")

        await React.act(async () => {
            pending.resolve("blob:https://audio.test/live-b")
            await pending.promise
        })

        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/live-b")
        expect(harness.engine.isPlaying).toBe(true)
        expect(playSpy).toHaveBeenCalledTimes(2)
    })

    it("does not re-arm a paused pending play on the replacement track", async () => {
        const pendingPlay = deferred<void>()
        playSpy.mockImplementationOnce(() => pendingPlay.promise)
        const resolver = vi.fn<TrackSourceResolver>(async (source) =>
            `blob:https://audio.test/${source.url}`
        )
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="pending-a"
                    sources={[{ url: "pending-a.mp3" }]}
                />
            )
        })
        await React.act(async () => {
            harness.engine.play()
            harness.engine.pause()
        })
        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="pending-b"
                    sources={[{ url: "pending-b.mp3" }]}
                />
            )
        })
        await React.act(async () => {
            pendingPlay.resolve()
            await pendingPlay.promise
        })

        expect(harness.engine.currentSrc).toBe(
            "blob:https://audio.test/pending-b.mp3"
        )
        expect(harness.engine.isPlaying).toBe(false)
        expect(playSpy).toHaveBeenCalledTimes(1)
    })

    it("keeps a seek requested during replacement resolution", async () => {
        const pending = deferred<TrackSourceResolution>()
        const resolver = vi.fn<TrackSourceResolver>((source) =>
            source.url === "a.mp3"
                ? Promise.resolve("blob:https://audio.test/a-seek")
                : pending.promise
        )
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness sourceKey="a" sources={[{ url: "a.mp3" }]} />
            )
        })
        await React.act(async () => {
            root.render(
                <harness.Harness sourceKey="b" sources={[{ url: "b.mp3" }]} />
            )
        })
        await React.act(async () => harness.engine.seek(42))

        await React.act(async () => {
            pending.resolve("blob:https://audio.test/b-seek")
            await pending.promise
        })
        const audio = container.querySelector("audio")!
        Object.defineProperty(audio, "duration", {
            configurable: true,
            value: 100
        })
        await React.act(async () =>
            audio.dispatchEvent(new Event("loadedmetadata"))
        )

        expect(audio.currentTime).toBe(42)
        expect(harness.engine.currentTime).toBe(42)
    })

    it("switches from a managed URL back to the declared HTML5 URL", async () => {
        const release = vi.fn()
        const resolver = vi.fn<TrackSourceResolver>(async () => ({
            url: "blob:https://audio.test/managed",
            release
        }))
        let engine: AudioPlayerEngine | null = null

        function Harness({ managed }: { managed: boolean }) {
            engine = useAudioPlayer({
                src: "direct.mp3",
                sourceKey: "direct",
                sourceResolver: managed ? resolver : undefined
            })
            return <audio ref={engine.audioRef} src={engine.currentSrc || undefined} />
        }

        await React.act(async () => root.render(<Harness managed />))
        expect(engine!.currentSrc).toBe("blob:https://audio.test/managed")

        await React.act(async () => root.render(<Harness managed={false} />))

        expect(release).toHaveBeenCalledTimes(1)
        expect(engine!.currentSrc).toBe("direct.mp3")
        expect(container.querySelector("audio")!.getAttribute("src")).toBe(
            "direct.mp3"
        )
    })

    it("feeds only the resolved URL into the Web Audio fetch/decode path", async () => {
        const { sources } = installAudioContext()
        const release = vi.fn()
        const fetchMock = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8)
        }))
        vi.stubGlobal("fetch", fetchMock)
        const resolver = vi.fn<TrackSourceResolver>(async () => ({
            url: "blob:https://audio.test/webaudio",
            release
        }))
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <harness.Harness
                    sourceKey="webaudio"
                    sources={[{ url: "private://webaudio-track" }]}
                    audioBackend="webaudio"
                />
            )
        })
        expect(fetchMock).not.toHaveBeenCalled()

        await React.act(async () => {
            harness.engine.play()
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
        await vi.waitFor(() => expect(sources).toHaveLength(1))

        expect(fetchMock).toHaveBeenCalledWith(
            "blob:https://audio.test/webaudio",
            expect.objectContaining({ mode: "cors", signal: expect.any(AbortSignal) })
        )
        expect(fetchMock).not.toHaveBeenCalledWith(
            "private://webaudio-track",
            expect.anything()
        )
        expect(sources[0]!.start).toHaveBeenCalled()

        await React.act(async () => root.unmount())
        root = createRoot(container)
        expect(release).toHaveBeenCalledTimes(1)
    })

    it("releases StrictMode's stale and active results exactly once", async () => {
        const pending: Deferred<TrackSourceResolution>[] = []
        const releases = [vi.fn(), vi.fn()]
        const resolver = vi.fn<TrackSourceResolver>(() => {
            const next = deferred<TrackSourceResolution>()
            pending.push(next)
            return next.promise
        })
        const harness = createHarness(resolver)

        await React.act(async () => {
            root.render(
                <StrictMode>
                    <harness.Harness
                        sourceKey="strict"
                        sources={[{ url: "strict.mp3" }]}
                    />
                </StrictMode>
            )
        })
        expect(pending).toHaveLength(2)

        await React.act(async () => {
            pending[0]!.resolve({
                url: "blob:https://audio.test/strict-stale",
                release: releases[0]
            })
            pending[1]!.resolve({
                url: "blob:https://audio.test/strict-active",
                release: releases[1]
            })
            await Promise.all(pending.map((entry) => entry.promise))
        })

        expect(releases[0]).toHaveBeenCalledTimes(1)
        expect(releases[1]).not.toHaveBeenCalled()
        expect(harness.engine.currentSrc).toBe("blob:https://audio.test/strict-active")

        await React.act(async () => root.unmount())
        root = createRoot(container)
        expect(releases[1]).toHaveBeenCalledTimes(1)
    })
})
