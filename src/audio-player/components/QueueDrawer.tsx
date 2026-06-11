import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import type { Track } from "../types"
import { trackKey } from "../utils/trackKey"

/* ----------------------------- QueueDrawer props ----------------------------- */

export interface QueueDrawerProps {
    /** The full queue (all tracks including the active one). */
    queue: Track[]
    /** Index of the currently playing track. */
    currentIndex: number
    /** Whether the active track is currently playing. */
    isPlaying?: boolean
    /** Whether the drawer is visible. */
    open: boolean
    /** Close the drawer. */
    onClose: () => void
    /** Jump to a track by index. */
    onPlayTrack: (index: number) => void
    /** Reorder: move the item at `fromIndex` to `toIndex`. */
    onReorder: (fromIndex: number, toIndex: number) => void
    /** Remove a track by index (no-op on the active track). */
    onRemove: (index: number) => void
}

/* ----------------------------- Internal hook for drag-and-drop ----------------------------- */

interface DragState {
    /** The queue index of the item being dragged. */
    index: number
    /** Current pixel offset of the drag ghost. */
    y: number
    /** The index the item would land at on drop. */
    targetIndex: number
}

/**
 * Pure pointer-event drag-and-drop for a vertical list. Returns the drag state
 * plus the handlers to attach to each row and the list container. Uses pointer
 * capture to survive pointer leaving the element.
 */
function useQueueDrag(
    itemCount: number,
    onReorder: (from: number, to: number) => void,
    rowHeight = 56
) {
    const [drag, setDrag] = useState<DragState | null>(null)
    const dragRef = useRef<DragState | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const initialPointerRef = useRef(0)

    const computeTarget = useCallback(
        (pointerY: number, startIndex: number) => {
            if (!containerRef.current) return startIndex
            const rect = containerRef.current.getBoundingClientRect()
            const offset = pointerY - rect.top
            const rawIndex = Math.round(offset / rowHeight)
            return Math.max(0, Math.min(itemCount - 1, rawIndex))
        },
        [itemCount, rowHeight]
    )

    const handlePointerDown = useCallback(
        (index: number, event: React.PointerEvent<HTMLElement>) => {
            // Only respond to the primary button (left click or touch).
            if (event.button !== 0) return
            event.preventDefault()
            const el = event.currentTarget
            el.setPointerCapture(event.pointerId)
            initialPointerRef.current = event.clientY
            const state: DragState = {
                index,
                y: 0,
                targetIndex: index,
            }
            dragRef.current = state
            setDrag(state)
        },
        []
    )

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const s = dragRef.current
            if (!s) return
            event.preventDefault()
            const dy = event.clientY - initialPointerRef.current
            const target = computeTarget(event.clientY, s.index)
            const next: DragState = {
                ...s,
                y: dy,
                targetIndex: target === s.index ? s.targetIndex : target,
            }
            dragRef.current = next
            setDrag(next)
        },
        [computeTarget]
    )

    const handlePointerUp = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const s = dragRef.current
            if (!s) return
            event.preventDefault()
            const el = event.currentTarget
            try { el.releasePointerCapture(event.pointerId) } catch { /* ignore */ }

            const target = computeTarget(event.clientY, s.index)
            if (target !== s.index) {
                onReorder(s.index, target)
            }
            dragRef.current = null
            setDrag(null)
        },
        [computeTarget, onReorder]
    )

    return {
        drag,
        setContainerRef: containerRef,
        getRowHandlers: (index: number) => ({
            onPointerDown: (e: React.PointerEvent<HTMLElement>) =>
                handlePointerDown(index, e),
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
        }),
    }
}

/* ----------------------------- Icons (inline) ----------------------------- */

const DragHandleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="4" r="1.3" />
        <circle cx="11" cy="4" r="1.3" />
        <circle cx="5" cy="8" r="1.3" />
        <circle cx="11" cy="8" r="1.3" />
        <circle cx="5" cy="12" r="1.3" />
        <circle cx="11" cy="12" r="1.3" />
    </svg>
)

const CloseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

const RemoveIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

/* ----------------------------- Row component ----------------------------- */

interface QueueRowProps {
    track: Track
    index: number
    isActive: boolean
    isDragging: boolean
    dragOffset: number
    dragHandlers: ReturnType<ReturnType<typeof useQueueDrag>["getRowHandlers"]>
    onPlay: () => void
    onRemove: () => void
    isPlaying: boolean
}

function QueueRow({
    track,
    index,
    isActive,
    isDragging,
    dragOffset,
    dragHandlers,
    onPlay,
    onRemove,
    isPlaying,
}: QueueRowProps) {
    const rowRef = useRef<HTMLDivElement>(null)

    // Announce when a row becomes active (first render or index change).
    useEffect(() => {
        if (isActive && rowRef.current) {
            rowRef.current.focus()
        }
    }, [isActive])

    return (
        <div
            ref={rowRef}
            className={`ap-q-row${isActive ? " ap-q-row--active" : ""}${isDragging ? " ap-q-row--dragging" : ""}`}
            role="listitem"
            tabIndex={-1}
            aria-label={`${track.title} by ${track.artist}${isActive ? " (now playing)" : ""}`}
            style={isDragging && dragOffset !== 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
            <span
                className="ap-q-row__drag"
                aria-hidden="true"
                style={{ touchAction: "none" }}
                onPointerDown={dragHandlers.onPointerDown}
                onPointerMove={dragHandlers.onPointerMove}
                onPointerUp={dragHandlers.onPointerUp}
            >
                <DragHandleIcon />
            </span>

            <span className="ap-q-row__num">
                {isActive && isPlaying ? (
                    <span className="ap-eq" aria-hidden="true"><i /><i /><i /></span>
                ) : (
                    index + 1
                )}
            </span>

            <div className="ap-q-row__meta">
                <span className="ap-q-row__title">{track.title}</span>
                <span className="ap-q-row__artist">{track.artist}</span>
            </div>

            {isActive && (
                <span className="ap-q-row__badge">Now Playing</span>
            )}

            {/* Click to jump to this track (except the active one — it's already playing). */}
            {!isActive && (
                <button
                    type="button"
                    className="ap-q-row__play-btn ap-tap"
                    onClick={onPlay}
                    aria-label={`Play ${track.title}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l12-7z" />
                    </svg>
                </button>
            )}

            {/* Remove button — hidden for the active track. */}
            {!isActive && (
                <button
                    type="button"
                    className="ap-q-row__remove ap-tap"
                    onClick={onRemove}
                    aria-label={`Remove ${track.title} from queue`}
                >
                    <RemoveIcon />
                </button>
            )}
        </div>
    )
}

/* ----------------------------- QueueDrawer component ----------------------------- */

/**
 * An overlay drawer that shows the "Now Playing" track and "Up Next" tracks.
 * Supports:
 * - Drag-and-drop reorder of upcoming tracks
 * - Remove tracks from the queue (not the active track)
 * - Click-to-play any upcoming track
 * - Accessibility via ARIA roles and live announcements
 *
 * Designed to work with both the standalone AudioPlayer's local queue and the
 * global session's queue (via useAudioSession).
 */
export function QueueDrawer({
    queue,
    currentIndex,
    isPlaying = false,
    open,
    onClose,
    onPlayTrack,
    onReorder,
    onRemove,
}: QueueDrawerProps) {
    const [announcement, setAnnouncement] = useState("")
    const prevQueueRef = useRef(queue)

    const drag = useQueueDrag(queue.length, onReorder)

    // Lock body scroll when open.
    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prev
        }
    }, [open])

    // Announce queue changes to screen readers.
    useEffect(() => {
        if (queue.length === prevQueueRef.current.length) return
        const removed = prevQueueRef.current.length > queue.length
        if (removed) {
            const removedCount = prevQueueRef.current.length - queue.length
            setAnnouncement(`${removedCount} track${removedCount > 1 ? "s" : ""} removed from queue`)
        }
        prevQueueRef.current = queue
    }, [queue])

    // Close on Escape.
    useEffect(() => {
        if (!open) return
        const handleKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", handleKey)
        return () => document.removeEventListener("keydown", handleKey)
    }, [open, onClose])

    if (!open) return null

    // Upcoming tracks are everything after the current index.
    const upcomingStart = currentIndex + 1

    return (
        <div className="ap-q-overlay" role="dialog" aria-modal="true" aria-label="Up next queue">
            {/* Backdrop */}
            <div className="ap-q-backdrop" onClick={onClose} aria-hidden="true" />

            {/* Drawer panel */}
            <div className="ap-q-drawer ap-anim-in">
                {/* Header */}
                <div className="ap-q-header">
                    <h2 className="ap-q-header__title">Up Next</h2>
                    <span className="ap-q-header__count">
                        {queue.length} track{queue.length !== 1 ? "s" : ""}
                    </span>
                    <button
                        type="button"
                        className="ap-q-header__close ap-tap"
                        onClick={onClose}
                        aria-label="Close queue drawer"
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Screen reader announcements */}
                <div className="ap-sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {announcement}
                </div>

                {/* Queue list */}
                <div
                    className="ap-q-list"
                    ref={drag.setContainerRef}
                    role="list"
                    aria-label="Queue tracks"
                    style={{ touchAction: "pan-y" }}
                >
                    {queue.map((track, i) => {
                        const isActive = i === currentIndex
                        const isUpcoming = i >= upcomingStart
                        const isDragging = drag.drag !== null && drag.drag.index === i
                        const dragOffset = isDragging && drag.drag ? drag.drag.y : 0

                        // We don't show the row if it's not active and not upcoming.
                        // (Items before the current index are "already played" and hidden.)
                        if (!isActive && !isUpcoming) return null

                        return (
                            <QueueRow
                                key={`${i}:${trackKey(track)}`}
                                track={track}
                                index={i}
                                isActive={isActive}
                                isDragging={isDragging}
                                dragOffset={dragOffset}
                                dragHandlers={drag.getRowHandlers(i)}
                                onPlay={() => onPlayTrack(i)}
                                onRemove={() => onRemove(i)}
                                isPlaying={isPlaying}
                            />
                        )
                    })}
                </div>

                {/* Empty state */}
                {queue.length === 0 && (
                    <div className="ap-q-empty">
                        <p>Queue is empty</p>
                    </div>
                )}

                {/* No upcoming tracks */}
                {queue.length > 0 && upcomingStart >= queue.length && (
                    <div className="ap-q-empty">
                        <p>No more tracks — the queue ends after this one.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default QueueDrawer