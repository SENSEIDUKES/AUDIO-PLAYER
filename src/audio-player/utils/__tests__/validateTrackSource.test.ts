import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { validateTrackSource } from "../validateTrackSource"
import * as checkCodecModule from "../checkCodecSupport"

describe("validateTrackSource", () => {
    let globalFetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        globalFetchMock = vi.fn()
        vi.stubGlobal("fetch", globalFetchMock)

        vi.spyOn(checkCodecModule, "checkCodecSupport").mockImplementation((mime) => {
            return mime === "audio/mpeg" || mime === "audio/mp4"
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it("should return success when source is accessible and codec is supported", async () => {
        globalFetchMock.mockResolvedValueOnce({
            ok: true,
            type: "basic",
            headers: new Headers({ "content-type": "audio/mpeg" }),
        } as unknown as Response)

        const result = await validateTrackSource("https://example.com/test.mp3")

        expect(result).toEqual({
            ok: true,
            accessible: true,
            corsEnabled: true,
            mimeType: "audio/mpeg",
            codecSupported: true,
        })
    })

    it("should return ok:false when codec is not supported", async () => {
        globalFetchMock.mockResolvedValueOnce({
            ok: true,
            type: "basic",
            headers: new Headers({ "content-type": "audio/unsupported" }),
        } as unknown as Response)

        const result = await validateTrackSource("https://example.com/test.xyz")

        expect(result).toEqual({
            ok: false,
            accessible: true,
            corsEnabled: true,
            mimeType: "audio/unsupported",
            codecSupported: false,
        })
    })

    it("should fallback to no-cors when cors fails and return opaque success", async () => {
        // First call fails due to CORS
        globalFetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
        // Second call succeeds as opaque
        globalFetchMock.mockResolvedValueOnce({
            ok: false,
            type: "opaque",
            status: 0,
        } as unknown as Response)

        const result = await validateTrackSource("https://example.com/test.mp3")

        expect(result).toEqual({
            ok: true,
            accessible: true,
            corsEnabled: false,
        })
    })

    it("should return ok:false when both cors and no-cors fail", async () => {
        globalFetchMock.mockRejectedValue(new TypeError("Network error"))

        const result = await validateTrackSource("https://example.com/test.mp3")

        expect(result).toEqual({
            ok: false,
            accessible: false,
            corsEnabled: false,
            error: "Network error",
        })
    })

    it("should handle HTTP error codes correctly", async () => {
        globalFetchMock.mockResolvedValueOnce({
            ok: false,
            type: "basic",
            status: 404,
            statusText: "Not Found",
        } as unknown as Response)

        const result = await validateTrackSource("https://example.com/test.mp3")

        expect(result).toEqual({
            ok: false,
            accessible: false,
            corsEnabled: true,
            error: "HTTP 404 Not Found",
        })
    })
})
