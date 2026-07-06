/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { checkCodecSupport } from "../checkCodecSupport"

describe("checkCodecSupport", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("returns false when window is undefined (SSR)", () => {
        vi.stubGlobal("window", undefined)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns false when document is undefined (SSR)", () => {
        vi.stubGlobal("document", undefined)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns false if created audio element does not have canPlayType", () => {
        const mockAudio = {} as unknown as HTMLAudioElement
        vi.spyOn(document, "createElement").mockReturnValue(mockAudio)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns true when canPlayType returns 'probably'", () => {
        const mockAudio = {
            canPlayType: () => "probably"
        } as unknown as HTMLAudioElement
        vi.spyOn(document, "createElement").mockReturnValue(mockAudio)
        expect(checkCodecSupport("audio/mpeg")).toBe(true)
    })

    it("returns true when canPlayType returns 'maybe'", () => {
        const mockAudio = {
            canPlayType: () => "maybe"
        } as unknown as HTMLAudioElement
        vi.spyOn(document, "createElement").mockReturnValue(mockAudio)
        expect(checkCodecSupport("audio/mpeg")).toBe(true)
    })

    it("returns false when canPlayType returns '' (empty string)", () => {
        const mockAudio = {
            canPlayType: () => ""
        } as unknown as HTMLAudioElement
        vi.spyOn(document, "createElement").mockReturnValue(mockAudio)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("returns false when canPlayType returns an unknown string", () => {
        const mockAudio = {
            canPlayType: () => "unlikely"
        } as unknown as HTMLAudioElement
        vi.spyOn(document, "createElement").mockReturnValue(mockAudio)
        expect(checkCodecSupport("audio/mpeg")).toBe(false)
    })

    it("passes the correct mimeType to canPlayType", () => {
        const canPlayTypeMock = vi.fn().mockReturnValue("probably")
        const mockAudio = {
            canPlayType: canPlayTypeMock
        } as unknown as HTMLAudioElement
        vi.spyOn(document, "createElement").mockReturnValue(mockAudio)
        checkCodecSupport("audio/ogg")
        expect(canPlayTypeMock).toHaveBeenCalledWith("audio/ogg")
    })
})
