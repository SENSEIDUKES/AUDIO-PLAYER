/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SectionNav } from "../SectionNav"

const MOCK_SECTIONS = [
    { id: "sec-1", label: "Alpha", number: "01" },
    { id: "sec-2", label: "Beta", number: "02" },
    { id: "sec-3", label: "Gamma", number: "03" },
] as const

describe("SectionNav Component & Keyboard Shortcuts", () => {
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

    it("renders sections with kbd badges and accessible keyshortcuts attributes", () => {
        render(<SectionNav sections={MOCK_SECTIONS} />)

        const btn1 = screen.getByRole("button", { name: "Alpha" })
        const btn2 = screen.getByRole("button", { name: "Beta" })
        const btn3 = screen.getByRole("button", { name: "Gamma" })

        expect(btn1).toHaveAttribute("aria-keyshortcuts", "1")
        expect(btn2).toHaveAttribute("aria-keyshortcuts", "2")
        expect(btn3).toHaveAttribute("aria-keyshortcuts", "3")
        expect(screen.getByText("Keys 1–3")).toBeInTheDocument()
    })

    it("jumps to section when 1-9 number keys are pressed", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        render(
            <div>
                <SectionNav sections={MOCK_SECTIONS} defaultSectionId="sec-1" />
                <div id="sec-1">Section 1</div>
                <div id="sec-2">Section 2</div>
                <div id="sec-3">Section 3</div>
            </div>
        )

        // Press '2' on keyboard
        fireEvent.keyDown(window, { key: "2", code: "Digit2" })

        const btn2 = screen.getByRole("button", { name: "Beta" })
        expect(btn2.getAttribute("aria-current")).toBe("true")
        expect(scrollIntoViewMock).toHaveBeenCalled()

        // Press '3' on keyboard
        fireEvent.keyDown(window, { key: "3", code: "Digit3" })
        const btn3 = screen.getByRole("button", { name: "Gamma" })
        expect(btn3.getAttribute("aria-current")).toBe("true")
    })

    it("does not trigger keyboard shortcuts when typing in inputs or textareas", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        render(
            <div>
                <SectionNav sections={MOCK_SECTIONS} defaultSectionId="sec-1" />
                <input data-testid="test-input" />
                <div id="sec-1">Section 1</div>
                <div id="sec-2">Section 2</div>
            </div>
        )

        const input = screen.getByTestId("test-input")
        input.focus()

        // Press '2' while focused in input
        fireEvent.keyDown(input, { key: "2", code: "Digit2" })

        const btn1 = screen.getByRole("button", { name: "Alpha" })
        const btn2 = screen.getByRole("button", { name: "Beta" })
        expect(btn1.getAttribute("aria-current")).toBe("true")
        expect(btn2.getAttribute("aria-current")).toBeNull()
        expect(scrollIntoViewMock).not.toHaveBeenCalled()
    })

    it("ignores keypresses when modifier keys (metaKey, ctrlKey, altKey) are pressed", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        render(
            <div>
                <SectionNav sections={MOCK_SECTIONS} defaultSectionId="sec-1" />
                <div id="sec-1">Section 1</div>
                <div id="sec-2">Section 2</div>
            </div>
        )

        // Press Cmd+2 or Ctrl+2 (like browser tab switching)
        fireEvent.keyDown(window, { key: "2", code: "Digit2", metaKey: true })
        expect(scrollIntoViewMock).not.toHaveBeenCalled()

        fireEvent.keyDown(window, { key: "2", code: "Digit2", ctrlKey: true })
        expect(scrollIntoViewMock).not.toHaveBeenCalled()
    })

    it("supports 10 sections with key '0' mapped to the 10th section", () => {
        const scrollIntoViewMock = vi.fn()
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

        const tenSections = Array.from({ length: 10 }, (_, i) => ({
            id: `sec-${i + 1}`,
            label: `Section ${i + 1}`,
            number: String(i + 1).padStart(2, "0"),
        }))

        render(
            <div>
                <SectionNav sections={tenSections} defaultSectionId="sec-1" />
                {tenSections.map((s) => (
                    <div key={s.id} id={s.id}>
                        {s.label}
                    </div>
                ))}
            </div>
        )

        expect(screen.getByText("Keys 1–9, 0")).toBeInTheDocument()
        const btn10 = screen.getByRole("button", { name: "Section 10" })
        expect(btn10).toHaveAttribute("aria-keyshortcuts", "0")

        // Press '0' to jump to 10th section
        fireEvent.keyDown(window, { key: "0", code: "Digit0" })
        expect(btn10.getAttribute("aria-current")).toBe("true")
        expect(scrollIntoViewMock).toHaveBeenCalled()
    })
})
