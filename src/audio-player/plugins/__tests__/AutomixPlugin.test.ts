/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createAutomixPlugin } from "../AutomixPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"
import type { AudioPlayerEngine } from "../../types"
import * as trackAnalysis from "../../automix/trackAnalysis"
import {
    createMockAudioEngine,
    createMockPluginContext,
    createMockTrack,
    type MockAudioEngine,
} from "../../testing/testMocks"

interface AutomixPluginInternal {
    deck: (MockAudio & HTMLAudioElement) | null
    phase: "idle" | "preloading" | "fading" | "handoff"
    preloadedKey: string | null
    transitioning: boolean
}

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureTrackAnalysis: vi.fn().mockResolvedValue(undefined),
    getTrackTrims: vi.fn().mockReturnValue({ trimStartMs: 0, trimEndMs: 0 }),
}))

vi.mock("../../automix/trackAnalysis", () => ({
    ensureProTrackAnalysis: vi.fn().mockResolvedValue(undefined),
    getTrackAnalysis: vi.fn().mockReturnValue(null), // simulate light mode by default
}))

vi.mock("../../automix/transitionPlanner", () => ({
    planTransition: vi.fn(),
}))

vi.mock("../../utils/sources", () => ({
    getPrimaryTrackSource: vi.fn().mockReturnValue("blob:test"),
}))

type EventCallback = (event?: unknown) => void

// Mock global Audio
class MockAudio {
    preload: string = ""
    volume: number = 1
    src: string = ""
    currentTime: number = 0
    muted: boolean = false
    readyState: number = 0
    listeners: Record<string, EventCallback[]> = {}

    addEventListener(event: string, callback: EventCallback) {
        if (!this.listeners[event]) this.listeners[event] = []
        this.listeners[event].push(callback)
    }

    removeEventListener(event: string, callback: EventCallback) {
        if (!this.listeners[event]) return
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback)
    }

    play() {
        return Promise.resolve()
    }
    pause() {}
    load() {}
    removeAttribute() {}

    // Test helper to trigger events
    _trigger(event: string) {
        this.listeners[event]?.forEach((cb) => cb())
    }
}

function createPluginContext(): PluginPlayerContext {
    const engine = {
        currentTime: 0,
        duration: 180,
        volume: 1,
        isPlaying: false,
        isSeeking: false,
        hasError: false,
        volumeUnsupported: false,
        audioRef: { current: null },
    } as unknown as AudioPlayerEngine

    return {
        getEngine: () => engine,
        getRootElement: () => null,
        getAudioElement: () => null,
        getCurrentTrack: () => null,
        getNextTrack: () => null,
        getSourceKey: () => "test-track",
        requestAdvance: vi.fn(),
    } as unknown as PluginPlayerContext
}

describe("AutomixPlugin", () => {
    describe("AutomixPlugin track-end contract", () => {
        it("does not suppress the host advance while idle (exactly one advance)", () => {
            const plugin = createAutomixPlugin({ name: "automix" })
            plugin.init(createPluginContext())

            expect(plugin.handleTrackEnded()).toBe(false)
            expect(plugin.onTrackEnded()).toBe(false)

            plugin.destroy()
        })

        it("never claims the track end when disabled", () => {
            const plugin = createAutomixPlugin({ name: "automix", enabled: false })
            plugin.init(createPluginContext())

            expect(plugin.handleTrackEnded()).toBe(false)
            expect(plugin.isTransitioning).toBe(false)

            plugin.destroy()
        })

        it("toggling enabled off cancels cleanly and stays idle", () => {
            const onTransitionChange = vi.fn()
            const plugin = createAutomixPlugin({
                name: "automix",
                onTransitionChange,
            })
            plugin.init(createPluginContext())

            plugin.updateConfig({ enabled: false })
            expect(plugin.isTransitioning).toBe(false)
            expect(plugin.handleTrackEnded()).toBe(false)

            plugin.destroy()
        })
    })

    describe("Transitions and Supervise", () => {
        let mockContext: PluginPlayerContext
        let mockEngine: MockAudioEngine
        let mockMainAudio: MockAudio

        beforeEach(() => {
            vi.useFakeTimers()
            vi.spyOn(performance, "now").mockReturnValue(1000)

            vi.stubGlobal("Audio", MockAudio)
            mockMainAudio = new MockAudio()
            mockMainAudio.readyState = 4

            mockEngine = createMockAudioEngine({
                isPlaying: true,
                isSeeking: false,
                hasError: false,
                duration: 180,
                currentTime: 0,
                volume: 1,
                volumeUnsupported: false,
            })

            mockContext = createMockPluginContext({
                getEngine: vi.fn().mockReturnValue(mockEngine),
                getCurrentTrack: vi.fn().mockReturnValue(createMockTrack("current", { audioFile: "url1" })),
                getNextTrack: vi.fn().mockReturnValue(createMockTrack("next", { audioFile: "url2" })),
                getSourceKey: vi.fn().mockReturnValue("local"),
                getAudioElement: vi.fn().mockReturnValue(mockMainAudio as unknown as HTMLAudioElement),
                requestAdvance: vi.fn(),
            })
        })

        afterEach(() => {
            vi.useRealTimers()
            vi.clearAllMocks()
            vi.unstubAllGlobals()
        })

        it("triggers analysis on track load", () => {
            const plugin = createAutomixPlugin({ enabled: true })
            plugin.init(mockContext)

            plugin.onTrackLoad?.(createMockTrack("loaded", { audioFile: "url" }))
            expect(trackAnalysis.ensureProTrackAnalysis).toHaveBeenCalled()
        })

        it("cancels fade on backward seek", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            mockEngine.currentTime = 175
            plugin.onTimeUpdate?.(175)

            const internal = plugin as unknown as AutomixPluginInternal
            const deck = internal.deck
            if (deck) {
                deck.readyState = 4
                deck._trigger("loadedmetadata")
                mockEngine.currentTime = 176
                plugin.onTimeUpdate?.(176)
                expect(internal.phase).toBe("fading")

                mockEngine.currentTime = 170
                plugin.onSeek?.(170)
                expect(internal.phase).toBe("idle")
            }
        })

        it("starts preloading when approaching end", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            mockEngine.currentTime = 100
            plugin.onTimeUpdate?.(100)
            const internal = plugin as unknown as AutomixPluginInternal
            expect(internal.phase).toBe("idle")

            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            expect(internal.phase).toBe("preloading")
            expect(internal.preloadedKey).toBe("id:next")
        })

        it("does nothing if track is too short", () => {
            mockEngine.duration = 20
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            mockEngine.currentTime = 18
            plugin.onTimeUpdate?.(18)
            const internal = plugin as unknown as AutomixPluginInternal
            expect(internal.phase).toBe("idle")
        })

        it("starts fading and requests advance after ramp", async () => {
            const onTransitionChange = vi.fn()
            const plugin = createAutomixPlugin({ onTransitionChange })
            plugin.init(mockContext)

            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)

            const internal = plugin as unknown as AutomixPluginInternal
            const deck = internal.deck
            if (deck) deck.readyState = 4

            mockEngine.currentTime = 176
            plugin.onTimeUpdate?.(176)

            expect(internal.phase).toBe("fading")
            expect(onTransitionChange).toHaveBeenCalledWith(true)

            await Promise.resolve() // let deck.play() resolve and trigger runRamp

            vi.spyOn(performance, "now").mockReturnValue(1000 + 6000)
            vi.advanceTimersByTime(6000)

            expect(internal.phase).toBe("handoff")
            expect(mockContext.requestAdvance).toHaveBeenCalled()
        })

        it("suppresses advance if in handoff", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            const internal = plugin as unknown as AutomixPluginInternal
            internal.phase = "handoff"
            expect(plugin.handleTrackEnded()).toBe(true)
        })

        it("finalizes early if track ends mid-fade", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            const internal = plugin as unknown as AutomixPluginInternal
            internal.phase = "fading"
            expect(plugin.handleTrackEnded()).toBe(false)
            expect(internal.phase).toBe("handoff")
        })

        it("aborts preloading if next track changes", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            const internal = plugin as unknown as AutomixPluginInternal
            expect(internal.phase).toBe("preloading")

            // Change next track
            mockContext.getNextTrack = vi.fn().mockReturnValue(createMockTrack("another_next"))
            plugin.onTimeUpdate?.(166)

            expect(internal.phase).toBe("idle")
            expect(internal.deck).toBeNull()
        })

        it("aborts handoff and restores volume if flip times out", async () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            const internal = plugin as unknown as AutomixPluginInternal
            const deck = internal.deck
            if (deck) deck.readyState = 4
            mockEngine.currentTime = 176
            plugin.onTimeUpdate?.(176)

            await Promise.resolve() // let deck.play() resolve and trigger runRamp

            vi.spyOn(performance, "now").mockReturnValue(1000 + 6000)
            vi.advanceTimersByTime(6000)

            expect(internal.phase).toBe("handoff")

            // Simulating track load on handoff (source key MUST change)
            mockContext.getSourceKey = vi.fn().mockReturnValue("new_source_key")
            plugin.onTrackLoad?.(createMockTrack("next", { audioFile: "url2" }))

            vi.advanceTimersByTime(7000) // HANDOFF_TIMEOUT_MS is 6000

            expect(internal.phase).toBe("idle")
            expect(internal.transitioning).toBe(false)
        })

        it("successfully completes handoff when main starts playing", async () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)

            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            const internal = plugin as unknown as AutomixPluginInternal
            const deck = internal.deck
            if (deck) deck.readyState = 4
            mockEngine.currentTime = 176
            plugin.onTimeUpdate?.(176)

            await Promise.resolve()

            vi.spyOn(performance, "now").mockReturnValue(1000 + 6000)
            vi.advanceTimersByTime(6000)

            expect(internal.phase).toBe("handoff")

            mockContext.getSourceKey = vi.fn().mockReturnValue("new_source_key")
            plugin.onTrackLoad?.(createMockTrack("next", { audioFile: "url2" }))

            // Trigger playing on main
            mockMainAudio._trigger("playing")

            expect(internal.phase).toBe("idle")
            expect(internal.transitioning).toBe(false)
            expect(mockMainAudio.volume).toBe(1)
        })
    })
})
