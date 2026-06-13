import { describe, expect, it } from "vitest"
import { shouldEnterBuffering } from "../buffering"

describe("shouldEnterBuffering", () => {
    it("does not buffer on waiting/stalled while paused and idle", () => {
        // QA case 1: `waiting` while paused must not show active buffering.
        expect(
            shouldEnterBuffering({
                isPlaying: false,
                isPaused: true,
                hasPendingPlay: false,
            })
        ).toBe(false)
    })

    it("buffers on waiting/stalled while playing", () => {
        // QA case 2: `waiting` while playing can show buffering.
        expect(
            shouldEnterBuffering({
                isPlaying: true,
                isPaused: false,
                hasPendingPlay: false,
            })
        ).toBe(true)
    })

    it("buffers when a play attempt is pending even before the play event", () => {
        // Tap play → loading: spinner is legitimate before the `play` event.
        expect(
            shouldEnterBuffering({
                isPlaying: false,
                isPaused: true,
                hasPendingPlay: true,
            })
        ).toBe(true)
    })

    it("buffers when the backend is not paused", () => {
        expect(
            shouldEnterBuffering({
                isPlaying: false,
                isPaused: false,
                hasPendingPlay: false,
            })
        ).toBe(true)
    })
})
