// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { ChoiceStepper, sliderLocale } from "../controls"

afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute("lang")
    document.documentElement.removeAttribute("dir")
})

function element(lang: string, direction: "ltr" | "rtl") {
    const host = document.createElement("div")
    host.setAttribute("lang", lang)
    const child = document.createElement("div")
    child.style.direction = direction
    host.append(child)
    document.body.append(host)
    return child
}

it("lays a slider out in the page's language when it agrees with the page's direction", () => {
    expect(sliderLocale(element("ar", "rtl"))).toBe("ar")
    expect(sliderLocale(element("ur-PK", "rtl"))).toBe("ur-PK")
    expect(sliderLocale(element("de", "ltr"))).toBe("de")
})

it("follows the page's direction when the language says otherwise", () => {
    // An Arabic interface on an English device: the thumb must grow from the right too.
    expect(sliderLocale(element("en-US", "rtl"))).toBe("ar")
    expect(sliderLocale(element("he", "ltr"))).toBe("en-US")
})

it("lets each choice keep its own text direction", () => {
    render(
        <ChoiceStepper
            id="score"
            rowLabel="Score"
            value="a"
            options={[{ value: "a", label: "1 · Grand Orchestral Fanfare" }]}
            labels={{ previous: (row) => `Previous ${row}`, next: (row) => `Next ${row}` }}
            ariaLabel="Score"
            onChange={() => {}}
        />
    )
    expect(screen.getByRole("combobox", { name: "Score" })).toHaveAttribute("dir", "auto")
})
