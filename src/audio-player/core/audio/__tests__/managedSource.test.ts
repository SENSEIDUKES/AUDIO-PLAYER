/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import { HTML5AudioBackend } from "../HTML5AudioBackend"

describe("managed HTML5 sources", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("reattaches the same effective URL after a managed source is cleared", () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        const audio = document.createElement("audio")
        const backend = new HTML5AudioBackend({ current: audio })
        const url = "blob:https://audio.test/reused"

        backend.setSource(url)
        expect(audio.getAttribute("src")).toBe(url)

        backend.clearSource()
        expect(audio.getAttribute("src")).toBeNull()

        backend.setSource(url)
        expect(audio.getAttribute("src")).toBe(url)
    })
})
