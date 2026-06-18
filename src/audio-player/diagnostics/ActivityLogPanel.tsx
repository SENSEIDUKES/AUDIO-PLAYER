import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { CheckIcon } from "../skins/icons"
import type { ActivityArea, ActivityEvent, ActivityStatus } from "./activityTypes"
import { useActivityLog } from "./useActivityLog"
import "./activity-log.css"

type StatusFilter = "all" | ActivityStatus
type AreaFilter = "all" | ActivityArea

interface Filters {
    status: StatusFilter
    area: AreaFilter
    search: string
}

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
    info: "al-event__status--info",
    warn: "al-event__status--warn",
    error: "al-event__status--error",
    success: "al-event__status--success",
}

/** Activity log viewer with filtering, copy, export, and clear actions. */
export function ActivityLogPanel() {
    const log = useActivityLog()
    const listRef = useRef<HTMLDivElement | null>(null)
    const [filters, setFilters] = useState<Filters>({
        status: "all",
        area: "all",
        search: "",
    })
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        listRef.current?.scrollTo({ top: 0 })
    }, [filters])

    const filtered = useMemo(() => {
        let result = [...log.events].reverse() as readonly ActivityEvent[]
        if (filters.status !== "all") {
            result = result.filter((event) => event.status === filters.status)
        }
        if (filters.area !== "all") {
            result = result.filter((event) => event.area === filters.area)
        }
        if (filters.search.trim()) {
            const q = filters.search.toLowerCase()
            result = result.filter(
                (event) =>
                    event.message.toLowerCase().includes(q) ||
                    Boolean(event.error?.toLowerCase().includes(q))
            )
        }
        return result
    }, [log.events, filters])

    const handleStatusChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setFilters((current) => ({ ...current, status: event.target.value as StatusFilter }))
    }, [])

    const handleAreaChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setFilters((current) => ({ ...current, area: event.target.value as AreaFilter }))
    }, [])

    const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setFilters((current) => ({ ...current, search: event.target.value }))
    }, [])

    const handleCopy = useCallback(() => {
        navigator.clipboard?.writeText(log.exportText()).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        })
    }, [log])

    return (
        <section className="al" aria-label="Activity log">
            <div className="al__toolbar">
                <div className="al__filters">
                    <select className="al__select" value={filters.status} onChange={handleStatusChange}>
                        <option value="all">All status</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                        <option value="success">Success</option>
                    </select>
                    <select className="al__select" value={filters.area} onChange={handleAreaChange}>
                        <option value="all">All areas</option>
                        {(Object.keys(AREA_LABELS) as ActivityArea[]).map((area) => (
                            <option key={area} value={area}>{AREA_LABELS[area]}</option>
                        ))}
                    </select>
                    <input
                        className="al__search"
                        type="search"
                        value={filters.search}
                        onChange={handleSearchChange}
                        placeholder="Search events"
                    />
                </div>
                <div className="al__actions">
                    <button type="button" className="al__btn" onClick={handleCopy}>
                        {copied ? <CheckIcon /> : <span className="al__icon-copy" aria-hidden="true" />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                    <button type="button" className="al__btn" onClick={() => downloadLog(log.exportText(), `activity-log-${Date.now()}.txt`, "text/plain")}>TXT</button>
                    <button type="button" className="al__btn" onClick={() => downloadLog(log.exportJson(), `activity-log-${Date.now()}.json`, "application/json")}>JSON</button>
                    <button type="button" className="al__btn al__btn--clear" onClick={log.clear}>Clear</button>
                </div>
            </div>
            <div className="al__badge">{filtered.length} / {log.count} event{log.count === 1 ? "" : "s"}</div>
            <div className="al__list" ref={listRef}>
                {filtered.length === 0 ? (
                    <div className="al__empty">{log.count === 0 ? "No events recorded yet." : "No events match the current filters."}</div>
                ) : (
                    filtered.map((event) => <ActivityEventRow key={event.id} event={event} />)
                )}
            </div>
        </section>
    )
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
    const [expanded, setExpanded] = useState(false)
    const hasDetails = event.details != null || event.error != null || event.message.length > 120

    return (
        <article className={`al-event${expanded ? " al-event--expanded" : ""}`}>
            <button type="button" className="al-event__summary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
                <span className="al-event__time">{formatEventTime(event.timestamp)}</span>
                <span className={`al-event__status ${STATUS_CLASS[event.status]}`}>{event.status}</span>
                <span className="al-event__area">{AREA_LABELS[event.area]}</span>
                <span className="al-event__msg">{event.message}</span>
                {hasDetails && <span className="al-event__chevron">{expanded ? "▾" : "▸"}</span>}
            </button>
            {expanded && hasDetails && (
                <div className="al-event__details">
                    {event.error && <DetailRow label="Error" value={event.error} error />}
                    {event.details && <DetailRow label="Details" value={formatDetails(event.details)} />}
                    {event.message.length > 120 && <DetailRow label="Message" value={event.message} />}
                    <DetailRow label="ID" value={`#${event.id}`} />
                </div>
            )}
        </article>
    )
}

function DetailRow({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
    return (
        <div className="al-event__detail-row">
            <span className="al-event__detail-label">{label}</span>
            <code className={`al-event__detail-val${error ? " al-event__detail-val--error" : ""}`}>{value}</code>
        </div>
    )
}

function formatEventTime(ts: number): string {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}

function formatDetails(details: Record<string, unknown>): string {
    try {
        return JSON.stringify(details, null, 2)
    } catch {
        return String(details)
    }
}

function downloadLog(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.rel = "noopener"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}
