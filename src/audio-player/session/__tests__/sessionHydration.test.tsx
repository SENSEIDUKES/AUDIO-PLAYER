/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import type { SessionEngine, Track } from "../../types"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"
import { deserializeSession } from "../sessionSerializer"

const TRACKS: Track[] = [
    { title: "Chapter One", artist: "Narrator", audioFile: "one.mp3" },
    { title: "Chapter Two", artist: "Narrator", audioFile: "two.mp3" },
]

describe("AudioSessionProvider session hydration", () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("restores a deserialized queue, index, and time without autoplay", async () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
        const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
        const restored = deserializeSession({
            queue: TRACKS,
            currentIndex: 1,
            currentTime: 42,
            shuffle: true,
            repeatMode: "all",
            timestamp: Date.now(),
        })!
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
                    initialQueue={restored.queue}
                    initialIndex={restored.currentIndex}
                    initialCurrentTime={restored.currentTime}
                    shuffle={restored.shuffle}
                    repeatMode={restored.repeatMode}
                >
                    <Probe />
                </AudioSessionProvider>
            )
        })

        const audio = container.querySelector("audio")!
        let currentTime = 0
        const setCurrentTime = vi.fn((value: number) => {
            currentTime = value
        })
        Object.defineProperties(audio, {
            currentTime: {
                configurable: true,
                get: () => currentTime,
                set: setCurrentTime,
            },
            duration: {
                configurable: true,
                get: () => 180,
            },
        })

        await React.act(async () => {
            audio.dispatchEvent(new Event("loadedmetadata"))
        })

        expect(session!.currentIndex).toBe(1)
        expect(session!.currentTrack).toEqual(TRACKS[1])
        expect(session!.shuffle).toBe(true)
        expect(session!.repeatMode).toBe("all")
        expect(session!.currentTime).toBe(42)
        expect(session!.isPlaying).toBe(false)
        expect(setCurrentTime).toHaveBeenCalledOnce()
        expect(setCurrentTime).toHaveBeenCalledWith(42)
        expect(play).not.toHaveBeenCalled()

        await React.act(async () => root.unmount())
    })

    it("clamps cached metadata hydration once under StrictMode", async () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
        const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
        vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(1)
        vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(30)
        const currentTimeSetter = Object.getOwnPropertyDescriptor(
            HTMLMediaElement.prototype,
            "currentTime"
        )!.set!
        const setCurrentTime = vi
            .spyOn(HTMLMediaElement.prototype, "currentTime", "set")
            .mockImplementation(function (this: HTMLMediaElement, value: number) {
                currentTimeSetter.call(this, value)
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
                <React.StrictMode>
                    <AudioSessionProvider initialQueue={TRACKS} initialCurrentTime={90}>
                        <Probe />
                    </AudioSessionProvider>
                </React.StrictMode>
            )
        })

        const restoredSeeks = setCurrentTime.mock.calls.filter(([value]) => value === 30)
        expect(restoredSeeks).toHaveLength(1)
        expect(session!.currentTime).toBe(30)
        expect(session!.isPlaying).toBe(false)
        expect(play).not.toHaveBeenCalled()

        await React.act(async () => root.unmount())
    })

    it("does not reapply the restored time after a later track change", async () => {
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
                <AudioSessionProvider initialQueue={TRACKS} initialCurrentTime={12}>
                    <Probe />
                </AudioSessionProvider>
            )
        })

        const audio = container.querySelector("audio")!
        let currentTime = 0
        const setCurrentTime = vi.fn((value: number) => {
            currentTime = value
        })
        Object.defineProperties(audio, {
            currentTime: {
                configurable: true,
                get: () => currentTime,
                set: setCurrentTime,
            },
            duration: {
                configurable: true,
                get: () => 180,
            },
        })

        await React.act(async () => {
            audio.dispatchEvent(new Event("loadedmetadata"))
        })
        await React.act(async () => session!.next())
        await React.act(async () => {
            audio.dispatchEvent(new Event("loadedmetadata"))
        })

        expect(session!.currentIndex).toBe(1)
        expect(setCurrentTime.mock.calls.filter(([value]) => value === 12)).toHaveLength(1)
        expect(session!.currentTime).toBe(0)

        await React.act(async () => root.unmount())
    })

    it("keeps an empty restored queue valid and never seeks", async () => {
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
        const setCurrentTime = vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set")
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
                    initialQueue={[]}
                    initialIndex={Number.POSITIVE_INFINITY}
                    initialCurrentTime={120}
                >
                    <Probe />
                </AudioSessionProvider>
            )
        })

        expect(session!.queue).toEqual([])
        expect(session!.currentIndex).toBe(-1)
        expect(session!.currentTrack).toBeNull()
        expect(setCurrentTime).not.toHaveBeenCalled()

        await React.act(async () => root.unmount())
    })
})
