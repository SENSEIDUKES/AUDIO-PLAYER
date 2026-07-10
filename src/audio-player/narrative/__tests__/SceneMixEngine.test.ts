// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSceneMixEngine } from "../SceneMixEngine"
import type { Track } from "../../types"

/**
 * Minimal Audio stand-in: enough surface for SceneMixEngine's deck lifecycle,
 * with a controllable play() so tests can simulate autoplay policy.
 */
class FakeAudio {
    static created: FakeAudio[] = []
    static playBehavior: "resolve" | "not-allowed" = "resolve"

    loop = false
    preload = ""
    crossOrigin: string | null = null
    muted = false
    volume = 1
    paused = true
    readyState = 0
    currentTime = 0
    src = ""
    playCalls = 0

    private listeners = new Map<string, Set<EventListener>>()

    constructor() {
        FakeAudio.created.push(this)
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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("SceneMixEngine", () => {
    let realAudio: typeof Audio

    beforeEach(() => {
        realAudio = globalThis.Audio
        vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio)
        FakeAudio.created = []
        FakeAudio.playBehavior = "resolve"
    })

    afterEach(() => {
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
})
