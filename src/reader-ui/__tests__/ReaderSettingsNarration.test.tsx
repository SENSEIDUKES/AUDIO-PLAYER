// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ReaderSettingsNarration } from "../ReaderSettingsNarration"
import { ReaderSettingsAudio } from "../ReaderSettingsAudio"
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
    mixer = createReaderMixer({})
})
afterEach(() => {
    cleanup()
    mixer.dispose()
    vi.unstubAllGlobals()
})

const TIERS = [
    { id: "mortal", label: "Mortal", icon: <svg data-testid="mortal-flame" /> },
    { id: "immortal", label: "Immortal", icon: <svg data-testid="immortal-flame" /> },
    { id: "heaven", label: "Heaven" },
]
const VOICES = [
    { id: "daniel", label: "Daniel", group: "On this device" },
    { id: "samantha", label: "Samantha", group: "On this device" },
    { id: "brian", label: "Brian", group: "ElevenLabs" },
]
const SLOTS = [
    { id: "narrator", name: "Narrator", voiceId: "daniel" },
    { id: "yan-wu", name: "Yan Wu", voiceId: null },
    { id: "physician", name: "The physician", voiceId: "samantha" },
]

it("reads Voice | Tier on top: the Voice layer's controls, then the reader's tier", () => {
    const tiers: string[] = []
    render(
        <ReaderSettingsNarration
            mixer={mixer}
            tiers={TIERS}
            tier="mortal"
            onTierChange={(id) => tiers.push(id)}
        />
    )
    const page = screen.getByRole("region", { name: "Narration" })
    fireEvent.change(within(page).getByRole("slider", { name: "Voice volume" }), {
        target: { value: "40" },
    })
    expect(mixer.getPreferences().layers.voice.level).toBe(0.4)
    fireEvent.click(within(page).getByRole("switch", { name: "Voice" }))
    expect(mixer.getPreferences().layers.voice.enabled).toBe(false)

    const tier = within(page).getByRole("combobox", { name: "Tier" })
    expect(tier).toHaveValue("mortal")
    // The chosen tier's mark sits before its name.
    expect(within(page).getByTestId("mortal-flame")).toBeInTheDocument()
    expect(within(page).getByRole("button", { name: "Previous Tier" })).toBeDisabled()
    fireEvent.click(within(page).getByRole("button", { name: "Next Tier" }))
    fireEvent.change(tier, { target: { value: "heaven" } })
    expect(tiers).toEqual(["immortal", "heaven"])
})

it("gives each speaker a slot to assign a voice from the tier's voices", () => {
    const assigned: [string, string][] = []
    render(
        <ReaderSettingsNarration
            mixer={mixer}
            voices={VOICES}
            slots={SLOTS}
            onAssign={(slot, voice) => assigned.push([slot, voice])}
        />
    )
    const slots = screen.getByRole("group", { name: "Voices" })
    const narrator = within(slots).getByRole("combobox", { name: "Voice for Narrator" })
    expect(narrator).toHaveValue("daniel")
    // Voices are grouped by where they come from.
    expect(within(narrator).getByRole("group", { name: "ElevenLabs" })).toBeInTheDocument()

    const yanWu = within(slots).getByRole("combobox", { name: "Voice for Yan Wu" })
    expect((yanWu as HTMLSelectElement).selectedOptions[0]).toHaveTextContent("Choose…")
    fireEvent.change(yanWu, { target: { value: "brian" } })
    fireEvent.click(within(slots).getByRole("button", { name: "Next Voice for The physician" }))
    expect(assigned).toEqual([
        ["yan-wu", "brian"],
        ["physician", "brian"],
    ])
})

it("always shows eight slots, unused ones as a dash, so the page keeps its shape", () => {
    const { container, rerender } = render(<ReaderSettingsNarration mixer={mixer} slots={SLOTS} />)
    const slotsIn = () => container.querySelectorAll(".sap-reader-narration__slot")
    expect(slotsIn()).toHaveLength(8)
    expect(container.querySelectorAll(".sap-reader-narration__slot--empty")).toHaveLength(5)
    rerender(<ReaderSettingsNarration mixer={mixer} slots={SLOTS} slotCount={2} />)
    expect(slotsIn()).toHaveLength(2)
    expect(screen.queryByRole("combobox", { name: "Voice for The physician" })).toBeNull()
})

it("renders nothing without a mixer, like the Audio page", () => {
    const { container } = render(<ReaderSettingsNarration tiers={TIERS} slots={SLOTS} />)
    expect(container).toBeEmptyDOMElement()
})

it("follows the Voice layer when it changes elsewhere", () => {
    render(<ReaderSettingsNarration mixer={mixer} />)
    act(() => mixer.setLayerLevel("voice", 0.3))
    expect(screen.getByRole("slider", { name: "Voice volume" })).toHaveValue("30")
})

it("leaves Voice off the Audio page, which is the soundtrack", () => {
    act(() => mixer.setLayerAvailability({ voice: true }))
    const { rerender } = render(<ReaderSettingsAudio mixer={mixer} />)
    expect(screen.queryByRole("switch", { name: "Voice" })).toBeNull()
    expect(screen.getByRole("switch", { name: "Sound Cues" })).toBeInTheDocument()
    rerender(<ReaderSettingsAudio mixer={mixer} showVoice />)
    expect(screen.getByRole("switch", { name: "Voice" })).toBeInTheDocument()
})
