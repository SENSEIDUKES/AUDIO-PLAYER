import type { RepeatMode } from "../../../audio-player"
import { isTrackSetId } from "../../data"
import type { TrackSetId } from "../../data"

/* The Mix & Match Lab's whole state, as one serializable object. It lives in
   the URL (so every combination is a link) and is handed to each preview page
   through its <iframe> src. Scenario presets set sensible starting points; any
   field can then be changed on its own. */

export type Scenario = "free" | "mobile" | "errors" | "stress" | "playback"
export type ViewportId = "fill" | "320" | "375" | "390" | "430" | "768" | "1280" | "matrix"
export type ContextId = "shell" | "marketplace" | "vault" | "reader" | "phone" | "states" | "bare"
export type MainFace = "full-card" | "portable" | "sea-grid" | "vault-list" | "narrative" | "none"
export type LabPluginId =
    "keyboard" | "analytics" | "lyrics" | "sleep" | "theme" | "waveform" | "automix"
export type LabThemeId = "purple" | "green" | "glass" | "red"
export type LabBackend = "html5" | "webaudio"
export type LabPolicy = "stop" | "skip"

export interface LabConfig {
    scenario: Scenario
    viewport: ViewportId
    context: ContextId
    main: MainFace
    sidebar: boolean
    bar: boolean
    tracks: TrackSetId
    plugins: LabPluginId[]
    waveform: boolean
    automix: boolean
    shuffle: boolean
    repeat: RepeatMode
    backend: LabBackend
    policy: LabPolicy
    theme: LabThemeId
}

export interface ViewportPreset {
    id: ViewportId
    label: string
    width: number | null
    height: number
}

export const VIEWPORTS: readonly ViewportPreset[] = [
    { id: "fill", label: "Fill", width: null, height: 760 },
    { id: "320", label: "320", width: 320, height: 568 },
    { id: "375", label: "375", width: 375, height: 667 },
    { id: "390", label: "390", width: 390, height: 844 },
    { id: "430", label: "430", width: 430, height: 932 },
    { id: "768", label: "Tablet", width: 768, height: 1024 },
    { id: "1280", label: "Desktop", width: 1280, height: 800 },
    { id: "matrix", label: "Matrix", width: null, height: 667 },
]

/** The four phone widths the matrix renders side by side. */
export const MATRIX_WIDTHS = [320, 375, 390, 430] as const

export interface ContextDefinition {
    label: string
    description: string
    /** Faces this context can place in its main area (first is the default). */
    mains: readonly MainFace[]
    /** Whether the context has a sidebar slot for the mini player. */
    sidebar: boolean
    /** Whether the context has a persistent bottom-bar slot. */
    bar: boolean
}

export const CONTEXTS: Record<ContextId, ContextDefinition> = {
    shell: {
        label: "App shell",
        description:
            "The UI repo's app shell: sticky header, sidebar navigation (bottom navigation on phones), a scrolling main area, and a footer bar.",
        mains: ["full-card", "portable", "sea-grid", "vault-list", "narrative", "none"],
        sidebar: true,
        bar: true,
    },
    marketplace: {
        label: "Marketplace grid",
        description: "Priced release cards in a responsive grid, with a pinned bottom bar.",
        mains: ["sea-grid", "portable"],
        sidebar: false,
        bar: true,
    },
    vault: {
        label: "Vault dashboard",
        description: "The app shell holding a Vault catalog list and a now-playing widget.",
        mains: ["vault-list"],
        sidebar: true,
        bar: true,
    },
    reader: {
        label: "Reader chapter",
        description:
            "A long chapter that scrolls under the narrative overlay or a pinned bar — the SEN reading situation.",
        mains: ["narrative", "none"],
        sidebar: false,
        bar: true,
    },
    phone: {
        label: "Now playing screen",
        description: "A full-screen phone player over the release art.",
        mains: ["portable", "full-card"],
        sidebar: false,
        bar: false,
    },
    states: {
        label: "Error state board",
        description:
            "One panel per failure: broken URL, missing audio, a mixed playlist, fallback recovery, and the skip policy.",
        mains: [],
        sidebar: false,
        bar: false,
    },
    bare: {
        label: "Bare canvas",
        description: "Just the chosen face, centered, for isolating a problem.",
        mains: ["full-card", "portable", "sea-grid", "vault-list", "narrative"],
        sidebar: false,
        bar: true,
    },
}

export const MAIN_FACE_LABELS: Record<MainFace, string> = {
    "full-card": "FullCardPlayer",
    portable: "Portable AudioPlayer",
    "sea-grid": "SeaCardPlayer grid",
    "vault-list": "VaultRowPlayer list",
    narrative: "NarrativeFace",
    none: "No player",
}

export const PLUGIN_LABELS: Record<LabPluginId, string> = {
    keyboard: "Keyboard shortcuts",
    analytics: "Analytics",
    lyrics: "Lyrics sync",
    sleep: "Sleep timer",
    theme: "Auto Theme",
    waveform: "Waveform",
    automix: "Automix Pro",
}

export const SCENARIO_LABELS: Record<Scenario, string> = {
    free: "Free play",
    mobile: "Mobile",
    errors: "Errors",
    stress: "Stress",
    playback: "Playback",
}

const BASE: LabConfig = {
    scenario: "free",
    viewport: "fill",
    context: "shell",
    main: "full-card",
    sidebar: true,
    bar: true,
    tracks: "no-luck",
    plugins: [],
    waveform: false,
    automix: false,
    shuffle: false,
    repeat: "off",
    backend: "html5",
    policy: "stop",
    theme: "purple",
}

export const SCENARIO_PRESETS: Record<Scenario, LabConfig> = {
    free: BASE,
    mobile: { ...BASE, scenario: "mobile", viewport: "375", tracks: "long" },
    errors: {
        ...BASE,
        scenario: "errors",
        context: "states",
        main: "full-card",
        sidebar: false,
        bar: false,
    },
    stress: { ...BASE, scenario: "stress", context: "bare", tracks: "sample", repeat: "all" },
    playback: {
        ...BASE,
        scenario: "playback",
        viewport: "1280",
        plugins: ["keyboard", "lyrics"],
        repeat: "all",
    },
}

/* ----------------------------- URL codec ----------------------------- */

const SCENARIOS = Object.keys(SCENARIO_LABELS) as Scenario[]
const VIEWPORT_IDS = VIEWPORTS.map((v) => v.id)
const CONTEXT_IDS = Object.keys(CONTEXTS) as ContextId[]
const MAIN_FACES = Object.keys(MAIN_FACE_LABELS) as MainFace[]
const PLUGIN_IDS = Object.keys(PLUGIN_LABELS) as LabPluginId[]
const THEMES: readonly LabThemeId[] = ["purple", "green", "glass", "red"]
const REPEATS: readonly RepeatMode[] = ["off", "all", "one"]

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
    return value !== null && (allowed as readonly string[]).includes(value)
        ? (value as T)
        : fallback
}

function flag(value: string | null, fallback: boolean): boolean {
    if (value === "1") return true
    if (value === "0") return false
    return fallback
}

/** Keep the chosen faces valid for the chosen context. */
export function normalizeLabConfig(config: LabConfig): LabConfig {
    const context = CONTEXTS[config.context]
    const main =
        context.mains.length === 0 || context.mains.includes(config.main)
            ? config.main
            : context.mains[0]
    return { ...config, main }
}

export function parseLabConfig(params: URLSearchParams): LabConfig {
    const scenario = pick(params.get("scenario"), SCENARIOS, "free")
    const preset = SCENARIO_PRESETS[scenario]
    const tracksParam = params.get("tracks")
    const pluginsParam = params.get("plugins")
    return normalizeLabConfig({
        scenario,
        viewport: pick(params.get("viewport"), VIEWPORT_IDS, preset.viewport),
        context: pick(params.get("context"), CONTEXT_IDS, preset.context),
        main: pick(params.get("main"), MAIN_FACES, preset.main),
        sidebar: flag(params.get("sidebar"), preset.sidebar),
        bar: flag(params.get("bar"), preset.bar),
        tracks: tracksParam !== null && isTrackSetId(tracksParam) ? tracksParam : preset.tracks,
        plugins:
            pluginsParam === null
                ? [...preset.plugins]
                : pluginsParam
                      .split(",")
                      .filter((id): id is LabPluginId => (PLUGIN_IDS as string[]).includes(id)),
        waveform: flag(params.get("waveform"), preset.waveform),
        automix: flag(params.get("automix"), preset.automix),
        shuffle: flag(params.get("shuffle"), preset.shuffle),
        repeat: pick(params.get("repeat"), REPEATS, preset.repeat),
        backend: pick(params.get("backend"), ["html5", "webaudio"] as const, preset.backend),
        policy: pick(params.get("policy"), ["stop", "skip"] as const, preset.policy),
        theme: pick(params.get("theme"), THEMES, preset.theme),
    })
}

type Field = Exclude<keyof LabConfig, "scenario">

const FIELDS: readonly Field[] = [
    "viewport",
    "context",
    "main",
    "sidebar",
    "bar",
    "tracks",
    "plugins",
    "waveform",
    "automix",
    "shuffle",
    "repeat",
    "backend",
    "policy",
    "theme",
]

function encode(value: LabConfig[Field]): string {
    if (typeof value === "boolean") return value ? "1" : "0"
    if (Array.isArray(value)) return value.join(",")
    return String(value)
}

/**
 * Params for a config: the scenario plus only the fields that differ from that
 * scenario's preset, so links stay short. `omit` drops fields (the preview
 * page never needs the viewport — resizing must not reload it).
 */
export function serializeLabConfig(
    config: LabConfig,
    { omit = [] }: { omit?: readonly Field[] } = {}
): URLSearchParams {
    const params = new URLSearchParams()
    if (config.scenario !== "free") params.set("scenario", config.scenario)
    const preset = SCENARIO_PRESETS[config.scenario]
    for (const field of FIELDS) {
        if (omit.includes(field)) continue
        const value = encode(config[field])
        if (value !== encode(preset[field])) params.set(field, value)
    }
    return params
}

/** The preview page URL for one frame of the lab. */
export function frameSrc(config: LabConfig, frameId: string, reloadToken = 0): string {
    const params = serializeLabConfig(config, { omit: ["viewport"] })
    params.set("frame", "lab")
    params.set("fid", frameId)
    if (reloadToken) params.set("r", String(reloadToken))
    return `?${params.toString()}`
}
