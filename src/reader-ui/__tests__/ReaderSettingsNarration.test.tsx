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

it("has the Voice layer's controls on top and the tier as pills at the bottom", () => {
    const tiers: string[] = []
    const { container } = render(
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

    // Like the Audio page's Presets: one strip at the bottom, a pill per tier.
    const strip = within(page).getByRole("radiogroup", { name: "Tier" })
    expect(container.querySelector(".sap-reader-narration")?.contains(strip)).toBe(false)
    expect(within(strip).getByRole("radio", { name: "Mortal" })).toBeChecked()
    // Each tier's mark sits before its name.
    expect(within(strip).getByTestId("mortal-flame")).toBeInTheDocument()
    expect(within(strip).getByTestId("immortal-flame")).toBeInTheDocument()
    fireEvent.click(within(strip).getByRole("radio", { name: "Immortal" }))
    fireEvent.click(within(strip).getByRole("radio", { name: "Heaven" }))
    expect(tiers).toEqual(["immortal", "heaven"])
    expect(within(page).queryByRole("combobox", { name: "Tier" })).toBeNull()
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

it("lists every voice in every slot, sectioned by tier then source, whatever the tier", () => {
    const voices = [
        { id: "brian", label: "Brian", tier: "immortal", group: "ElevenLabs" },
        { id: "sage", label: "Elder sage", tier: "immortal", group: "Fish Audio" },
        { id: "designed", label: "Designed narrator", tier: "heaven", group: "Designed" },
        { id: "daniel", label: "Daniel", tier: "mortal", group: "On this device" },
    ]
    render(
        <ReaderSettingsNarration
            mixer={mixer}
            tiers={TIERS}
            tier="mortal"
            voices={voices}
            slots={SLOTS}
        />
    )
    const narrator = screen.getByRole("combobox", { name: "Voice for Narrator" })
    const sections = within(narrator)
        .getAllByRole("group")
        .map((group) => group.getAttribute("label"))
    expect(sections).toEqual([
        "Mortal · On this device",
        "Immortal · ElevenLabs",
        "Immortal · Fish Audio",
        "Heaven · Designed",
    ])
    // The Mortal tier still offers Immortal and Heaven voices.
    expect(within(narrator).getByRole("option", { name: "Designed narrator" })).toBeInTheDocument()
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
