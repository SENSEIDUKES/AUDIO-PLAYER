/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AutomixPlugin, createAutomixPlugin } from "../AutomixPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"
import * as silenceAnalysis from "../../automix/silenceAnalysis"
import * as trackAnalysis from "../../automix/trackAnalysis"
import * as transitionPlanner from "../../automix/transitionPlanner"
import type { AudioPlayerEngine } from "../../types"

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

// Mock global Audio
class MockAudio {
    preload: string = ""
    volume: number = 1
    src: string = ""
    currentTime: number = 0
    muted: boolean = false
    readyState: number = 0
    listeners: Record<string, Function[]> = {}
    
    addEventListener(event: string, callback: Function) {
        if (!this.listeners[event]) this.listeners[event] = []
        this.listeners[event].push(callback)
    }
    
    removeEventListener(event: string, callback: Function) {
        if (!this.listeners[event]) return
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
    
    play() { return Promise.resolve() }
    pause() {}
    load() {}
    removeAttribute() {}
    
    // Test helper to trigger events
    _trigger(event: string) {
        this.listeners[event]?.forEach(cb => cb())
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
        let mockEngine: any
        let mockMainAudio: any

        beforeEach(() => {
            vi.useFakeTimers()
            vi.spyOn(performance, "now").mockReturnValue(1000)
            
            // @ts-ignore
            global.Audio = MockAudio
            mockMainAudio = new MockAudio()
            mockMainAudio.readyState = 4
            
            mockEngine = {
                isPlaying: true,
                isSeeking: false,
                hasError: false,
                duration: 180,
                currentTime: 0,
                volume: 1,
                volumeUnsupported: false,
            }

            mockContext = {
                getEngine: vi.fn().mockReturnValue(mockEngine),
                getCurrentTrack: vi.fn().mockReturnValue({ id: "current", url: "url1" }),
                getNextTrack: vi.fn().mockReturnValue({ id: "next", url: "url2" }),
                getSourceKey: vi.fn().mockReturnValue("local"),
                getAudioElement: vi.fn().mockReturnValue(mockMainAudio),
                requestAdvance: vi.fn(),
            } as unknown as PluginPlayerContext
        })

        afterEach(() => {
            vi.useRealTimers()
            vi.clearAllMocks()
        })

        it("triggers analysis on track load", () => {
            const plugin = createAutomixPlugin({ enabled: true })
            plugin.init(mockContext)
            
            plugin.onTrackLoad?.({ id: "loaded", url: "url" } as any)
            expect(trackAnalysis.ensureProTrackAnalysis).toHaveBeenCalled()
        })
        
        it("cancels fade on backward seek", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            mockEngine.currentTime = 175
            plugin.onTimeUpdate?.(175)
            
            const deck = (plugin as any).deck
            if (deck) {
                deck.readyState = 4
                deck._trigger("loadedmetadata")
                mockEngine.currentTime = 176
                plugin.onTimeUpdate?.(176)
                expect((plugin as any).phase).toBe("fading")
                
                mockEngine.currentTime = 170
                plugin.onSeek?.(170)
                expect((plugin as any).phase).toBe("idle")
            }
        })

        it("starts preloading when approaching end", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            mockEngine.currentTime = 100
            plugin.onTimeUpdate?.(100)
            expect((plugin as any).phase).toBe("idle")
            
            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            expect((plugin as any).phase).toBe("preloading")
            expect((plugin as any).preloadedKey).toBe("id:next")
        })

        it("does nothing if track is too short", () => {
            mockEngine.duration = 20
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            mockEngine.currentTime = 18
            plugin.onTimeUpdate?.(18)
            expect((plugin as any).phase).toBe("idle")
        })

        it("starts fading and requests advance after ramp", async () => {
            const onTransitionChange = vi.fn()
            const plugin = createAutomixPlugin({ onTransitionChange })
            plugin.init(mockContext)
            
            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            
            const deck = (plugin as any).deck
            deck.readyState = 4
            
            mockEngine.currentTime = 176
            plugin.onTimeUpdate?.(176)
            
            expect((plugin as any).phase).toBe("fading")
            expect(onTransitionChange).toHaveBeenCalledWith(true)
            
            await Promise.resolve() // let deck.play() resolve and trigger runRamp
            
            vi.spyOn(performance, "now").mockReturnValue(1000 + 6000)
            vi.advanceTimersByTime(6000)
            
            expect((plugin as any).phase).toBe("handoff")
            expect(mockContext.requestAdvance).toHaveBeenCalled()
        })

        it("suppresses advance if in handoff", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            ;(plugin as any).phase = "handoff"
            expect(plugin.handleTrackEnded()).toBe(true)
        })

        it("finalizes early if track ends mid-fade", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            ;(plugin as any).phase = "fading"
            expect(plugin.handleTrackEnded()).toBe(false)
            expect((plugin as any).phase).toBe("handoff")
        })
        
        it("aborts preloading if next track changes", () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            expect((plugin as any).phase).toBe("preloading")
            
            // Change next track
            mockContext.getNextTrack = vi.fn().mockReturnValue({ id: "another_next" })
            plugin.onTimeUpdate?.(166)
            
            expect((plugin as any).phase).toBe("idle")
            expect((plugin as any).deck).toBeNull()
        })
        
        it("aborts handoff and restores volume if flip times out", async () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            const deck = (plugin as any).deck
            deck.readyState = 4
            mockEngine.currentTime = 176
            plugin.onTimeUpdate?.(176)
            
            await Promise.resolve() // let deck.play() resolve and trigger runRamp
            
            vi.spyOn(performance, "now").mockReturnValue(1000 + 6000)
            vi.advanceTimersByTime(6000)
            
            expect((plugin as any).phase).toBe("handoff")
            
            // Simulating track load on handoff (source key MUST change)
            mockContext.getSourceKey = vi.fn().mockReturnValue("new_source_key")
            plugin.onTrackLoad?.({ id: "next", url: "url2" } as any)
            
            vi.advanceTimersByTime(7000) // HANDOFF_TIMEOUT_MS is 6000
            
            expect((plugin as any).phase).toBe("idle")
            expect((plugin as any).transitioning).toBe(false)
        })

        it("successfully completes handoff when main starts playing", async () => {
            const plugin = createAutomixPlugin()
            plugin.init(mockContext)
            
            mockEngine.currentTime = 166
            plugin.onTimeUpdate?.(166)
            const deck = (plugin as any).deck
            deck.readyState = 4
            mockEngine.currentTime = 176
            plugin.onTimeUpdate?.(176)
            
            await Promise.resolve()
            
            vi.spyOn(performance, "now").mockReturnValue(1000 + 6000)
            vi.advanceTimersByTime(6000)
            
            expect((plugin as any).phase).toBe("handoff")
            
            mockContext.getSourceKey = vi.fn().mockReturnValue("new_source_key")
            plugin.onTrackLoad?.({ id: "next", url: "url2" } as any)
            
            // Trigger playing on main
            mockMainAudio._trigger("playing")
            
            expect((plugin as any).phase).toBe("idle")
            expect((plugin as any).transitioning).toBe(false)
            expect(mockMainAudio.volume).toBe(1)
        })
    })
})
