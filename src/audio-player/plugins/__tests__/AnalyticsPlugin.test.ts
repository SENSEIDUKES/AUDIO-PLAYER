/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AnalyticsPlugin, createAnalyticsPlugin } from "../AnalyticsPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"

describe("AnalyticsPlugin", () => {
    let mockContext: PluginPlayerContext
    let mockEngine: any

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

        mockEngine = {
            currentTime: 10,
            duration: 100,
        }

        mockContext = {
            getEngine: vi.fn().mockReturnValue(mockEngine),
            getCurrentTrack: vi.fn().mockReturnValue({ id: "1", title: "Test" }),
            getSourceKey: vi.fn().mockReturnValue("local"),
        } as unknown as PluginPlayerContext
        
        // Mock global objects
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({}))
        Object.defineProperty(navigator, "sendBeacon", {
            value: vi.fn().mockReturnValue(true),
            writable: true
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    describe("Payload structure", () => {
        it("emits correct payload for track_load", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback })
            plugin.init(mockContext)
            
            plugin.onTrackLoad?.(null)
            
            expect(sendCallback).toHaveBeenCalledWith({
                type: "track_load",
                track: { id: "1", title: "Test" },
                sourceKey: "local",
                position: 10,
                duration: 100,
                timestamp: Date.now(),
                plugin: "analytics",
            })
        })

        it("emits events for standard playback hooks", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback })
            plugin.init(mockContext)
            
            plugin.onPlay?.()
            expect(sendCallback).toHaveBeenLastCalledWith(expect.objectContaining({ type: "play" }))
            
            plugin.onPause?.()
            expect(sendCallback).toHaveBeenLastCalledWith(expect.objectContaining({ type: "pause" }))
            
            plugin.onStop?.()
            expect(sendCallback).toHaveBeenLastCalledWith(expect.objectContaining({ type: "stop" }))
            
            plugin.onTrackEnded?.()
            expect(sendCallback).toHaveBeenLastCalledWith(expect.objectContaining({ type: "track_ended" }))
            
            plugin.onSeek?.(25)
            expect(sendCallback).toHaveBeenLastCalledWith(expect.objectContaining({ type: "seek", position: 25 }))
        })
    })

    describe("Time updates & rate limiting", () => {
        it("does not emit time_update by default", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(5)
            expect(sendCallback).not.toHaveBeenCalled()
        })

        it("emits time_update based on intervals", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback, includeTimeUpdates: true, timeUpdateIntervalSeconds: 10 })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(0)
            expect(sendCallback).toHaveBeenCalledTimes(1) // bucket 0
            
            plugin.onTimeUpdate?.(5)
            expect(sendCallback).toHaveBeenCalledTimes(1) // still bucket 0
            
            plugin.onTimeUpdate?.(10)
            expect(sendCallback).toHaveBeenCalledTimes(2) // bucket 1
            
            plugin.onTimeUpdate?.(15)
            expect(sendCallback).toHaveBeenCalledTimes(2) // still bucket 1
        })
        
        it("resets time bucket on track load", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback, includeTimeUpdates: true, timeUpdateIntervalSeconds: 10 })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(0)
            expect(sendCallback).toHaveBeenCalledTimes(1) // bucket 0
            
            plugin.onTrackLoad?.(null) // Resets bucket. Also emits track_load (+1)
            expect(sendCallback).toHaveBeenCalledTimes(2)
            
            plugin.onTimeUpdate?.(0) // Should emit again because bucket was reset
            expect(sendCallback).toHaveBeenCalledTimes(3)
        })
    })

    describe("Fallback to endpoint & network handling", () => {
        it("does nothing if neither send nor endpoint is configured", () => {
            const plugin = createAnalyticsPlugin()
            plugin.init(mockContext)
            plugin.onPlay?.()
            expect(navigator.sendBeacon).not.toHaveBeenCalled()
            expect(fetch).not.toHaveBeenCalled()
        })

        it("uses sendBeacon if available", () => {
            const plugin = createAnalyticsPlugin({ endpoint: "/api/events" })
            plugin.init(mockContext)
            plugin.onPlay?.()
            
            expect(navigator.sendBeacon).toHaveBeenCalledWith(
                "/api/events",
                expect.any(Blob)
            )
            expect(fetch).not.toHaveBeenCalled()
        })

        it("falls back to fetch if sendBeacon returns false", () => {
            Object.defineProperty(navigator, "sendBeacon", {
                value: vi.fn().mockReturnValue(false),
                writable: true
            })
            
            const plugin = createAnalyticsPlugin({ endpoint: "/api/events" })
            plugin.init(mockContext)
            plugin.onPlay?.()
            
            expect(navigator.sendBeacon).toHaveBeenCalled()
            expect(fetch).toHaveBeenCalledWith("/api/events", expect.objectContaining({
                method: "POST",
                keepalive: true
            }))
        })

        it("falls back to fetch if sendBeacon is missing", () => {
            Object.defineProperty(navigator, "sendBeacon", {
                value: undefined,
                writable: true
            })
            
            const plugin = createAnalyticsPlugin({ endpoint: "/api/events" })
            plugin.init(mockContext)
            plugin.onPlay?.()
            
            expect(fetch).toHaveBeenCalledWith("/api/events", expect.objectContaining({
                method: "POST",
                keepalive: true
            }))
        })
        
        it("silently catches fetch errors (offline mode, endpoint errors)", async () => {
            Object.defineProperty(navigator, "sendBeacon", {
                value: undefined,
                writable: true
            })
            vi.mocked(fetch).mockRejectedValueOnce(new Error("Network Error"))
            
            const plugin = createAnalyticsPlugin({ endpoint: "/api/events" })
            plugin.init(mockContext)
            plugin.onPlay?.() // Should not throw
            
            expect(fetch).toHaveBeenCalled()
        })

        it("handles missing context gracefully", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback })
            // Do not call init
            plugin.onPlay?.()
            expect(sendCallback).not.toHaveBeenCalled()
        })
        
        it("handles destroy gracefully", () => {
            const sendCallback = vi.fn()
            const plugin = createAnalyticsPlugin({ send: sendCallback })
            plugin.init(mockContext)
            plugin.destroy()
            
            plugin.onPlay?.()
            expect(sendCallback).not.toHaveBeenCalled()
        })
        
        it("handles missing window gracefully", () => {
            const plugin = createAnalyticsPlugin({ endpoint: "/api/events" })
            plugin.init(mockContext)
            
            const originalWindow = global.window
            // @ts-ignore
            delete global.window
            
            plugin.onPlay?.()
            
            expect(navigator.sendBeacon).not.toHaveBeenCalled()
            expect(fetch).not.toHaveBeenCalled()
            
            global.window = originalWindow
        })
    })
})
