/**
 * Activity Log Store — a lightweight, bounded, non-blocking ring buffer for
 * lifecycle events. Designed to be safe to call from anywhere without ever
 * throwing or crashing playback.
 *
 * The store is a synchronous ring buffer with O(1) append/truncate. It never
 * allocates on the hot path beyond the initial buffer. Exports are O(n) but
 * are user-initiated, not hot-path.
 */

import type {
    ActivityArea,
    ActivityEvent,
    ActivityLogApi,
    ActivityLogConfig,
    ActivityLogEntry,
    ActivityStatus,
} from "./activityTypes"
import { DEFAULT_ACTIVITY_LOG_CONFIG } from "./activityTypes"

/** Create a standalone activity log store. Callers can create multiple stores
 *  (e.g. one for a session, one for a plugin) or share a single global one. */
export function createActivityLogStore(
    config?: Partial<ActivityLogConfig>
): ActivityLogApi {
    const { maxEntries } = { ...DEFAULT_ACTIVITY_LOG_CONFIG, ...config }
    const buffer: ActivityEvent[] = []
    let nextId = 1

    /** Non-blocking record. Wraps the entire operation in a try-catch so no
     *  caller ever has to worry about a bad entry crashing playback. */
    function record(entry: ActivityLogEntry): void {
        try {
            const safeEntry = normalizeEntry(entry)
            const event: ActivityEvent = {
                id: nextId++,
                timestamp: Date.now(),
                area: safeEntry.area,
                status: safeEntry.status,
                message: safeEntry.message,
            }
            if (safeEntry.details != null) event.details = safeEntry.details
            if (safeEntry.error != null) event.error = safeEntry.error

            buffer.push(event)

            // Trim oldest events when the buffer exceeds maxEntries.
            if (buffer.length > maxEntries) {
                buffer.splice(0, buffer.length - maxEntries)
            }
        } catch {
            // Silently swallow — activity logging must never throw.
        }
    }

    /** Clear all stored events. */
    function clear(): void {
        buffer.length = 0
        nextId = 1
    }

    /** Export as JSON — newest first. */
    function exportJson(): string {
        try {
            return JSON.stringify([...buffer].reverse(), null, 2)
        } catch {
            return "[]"
        }
    }

    /** Export as plain text — one line per event, newest first. */
    function exportText(): string {
        try {
            return [...buffer]
                .reverse()
                .map(formatLine)
                .join("\n")
        } catch {
            return ""
        }
    }

    return {
        record,
        get events(): readonly ActivityEvent[] {
            return buffer
        },
        clear,
        exportJson,
        exportText,
        maxEntries,
        get count(): number {
            return buffer.length
        },
    }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function pad2(n: number): string {
    return n < 10 ? "0" + n : String(n)
}

function formatTimestamp(ts: number): string {
    const d = new Date(ts)
    return (
        pad2(d.getHours()) +
        ":" +
        pad2(d.getMinutes()) +
        ":" +
        pad2(d.getSeconds()) +
        "." +
        String(d.getMilliseconds()).padStart(3, "0")
    )
}

const VALID_AREAS = new Set<ActivityArea>([
    "plugin",
    "player",
    "canvas",
    "agent",
    "playback",
    "session",
    "system",
])

const VALID_STATUSES = new Set<ActivityStatus>([
    "info",
    "warn",
    "error",
    "success",
])

function normalizeEntry(entry: ActivityLogEntry): ActivityLogEntry {
    const candidate =
        entry != null && typeof entry === "object"
            ? (entry as Partial<ActivityLogEntry>)
            : {}
    return {
        area: VALID_AREAS.has(candidate.area as ActivityArea)
            ? (candidate.area as ActivityArea)
            : "system",
        status: VALID_STATUSES.has(candidate.status as ActivityStatus)
            ? (candidate.status as ActivityStatus)
            : "warn",
        message: String(candidate.message ?? "Malformed activity event"),
        details: candidate.details,
        error: candidate.error == null ? undefined : String(candidate.error),
    }
}

const STATUS_PAD = 5 // "error".length
const AREA_PAD = 8 // "playback".length

function formatLine(event: ActivityEvent): string {
    const time = formatTimestamp(event.timestamp)
    const status = event.status.padEnd(STATUS_PAD)
    const area = event.area.padEnd(AREA_PAD)
    let line = `[${time}] ${status} ${area} ${event.message}`
    if (event.error) line += ` | error: ${event.error}`
    if (event.details) {
        try {
            const detailStr = JSON.stringify(event.details)
            if (detailStr.length > 200) {
                line += ` | ${detailStr.slice(0, 200)}…`
            } else {
                line += ` | ${detailStr}`
            }
        } catch {
            // skip un-stringifiable details
        }
    }
    return line
}