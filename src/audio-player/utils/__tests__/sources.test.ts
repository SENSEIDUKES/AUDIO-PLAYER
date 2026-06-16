import { describe, expect, it } from "vitest"
import type { Track } from "../../types"
import {
    getPrimaryTrackSource,
    getTrackSources,
    normalizeSourceUrl,
    sourceUrlsMatch,
    trackSourcesSignature,
} from "../sources"

describe("source utilities", () => {
    it("normalizes relative URLs to the same absolute form browsers report", () => {
        expect(normalizeSourceUrl(" /audio/main.mp3 ")).toBe(
            "http://localhost/audio/main.mp3"
        )
        expect(sourceUrlsMatch("/audio/main.mp3", "http://localhost/audio/main.mp3")).toBe(
            true
        )
    })

    it("resolves audioFile plus fallbackSources and dedupes normalized URLs", () => {
        const track: Track = {
            title: "Main",
            artist: "SEIHouse",
            audioFile: "/audio/main.mp3",
            fallbackSources: [
                "http://localhost/audio/main.mp3",
                "/audio/backup.mp3",
            ],
        }

        expect(getTrackSources(track)).toEqual([
            { url: "http://localhost/audio/main.mp3" },
            { url: "http://localhost/audio/backup.mp3" },
        ])
        expect(getPrimaryTrackSource(track)).toBe("http://localhost/audio/main.mp3")
    })

    it("treats declared sources as authoritative over legacy audioFile fields", () => {
        const track: Track = {
            title: "Declared",
            artist: "SEIHouse",
            audioFile: "/audio/legacy.mp3",
            fallbackSources: ["/audio/legacy-backup.mp3"],
            sources: [
                { url: "/audio/primary.mp3", type: "audio/mpeg" },
                { url: "/audio/fallback.mp3" },
            ],
        }

        expect(getTrackSources(track)).toEqual([
            { url: "http://localhost/audio/primary.mp3", type: "audio/mpeg" },
            { url: "http://localhost/audio/fallback.mp3" },
        ])
    })

    it("includes normalized source URLs in the source signature", () => {
        const track: Track = {
            title: "Signature",
            artist: "SEIHouse",
            audioFile: "/audio/main.mp3",
        }

        expect(trackSourcesSignature(track)).toBe(
            JSON.stringify([["http://localhost/audio/main.mp3", ""]])
        )
    })
})
