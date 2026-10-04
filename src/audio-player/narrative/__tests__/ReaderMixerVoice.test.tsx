// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { StrictMode, Suspense, startTransition } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioSessionProvider, useAudioSession } from "../../session/AudioSessionContext"
import * as AudioSession from "../../session/AudioSessionContext"
import type { SessionEngine } from "../../types"
import { ReaderMixerPanel } from "../../components/ReaderMixerPanel"
import { NarrativeFace } from "../../skins/NarrativeFace"
import { ReaderMixerProvider } from "../ReaderMixerContext"
import { createReaderMixer } from "../ReaderMixer"
import type { ReaderMixer } from "../ReaderMixer"
import { ReaderMixerVoice } from "../ReaderMixerVoice"
import { setVisibility } from "./fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
    ensureTrackAnalysis: vi.fn(() => Promise.resolve(null)),
    getTrackTrims: vi.fn(() => null),
}))

let mixer: ReaderMixer
let session: SessionEngine
function Probe() {
    session = useAudioSession()
    return null
}
function Reader({ connected = true }: { connected?: boolean }) {
    return (
        <ReaderMixerProvider mixer={mixer}>
            <AudioSessionProvider
                initialQueue={[{ id: "tts", title: "TTS", artist: "", audioFile: "tts.mp3" }]}
                audioBackend="html5"
            >
                {connected && <ReaderMixerVoice />}
                <Probe />
                <NarrativeFace />
                <ReaderMixerPanel />
            </AudioSessionProvider>
        </ReaderMixerProvider>
    )
}

beforeEach(() => {
    setVisibility("visible")
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
    const paused = new WeakMap<HTMLMediaElement, boolean>()
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (
        this: HTMLMediaElement
    ) {
        return paused.get(this) ?? true
    })
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (
        this: HTMLMediaElement
    ) {
        paused.set(this, false)
        this.dispatchEvent(new Event("play"))
        this.dispatchEvent(new Event("playing"))
    })
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
        this: HTMLMediaElement
    ) {
        paused.set(this, true)
        this.dispatchEvent(new Event("pause"))
    })
    mixer = createReaderMixer({
        initialPreferences: { layers: { voice: { level: 0.6 } } },
    })
})
afterEach(() => {
    cleanup()
    mixer.dispose()
    vi.restoreAllMocks()
})

describe("ReaderMixerVoice session connection", () => {
    it("resumes the committed session after a discarded Suspense render", async () => {
        const pending = new Promise<void>(() => {})
        function Discarded({ suspend }: { suspend: boolean }) {
            if (suspend) throw pending
            return null
        }
        function Tree({ suspend }: { suspend: boolean }) {
            return (
                <Suspense fallback="waiting">
                    <Reader />
                    <Discarded suspend={suspend} />
                </Suspense>
            )
        }
        const view = render(<Tree suspend={false} />)
        const audio = view.container.querySelector("audio")!
        await act(async () => session.play())
        act(() => setVisibility("hidden"))
        expect(audio.paused).toBe(true)
        const discardedPlay = vi.fn(async () => {})
        const useCommittedSession = AudioSession.useAudioSession
        const speculative = vi
            .spyOn(AudioSession, "useAudioSession")
            .mockImplementation(function useSpeculativeSession() {
                return { ...useCommittedSession(), hasAudio: false, play: discardedPlay }
            })
        await act(async () => {
            startTransition(() => view.rerender(<Tree suspend={true} />))
        })
        expect(screen.queryByText("waiting")).not.toBeInTheDocument()
        speculative.mockRestore()
        act(() => setVisibility("visible"))
        await act(async () => {})
        expect(discardedPlay).not.toHaveBeenCalled()
        expect(audio.paused).toBe(false)
    })

    it("synchronizes external volume after a mixer write is superseded in the same batch", async () => {
        render(<Reader />)
        await act(async () => {
            mixer.setLayerLevel("voice", 0.25)
            session.setVolume(0.8)
        })
        expect(mixer.getPreferences().layers.voice.level).toBe(0.8)
        await act(async () => session.setVolume(0.9))
        expect(mixer.getPreferences().layers.voice.level).toBe(0.9)
        expect(screen.getByRole("slider", { name: "Voice volume" })).toHaveValue("90")
    })

    it("applies saved voice levels in StrictMode and syncs both controls and external volume", async () => {
        const view = render(
            <StrictMode>
                <Reader />
            </StrictMode>
        )
        const audio = view.container.querySelector("audio")!
        expect(session.volume).toBe(0.6)
        expect(audio.volume).toBe(0.6)
        fireEvent.change(screen.getByRole("slider", { name: "Voice volume" }), {
            target: { value: "37" },
        })
        expect(audio.volume).toBe(0.37)
        expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute(
            "aria-valuenow",
            "37"
        )
        fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), { key: "Home" })
        expect(mixer.getPreferences().layers.voice.level).toBe(0)
        expect(audio.muted).toBe(true)
        await act(async () => session.setVolume(0.8))
        expect(mixer.getPreferences().layers.voice.level).toBe(0.8)
        expect(screen.getByRole("slider", { name: "Voice volume" })).toHaveValue("80")
        expect(audio.muted).toBe(false)
    })

    it("keeps Voice audible under soundtrack mute and gates it with its own switch", async () => {
        const view = render(<Reader />)
        const audio = view.container.querySelector("audio")!
        await act(async () => session.play())
        expect(mixer.getState().layers.voice.status).toBe("playing")
        expect(mixer.getDuck()).toBe(0.6)
        audio.currentTime = 42
        fireEvent.click(screen.getByRole("switch", { name: "Master" }))
        expect(audio.muted).toBe(false)
        expect(session.isMuted).toBe(false)
        expect(session.volume).toBe(0.6)
        expect(audio.currentTime).toBe(42)
        expect(mixer.getDuck()).toBe(0.6)
        fireEvent.click(screen.getByRole("switch", { name: "Master" }))
        expect(audio.muted).toBe(false)
        expect(audio.volume).toBe(0.6)
        expect(mixer.getDuck()).toBe(0.6)
        fireEvent.click(screen.getByRole("button", { name: "Mute" }))
        expect(screen.getByRole("switch", { name: "Voice" })).toHaveAttribute(
            "aria-checked",
            "false"
        )
        expect(audio.muted).toBe(true)
        expect(mixer.getDuck()).toBe(0)
        fireEvent.click(screen.getByRole("switch", { name: "Voice" }))
        expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument()
        expect(audio.muted).toBe(false)
        await act(async () => session.toggleMute())
        expect(mixer.getState().layers.voice.effectiveLevel).toBe(0)
        expect(mixer.getDuck()).toBe(0)
        fireEvent.click(screen.getByRole("button", { name: "Unmute" }))
        expect(audio.muted).toBe(false)
        expect(mixer.getDuck()).toBe(0.6)
    })

    it("keeps the face's audible-volume unmute behavior", () => {
        const view = render(<Reader />)
        const audio = view.container.querySelector("audio")!
        fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), { key: "Home" })
        fireEvent.click(screen.getByRole("button", { name: "Mute" }))
        fireEvent.click(screen.getByRole("button", { name: "Unmute" }))
        expect(mixer.getPreferences().layers.voice.level).toBe(0.6)
        expect(audio.muted).toBe(false)
        fireEvent.click(screen.getByRole("button", { name: "Mute" }))
        fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), { key: "ArrowRight" })
        expect(mixer.getPreferences().layers.voice.enabled).toBe(true)
        expect(audio.muted).toBe(false)
    })

    it("follows visibility and stopAll and releases its gate when disconnected", async () => {
        const view = render(<Reader />)
        const audio = view.container.querySelector("audio")!
        await act(async () => session.play())
        act(() => setVisibility("hidden"))
        expect(mixer.getState().layers.voice.status).toBe("paused")
        act(() => setVisibility("visible"))
        await act(async () => {})
        expect(mixer.getState().layers.voice.status).toBe("playing")
        act(() => mixer.stopAll())
        expect(session.isPlaying).toBe(false)
        act(() => mixer.setLayerEnabled("voice", false))
        expect(audio.muted).toBe(true)
        view.rerender(<Reader connected={false} />)
        expect(audio.muted).toBe(false)
        expect(mixer.getState().layers.voice.status).toBe("idle")
        expect(session.currentTrack?.id).toBe("tts")
    })
})
