/**
 * ActivityLogPanel — the settings-panel UI for viewing, filtering, copying,
 * clearing, and exporting the current session's activity log.
 *
 * Renders inside the SAP Controller workspace shell. Uses VirtualList-style
 * rendering via a simple scroll-to-top-on-filter-change pattern. All actions
 * (clear, copy, export) are self-contained in this component.
 */

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import type { ChangeEvent } from "react"
import { useOptionalActivityLog } from "./useActivityLog"
import { createActivityLogStore } from "./activityLogStore"
import type {
    ActivityArea,
    ActivityEvent,
    ActivityLogApi,
    ActivityStatus,
} from "./activityTypes"
import { CheckIcon } from "../skins/icons"
import "./activity-log.css"

/* ------------------------------------------------------------------ */
/*  Filter state                                                       */
/* ------------------------------------------------------------------ */

type StatusFilter = "all" | ActivityStatus
type AreaFilter = "all" | ActivityArea

interface Filters {
    status: StatusFilter
    area: AreaFilter
    search: string
}

/* ------------------------------------------------------------------ */
/*  Area label formatting                                              */
/* ------------------------------------------------------------------ */

const AREA_LABELS: Record<ActivityArea, string> = {
    plugin: "Plugin",
    player: "Player",
    canvas: "Canvas",
    agent: "Agent",
    playback: "Playback",
    session: "Session",
    system: "System",
}

const STATUS_CLASS: Record<ActivityStatus, string> = {
    info: "al-event--info",
    warn: "al-event--warn",
    error: "al-event--error",
    success: "al-event--success",
}

const VALID_AREAS = new Set<ActivityArea>(
    Object.keys(AREA_LABELS) as ActivityArea[]
)
const VALID_STATUSES = new Set<ActivityStatus>(
    Object.keys(STATUS_CLASS) as ActivityStatus[]
)

type SafeActivityEvent = ActivityEvent & {
    area: ActivityArea
    status: ActivityStatus
    message: string
    error?: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ActivityLogPanel() {
    const contextLog = useOptionalActivityLog()
    const fallbackLogRef = useRef<ActivityLogApi | null>(null)

    if (!fallbackLogRef.current) {
        fallbackLogRef.current = createActivityLogStore()
    }

    const log = contextLog ?? fallbackLogRef.current
    const listRef = useRef<HTMLDivElement>(null)
    const [filters, setFilters] = useState<Filters>({
        status: "all",
        area: "all",
        search: "",
    })
    const [copied, setCopied] = useState(false)

    // Reset scroll to top when filters change.
    useEffect(() => {
        listRef.current?.scrollTo({ top: 0 })
    }, [filters])

    // Filtered events, newest first (the store already presents them newest first).
    const filtered = useMemo(() => {
        let result = getSafeEvents(log.events)

        if (filters.status !== "all") {
            result = result.filter((e) => e.status === filters.status)
        }
        if (filters.area !== "all") {
            result = result.filter((e) => e.area === filters.area)
        }
        if (filters.search.trim()) {
            const q = filters.search.toLowerCase()
            result = result.filter(
                (e) =>
                    e.message.toLowerCase().includes(q) ||
                    (e.error && e.error.toLowerCase().includes(q))
            )
        }
        return result
    }, [log.events, filters])

    // ---- Handlers ----

    const handleStatusChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement>) => {
            setFilters((f) => ({
                ...f,
                status: e.target.value as StatusFilter,
            }))
        },
        []
    )

    const handleAreaChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement>) => {
            setFilters((f) => ({
                ...f,
                area: e.target.value as AreaFilter,
            }))
        },
        []
    )

    const handleSearchChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setFilters((f) => ({ ...f, search: e.target.value }))
        },
        []
    )

    const handleClear = useCallback(() => {
        log.clear()
    }, [log])

    const handleCopy = useCallback(() => {
        try {
            navigator.clipboard.writeText(log.exportText()).then(
                () => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                },
                () => {
                    // Fallback: select-all-friendly
                }
            )
        } catch {
            // Clipboard API not available
        }
    }, [log])

    const handleExportJson = useCallback(() => {
        downloadLog(
            log.exportJson(),
            `activity-log-${Date.now()}.json`,
            "application/json"
        )
    }, [log])

    const handleExportText = useCallback(() => {
        downloadLog(
            log.exportText(),
            `activity-log-${Date.now()}.txt`,
            "text/plain"
        )
    }, [log])

    return (
        <div className="al">
            {/* ── Toolbar: filters + actions ── */}
            <div className="al__toolbar">
                <div className="al__filters">
                    <select
                        className="al__select"
                        value={filters.status}
                        onChange={handleStatusChange}
                        aria-label="Filter by status"
                    >
                        <option value="all">All status</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                        <option value="success">Success</option>
                    </select>

                    <select
                        className="al__select"
                        value={filters.area}
                        onChange={handleAreaChange}
                        aria-label="Filter by area"
                    >
                        <option value="all">All areas</option>
                        {(Object.keys(AREA_LABELS) as ActivityArea[]).map(
                            (area) => (
                                <option key={area} value={area}>
                                    {AREA_LABELS[area]}
                                </option>
                            )
                        )}
                    </select>

                    <input
                        className="al__search"
                        type="search"
                        placeholder="Search messages…"
                        value={filters.search}
                        onChange={handleSearchChange}
                        aria-label="Search activity log"
                    />
                </div>

                <div className="al__actions">
                    <button
                        type="button"
                        className="al__btn al__btn--copy"
                        onClick={handleCopy}
                        aria-label={copied ? "Copied" : "Copy log"}
                        title={copied ? "Copied!" : "Copy to clipboard"}
                    >
                        {copied ? <CheckIcon /> : <span className="al__icon-copy" />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                        type="button"
                        className="al__btn al__btn--export"
                        onClick={handleExportText}
                        aria-label="Export as text"
                        title="Export as .txt"
                    >
                        TXT
                    </button>
                    <button
                        type="button"
                        className="al__btn al__btn--export"
                        onClick={handleExportJson}
                        aria-label="Export as JSON"
                        title="Export as .json"
                    >
                        JSON
                    </button>
                    <button
                        type="button"
                        className="al__btn al__btn--clear"
                        onClick={handleClear}
                        aria-label="Clear log"
                        title="Clear all events"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* ── Badge ── */}
            <div className="al__badge">
                {filtered.length} / {log.count} event{log.count !== 1 ? "s" : ""}
                {filters.status !== "all" ||
                filters.area !== "all" ||
                filters.search.trim()
                    ? " (filtered)"
                    : ""}
            </div>

            {/* ── Event list ── */}
            <div className="al__list" ref={listRef}>
                {filtered.length === 0 ? (
                    <div className="al__empty">
                        {log.count === 0
                            ? "No events recorded yet."
                            : "No events match the current filters."}
                    </div>
                ) : (
                    filtered.map((event) => (
                        <ActivityEventRow key={event.id} event={event} />
                    ))
                )}
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Single event row                                                   */
/* ------------------------------------------------------------------ */

function ActivityEventRow({ event }: { event: SafeActivityEvent }) {
    const [expanded, setExpanded] = useState(false)

    const time = formatEventTime(event.timestamp)
    const statusClass = STATUS_CLASS[event.status]

    const hasDetails =
        event.details != null ||
        event.error != null ||
        event.message.length > 120

    return (
        <div
            className={`al-event ${statusClass}${expanded ? " al-event--expanded" : ""}`}
        >
            <button
                type="button"
                className="al-event__summary"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={
                    expanded
                        ? "Collapse event details"
                        : "Expand event details"
                }
            >
                <span className="al-event__time">{time}</span>
                <span className={`al-event__status al-event__status--${event.status}`}>
                    {event.status}
                </span>
                <span className="al-event__area">{AREA_LABELS[event.area]}</span>
                <span className="al-event__msg">{event.message}</span>
                {hasDetails && (
                    <span className="al-event__chevron" aria-hidden="true">
                        {expanded ? "▾" : "▸"}
                    </span>
                )}
            </button>

            {expanded && hasDetails && (
                <div className="al-event__details">
                    {event.error && (
                        <div className="al-event__detail-row">
                            <span className="al-event__detail-label">Error</span>
                            <code className="al-event__detail-val al-event__detail-val--error">
                                {event.error}
                            </code>
                        </div>
                    )}
                    {event.details && (
                        <div className="al-event__detail-row">
                            <span className="al-event__detail-label">Details</span>
                            <code className="al-event__detail-val">
                                {formatDetails(event.details)}
                            </code>
                        </div>
                    )}
                    {event.message.length > 120 && (
                        <div className="al-event__detail-row">
                            <span className="al-event__detail-label">Message</span>
                            <code className="al-event__detail-val">
                                {event.message}
                            </code>
                        </div>
                    )}
                    <div className="al-event__detail-row">
                        <span className="al-event__detail-label">ID</span>
                        <code className="al-event__detail-val">
                            #{event.id}
                        </code>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function getSafeEvents(events: readonly unknown[]): SafeActivityEvent[] {
    if (!Array.isArray(events)) return []

    return events
        .map(toSafeEvent)
        .filter((event): event is SafeActivityEvent => event != null)
}

function toSafeEvent(event: unknown): SafeActivityEvent | null {
    if (event == null || typeof event !== "object") return null

    const candidate = event as Partial<ActivityEvent>
    const area = VALID_AREAS.has(candidate.area as ActivityArea)
        ? (candidate.area as ActivityArea)
        : "system"
    const status = VALID_STATUSES.has(candidate.status as ActivityStatus)
        ? (candidate.status as ActivityStatus)
        : "warn"
    const message = String(candidate.message ?? "Malformed activity event")
    const timestamp =
        typeof candidate.timestamp === "number" &&
        Number.isFinite(candidate.timestamp)
            ? candidate.timestamp
            : Date.now()
    const id =
        typeof candidate.id === "number" && Number.isFinite(candidate.id)
            ? candidate.id
            : timestamp

    return {
        ...candidate,
        id,
        timestamp,
        area,
        status,
        message,
        error: candidate.error == null ? undefined : String(candidate.error),
    }
}

function formatEventTime(ts: number): string {
    const d = new Date(ts)
    return (
        pad2(d.getHours()) +
        ":" +
        pad2(d.getMinutes()) +
        ":" +
        pad2(d.getSeconds())
    )
}

function pad2(n: number): string {
    return n < 10 ? "0" + n : String(n)
}

function formatDetails(details: unknown): string {
    try {
        return JSON.stringify(details, null, 2)
    } catch {
        return String(details)
    }
}

function downloadLog(content: string, filename: string, mime: string): void {
    try {
        const blob = new Blob([content], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    } catch {
        // Download failed silently — never crash.
    }
}