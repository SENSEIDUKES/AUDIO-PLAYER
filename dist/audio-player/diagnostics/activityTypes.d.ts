/**
 * Activity Log — lightweight lifecycle event recording for the audio player.
 *
 * Every event is a structured log line with a category (area), severity (status),
 * a human-readable message, optional structured details, and an auto-assigned
 * timestamp. Events are bounded, non-blocking, and safe to call from anywhere.
 *
 * Areas: plugin, player, canvas, agent, playback, session, system
 * Status: info, warn, error, success
 */
/** The subsystem that generated the event. */
export type ActivityArea = "plugin" | "player" | "canvas" | "agent" | "playback" | "session" | "system";
/** Severity/status of the event. */
export type ActivityStatus = "info" | "warn" | "error" | "success";
/** A single recorded activity event. */
export interface ActivityEvent {
    /** Auto-assigned monotonic id (incrementing counter within the session). */
    id: number;
    /** Timestamp in ms when the event was recorded. */
    timestamp: number;
    /** The subsystem that generated the event. */
    area: ActivityArea;
    /** Severity level. */
    status: ActivityStatus;
    /** Human-readable summary (e.g. "Waveform failed to mount"). */
    message: string;
    /** Optional structured metadata for debugging. */
    details?: Record<string, unknown>;
    /** Optional error object for error-level events. */
    error?: string;
}
/**
 * The shape of a record call — what callers pass in. `id` and `timestamp` are
 * auto-filled by the store.
 */
export interface ActivityLogEntry {
    area: ActivityArea;
    status: ActivityStatus;
    message: string;
    details?: Record<string, unknown>;
    error?: string;
}
/** Configuration for the activity log store. */
export interface ActivityLogConfig {
    /** Maximum number of events to retain. Oldest events are dropped. Default 200. */
    maxEntries: number;
}
export declare const DEFAULT_ACTIVITY_LOG_CONFIG: ActivityLogConfig;
/** The public API the activity log exposes through context. */
export interface ActivityLogApi {
    /** Record a new event. Always non-blocking — never throws. */
    record: (entry: ActivityLogEntry) => void;
    /** All current events, newest first. */
    events: readonly ActivityEvent[];
    /** Clear all events from the current session. */
    clear: () => void;
    /** Export events as a JSON string. */
    exportJson: () => string;
    /** Export events as a plain-text log (one line per event). */
    exportText: () => string;
    /** Total capacity of the log. */
    maxEntries: number;
    /** Current number of events stored. */
    count: number;
}
//# sourceMappingURL=activityTypes.d.ts.map