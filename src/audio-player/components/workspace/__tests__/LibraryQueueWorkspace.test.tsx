import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LibraryQueueWorkspace } from "../LibraryQueueWorkspace"
import type { WorkspaceQueueState } from "../LibraryQueueWorkspace"
import type { Track } from "../../../types"

const TRACK: Track = { id: "a", title: "Angel Numbers", artist: "SENSEI", audioFile: "a.mp3" }

describe("LibraryQueueWorkspace", () => {
    it("renders the queue in play order with the current row marked", () => {
        const queue: WorkspaceQueueState = {
            tracks: [TRACK, { ...TRACK, id: "b", title: "No Luck" }],
            currentIndex: 1,
            isPlaying: true,
            onPlayTrack: () => {},
        }
        const html = renderToStaticMarkup(<LibraryQueueWorkspace queue={queue} />)
        expect(html).toContain("Angel Numbers")
        expect(html).toContain("No Luck")
        expect(html).toContain("sap-ctl__queue-item--current")
        expect(html).toContain("Now playing: No Luck by SENSEI")
    })

    it("renders an honest empty panel rather than a dead list", () => {
        expect(renderToStaticMarkup(<LibraryQueueWorkspace />)).toContain("The queue is empty")
        expect(
            renderToStaticMarkup(<LibraryQueueWorkspace queue={{ tracks: [], currentIndex: 0 }} />)
        ).toContain("The queue is empty")
    })

    it("survives a snapshot with no tracks at all from an untyped host", () => {
        // A plain-JS host can pass `{ count: 3 }` — the controller sheet must
        // not throw on it. Cast is the point of the test, not an oversight.
        const malformed = { currentIndex: 0 } as unknown as WorkspaceQueueState
        expect(() =>
            renderToStaticMarkup(<LibraryQueueWorkspace queue={malformed} />)
        ).not.toThrow()
        expect(renderToStaticMarkup(<LibraryQueueWorkspace queue={malformed} />)).toContain(
            "The queue is empty"
        )
    })

    it("keys duplicate queue entries distinctly", () => {
        // Queue › Play Later on an already-queued track puts the same track in
        // twice; an id-only key would collide and mis-reconcile.
        const warn = vi.spyOn(console, "error").mockImplementation(() => {})
        const html = renderToStaticMarkup(
            <LibraryQueueWorkspace
                queue={{ tracks: [TRACK, TRACK, TRACK], currentIndex: 0, onPlayTrack: () => {} }}
            />
        )
        // One row index badge per entry — all three survive rendering.
        expect(html.match(/sap-ctl__queue-index/g)).toHaveLength(3)
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })

    it("omits the remove control when the host cannot remove tracks", () => {
        const base = { tracks: [TRACK], currentIndex: 0 }
        expect(renderToStaticMarkup(<LibraryQueueWorkspace queue={base} />)).not.toContain(
            "sap-ctl__queue-remove"
        )
        expect(
            renderToStaticMarkup(<LibraryQueueWorkspace queue={{ ...base, onRemove: () => {} }} />)
        ).toContain("sap-ctl__queue-remove")
    })
})
