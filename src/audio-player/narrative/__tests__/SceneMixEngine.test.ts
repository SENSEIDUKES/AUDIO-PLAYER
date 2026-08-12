// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSceneMixEngine } from "../SceneMixEngine"
import type { SceneMixStatusSnapshot } from "../SceneMixEngine"
import type { FallbackSourceEvent, Track, TrackTrims } from "../../types"

const analysisMocks = vi.hoisted(() => ({
    ensureSourceAnalysis: vi.fn(),
}))

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: analysisMocks.ensureSourceAnalysis,
}))

type VolumeWriteBehavior = "normal" | "ignore" | "throw"
type PlayBehavior =
    "resolve" | "not-allowed" | "reject" | "throw" | ((audio: FakeAudio) => Promise<void>)

/**
 * Minimal Audio stand-in: enough surface for SceneMixEngine's deck lifecycle,
 * with a controllable play() so tests can simulate autoplay policy.
 */
class FakeAudio {
    static created: FakeAudio[] = []
    static playBehavior: PlayBehavior = "resolve"
    static volumeWriteBehaviors: VolumeWriteBehavior[] = []

    loop = false
    preload = ""
    crossOrigin: string | null = null
    muted = false
    paused = true
    readyState = 0
    duration = Number.NaN
    src = ""
    error: MediaError | null = null
    playCalls = 0
    pauseCalls = 0
    loadCalls = 0
    currentTimeWrites: number[] = []

    private readonly volumeWriteBehavior: VolumeWriteBehavior
    private volumeValue = 1
    private currentTimeValue = 0
    private listeners = new Map<string, Set<EventListener>>()

    constructor() {
        this.volumeWriteBehavior = FakeAudio.volumeWriteBehaviors.shift() ?? "normal"
        FakeAudio.created.push(this)
    }

    get volume(): number {
        return this.volumeValue
    }

    set volume(value: number) {
        if (this.volumeWriteBehavior === "throw") {
            throw new Error("volume is locked")
        }
        if (this.volumeWriteBehavior === "ignore") return
        this.volumeValue = value
    }

    get currentTime(): number {
        return this.currentTimeValue
    }

    set currentTime(value: number) {
        this.currentTimeValue = value
        this.currentTimeWrites.push(value)
    }

    addEventListener(
        type: string,
        cb: EventListener,
        options?: AddEventListenerOptions | boolean
    ): void {
        const signal = typeof options === "object" ? options.signal : undefined
        if (signal?.aborted) return
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(cb)
        signal?.addEventListener("abort", () => this.listeners.get(type)?.delete(cb), {
            once: true,
        })
    }

    removeEventListener(type: string, cb: EventListener): void {
        this.listeners.get(type)?.delete(cb)
    }

    removeAttribute(): void {
        this.src = ""
    }

    load(): void {
        this.loadCalls += 1
    }

    pause(): void {
        this.pauseCalls += 1
        this.paused = true
    }

    play(): Promise<void> {
        this.playCalls += 1
        const behavior = FakeAudio.playBehavior
        if (behavior === "throw") throw new Error("synchronous play failure")
        if (behavior === "not-allowed") {
            const err = new Error("play() blocked")
            err.name = "NotAllowedError"
            return Promise.reject(err)
        }
        if (behavior === "reject") {
            return Promise.reject(new Error("decode failure"))
        }
        const result = typeof behavior === "function" ? behavior(this) : Promise.resolve()
        return result.then(() => {
            this.paused = false
        })
    }

    dispatch(type: string): void {
        if (type === "loadedmetadata") this.readyState = 1
        const event = new Event(type)
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event)
        }
    }

    listenerCount(type: string): number {
        return this.listeners.get(type)?.size ?? 0
    }
}

const TRACK: Track = {
    id: "SCENE_1",
    title: "Scene 1",
    artist: "t",
    audioFile: "https://cdn.example/score.mp3",
}
const TRACK_2: Track = {
    id: "SCENE_2",
    title: "Scene 2",
    artist: "t",
    audioFile: "https://cdn.example/score-2.mp3",
}
const TRACK_3: Track = {
    id: "SCENE_3",
    title: "Scene 3",
    artist: "t",
    audioFile: "https://cdn.example/score-3.mp3",
}
const FALLBACK_TRACK: Track = {
    id: "SCENE_FALLBACK",
    title: "Fallback scene",
    artist: "t",
    audioFile: "https://legacy.example/ignored.mp3",
    fallbackSources: ["https://legacy.example/ignored-backup.mp3"],
    sources: [
        { url: " /scene/primary.webm ", type: "audio/webm" },
        { url: "http://localhost:3000/scene/primary.webm" },
        { url: "" },
        { url: "/scene/fallback.mp3", type: "audio/mpeg" },
    ],
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

const deferred = <T = void>() => {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

describe("SceneMixEngine", () => {
    let realAudio: typeof Audio

    beforeEach(() => {
        realAudio = globalThis.Audio
        vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio)
        FakeAudio.created = []
        FakeAudio.playBehavior = "resolve"
        FakeAudio.volumeWriteBehaviors = []
        analysisMocks.ensureSourceAnalysis.mockReset()
        analysisMocks.ensureSourceAnalysis.mockResolvedValue(null)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        globalThis.Audio = realAudio
    })

    it("does not set crossOrigin on deck elements by default", () => {
        const mix = createSceneMixEngine()
        mix.crossfadeTo(TRACK)
        expect(FakeAudio.created).toHaveLength(1)
        // A forced "anonymous" here turns non-CORS file hosts into hard media
        // errors — scores never play. The attribute must stay unset by default.
        expect(FakeAudio.created[0].crossOrigin).toBeNull()
        mix.dispose()
    })

    it("sets crossOrigin only when the host opts in", () => {
        const mix = createSceneMixEngine({ crossOrigin: "anonymous" })
        mix.crossfadeTo(TRACK)
        expect(FakeAudio.created[0].crossOrigin).toBe("anonymous")
        mix.dispose()
    })

    it("publishes immutable idle, loading, and playing snapshots in order", async () => {
        const pendingPlay = deferred()
        FakeAudio.playBehavior = () => pendingPlay.promise
        const mix = createSceneMixEngine()
        const snapshots: SceneMixStatusSnapshot[] = []
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))

        expect(snapshots).toEqual([mix.getStatusSnapshot()])
        expect(snapshots[0].state).toBe("idle")
        expect(Object.isFrozen(snapshots[0])).toBe(true)

        mix.crossfadeTo(TRACK)
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual(["idle", "loading"])
        expect(snapshots[1]).toMatchObject({
            requestedTrackKey: "id:SCENE_1",
            audibleTrackKey: null,
            failure: null,
        })

        pendingPlay.resolve()
        await flushMicrotasks()
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual(["idle", "loading", "playing"])
        expect(snapshots[2]).toMatchObject({
            requestedTrackKey: "id:SCENE_1",
            audibleTrackKey: "id:SCENE_1",
            failure: null,
        })
        expect(mix.getStatusSnapshot()).toBe(snapshots[2])
        mix.dispose()
    })

    it("normalizes playback failure without throwing from status listeners", () => {
        FakeAudio.playBehavior = "throw"
        const mix = createSceneMixEngine()
        const snapshots: SceneMixStatusSnapshot[] = []
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))
        mix.subscribeStatus(() => {
            throw new Error("host listener failed")
        })

        expect(() => mix.crossfadeTo(TRACK)).not.toThrow()
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual(["idle", "loading", "failed"])
        expect(snapshots[2]).toMatchObject({
            requestedTrackKey: "id:SCENE_1",
            audibleTrackKey: null,
            failure: {
                reason: "playback-failed",
                message: "synchronous play failure",
            },
        })
        expect(Object.isFrozen(snapshots[2].failure)).toBe(true)
        mix.dispose()
    })

    it("unsubscribe prevents future status notifications", async () => {
        const mix = createSceneMixEngine()
        const listener = vi.fn()
        const unsubscribe = mix.subscribeStatus(listener)
        expect(listener).toHaveBeenCalledTimes(1)

        unsubscribe()
        unsubscribe()
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        mix.stop(0)
        mix.dispose()

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it("replays stopped once to a listener subscribing after dispose", () => {
        const mix = createSceneMixEngine()
        mix.dispose()
        const listener = vi.fn()

        const unsubscribe = mix.subscribeStatus(listener)
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener.mock.calls[0][0]).toMatchObject({
            state: "stopped",
            requestedTrackKey: null,
            audibleTrackKey: null,
        })

        expect(() => unsubscribe()).not.toThrow()
        mix.crossfadeTo(TRACK)
        mix.stop(0)
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it("publishes one consistent stopped snapshot across stop and dispose", async () => {
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        const snapshots: SceneMixStatusSnapshot[] = []
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))

        mix.stop(0)
        const stoppedSnapshot = mix.getStatusSnapshot()
        mix.stop(0)
        mix.dispose()

        expect(snapshots.map((snapshot) => snapshot.state)).toEqual(["playing", "stopped"])
        expect(stoppedSnapshot).toMatchObject({
            requestedTrackKey: null,
            audibleTrackKey: null,
            failure: null,
        })
        expect(mix.getStatusSnapshot()).toBe(stoppedSnapshot)
    })

    it("preserves the audible deck when replacement play() throws synchronously", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)
        const survivor = FakeAudio.created[0]

        FakeAudio.playBehavior = "throw"
        mix.crossfadeTo(TRACK_2)

        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(survivor.volume).toBe(1)
        expect(FakeAudio.created[1].src).toBe("")
        mix.dispose()
    })

    it("preserves the audible deck when replacement play() rejects", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)
        const survivor = FakeAudio.created[0]

        FakeAudio.playBehavior = "reject"
        mix.crossfadeTo(TRACK_2)
        await flushMicrotasks()

        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(survivor.volume).toBe(1)
        expect(FakeAudio.created[1].src).toBe("")
        mix.dispose()
    })

    it("rolls back a pending media error without fading the survivor", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)
        const survivor = FakeAudio.created[0]
        const pendingPlay = deferred()

        FakeAudio.playBehavior = () => pendingPlay.promise
        mix.crossfadeTo(TRACK_2)
        const incoming = FakeAudio.created[1]
        incoming.error = { code: 3, message: "" } as MediaError
        incoming.dispatch("error")

        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(survivor.volume).toBe(1)
        expect(incoming.src).toBe("")
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "failed",
            requestedTrackKey: "id:SCENE_2",
            audibleTrackKey: "id:SCENE_1",
            failure: {
                reason: "media-error",
                message: "Audio decoding failed. (MediaError code 3)",
            },
        })
        expect(incoming.listenerCount("error")).toBe(0)
        expect(incoming.listenerCount("loadedmetadata")).toBe(0)

        const failedSnapshot = mix.getStatusSnapshot()
        incoming.dispatch("error")
        incoming.dispatch("loadedmetadata")
        expect(mix.getStatusSnapshot()).toBe(failedSnapshot)

        // A late play resolution from the failed deck cannot seize ownership.
        pendingPlay.resolve()
        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        mix.dispose()
    })

    it("recovers the outgoing deck from a media error just after commit", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 1000 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(1100)
        const survivor = FakeAudio.created[0]

        mix.crossfadeTo(TRACK_2)
        await flushMicrotasks()
        const incoming = FakeAudio.created[1]
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_2")

        incoming.dispatch("error")
        vi.advanceTimersByTime(1100)

        expect(incoming.src).toBe("")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(survivor.volume).toBe(1)
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "failed",
            requestedTrackKey: "id:SCENE_2",
            audibleTrackKey: "id:SCENE_1",
            failure: { reason: "media-error" },
        })
        mix.dispose()
    })

    it("keeps the prior deck audible while blocked and commits one gesture retry", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)
        const survivor = FakeAudio.created[0]
        const snapshots: SceneMixStatusSnapshot[] = []
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))

        FakeAudio.playBehavior = "not-allowed"
        mix.crossfadeTo(TRACK_2)
        await flushMicrotasks()
        const incoming = FakeAudio.created[1]

        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(survivor.volume).toBe(1)
        expect(incoming.volume).toBe(0)
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "playing",
            "loading",
            "autoplay-blocked",
        ])
        expect(snapshots[2]).toMatchObject({
            requestedTrackKey: "id:SCENE_2",
            audibleTrackKey: "id:SCENE_1",
            failure: null,
        })

        FakeAudio.playBehavior = "resolve"
        document.dispatchEvent(new Event("pointerdown"))
        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_2")
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "playing",
            "loading",
            "autoplay-blocked",
            "playing",
        ])

        // The one-shot listeners were removed by the successful commit.
        document.dispatchEvent(new Event("keydown"))
        await flushMicrotasks()
        expect(incoming.playCalls).toBe(2)

        vi.advanceTimersByTime(40)
        expect(survivor.pauseCalls).toBe(1)
        expect(incoming.paused).toBe(false)
        mix.dispose()
    })

    it("re-arms policy failures but rolls back a non-policy gesture failure", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)
        const survivor = FakeAudio.created[0]

        FakeAudio.playBehavior = "not-allowed"
        mix.crossfadeTo(TRACK_2)
        await flushMicrotasks()
        const incoming = FakeAudio.created[1]
        const blockedSnapshot = mix.getStatusSnapshot()

        document.dispatchEvent(new Event("pointerdown"))
        await flushMicrotasks()
        expect(incoming.playCalls).toBe(2)
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(mix.getStatusSnapshot()).toBe(blockedSnapshot)

        FakeAudio.playBehavior = "reject"
        document.dispatchEvent(new Event("keydown"))
        await flushMicrotasks()

        expect(incoming.playCalls).toBe(3)
        expect(incoming.src).toBe("")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "failed",
            requestedTrackKey: "id:SCENE_2",
            audibleTrackKey: "id:SCENE_1",
            failure: { reason: "playback-failed" },
        })
        mix.dispose()
    })

    it("does not let a superseded A-to-B attempt restore B over C", async () => {
        vi.useFakeTimers()
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)
        const delayedB = deferred()
        const delayedC = deferred()
        const snapshots: SceneMixStatusSnapshot[] = []
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))

        FakeAudio.playBehavior = () => delayedB.promise
        mix.crossfadeTo(FALLBACK_TRACK)
        const deckB = FakeAudio.created[1]

        FakeAudio.playBehavior = () => delayedC.promise
        mix.crossfadeTo(TRACK_3)
        delayedB.reject(new Error("stale B failure"))
        await flushMicrotasks()
        expect(deckB.src).toBe("")
        expect(FakeAudio.created).toHaveLength(3)
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "loading",
            requestedTrackKey: "id:SCENE_3",
            audibleTrackKey: "id:SCENE_1",
            failure: null,
        })
        expect(snapshots.some((snapshot) => snapshot.state === "failed")).toBe(false)

        delayedC.resolve()
        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_3")
        expect(deckB.pauseCalls).toBe(1)
        vi.advanceTimersByTime(40)
        expect(FakeAudio.created[2].paused).toBe(false)
        mix.dispose()
    })

    it("handles blocked initial playback and a terminal retry failure safely", async () => {
        FakeAudio.playBehavior = "not-allowed"
        const mix = createSceneMixEngine()
        mix.crossfadeTo(TRACK)
        await flush()
        const incoming = FakeAudio.created[0]

        expect(mix.getCurrentTrackKey()).toBeNull()
        expect(incoming.src).not.toBe("")

        FakeAudio.playBehavior = "reject"
        document.dispatchEvent(new Event("pointerdown"))
        await flush()
        expect(mix.getCurrentTrackKey()).toBeNull()
        expect(incoming.src).toBe("")
        mix.dispose()
    })

    it("dispose cancels gesture retries and tears down active and pending decks", async () => {
        const mix = createSceneMixEngine({ fadeMs: 0 })
        mix.crossfadeTo(TRACK)
        await flush()
        const active = FakeAudio.created[0]

        FakeAudio.playBehavior = "not-allowed"
        mix.crossfadeTo(TRACK_2)
        await flush()
        const pending = FakeAudio.created[1]
        const snapshots: SceneMixStatusSnapshot[] = []
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))
        mix.dispose()

        document.dispatchEvent(new Event("pointerdown"))
        await flush()
        expect(active.src).toBe("")
        expect(pending.src).toBe("")
        expect(active.pauseCalls).toBeGreaterThan(0)
        expect(pending.pauseCalls).toBeGreaterThan(0)
        expect(pending.playCalls).toBe(1)
        expect(mix.getCurrentTrackKey()).toBeNull()
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual(["autoplay-blocked", "stopped"])
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "stopped",
            requestedTrackKey: null,
            audibleTrackKey: null,
            failure: null,
        })
    })

    it("uses authoritative normalized sources and reports a successful fallback", async () => {
        const fallbackEvents: FallbackSourceEvent[] = []
        const mix = createSceneMixEngine({
            fadeMs: 0,
            onFallbackSource: (event) => {
                fallbackEvents.push(event)
                throw new Error("host fallback listener failed")
            },
        })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        const survivor = FakeAudio.created[0]

        FakeAudio.playBehavior = (audio) => {
            if (audio.src.endsWith("/scene/primary.webm")) {
                const error = new Error("primary unsupported")
                error.name = "NotSupportedError"
                throw error
            }
            return Promise.resolve()
        }
        mix.crossfadeTo(FALLBACK_TRACK)

        expect(FakeAudio.created).toHaveLength(3)
        expect(FakeAudio.created[1].src).toBe("")
        expect(FakeAudio.created[2].src).toBe("http://localhost:3000/scene/fallback.mp3")
        expect(FakeAudio.created.some((audio) => audio.src.includes("legacy.example"))).toBe(false)
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(fallbackEvents).toEqual([
            {
                failedSource: "http://localhost:3000/scene/primary.webm",
                nextSource: "http://localhost:3000/scene/fallback.mp3",
                nextSourceType: "audio/mpeg",
                sourceIndex: 1,
                sourceCount: 2,
                error: "src-not-supported",
            },
        ])
        expect(Object.isFrozen(fallbackEvents[0])).toBe(true)

        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_FALLBACK")
        expect(mix.getStatusSnapshot().state).toBe("playing")
        mix.dispose()
    })

    it("advances network, decode, and media failures without accepting stale events", async () => {
        const primaryPlay = deferred()
        const mediaPlay = deferred()
        const fallbackEvents: FallbackSourceEvent[] = []
        const track: Track = {
            id: "FAILURE_CHAIN",
            title: "Failure chain",
            artist: "t",
            sources: [
                { url: "/chain/network.mp3" },
                { url: "/chain/decode.mp3" },
                { url: "/chain/media.mp3" },
                { url: "/chain/working.mp3" },
            ],
        }
        FakeAudio.playBehavior = (audio) => {
            if (audio.src.endsWith("/chain/network.mp3")) return primaryPlay.promise
            if (audio.src.endsWith("/chain/decode.mp3")) {
                const error = new Error("decode rejected")
                error.name = "EncodingError"
                return Promise.reject(error)
            }
            if (audio.src.endsWith("/chain/media.mp3")) return mediaPlay.promise
            return Promise.resolve()
        }
        const mix = createSceneMixEngine({
            onFallbackSource: (event) => fallbackEvents.push(event),
        })

        mix.crossfadeTo(track)
        const networkDeck = FakeAudio.created[0]
        networkDeck.error = { code: 2, message: "" } as MediaError
        networkDeck.dispatch("error")
        await flushMicrotasks()
        const mediaDeck = FakeAudio.created[2]
        mediaDeck.error = { code: 3, message: "" } as MediaError
        mediaDeck.dispatch("error")
        await flushMicrotasks()

        expect(FakeAudio.created.map((audio) => audio.src)).toEqual([
            "",
            "",
            "",
            "http://localhost:3000/chain/working.mp3",
        ])
        expect(fallbackEvents.map((event) => event.error)).toEqual(["network", "decode", "decode"])
        expect(mix.getCurrentTrackKey()).toBe("id:FAILURE_CHAIN")

        const settledSnapshot = mix.getStatusSnapshot()
        primaryPlay.resolve()
        mediaPlay.reject(new Error("late media play rejection"))
        networkDeck.dispatch("error")
        mediaDeck.dispatch("loadedmetadata")
        await flushMicrotasks()
        expect(FakeAudio.created).toHaveLength(4)
        expect(mix.getStatusSnapshot()).toBe(settledSnapshot)
        mix.dispose()
    })

    it("does not consume a fallback while autoplay is blocked", async () => {
        const fallbackEvents: FallbackSourceEvent[] = []
        FakeAudio.playBehavior = "not-allowed"
        const mix = createSceneMixEngine({
            onFallbackSource: (event) => fallbackEvents.push(event),
        })

        mix.crossfadeTo(FALLBACK_TRACK)
        await flushMicrotasks()
        const primary = FakeAudio.created[0]
        expect(primary.src).toBe("http://localhost:3000/scene/primary.webm")
        expect(FakeAudio.created).toHaveLength(1)
        expect(fallbackEvents).toHaveLength(0)
        expect(mix.getStatusSnapshot().state).toBe("autoplay-blocked")

        FakeAudio.playBehavior = (audio) =>
            audio === primary ? Promise.reject(new Error("retry failed")) : Promise.resolve()
        document.dispatchEvent(new Event("pointerdown"))
        await flushMicrotasks()

        expect(primary.playCalls).toBe(2)
        expect(FakeAudio.created).toHaveLength(2)
        expect(fallbackEvents).toHaveLength(1)
        expect(fallbackEvents[0].sourceIndex).toBe(1)
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_FALLBACK")
        mix.dispose()
    })

    it("publishes one terminal failure after every candidate fails and preserves the survivor", async () => {
        const fallbackEvents: FallbackSourceEvent[] = []
        const snapshots: SceneMixStatusSnapshot[] = []
        const track: Track = {
            id: "ALL_FAILED",
            title: "All failed",
            artist: "t",
            audioFile: "/failed/primary.mp3",
            fallbackSources: [
                " ",
                "http://localhost:3000/failed/primary.mp3",
                "/failed/second.mp3",
                "/failed/third.mp3",
            ],
        }
        const mix = createSceneMixEngine({
            fadeMs: 0,
            onFallbackSource: (event) => fallbackEvents.push(event),
        })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        const survivor = FakeAudio.created[0]
        mix.subscribeStatus((snapshot) => snapshots.push(snapshot))

        FakeAudio.playBehavior = "throw"
        mix.crossfadeTo(track)

        expect(fallbackEvents).toHaveLength(2)
        expect(FakeAudio.created).toHaveLength(4)
        expect(FakeAudio.created.slice(1).every((audio) => audio.src === "")).toBe(true)
        expect(snapshots.filter((snapshot) => snapshot.state === "failed")).toHaveLength(1)
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "failed",
            requestedTrackKey: "id:ALL_FAILED",
            audibleTrackKey: "id:SCENE_1",
        })
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        mix.dispose()
    })

    it("recovers the outgoing deck while an active source moves to its fallback", async () => {
        const fallbackPlay = deferred()
        const fallbackEvents: FallbackSourceEvent[] = []
        const mix = createSceneMixEngine({
            fadeMs: 1000,
            onFallbackSource: (event) => fallbackEvents.push(event),
        })
        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        const survivor = FakeAudio.created[0]

        mix.crossfadeTo(FALLBACK_TRACK)
        await flushMicrotasks()
        const selectedPrimary = FakeAudio.created[1]
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_FALLBACK")

        FakeAudio.playBehavior = () => fallbackPlay.promise
        selectedPrimary.error = { code: 2, message: "" } as MediaError
        selectedPrimary.dispatch("error")
        const selectedFallback = FakeAudio.created[2]

        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(survivor.paused).toBe(false)
        expect(survivor.pauseCalls).toBe(0)
        expect(selectedFallback.src).toBe("http://localhost:3000/scene/fallback.mp3")
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "loading",
            requestedTrackKey: "id:SCENE_FALLBACK",
            audibleTrackKey: "id:SCENE_1",
        })
        expect(fallbackEvents).toHaveLength(1)

        fallbackPlay.resolve()
        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_FALLBACK")
        mix.dispose()
    })

    it("tears down a pending fallback and ignores late candidate work on dispose", async () => {
        const primaryPlay = deferred()
        const fallbackPlay = deferred()
        const fallbackEvents: FallbackSourceEvent[] = []
        FakeAudio.playBehavior = (audio) =>
            audio.src.endsWith("/scene/primary.webm") ? primaryPlay.promise : fallbackPlay.promise
        const mix = createSceneMixEngine({
            onFallbackSource: (event) => fallbackEvents.push(event),
        })

        mix.crossfadeTo(FALLBACK_TRACK)
        const primary = FakeAudio.created[0]
        primary.dispatch("error")
        const fallback = FakeAudio.created[1]
        mix.dispose()
        const stoppedSnapshot = mix.getStatusSnapshot()

        primaryPlay.resolve()
        fallbackPlay.resolve()
        primary.dispatch("error")
        fallback.dispatch("error")
        fallback.dispatch("loadedmetadata")
        document.dispatchEvent(new Event("pointerdown"))
        await flushMicrotasks()

        expect(fallbackEvents).toHaveLength(1)
        expect(FakeAudio.created).toHaveLength(2)
        expect(primary.src).toBe("")
        expect(fallback.src).toBe("")
        expect(primary.listenerCount("error")).toBe(0)
        expect(fallback.listenerCount("error")).toBe(0)
        expect(mix.getStatusSnapshot()).toBe(stoppedSnapshot)
    })

    it("skips silence analysis in off mode", async () => {
        const mix = createSceneMixEngine({ analysisPolicy: "off" })

        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        const deck = FakeAudio.created[0]
        deck.dispatch("loadedmetadata")

        expect(analysisMocks.ensureSourceAnalysis).not.toHaveBeenCalled()
        expect(deck.currentTime).toBe(0)
        expect(deck.currentTimeWrites).toHaveLength(0)
        expect(mix.getStatusSnapshot().state).toBe("playing")
        mix.dispose()
    })

    it("applies a supplied trim after metadata and performs no analysis", async () => {
        const mix = createSceneMixEngine()

        mix.crossfadeTo(TRACK, { trimStartMs: 2500 })
        const deck = FakeAudio.created[0]
        deck.duration = 20
        expect(deck.playCalls).toBe(0)
        expect(analysisMocks.ensureSourceAnalysis).not.toHaveBeenCalled()

        deck.dispatch("loadedmetadata")
        expect(deck.currentTime).toBe(2.5)
        expect(deck.currentTimeWrites).toEqual([2.5])
        expect(deck.playCalls).toBe(1)
        await flushMicrotasks()
        expect(mix.getStatusSnapshot().state).toBe("playing")

        mix.crossfadeTo(TRACK_2, { trimStartMs: 0 })
        await flushMicrotasks()
        expect(FakeAudio.created[1].playCalls).toBe(1)
        expect(analysisMocks.ensureSourceAnalysis).not.toHaveBeenCalled()

        mix.crossfadeTo(TRACK_3, { trimStartMs: 30_000 })
        const outOfRangeDeck = FakeAudio.created[2]
        outOfRangeDeck.duration = 20
        expect(outOfRangeDeck.playCalls).toBe(0)
        outOfRangeDeck.dispatch("loadedmetadata")
        expect(outOfRangeDeck.currentTimeWrites).toHaveLength(0)
        expect(outOfRangeDeck.playCalls).toBe(1)
        await flushMicrotasks()
        expect(analysisMocks.ensureSourceAnalysis).not.toHaveBeenCalled()
        mix.dispose()
    })

    it("applies automatic source analysis before a pending play commits", async () => {
        const pendingPlay = deferred()
        FakeAudio.playBehavior = () => pendingPlay.promise
        analysisMocks.ensureSourceAnalysis.mockResolvedValueOnce({
            trimStartMs: 1500,
            trimEndMs: 0,
        })
        const mix = createSceneMixEngine()

        mix.crossfadeTo(TRACK)
        const deck = FakeAudio.created[0]
        deck.duration = 20
        deck.dispatch("loadedmetadata")
        await flushMicrotasks()

        expect(analysisMocks.ensureSourceAnalysis).toHaveBeenCalledWith(
            "https://cdn.example/score.mp3"
        )
        expect(deck.currentTime).toBe(1.5)
        pendingPlay.resolve()
        await flushMicrotasks()
        expect(mix.getStatusSnapshot().state).toBe("playing")
        mix.dispose()
    })

    it("keeps playback at natural start when automatic analysis returns no trim", async () => {
        const mix = createSceneMixEngine()

        mix.crossfadeTo(TRACK_2)
        await flushMicrotasks()
        const naturalDeck = FakeAudio.created[0]
        naturalDeck.dispatch("loadedmetadata")
        await flushMicrotasks()

        expect(naturalDeck.currentTime).toBe(0)
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "playing",
            failure: null,
        })
        mix.dispose()
    })

    it("does not gate streaming playback on slow automatic analysis", async () => {
        const slowAnalysis = deferred<TrackTrims | null>()
        analysisMocks.ensureSourceAnalysis.mockReturnValue(slowAnalysis.promise)
        const mix = createSceneMixEngine()

        mix.crossfadeTo(TRACK)
        const deck = FakeAudio.created[0]
        expect(deck.playCalls).toBe(1)
        await flushMicrotasks()
        expect(mix.getStatusSnapshot().state).toBe("playing")

        deck.duration = 20
        deck.dispatch("loadedmetadata")
        slowAnalysis.resolve({ trimStartMs: 2000, trimEndMs: 0 })
        await flushMicrotasks()

        expect(deck.currentTime).toBe(0)
        expect(deck.currentTimeWrites).toHaveLength(0)
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "playing",
            failure: null,
        })
        mix.dispose()
    })

    it("applies analysis only from the fallback source that remains selected", async () => {
        const primaryAnalysis = deferred<TrackTrims | null>()
        const fallbackAnalysis = deferred<TrackTrims | null>()
        const primaryPlay = deferred()
        const fallbackPlay = deferred()
        analysisMocks.ensureSourceAnalysis.mockImplementation((url: string) =>
            url.endsWith("/scene/primary.webm") ? primaryAnalysis.promise : fallbackAnalysis.promise
        )
        FakeAudio.playBehavior = (audio) =>
            audio.src.endsWith("/scene/primary.webm") ? primaryPlay.promise : fallbackPlay.promise
        const mix = createSceneMixEngine()

        mix.crossfadeTo(FALLBACK_TRACK)
        const primary = FakeAudio.created[0]
        primary.duration = 30
        primary.dispatch("loadedmetadata")
        primary.error = { code: 2, message: "" } as MediaError
        primary.dispatch("error")
        const fallback = FakeAudio.created[1]
        fallback.duration = 30
        fallback.dispatch("loadedmetadata")

        fallbackAnalysis.resolve({ trimStartMs: 3000, trimEndMs: 0 })
        await flushMicrotasks()
        expect(fallback.currentTime).toBe(3)
        expect(analysisMocks.ensureSourceAnalysis.mock.calls.map(([url]) => url)).toEqual([
            "http://localhost:3000/scene/primary.webm",
            "http://localhost:3000/scene/fallback.mp3",
        ])

        primaryAnalysis.resolve({ trimStartMs: 9000, trimEndMs: 0 })
        await flushMicrotasks()
        expect(primary.currentTimeWrites).toHaveLength(0)
        expect(fallback.currentTime).toBe(3)

        fallbackPlay.resolve()
        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_FALLBACK")
        primaryPlay.resolve()
        await flushMicrotasks()
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_FALLBACK")
        mix.dispose()
    })

    it("ignores late analysis after supersession and disposal", async () => {
        const staleAnalysis = deferred<TrackTrims | null>()
        const currentAnalysis = deferred<TrackTrims | null>()
        const stalePlay = deferred()
        const currentPlay = deferred()
        analysisMocks.ensureSourceAnalysis.mockImplementation((url: string) =>
            url.endsWith("score-2.mp3") ? staleAnalysis.promise : currentAnalysis.promise
        )
        FakeAudio.playBehavior = (audio) =>
            audio.src.endsWith("score-2.mp3") ? stalePlay.promise : currentPlay.promise
        const mix = createSceneMixEngine()

        mix.crossfadeTo(TRACK_2)
        const staleDeck = FakeAudio.created[0]
        staleDeck.duration = 20
        staleDeck.dispatch("loadedmetadata")
        mix.crossfadeTo(TRACK_3)
        const currentDeck = FakeAudio.created[1]
        currentDeck.duration = 20
        currentDeck.dispatch("loadedmetadata")

        staleAnalysis.resolve({ trimStartMs: 4000, trimEndMs: 0 })
        stalePlay.resolve()
        await flushMicrotasks()
        expect(staleDeck.currentTimeWrites).toHaveLength(0)
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "loading",
            requestedTrackKey: "id:SCENE_3",
        })

        mix.dispose()
        const stoppedSnapshot = mix.getStatusSnapshot()
        currentAnalysis.resolve({ trimStartMs: 6000, trimEndMs: 0 })
        currentPlay.resolve()
        await flushMicrotasks()
        expect(currentDeck.currentTimeWrites).toHaveLength(0)
        expect(mix.getStatusSnapshot()).toBe(stoppedSnapshot)
    })

    it("keeps volume-lock detection isolated between engine instances", async () => {
        vi.useFakeTimers()
        FakeAudio.volumeWriteBehaviors = ["ignore", "normal"]
        const lockedMix = createSceneMixEngine({ fadeMs: 0 })

        expect(lockedMix.getVolumeWritesUnsupported()).toBe(false)
        lockedMix.crossfadeTo(TRACK)

        const independentMix = createSceneMixEngine({ fadeMs: 0 })
        expect(independentMix.getVolumeWritesUnsupported()).toBe(false)
        independentMix.setLevel(0.4)
        independentMix.crossfadeTo(TRACK_2)
        await flushMicrotasks()
        vi.advanceTimersByTime(40)

        expect(lockedMix.getVolumeWritesUnsupported()).toBe(true)
        expect(independentMix.getVolumeWritesUnsupported()).toBe(false)
        expect(FakeAudio.created[0].volume).toBe(1)
        expect(FakeAudio.created[1].volume).toBeCloseTo(0.4)

        lockedMix.dispose()
        independentMix.dispose()
    })

    it("hard-swaps at native volume and preserves mute after detecting a lock", async () => {
        vi.useFakeTimers()
        FakeAudio.volumeWriteBehaviors = ["ignore", "normal"]
        const mix = createSceneMixEngine({ fadeMs: 2000 })

        mix.crossfadeTo(TRACK)
        await flushMicrotasks()
        const outgoing = FakeAudio.created[0]
        expect(mix.getVolumeWritesUnsupported()).toBe(true)

        mix.setMuted(true)
        mix.crossfadeTo(TRACK_2)
        await flushMicrotasks()
        const incoming = FakeAudio.created[1]
        expect(incoming.volume).toBe(1)
        expect(incoming.muted).toBe(true)

        // The old deck is released on the first tick, not after the configured
        // two-second fade that cannot be expressed on a locked element.
        vi.advanceTimersByTime(40)
        expect(outgoing.pauseCalls).toBeGreaterThan(0)
        expect(outgoing.src).toBe("")
        expect(incoming.paused).toBe(false)
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_2")

        mix.setMuted(false)
        expect(incoming.muted).toBe(false)
        mix.dispose()
    })
})
