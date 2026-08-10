/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import {
    AudioSessionProvider,
    useAudioSession,
    useAudioTime,
} from "../AudioSessionContext"
import type { SessionEngine } from "../../types"

describe("AudioSessionContext timeline isolation", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("updates time consumers without re-rendering main session consumers", async () => {
        let nextFrame: FrameRequestCallback | null = null
        let frameId = 0
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn((callback: FrameRequestCallback) => {
                nextFrame = callback
                return ++frameId
            })
        )
        vi.stubGlobal("cancelAnimationFrame", vi.fn())
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})

        let sessionRenders = 0
        let timeRenders = 0
        let session: SessionEngine | null = null
        let renderedTime = 0

        function SessionProbe() {
            session = useAudioSession()
            sessionRenders += 1
            return null
        }

        function TimeProbe() {
            renderedTime = useAudioTime().currentTime
            timeRenders += 1
            return null
        }

        const container = document.createElement("div")
        const root = createRoot(container)

        await React.act(async () => {
            root.render(
                <AudioSessionProvider>
                    <SessionProbe />
                    <TimeProbe />
                </AudioSessionProvider>
            )
        })

        const audio = container.querySelector("audio")!
        let paused = false
        Object.defineProperty(audio, "paused", {
            configurable: true,
            get: () => paused,
        })
        Object.defineProperty(audio, "ended", {
            configurable: true,
            get: () => false,
        })

        await React.act(async () => {
            audio.dispatchEvent(new Event("play"))
        })

        const sessionRendersAfterPlay = sessionRenders
        const timeRendersAfterPlay = timeRenders
        expect(nextFrame).not.toBeNull()

        audio.currentTime = 1
        await React.act(async () => {
            nextFrame!(20)
        })

        expect(renderedTime).toBe(1)
        expect(timeRenders).toBeGreaterThan(timeRendersAfterPlay)
        expect(sessionRenders).toBe(sessionRendersAfterPlay)
        expect(session!.currentTime).toBe(1)

        paused = true
        await React.act(async () => {
            root.unmount()
        })
    })
})
