import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultShowVolume, isIOS, isMobileDevice } from "../device"

/**
 * These helpers read `navigator`/`window` at call time, so each test stubs the
 * relevant globals and restores them afterward. We use `vi.stubGlobal` for
 * `navigator`/`window` shape and restore with `vi.unstubAllGlobals`.
 */

function stubNavigator(partial: Partial<Navigator>) {
    vi.stubGlobal("navigator", partial as Navigator)
}

function stubWindow(partial: Record<string, unknown>) {
    vi.stubGlobal("window", partial)
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("isIOS", () => {
    it("detects iPhone user agents", () => {
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            platform: "iPhone",
            maxTouchPoints: 5,
        })
        expect(isIOS()).toBe(true)
    })

    it("detects iPadOS 13+ masquerading as MacIntel with touch", () => {
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            platform: "MacIntel",
            maxTouchPoints: 5,
        })
        expect(isIOS()).toBe(true)
    })

    it("does not flag a real Mac (no touch)", () => {
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            platform: "MacIntel",
            maxTouchPoints: 0,
        })
        expect(isIOS()).toBe(false)
    })
})

describe("isMobileDevice", () => {
    it("returns true for Android user agents", () => {
        stubWindow({})
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile",
            platform: "Linux armv8l",
            maxTouchPoints: 5,
        })
        expect(isMobileDevice()).toBe(true)
    })

    it("returns true for a coarse-pointer touch device the UA regex misses", () => {
        stubWindow({
            ontouchstart: null,
            matchMedia: (q: string) => ({ matches: q.includes("coarse") }),
        })
        stubNavigator({
            userAgent: "Some Unknown Touch Browser",
            platform: "Linux",
            maxTouchPoints: 5,
        })
        expect(isMobileDevice()).toBe(true)
    })

    it("returns false for desktop Chrome (fine pointer, no touch)", () => {
        stubWindow({
            matchMedia: (q: string) => ({ matches: !q.includes("coarse") }),
        })
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
            platform: "Win32",
            maxTouchPoints: 0,
        })
        expect(isMobileDevice()).toBe(false)
    })

    it("returns false when window/navigator are unavailable (SSR)", () => {
        vi.stubGlobal("window", undefined)
        vi.stubGlobal("navigator", undefined)
        expect(isMobileDevice()).toBe(false)
    })
})

describe("defaultShowVolume", () => {
    it("hides the slider by default on mobile", () => {
        stubWindow({})
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            platform: "iPhone",
            maxTouchPoints: 5,
        })
        expect(defaultShowVolume()).toBe(false)
    })

    it("shows the slider by default on desktop", () => {
        stubWindow({
            matchMedia: (q: string) => ({ matches: !q.includes("coarse") }),
        })
        stubNavigator({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
            platform: "Win32",
            maxTouchPoints: 0,
        })
        expect(defaultShowVolume()).toBe(true)
    })
})
