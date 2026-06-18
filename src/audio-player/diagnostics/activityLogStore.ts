/**
 * Activity Log Store — a lightweight, bounded, non-blocking buffer for
 * lifecycle events. Designed to be safe to call from anywhere without ever
 * throwing or crashing playback.
 *
 * The store is a bounded synchronous buffer with O(1) append and O(n) trim
 * when capacity is exceeded. That trim cost is acceptable for the small,
 * bounded default capacity. Exports are O(n) but user-initiated, not hot-path.
 */

import type {
    ActivityEvent,
    ActivityLogApi,
    ActivityLogConfig,
    ActivityLogEntry,
} from "./activityTypes"
import { DEFAULT_ACTIVITY_LOG_CONFIG } from "./activityTypes"

/** Create a standalone activity log store. */
export function createActivityLogStore(
    config?: Partial<ActivityLogConfig>
): ActivityLogApi {
    const { maxEntries } = { ...DEFAULT_ACTIVITY_LOG_CONFIG, ...config }
    const buffer: ActivityEvent[] = []
    const listeners = new Set<() => void>()
    let nextId = 1
    let snapshot: readonly ActivityEvent[] = []

    function publish(): void {
        snapshot = [...buffer]
        listeners.forEach((listener) => listener())
    }

    function subscribe(listener: () => void): () => void {
        listeners.add(listener)
        return () => listeners.delete(listener)
    }

    function record(entry: ActivityLogEntry): void {
        try {
            const event: ActivityEvent = {
                id: nextId++,
                timestamp: Date.now(),
                area: entry.area,
                status: entry.status,
                message: String(entry.message ?? ""),
            }
            if (entry.details != null) event.details = entry.details
            if (entry.error != null) event.error = String(entry.error)

            buffer.push(event)
            if (buffer.length > maxEntries) {
                buffer.splice(0, buffer.length - maxEntries)
            }
            publish()
        } catch {
            // Activity logging must never throw into playback paths.
        }
    }

    function clear(): void {
        buffer.length = 0
        nextId = 1
        publish()
    }

    function exportJson(): string {
        try {
            return JSON.stringify([...buffer].reverse(), null, 2)
        } catch {
            return "[]"
        }
    }

    function exportText(): string {
        try {
            return [...buffer].reverse().map(formatLine).join("\n")
        } catch {
            return ""
        }
    }

    return {
        record,
        get events() {
            return snapshot
        },
        clear,
        exportJson,
        exportText,
        maxEntries,
        get count() {
            return buffer.length
        },
        subscribe,
    }
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n)
}

function formatTimestamp(ts: number): string {
    const d = new Date(ts)
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

function formatLine(event: ActivityEvent): string {
    let line = `[${formatTimestamp(event.timestamp)}] ${event.status.padEnd(5)} ${event.area.padEnd(8)} ${event.message}`
    if (event.error) line += ` | error: ${event.error}`
    if (event.details) {
        try {
            const detailStr = JSON.stringify(event.details)
            line += ` | ${detailStr.length > 200 ? `${detailStr.slice(0, 200)}…` : detailStr}`
        } catch {
            // Skip un-stringifiable details.
        }
    }
    return line
}
