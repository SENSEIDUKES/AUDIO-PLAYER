/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getEntry } from "../catalog"
import { WorkspaceFrame } from "../WorkspaceFrame"

function Broken(): never {
    throw new Error("engine exploded")
}

// React rethrows render errors in development, which jsdom reports as uncaught.
const swallowCrash = (event: ErrorEvent) => event.preventDefault()

beforeEach(() => {
    // React and the boundary both report the crash; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    window.addEventListener("error", swallowCrash)
})

afterEach(() => {
    window.removeEventListener("error", swallowCrash)
    cleanup()
    vi.restoreAllMocks()
    window.history.replaceState(null, "", "/")
})

describe("WorkspaceFrame", () => {
    it("contains a crashing workspace and goes back without reloading the page", () => {
        const entry = getEntry("queue")
        if (!entry) throw new Error("The Queue entry is missing from the catalog")
        window.history.replaceState(null, "", "/?workspace=queue")
        render(
            <WorkspaceFrame entry={entry}>
                <Broken />
            </WorkspaceFrame>
        )

        const alert = screen.getByRole("alert")
        expect(alert).toHaveTextContent("This workspace hit an error.")
        expect(alert).toHaveTextContent("engine exploded")
        expect(screen.getByRole("heading", { level: 1, name: "Queue" })).toBeInTheDocument()

        const back = screen.getByRole("link", { name: "Back to the Workshop" })
        // fireEvent returns false when the click's default (a full page load) was prevented.
        expect(fireEvent.click(back)).toBe(false)
        expect(window.location.search).toBe("?category=systems")
    })
})
