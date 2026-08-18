/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Lab } from "../lab"

describe("Lab page navigation", () => {
    beforeEach(() => {
        class MockIntersectionObserver {
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
        window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
        window.HTMLElement.prototype.scrollIntoView = vi.fn()
    })

    afterEach(() => {
        cleanup()
    })

    it("renders the reusable SectionNav menu on the Lab page with all 10 QA sections", () => {
        render(<Lab />)

        expect(screen.getByLabelText("Lab quick navigation")).toBeInTheDocument()
        expect(screen.getByText("Keys 1–9, 0")).toBeInTheDocument()

        const expectedSections = [
            "Overview",
            "Card Grid",
            "Sidebar",
            "Mobile",
            "Matrix",
            "Sticky",
            "Stress Test",
            "State Tests",
            "Plugins",
            "Backends",
        ]

        for (const label of expectedSections) {
            expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
        }
    })

    it("navigates through Lab sections using keyboard number keys", () => {
        render(<Lab />)

        // Press '4' for Mobile section
        fireEvent.keyDown(window, { key: "4", code: "Digit4" })
        const mobileBtn = screen.getByRole("button", { name: "Mobile" })
        expect(mobileBtn.getAttribute("aria-current")).toBe("true")

        // Press '0' for Backends section (10th item)
        fireEvent.keyDown(window, { key: "0", code: "Digit0" })
        const backendsBtn = screen.getByRole("button", { name: "Backends" })
        expect(backendsBtn.getAttribute("aria-current")).toBe("true")
    })
})
