// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode } from "react"
import { ReaderMixerPanel } from "../ReaderMixerPanel"
import {
    ReaderMixerProvider,
    useReaderMixer,
} from "../../audio-player/narrative/ReaderMixerContext"
import { createReaderMixer } from "../../audio-player/narrative/ReaderMixer"
import type { ReaderAtmosphereOption, ReaderMixer } from "../../audio-player/narrative/ReaderMixer"
import { FakeAudio } from "../../audio-player/narrative/__tests__/fakeMedia"

vi.mock("../../audio-player/automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))

const ATMOSPHERES: ReaderAtmosphereOption[] = [
    { id: "rain", label: "Rain", group: "Weather", sources: [{ url: "https://a.test/rain.mp3" }] },
    { id: "wind", label: "Wind", group: "Weather", sources: [{ url: "https://a.test/wind.mp3" }] },
    { id: "city", label: "City", group: "Places", sources: [{ url: "https://a.test/city.mp3" }] },
]

let mixer: ReaderMixer | null = null

function MixerProbe({ onMixer }: { onMixer: (mixer: ReaderMixer) => void }) {
    onMixer(useReaderMixer())
    return null
}

function renderPanel(props: Parameters<typeof ReaderMixerPanel>[0] = {}) {
    mixer = createReaderMixer({
        atmospheres: ATMOSPHERES,
        initialPreferences: { atmosphereId: null },
    })
    return render(
        <ReaderMixerProvider mixer={mixer}>
            <ReaderMixerPanel {...props} />
        </ReaderMixerProvider>
    )
}

describe("ReaderMixerPanel", () => {
    beforeEach(() => {
        FakeAudio.reset()
        vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio)
    })

    afterEach(() => {
        cleanup()
        mixer?.dispose()
        mixer = null
        vi.unstubAllGlobals()
    })

    it("shows a master switch and the three available soundtrack layers in order", () => {
        renderPanel()
        const switches = screen.getAllByRole("switch")
        expect(
            switches.map((node) => node.textContent || node.getAttribute("aria-labelledby"))
        ).toHaveLength(4)
        expect(screen.getByRole("switch", { name: "Master" })).toBe(switches[0])
        expect(screen.getByRole("switch", { name: "Soundscapes" })).toBe(switches[1])
        expect(screen.getByRole("switch", { name: "Atmosphere" })).toBe(switches[2])
        expect(screen.getByRole("switch", { name: "Sound Cues" })).toBe(switches[3])
        expect(screen.queryByRole("switch", { name: "Voice" })).toBeNull()
        const sliders = screen.getAllByRole("slider")
        expect(sliders[0]).toHaveAccessibleName("Master volume")
        expect(sliders[1]).toHaveAccessibleName("Soundscapes volume")
        expect(sliders[2]).toHaveAccessibleName("Atmosphere volume")
        expect(sliders[3]).toHaveAccessibleName("Sound Cues volume")
        expect(sliders[1]).toHaveAttribute("aria-valuetext", "25%")
        expect(screen.getByText("25%")).toBeInTheDocument()
    })

    it("drives the mixer from its switches and sliders", () => {
        renderPanel()
        const layers = mixer!.getPreferences().layers
        fireEvent.change(screen.getByRole("slider", { name: "Master volume" }), {
            target: { value: "0" },
        })
        expect(mixer!.getPreferences().masterLevel).toBe(0)
        expect(mixer!.getPreferences().layers).toEqual(layers)
        expect(screen.getByRole("switch", { name: "Master" })).toBeChecked()
        fireEvent.change(screen.getByRole("slider", { name: "Atmosphere volume" }), {
            target: { value: "25" },
        })
        expect(mixer!.getPreferences().layers.atmosphere.level).toBe(0.25)
        expect(screen.getByRole("slider", { name: "Atmosphere volume" })).toHaveAttribute(
            "aria-valuetext",
            "25%"
        )

        const cues = screen.getByRole("switch", { name: "Sound Cues" })
        fireEvent.click(cues)
        expect(cues).not.toBeChecked()
        expect(mixer!.getPreferences().layers.cues.enabled).toBe(false)

        const master = screen.getByRole("switch", { name: "Master" })
        fireEvent.click(master)
        expect(mixer!.getPreferences().masterEnabled).toBe(false)
        // The layers keep their own settings.
        expect(screen.getByRole("switch", { name: "Soundscapes" })).toBeChecked()
    })

    it("follows changes made elsewhere", () => {
        renderPanel()
        act(() => mixer!.setLayerLevel("soundscapes", 0.9))
        expect(screen.getByRole("slider", { name: "Soundscapes volume" })).toHaveValue("90")
    })

    it("preserves Enter toggling on the approved native switches", () => {
        renderPanel()
        const master = screen.getByRole("switch", { name: "Master" })
        fireEvent.keyDown(master, { key: "Enter" })
        expect(master).not.toBeChecked()
        expect(mixer!.getPreferences().masterEnabled).toBe(false)
        fireEvent.keyDown(master, { key: "Enter", repeat: true })
        expect(master).not.toBeChecked()
        fireEvent.keyDown(master, { key: "Enter" })
        expect(master).toBeChecked()
        const cues = screen.getByRole("switch", { name: "Sound Cues" })
        fireEvent.keyDown(cues, { key: "Enter" })
        expect(cues).not.toBeChecked()
        expect(mixer!.getPreferences().layers.cues.enabled).toBe(false)
    })

    it("does not re-announce an unchanged slider value when the timer changes", () => {
        renderPanel()
        const slider = screen.getByRole("slider", { name: "Soundscapes volume" })
        const updates = vi.spyOn(slider, "setAttribute")
        act(() => mixer!.setSleepTimer("15-minutes"))
        expect(slider).toHaveAttribute("aria-valuetext", "25%")
        expect(updates.mock.calls.filter(([attribute]) => attribute === "aria-valuetext")).toEqual(
            []
        )
        updates.mockRestore()
    })

    it("picks an atmosphere from grouped host options, with Off", () => {
        renderPanel()
        const picker = screen.getByRole("combobox", { name: "Atmosphere sound" })
        // Off first, then the host's options grouped for the device picker.
        expect(picker).toHaveValue("null")
        expect(within(picker).getAllByRole("option")[0]).toHaveTextContent("Off")
        expect(within(picker).getByRole("group", { name: "Weather" })).toBeInTheDocument()
        expect(within(picker).getByRole("group", { name: "Places" })).toBeInTheDocument()
        expect(
            within(within(picker).getByRole("group", { name: "Weather" }))
                .getAllByRole("option")
                .map((option) => option.textContent)
        ).toEqual(["Rain", "Wind"])

        fireEvent.change(picker, { target: { value: JSON.stringify("rain") } })
        expect(mixer!.getPreferences().atmosphereId).toBe("rain")
        expect(picker).toHaveValue(JSON.stringify("rain"))
        expect(FakeAudio.withSrc("https://a.test/rain.mp3")).toHaveLength(1)

        fireEvent.change(picker, { target: { value: "null" } })
        expect(mixer!.getPreferences().atmosphereId).toBeNull()
    })

    it("steps through atmosphere choices in place with ◀ and ▶", () => {
        renderPanel()
        const previous = screen.getByRole("button", { name: "Previous Atmosphere sound" })
        const next = screen.getByRole("button", { name: "Next Atmosphere sound" })
        // Off is first, so there is nothing before it.
        expect(previous).toBeDisabled()
        fireEvent.click(next)
        expect(mixer!.getPreferences().atmosphereId).toBe("rain")
        fireEvent.click(next)
        fireEvent.click(next)
        expect(mixer!.getPreferences().atmosphereId).toBe("city")
        expect(next).toBeDisabled()
        fireEvent.click(previous)
        expect(mixer!.getPreferences().atmosphereId).toBe("wind")
    })

    it("gives every channel a sound choice row from the host", () => {
        const picks: string[] = []
        renderPanel({
            sounds: {
                soundscapes: {
                    choices: [
                        { id: "a1", label: "Fanfare", group: "Adventure" },
                        { id: "f1", label: "Clash", group: "Fighting" },
                    ],
                    value: "a1",
                    onChange: (id) => picks.push(`score:${id}`),
                },
                cues: {
                    choices: [
                        { id: "bell", label: "Temple bell" },
                        { id: "growl", label: "Beast growl" },
                    ],
                    value: null,
                    onChange: (id) => picks.push(`cue:${id}`),
                },
                voice: {
                    choices: [{ id: "n1", label: "Story Seed" }],
                    value: "n1",
                    onChange: (id) => picks.push(`voice:${id}`),
                },
            },
        })
        const score = screen.getByRole("combobox", { name: "Score" })
        expect(score).toHaveValue("a1")
        expect(within(score).getByRole("group", { name: "Fighting" })).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Next Score" }))
        expect(picks).toEqual(["score:f1"])

        // Nothing chosen yet: the placeholder shows and ▶ starts at the first choice.
        const cue = screen.getByRole("combobox", { name: "Cue sound" })
        expect(cue).toHaveValue("")
        expect((cue as HTMLSelectElement).selectedOptions[0]).toHaveTextContent("Choose…")
        fireEvent.change(cue, { target: { value: "growl" } })
        expect(picks).toEqual(["score:f1", "cue:growl"])

        // A channel's sound row comes and goes with the channel itself.
        expect(screen.queryByRole("combobox", { name: "Narrator" })).toBeNull()
        act(() => mixer!.setLayerAvailability({ voice: true }))
        expect(screen.getByRole("combobox", { name: "Narrator" })).toHaveValue("n1")
        expect(screen.getByRole("combobox", { name: "Atmosphere sound" })).toBeInTheDocument()

        // Each sound choice sits in its own channel's row, beside its controls.
        const cues = screen.getByRole("switch", { name: "Sound Cues" }).closest("li")!
        expect(within(cues).getByRole("combobox", { name: "Cue sound" })).toBe(cue)
    })

    it("tolerates a non-string group from untyped host data", () => {
        mixer = createReaderMixer({
            atmospheres: [
                {
                    id: "odd",
                    label: "Odd",
                    group: 7 as unknown as string,
                    sources: [{ url: "https://a.test/odd.mp3" }],
                },
            ],
        })
        render(<ReaderMixerPanel mixer={mixer} />)
        expect(screen.getByRole("option", { name: "Odd" })).toBeInTheDocument()
    })

    it("offers presets and marks the one in effect", () => {
        renderPanel()
        const presets = screen.getByRole("group", { name: "Presets" })
        expect(
            within(presets)
                .getAllByRole("radio")
                .map((radio) => radio.closest("label")?.textContent)
        ).toEqual(["Default", "Cinematic", "Calm", "Focus"])
        // Atmosphere Off differs from the default (gentle rain): a custom mix.
        expect(within(presets).queryByRole("radio", { checked: true })).toBeNull()

        fireEvent.click(within(presets).getByRole("radio", { name: "Cinematic" }))
        expect(mixer!.getPreferences().layers.soundscapes.level).toBe(0.6)
        expect(within(presets).getByRole("radio", { name: "Cinematic" })).toBeChecked()

        fireEvent.change(screen.getByRole("slider", { name: "Soundscapes volume" }), {
            target: { value: "33" },
        })
        expect(within(presets).queryByRole("radio", { checked: true })).toBeNull()
    })

    it("accepts every label from the host", () => {
        renderPanel({
            labels: {
                title: "Sonido",
                master: "General",
                layers: { soundscapes: "Música", cues: "Efectos" },
                volume: (label) => `Volumen de ${label}`,
                formatPercent: (value) => `${value} %`,
                atmosphereOff: "Apagado",
                atmospherePicker: "Ambiente",
                presets: "Mezclas",
            },
        })
        expect(screen.getByRole("region", { name: "Sonido" })).toBeInTheDocument()
        expect(screen.getByRole("switch", { name: "General" })).toBeInTheDocument()
        expect(screen.getByRole("switch", { name: "Música" })).toBeInTheDocument()
        expect(screen.getByRole("switch", { name: "Atmosphere" })).toBeInTheDocument()
        expect(screen.getByRole("slider", { name: "Volumen de Efectos" })).toHaveAttribute(
            "aria-valuetext",
            "75 %"
        )
        const picker = screen.getByRole("combobox", { name: "Ambiente" })
        expect(within(picker).getByRole("option", { name: "Apagado" })).toHaveProperty(
            "selected",
            true
        )
        expect(screen.getByRole("group", { name: "Mezclas" })).toBeInTheDocument()
    })

    it("says when the device sets the volume", () => {
        FakeAudio.volumeLocked = true
        renderPanel()
        expect(screen.getByText("Volume is set by your device on this browser")).toBeInTheDocument()
    })

    it("hides the device hint where sliders really set the volume", () => {
        renderPanel()
        expect(screen.queryByText(/set by your device/)).toBeNull()
    })

    it("tells the reader when a tap is needed", async () => {
        FakeAudio.playBehavior = "not-allowed"
        renderPanel()
        await act(async () => {
            mixer!.playSoundscape({
                id: "s",
                title: "S",
                artist: "",
                audioFile: "https://a.test/s.mp3",
            })
            for (let i = 0; i < 6; i += 1) await Promise.resolve()
        })
        expect(screen.getByText("Tap anywhere to start audio")).toBeInTheDocument()
    })

    it("renders inline in normal flow, with host theming", () => {
        renderPanel({
            style: { ["--sap-reader-mixer-accent" as string]: "#f00" },
            className: "host",
        })
        const region = screen.getByRole("region", { name: "Audio" })
        expect(region).toHaveClass("sap-reader-mixer", "host")
        expect(region.style.position).toBe("")
        expect(region.style.getPropertyValue("--sap-reader-mixer-accent")).toBe("#f00")
    })

    it("shares one mixer through the provider and survives StrictMode", () => {
        const seen: ReaderMixer[] = []
        const { unmount } = render(
            <StrictMode>
                <ReaderMixerProvider options={{ atmospheres: ATMOSPHERES }}>
                    <MixerProbe onMixer={(value) => seen.push(value)} />
                    <ReaderMixerPanel />
                </ReaderMixerProvider>
            </StrictMode>
        )
        const live = seen[seen.length - 1]
        expect(live.isDisposed()).toBe(false)
        fireEvent.click(screen.getByRole("switch", { name: "Master" }))
        expect(live.getPreferences().masterEnabled).toBe(false)
        unmount()
        expect(live.isDisposed()).toBe(true)
    })

    it("keeps a dragging or focused row until the reader finishes", () => {
        renderPanel()
        const slider = screen.getByRole("slider", { name: "Sound Cues volume" })
        fireEvent.pointerDown(slider)
        act(() => mixer!.setLayerAvailability({ cues: false }))
        expect(slider).toBeInTheDocument()
        fireEvent.change(slider, { target: { value: "22" } })
        expect(mixer!.getPreferences().layers.cues.level).toBe(0.22)
        fireEvent.pointerUp(document)
        // The approved slider focuses its native range on pointer down. Focus
        // is still an interaction after the drag finishes, so retain that row.
        expect(slider).toBeInTheDocument()
        fireEvent.blur(slider, { relatedTarget: document.body })
        expect(slider).not.toBeInTheDocument()
        act(() => mixer!.setLayerAvailability({ cues: true }))
        const focused = screen.getByRole("switch", { name: "Sound Cues" })
        fireEvent.focus(focused)
        act(() => mixer!.setLayerAvailability({ cues: false }))
        expect(focused).toBeInTheDocument()
        fireEvent.blur(focused, { relatedTarget: document.body })
        expect(focused).not.toBeInTheDocument()
    })

    it("shows one host-labelled empty message without unused rows", () => {
        renderPanel({ labels: { noAudio: "No sounds in this chapter" } })
        act(() =>
            mixer!.setLayerAvailability({
                soundscapes: false,
                atmosphere: false,
                cues: false,
                voice: false,
            })
        )
        expect(screen.getByText("No sounds in this chapter")).toBeInTheDocument()
        expect(screen.getAllByRole("switch")).toHaveLength(1)
        expect(screen.queryAllByRole("slider")).toHaveLength(1)
    })

    it("lets the same timer choice re-arm after it has fired", () => {
        renderPanel()
        const select = screen.getByRole("combobox", { name: "Sleep timer" })
        fireEvent.change(select, { target: { value: "chapter-end" } })
        act(() => mixer!.notifyChapterEnd())
        expect(select).toHaveValue("off")
        fireEvent.change(select, { target: { value: "chapter-end" } })
        expect(mixer!.getState().sleepTimer.status).toBe("running")
        expect(select).toHaveValue("chapter-end")
    })

    it("describes the sleep timer with its countdown", () => {
        renderPanel()
        const select = screen.getByRole("combobox", { name: "Sleep timer" })
        expect(select).toHaveAccessibleDescription("")
        fireEvent.change(select, { target: { value: "30-minutes" } })
        expect(select).toHaveAccessibleDescription("Stops in 30 min")
    })

    it("arms translated timers, reports remaining wall-clock time, and cancels", () => {
        vi.useFakeTimers()
        renderPanel({ labels: { sleepTimer: "Stop audio", cancelTimer: "Keep playing" } })
        fireEvent.change(screen.getByRole("combobox", { name: "Stop audio" }), {
            target: { value: "30-minutes" },
        })
        expect(screen.getByText("Stops in 30 min")).toBeInTheDocument()
        act(() => vi.advanceTimersByTime(7 * 60000))
        expect(screen.getByText("Stops in 23 min")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Keep playing" }))
        expect(mixer!.getState().sleepTimer.status).toBe("off")
        mixer!.dispose()
        vi.useRealTimers()
    })
})
