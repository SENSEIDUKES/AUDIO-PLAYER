import { describe, expect, it } from "vitest"
import {
    buildMediaSessionArtwork,
    extractUrlFromCss,
    resolveArtworkSrc,
} from "../useMediaSessionObserver"

describe("buildMediaSessionArtwork", () => {
    it("emits the large square sizes iOS needs for full-screen lock art", () => {
        const art = buildMediaSessionArtwork("https://cdn/cover.jpg")
        expect(art.map((a) => a.sizes)).toEqual(["512x512", "1024x1024"])
        expect(art.every((a) => a.src === "https://cdn/cover.jpg")).toBe(true)
        expect(art.every((a) => a.type === "image/jpeg")).toBe(true)
    })

    it("detects PNG by extension", () => {
        const art = buildMediaSessionArtwork("https://cdn/cover.PNG")
        expect(art.every((a) => a.type === "image/png")).toBe(true)
    })
})

describe("extractUrlFromCss", () => {
    it("pulls the bare URL out of a url() wrapper", () => {
        expect(extractUrlFromCss('url("https://cdn/a.jpg")')).toBe(
            "https://cdn/a.jpg"
        )
        expect(extractUrlFromCss("url(https://cdn/b.png)")).toBe(
            "https://cdn/b.png"
        )
    })

    it("returns null when there is no url()", () => {
        expect(extractUrlFromCss("linear-gradient(#000,#fff)")).toBeNull()
    })
})

describe("resolveArtworkSrc", () => {
    it("passes a plain URL through unchanged", () => {
        expect(resolveArtworkSrc("https://cdn/cover.jpg")).toBe(
            "https://cdn/cover.jpg"
        )
    })

    it("passes a plain URL through unchanged, even with parentheses", () => {
        expect(resolveArtworkSrc("https://cdn/cover(1).jpg")).toBe(
            "https://cdn/cover(1).jpg"
        )
    })

    it("unwraps a CSS url() value to a usable image URL", () => {
        expect(resolveArtworkSrc('url("https://cdn/cover.jpg")')).toBe(
            "https://cdn/cover.jpg"
        )
    })

    it("rejects gradients and other CSS functions (not real images)", () => {
        expect(
            resolveArtworkSrc("linear-gradient(135deg,#FF7AC6,#7C5CFF)")
        ).toBeUndefined()
        expect(resolveArtworkSrc("radial-gradient(#000,#fff)")).toBeUndefined()
    })

    it("treats empty / nullish / non-string candidates as no artwork", () => {
        expect(resolveArtworkSrc(undefined)).toBeUndefined()
        expect(resolveArtworkSrc(null)).toBeUndefined()
        expect(resolveArtworkSrc("")).toBeUndefined()
        expect(resolveArtworkSrc("   ")).toBeUndefined()
        expect(resolveArtworkSrc(123 as unknown as string)).toBeUndefined()
        expect(resolveArtworkSrc({} as unknown as string)).toBeUndefined()
    })
})
