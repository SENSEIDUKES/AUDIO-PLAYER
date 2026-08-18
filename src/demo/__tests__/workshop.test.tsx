/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Workshop } from "../workshop"

describe("Workshop Vertical Navigation", () => {
    beforeEach(() => {
        class MockIntersectionObserver {
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
        window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    })

    afterEach(() => {
        cleanup()
    })

    it("renders all workshop section navigation pills and section target anchors", () => {
        render(<Workshop />)

        // Verify quick subnav buttons exist
        expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Face Picker" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Controls" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Plugins" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Presets" })).toBeInTheDocument()

        // Verify target sections with matching IDs exist
        expect(document.getElementById("workshop-header")).toBeInTheDocument()
        expect(document.getElementById("workshop-face")).toBeInTheDocument()
        expect(document.getElementById("workshop-controls")).toBeInTheDocument()
        expect(document.getElementById("workshop-plugins")).toBeInTheDocument()
        expect(document.getElementById("workshop-preview")).toBeInTheDocument()
        expect(document.getElementById("workshop-presets")).toBeInTheDocument()
    })

    it("activates pills and triggers scrollIntoView on button click in Workshop", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        render(<Workshop />)

        const controlsButton = screen.getByRole("button", { name: "Controls" })
        fireEvent.click(controlsButton)

        expect(controlsButton.getAttribute("aria-current")).toBe("true")
        expect(controlsButton.className).toContain("showcase-subnav__pill--active")
        expect(scrollIntoViewMock).toHaveBeenCalled()
    })

    it("toggles mobile menu drawer on mobile trigger click", () => {
        render(<Workshop />)

        const triggerButton = screen.getByRole("button", { name: "Toggle vertical section menu" })
        expect(triggerButton).toBeInTheDocument()
        expect(triggerButton.getAttribute("aria-expanded")).toBe("false")

        fireEvent.click(triggerButton)
        expect(triggerButton.getAttribute("aria-expanded")).toBe("true")

        const closeButton = screen.getByRole("button", { name: "Close menu" })
        expect(closeButton).toBeInTheDocument()

        fireEvent.click(closeButton)
        expect(triggerButton.getAttribute("aria-expanded")).toBe("false")
    })
})
