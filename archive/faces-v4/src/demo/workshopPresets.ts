import type { WorkshopFaceId, WorkshopSettings } from "./workshopFaces"

/* Local-only preset system: customize a face, save it, reload it, keep
   experimenting. localStorage is the whole backend on purpose. */
export interface WorkshopPreset {
    name: string
    faceId: WorkshopFaceId
    settings: WorkshopSettings
    /** Registry entry ids (e.g. "keyboard-shortcuts") active when saved. */
    enabledPlugins: string[]
    timestamp: number
}

const STORAGE_KEY = "seihouse-audio-player:workshop-presets:v1"

function isPreset(value: unknown): value is WorkshopPreset {
    if (typeof value !== "object" || value === null) return false
    const p = value as Record<string, unknown>
    return (
        typeof p.name === "string" &&
        typeof p.faceId === "string" &&
        typeof p.settings === "object" &&
        p.settings !== null &&
        Array.isArray(p.enabledPlugins) &&
        typeof p.timestamp === "number"
    )
}

export function loadPresets(): WorkshopPreset[] {
    // Even `typeof localStorage` can throw (SecurityError) when storage is
    // disabled, so the whole access lives inside the try.
    try {
        if (typeof localStorage === "undefined") return []
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isPreset)
    } catch {
        // Corrupt or inaccessible storage must never break the Workshop.
        return []
    }
}

function writePresets(presets: WorkshopPreset[]): WorkshopPreset[] {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
        }
    } catch {
        // Quota/private-mode/disabled-storage failures: keep the in-memory
        // list usable.
    }
    return presets
}

/** Saves (or overwrites by name) and returns the fresh list. */
export function savePreset(preset: WorkshopPreset): WorkshopPreset[] {
    const others = loadPresets().filter((p) => p.name !== preset.name)
    return writePresets([...others, preset].sort((a, b) => b.timestamp - a.timestamp))
}

export function deletePreset(name: string): WorkshopPreset[] {
    return writePresets(loadPresets().filter((p) => p.name !== name))
}
