/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installBrowserStubs } from "../../../workshop/__tests__/browserStubs"
import { decodeFace } from "../../shared/faceSpec"
import { NewFaceWorkspace } from "../NewFaceWorkspace"

function openNewFace(query = "") {
    window.history.replaceState(null, "", `/?workspace=new-face${query}`)
    return render(<NewFaceWorkspace />)
}

const currentFace = () => decodeFace(new URLSearchParams(window.location.search).get("face"))
const surface = () => screen.getByRole("region", { name: "New Face" })
const pieceList = () => screen.getByRole("list", { name: "Pieces on the surface" })
const add = (label: string) => fireEvent.click(screen.getByRole("button", { name: `Add ${label}` }))

beforeEach(() => {
    installBrowserStubs()
    localStorage.clear()
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    window.history.replaceState(null, "", "/")
})

describe("New Face workspace", () => {
    it("opens on a blank surface", () => {
        openNewFace()
        expect(surface()).toHaveTextContent("Blank surface")
        expect(screen.getByText("Nothing here yet.")).toBeInTheDocument()
        expect(screen.getByText("Add at least one piece, then place the face.")).toBeInTheDocument()
        expect(window.location.search).toBe("?workspace=new-face")
    })

    it("assembles, reorders, adjusts, and removes pieces, keeping the face in the link", () => {
        openNewFace()
        add("Artwork")
        add("Title & artist")
        add("Transport")
        expect(currentFace().pieces.map((piece) => piece.kind)).toEqual([
            "artwork",
            "title",
            "transport",
        ])
        expect(surface().querySelectorAll(".nf-piece")).toHaveLength(3)

        fireEvent.click(screen.getByRole("button", { name: "Move Transport (3) up" }))
        expect(currentFace().pieces.map((piece) => piece.kind)).toEqual([
            "artwork",
            "transport",
            "title",
        ])

        const artworkRow = within(pieceList()).getByRole("listitem", { name: "Artwork (1)" })
        fireEvent.change(within(artworkRow).getByLabelText("Shape"), {
            target: { value: "circle" },
        })
        expect(currentFace().pieces[0].options).toEqual({ shape: "circle" })
        expect(surface().querySelector(".nf-art")).toHaveClass("nf-art--circle")

        fireEvent.click(screen.getByRole("button", { name: "Remove Transport (2)" }))
        expect(currentFace().pieces.map((piece) => piece.kind)).toEqual(["artwork", "title"])
    })

    it("lets a text piece carry your own words", () => {
        openNewFace()
        add("Text")
        fireEvent.change(screen.getByLabelText("Words"), { target: { value: "SEN · Chapter One" } })
        expect(within(surface()).getByText("SEN · Chapter One")).toBeInTheDocument()
        expect(currentFace().pieces[0].text).toBe("SEN · Chapter One")
    })

    it("sets the surface's arrangement and gestures", () => {
        openNewFace()
        add("Play button")
        fireEvent.click(screen.getByRole("button", { name: "Row" }))
        fireEvent.change(screen.getByLabelText("Swipe sideways"), { target: { value: "tracks" } })
        fireEvent.click(screen.getByRole("switch", { name: /^Keyboard/ }))
        const face = currentFace()
        expect(face.layout.direction).toBe("row")
        expect(face.interactions.swipe).toBe("tracks")
        expect(face.interactions.keyboard).toBe(true)
        expect(surface()).toHaveClass("nf-surface--row", "nf-surface--swipe")
        expect(surface()).toHaveAttribute("tabindex", "0")
    })

    it("places the face in the Testing Lab's app shell or on a phone screen", () => {
        openNewFace("&tracks=sample")
        add("Title & artist")
        const face = new URLSearchParams(window.location.search).get("face")
        const shell = new URLSearchParams(
            (
                screen.getByRole("link", { name: /Place in the app shell/ }).getAttribute("href") ??
                ""
            ).slice(1)
        )
        expect(shell.get("workspace")).toBe("testing-lab")
        expect(shell.get("main")).toBe("custom")
        expect(shell.get("face")).toBe(face)
        expect(shell.get("tracks")).toBe("sample")

        const phone = new URLSearchParams(
            (
                screen
                    .getByRole("link", { name: /Try it on a phone screen/ })
                    .getAttribute("href") ?? ""
            ).slice(1)
        )
        expect(phone.get("context")).toBe("phone")
        expect(phone.get("viewport")).toBe("390")
        expect(phone.get("face")).toBe(face)
    })

    it("offers starters to pull apart, and a blank reset that asks first", () => {
        openNewFace()
        fireEvent.click(screen.getByRole("button", { name: /^Pocket/ }))
        expect(currentFace().pieces.length).toBeGreaterThan(0)

        const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false)
        fireEvent.click(screen.getByRole("button", { name: "Blank surface" }))
        expect(confirm).toHaveBeenCalledOnce()
        expect(currentFace().pieces.length).toBeGreaterThan(0)

        confirm.mockReturnValueOnce(true)
        fireEvent.click(screen.getByRole("button", { name: "Blank surface" }))
        expect(window.location.search).toBe("?workspace=new-face")
    })

    it("keeps your last face as a draft you can resume", () => {
        const first = openNewFace()
        add("Artwork")
        add("Status line")
        const face = new URLSearchParams(window.location.search).get("face")
        first.unmount()

        openNewFace()
        expect(surface()).toHaveTextContent("Blank surface")
        fireEvent.click(screen.getByRole("button", { name: "Resume your last face" }))
        expect(new URLSearchParams(window.location.search).get("face")).toBe(face)
        expect(surface().querySelectorAll(".nf-piece")).toHaveLength(2)
    })
})
