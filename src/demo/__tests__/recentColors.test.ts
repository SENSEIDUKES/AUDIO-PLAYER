/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest"
import { getRecentColors, pushRecentColor } from "../recentColors"

describe("recentColors", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it("starts empty", () => {
        expect(getRecentColors()).toEqual([])
    })

    it("adds a color to the front", () => {
        pushRecentColor("#7C5CFF")
        expect(getRecentColors()).toEqual(["#7c5cff"])
    })

    it("dedupes and moves an existing color back to the front", () => {
        pushRecentColor("#111111")
        pushRecentColor("#222222")
        pushRecentColor("#111111")
        expect(getRecentColors()).toEqual(["#111111", "#222222"])
    })

    it("caps the list at 8 entries", () => {
        for (let i = 0; i < 10; i++) {
            pushRecentColor(`#${i.toString(16).padStart(6, "0")}`)
        }
        const recents = getRecentColors()
        expect(recents.length).toBe(8)
        // most recent (9, then 8...) should be at the front
        expect(recents[0]).toBe("#000009")
    })

    it("persists across calls via localStorage", () => {
        pushRecentColor("#abcdef")
        expect(getRecentColors()).toEqual(["#abcdef"])
    })
})
