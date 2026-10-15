/* Local-only MRU list of recently picked colors, shared across every color
   field in the workshop panel so a color picked for one property is one
   click away when picking another. localStorage is the whole backend. */
const STORAGE_KEY = "seihouse-audio-player:recent-colors:v1"
const MAX_RECENT = 8

type Listener = (colors: string[]) => void
const listeners = new Set<Listener>()

/** Subscribe to recent-color updates from any field; returns an unsubscribe function. */
export function subscribeRecentColors(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function getRecentColors(): string[] {
    try {
        if (typeof localStorage === "undefined") return []
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []
    } catch {
        return []
    }
}

/** Move `hex` to the front of the recent list (deduped, capped), persist, and return it. */
export function pushRecentColor(hex: string): string[] {
    const normalized = hex.trim().toLowerCase()
    const next = [normalized, ...getRecentColors().filter((c) => c !== normalized)].slice(
        0,
        MAX_RECENT
    )
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
    } catch {
        /* quota exceeded or storage disabled — recent list just won't persist */
    }
    listeners.forEach((l) => l(next))
    return next
}
