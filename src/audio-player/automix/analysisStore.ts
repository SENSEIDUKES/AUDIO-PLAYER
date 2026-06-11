import type { TrackAnalysis } from "../types"

/**
 * Best-effort IndexedDB persistence for Automix Pro analyses. Rhythm
 * extraction costs a download, a decode, and seconds of WASM CPU while the
 * result is ~1KB of JSON, so caching across page loads is a large win.
 *
 * Every operation swallows its errors and degrades to a miss/no-op: private
 * browsing modes, quota pressure, or a missing IndexedDB simply behave like
 * the in-memory-only world.
 */

const DB_NAME = "sap-automix"
const STORE_NAME = "analysis"
/** Bump to invalidate stored results when the analysis pipeline changes. */
export const ANALYSIS_VERSION = 1

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve) => {
        if (typeof indexedDB === "undefined") return resolve(null)
        try {
            const request = indexedDB.open(DB_NAME, 1)
            request.onupgradeneeded = () => {
                try {
                    request.result.createObjectStore(STORE_NAME)
                } catch {
                    // A failed upgrade surfaces through onerror below.
                }
            }
            request.onsuccess = () => resolve(request.result)
            request.onerror = (event) => {
                // Unhandled IDB request errors bubble to window; swallow them.
                event.preventDefault()
                resolve(null)
            }
            request.onblocked = () => resolve(null)
        } catch {
            resolve(null)
        }
    })
    return dbPromise
}

function storageKey(trackKey: string): string {
    return `${ANALYSIS_VERSION}:${trackKey}`
}

export async function readStoredAnalysis(trackKey: string): Promise<TrackAnalysis | null> {
    const db = await openDb()
    if (!db) return null
    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(STORE_NAME, "readonly")
            transaction.onerror = (event) => event.preventDefault()
            const request = transaction.objectStore(STORE_NAME).get(storageKey(trackKey))
            request.onsuccess = () => {
                const value = request.result as TrackAnalysis | undefined
                resolve(value && typeof value === "object" ? value : null)
            }
            request.onerror = (event) => {
                event.preventDefault()
                resolve(null)
            }
        } catch {
            resolve(null)
        }
    })
}

export async function writeStoredAnalysis(
    trackKey: string,
    analysis: TrackAnalysis
): Promise<void> {
    const db = await openDb()
    if (!db) return
    try {
        const transaction = db.transaction(STORE_NAME, "readwrite")
        transaction.onerror = (event) => event.preventDefault()
        transaction.objectStore(STORE_NAME).put(analysis, storageKey(trackKey))
    } catch {
        // Persistence is opportunistic; the in-memory cache still has it.
    }
}
