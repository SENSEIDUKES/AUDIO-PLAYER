import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { WorkspaceShell } from "../WorkspaceShell"
import type { WorkspaceRoute } from "../workspaceRoutes"

function render(route: WorkspaceRoute, lyrics?: string): string {
    return renderToStaticMarkup(
        <WorkspaceShell route={route} onClose={() => {}} lyrics={lyrics} />
    )
}

describe("WorkspaceShell", () => {
    it("renders a route-specific header title and a close button", () => {
        const html = render("plugin-settings:lyrics")
        expect(html).toContain('class="sap-ctl__title"')
        expect(html).toContain("Lyrics")
        expect(html).toContain('aria-label="Close workspace"')
        expect(html).toContain('data-route="plugin-settings:lyrics"')
    })

    it("titles each route category distinctly", () => {
        expect(render("library:playlists")).toContain("Playlists")
        expect(render("library:queue")).toContain("Up Next")
        expect(render("playback:automix")).toContain("Automix")
        expect(render("agent:queue-director")).toContain("Queue Director")
        expect(render("plugin-settings:waveform")).toContain("Waveform")
    })

    it("renders the real lyric settings panel for the lyrics route", () => {
        // The lyrics route now surfaces the lyric display's settings panel
        // (font, weight, size, line height, highlight color, animation mode)
        // instead of the old placeholder lyrics preview.
        const html = render("plugin-settings:lyrics", "la la la")
        expect(html).toContain('class="sap-visual-settings"')
        expect(html).toContain("Font family")
        expect(html).toContain("Highlight color")
        expect(html).toContain("Animation mode")
    })

    it("renders placeholder copy for stub workspaces", () => {
        expect(render("library:playlists")).toContain("Playlists coming soon")
        expect(render("playback:automix")).toContain("Automix settings coming soon")
        expect(render("agent:queue-director")).toContain("AI queue director coming soon")
    })

    it("routes the generic plugin-settings target through the plugin stub", () => {
        const html = render("plugin-settings:waveform")
        expect(html).toContain("Waveform settings")
    })

    it("titles the arc quick-action sections (Controls, Tag, Rename, Radio)", () => {
        expect(render("playback:controls")).toContain("Controls")
        expect(render("vault:tag")).toContain("Tag")
        expect(render("vault:rename")).toContain("Rename")
        expect(render("vault:radio")).toContain("Radio")
    })

    it("renders live playback switches in the Controls section when state is wired", () => {
        const html = renderToStaticMarkup(
            <WorkspaceShell
                route="playback:controls"
                onClose={() => {}}
                playback={{
                    shuffle: true,
                    onToggleShuffle: () => {},
                    repeatMode: "all",
                    onCycleRepeat: () => {},
                    automix: false,
                    onToggleAutomix: () => {},
                }}
            />
        )
        expect(html).toContain("Shuffle")
        expect(html).toContain('aria-checked="true"')
        expect(html).toContain("Repeat")
        expect(html).toContain("Automix")
    })

    it("renders an honest empty Controls panel when no playback state is wired", () => {
        const html = render("playback:controls")
        expect(html).toContain("Playback controls are not available")
        expect(html).not.toContain('role="switch"')
    })

    it("renders each Vault action workspace with its variant marker", () => {
        expect(render("vault:tag")).toContain('data-vault-action="tag"')
        expect(render("vault:rename")).toContain('data-vault-action="rename"')
        expect(render("vault:radio")).toContain('data-vault-action="radio"')
    })
})
