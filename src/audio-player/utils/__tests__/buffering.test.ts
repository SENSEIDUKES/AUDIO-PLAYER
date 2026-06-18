import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    BUFFERING_SPINNER_DELAY_MS,
    createBufferingDebounce,
    shouldEnterBuffering,
} from "../buffering"

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

describe("createBufferingDebounce", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("does not show the spinner for a stall that resolves before the threshold", () => {
        // A routine mid-playback blip: `waiting` then `playing`/`canplay` within
        // the window must never flash the spinner.
        const show = vi.fn()
        const debounce = createBufferingDebounce()

        debounce.schedule(show)
        vi.advanceTimersByTime(BUFFERING_SPINNER_DELAY_MS - 1)
        debounce.cancel() // resolution arrives in time

        vi.runAllTimers()
        expect(show).not.toHaveBeenCalled()
    })

    it("shows the spinner once a stall outlasts the threshold", () => {
        const show = vi.fn()
        const debounce = createBufferingDebounce()

        debounce.schedule(show)
        vi.advanceTimersByTime(BUFFERING_SPINNER_DELAY_MS)

        expect(show).toHaveBeenCalledTimes(1)
    })

    it("measures the delay from the first stall, not the last (no restart)", () => {
        // A run of `waiting`/`stalled` events must not keep pushing the deadline
        // out — otherwise a flapping connection would never show the spinner.
        const show = vi.fn()
        const debounce = createBufferingDebounce()

        debounce.schedule(show)
        vi.advanceTimersByTime(BUFFERING_SPINNER_DELAY_MS - 100)
        debounce.schedule(show) // second `waiting` — should be a no-op
        vi.advanceTimersByTime(100)

        expect(show).toHaveBeenCalledTimes(1)
    })

    it("can be re-armed after firing", () => {
        const show = vi.fn()
        const debounce = createBufferingDebounce()

        debounce.schedule(show)
        vi.advanceTimersByTime(BUFFERING_SPINNER_DELAY_MS)
        expect(show).toHaveBeenCalledTimes(1)

        debounce.schedule(show)
        vi.advanceTimersByTime(BUFFERING_SPINNER_DELAY_MS)
        expect(show).toHaveBeenCalledTimes(2)
    })

    it("cancel after firing is a harmless no-op", () => {
        const show = vi.fn()
        const debounce = createBufferingDebounce()

        debounce.schedule(show)
        vi.advanceTimersByTime(BUFFERING_SPINNER_DELAY_MS)
        expect(() => debounce.cancel()).not.toThrow()
        expect(show).toHaveBeenCalledTimes(1)
    })
})
