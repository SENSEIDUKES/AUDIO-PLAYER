/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { workspaceEntries } from "../catalog"
import { WorkshopApp } from "../WorkshopApp"
import { installBrowserStubs } from "./browserStubs"

/* Opens every workspace through its direct link, the way a shared URL would,
   and checks it renders its live view without tripping the crash screen. Then
   leaves and checks nothing it created is still holding an audio element. */

beforeEach(() => {
    installBrowserStubs()
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.history.replaceState(null, "", "/")
})

describe("every workspace opens from a direct link", () => {
    it.each(workspaceEntries().map((entry) => [entry.id, entry.title] as const))(
        "%s",
        async (id, title) => {
            window.history.replaceState(null, "", `/?workspace=${id}`)
            const { unmount } = render(<WorkshopApp />)

            expect(
                await screen.findByRole("heading", { level: 1, name: title })
            ).toBeInTheDocument()
            await vi.waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull(), {
                timeout: 15_000,
            })
            expect(screen.queryByText("This workspace hit an error.")).toBeNull()
            // The live view renders below the shared header.
            expect(
                screen.getByRole("main").querySelector(":scope > .wk-ws-head ~ *")
            ).not.toBeNull()
            expect(screen.getByRole("link", { name: "Workshop" })).toHaveAttribute(
                "href",
                expect.stringMatching(/^\?category=/)
            )

            unmount()
            expect(document.querySelectorAll("audio")).toHaveLength(0)
        },
        30_000
    )
})
