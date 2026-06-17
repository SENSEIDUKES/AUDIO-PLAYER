/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest"
import { SleepTimerPlugin } from "../SleepTimerPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"
import type { AudioPlayerEngine } from "../../types"

function createPluginContext(pause = vi.fn()): PluginPlayerContext {
    const engine = {
        currentTime: 0,
        duration: 180,
        pause,
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
    it("pauses playback when the selected countdown reaches zero", () => {
        vi.useFakeTimers()
        const pause = vi.fn()
        const plugin = new SleepTimerPlugin()

        plugin.init(createPluginContext(pause))
        plugin.setTimer("15m")

        vi.advanceTimersByTime(15 * 60 * 1000 - 1)
        expect(pause).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(pause).toHaveBeenCalledTimes(1)
        expect(plugin.getActiveTimer().preset).toBe("off")

        plugin.destroy()
        vi.useRealTimers()
    })

    it("pauses at the end of the current track without letting the host advance", () => {
        const pause = vi.fn()
        const plugin = new SleepTimerPlugin()

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

    describe("UI Mounting", () => {
        it("renders UI when renderUi is true", () => {
            const root = document.createElement("div")
            const plugin = new SleepTimerPlugin({ renderUi: true, target: root })
            plugin.init(createPluginContext())

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
        
        it("handles early expire appropriately", () => {
            vi.useFakeTimers()
            const plugin = new SleepTimerPlugin()
            plugin.init(createPluginContext())
            
            // mock Date.now manually
            let now = 1000
            const originalNow = Date.now
            try {
                Date.now = () => now

                const p2 = new SleepTimerPlugin({ now: () => now })
                p2.init(createPluginContext())
                p2.setTimer("15m")

                expect(p2.getActiveTimer().remainingMs).toBe(15 * 60 * 1000)

                now += 5000 // jump 5 seconds
                expect(p2.getActiveTimer().remainingMs).toBe(15 * 60 * 1000 - 5000)

                // Wait, we need to test early expire trigger. The setTimeout might trigger early.
                // vi.advanceTimersByTime handles setTimeout internally.
                vi.advanceTimersByTime(15 * 60 * 1000) // Trigger the expire.
                // since now is only +5000, deadline > now
                expect(p2.getActiveTimer().preset).toBe("15m")
            } finally {
                Date.now = originalNow
                vi.useRealTimers()
            }
        })
    })
})
