// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ReaderSettingsAudio } from "../ReaderSettingsAudio"
import { ReaderAudioPresets } from "../ReaderAudioPresets"
import { ReaderMixerProvider } from "../../audio-player/narrative/ReaderMixerContext"
import { createReaderMixer } from "../../audio-player/narrative/ReaderMixer"
import type { ReaderMixer } from "../../audio-player/narrative/ReaderMixer"
import { FakeAudio } from "../../audio-player/narrative/__tests__/fakeMedia"

vi.mock("../../audio-player/automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))

let mixer: ReaderMixer
beforeEach(() => {
    FakeAudio.reset()
    vi.stubGlobal("Audio", FakeAudio)
    mixer = createReaderMixer({
        atmospheres: [{ id: "rain", label: "Rain", sources: [{ url: "https://a.test/rain.mp3" }] }],
        initialPreferences: { atmosphereId: null },
    })
})
afterEach(() => {
    cleanup()
    mixer.dispose()
    vi.unstubAllGlobals()
})

it("composes the page as SEN ships it: levels, then preset pills, then host pieces", () => {
    render(
        <ReaderMixerProvider mixer={mixer}>
            <ReaderSettingsAudio>
                <p>Scene chooser</p>
            </ReaderSettingsAudio>
        </ReaderMixerProvider>
    )
    const page = screen.getByRole("region", { name: "Audio" })
    expect(page).toHaveClass("sap-reader-settings")
    expect(within(page).getByText("The story’s music, atmosphere and sound effects.")).toBeVisible()
    // No title and no radio-group presets inside the panel itself.
    expect(within(page).queryByRole("heading", { name: "Audio" })).not.toBeInTheDocument()
    const presets = within(page).getByRole("group", { name: "Presets" })
    const order = [
        within(page).getByText("Master"),
        presets,
        within(page).getByText("Scene chooser"),
    ]
    for (let index = 1; index < order.length; index += 1) {
        expect(
            order[index - 1].compareDocumentPosition(order[index]) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    }
    expect(
        within(presets)
            .getAllByRole("radio")
            .map((radio) => radio.closest("label")?.textContent)
    ).toEqual(["Default", "Cinematic", "Calm", "Focus"])
})

it("preset pills apply the mixer's presets and show the active one", () => {
    render(<ReaderAudioPresets mixer={mixer} legend="Mixes" />)
    const cinematic = screen.getByRole("radio", { name: "Cinematic" })
    fireEvent.click(cinematic)
    expect(mixer.getState().activePresetId).toBe("cinematic")
    expect(cinematic).toBeChecked()
    expect(screen.getByRole("group", { name: "Mixes" })).toBeInTheDocument()
})

it("can hide its help line, presets and atmosphere picker", () => {
    render(
        <ReaderSettingsAudio
            mixer={mixer}
            help={null}
            showPresets={false}
            showAtmospherePicker={false}
        />
    )
    expect(screen.queryByText("The story’s music, atmosphere and sound effects.")).toBeNull()
    expect(screen.queryByRole("group", { name: "Presets" })).toBeNull()
    expect(screen.queryByText("Atmosphere sound")).toBeNull()
})
