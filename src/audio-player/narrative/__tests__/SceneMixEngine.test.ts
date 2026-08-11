// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSceneMixEngine } from "../SceneMixEngine"
import type { SceneMixStatusSnapshot } from "../SceneMixEngine"
import type { Track } from "../../types"

type VolumeWriteBehavior = "normal" | "ignore" | "throw"
type PlayBehavior = "resolve" | "not-allowed" | "reject" | "throw" | (() => Promise<void>)

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
    currentTime = 0
    src = ""
    error: MediaError | null = null
    playCalls = 0
    pauseCalls = 0

    private readonly volumeWriteBehavior: VolumeWriteBehavior
    private volumeValue = 1
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

    addEventListener(
        type: string,
        cb: EventListener,
        options?: AddEventListenerOptions | boolean
    ): void {
        const signal = typeof options === "object" ? options.signal : undefined
        if (signal?.aborted) return
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(cb)
        signal?.addEventListener(
            "abort",
            () => this.listeners.get(type)?.delete(cb),
            { once: true }
        )
    }

    removeEventListener(type: string, cb: EventListener): void {
        this.listeners.get(type)?.delete(cb)
    }

    removeAttribute(): void {
        this.src = ""
    }

    load(): void {}

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
        const result = typeof behavior === "function" ? behavior() : Promise.resolve()
        return result.then(() => {
            this.paused = false
        })
    }

    dispatch(type: string): void {
        const event = new Event(type)
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event)
        }
    }

    listenerCount(type: string): number {
        return this.listeners.get(type)?.size ?? 0
    }
}

const TRACK: Track = { id: "SCENE_1", title: "Scene 1", artist: "t", audioFile: "https://cdn.example/score.mp3" }
const TRACK_2: Track = { id: "SCENE_2", title: "Scene 2", artist: "t", audioFile: "https://cdn.example/score-2.mp3" }
const TRACK_3: Track = { id: "SCENE_3", title: "Scene 3", artist: "t", audioFile: "https://cdn.example/score-3.mp3" }

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

const deferred = () => {
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
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
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "idle",
            "loading",
        ])
        expect(snapshots[1]).toMatchObject({
            requestedTrackKey: "id:SCENE_1",
            audibleTrackKey: null,
            failure: null,
        })

        pendingPlay.resolve()
        await flushMicrotasks()
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "idle",
            "loading",
            "playing",
        ])
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
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "idle",
            "loading",
            "failed",
        ])
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

        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "playing",
            "stopped",
        ])
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
        mix.crossfadeTo(TRACK_2)
        const deckB = FakeAudio.created[1]

        FakeAudio.playBehavior = () => delayedC.promise
        mix.crossfadeTo(TRACK_3)
        delayedB.reject(new Error("stale B failure"))
        await flushMicrotasks()
        expect(deckB.src).toBe("")
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "loading",
            requestedTrackKey: "id:SCENE_3",
            audibleTrackKey: "id:SCENE_1",
            failure: null,
        })
        expect(snapshots.some((snapshot) => snapshot.state === "failed")).toBe(
            false
        )

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
        expect(snapshots.map((snapshot) => snapshot.state)).toEqual([
            "autoplay-blocked",
            "stopped",
        ])
        expect(mix.getStatusSnapshot()).toMatchObject({
            state: "stopped",
            requestedTrackKey: null,
            audibleTrackKey: null,
            failure: null,
        })
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
