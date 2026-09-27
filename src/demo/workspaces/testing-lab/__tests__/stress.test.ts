import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionEngine } from "../../../../audio-player"
import type { StressAction } from "../bridge"
import { runStress } from "../stress"
import type { StressTarget } from "../stress"

/* A stand-in session with just the surface the routines drive. `faults` breaks
   one promise at a time so each check can be seen failing. */

interface Faults {
    /** The audio element never follows play/pause. */
    elementStuckPlaying?: boolean
    /** Seeks are silently dropped. */
    ignoresSeeks?: boolean
    /** No track has loaded yet. */
    noDuration?: boolean
    /** The session runs on the Web Audio backend. */
    webAudio?: boolean
    /** The browser ignores programmatic volume (iOS). */
    volumeUnsupported?: boolean
    /** Every call throws. */
    throws?: boolean
}

function fakeTarget(faults: Faults = {}): StressTarget {
    const element = { paused: !faults.elementStuckPlaying, muted: false, volume: 1 }
    const queue = [{ title: "One" }, { title: "Two" }, { title: "Three" }]
    const state = { playing: false, muted: false, volume: 1, index: 0, time: 0 }
    const guard = () => {
        if (faults.throws) throw new Error("engine went away")
    }
    const snapshot = {
        get isPlaying() {
            return state.playing
        },
        get isMuted() {
            return state.muted
        },
        get volume() {
            return state.volume
        },
        get currentIndex() {
            return state.index
        },
        get currentTrack() {
            return queue[state.index]
        },
        queue,
        isSeeking: false,
        hasError: false,
        errorMessage: "",
        volumeUnsupported: Boolean(faults.volumeUnsupported),
        audioRef: { current: element },
        getBackendInfo: () => ({ active: faults.webAudio ? "webaudio" : "html5" }),
        toggle: () => {
            guard()
            state.playing = !state.playing
            if (!faults.elementStuckPlaying) element.paused = !state.playing
        },
        seek: (time: number) => {
            guard()
            if (!faults.ignoresSeeks) state.time = time
        },
        next: () => {
            guard()
            state.index = (state.index + 1) % queue.length
        },
        previous: () => {
            guard()
            state.index = (state.index - 1 + queue.length) % queue.length
        },
        setVolume: (volume: number) => {
            guard()
            state.volume = volume
            if (!faults.volumeUnsupported) element.volume = volume
        },
        toggleMute: () => {
            guard()
            state.muted = !state.muted
            element.muted = state.muted
        },
    }
    return {
        session: () => snapshot as unknown as SessionEngine,
        time: () => ({ currentTime: state.time, duration: faults.noDuration ? 0 : 120 }),
    }
}

async function run(action: StressAction, faults?: Faults) {
    const pending = runStress(action, fakeTarget(faults))
    await vi.runAllTimersAsync()
    return pending
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe("stress routines", () => {
    it.each(["toggle-storm", "seek-storm", "skip-storm", "volume-sweep"] as const)(
        "%s passes on a consistent session",
        async (action) => {
            const result = await run(action)
            expect(result.action).toBe(action)
            expect(result.passed).toBe(true)
            expect(result.checks.length).toBeGreaterThan(0)
            expect(result.checks.every((line) => !line.startsWith("✗"))).toBe(true)
        }
    )

    it("catches a play button that no longer matches the audio element", async () => {
        const result = await run("toggle-storm", { elementStuckPlaying: true })
        expect(result.passed).toBe(false)
        expect(result.checks).toContain("✗ Play state matches the audio element (paused)")
    })

    it("catches a seek that did not land", async () => {
        const result = await run("seek-storm", { ignoresSeeks: true })
        expect(result.passed).toBe(false)
        expect(result.checks).toContain("✗ Last seek wins (asked 30.0 s)")
    })

    it("asks for playback first when there is nothing to seek", async () => {
        const result = await run("seek-storm", { noDuration: true })
        expect(result.passed).toBe(false)
        expect(result.checks).toEqual(["✗ Track has no duration yet — press play first"])
    })

    it("lands on a valid queue position after skipping", async () => {
        // 8 × next and 4 × previous from track 1 → track 2.
        const result = await run("skip-storm")
        expect(result.checks).toContain("✓ Queue position is valid (2 of 3)")
        expect(result.checks).toContain("✓ A current track exists (Two)")
    })

    it("restores the level after the volume sweep", async () => {
        const result = await run("volume-sweep")
        expect(result.checks).toContain("✓ Volume restored to 80% (80%)")
        expect(result.checks).toContain("✓ The audio element's volume matches")
    })

    it("skips checks the platform cannot answer instead of failing them", async () => {
        const ios = await run("volume-sweep", { volumeUnsupported: true })
        expect(ios.passed).toBe(true)
        expect(ios.checks).toContain(
            "• Element volume skipped (this browser ignores programmatic volume)"
        )
        const webAudio = await run("toggle-storm", { webAudio: true })
        expect(webAudio.passed).toBe(true)
        expect(webAudio.checks).toContain(
            "• Element check skipped (Web Audio backend or no element)"
        )
    })

    it("reports a crash as a failed run", async () => {
        const result = await run("skip-storm", { throws: true })
        expect(result.passed).toBe(false)
        expect(result.checks).toEqual(["✗ Threw: engine went away"])
    })
})
