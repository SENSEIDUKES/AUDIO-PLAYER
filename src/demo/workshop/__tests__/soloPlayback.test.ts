/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { installSoloPlayback, pauseOtherAudio } from "../soloPlayback"

/** jsdom has no media pipeline: give an element a controllable paused state. */
function fakeMedia<T extends HTMLMediaElement>(element: T, playing: boolean): T {
    let paused = !playing
    Object.defineProperty(element, "paused", { configurable: true, get: () => paused })
    element.pause = vi.fn(() => {
        paused = true
    })
    document.body.appendChild(element)
    return element
}

afterEach(() => {
    document.body.innerHTML = ""
})

describe("solo playback guard", () => {
    it("pauses every other playing <audio> when one starts", () => {
        const uninstall = installSoloPlayback(document)
        const first = fakeMedia(document.createElement("audio"), true)
        const second = fakeMedia(document.createElement("audio"), true)
        const idle = fakeMedia(document.createElement("audio"), false)

        second.dispatchEvent(new Event("play"))

        expect(first.pause).toHaveBeenCalledTimes(1)
        expect(second.pause).not.toHaveBeenCalled()
        expect(idle.pause).not.toHaveBeenCalled()
        uninstall()
    })

    it("never touches background <video> elements", () => {
        const uninstall = installSoloPlayback(document)
        const video = fakeMedia(document.createElement("video"), true)
        const audio = fakeMedia(document.createElement("audio"), false)
        audio.dispatchEvent(new Event("play"))
        expect(video.pause).not.toHaveBeenCalled()
        video.dispatchEvent(new Event("play"))
        expect(audio.pause).not.toHaveBeenCalled()
        uninstall()
    })

    it("reports starts and stops listening once uninstalled", () => {
        const onPlay = vi.fn()
        const uninstall = installSoloPlayback(document, { onPlay })
        const first = fakeMedia(document.createElement("audio"), true)
        const second = fakeMedia(document.createElement("audio"), true)
        second.dispatchEvent(new Event("play"))
        expect(onPlay).toHaveBeenCalledWith(second)

        uninstall()
        first.dispatchEvent(new Event("play"))
        expect(second.pause).not.toHaveBeenCalled()
        expect(onPlay).toHaveBeenCalledTimes(1)
    })

    it("can pause everything on request", () => {
        const a = fakeMedia(document.createElement("audio"), true)
        const b = fakeMedia(document.createElement("audio"), true)
        expect(pauseOtherAudio(document, null)).toBe(2)
        expect(a.pause).toHaveBeenCalled()
        expect(b.pause).toHaveBeenCalled()
    })
})
