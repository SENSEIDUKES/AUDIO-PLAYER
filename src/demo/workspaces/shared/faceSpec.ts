import type { ThemeId } from "./themes"

/* A New Face composition: an ordered list of pieces on one surface, how that
   surface is laid out, and which gestures it answers to. It is plain data, so
   it can live in a link (`?face=`), a local draft, and a Testing Lab preview
   URL. Every piece is built from the package's public building blocks and reads
   the shared session, so a composed face plays exactly like a bundled one. */

export type PieceKind =
    | "artwork"
    | "title"
    | "text"
    | "play"
    | "transport"
    | "scrubber"
    | "waveform"
    | "time"
    | "volume"
    | "modes"
    | "menu"
    | "status"
    | "upnext"
    | "queue"
    | "divider"

export interface Choice<T extends string = string> {
    value: T
    label: string
}

export interface PieceOptionDefinition {
    label: string
    /** Allowed values; the first is the default. */
    values: readonly Choice[]
}

export interface PieceDefinition {
    label: string
    description: string
    /** A control: hidden until hover, focus, or tap when the surface reveals controls. */
    control: boolean
    /** Takes a full row in the row and grid layouts. */
    wide: boolean
    options: Readonly<Record<string, PieceOptionDefinition>>
}

const choices = (...pairs: [string, string][]): Choice[] =>
    pairs.map(([value, label]) => ({ value, label }))

export const PIECES: Readonly<Record<PieceKind, PieceDefinition>> = {
    artwork: {
        label: "Artwork",
        description: "The current track's cover, in any size and shape, still or moving.",
        control: false,
        wide: false,
        options: {
            size: {
                label: "Size",
                values: choices(["m", "Medium"], ["s", "Small"], ["l", "Large"], ["full", "Full"]),
            },
            shape: {
                label: "Shape",
                values: choices(["rounded", "Rounded"], ["square", "Square"], ["circle", "Circle"]),
            },
            motion: {
                label: "While playing",
                values: choices(["none", "Still"], ["pulse", "Pulse"], ["spin", "Spin"]),
            },
        },
    },
    title: {
        label: "Title & artist",
        description: "TrackMetadata in any of its four variants.",
        control: false,
        wide: false,
        options: {
            variant: {
                label: "Variant",
                values: choices(
                    ["compact", "Compact"],
                    ["hero", "Hero"],
                    ["bar", "Bar"],
                    ["row", "Row"]
                ),
            },
            align: { label: "Align", values: choices(["start", "Start"], ["center", "Center"]) },
            marquee: {
                label: "Long titles",
                values: choices(["on", "Scroll"], ["off", "Truncate"]),
            },
        },
    },
    text: {
        label: "Text",
        description: "Your own words: a kicker, a heading, or a line of copy.",
        control: false,
        wide: true,
        options: {
            style: {
                label: "Style",
                values: choices(["kicker", "Kicker"], ["heading", "Heading"], ["body", "Body"]),
            },
            align: { label: "Align", values: choices(["start", "Start"], ["center", "Center"]) },
        },
    },
    play: {
        label: "Play button",
        description: "Play and pause, with a spinner while the audio loads.",
        control: true,
        wide: false,
        options: {
            size: {
                label: "Size",
                values: choices(["m", "Medium"], ["s", "Small"], ["l", "Large"]),
            },
        },
    },
    transport: {
        label: "Transport",
        description: "Play in the middle, with track skips, 10-second jumps, or both.",
        control: true,
        wide: false,
        options: {
            skip: {
                label: "Skip buttons",
                values: choices(["tracks", "Tracks"], ["seconds", "10 seconds"], ["both", "Both"]),
            },
        },
    },
    scrubber: {
        label: "Scrubber",
        description: "The package's ProgressBar: drag, click, or use the arrow keys.",
        control: true,
        wide: true,
        options: {
            times: { label: "Times", values: choices(["on", "Show"], ["off", "Hide"]) },
        },
    },
    waveform: {
        label: "Waveform scrubber",
        description:
            "Draws the track's waveform when the audio allows it; otherwise a plain bar that still scrubs.",
        control: true,
        wide: true,
        options: {
            height: {
                label: "Height",
                values: choices(["m", "Medium"], ["s", "Small"], ["l", "Large"]),
            },
        },
    },
    time: {
        label: "Time",
        description: "Elapsed, remaining, or both.",
        control: false,
        wide: false,
        options: {
            format: {
                label: "Show",
                values: choices(
                    ["both", "Both"],
                    ["elapsed", "Elapsed"],
                    ["remaining", "Remaining"]
                ),
            },
        },
    },
    volume: {
        label: "Volume",
        description: "Mute and level (the package's VolumeControl).",
        control: true,
        wide: false,
        options: {},
    },
    modes: {
        label: "Shuffle & repeat",
        description: "Toggle shuffle and cycle repeat off, all, and one.",
        control: true,
        wide: false,
        options: {},
    },
    menu: {
        label: "Action menu",
        description: "The shared radial action menu; its settings open the SAP controller.",
        control: true,
        wide: false,
        options: {
            more: { label: "… button", values: choices(["on", "Show"], ["off", "Hide"]) },
        },
    },
    status: {
        label: "Status line",
        description: "Playing, loading, or the error with a Retry button.",
        control: false,
        wide: true,
        options: {},
    },
    upnext: {
        label: "Up next",
        description: "The next track in the queue; tap it to play.",
        control: false,
        wide: true,
        options: {},
    },
    queue: {
        label: "Queue list",
        description: "The package's QueueSurface, for faces that show their own Up Next.",
        control: false,
        wide: true,
        options: {
            rows: { label: "Rows", values: choices(["4", "4"], ["8", "8"]) },
        },
    },
    divider: {
        label: "Divider",
        description: "A line or an empty space between pieces.",
        control: false,
        wide: true,
        options: {
            style: { label: "Style", values: choices(["line", "Line"], ["space", "Space"]) },
        },
    },
}

/** Palette order: identity first, then playback, then extras. */
export const PIECE_ORDER: readonly PieceKind[] = [
    "artwork",
    "title",
    "text",
    "play",
    "transport",
    "scrubber",
    "waveform",
    "time",
    "volume",
    "modes",
    "menu",
    "status",
    "upnext",
    "queue",
    "divider",
]

export interface PieceInstance {
    id: string
    kind: PieceKind
    /** Only options that differ from the piece's defaults. */
    options: Readonly<Record<string, string>>
    /** The words of a text piece. */
    text?: string
}

export interface FaceLayout {
    direction: "stack" | "row" | "grid"
    align: "stretch" | "start" | "center" | "end"
    gap: "m" | "s" | "l"
    padding: "m" | "none" | "s" | "l"
    shape: "rounded" | "square" | "pill"
    background: "glass" | "solid" | "artwork" | "none"
    theme: ThemeId
}

export interface FaceInteractions {
    tap: "none" | "toggle" | "controller"
    doubleTap: "none" | "next" | "forward"
    swipe: "none" | "tracks" | "seek"
    longPress: "none" | "controller" | "restart"
    /** Space, arrows, Shift+arrows, and M work while the surface has focus. */
    keyboard: boolean
    /** Controls stay hidden until the surface is hovered, focused, or tapped. */
    reveal: boolean
}

export interface FaceSpec {
    pieces: readonly PieceInstance[]
    layout: FaceLayout
    interactions: FaceInteractions
}

type ChoiceField<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T]

export const LAYOUT_CHOICES: {
    [K in ChoiceField<FaceLayout>]: { label: string; values: readonly Choice<FaceLayout[K]>[] }
} = {
    direction: {
        label: "Arrangement",
        values: [
            { value: "stack", label: "Stack" },
            { value: "row", label: "Row" },
            { value: "grid", label: "Grid" },
        ],
    },
    align: {
        label: "Alignment",
        values: [
            { value: "stretch", label: "Fill" },
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
        ],
    },
    gap: {
        label: "Spacing",
        values: [
            { value: "m", label: "Medium" },
            { value: "s", label: "Tight" },
            { value: "l", label: "Loose" },
        ],
    },
    padding: {
        label: "Padding",
        values: [
            { value: "m", label: "Medium" },
            { value: "none", label: "None" },
            { value: "s", label: "Small" },
            { value: "l", label: "Large" },
        ],
    },
    shape: {
        label: "Corners",
        values: [
            { value: "rounded", label: "Rounded" },
            { value: "square", label: "Square" },
            { value: "pill", label: "Pill" },
        ],
    },
    background: {
        label: "Background",
        values: [
            { value: "glass", label: "Glass" },
            { value: "solid", label: "Solid" },
            { value: "artwork", label: "Blurred artwork" },
            { value: "none", label: "None" },
        ],
    },
    theme: {
        label: "Theme",
        values: [
            { value: "purple", label: "SEI Purple" },
            { value: "green", label: "Neon Green" },
            { value: "glass", label: "OG Glass" },
            { value: "red", label: "Error Red" },
        ],
    },
}

export const INTERACTION_CHOICES: {
    [K in ChoiceField<FaceInteractions>]: {
        label: string
        values: readonly Choice<FaceInteractions[K]>[]
    }
} = {
    tap: {
        label: "Tap the surface",
        values: [
            { value: "none", label: "Nothing" },
            { value: "toggle", label: "Play / pause" },
            { value: "controller", label: "Open controller" },
        ],
    },
    doubleTap: {
        label: "Double-tap",
        values: [
            { value: "none", label: "Nothing" },
            { value: "next", label: "Next track" },
            { value: "forward", label: "+10 seconds" },
        ],
    },
    swipe: {
        label: "Swipe sideways",
        values: [
            { value: "none", label: "Nothing" },
            { value: "tracks", label: "Change track" },
            { value: "seek", label: "Jump 10 s" },
        ],
    },
    longPress: {
        label: "Long-press",
        values: [
            { value: "none", label: "Nothing" },
            { value: "controller", label: "Open controller" },
            { value: "restart", label: "Restart track" },
        ],
    },
}

export const DEFAULT_LAYOUT: FaceLayout = {
    direction: "stack",
    align: "stretch",
    gap: "m",
    padding: "m",
    shape: "rounded",
    background: "glass",
    theme: "purple",
}

export const DEFAULT_INTERACTIONS: FaceInteractions = {
    tap: "none",
    doubleTap: "none",
    swipe: "none",
    longPress: "none",
    keyboard: false,
    reveal: false,
}

export const BLANK_FACE: FaceSpec = {
    pieces: [],
    layout: DEFAULT_LAYOUT,
    interactions: DEFAULT_INTERACTIONS,
}

export const MAX_PIECES = 24
export const MAX_TEXT = 80
export const DEFAULT_TEXT = "Your words here"

/* ----------------------------- Reading pieces ----------------------------- */

/** A piece option's current value, falling back to that option's default. */
export function pieceOption(piece: PieceInstance, key: string): string {
    const definition = PIECES[piece.kind].options[key]
    if (!definition) return ""
    const value = piece.options[key]
    return value !== undefined && definition.values.some((choice) => choice.value === value)
        ? value
        : definition.values[0].value
}

export function isBlankFace(spec: FaceSpec): boolean {
    return (
        spec.pieces.length === 0 &&
        sameFields(spec.layout, DEFAULT_LAYOUT) &&
        sameFields(spec.interactions, DEFAULT_INTERACTIONS)
    )
}

function sameFields<T extends object>(a: T, b: T): boolean {
    return (Object.keys(b) as (keyof T)[]).every((key) => a[key] === b[key])
}

/* ----------------------------- Editing ----------------------------- */

function nextPieceId(pieces: readonly PieceInstance[]): string {
    let next = 0
    for (const piece of pieces) {
        const match = /^p(\d+)$/.exec(piece.id)
        if (match) next = Math.max(next, Number(match[1]) + 1)
    }
    return `p${next}`
}

export function addPiece(spec: FaceSpec, kind: PieceKind): FaceSpec {
    if (spec.pieces.length >= MAX_PIECES) return spec
    const piece: PieceInstance = {
        id: nextPieceId(spec.pieces),
        kind,
        options: {},
        ...(kind === "text" ? { text: DEFAULT_TEXT } : {}),
    }
    return { ...spec, pieces: [...spec.pieces, piece] }
}

export function removePiece(spec: FaceSpec, id: string): FaceSpec {
    return { ...spec, pieces: spec.pieces.filter((piece) => piece.id !== id) }
}

export function movePiece(spec: FaceSpec, id: string, delta: -1 | 1): FaceSpec {
    const from = spec.pieces.findIndex((piece) => piece.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= spec.pieces.length) return spec
    const pieces = [...spec.pieces]
    const [moved] = pieces.splice(from, 1)
    pieces.splice(to, 0, moved)
    return { ...spec, pieces }
}

export function setPieceOption(spec: FaceSpec, id: string, key: string, value: string): FaceSpec {
    return {
        ...spec,
        pieces: spec.pieces.map((piece) => {
            if (piece.id !== id) return piece
            const definition = PIECES[piece.kind].options[key]
            if (!definition || !definition.values.some((choice) => choice.value === value)) {
                return piece
            }
            const options = { ...piece.options }
            if (value === definition.values[0].value) delete options[key]
            else options[key] = value
            return { ...piece, options }
        }),
    }
}

export function setPieceText(spec: FaceSpec, id: string, text: string): FaceSpec {
    return {
        ...spec,
        pieces: spec.pieces.map((piece) =>
            piece.id === id && piece.kind === "text"
                ? { ...piece, text: text.slice(0, MAX_TEXT) }
                : piece
        ),
    }
}

export function setLayout(spec: FaceSpec, patch: Partial<FaceLayout>): FaceSpec {
    return { ...spec, layout: { ...spec.layout, ...patch } }
}

export function setInteractions(spec: FaceSpec, patch: Partial<FaceInteractions>): FaceSpec {
    return { ...spec, interactions: { ...spec.interactions, ...patch } }
}

/* ----------------------------- Link codec ----------------------------- */

/* Wire format: {v:1, p:[[kind, {option: value}?, text?], …], l:{…}, i:{…}}, with
   only non-default values, as base64url JSON. Decoding is forgiving: anything
   unknown or invalid falls back to its default instead of failing the face. */

type WirePiece = [string, Record<string, string>?, string?]

interface Wire {
    v: 1
    p?: WirePiece[]
    l?: Partial<FaceLayout>
    i?: Partial<FaceInteractions>
}

function changedFields<T extends object>(value: T, defaults: T): Partial<T> | undefined {
    const changed: Partial<T> = {}
    for (const key of Object.keys(defaults) as (keyof T)[]) {
        if (value[key] !== defaults[key]) changed[key] = value[key]
    }
    return Object.keys(changed).length ? changed : undefined
}

function toBase64Url(text: string): string {
    let binary = ""
    for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): string {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

/** The link form of a face. A blank face encodes to "" so links stay clean. */
export function encodeFace(spec: FaceSpec): string {
    if (isBlankFace(spec)) return ""
    const wire: Wire = { v: 1 }
    if (spec.pieces.length) {
        wire.p = spec.pieces.map((piece): WirePiece => {
            const hasOptions = Object.keys(piece.options).length > 0
            if (piece.kind === "text") return [piece.kind, { ...piece.options }, piece.text ?? ""]
            return hasOptions ? [piece.kind, { ...piece.options }] : [piece.kind]
        })
    }
    const layout = changedFields(spec.layout, DEFAULT_LAYOUT)
    if (layout) wire.l = layout
    const interactions = changedFields(spec.interactions, DEFAULT_INTERACTIONS)
    if (interactions) wire.i = interactions
    return toBase64Url(JSON.stringify(wire))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPieceKind(value: unknown): value is PieceKind {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(PIECES, value)
}

function readChoices<T extends object>(
    raw: unknown,
    defaults: T,
    allowed: { [K in keyof T]?: { values: readonly Choice[] } }
): T {
    const result = { ...defaults }
    if (!isRecord(raw)) return result
    for (const key of Object.keys(defaults) as (keyof T)[]) {
        const value = raw[key as string]
        const field = allowed[key]
        if (field) {
            if (
                typeof value === "string" &&
                field.values.some((choice) => choice.value === value)
            ) {
                result[key] = value as T[keyof T]
            }
        } else if (typeof value === typeof defaults[key]) {
            result[key] = value as T[keyof T]
        }
    }
    return result
}

/** A piece's options with unknown keys, invalid values, and defaults removed. */
function cleanOptions(kind: PieceKind, raw: unknown): Record<string, string> {
    const options: Record<string, string> = {}
    if (!isRecord(raw)) return options
    for (const [key, value] of Object.entries(raw)) {
        const definition = PIECES[kind].options[key]
        if (
            definition &&
            typeof value === "string" &&
            value !== definition.values[0].value &&
            definition.values.some((choice) => choice.value === value)
        ) {
            options[key] = value
        }
    }
    return options
}

function readPiece(raw: unknown, index: number): PieceInstance | null {
    if (!Array.isArray(raw) || !isPieceKind(raw[0])) return null
    const kind = raw[0]
    const piece: PieceInstance = { id: `p${index}`, kind, options: cleanOptions(kind, raw[1]) }
    if (kind === "text") {
        piece.text = typeof raw[2] === "string" ? raw[2].slice(0, MAX_TEXT) : DEFAULT_TEXT
    }
    return piece
}

/** Read a face from its link form. Anything unreadable becomes the blank face. */
export function decodeFace(value: string | null | undefined): FaceSpec {
    if (!value) return BLANK_FACE
    let wire: unknown
    try {
        wire = JSON.parse(fromBase64Url(value))
    } catch {
        return BLANK_FACE
    }
    if (!isRecord(wire) || wire.v !== 1) return BLANK_FACE
    const pieces = Array.isArray(wire.p)
        ? wire.p
              .slice(0, MAX_PIECES)
              .map(readPiece)
              .filter((piece): piece is PieceInstance => piece !== null)
              .map((piece, index) => ({ ...piece, id: `p${index}` }))
        : []
    return {
        pieces,
        layout: readChoices(wire.l, DEFAULT_LAYOUT, LAYOUT_CHOICES),
        interactions: readChoices(wire.i, DEFAULT_INTERACTIONS, INTERACTION_CHOICES),
    }
}

/* ----------------------------- Starters ----------------------------- */

type StarterPiece = [PieceKind, Record<string, string>?, string?]

function compose(
    pieces: StarterPiece[],
    layout: Partial<FaceLayout> = {},
    interactions: Partial<FaceInteractions> = {}
): FaceSpec {
    return {
        pieces: pieces.map(([kind, options, text], index) => ({
            id: `p${index}`,
            kind,
            options: cleanOptions(kind, options),
            ...(kind === "text" ? { text: text ?? DEFAULT_TEXT } : {}),
        })),
        layout: { ...DEFAULT_LAYOUT, ...layout },
        interactions: { ...DEFAULT_INTERACTIONS, ...interactions },
    }
}

/** Optional starting points. The workspace itself always opens blank. */
export const STARTERS: readonly {
    id: string
    label: string
    description: string
    spec: FaceSpec
}[] = [
    {
        id: "pocket",
        label: "Pocket",
        description: "A one-line player: swipe it to change tracks.",
        spec: compose(
            [["artwork", { size: "s" }], ["title"], ["play", { size: "s" }], ["menu"]],
            { direction: "row", align: "center", shape: "pill", padding: "s" },
            { swipe: "tracks", longPress: "controller" }
        ),
    },
    {
        id: "listening-room",
        label: "Listening room",
        description: "Artwork first, a waveform, and full transport.",
        spec: compose(
            [
                ["artwork", { size: "full", motion: "pulse" }],
                ["title", { variant: "hero", align: "center" }],
                ["waveform"],
                ["transport", { skip: "both" }],
                ["volume"],
                ["upnext"],
            ],
            { align: "center", background: "artwork" },
            { doubleTap: "forward", keyboard: true }
        ),
    },
    {
        id: "sen-reader",
        label: "SEN reader",
        description: "A quiet narration bar whose controls appear when you need them.",
        spec: compose(
            [
                ["text", { style: "kicker" }, "SEN · The Archive at Night"],
                ["title", { variant: "bar" }],
                ["scrubber"],
                ["transport", { skip: "seconds" }],
                ["status"],
            ],
            { theme: "glass" },
            { tap: "toggle", longPress: "restart", reveal: true, keyboard: true }
        ),
    },
]
