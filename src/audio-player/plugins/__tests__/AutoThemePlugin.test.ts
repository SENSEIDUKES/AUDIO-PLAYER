import type { Track } from "../../types"
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createAutoThemePlugin } from "../AutoThemePlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"
import * as colorExtraction from "../../utils/colorExtraction"

vi.mock("../../utils/colorExtraction", () => ({
    contrastText: vi.fn().mockReturnValue("#ffffff"),
    extractPalette: vi.fn(),
    gradient: vi.fn().mockReturnValue("linear-gradient(red, blue)"),
    rgbToCss: vi.fn().mockImplementation(([r, g, b]) => `rgb(${r}, ${g}, ${b})`),
}))

describe("AutoThemePlugin", () => {
    let mockContext: PluginPlayerContext
    let rootElement: HTMLElement
    let bgElement: HTMLElement

    beforeEach(() => {
        rootElement = document.createElement("div")
        bgElement = document.createElement("div")
        bgElement.className = "ap-bg-image"
        rootElement.appendChild(bgElement)

        mockContext = {
            getRootElement: vi.fn().mockReturnValue(rootElement),
            getCurrentTrack: vi.fn().mockReturnValue({ id: "1" }),
        } as unknown as PluginPlayerContext

        vi.mocked(colorExtraction.extractPalette).mockResolvedValue({
            primary: [255, 0, 0],
            secondary: [0, 0, 255],
            accent: [0, 255, 0],
            isDark: true,
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe("Theme transitions & Color extraction", () => {
        it("extracts palette and applies variables on init", async () => {
            bgElement.style.backgroundImage = "url('test.jpg')"
            const onPaletteChange = vi.fn()
            
            const plugin = createAutoThemePlugin({ onPaletteChange })
            plugin.init(mockContext)
            
            // Wait for microtasks
            await Promise.resolve()
            
            expect(colorExtraction.extractPalette).toHaveBeenCalledWith("test.jpg", expect.any(Object))
            
            expect(rootElement.style.getPropertyValue("--ap-accent")).toBe("rgb(0, 255, 0)")
            expect(rootElement.style.getPropertyValue("--ap-progress")).toBe("linear-gradient(red, blue)")
            expect(rootElement.style.getPropertyValue("--ap-bg")).toBe("rgba(255, 0, 0, 0.55)")
            expect(rootElement.style.getPropertyValue("--ap-text")).toBe("#ffffff")
            expect(rootElement.style.getPropertyValue("--ap-glow")).toBe("rgba(0, 255, 0, 0.45)")
            
            expect(onPaletteChange).toHaveBeenCalledWith(
                expect.objectContaining({ isDark: true }),
                expect.any(Object)
            )
        })

        it("clears variables and handles missing artwork", async () => {
            bgElement.style.backgroundImage = "url('temp.jpg')"
            const plugin = createAutoThemePlugin()
            plugin.init(mockContext)
            await Promise.resolve()
            
            const onPaletteChange = vi.fn()
            const plugin2 = createAutoThemePlugin({ onPaletteChange })
            
            // Initial state: root has variables from previous plugin maybe, or just manually set
            rootElement.style.setProperty("--ap-accent", "black")

            // Trigger a valid load then clear to simulate track change
            bgElement.style.backgroundImage = "url('something_else.jpg')"
            plugin2.init(mockContext)
            await Promise.resolve()
            
            // Now remove
            bgElement.style.backgroundImage = ""
            plugin2.onTrackLoad?.({ id: "1", title: "Test Title", artist: "Test Artist" })
            await Promise.resolve()
            
            expect(colorExtraction.extractPalette).toHaveBeenCalled() // The valid loads
            expect(rootElement.style.getPropertyValue("--ap-accent")).toBe("")
            expect(onPaletteChange).toHaveBeenCalledWith(null, expect.any(Object))
        })

        it("handles CORS errors or extraction failures", async () => {
            bgElement.style.backgroundImage = "url('cors-error.jpg')"
            vi.mocked(colorExtraction.extractPalette).mockResolvedValueOnce(null)
            const onPaletteChange = vi.fn()
            
            const plugin = createAutoThemePlugin({ onPaletteChange })
            
            rootElement.style.setProperty("--ap-accent", "black")
            
            plugin.init(mockContext)
            await Promise.resolve()
            
            expect(rootElement.style.getPropertyValue("--ap-accent")).toBe("")
            expect(onPaletteChange).toHaveBeenCalledWith(null, expect.any(Object))
        })

        it("falls back to media session artwork if background image is missing", async () => {
            rootElement.removeChild(bgElement)
            
            // Mock media session
            Object.defineProperty(navigator, "mediaSession", {
                value: {
                    metadata: {
                        artwork: [{ src: "mediasession.jpg" }]
                    }
                },
                writable: true,
                configurable: true
            })
            
            try {
                const plugin = createAutoThemePlugin()
                plugin.init(mockContext)
                await Promise.resolve()

                expect(colorExtraction.extractPalette).toHaveBeenCalledWith("mediasession.jpg", expect.any(Object))
            } finally {
                // Clean up
                // @ts-ignore
                delete navigator.mediaSession
            }
        })
    })

    describe("Async cancellation & Rapid track changes", () => {
        it("cancels stale extraction if a new track loads before it finishes", async () => {
            bgElement.style.backgroundImage = "url('track1.jpg')"
            const onPaletteChange = vi.fn()
            const plugin = createAutoThemePlugin({ onPaletteChange })
            
            let resolveExtraction: any
            vi.mocked(colorExtraction.extractPalette).mockImplementationOnce(() => {
                return new Promise(resolve => {
                    resolveExtraction = resolve
                })
            })
            
            plugin.init(mockContext)
            
            // Now load track 2 immediately
            bgElement.style.backgroundImage = "url('track2.jpg')"
            plugin.onTrackLoad?.({ id: "2", title: "Test Title", artist: "Test Artist" })
            
            // Resolve the first extraction
            resolveExtraction({ primary: [0, 0, 0], secondary: [0, 0, 0], accent: [0, 0, 0], isDark: true })
            await Promise.resolve()
            
            // Second extraction shouldn't be mocked manually, it uses the global mock which resolves immediately.
            // Wait for both to settle
            await Promise.resolve()
            await Promise.resolve()
            
            // The first resolution should be ignored (it returned all 0s)
            // The second one returned the global mock (red, blue, green)
            expect(onPaletteChange).toHaveBeenCalledTimes(1)
            expect(onPaletteChange).toHaveBeenCalledWith(
                expect.objectContaining({ isDark: true, primary: [255, 0, 0] }),
                expect.objectContaining({ id: "2" })
            )
        })

        it("cancels stale extraction if plugin is destroyed", async () => {
            bgElement.style.backgroundImage = "url('track1.jpg')"
            const plugin = createAutoThemePlugin()
            
            let resolveExtraction: any
            vi.mocked(colorExtraction.extractPalette).mockImplementationOnce(() => {
                return new Promise(resolve => {
                    resolveExtraction = resolve
                })
            })
            
            plugin.init(mockContext)
            plugin.destroy()
            
            // Resolve extraction after destroy
            resolveExtraction({ primary: [0, 0, 0], secondary: [0, 0, 0], accent: [0, 0, 0], isDark: true })
            await Promise.resolve()
            
            expect(rootElement.style.getPropertyValue("--ap-accent")).toBe("")
        })
    })

    describe("Configuration options", () => {
        it("disables gradient progress if applyGradient is false", async () => {
            bgElement.style.backgroundImage = "url('test.jpg')"
            const plugin = createAutoThemePlugin({ applyGradient: false })
            plugin.init(mockContext)
            await Promise.resolve()
            
            // When applyGradient is false, it uses the accent color instead of gradient
            expect(rootElement.style.getPropertyValue("--ap-progress")).toBe("rgb(0, 255, 0)")
        })

        it("disables glow if applyGlow is false", async () => {
            bgElement.style.backgroundImage = "url('test.jpg')"
            const plugin = createAutoThemePlugin({ applyGlow: false })
            plugin.init(mockContext)
            await Promise.resolve()
            
            expect(rootElement.style.getPropertyValue("--ap-glow")).toBe("")
        })

        it("uses secondary color for surface if isDark is false", async () => {
            bgElement.style.backgroundImage = "url('test.jpg')"
            vi.mocked(colorExtraction.extractPalette).mockResolvedValueOnce({
                primary: [255, 0, 0], // red
                secondary: [0, 0, 255], // blue
                accent: [0, 255, 0],
                isDark: false, // light theme uses secondary
            })
            
            const plugin = createAutoThemePlugin()
            plugin.init(mockContext)
            await Promise.resolve()
            
            // Surface is secondary (blue), so bg tint should be blue
            expect(rootElement.style.getPropertyValue("--ap-bg")).toBe("rgba(0, 0, 255, 0.55)")
        })
        
        it("does nothing if root element is missing", async () => {
            mockContext.getRootElement = vi.fn().mockReturnValue(null)
            const plugin = createAutoThemePlugin()
            plugin.init(mockContext)
            await Promise.resolve()
            
            expect(colorExtraction.extractPalette).not.toHaveBeenCalled()
        })
    })
})
