import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BackgroundMedia, resolveMedia } from "../BackgroundMedia"
import type { MediaSource } from "../../properties/propertyTypes"

function render(node: ReactElement): string {
    return renderToStaticMarkup(node)
}

describe("resolveMedia", () => {
    it("maps a legacy backgroundImage to a css background", () => {
        const r = resolveMedia({ legacyImage: { src: "https://x/cover.jpg" } })
        expect(r.media).toBeNull()
        expect(r.cssBackground).toBe('url("https://x/cover.jpg")')
    })

    it("keeps a gradient art string as-is (not coerced to a src)", () => {
        const r = resolveMedia({ legacyCss: "linear-gradient(135deg,#a,#b)" })
        expect(r.media).toBeNull()
        expect(r.cssBackground).toBe("linear-gradient(135deg,#a,#b)")
    })

    it("returns a video as a media layer", () => {
        const media: MediaSource = { kind: "video", src: "https://x/clip.mp4" }
        const r = resolveMedia({ media })
        expect(r.media).toEqual(media)
        expect(r.cssBackground).toBeNull()
    })

    it("renders an image MediaSource through the css background path", () => {
        const media: MediaSource = { kind: "image", src: "https://x/p.png" }
        const r = resolveMedia({ media })
        expect(r.media).toBeNull()
        expect(r.cssBackground).toBe('url("https://x/p.png")')
    })

    it("prefers new media over legacy props", () => {
        const r = resolveMedia({
            media: { kind: "image", src: "https://new/p.png" },
            legacyImage: { src: "https://old/p.png" },
        })
        expect(r.cssBackground).toBe('url("https://new/p.png")')
    })

    it("returns nothing when no source is present", () => {
        expect(resolveMedia({})).toEqual({ media: null, cssBackground: null })
    })
})

describe("BackgroundMedia rendering", () => {
    it("renders a muted, looping, inline video for video media", () => {
        const html = render(
            <BackgroundMedia media={{ kind: "video", src: "https://x/clip.mp4" }} />
        )
        expect(html).toContain("<video")
        expect(html).toContain("ap-bg-video")
        expect(html).toContain('src="https://x/clip.mp4"')
        expect(html).toContain("muted")
        expect(html).toContain("loop")
        expect(html).toMatch(/playsinline|playsInline/i)
    })

    it("renders the bg-image div for an image background", () => {
        const html = render(
            <BackgroundMedia cssBackground='url("https://x/cover.jpg")' darkenAmount={50} />
        )
        expect(html).toContain("ap-bg-image")
        expect(html).toContain("ap-bg-darken")
    })

    it("renders nothing when empty", () => {
        const html = render(<BackgroundMedia />)
        expect(html).toBe("")
    })

    it("omits the darken overlay when darkenAmount is 0", () => {
        const html = render(
            <BackgroundMedia cssBackground='url("https://x/cover.jpg")' darkenAmount={0} />
        )
        expect(html).not.toContain("ap-bg-darken")
    })
})
