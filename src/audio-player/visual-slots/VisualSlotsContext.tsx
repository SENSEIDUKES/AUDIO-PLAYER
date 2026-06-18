import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { BUILTIN_VISUAL_COMPONENTS } from "./builtins"
import {
    getAllVisualComponents,
    getDefaultComponentForSlot,
    registerVisualComponent,
} from "./visualRegistry"
import type { VisualSlot } from "./types"

// Register the built-ins once, at module load, so the registry is populated
// before any provider seeds its state or any renderer reads the active slot.
for (const def of BUILTIN_VISUAL_COMPONENTS) registerVisualComponent(def)

// A stable empty object, returned in place of `{}` literals so callers that key
// off referential identity (memoization, dependency arrays) don't see a "change"
// on every call when there's genuinely nothing to report.
const EMPTY_OBJECT: Record<string, unknown> = {}

/** The per-player visual-slot store exposed through context. */
export interface VisualSlotsContextValue {
    /** The active component id for a slot (or null when none is active). */
    getActive: (slot: VisualSlot) => string | null
    /** Set (or clear, with null) the active component for a slot. */
    setActive: (slot: VisualSlot, id: string | null) => void
    /** Current settings for a component id (falls back to its defaults). */
    getSettings: (id: string) => Record<string, unknown>
    /** Merge a partial settings update for a component id. */
    updateSettings: (id: string, partial: Record<string, unknown>) => void
}

/** Seed `activeBySlot` from the registry default for each slot. */
function seedActive(): Record<string, string | null> {
    const slots: VisualSlot[] = ["seiCanvas", "scrubberCanvas", "controllerPanel"]
    const out: Record<string, string | null> = {}
    for (const slot of slots) {
        out[slot] = getDefaultComponentForSlot(slot)?.id ?? null
    }
    return out
}

/** Seed `settingsById` from every registered component's defaultSettings. */
function seedSettings(): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {}
    for (const def of getAllVisualComponents()) {
        out[def.id] = { ...(def.defaultSettings as Record<string, unknown>) }
    }
    return out
}

const VisualSlotsContext = createContext<VisualSlotsContextValue | null>(null)

export interface VisualSlotsProviderProps {
    children: ReactNode
}

/**
 * Holds the active component per slot and the live settings per component for a
 * single player instance. Mounted inside each skin so the state reaches both the
 * SEI Canvas (player stage) and the settings panel (rendered through the
 * SAPController portal) — React context flows through portals.
 */
export function VisualSlotsProvider({ children }: VisualSlotsProviderProps) {
    const [activeBySlot, setActiveBySlot] = useState<Record<string, string | null>>(
        seedActive
    )
    const [settingsById, setSettingsById] = useState<
        Record<string, Record<string, unknown>>
    >(seedSettings)

    const getActive = useCallback(
        (slot: VisualSlot) => activeBySlot[slot] ?? null,
        [activeBySlot]
    )

    const setActive = useCallback((slot: VisualSlot, id: string | null) => {
        setActiveBySlot((prev) => ({ ...prev, [slot]: id }))
    }, [])

    const getSettings = useCallback(
        (id: string): Record<string, unknown> =>
            settingsById[id] ?? getDefaultsFor(id) ?? EMPTY_OBJECT,
        [settingsById]
    )

    const updateSettings = useCallback(
        (id: string, partial: Record<string, unknown>) => {
            setSettingsById((prev) => {
                const base = prev[id] ?? getDefaultsFor(id) ?? {}
                return { ...prev, [id]: { ...base, ...partial } }
            })
        },
        []
    )

    const value = useMemo<VisualSlotsContextValue>(
        () => ({ getActive, setActive, getSettings, updateSettings }),
        [getActive, setActive, getSettings, updateSettings]
    )

    return (
        <VisualSlotsContext.Provider value={value}>
            {children}
        </VisualSlotsContext.Provider>
    )
}

// Caches the spread-copy of each component's defaultSettings by id, so repeated
// lookups (e.g. from getSettings on every render) return the same reference
// instead of a fresh object each time.
const defaultsCache = new Map<string, Record<string, unknown>>()

/** Defaults lookup that tolerates components registered after seeding. */
function getDefaultsFor(id: string): Record<string, unknown> | undefined {
    const cached = defaultsCache.get(id)
    if (cached) return cached

    for (const def of getAllVisualComponents()) {
        if (def.id === id) {
            const defaults = { ...(def.defaultSettings as Record<string, unknown>) }
            defaultsCache.set(id, defaults)
            return defaults
        }
    }
    return undefined
}

/**
 * A read-only fallback used when no {@link VisualSlotsProvider} is mounted, so
 * the renderers still show registry defaults (and settings edits become no-ops)
 * rather than crashing. The skins always provide a real context.
 */
const FALLBACK: VisualSlotsContextValue = {
    getActive: (slot) => getDefaultComponentForSlot(slot)?.id ?? null,
    setActive: () => {},
    getSettings: (id) => getDefaultsFor(id) ?? EMPTY_OBJECT,
    updateSettings: () => {},
}

/** Access the per-player visual-slot store (or the read-only fallback). */
export function useVisualSlots(): VisualSlotsContextValue {
    return useContext(VisualSlotsContext) ?? FALLBACK
}
