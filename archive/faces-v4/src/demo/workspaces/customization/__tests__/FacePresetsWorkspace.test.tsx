/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installBrowserStubs } from "../../../workshop/__tests__/browserStubs"
import { loadPresets } from "../../../workshopPresets"
import { FacePresetsWorkspace } from "../FacePresetsWorkspace"

/* The original Workshop tab, now the Face Presets workspace. */

beforeEach(() => {
    installBrowserStubs()
    localStorage.clear()
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
})

function pickFace(label: string) {
    const select = screen.getByLabelText("Player face")
    const option = screen.getByRole("option", { name: label })
    fireEvent.change(select, { target: { value: option.getAttribute("value") } })
}

describe("Face Presets workspace", () => {
    it("previews the chosen face alongside its property panel and plugin registry", () => {
        render(<FacePresetsWorkspace />)
        expect(screen.getByRole("heading", { name: "Main AudioPlayer" })).toBeInTheDocument()
        pickFace("FullCardPlayer")
        expect(screen.getByRole("heading", { name: "FullCardPlayer" })).toBeInTheDocument()
        expect(screen.getByText("Plugin Registry")).toBeInTheDocument()
    })

    it("saves a named preset in this browser and loads it back", () => {
        render(<FacePresetsWorkspace />)
        pickFace("SeaCardPlayer")
        const save = screen.getByRole("button", { name: "Save preset" })
        expect(save).toBeDisabled()

        fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Night set" } })
        fireEvent.click(save)
        expect(loadPresets().map((preset) => [preset.name, preset.faceId])).toEqual([
            ["Night set", "sea-card"],
        ])
        expect(screen.getByText(/^SeaCardPlayer · \d+ plugins? ·/)).toBeInTheDocument()

        pickFace("Main AudioPlayer")
        fireEvent.click(screen.getByRole("button", { name: "Load preset Night set" }))
        expect(screen.getByRole("heading", { name: "SeaCardPlayer" })).toBeInTheDocument()
    })

    it("asks before deleting a preset", () => {
        render(<FacePresetsWorkspace />)
        fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Keep me" } })
        fireEvent.click(screen.getByRole("button", { name: "Save preset" }))

        const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false)
        fireEvent.click(screen.getByRole("button", { name: "Delete preset Keep me" }))
        expect(confirm).toHaveBeenCalledOnce()
        expect(loadPresets()).toHaveLength(1)

        confirm.mockReturnValueOnce(true)
        fireEvent.click(screen.getByRole("button", { name: "Delete preset Keep me" }))
        expect(loadPresets()).toHaveLength(0)
        expect(screen.getByText(/No presets yet/)).toBeInTheDocument()
    })
})
