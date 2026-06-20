import type { PlayerFace } from "../surfaces/faceCapabilities"
import type {
    PropertyDescriptor,
    PropertyGroup,
} from "./propertyTypes"

/**
 * The shared property model. Every editable property is declared here exactly
 * once with its group, control, default, and per-face applicability. Faces and
 * the Properties panel both read this registry, so a property added here becomes
 * available everywhere a face opts into it — no per-face wiring.
 *
 * Defaults mirror the historical in-code defaults (the SEI theme + OG typography
 * the workshop has always shipped) so nothing shifts when the panel switches to
 * reading this registry.
 */

/* Typography defaults — identical to the long-standing OG_DEFAULTS fonts. */
const TITLE_FONT_DEFAULT = {
    fontSize: "24px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: "1.2em",
} as const

const ARTIST_FONT_DEFAULT = {
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    lineHeight: "1.3em",
} as const

/** Faces that render a full-bleed background layer. */
const BACKGROUND_FACES: readonly PlayerFace[] = ["portable", "fullCard"]
/** Faces that render a dedicated artwork/cover block. */
const ART_FACES: readonly PlayerFace[] = ["fullCard", "seaCard", "miniSidebar"]
/** Major full-size faces sharing the core typography + media property set. */
export const MAJOR_FACES: readonly PlayerFace[] = ["portable", "fullCard", "seaCard"]
/** Faces that surface a volume control. */
const VOLUME_FACES: readonly PlayerFace[] = ["portable", "fullCard", "stickyBottom"]

export const PROPERTY_GROUPS: readonly PropertyGroup[] = [
    "content",
    "appearance",
    "playback",
    "advanced",
]

/** Human labels for the four sections, used by the panel headers. */
export const PROPERTY_GROUP_LABELS: Record<PropertyGroup, string> = {
    content: "Content",
    appearance: "Appearance",
    playback: "Playback",
    advanced: "Advanced",
}

export const PROPERTY_REGISTRY: readonly PropertyDescriptor[] = [
    /* ----------------------------- Content ----------------------------- */
    {
        id: "backgroundMedia",
        label: "Background",
        description: "Full-bleed image or video behind the player.",
        group: "content",
        control: { kind: "media", role: "background" },
        propPath: "backgroundMedia",
        default: null,
        faces: BACKGROUND_FACES,
    },
    {
        id: "artMedia",
        label: "Cover Art",
        description: "Image or video shown in the artwork block.",
        group: "content",
        control: { kind: "media", role: "art" },
        propPath: "artMedia",
        default: null,
        faces: ART_FACES,
    },

    /* --------------------------- Appearance ---------------------------- */
    // Theme colors — every face (no `faces` = universal).
    {
        id: "accentColor",
        label: "Button Color",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.accentColor",
        default: "#7C5CFF",
    },
    {
        id: "playIconColor",
        label: "Play Icon",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.playIconColor",
        default: "#0b0b12",
    },
    {
        id: "textColor",
        label: "Text",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.textColor",
        default: "#FFFFFF",
    },
    {
        id: "progressColor",
        label: "Progress",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.progressColor",
        default: "#7C5CFF",
    },
    {
        id: "trackColor",
        label: "Track",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.trackColor",
        default: "rgba(124,92,255,0.25)",
    },
    {
        id: "backgroundColor",
        label: "Surface",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.backgroundColor",
        default: "rgba(20,20,28,0.6)",
    },
    {
        id: "glowColor",
        label: "Glow Color",
        description: "Ambient glow color around the player root. Transparent disables it.",
        group: "appearance",
        control: { kind: "color" },
        propPath: "theme.glowColor",
        default: "transparent",
    },
    {
        id: "glowIntensity",
        label: "Glow",
        description: "Ambient glow strength. 0 turns the glow off regardless of Glow Color.",
        group: "appearance",
        control: { kind: "range", min: 0, max: 150, step: 5, unit: "%" },
        propPath: "theme.glowIntensity",
        default: 100,
    },
    {
        id: "buttonOpacity",
        label: "Button Fill",
        description: "Translucency of button fills — lower is more see-through, higher is more solid.",
        group: "appearance",
        control: { kind: "range", min: -20, max: 40, step: 1, unit: "%" },
        propPath: "theme.buttonOpacity",
        default: 0,
    },
    // Background adjustments — only faces that render a background layer.
    {
        id: "blurSize",
        label: "Blur",
        group: "appearance",
        control: { kind: "range", min: 0, max: 50, step: 1, unit: "px" },
        propPath: "blurSize",
        default: 20,
        faces: BACKGROUND_FACES,
    },
    {
        id: "darkenAmount",
        label: "Darken",
        group: "appearance",
        control: { kind: "range", min: 0, max: 100, step: 1, unit: "%" },
        propPath: "darkenAmount",
        default: 45,
        faces: BACKGROUND_FACES,
    },
    // Typography — shared across the major faces.
    {
        id: "titleFont",
        label: "Title Font",
        group: "appearance",
        control: { kind: "font" },
        propPath: "titleFont",
        default: { ...TITLE_FONT_DEFAULT },
        faces: MAJOR_FACES,
    },
    {
        id: "artistFont",
        label: "Artist Font",
        group: "appearance",
        control: { kind: "font" },
        propPath: "artistFont",
        default: { ...ARTIST_FONT_DEFAULT },
        faces: MAJOR_FACES,
    },

    /* ---------------------------- Playback ----------------------------- */
    {
        id: "autoPlay",
        label: "Auto Play",
        group: "playback",
        control: { kind: "toggle" },
        propPath: "autoPlay",
        default: false,
    },
    {
        id: "shuffle",
        label: "Shuffle",
        group: "playback",
        control: { kind: "toggle" },
        propPath: "shuffle",
        default: false,
    },
    {
        id: "repeatMode",
        label: "Repeat",
        group: "playback",
        control: {
            kind: "select",
            options: [
                { value: "off", label: "Off" },
                { value: "all", label: "All" },
                { value: "one", label: "One" },
            ],
        },
        propPath: "repeatMode",
        default: "off",
    },
    {
        id: "showVolume",
        label: "Show Volume",
        group: "playback",
        control: { kind: "toggle" },
        propPath: "showVolume",
        default: true,
        faces: VOLUME_FACES,
    },
    {
        id: "showTracklist",
        label: "Show Tracklist",
        group: "playback",
        control: { kind: "toggle" },
        propPath: "showTracklist",
        default: true,
        faces: ["portable"],
    },
    {
        id: "showWaveform",
        label: "Show Waveform",
        group: "playback",
        control: { kind: "toggle" },
        propPath: "showWaveform",
        default: false,
        faces: ["portable"],
    },

    /* ---------------------------- Advanced ----------------------------- */
    {
        id: "artCss",
        label: "Art (CSS)",
        description: "Raw CSS background-image escape hatch (gradient or url).",
        group: "advanced",
        control: { kind: "text", placeholder: 'url("…") or linear-gradient(…)' },
        propPath: "art",
        default: "",
        faces: ART_FACES,
    },
]

/** All properties a face exposes, in registry order. */
export function getPropertiesForFace(face: PlayerFace): PropertyDescriptor[] {
    return PROPERTY_REGISTRY.filter((d) => !d.faces || d.faces.includes(face))
}

/** A face's properties within a single section. */
export function getPropertiesForGroup(
    face: PlayerFace,
    group: PropertyGroup
): PropertyDescriptor[] {
    return getPropertiesForFace(face).filter((d) => d.group === group)
}

/** Set a value at a dotted `propPath`, returning a new object (immutable). */
export function setByPropPath<T extends Record<string, unknown>>(
    target: T,
    propPath: string,
    value: unknown
): T {
    const keys = propPath.split(".")
    const next: Record<string, unknown> = { ...target }
    let cursor = next
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        // Guard against prototype pollution — never traverse/assign these keys.
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            return next as T
        }
        cursor[key] = { ...(cursor[key] as Record<string, unknown>) }
        cursor = cursor[key] as Record<string, unknown>
    }
    const lastKey = keys[keys.length - 1]
    if (lastKey === "__proto__" || lastKey === "constructor" || lastKey === "prototype") {
        return next as T
    }
    cursor[lastKey] = value
    return next as T
}

/** Read a value at a dotted `propPath`. */
export function getByPropPath(
    target: Record<string, unknown>,
    propPath: string
): unknown {
    return propPath
        .split(".")
        .reduce<unknown>(
            (acc, key) =>
                acc == null ? undefined : (acc as Record<string, unknown>)[key],
            target
        )
}

/**
 * A nested defaults object built from every descriptor's `default`, keyed by
 * `propPath`. Consumers (e.g. the workshop) spread this to seed their settings
 * so editor defaults always track the registry.
 */
export function getPropertyDefaults(): Record<string, unknown> {
    let acc: Record<string, unknown> = {}
    for (const d of PROPERTY_REGISTRY) {
        acc = setByPropPath(acc, d.propPath, d.default)
    }
    return acc
}
