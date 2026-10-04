// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode } from "react"
import { ReaderMixerPanel } from "../ReaderMixerPanel"
import { ReaderMixerProvider, useReaderMixer } from "../../narrative/ReaderMixerContext"
import { createReaderMixer } from "../../narrative/ReaderMixer"
import type { ReaderAtmosphereOption, ReaderMixer } from "../../narrative/ReaderMixer"
import { FakeAudio } from "../../narrative/__tests__/fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
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

    it("shows a master switch and all four layers in order", () => {
        renderPanel()
        const switches = screen.getAllByRole("switch")
        expect(
            switches.map((node) => node.textContent || node.getAttribute("aria-labelledby"))
        ).toHaveLength(5)
        expect(screen.getByRole("switch", { name: "Master" })).toBe(switches[0])
        expect(screen.getByRole("switch", { name: "Soundscapes" })).toBe(switches[1])
        expect(screen.getByRole("switch", { name: "Atmosphere" })).toBe(switches[2])
        expect(screen.getByRole("switch", { name: "Sound Cues" })).toBe(switches[3])
        expect(screen.getByRole("switch", { name: "Voice" })).toBe(switches[4])
        const sliders = screen.getAllByRole("slider")
        expect(sliders.map((node) => node.getAttribute("aria-label"))).toEqual([
            "Soundscapes volume",
            "Atmosphere volume",
            "Sound Cues volume",
            "Voice volume",
        ])
        expect(sliders[0]).toHaveAttribute("aria-valuetext", "25%")
        expect(screen.getByText("25%")).toBeInTheDocument()
    })

    it("drives the mixer from its switches and sliders", () => {
        renderPanel()
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
        expect(cues).toHaveAttribute("aria-checked", "false")
        expect(mixer!.getPreferences().layers.cues.enabled).toBe(false)

        const master = screen.getByRole("switch", { name: "Master" })
        fireEvent.click(master)
        expect(mixer!.getPreferences().masterEnabled).toBe(false)
        // The layers keep their own settings.
        expect(screen.getByRole("switch", { name: "Soundscapes" })).toHaveAttribute(
            "aria-checked",
            "true"
        )
    })

    it("follows changes made elsewhere", () => {
        renderPanel()
        act(() => mixer!.setLayerLevel("soundscapes", 0.9))
        expect(screen.getByRole("slider", { name: "Soundscapes volume" })).toHaveValue("90")
    })

    it("picks an atmosphere from grouped host options, with Off", () => {
        renderPanel()
        const picker = screen.getByRole("group", { name: "Atmosphere sound" })
        expect(within(picker).getByRole("radio", { name: "Off" })).toBeChecked()
        expect(within(picker).getByRole("group", { name: "Weather" })).toBeInTheDocument()
        expect(within(picker).getByRole("group", { name: "Places" })).toBeInTheDocument()

        fireEvent.click(within(picker).getByRole("radio", { name: "Rain" }))
        expect(mixer!.getPreferences().atmosphereId).toBe("rain")
        expect(within(picker).getByRole("radio", { name: "Rain" })).toBeChecked()
        expect(FakeAudio.withSrc("https://a.test/rain.mp3")).toHaveLength(1)

        fireEvent.click(within(picker).getByRole("radio", { name: "Off" }))
        expect(mixer!.getPreferences().atmosphereId).toBeNull()
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
        expect(screen.getByRole("radio", { name: "Odd" })).toBeInTheDocument()
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
        expect(screen.getByRole("radio", { name: "Apagado" })).toBeChecked()
        expect(screen.getByRole("group", { name: "Ambiente" })).toBeInTheDocument()
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
})
