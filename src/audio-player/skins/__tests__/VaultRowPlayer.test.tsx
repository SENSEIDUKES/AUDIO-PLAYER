import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AudioSessionProvider } from "../../session/AudioSessionContext"
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

describe("VaultRowPlayer — action surface", () => {
    it("renders the shared action menu trigger, not a legacy three-dot menu", () => {
        const html = render(<VaultRowPlayer track={TRACK} onOpenWorkspace={() => {}} />)
        // The trigger uses the surface-button shell, scoped with the row class.
        expect(html).toContain("ap-surface-btn")
        expect(html).toContain("ap-vr__action")
        // The old dots-only icon button must be gone.
        expect(html).not.toContain("ap-icon-btn ap-vr__action")
    })

    it("keeps the trigger on a host that only wires the row's queue commands", () => {
        // Play Next / Play Later are wired to the shared session by the row
        // itself, so the Queue arm survives even with no controller routing.
        const html = render(<VaultRowPlayer track={TRACK} />)
        expect(html).toContain("ap-vr__action")
    })

    it("renders no trigger at all when every leaf is dead on this host", () => {
        // Override the row's built-in queue commands with nothing, and wire no
        // controller: every leaf prunes and the trigger disappears rather than
        // rendering an empty wheel.
        const html = render(
            <VaultRowPlayer
                track={TRACK}
                commands={{
                    "queue.insertAfterCurrent": undefined,
                    "queue.append": undefined,
                }}
            />
        )
        expect(html).not.toContain("ap-vr__action")
    })
})

describe("VaultRowPlayer — classification color", () => {
    it("renders a labeled category chip (not a bare dot) for a known category", () => {
        const html = render(<VaultRowPlayer track={{ ...TRACK, vaultCategory: "beat" }} />)
        expect(html).toContain("ap-vr__chip")
        expect(html).toContain("Beat")
        // The old empty dot element is removed.
        expect(html).not.toContain("ap-vr__cat")
    })

    it("sets the classification accent CSS variable on the row", () => {
        const html = render(<VaultRowPlayer track={{ ...TRACK, vaultCategory: "beat" }} />)
        // #22D3A6 is the built-in "beat" color.
        expect(html.toLowerCase()).toContain("--ap-vault-accent:#22d3a6")
    })

    it("omits the chip for an uncategorized track", () => {
        const html = render(<VaultRowPlayer track={TRACK} />)
        expect(html).not.toContain("ap-vr__chip")
    })

    it("renders both chip placements (lead for desktop, inline for mobile) so the title keeps its line", () => {
        const html = render(<VaultRowPlayer track={{ ...TRACK, vaultCategory: "beat" }} />)
        // Leading pill (wide rows) + inline chip on the artist line (narrow rows);
        // a container query shows exactly one at a time.
        expect(html).toContain("ap-vr__chip--lead")
        expect(html).toContain("ap-vr__chip--inline")
        // Artist text lives in its own truncating wrapper alongside the inline chip.
        expect(html).toContain("ap-vr__artist-text")
    })
})
