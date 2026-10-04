// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ReaderMixerWorkspace } from "../ReaderMixerWorkspace"
import { loadReaderMixerPreferences } from "../../../../audio-player"

const STORAGE_KEY = "sap-workshop:reader-mixer"

beforeEach(() => {
    vi.useFakeTimers()
    localStorage.removeItem(STORAGE_KEY)
})
afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.removeItem(STORAGE_KEY)
})

it("resets pending preferences without restoring them on disposal or reload", () => {
    const view = render(<ReaderMixerWorkspace />)
    fireEvent.change(view.getByRole("slider", { name: "Sound Cues volume" }), {
        target: { value: "12" },
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    fireEvent.click(view.getByRole("button", { name: "Reset saved settings" }))
    expect(loadReaderMixerPreferences(STORAGE_KEY)?.layers.cues.level).toBe(0.75)
    view.unmount()
    const reloaded = render(<ReaderMixerWorkspace />)
    expect(
        (reloaded.getByRole("slider", { name: "Sound Cues volume" }) as HTMLInputElement).value
    ).toBe("75")
})
