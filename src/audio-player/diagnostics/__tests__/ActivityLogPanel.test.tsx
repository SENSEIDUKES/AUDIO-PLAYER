import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ActivityLogPanel } from "../ActivityLogPanel"
import { ActivityLogContext } from "../useActivityLog"
import type { ActivityLogApi } from "../activityTypes"

function createMalformedLog(events: readonly unknown[]): ActivityLogApi {
    return {
        record: () => {},
        events: events as ActivityLogApi["events"],
        clear: () => {},
        exportJson: () => "[]",
        exportText: () => "",
        maxEntries: 200,
        count: events.length,
    }
}

describe("ActivityLogPanel", () => {
    it("renders safely without an ActivityLogProvider", () => {
        const html = renderToStaticMarkup(<ActivityLogPanel />)

        expect(html).toContain("No events recorded yet.")
    })

    it("renders malformed activity entries with safe fallbacks", () => {
        const log = createMalformedLog([
            undefined,
            { id: 1, timestamp: Number.NaN, message: undefined },
            {
                id: 2,
                timestamp: 1,
                area: "playback",
                status: "info",
                message: "ok",
            },
        ])

        const html = renderToStaticMarkup(
            <ActivityLogContext.Provider value={log}>
                <ActivityLogPanel />
            </ActivityLogContext.Provider>
        )

        expect(html).toContain("Malformed activity event")
        expect(html).toContain("System")
        expect(html).toContain("Playback")
        expect(html).toContain("ok")
    })
})
