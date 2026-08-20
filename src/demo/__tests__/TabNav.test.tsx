/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TabNav, TABS } from "../TabNav"

describe("TabNav", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders all four navigation tabs with descriptive labels", () => {
        const onTabChange = vi.fn()
        render(<TabNav tab="showcase" onTabChange={onTabChange} />)

        expect(TABS).toHaveLength(4)
        for (const t of TABS) {
            const button = screen.getByRole("tab", { name: t.label })
            expect(button).toBeDefined()
            expect(button.textContent).toBe(t.label)
        }
    })

    it("marks the active tab with aria-selected and the active class modifier", () => {
        const onTabChange = vi.fn()
        const { rerender } = render(<TabNav tab="showcase" onTabChange={onTabChange} />)

        const showcaseTab = screen.getByRole("tab", { name: "Showcase" })
        const labTab = screen.getByRole("tab", { name: "Lab" })

        expect(showcaseTab.getAttribute("aria-selected")).toBe("true")
        expect(showcaseTab.className).toContain("demo-mode__button--active")
        expect(labTab.getAttribute("aria-selected")).toBe("false")
        expect(labTab.className).not.toContain("demo-mode__button--active")

        rerender(<TabNav tab="surfaces" onTabChange={onTabChange} />)
        const surfacesTab = screen.getByRole("tab", { name: "Surfaces" })
        expect(surfacesTab.getAttribute("aria-selected")).toBe("true")
        expect(surfacesTab.className).toContain("demo-mode__button--active")
    })

    it("triggers onTabChange when a tab is clicked", () => {
        const onTabChange = vi.fn()
        render(<TabNav tab="showcase" onTabChange={onTabChange} />)

        const workshopTab = screen.getByRole("tab", { name: "Workshop" })
        fireEvent.click(workshopTab)

        expect(onTabChange).toHaveBeenCalledTimes(1)
        expect(onTabChange).toHaveBeenCalledWith("workshop")

        const surfacesTab = screen.getByRole("tab", { name: "Surfaces" })
        fireEvent.click(surfacesTab)

        expect(onTabChange).toHaveBeenCalledTimes(2)
        expect(onTabChange).toHaveBeenCalledWith("surfaces")
    })
})
