/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import type { AudioPlayerEngine, TrackSource } from "../types"
import { useAudioPlayer } from "../useAudioPlayer"

describe("useAudioPlayer playback rate", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("exposes a sanitized rate and preserves it through playback, seek, fallback, and track changes", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
        vi.stubGlobal("cancelAnimationFrame", vi.fn())
        vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
            this: HTMLMediaElement
        ) {
            this.dispatchEvent(new Event("play"))
            return Promise.resolve()
        })
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
            this: HTMLMediaElement
        ) {
            this.dispatchEvent(new Event("pause"))
        })

        let engine: AudioPlayerEngine | null = null
        const fallback = vi.fn()

        function Harness({
            sourceKey,
            sources,
        }: {
            sourceKey: string
            sources: readonly TrackSource[]
        }) {
            engine = useAudioPlayer({
                src: sources[0]?.url ?? "",
                sources,
                sourceKey,
                onFallbackSource: fallback,
            })
            return <audio ref={engine.audioRef} src={engine.currentSrc || undefined} />
        }

        const container = document.createElement("div")
        const root = createRoot(container)
        const firstSources = [{ url: "track-a.mp3" }, { url: "fallback.mp3" }]

        await React.act(async () => {
            root.render(<Harness sourceKey="track-a" sources={firstSources} />)
        })

        const audio = container.querySelector("audio")!
        Object.defineProperty(audio, "duration", {
            configurable: true,
            value: 120,
        })
        Object.defineProperty(audio, "error", {
            configurable: true,
            value: {
                code: 2,
                MEDIA_ERR_ABORTED: 1,
                MEDIA_ERR_NETWORK: 2,
                MEDIA_ERR_DECODE: 3,
                MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
            },
        })

        expect(engine!.playbackRate).toBe(1)

        await React.act(async () => {
            engine!.setPlaybackRate(1.75)
            audio.dispatchEvent(new Event("loadedmetadata"))
            engine!.play()
        })
        expect(engine!.playbackRate).toBe(1.75)
        expect(audio.playbackRate).toBe(1.75)

        await React.act(async () => {
            engine!.seek(40)
            engine!.pause()
            engine!.play()
        })
        expect(audio.currentTime).toBe(40)
        expect(audio.playbackRate).toBe(1.75)

        await React.act(async () => {
            audio.dispatchEvent(new Event("error"))
        })
        expect(fallback).toHaveBeenCalledWith(
            expect.objectContaining({ nextSource: "fallback.mp3" })
        )
        expect(engine!.currentSrc).toBe("fallback.mp3")
        expect(engine!.playbackRate).toBe(1.75)
        expect(audio.playbackRate).toBe(1.75)

        await React.act(async () => {
            root.render(
                <Harness
                    sourceKey="track-b"
                    sources={[{ url: "track-b.mp3" }]}
                />
            )
        })
        expect(engine!.currentSrc).toBe("track-b.mp3")
        expect(engine!.playbackRate).toBe(1.75)
        expect(audio.playbackRate).toBe(1.75)

        await React.act(async () => {
            engine!.setPlaybackRate(Number.NaN)
        })
        expect(engine!.playbackRate).toBe(1)
        expect(audio.playbackRate).toBe(1)

        await React.act(async () => {
            root.unmount()
        })
    })
})
