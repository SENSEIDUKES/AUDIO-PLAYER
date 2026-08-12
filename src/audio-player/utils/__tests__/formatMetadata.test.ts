import { describe, expect, it } from "vitest"
import {
    formatFeatured,
    formatSecondaryLine,
    formatVersionedTitle,
    getDisplayArtist,
    getDisplayTitle,
    shouldEnableMarquee,
} from "../formatMetadata"

describe("getDisplayTitle / getDisplayArtist", () => {
    it("returns trimmed values when present", () => {
        expect(getDisplayTitle({ title: "  Song  " })).toBe("Song")
        expect(getDisplayArtist({ artist: " Band " })).toBe("Band")
    })
    it("falls back when empty/missing", () => {
        expect(getDisplayTitle(undefined)).toBe("Unknown Track")
        expect(getDisplayTitle({ title: "   " })).toBe("Unknown Track")
        expect(getDisplayArtist(null)).toBe("Unknown Artist")
        expect(getDisplayArtist({}, "No One")).toBe("No One")
    })
})

describe("formatVersionedTitle", () => {
    it("appends a version label in parentheses", () => {
        expect(formatVersionedTitle("Track", "Radio Edit")).toBe("Track (Radio Edit)")
    })
    it("leaves the title untouched without a version", () => {
        expect(formatVersionedTitle("Track")).toBe("Track")
        expect(formatVersionedTitle("Track", "   ")).toBe("Track")
    })
})

describe("formatFeatured", () => {
    it("returns empty for no names", () => {
        expect(formatFeatured()).toBe("")
        expect(formatFeatured([])).toBe("")
        expect(formatFeatured([" ", ""])).toBe("")
    })
    it("formats one, two, and many names", () => {
        expect(formatFeatured(["A"])).toBe("feat. A")
        expect(formatFeatured(["A", "B"])).toBe("feat. A & B")
        expect(formatFeatured(["A", "B", "C"])).toBe("feat. A, B & C")
    })
    it("drops blanks before composing", () => {
        expect(formatFeatured([" A ", "", "B"])).toBe("feat. A & B")
    })
})

describe("formatSecondaryLine", () => {
    it("artist only when nothing else is present", () => {
        expect(formatSecondaryLine({ artist: "Band" })).toBe("Band")
    })
    it("artist + featured", () => {
        expect(formatSecondaryLine({ artist: "Band", featuredArtists: ["Guest"] })).toBe(
            "Band feat. Guest"
        )
    })
    it("artist + album with a middot separator", () => {
        expect(formatSecondaryLine({ artist: "Band", albumTitle: "LP" })).toBe("Band · LP")
    })
    it("artist + featured + album", () => {
        expect(
            formatSecondaryLine({
                artist: "Band",
                featuredArtists: ["X", "Y"],
                albumTitle: "LP",
            })
        ).toBe("Band feat. X & Y · LP")
    })
    it("uses subtitle as the trailing fallback only without album/featured", () => {
        expect(formatSecondaryLine({ artist: "Band", subtitle: "Live" })).toBe("Band · Live")
        // Featured present → subtitle is suppressed.
        expect(
            formatSecondaryLine({
                artist: "Band",
                featuredArtists: ["G"],
                subtitle: "Live",
            })
        ).toBe("Band feat. G")
        // Album wins over subtitle.
        expect(formatSecondaryLine({ artist: "Band", albumTitle: "LP", subtitle: "Live" })).toBe(
            "Band · LP"
        )
    })
    it("falls back to Unknown Artist", () => {
        expect(formatSecondaryLine({ albumTitle: "LP" })).toBe("Unknown Artist · LP")
    })
})

describe("shouldEnableMarquee", () => {
    const base = { contentWidth: 400, containerWidth: 300, reducedMotion: false }
    it("enables when text overflows a wide-enough container with motion allowed", () => {
        expect(shouldEnableMarquee(base)).toBe(true)
    })
    it("disables under reduced motion", () => {
        expect(shouldEnableMarquee({ ...base, reducedMotion: true })).toBe(false)
    })
    it("disables for narrow containers", () => {
        expect(
            shouldEnableMarquee({ contentWidth: 400, containerWidth: 150, reducedMotion: false })
        ).toBe(false)
    })
    it("disables when the text fits", () => {
        expect(
            shouldEnableMarquee({ contentWidth: 280, containerWidth: 300, reducedMotion: false })
        ).toBe(false)
    })
    it("respects a custom minWidth", () => {
        expect(
            shouldEnableMarquee({
                contentWidth: 400,
                containerWidth: 250,
                reducedMotion: false,
                minWidth: 300,
            })
        ).toBe(false)
    })
})
