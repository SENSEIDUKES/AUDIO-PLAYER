/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import type { SessionEngine, TrackSourceResolver } from "../../types"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"

describe("AudioSessionContext sourceResolver", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("forwards managed resolution and releases each queue track exactly once", async () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
        const play = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockResolvedValue()

        const releases = new Map<string, ReturnType<typeof vi.fn>>()
        const resolver = vi.fn<TrackSourceResolver>(async (source) => {
            const key = source.url.endsWith("a.mp3") ? "a" : "b"
            const release = vi.fn()
            releases.set(key, release)
            return { url: `blob:https://audio.test/${key}`, release }
        })
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
                        { title: "A", artist: "Narrator", audioFile: "a.mp3" },
                        { title: "B", artist: "Narrator", audioFile: "b.mp3" }
                    ]}
                    sourceResolver={resolver}
                >
                    <Probe />
                </AudioSessionProvider>
            )
        })

        expect(session!.currentSrc).toBe("blob:https://audio.test/a")
        expect(play).not.toHaveBeenCalled()

        await React.act(async () => session!.playTrack(1))

        expect(releases.get("a")).toHaveBeenCalledTimes(1)
        expect(session!.currentTrack?.title).toBe("B")
        expect(session!.currentSrc).toBe("blob:https://audio.test/b")
        expect(play).toHaveBeenCalledTimes(1)

        await React.act(async () => root.unmount())
        expect(releases.get("b")).toHaveBeenCalledTimes(1)
        expect(resolver).toHaveBeenCalledTimes(2)
    })

    it("continues a playing shared session across a resolved next-track change", async () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
            this: HTMLMediaElement
        ) {
            this.dispatchEvent(new Event("pause"))
        })
        const play = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockImplementation(function (this: HTMLMediaElement) {
                this.dispatchEvent(new Event("play"))
                return Promise.resolve()
            })
        const releases = [vi.fn(), vi.fn()]
        const resolver = vi.fn<TrackSourceResolver>(async (source) => {
            const index = source.url.endsWith("a.mp3") ? 0 : 1
            return {
                url: `blob:https://audio.test/session-${index}`,
                release: releases[index]
            }
        })
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
                        { title: "A", artist: "Narrator", audioFile: "a.mp3" },
                        { title: "B", artist: "Narrator", audioFile: "b.mp3" }
                    ]}
                    sourceResolver={resolver}
                >
                    <Probe />
                </AudioSessionProvider>
            )
        })
        await React.act(async () => session!.play())

        expect(session!.isPlaying).toBe(true)
        expect(play).toHaveBeenCalledTimes(1)

        await React.act(async () => session!.next())

        expect(session!.currentTrack?.title).toBe("B")
        expect(session!.isPlaying).toBe(true)
        expect(session!.currentSrc).toBe("blob:https://audio.test/session-1")
        expect(play).toHaveBeenCalledTimes(2)
        expect(releases[0]).toHaveBeenCalledTimes(1)

        await React.act(async () => root.unmount())
        expect(releases[1]).toHaveBeenCalledTimes(1)
    })
})
