/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { SleepTimerPlugin } from "../SleepTimerPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"
import type { AudioPlayerEngine } from "../../types"

function createPluginContext(pause = vi.fn(), fade = vi.fn()): PluginPlayerContext {
    const engine = {
        currentTime: 0,
        duration: 180,
        pause,
        fade,
    } as unknown as AudioPlayerEngine

    return {
        getEngine: () => engine,
        getRootElement: () => null,
        getAudioElement: () => null,
        getCurrentTrack: () => ({
            title: "Test Track",
            artist: "SEIHouse",
            audioFile: "/test.mp3",
        }),
        getNextTrack: () => null,
        getSourceKey: () => "test-track",
    }
}

describe("SleepTimerPlugin", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.clear()
    })
    
    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it("pauses playback when the selected countdown reaches zero (no fade out)", () => {
        const pause = vi.fn()
        const plugin = new SleepTimerPlugin({ fadeOut: false })

        plugin.init(createPluginContext(pause))
        plugin.setTimer("15m")

        vi.advanceTimersByTime(15 * 60 * 1000 - 1)
        expect(pause).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(pause).toHaveBeenCalledTimes(1)
        expect(plugin.getActiveTimer().preset).toBe("off")

        plugin.destroy()
    })
    
    it("handles custom duration timers", () => {
        const pause = vi.fn()
        const plugin = new SleepTimerPlugin({ fadeOut: false })

        plugin.init(createPluginContext(pause))
        plugin.setTimer("custom", 2) // 2 minutes

        vi.advanceTimersByTime(2 * 60 * 1000)
        expect(pause).toHaveBeenCalledTimes(1)
    })

    it("fades out before pausing if fadeOut is true", () => {
        const pause = vi.fn()
        const fade = vi.fn()
        const plugin = new SleepTimerPlugin({ fadeOut: true })

        plugin.init(createPluginContext(pause, fade))
        plugin.setTimer("5m")

        // Advance to the deadline
        vi.advanceTimersByTime(5 * 60 * 1000)
        
        // At deadline, it should start the fade out process (10s)
        expect(fade).toHaveBeenCalledWith(0, 10000)
        expect(pause).not.toHaveBeenCalled()
        
        // Advance 10s
        vi.advanceTimersByTime(10000)
        expect(pause).toHaveBeenCalledTimes(1)
    })

    it("pauses at the end of the current track without letting the host advance", () => {
        const pause = vi.fn()
        const plugin = new SleepTimerPlugin({ fadeOut: false })

        plugin.init(createPluginContext(pause))
        plugin.setTimer("track-end")

        const handled = plugin.onTrackEnded?.({
            title: "Test Track",
            artist: "SEIHouse",
            audioFile: "/test.mp3",
        })

        expect(handled).toBe(true)
        expect(pause).toHaveBeenCalledTimes(1)
        expect(plugin.getActiveTimer().preset).toBe("off")
    })

    describe("Persistence", () => {
        it("restores active timer from localStorage", () => {
            const now = 1000000
            const originalNow = Date.now
            Date.now = () => now
            
            localStorage.setItem("sap-sleep-timer-state", JSON.stringify({
                preset: "30m",
                deadlineMs: now + 5000,
                fadeOut: true
            }))
            
            const plugin = new SleepTimerPlugin()
            plugin.init(createPluginContext())
            
            const state = plugin.getActiveTimer()
            expect(state.preset).toBe("30m")
            expect(state.remainingMs).toBe(5000)
            expect(state.fadeOut).toBe(true)
            
            Date.now = originalNow
        })
    })

    describe("UI Mounting", () => {
        it("renders modern UI when renderUi is true", () => {
            const root = document.createElement("div")
            const plugin = new SleepTimerPlugin({ renderUi: true, target: root })
            plugin.init(createPluginContext())

            const btn = root.querySelector(".sap-sleep-timer__btn") as HTMLButtonElement
            expect(btn).not.toBeNull()
            
            const select = root.querySelector("select")
            expect(select).not.toBeNull()
            expect(select?.value).toBe("off")
            
            // change select
            select!.value = "30m"
            select!.dispatchEvent(new Event("change"))
            
            expect(plugin.getActiveTimer().preset).toBe("30m")
            
            plugin.destroy()
            expect(root.querySelector("select")).toBeNull()
        })
    })
})
