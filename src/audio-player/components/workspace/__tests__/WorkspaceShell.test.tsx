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
})
