/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioSessionProvider } from "../../../../audio-player"
import type { Track } from "../../../../audio-player"
import { installBrowserStubs } from "../../../workshop/__tests__/browserStubs"
import { ComposedFace } from "../ComposedFace"
import { BLANK_FACE, PIECE_ORDER, addPiece, setInteractions, setLayout } from "../faceSpec"
import type { FaceInteractions, FaceSpec, PieceKind } from "../faceSpec"
import { themeFor } from "../themes"

const TRACKS: Track[] = [
    { id: "a", title: "First Light", artist: "SEIHouse", audioFile: "a.mp3" },
    { id: "b", title: "Second Wind", artist: "SEIHouse", audioFile: "b.mp3" },
    { id: "c", title: "Third Door", artist: "SEIHouse", audioFile: "c.mp3" },
]

function face(kinds: PieceKind[], interactions: Partial<FaceInteractions> = {}): FaceSpec {
    const spec = kinds.reduce((current, kind) => addPiece(current, kind), BLANK_FACE)
    return setInteractions(spec, interactions)
}

function renderFace(spec: FaceSpec, emptyMessage?: string) {
    const onInteraction = vi.fn()
    const onOpenController = vi.fn()
    render(
        <AudioSessionProvider initialQueue={TRACKS}>
            <ComposedFace
                spec={spec}
                onInteraction={onInteraction}
                onOpenController={onOpenController}
                emptyMessage={emptyMessage}
            />
        </AudioSessionProvider>
    )
    return {
        onInteraction,
        onOpenController,
        surface: screen.getByRole("region", { name: "New Face" }),
    }
}

let pointer = 0
function press(target: Element, { x = 100, y = 100, pointerType = "mouse" } = {}) {
    pointer += 1
    fireEvent.pointerDown(target, {
        pointerId: pointer,
        button: 0,
        clientX: x,
        clientY: y,
        pointerType,
    })
    return pointer
}
function release(target: Element, id: number, { x = 100, y = 100, pointerType = "mouse" } = {}) {
    fireEvent.pointerUp(target, { pointerId: id, button: 0, clientX: x, clientY: y, pointerType })
}
function tap(target: Element, pointerType = "mouse") {
    release(target, press(target, { pointerType }), { pointerType })
}
function swipe(target: Element, dx: number) {
    const id = press(target, { x: 200, pointerType: "touch" })
    fireEvent.pointerMove(target, {
        pointerId: id,
        clientX: 200 + dx / 2,
        clientY: 101,
        pointerType: "touch",
    })
    release(target, id, { x: 200 + dx, y: 103, pointerType: "touch" })
}

beforeEach(() => {
    installBrowserStubs()
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("ComposedFace", () => {
    it("starts as a blank surface", () => {
        const { surface } = renderFace(BLANK_FACE, "Nothing here yet.")
        expect(surface).toHaveTextContent("Nothing here yet.")
        expect(surface.querySelectorAll(".nf-piece")).toHaveLength(0)
    })

    it("builds every piece from the package's parts, on the shared session", () => {
        const { surface } = renderFace(face([...PIECE_ORDER]))
        expect(surface.querySelectorAll(".nf-piece")).toHaveLength(PIECE_ORDER.length)
        const view = within(surface)
        expect(view.getByRole("img", { name: "Artwork for First Light" })).toBeInTheDocument()
        expect(view.getAllByRole("button", { name: "Play" }).length).toBeGreaterThanOrEqual(2)
        expect(view.getByRole("button", { name: "Next track" })).toBeEnabled()
        expect(view.getByRole("button", { name: "Shuffle" })).toHaveAttribute(
            "aria-pressed",
            "false"
        )
        expect(view.getByRole("button", { name: "Repeat: off" })).toBeInTheDocument()
        expect(view.getByRole("button", { name: "More options" })).toBeInTheDocument()
        expect(view.getByRole("status")).toHaveTextContent("Track 1 of 3")
        expect(view.getByRole("button", { name: /Up next/ })).toHaveTextContent(
            "Second Wind — SEIHouse"
        )
        expect(view.getByText("Your words here")).toBeInTheDocument()
    })

    it("turns the layout and theme into classes and the package's color properties", () => {
        const spec = setLayout(face(["title"]), { direction: "row", shape: "pill", theme: "green" })
        const { surface } = renderFace(spec)
        expect(surface).toHaveClass("nf-surface--row", "nf-shape--pill", "nf-bg--glass")
        expect(surface.style.getPropertyValue("--ap-accent")).toBe(themeFor("green").accentColor)
    })

    it("plays on a tap of the surface, while its buttons keep their own clicks", () => {
        const { surface, onInteraction } = renderFace(face(["artwork", "play"], { tap: "toggle" }))
        tap(screen.getByRole("img", { name: /Artwork/ }))
        expect(onInteraction).toHaveBeenCalledWith("Tap → play / pause")

        onInteraction.mockClear()
        tap(within(surface).getByRole("button", { name: /Play|Pause/ }))
        expect(onInteraction).not.toHaveBeenCalled()
    })

    it("changes tracks with a sideways swipe", () => {
        const { surface, onInteraction } = renderFace(face(["title"], { swipe: "tracks" }))
        swipe(surface, -120)
        expect(onInteraction).toHaveBeenLastCalledWith("Swipe left → next track")
        expect(surface).toHaveTextContent("Second Wind")
        swipe(surface, 120)
        expect(onInteraction).toHaveBeenLastCalledWith("Swipe right → previous track")
        expect(surface).toHaveTextContent("First Light")
        // A mostly vertical drag is a scroll, not a swipe.
        const id = press(surface, { x: 200, y: 100, pointerType: "touch" })
        release(surface, id, { x: 140, y: 260, pointerType: "touch" })
        expect(onInteraction).toHaveBeenCalledTimes(2)
    })

    it("opens the controller on a long-press, without also counting a tap", () => {
        vi.useFakeTimers()
        const { surface, onInteraction, onOpenController } = renderFace(
            face(["title"], { longPress: "controller", tap: "toggle" })
        )
        const id = press(surface)
        act(() => {
            vi.advanceTimersByTime(600)
        })
        release(surface, id)
        expect(onOpenController).toHaveBeenCalledWith("options")
        expect(onInteraction).toHaveBeenCalledTimes(1)
        expect(onInteraction).toHaveBeenCalledWith("Long-press → open the controller")
    })

    it("tells one tap from two", () => {
        vi.useFakeTimers()
        const { surface, onInteraction } = renderFace(
            face(["title"], { tap: "toggle", doubleTap: "next" })
        )
        tap(surface)
        act(() => {
            vi.advanceTimersByTime(100)
        })
        tap(surface)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        expect(onInteraction.mock.calls).toEqual([["Double-tap → next track"]])

        tap(surface)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        expect(onInteraction).toHaveBeenLastCalledWith("Tap → play / pause")
    })

    it("answers the keyboard while it has focus, but not from inside its controls", () => {
        const { surface, onInteraction } = renderFace(face(["play"], { keyboard: true }))
        expect(surface).toHaveAttribute("tabindex", "0")
        fireEvent.keyDown(surface, { key: " " })
        expect(onInteraction).toHaveBeenLastCalledWith("Space → play / pause")
        fireEvent.keyDown(surface, { key: "ArrowRight", shiftKey: true })
        expect(onInteraction).toHaveBeenLastCalledWith("Shift+ArrowRight → next track")
        fireEvent.keyDown(surface, { key: "m" })
        expect(onInteraction).toHaveBeenLastCalledWith("M → mute")

        onInteraction.mockClear()
        fireEvent.keyDown(within(surface).getByRole("button", { name: /Play|Pause/ }), { key: " " })
        expect(onInteraction).not.toHaveBeenCalled()
    })

    it("keeps hidden controls hidden until the first touch reveals them", () => {
        const { surface, onInteraction } = renderFace(
            face(["title", "play"], { reveal: true, tap: "toggle" })
        )
        expect(surface).toHaveClass("nf-surface--reveal")
        expect(surface.querySelector(".nf-piece--play")).toHaveClass("nf-piece--control")
        expect(surface).not.toHaveClass("is-revealed")

        tap(surface, "touch")
        expect(surface).toHaveClass("is-revealed")
        expect(onInteraction).not.toHaveBeenCalled()

        tap(surface, "touch")
        expect(onInteraction).toHaveBeenCalledWith("Tap → play / pause")
    })
})
