// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { CueRuntime } from "../cueRuntime"
import type { CueManifest } from "../cueTypes"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"

/**
 * Minimal PluginPlayerContext for exercising CueRuntime.handleTimeUpdate.
 * Cues use `event.emit`, which dispatches on the root element (null here, so
 * it falls back to `window`); we assert on those events to observe firings.
 */
function makeContext(): PluginPlayerContext {
    return {
        getEngine: () => ({}) as never,
        getRootElement: () => null,
        getAudioElement: () => null,
        getCurrentTrack: () => null,
        getNextTrack: () => null,
        getSourceKey: () => "test",
    }
}

function manifestWithCue(id: string, at: number, opts: { replayable?: boolean } = {}): CueManifest {
    return {
        version: "sap-cues/1",
        cues: [
            {
                id,
                trigger: { kind: "time", at },
                actions: [{ command: "event.emit", eventName: `fired-${id}` }],
                replayable: opts.replayable,
            },
        ],
    }
}

describe("CueRuntime rewind detection", () => {
    let fired: string[]
    let listener: (e: Event) => void

    beforeEach(() => {
        fired = []
        listener = (e: Event) => fired.push(e.type)
        window.addEventListener("fired-c1", listener)
    })

    afterEach(() => {
        window.removeEventListener("fired-c1", listener)
        vi.restoreAllMocks()
    })

    it("fires a time cue once during forward playback", () => {
        const rt = new CueRuntime(makeContext(), manifestWithCue("c1", 5))
        rt.handleTimeUpdate(4)
        rt.handleTimeUpdate(6)
        rt.handleTimeUpdate(7)
        expect(fired).toEqual(["fired-c1"])
    })

    it("replays a replayable cue after an implicit rewind (loop) with no seek event", () => {
        const rt = new CueRuntime(makeContext(), manifestWithCue("c1", 5, { replayable: true }))
        // Play past the cue.
        rt.handleTimeUpdate(4)
        rt.handleTimeUpdate(6)
        expect(fired).toEqual(["fired-c1"])

        // Position jumps backward (loop / custom rewind) WITHOUT isSeeking=true.
        rt.handleTimeUpdate(0)
        // Play forward again — the replayable cue should fire a second time.
        rt.handleTimeUpdate(6)
        expect(fired).toEqual(["fired-c1", "fired-c1"])
    })

    it("does not replay a non-replayable cue after an implicit rewind", () => {
        const rt = new CueRuntime(makeContext(), manifestWithCue("c1", 5))
        rt.handleTimeUpdate(4)
        rt.handleTimeUpdate(6)
        rt.handleTimeUpdate(0)
        rt.handleTimeUpdate(6)
        expect(fired).toEqual(["fired-c1"])
    })
})
