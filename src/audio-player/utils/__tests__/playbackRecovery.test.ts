import { describe, expect, it } from "vitest"
import { isRetryablePlaybackError } from "../playbackRecovery"

describe("isRetryablePlaybackError", () => {
    it("only retries narrow transient network failures", () => {
        expect(isRetryablePlaybackError("network")).toBe(true)

        expect(isRetryablePlaybackError("aborted")).toBe(false)
        expect(isRetryablePlaybackError("decode")).toBe(false)
        expect(isRetryablePlaybackError("src-not-supported")).toBe(false)
        expect(isRetryablePlaybackError("NotAllowedError")).toBe(false)
        expect(isRetryablePlaybackError("NotSupportedError")).toBe(false)
        expect(isRetryablePlaybackError("unknown")).toBe(false)
        expect(isRetryablePlaybackError(null)).toBe(false)
        expect(isRetryablePlaybackError(undefined)).toBe(false)
    })
})
