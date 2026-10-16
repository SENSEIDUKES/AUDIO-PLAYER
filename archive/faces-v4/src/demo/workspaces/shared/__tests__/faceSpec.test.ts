import { describe, expect, it } from "vitest"
import {
    BLANK_FACE,
    DEFAULT_TEXT,
    MAX_PIECES,
    MAX_TEXT,
    PIECES,
    PIECE_ORDER,
    STARTERS,
    addPiece,
    decodeFace,
    encodeFace,
    isBlankFace,
    movePiece,
    pieceOption,
    removePiece,
    setInteractions,
    setLayout,
    setPieceOption,
    setPieceText,
} from "../faceSpec"
import type { FaceSpec, PieceKind } from "../faceSpec"

function build(...kinds: PieceKind[]): FaceSpec {
    return kinds.reduce((spec, kind) => addPiece(spec, kind), BLANK_FACE)
}

const kinds = (spec: FaceSpec) => spec.pieces.map((piece) => piece.kind)

describe("New Face compositions", () => {
    it("start blank, and a blank face keeps links clean", () => {
        expect(BLANK_FACE.pieces).toEqual([])
        expect(isBlankFace(BLANK_FACE)).toBe(true)
        expect(encodeFace(BLANK_FACE)).toBe("")
        expect(decodeFace("")).toEqual(BLANK_FACE)
        expect(decodeFace(null)).toEqual(BLANK_FACE)
    })

    it("offers every piece in the palette exactly once", () => {
        expect([...PIECE_ORDER].sort()).toEqual(Object.keys(PIECES).sort())
    })

    it("adds, reorders, and removes pieces", () => {
        let spec = build("artwork", "title", "play")
        expect(kinds(spec)).toEqual(["artwork", "title", "play"])
        expect(new Set(spec.pieces.map((piece) => piece.id)).size).toBe(3)

        spec = movePiece(spec, spec.pieces[2].id, -1)
        expect(kinds(spec)).toEqual(["artwork", "play", "title"])
        expect(movePiece(spec, spec.pieces[0].id, -1)).toBe(spec)

        spec = removePiece(spec, spec.pieces[0].id)
        expect(kinds(spec)).toEqual(["play", "title"])
        // New pieces never reuse a live id.
        const ids = addPiece(spec, "divider").pieces.map((piece) => piece.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("stops adding at the piece limit", () => {
        let spec = BLANK_FACE
        for (let i = 0; i < MAX_PIECES + 3; i += 1) spec = addPiece(spec, "divider")
        expect(spec.pieces).toHaveLength(MAX_PIECES)
    })

    it("keeps only valid piece options, and drops defaults", () => {
        let spec = build("artwork")
        const id = spec.pieces[0].id
        expect(pieceOption(spec.pieces[0], "size")).toBe("m")

        spec = setPieceOption(spec, id, "size", "full")
        expect(pieceOption(spec.pieces[0], "size")).toBe("full")
        expect(setPieceOption(spec, id, "size", "gigantic")).toEqual(spec)
        expect(setPieceOption(spec, id, "volume", "11")).toEqual(spec)

        spec = setPieceOption(spec, id, "size", "m")
        expect(spec.pieces[0].options).toEqual({})
    })

    it("gives text pieces their own words, within a limit", () => {
        let spec = build("text", "title")
        expect(spec.pieces[0].text).toBe(DEFAULT_TEXT)
        spec = setPieceText(spec, spec.pieces[0].id, "x".repeat(MAX_TEXT + 20))
        expect(spec.pieces[0].text).toHaveLength(MAX_TEXT)
        expect(setPieceText(spec, spec.pieces[1].id, "nope").pieces[1].text).toBeUndefined()
    })

    it("round-trips any composition through its link", () => {
        let spec = build("text", "artwork", "waveform", "transport", "menu")
        spec = setPieceText(spec, spec.pieces[0].id, "SEN · 夜の図書館 ✦")
        spec = setPieceOption(spec, spec.pieces[1].id, "shape", "circle")
        spec = setPieceOption(spec, spec.pieces[3].id, "skip", "both")
        spec = setLayout(spec, { direction: "grid", background: "artwork", theme: "green" })
        spec = setInteractions(spec, { swipe: "seek", longPress: "restart", keyboard: true })

        const link = encodeFace(spec)
        expect(link).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(decodeFace(link)).toEqual(spec)
    })

    it("reads damaged or foreign links as safely as it can", () => {
        expect(decodeFace("not base64 at all!")).toEqual(BLANK_FACE)
        const foreign = btoa(JSON.stringify({ v: 2, p: [["play"]] }))
        expect(decodeFace(foreign)).toEqual(BLANK_FACE)

        const damaged = btoa(
            JSON.stringify({
                v: 1,
                p: [["play", { size: "huge" }], ["hologram"], ["artwork", { size: "s", x: "1" }]],
                l: { direction: "spiral", theme: "red" },
                i: { tap: "explode", keyboard: "yes", reveal: true },
            })
        )
        const face = decodeFace(damaged)
        expect(kinds(face)).toEqual(["play", "artwork"])
        expect(face.pieces[0].options).toEqual({})
        expect(face.pieces[1].options).toEqual({ size: "s" })
        expect(face.layout.direction).toBe("stack")
        expect(face.layout.theme).toBe("red")
        expect(face.interactions.tap).toBe("none")
        expect(face.interactions.keyboard).toBe(false)
        expect(face.interactions.reveal).toBe(true)
    })

    it("ships starters that are ordinary compositions", () => {
        expect(STARTERS.length).toBeGreaterThan(0)
        for (const starter of STARTERS) {
            expect(starter.spec.pieces.length).toBeGreaterThan(0)
            expect(decodeFace(encodeFace(starter.spec))).toEqual(starter.spec)
        }
    })
})
