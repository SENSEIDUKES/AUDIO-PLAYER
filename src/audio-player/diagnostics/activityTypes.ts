/**
 * Activity Log — lightweight lifecycle event recording for the audio player.
 */
export type ActivityArea =
    | "plugin"
    | "player"
    | "canvas"
    | "agent"
    | "playback"
    | "session"
    | "system"

export type ActivityStatus = "info" | "warn" | "error" | "success"

export interface ActivityEvent {
    id: number
    timestamp: number
    area: ActivityArea
    status: ActivityStatus
    message: string
    details?: Record<string, unknown>
    error?: string
}

export interface ActivityLogEntry {
    area: ActivityArea
    status: ActivityStatus
    message: string
    details?: Record<string, unknown>
    error?: string
}

export interface ActivityLogConfig {
    maxEntries: number
}

export const DEFAULT_ACTIVITY_LOG_CONFIG: ActivityLogConfig = {
    maxEntries: 200,
}

export interface ActivityLogApi {
    /** Record a new event. Always non-blocking — never throws. */
    record: (entry: ActivityLogEntry) => void
    /** All current events, oldest first. Consumers can reverse for newest-first views. */
    events: readonly ActivityEvent[]
    /** Clear all events from the current session. */
    clear: () => void
    /** Export events as a JSON string. */
    exportJson: () => string
    /** Export events as a plain-text log (one line per event). */
    exportText: () => string
    /** Total capacity of the log. */
    maxEntries: number
    /** Current number of events stored. */
    count: number
    /** Subscribe to store changes. */
    subscribe: (listener: () => void) => () => void
}
