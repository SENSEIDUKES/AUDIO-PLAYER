import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { serializeSession, deserializeSession, type SerializedSession } from "../sessionSerializer"
import type { SessionEngine, Track } from "../../types"

describe("sessionSerializer", () => {
    const mockTrack: Track = {
        title: "Test Track",
        artist: "Test Artist",
        audioFile: "https://example.com/test.mp3",
    }

    const mockSession: Partial<SessionEngine> = {
        queue: [mockTrack],
        currentIndex: 0,
        currentTime: 10.5,
        shuffle: true,
        repeatMode: "all",
    }

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("should serialize session state correctly", () => {
        const serialized = serializeSession(mockSession as SessionEngine)
        expect(serialized).toEqual({
            queue: [mockTrack],
            currentIndex: 0,
            currentTime: 10.5,
            shuffle: true,
            repeatMode: "all",
            timestamp: 1767225600000,
        })
    })

    it("should deserialize session state correctly", () => {
        const data: SerializedSession = {
            queue: [mockTrack],
            currentIndex: 0,
            currentTime: 10.5,
            shuffle: true,
            repeatMode: "all",
            timestamp: 1767225600000,
        }

        const deserialized = deserializeSession(data)
        expect(deserialized).toEqual(data)
    })

    it.each([
        ["negative", -10],
        ["NaN", Number.NaN],
        ["positive infinity", Number.POSITIVE_INFINITY],
        ["negative infinity", Number.NEGATIVE_INFINITY],
    ])("sanitizes a %s restored currentTime", (_label, currentTime) => {
        const deserialized = deserializeSession({
            queue: [mockTrack],
            currentIndex: 0,
            currentTime,
            shuffle: false,
            repeatMode: "off",
            timestamp: Date.now(),
        })

        expect(deserialized?.currentTime).toBe(0)
    })

    it.each([
        ["negative", -1, 0],
        ["past the queue", 99, 1],
        ["NaN", Number.NaN, 0],
        ["infinite", Number.POSITIVE_INFINITY, 0],
        ["fractional", 1.5, 0],
        ["non-numeric", "1", 0],
    ])(
        "sanitizes a %s restored currentIndex",
        (_label, currentIndex, expectedIndex) => {
            const deserialized = deserializeSession({
                queue: [mockTrack, { ...mockTrack, title: "Second Track" }],
                currentIndex,
                currentTime: 0,
                shuffle: false,
                repeatMode: "off",
                timestamp: Date.now(),
            })

            expect(deserialized?.currentIndex).toBe(expectedIndex)
        }
    )

    it("normalizes an empty queue without discarding it", () => {
        const deserialized = deserializeSession({
            queue: [],
            currentIndex: 42,
            currentTime: 120,
            shuffle: false,
            repeatMode: "off",
            timestamp: Date.now(),
        })

        expect(deserialized).toMatchObject({
            queue: [],
            currentIndex: -1,
            currentTime: 120,
        })
    })

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
        "sanitizes an invalid numeric timestamp (%s)",
        (timestamp) => {
            const deserialized = deserializeSession({
                queue: [mockTrack],
                currentIndex: 0,
                currentTime: 0,
                shuffle: false,
                repeatMode: "off",
                timestamp,
            })

            expect(deserialized?.timestamp).toBe(0)
        }
    )

    it("should reject invalid data", () => {
        expect(deserializeSession(null)).toBeNull()
        expect(deserializeSession("invalid")).toBeNull()
        expect(deserializeSession({ queue: "not-an-array" })).toBeNull()
        expect(deserializeSession({ queue: [{ invalidTrack: true }] })).toBeNull()
    })

    it("should apply urlTransformer", () => {
        const data: SerializedSession = {
            queue: [mockTrack],
            currentIndex: 0,
            currentTime: 0,
            shuffle: false,
            repeatMode: "off",
            timestamp: 1767225600000,
        }

        const transformer = (url: string) => url + "?token=123"
        const deserialized = deserializeSession(data, { urlTransformer: transformer })
        
        expect(deserialized?.queue[0]?.audioFile).toBe("https://example.com/test.mp3?token=123")
    })

    it("should reject expired sessions based on maxAgeMs", () => {
        const data: SerializedSession = {
            queue: [mockTrack],
            currentIndex: 0,
            currentTime: 0,
            shuffle: false,
            repeatMode: "off",
            timestamp: Date.now() - 5000, // 5 seconds old
        }

        expect(deserializeSession(data, { maxAgeMs: 1000 })).toBeNull() // max age 1 sec
        expect(deserializeSession(data, { maxAgeMs: 10000 })).not.toBeNull() // max age 10 sec
    })
})
