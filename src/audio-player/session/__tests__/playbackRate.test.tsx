/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import type { SessionEngine } from "../../types"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"

describe("AudioSessionContext playback rate", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("shares the current rate and preserves it across queue track changes", async () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()

        let session: SessionEngine | null = null

        function Probe() {
            session = useAudioSession()
            return null
        }

        const container = document.createElement("div")
        const root = createRoot(container)
        await React.act(async () => {
            root.render(
                <AudioSessionProvider
                    initialQueue={[
                        { title: "Track A", artist: "Artist", audioFile: "a.mp3" },
                        { title: "Track B", artist: "Artist", audioFile: "b.mp3" },
                    ]}
                >
                    <Probe />
                </AudioSessionProvider>
            )
        })

        const audio = container.querySelector("audio")!
        expect(session!.playbackRate).toBe(1)

        await React.act(async () => {
            session!.setPlaybackRate(2)
        })
        expect(session!.playbackRate).toBe(2)
        expect(audio.playbackRate).toBe(2)

        await React.act(async () => {
            session!.playTrack(1)
        })
        expect(session!.currentTrack?.title).toBe("Track B")
        expect(session!.playbackRate).toBe(2)
        expect(audio.playbackRate).toBe(2)

        await React.act(async () => {
            session!.setPlaybackRate(-10)
        })
        expect(session!.playbackRate).toBe(0.5)
        expect(audio.playbackRate).toBe(0.5)

        await React.act(async () => {
            root.unmount()
        })
    })
})
