import { afterEach, describe, expect, it, vi } from "vitest"
import { checkCodecSupport } from "../checkCodecSupport"

describe("checkCodecSupport", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("returns false when window is undefined (SSR)", () => {
        vi.stubGlobal("window", undefined)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns false when document is undefined (SSR)", () => {
        vi.stubGlobal("window", {}) // Keep window defined to reach document check
        vi.stubGlobal("document", undefined)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns false if created audio element does not have canPlayType", () => {
        vi.stubGlobal("window", {})
        vi.stubGlobal("document", {
            createElement: () => ({}) // Return mock element without canPlayType
        })
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns true when canPlayType returns 'probably'", () => {
        vi.stubGlobal("window", {})
        vi.stubGlobal("document", {
            createElement: () => ({
                canPlayType: () => "probably"
            })
        })
        expect(checkCodecSupport("audio/mpeg")).toBe(true)
    })

    it("returns true when canPlayType returns 'maybe'", () => {
        vi.stubGlobal("window", {})
        vi.stubGlobal("document", {
            createElement: () => ({
                canPlayType: () => "maybe"
            })
        })
        expect(checkCodecSupport("audio/mpeg")).toBe(true)
    })

    it("returns false when canPlayType returns '' (empty string)", () => {
        vi.stubGlobal("window", {})
        vi.stubGlobal("document", {
            createElement: () => ({
                canPlayType: () => ""
            })
        })
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns false when canPlayType returns an unknown string", () => {
        vi.stubGlobal("window", {})
        vi.stubGlobal("document", {
            createElement: () => ({
                canPlayType: () => "unlikely"
            })
        })
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("passes the correct mimeType to canPlayType", () => {
        const canPlayTypeMock = vi.fn().mockReturnValue("probably");
        vi.stubGlobal("window", {})
        vi.stubGlobal("document", {
            createElement: () => ({
                canPlayType: canPlayTypeMock
            })
        })
        checkCodecSupport("audio/ogg");
        expect(canPlayTypeMock).toHaveBeenCalledWith("audio/ogg");
    })
})
