// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSceneMixEngine } from "../SceneMixEngine"
import type { Track } from "../../types"

type VolumeWriteBehavior = "normal" | "ignore" | "throw"

/**
 * Minimal Audio stand-in: enough surface for SceneMixEngine's deck lifecycle,
 * with a controllable play() so tests can simulate autoplay policy.
 */
class FakeAudio {
    static created: FakeAudio[] = []
    static playBehavior: "resolve" | "not-allowed" = "resolve"
    static volumeWriteBehaviors: VolumeWriteBehavior[] = []

    loop = false
    preload = ""
    crossOrigin: string | null = null
    muted = false
    paused = true
    readyState = 0
    currentTime = 0
    src = ""
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

    addEventListener(type: string, cb: EventListener): void {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(cb)
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
        if (FakeAudio.playBehavior === "not-allowed") {
            const err = new Error("play() blocked")
            err.name = "NotAllowedError"
            return Promise.reject(err)
        }
        this.paused = false
        return Promise.resolve()
    }
}

const TRACK: Track = { id: "SCENE_1", title: "Scene 1", artist: "t", audioFile: "https://cdn.example/score.mp3" }
const TRACK_2: Track = { id: "SCENE_2", title: "Scene 2", artist: "t", audioFile: "https://cdn.example/score-2.mp3" }

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

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

    it("keeps a NotAllowedError deck and retries it on the first user gesture", async () => {
        FakeAudio.playBehavior = "not-allowed"
        const mix = createSceneMixEngine()
        mix.crossfadeTo(TRACK)
        await flush()

        // Deck survives the rejection (autoplay policy is "not yet", not "no").
        expect(mix.getCurrentTrackKey()).toBe("id:SCENE_1")
        const deck = FakeAudio.created[0]
        expect(deck.playCalls).toBe(1)

        // First user gesture retries the active deck.
        FakeAudio.playBehavior = "resolve"
        document.dispatchEvent(new Event("pointerdown"))
        await flush()
        expect(deck.playCalls).toBe(2)
        expect(deck.paused).toBe(false)
        mix.dispose()
    })

    it("re-arms when the gesture retry is itself rejected", async () => {
        FakeAudio.playBehavior = "not-allowed"
        const mix = createSceneMixEngine()
        mix.crossfadeTo(TRACK)
        await flush()
        const deck = FakeAudio.created[0]

        // Still blocked on the first gesture…
        document.dispatchEvent(new Event("pointerdown"))
        await flush()
        expect(deck.playCalls).toBe(2)
        expect(deck.paused).toBe(true)

        // …then a later gesture succeeds.
        FakeAudio.playBehavior = "resolve"
        document.dispatchEvent(new Event("keydown"))
        await flush()
        expect(deck.playCalls).toBe(3)
        expect(deck.paused).toBe(false)
        mix.dispose()
    })

    it("still releases the deck on non-policy play() failures", async () => {
        const mix = createSceneMixEngine()
        const original = FakeAudio.prototype.play
        FakeAudio.prototype.play = function () {
            this.playCalls += 1
            return Promise.reject(new Error("decode failure"))
        }
        mix.crossfadeTo(TRACK)
        await flush()
        expect(mix.getCurrentTrackKey()).toBeNull()
        FakeAudio.prototype.play = original
        mix.dispose()
    })

    it("dispose removes armed gesture listeners", async () => {
        FakeAudio.playBehavior = "not-allowed"
        const mix = createSceneMixEngine()
        mix.crossfadeTo(TRACK)
        await flush()
        const deck = FakeAudio.created[0]
        mix.dispose()

        document.dispatchEvent(new Event("pointerdown"))
        await flush()
        // No retry after dispose — the listener is gone.
        expect(deck.playCalls).toBe(1)
    })

    it("keeps volume-lock detection isolated between engine instances", () => {
        vi.useFakeTimers()
        FakeAudio.volumeWriteBehaviors = ["ignore", "normal"]
        const lockedMix = createSceneMixEngine({ fadeMs: 0 })

        expect(lockedMix.getVolumeWritesUnsupported()).toBe(false)
        lockedMix.crossfadeTo(TRACK)

        const independentMix = createSceneMixEngine({ fadeMs: 0 })
        expect(independentMix.getVolumeWritesUnsupported()).toBe(false)
        independentMix.setLevel(0.4)
        independentMix.crossfadeTo(TRACK_2)
        vi.advanceTimersByTime(40)

        expect(lockedMix.getVolumeWritesUnsupported()).toBe(true)
        expect(independentMix.getVolumeWritesUnsupported()).toBe(false)
        expect(FakeAudio.created[0].volume).toBe(1)
        expect(FakeAudio.created[1].volume).toBeCloseTo(0.4)

        lockedMix.dispose()
        independentMix.dispose()
    })

    it("hard-swaps at native volume and preserves mute after detecting a lock", () => {
        vi.useFakeTimers()
        FakeAudio.volumeWriteBehaviors = ["ignore", "normal"]
        const mix = createSceneMixEngine({ fadeMs: 2000 })

        mix.crossfadeTo(TRACK)
        const outgoing = FakeAudio.created[0]
        expect(mix.getVolumeWritesUnsupported()).toBe(true)

        mix.setMuted(true)
        mix.crossfadeTo(TRACK_2)
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
