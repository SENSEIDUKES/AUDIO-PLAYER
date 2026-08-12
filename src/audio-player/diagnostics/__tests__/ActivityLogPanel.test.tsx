/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
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

afterEach(cleanup)

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

    it("requires inline confirmation before clearing the log", () => {
        const clear = vi.fn()
        const log = { ...createMalformedLog([]), clear }

        render(
            <ActivityLogContext.Provider value={log}>
                <ActivityLogPanel />
            </ActivityLogContext.Provider>
        )

        fireEvent.click(screen.getByRole("button", { name: "Clear log" }))

        expect(clear).not.toHaveBeenCalled()
        expect(screen.getByRole("group", { name: "Confirm clearing activity log" })).toBeTruthy()

        fireEvent.click(screen.getByRole("button", { name: "Cancel clearing log" }))
        expect(screen.queryByRole("button", { name: "Confirm clear log" })).toBeNull()
        expect(clear).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole("button", { name: "Clear log" }))
        fireEvent.click(screen.getByRole("button", { name: "Confirm clear log" }))

        expect(clear).toHaveBeenCalledOnce()
        expect(screen.queryByRole("button", { name: "Confirm clear log" })).toBeNull()
    })
})
