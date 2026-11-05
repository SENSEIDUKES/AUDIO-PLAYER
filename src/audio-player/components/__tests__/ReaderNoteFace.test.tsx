// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ReaderNoteFace } from "../ReaderNoteFace"
import { createReaderMixer, type ReaderMixer } from "../../narrative/ReaderMixer"
import { ReaderMixerProvider } from "../../narrative/ReaderMixerContext"
import { FakeAudio, setVisibility } from "../../narrative/__tests__/fakeMedia"

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

const hold = (button: HTMLElement) => {
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(600))
    fireEvent.pointerUp(button)
}

it("a tap mutes the story audio without turning Master off", () => {
    render(<ReaderNoteFace mixer={mixer} />)
    fireEvent.click(screen.getByRole("button", { name: "Mute story audio" }))
    expect(mixer.getPreferences()).toMatchObject({ masterEnabled: true, masterMuted: true })
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
})

it("a hold opens the quick master volume, which sets the master level", () => {
    render(<ReaderNoteFace mixer={mixer} />)
    const note = screen.getByRole("button", { name: "Mute story audio" })
    hold(note)
    expect(mixer.getPreferences().masterMuted).toBeFalsy()
    const slider = screen.getByRole("slider", { name: "Quick master volume" })
    expect(screen.getByRole("group", { name: "Quick master volume" })).toContainElement(slider)
    expect(slider).toHaveFocus()
    expect(slider).toHaveAttribute("aria-orientation", "vertical")
    fireEvent.change(slider, { target: { value: "40" } })
    expect(mixer.getPreferences().masterLevel).toBeCloseTo(0.4)
    expect(slider).toHaveAttribute("aria-valuetext", "40%")
    // The hold does not also mute.
    fireEvent.click(note)
    expect(mixer.getPreferences().masterMuted).toBeFalsy()
})

it("Escape and an outside press close the quick volume", () => {
    render(
        <>
            <ReaderNoteFace mixer={mixer} />
            <p>Chapter text</p>
        </>
    )
    const note = screen.getByRole("button", { name: "Mute story audio" })
    fireEvent.keyDown(note, { key: "ArrowUp" })
    const slider = screen.getByRole("slider")
    fireEvent.keyDown(slider, { key: "Escape" })
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    expect(note).toHaveFocus()
    fireEvent.keyDown(note, { key: "ArrowDown" })
    expect(screen.getByRole("slider")).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByText("Chapter text"))
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
})

it("keeps the volume open on focus changes, as Development does, until an outside press", () => {
    render(
        <>
            <ReaderNoteFace mixer={mixer} />
            <button type="button">Next page</button>
        </>
    )
    const note = screen.getByRole("button", { name: "Mute story audio" })
    fireEvent.keyDown(note, { key: "ArrowUp" })
    const slider = screen.getByRole("slider")
    fireEvent.blur(slider, { relatedTarget: note })
    expect(screen.getByRole("slider")).toBeInTheDocument()
    fireEvent.blur(screen.getByRole("slider"), {
        relatedTarget: screen.getByRole("button", { name: "Next page" }),
    })
    expect(screen.getByRole("slider")).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole("button", { name: "Next page" }))
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
})

it("is hidden while Settings has Master off, and uses the provider's mixer", () => {
    render(
        <ReaderMixerProvider mixer={mixer}>
            <ReaderNoteFace labels={{ mute: "Quiet the story" }} />
        </ReaderMixerProvider>
    )
    expect(screen.getByRole("button", { name: "Quiet the story" })).toBeInTheDocument()
    act(() => mixer.setMasterEnabled(false))
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    act(() => mixer.setMasterEnabled(true))
    expect(screen.getByRole("button", { name: "Quiet the story" })).toBeInTheDocument()
})
