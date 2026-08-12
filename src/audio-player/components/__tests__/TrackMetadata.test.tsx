import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TrackMetadata, ExplicitBadge } from "../TrackMetadata"
import type { TrackMetadataFields } from "../../utils/formatMetadata"

function render(node: ReactElement): string {
    return renderToStaticMarkup(node)
}

describe("ExplicitBadge", () => {
    it("renders an accessible 'E' badge", () => {
        const html = render(<ExplicitBadge />)
        expect(html).toContain("ap-explicit-badge")
        expect(html).toContain('aria-label="Explicit content"')
        expect(html).toContain(">E<")
    })
})

describe("TrackMetadata", () => {
    const full: TrackMetadataFields = {
        title: "Midnight",
        artist: "Aurora",
        featuredArtists: ["Echo", "Vale"],
        albumTitle: "Nightfall",
        versionLabel: "Extended Mix",
        releaseTitle: "Nightfall (Deluxe)",
        explicit: true,
    }

    it("renders the full hierarchy with version, badge, featured and album", () => {
        const html = render(<TrackMetadata track={full} variant="hero" showTertiary />)
        expect(html).toContain("Midnight (Extended Mix)")
        expect(html).toContain("ap-explicit-badge")
        expect(html).toContain("Aurora")
        expect(html).toContain("feat. Echo &amp; Vale")
        expect(html).toContain("Nightfall")
        // Tertiary release line shows because it differs from the album.
        expect(html).toContain("Nightfall (Deluxe)")
        expect(html).toContain('data-variant="hero"')
    })

    it("renders minimal metadata without optional pieces", () => {
        const html = render(<TrackMetadata track={{ title: "Solo", artist: "Nobody" }} />)
        expect(html).toContain("Solo")
        expect(html).toContain("Nobody")
        expect(html).not.toContain("ap-explicit-badge")
        expect(html).not.toContain("feat.")
        expect(html).not.toContain("ap-meta__album")
    })

    it("applies graceful fallbacks for missing fields", () => {
        const html = render(<TrackMetadata track={null} />)
        expect(html).toContain("Unknown Track")
        expect(html).toContain("Unknown Artist")
    })

    it("omits the tertiary release line when it matches the album", () => {
        const html = render(
            <TrackMetadata
                track={{ title: "T", artist: "A", albumTitle: "Same", releaseTitle: "Same" }}
                showTertiary
            />
        )
        expect(html).not.toContain("ap-meta__tertiary")
    })

    it("wraps the title in a marquee when enabled", () => {
        const html = render(<TrackMetadata track={{ title: "Long", artist: "A" }} enableMarquee />)
        expect(html).toContain("ap-marquee")
    })
})
