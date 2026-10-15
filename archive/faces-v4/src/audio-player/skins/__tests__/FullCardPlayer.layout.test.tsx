import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AudioSessionProvider } from "../../session/AudioSessionContext"
import type { Track } from "../../types"
import { FullCardPlayer } from "../FullCardPlayer"

const TRACK: Track = {
    title: "Canvas Test",
    artist: "SEIHouse",
    audioFile: "test.mp3",
}

function renderFullCard(): string {
    return renderToStaticMarkup(
        <AudioSessionProvider initialQueue={[TRACK]}>
            <FullCardPlayer />
        </AudioSessionProvider>
    )
}

describe("FullCardPlayer layout", () => {
    it("separates the visual stage from the anchored control dock", () => {
        const html = renderFullCard()

        expect(html).toContain('class="ap-fc__stage"')
        expect(html).toContain('class="ap-fc__control-dock"')

        const stageStart = html.indexOf('class="ap-fc__stage"')
        const stageEnd = html.indexOf('class="ap-fc__control-dock"')
        expect(stageStart).toBeLessThan(stageEnd)

        const stageHtml = html.slice(stageStart, stageEnd)
        const dockHtml = html.slice(stageEnd)

        expect(stageHtml).toContain('class="ap-hero"')
        expect(stageHtml).toContain('class="ap-sei-canvas-host"')
        expect(dockHtml).toContain('class="ap-scrubber-host"')
        expect(dockHtml).toContain('class="ap-transport"')
        expect(dockHtml).toContain('class="ap-volume"')
        expect(dockHtml).toContain('class="ap-surface-actions"')

        expect(dockHtml).not.toContain('class="ap-sei-canvas-host"')
    })
})
