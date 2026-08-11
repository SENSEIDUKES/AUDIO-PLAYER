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

    it("does not rewrite a relative source that already resolves to the effective URL", () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        const audio = document.createElement("audio")
        const backend = new HTML5AudioBackend({ current: audio })
        const relativeUrl = "chapter.mp3"
        const absoluteUrl = new URL(relativeUrl, document.baseURI).href

        audio.setAttribute("src", relativeUrl)
        backend.setSource(absoluteUrl)
        expect(audio.getAttribute("src")).toBe(relativeUrl)

        backend.clearSource()
        backend.setSource(absoluteUrl)
        expect(audio.getAttribute("src")).toBe(absoluteUrl)
    })
})
