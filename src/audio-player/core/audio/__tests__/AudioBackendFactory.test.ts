import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAudioBackend } from "../AudioBackendFactory"
import { HTML5AudioBackend, HTML5_CAPABILITIES } from "../HTML5AudioBackend"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../WebAudioBackend"
import type { AudioBackendDeps } from "../AudioBackendFactory"

describe("AudioBackendFactory", () => {
    let deps: AudioBackendDeps
    const originalWindow = globalThis.window
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        deps = {
            audioRef: { current: null },
        }
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        if (originalWindow !== undefined) {
            globalThis.window = originalWindow
        } else {
            delete (globalThis as any).window
        }
        if (originalFetch !== undefined) {
            globalThis.fetch = originalFetch
        } else {
            delete (globalThis as any).fetch
        }
    })

    it("creates HTML5AudioBackend when html5 is requested", () => {
        const backend = createAudioBackend("html5", deps)

        expect(backend).toBeInstanceOf(HTML5AudioBackend)
        expect(backend.getInfo()).toEqual({
            requested: "html5",
            active: "html5",
            didFallback: false,
            capabilities: HTML5_CAPABILITIES,
        })
    })

    it("creates WebAudioBackend when webaudio is requested and fully supported", () => {
        class MockAudioContext {}
        const mockWindow = {
            AudioContext: MockAudioContext,
        }
        globalThis.window = mockWindow as unknown as Window & typeof globalThis
        globalThis.fetch = vi.fn() as unknown as typeof fetch

        const backend = createAudioBackend("webaudio", deps)

        expect(backend).toBeInstanceOf(WebAudioBackend)
        expect(backend.getInfo()).toEqual({
            requested: "webaudio",
            active: "webaudio",
            didFallback: false,
            capabilities: WEBAUDIO_CAPABILITIES,
        })
        expect(console.warn).not.toHaveBeenCalled()
    })

    it("supports vendor-prefixed webkitAudioContext for Web Audio availability", () => {
        class MockWebkitAudioContext {}
        const mockWindow = {
            webkitAudioContext: MockWebkitAudioContext,
        }
        globalThis.window = mockWindow as unknown as Window & typeof globalThis
        globalThis.fetch = vi.fn() as unknown as typeof fetch

        const backend = createAudioBackend("webaudio", deps)

        expect(backend).toBeInstanceOf(WebAudioBackend)
        expect(backend.getInfo().didFallback).toBe(false)
    })

    it("falls back to HTML5AudioBackend when window is undefined (non-browser)", () => {
        delete (globalThis as any).window

        const backend = createAudioBackend("webaudio", deps)

        expect(backend).toBeInstanceOf(HTML5AudioBackend)
        expect(backend.getInfo()).toEqual({
            requested: "webaudio",
            active: "html5",
            didFallback: true,
            fallbackReason: "no window (non-browser environment)",
            capabilities: HTML5_CAPABILITIES,
        })
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("no window (non-browser environment)")
        )
    })

    it("falls back to HTML5AudioBackend when AudioContext is missing", () => {
        const mockWindow = {}
        globalThis.window = mockWindow as unknown as Window & typeof globalThis
        globalThis.fetch = vi.fn() as unknown as typeof fetch

        const backend = createAudioBackend("webaudio", deps)

        expect(backend).toBeInstanceOf(HTML5AudioBackend)
        expect(backend.getInfo()).toEqual({
            requested: "webaudio",
            active: "html5",
            didFallback: true,
            fallbackReason: "AudioContext is not available",
            capabilities: HTML5_CAPABILITIES,
        })
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("AudioContext is not available")
        )
    })

    it("falls back to HTML5AudioBackend when fetch is missing", () => {
        class MockAudioContext {}
        const mockWindow = {
            AudioContext: MockAudioContext,
        }
        globalThis.window = mockWindow as unknown as Window & typeof globalThis
        delete (globalThis as any).fetch

        const backend = createAudioBackend("webaudio", deps)

        expect(backend).toBeInstanceOf(HTML5AudioBackend)
        expect(backend.getInfo()).toEqual({
            requested: "webaudio",
            active: "html5",
            didFallback: true,
            fallbackReason: "fetch is not available",
            capabilities: HTML5_CAPABILITIES,
        })
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("fetch is not available"))
    })
})
