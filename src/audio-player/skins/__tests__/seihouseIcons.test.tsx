// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, expect, it } from "vitest"
import * as icons from "../seihouse-icons"

afterEach(cleanup)

const ICONS = Object.entries(icons).filter(([name]) => /^SEI\w+Icon$/.test(name)) as [
    string,
    (props: icons.SEIIconProps) => React.ReactElement,
][]

it("paints every SEIHouse icon with currentColor and hides it unless named", () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(20)
    for (const [name, Icon] of ICONS) {
        const { container, unmount } = render(<Icon />)
        const svg = container.querySelector("svg")
        expect(svg, name).toHaveAttribute("aria-hidden", "true")
        expect(container.innerHTML.includes("currentColor"), name).toBe(true)
        unmount()
    }
})

it("becomes an image when given a name, and takes a size", () => {
    render(<icons.SEIExitIcon aria-label="Exit" size={32} />)
    const exit = screen.getByRole("img", { name: "Exit" })
    expect(exit).toHaveAttribute("width", "32")
    expect(exit).not.toHaveAttribute("aria-hidden")
})
