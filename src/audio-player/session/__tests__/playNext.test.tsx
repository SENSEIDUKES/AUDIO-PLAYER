/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"
import type { SessionEngine, Track } from "../../types"

const TRACKS: Track[] = [
    { title: "One", artist: "A", audioFile: "one.mp3" },
    { title: "Two", artist: "A", audioFile: "two.mp3" },
    { title: "Three", artist: "A", audioFile: "three.mp3" },
]
const NEW_TRACK: Track = { title: "Inserted", artist: "B", audioFile: "new.mp3" }

async function withSession(
    initialQueue: Track[],
    run: (getSession: () => SessionEngine) => Promise<void>
) {
    let session: SessionEngine | null = null
    function Capture() {
        session = useAudioSession()
        return null
    }
    const container = document.createElement("div")
    const root = createRoot(container)
    await React.act(async () => {
        root.render(
            <AudioSessionProvider initialQueue={initialQueue}>
                <Capture />
            </AudioSessionProvider>
        )
    })
    try {
        await run(() => session!)
    } finally {
        root.unmount()
    }
}

describe("AudioSessionContext — playNext", () => {
    it("inserts immediately after the current track", async () => {
        await withSession(TRACKS, async (get) => {
            expect(get().currentIndex).toBe(0)
            await React.act(async () => {
                get().playNext(NEW_TRACK)
            })
            expect(get().queue.map((t) => t.title)).toEqual([
                "One",
                "Inserted",
                "Two",
                "Three",
            ])
            // The active track is unchanged; the insert is what plays next.
            expect(get().currentIndex).toBe(0)
            expect(get().currentTrack?.title).toBe("One")
        })
    })

    it("appends when the queue is empty (nothing is current)", async () => {
        await withSession([], async (get) => {
            await React.act(async () => {
                get().playNext(NEW_TRACK)
            })
            expect(get().queue.map((t) => t.title)).toEqual(["Inserted"])
        })
    })

    it("enqueue still appends to the end (Play Later)", async () => {
        await withSession(TRACKS, async (get) => {
            await React.act(async () => {
                get().enqueue(NEW_TRACK)
            })
            expect(get().queue.map((t) => t.title)).toEqual([
                "One",
                "Two",
                "Three",
                "Inserted",
            ])
        })
    })
})
