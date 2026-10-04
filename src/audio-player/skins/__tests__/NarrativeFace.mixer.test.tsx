// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NarrativeFace } from "../NarrativeFace"
import { AudioSessionProvider } from "../../session/AudioSessionContext"
import { ReaderMixerProvider } from "../../narrative/ReaderMixerContext"
import { createReaderMixer } from "../../narrative/ReaderMixer"
import type { ReaderMixer } from "../../narrative/ReaderMixer"
import type { NarrationState } from "../../narrative/useNarrativeAudio"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
    ensureTrackAnalysis: vi.fn(() => Promise.resolve(null)),
    getTrackTrims: vi.fn(() => null),
}))

const NARRATION = [{ id: "line-1", title: "Line 1", artist: "Narrator", audioFile: "line.mp3" }]

let mixer: ReaderMixer

function Reader({
    narrationState,
    connected = true,
}: {
    narrationState?: NarrationState
    connected?: boolean
}) {
    return (
        <AudioSessionProvider initialQueue={NARRATION}>
            <ReaderMixerProvider mixer={mixer}>
                <NarrativeFace
                    narrationState={narrationState}
                    duckAmount={0.6}
                    intensity={1}
                    mixer={connected ? undefined : null}
                />
            </ReaderMixerProvider>
        </AudioSessionProvider>
    )
}

describe("NarrativeFace with a reader mixer", () => {
    beforeEach(() => {
        mixer = createReaderMixer({
            atmospheres: [{ id: "rain", label: "Rain", sources: [{ url: "rain.mp3" }] }],
        })
    })

    afterEach(() => {
        cleanup()
        mixer.dispose()
    })

    it("connects through the provider and ducks the mixer while narrating", () => {
        const { rerender, unmount } = render(<Reader narrationState="paused" />)
        expect(screen.getByRole("region", { name: "Narration audio" })).toHaveAttribute(
            "data-reader-mixer",
            "connected"
        )
        expect(mixer.getDuck()).toBe(0)

        rerender(<Reader narrationState="playing" />)
        expect(mixer.getDuck()).toBeCloseTo(0.6)

        rerender(<Reader narrationState="paused" />)
        expect(mixer.getDuck()).toBe(0)

        rerender(<Reader narrationState="playing" />)
        unmount()
        // Leaving the reader never strands the music ducked.
        expect(mixer.getDuck()).toBe(0)
    })

    it("drives the mixer's Atmosphere level from its Ambience slider", () => {
        render(<Reader narrationState="paused" />)
        const slider = screen.getByRole("slider", { name: "Ambience volume" })
        expect(slider).toBeEnabled()
        expect(slider).toHaveValue(
            String(Math.round(mixer.getPreferences().layers.atmosphere.level * 100))
        )

        fireEvent.change(slider, { target: { value: "25" } })
        expect(mixer.getPreferences().layers.atmosphere.level).toBe(0.25)

        act(() => mixer.setLayerLevel("atmosphere", 0.7))
        expect(slider).toHaveValue("70")
    })

    it("restores the background mix when narration is muted or its volume is zero", () => {
        render(<Reader narrationState="playing" />)
        expect(mixer.getDuck()).toBeCloseTo(0.6)
        fireEvent.click(screen.getByRole("button", { name: "Mute" }))
        expect(mixer.getDuck()).toBe(0)
        fireEvent.click(screen.getByRole("button", { name: "Unmute" }))
        expect(mixer.getDuck()).toBeCloseTo(0.6)
        fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), {
            key: "Home",
        })
        expect(mixer.getDuck()).toBe(0)
    })

    it("keeps ducking when one of two narration controls unmounts", () => {
        function SharedReader({ second }: { second: boolean }) {
            return (
                <AudioSessionProvider initialQueue={NARRATION}>
                    <ReaderMixerProvider mixer={mixer}>
                        <NarrativeFace key="first" narrationState="playing" duckAmount={0.4} />
                        {second && (
                            <NarrativeFace key="second" narrationState="playing" duckAmount={0.7} />
                        )}
                    </ReaderMixerProvider>
                </AudioSessionProvider>
            )
        }
        const view = render(<SharedReader second />)
        expect(mixer.getDuck()).toBeCloseTo(0.7)
        view.rerender(<SharedReader second={false} />)
        expect(mixer.getDuck()).toBeCloseTo(0.4)
        view.unmount()
        expect(mixer.getDuck()).toBe(0)
    })

    it("shows the reader's atmosphere as its mood", () => {
        const { container } = render(<Reader narrationState="paused" />)
        const mood = () => container.querySelector(".ap-nf__mood")?.textContent
        expect(mood()).toBe("Ambience")
        act(() => mixer.setAtmosphere("rain"))
        expect(mood()).toBe("Rain")
    })

    it("keeps the reader's Atmosphere level when the mixer is disconnected", () => {
        const { rerender } = render(<Reader narrationState="paused" />)
        fireEvent.change(screen.getByRole("slider", { name: "Ambience volume" }), {
            target: { value: "25" },
        })
        rerender(<Reader narrationState="paused" connected={false} />)
        expect(screen.getByRole("slider", { name: "Ambience volume" })).toHaveValue("25")
    })

    it("stays stand-alone with mixer={null}", () => {
        render(<Reader narrationState="playing" connected={false} />)
        expect(screen.getByRole("region", { name: "Narration audio" })).not.toHaveAttribute(
            "data-reader-mixer"
        )
        expect(mixer.getDuck()).toBe(0)
        expect(screen.getByRole("slider", { name: "Ambience volume" })).toBeDisabled()
    })
})
