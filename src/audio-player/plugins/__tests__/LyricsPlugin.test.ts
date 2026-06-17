/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createLyricsPlugin } from "../LyricsPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"

describe("LyricsPlugin", () => {
    let mockContext: PluginPlayerContext
    let mockEngine: any

    beforeEach(() => {
        mockEngine = {
            duration: 180,
        }
        mockContext = {
            getCurrentTrack: vi.fn(),
            getEngine: vi.fn().mockReturnValue(mockEngine),
            getPlugins: vi.fn(),
            play: vi.fn(),
            pause: vi.fn(),
            togglePlay: vi.fn(),
            seek: vi.fn(),
            next: vi.fn(),
            previous: vi.fn(),
            setVolume: vi.fn(),
        } as unknown as PluginPlayerContext
    })

    describe("LRC parsing", () => {
        it("parses valid LRC tags", () => {
            const plugin = createLyricsPlugin({
                lyrics: "[00:12.34] Hello World\n[01:05.00] Next line",
            })
            plugin.init(mockContext)

            // Access private lines array via any or reflection if necessary,
            // or just test behavior
            let callbackTriggered = false
            const testPlugin = createLyricsPlugin({
                lyrics: "[00:12.34] Hello World\n[01:05.00] Next line",
                onLineChange: (line, index) => {
                    if (index === 0) {
                        expect(line?.text).toBe("Hello World")
                        expect(line?.time).toBeCloseTo(12.34)
                        callbackTriggered = true
                    }
                },
            })
            testPlugin.init(mockContext)
            testPlugin.onTimeUpdate?.(12.5)
            expect(callbackTriggered).toBe(true)
        })

        it("handles malformed LRC by falling back to plain text (time=0)", () => {
            const plugin = createLyricsPlugin({
                lyrics: "Just text without timestamp\n[invalid] Not LRC\n[00:10.00] Valid",
            })
            plugin.init(mockContext)
            
            let lines: any[] = []
            const testPlugin = createLyricsPlugin({
                lyrics: "Just text without timestamp\n[invalid] Not LRC\n[00:10.00] Valid",
                onLineChange: (line) => {
                    lines.push(line)
                }
            })
            testPlugin.init(mockContext)
            testPlugin.onTimeUpdate?.(5)
            expect(lines[0].text).toBe("[invalid] Not LRC") // It will match the last line with time <= 5 (which is index 1, time 0)
        })
        
        it("handles empty lyrics", () => {
            const onLineChange = vi.fn()
            const plugin = createLyricsPlugin({ onLineChange })
            plugin.init(mockContext)
            plugin.onTimeUpdate?.(10)
            expect(onLineChange).not.toHaveBeenCalled()
        })
    })

    describe("Timing logic and sync with playback", () => {
        it("triggers onLineChange with the correct line when time updates", () => {
            const onLineChange = vi.fn()
            const plugin = createLyricsPlugin({
                lyrics: "[00:00.00] Line 1\n[00:10.00] Line 2\n[00:20.00] Line 3",
                onLineChange
            })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(5)
            expect(onLineChange).toHaveBeenCalledWith(
                { time: 0, text: "Line 1" },
                0,
                undefined
            )

            plugin.onTimeUpdate?.(15)
            expect(onLineChange).toHaveBeenCalledWith(
                { time: 10, text: "Line 2" },
                1,
                undefined
            )
        })

        it("does not trigger callback if line index hasn't changed", () => {
            const onLineChange = vi.fn()
            const plugin = createLyricsPlugin({
                lyrics: "[00:00.00] Line 1\n[00:10.00] Line 2",
                onLineChange
            })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(5)
            plugin.onTimeUpdate?.(6)
            plugin.onTimeUpdate?.(7)
            
            expect(onLineChange).toHaveBeenCalledTimes(1)
        })

        it("uses approximate line matching for plain text lyrics", () => {
            const onLineChange = vi.fn()
            const plugin = createLyricsPlugin({
                lyrics: "Line 1\nLine 2\nLine 3\nLine 4", // 4 lines, 180s duration
                onLineChange
            })
            plugin.init(mockContext)

            // Duration is 180s.
            // 0 - 45s: Line 1 (0)
            // 45 - 90s: Line 2 (1)
            // 90 - 135s: Line 3 (2)
            // 135 - 180s: Line 4 (3)
            
            plugin.onTimeUpdate?.(20)
            expect(onLineChange).toHaveBeenCalledWith({ time: 0, text: "Line 1" }, 0, undefined)

            plugin.onTimeUpdate?.(60)
            expect(onLineChange).toHaveBeenCalledWith({ time: 0, text: "Line 2" }, 1, undefined)

            plugin.onTimeUpdate?.(100)
            expect(onLineChange).toHaveBeenCalledWith({ time: 0, text: "Line 3" }, 2, undefined)

            plugin.onTimeUpdate?.(150)
            expect(onLineChange).toHaveBeenCalledWith({ time: 0, text: "Line 4" }, 3, undefined)
        })
    })

    describe("Target updates", () => {
        it("updates the DOM target with the active lyric line", () => {
            const target = document.createElement("div")
            const plugin = createLyricsPlugin({
                lyrics: "[00:00.00] First\n[00:10.00] Second",
                target
            })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(5)
            expect(target.textContent).toBe("First")
            
            plugin.onTimeUpdate?.(15)
            expect(target.textContent).toBe("Second")
        })

        it("clears the target on destroy", () => {
            const target = document.createElement("div")
            const plugin = createLyricsPlugin({
                lyrics: "[00:00.00] First",
                target
            })
            plugin.init(mockContext)
            
            plugin.onTimeUpdate?.(5)
            expect(target.textContent).toBe("First")
            
            plugin.destroy()
            expect(target.textContent).toBe("")
        })
    })

    describe("Track changes", () => {
        it("reloads lyrics when a new track is loaded", () => {
            const onLineChange = vi.fn()
            const plugin = createLyricsPlugin({
                onLineChange
            })
            plugin.init(mockContext)

            const newTrack = { id: "1", title: "Test", url: "url", lyrics: "[00:00.00] Track Lyrics" }
            mockContext.getCurrentTrack = vi.fn().mockReturnValue(newTrack)
            
            plugin.onTrackLoad?.(newTrack as any)
            plugin.onTimeUpdate?.(5)
            
            expect(onLineChange).toHaveBeenCalledWith(
                { time: 0, text: "Track Lyrics" },
                0,
                newTrack
            )
        })
    })
})
