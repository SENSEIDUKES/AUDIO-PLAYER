/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Showcase } from "../showcase"

describe("Showcase Mobile & Navigation Layout", () => {
    beforeEach(() => {
        class MockIntersectionObserver {
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
        window.IntersectionObserver =
            MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    afterEach(() => {
        cleanup()
    })

    it("renders all showcase sections and jump navigation pills", () => {
        render(<Showcase />)

        // Verify jump subnav buttons exist
        expect(screen.getByRole("button", { name: "Featured" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Families" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Primary" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Compact" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Specs" })).toBeInTheDocument()

        // Verify main section titles and anchors
        expect(screen.getByText("One playback layer, two player families.")).toBeInTheDocument()
        expect(screen.getByText("Two player families")).toBeInTheDocument()
        expect(screen.getByText("PrimaryPlayer family")).toBeInTheDocument()
        expect(screen.getByText("CompactPlayer family")).toBeInTheDocument()
    })

    it("activates pills and triggers scrollIntoView on button click", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        render(<Showcase />)

        const familiesButton = screen.getByRole("button", { name: "Families" })
        fireEvent.click(familiesButton)

        expect(familiesButton.getAttribute("aria-current")).toBe("true")
        expect(familiesButton.className).toContain("showcase-subnav__pill--active")
        expect(scrollIntoViewMock).toHaveBeenCalled()
    })

    it("renders hero quick action buttons and responds to user interaction", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        render(<Showcase />)

        const exploreFacesBtn = screen.getByRole("button", { name: "Explore Faces" })
        const architectureBtn = screen.getByRole("button", { name: "Architecture" })

        expect(exploreFacesBtn).toBeInTheDocument()
        expect(architectureBtn).toBeInTheDocument()

        fireEvent.click(exploreFacesBtn)
        expect(scrollIntoViewMock).toHaveBeenCalled()

        fireEvent.click(architectureBtn)
        expect(scrollIntoViewMock).toHaveBeenCalledTimes(2)

        expect(
            screen.getByText(
                "Unified audio engine powering flagship release surfaces and compact utility players."
            )
        ).toBeInTheDocument()
    })
})
