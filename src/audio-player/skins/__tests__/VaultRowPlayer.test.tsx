import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AudioSessionProvider } from "../../session/AudioSessionContext"
import type { ArcAction } from "../../surfaces/ArcActionButton"
import type { Track } from "../../types"
import { VaultRowPlayer } from "../VaultRowPlayer"

const TRACK: Track = {
    title: "Angel Numbers",
    artist: "SENSEI",
    audioFile: "test.mp3",
}

function render(node: React.ReactElement): string {
    return renderToStaticMarkup(
        <AudioSessionProvider initialQueue={[TRACK]}>{node}</AudioSessionProvider>
    )
}

const SAMPLE_ACTIONS: ArcAction[] = [
    { id: "queue", label: "Add to Queue", onSelect: () => {} },
    { id: "share", label: "Share", onSelect: () => {} },
]

describe("VaultRowPlayer — Arc actions", () => {
    it("renders the Arc action button (not the legacy three-dot menu) when actions are given", () => {
        const html = render(<VaultRowPlayer track={TRACK} actions={SAMPLE_ACTIONS} />)
        // Arc trigger uses the surface-button shell, scoped with the row class.
        expect(html).toContain("ap-surface-btn")
        expect(html).toContain("ap-vr__action")
        // The old dots-only icon button must be gone.
        expect(html).not.toContain("ap-icon-btn ap-vr__action")
    })

    it("synthesizes an Arc action from the legacy onAction prop (back-compat)", () => {
        const html = render(<VaultRowPlayer track={TRACK} onAction={() => {}} />)
        expect(html).toContain("ap-surface-btn")
        expect(html).toContain("ap-vr__action")
    })

    it("renders no action surface when neither actions nor onAction are given", () => {
        const html = render(<VaultRowPlayer track={TRACK} />)
        expect(html).not.toContain("ap-vr__action")
        expect(html).not.toContain("ap-surface-btn")
    })
})

describe("VaultRowPlayer — classification color", () => {
    it("renders a labeled category chip (not a bare dot) for a known category", () => {
        const html = render(
            <VaultRowPlayer track={{ ...TRACK, vaultCategory: "beat" }} />
        )
        expect(html).toContain("ap-vr__chip")
        expect(html).toContain("Beat")
        // The old empty dot element is removed.
        expect(html).not.toContain("ap-vr__cat")
    })

    it("sets the classification accent CSS variable on the row", () => {
        const html = render(
            <VaultRowPlayer track={{ ...TRACK, vaultCategory: "beat" }} />
        )
        // #22D3A6 is the built-in "beat" color.
        expect(html.toLowerCase()).toContain("--ap-vault-accent:#22d3a6")
    })

    it("omits the chip for an uncategorized track", () => {
        const html = render(<VaultRowPlayer track={TRACK} />)
        expect(html).not.toContain("ap-vr__chip")
    })

    it("renders both chip placements (lead for desktop, inline for mobile) so the title keeps its line", () => {
        const html = render(
            <VaultRowPlayer track={{ ...TRACK, vaultCategory: "beat" }} />
        )
        // Leading pill (wide rows) + inline chip on the artist line (narrow rows);
        // a container query shows exactly one at a time.
        expect(html).toContain("ap-vr__chip--lead")
        expect(html).toContain("ap-vr__chip--inline")
        // Artist text lives in its own truncating wrapper alongside the inline chip.
        expect(html).toContain("ap-vr__artist-text")
    })
})
