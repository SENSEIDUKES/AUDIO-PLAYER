// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ReaderMixerNote } from "../ReaderMixerNote"
import { createReaderMixer, type ReaderMixer } from "../../narrative/ReaderMixer"
import { FakeAudio, flushMicrotasks, setVisibility } from "../../narrative/__tests__/fakeMedia"

let mixer: ReaderMixer
beforeEach(() => {
    vi.useFakeTimers()
    FakeAudio.reset()
    vi.stubGlobal("Audio", FakeAudio)
    vi.stubGlobal("PointerEvent", MouseEvent)
    setVisibility("visible")
    mixer = createReaderMixer({ sleepFadeMs: 0 })
})
afterEach(() => {
    cleanup()
    mixer.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

it("independently mutes without turning Master off or losing volume", () => {
    mixer.setMasterLevel(0.4)
    render(<ReaderMixerNote mixer={mixer} muteMode="soundtrack-mute" />)
    fireEvent.click(screen.getByRole("button", { name: "Mute story audio" }))
    expect(mixer.getPreferences()).toMatchObject({
        masterEnabled: true,
        masterMuted: true,
        masterLevel: 0.4,
    })
    expect(mixer.getState().layers.soundscapes.effectiveLevel).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "Unmute story audio" }))
    expect(mixer.getPreferences()).toMatchObject({
        masterEnabled: true,
        masterMuted: false,
        masterLevel: 0.4,
    })
    act(() => mixer.setMasterLevel(0))
    expect(screen.getByRole("button", { name: "Unmute story audio" })).toBeInTheDocument()
    expect(mixer.getPreferences().masterEnabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Unmute story audio" }))
    expect(mixer.getPreferences()).toMatchObject({
        masterLevel: 0.4,
        masterRestoreLevel: 0.4,
        masterEnabled: true,
    })
})

it("legacy host notes can restore an independent Reader mute", () => {
    mixer.setMasterMuted(true)
    render(<ReaderMixerNote mixer={mixer} />)
    fireEvent.click(screen.getByRole("button", { name: "Unmute story audio" }))
    expect(mixer.getPreferences()).toMatchObject({ masterEnabled: true, masterMuted: false })
    fireEvent.click(screen.getByRole("button", { name: "Mute story audio" }))
    expect(mixer.getPreferences().masterEnabled).toBe(false)
})

it("independent notes hide only when Settings disables Master", () => {
    render(<ReaderMixerNote mixer={mixer} muteMode="soundtrack-mute" />)
    act(() => mixer.setMasterLevel(0))
    expect(screen.getByRole("button")).toBeInTheDocument()
    act(() => mixer.setMasterEnabled(false))
    expect(screen.queryByRole("button")).toBeNull()
    act(() => mixer.setMasterEnabled(true))
    expect(screen.getByRole("button", { name: "Unmute story audio" })).toBeInTheDocument()
})

it("legacy notes restore saved volume when resuming sleep-stopped muted audio", async () => {
    mixer.setMasterLevel(0.37)
    mixer.setMasterLevel(0)
    mixer.setMasterMuted(true)
    render(<ReaderMixerNote mixer={mixer} />)
    act(() => {
        mixer.setSleepTimer("chapter-end")
        mixer.notifyChapterEnd()
    })
    fireEvent.click(screen.getByRole("button", { name: "Resume story audio" }))
    await act(async () => {
        await flushMicrotasks()
    })
    expect(mixer.getState().sleepTimer.status).toBe("off")
    expect(mixer.getPreferences()).toMatchObject({
        masterEnabled: true,
        masterMuted: false,
        masterLevel: 0.37,
    })
})

it("is a labelled native button, announces mute/unmute and never gates narration", () => {
    const setEnabled = vi.fn()
    mixer.connectVoice({
        getState: () => ({ status: "playing" }),
        subscribe: () => () => {},
        setLevel: vi.fn(),
        setEnabled,
        pause: vi.fn(),
        resume: vi.fn(),
    })
    const view = render(<ReaderMixerNote mixer={mixer} />)
    fireEvent.click(screen.getByRole("button", { name: "Mute story audio" }))
    expect(mixer.getPreferences().masterEnabled).toBe(false)
    expect(setEnabled).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole("button", { name: "Unmute story audio" })).not.toHaveAttribute(
        "aria-pressed"
    )
    expect(view.container.querySelector(".sap-reader-mixer-note__slash")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Story audio muted")
    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByRole("button", { name: "Mute story audio" })).not.toHaveAttribute(
        "aria-pressed"
    )
    expect(screen.queryByRole("slider")).toBeNull()
})

it("unlocks a wanted blocked layer without muting it", async () => {
    FakeAudio.playBehavior = "not-allowed"
    render(<ReaderMixerNote mixer={mixer} />)
    await act(async () => {
        mixer.playSoundscape({ title: "S", artist: "", audioFile: "https://a.test/s.mp3" })
        await flushMicrotasks()
    })
    expect(screen.getByRole("button", { name: "Tap to start story audio" })).not.toHaveAttribute(
        "aria-pressed"
    )
    // Waiting for a tap dims the same note (CSS on data-state); it adds no mark.
    const note = document.querySelector(".sap-reader-mixer-note")!
    expect(note).toHaveAttribute("data-state", "needs-tap")
    expect(note.querySelectorAll(".sap-reader-mixer-note__glyph path")).toHaveLength(1)
    const unlock = vi.spyOn(mixer, "unlock")
    FakeAudio.playBehavior = "resolve"
    fireEvent.click(screen.getByRole("button"))
    await act(async () => {
        await flushMicrotasks()
    })
    expect(unlock).toHaveBeenCalled()
    expect(mixer.getPreferences().masterEnabled).toBe(true)
})

it("marks a wanted loop that failed to play and retries it on tap", async () => {
    mixer.dispose()
    mixer = createReaderMixer({ sleepFadeMs: 0, loopMaxRetries: 0, fadeMs: 0 })
    FakeAudio.playBehavior = "reject"
    render(<ReaderMixerNote mixer={mixer} muteMode="soundtrack-mute" />)
    await act(async () => {
        mixer.playSoundscape({ title: "S", artist: "", audioFile: "https://a.test/s.mp3" })
        await flushMicrotasks()
        await vi.advanceTimersByTimeAsync(100)
    })
    expect(mixer.getState().layers.soundscapes.status).toBe("failed")
    const note = document.querySelector(".sap-reader-mixer-note")!
    expect(note).toHaveAttribute("data-state", "failed")
    expect(note.querySelectorAll(".sap-reader-mixer-note__glyph path")).toHaveLength(1)
    const retry = vi.spyOn(mixer, "retryFailed")
    FakeAudio.playBehavior = "resolve"
    fireEvent.click(screen.getByRole("button", { name: "Retry story audio" }))
    await act(async () => {
        await flushMicrotasks()
        await vi.advanceTimersByTimeAsync(100)
    })
    expect(retry).toHaveBeenCalled()
    expect(mixer.getPreferences().masterMuted).toBe(false)
    expect(mixer.getState().layers.soundscapes.status).toBe("playing")
    expect(note).toHaveAttribute("data-state", "on")
})

it("shows a running timer indicator, then resumes sleep-stopped audio on tap", async () => {
    render(<ReaderMixerNote mixer={mixer} />)
    act(() => mixer.setSleepTimer("chapter-end"))
    expect(screen.getByRole("img", { name: "Sleep timer running" })).toBeInTheDocument()
    act(() => mixer.notifyChapterEnd())
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getByRole("button", { name: "Resume story audio" })).toBeInTheDocument()
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed")
    fireEvent.click(screen.getByRole("button"))
    await act(async () => {
        await flushMicrotasks()
    })
    expect(mixer.getState().sleepTimer.status).toBe("off")
    expect(mixer.getPreferences().masterEnabled).toBe(true)
})

it("opens settings on long press and context menu, without a synthesized mute", () => {
    const onOpenSettings = vi.fn()
    render(<ReaderMixerNote mixer={mixer} onOpenSettings={onOpenSettings} />)
    const button = screen.getByRole("button")
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(600))
    expect(onOpenSettings).toHaveBeenCalledOnce()
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(mixer.getPreferences().masterEnabled).toBe(true)
    fireEvent.pointerDown(button, { button: 2 })
    fireEvent.contextMenu(button)
    expect(onOpenSettings).toHaveBeenCalledTimes(2)
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(mixer.getPreferences().masterEnabled).toBe(false)
})

it("cancels a long press when the pointer leaves or is cancelled", () => {
    const onOpenSettings = vi.fn()
    render(<ReaderMixerNote mixer={mixer} onOpenSettings={onOpenSettings} />)
    fireEvent.pointerDown(screen.getByRole("button"), { button: 0 })
    fireEvent.pointerCancel(screen.getByRole("button"))
    act(() => vi.advanceTimersByTime(1000))
    expect(onOpenSettings).not.toHaveBeenCalled()
})

it("hides for no available layer and allows host wording/theming", () => {
    render(
        <ReaderMixerNote
            mixer={mixer}
            labels={{ mute: "Silence soundtrack", muted: "Soundtrack off" }}
            className="host-note"
            style={{ color: "red" }}
        />
    )
    fireEvent.click(screen.getByRole("button", { name: "Silence soundtrack" }))
    expect(screen.getByRole("status")).toHaveTextContent("Soundtrack off")
    act(() =>
        mixer.setLayerAvailability({
            soundscapes: false,
            atmosphere: false,
            cues: false,
            voice: false,
        })
    )
    expect(screen.queryByRole("button")).toBeNull()
})

it("ghosts on captured container scroll and restores after two seconds or pointer proximity", () => {
    const view = render(<ReaderMixerNote mixer={mixer} />)
    const note = view.container.querySelector(".sap-reader-mixer-note")!
    const scroller = document.createElement("div")
    document.body.append(scroller)
    fireEvent.scroll(scroller)
    expect(note).toHaveAttribute("data-scrolling", "true")
    act(() => vi.advanceTimersByTime(1999))
    expect(note).toHaveAttribute("data-scrolling", "true")
    act(() => vi.advanceTimersByTime(1))
    expect(note).toHaveAttribute("data-scrolling", "false")
    fireEvent.scroll(scroller)
    fireEvent.pointerMove(note)
    expect(note).toHaveAttribute("data-scrolling", "false")
    scroller.remove()
})

it("honors live reduced-motion preferences and cleans pending timers on unmount", () => {
    const change = new Set<() => void>()
    const preference = {
        matches: true,
        addEventListener: (_: string, listener: () => void) => change.add(listener),
        removeEventListener: (_: string, listener: () => void) => change.delete(listener),
    }
    vi.stubGlobal("matchMedia", () => preference)
    const view = render(<ReaderMixerNote mixer={mixer} onOpenSettings={vi.fn()} />)
    const note = view.container.querySelector(".sap-reader-mixer-note")!
    expect(note).toHaveAttribute("data-reduced-motion", "true")
    act(() => {
        preference.matches = false
        change.forEach((listener) => listener())
    })
    expect(note).toHaveAttribute("data-reduced-motion", "false")
    fireEvent.scroll(document)
    fireEvent.pointerDown(screen.getByRole("button"), { button: 0 })
    view.unmount()
    expect(change.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
})
