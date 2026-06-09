import { useCallback, useRef } from "react"
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from "react"
import { formatTime } from "../utils/formatTime"

interface ProgressBarProps {
    currentTime: number
    duration: number
    buffered: number
    disabled: boolean
    isSeeking: boolean
    onSeek: (time: number) => void
    onSeekStart: () => void
    onSeekEnd: () => void
}

/**
 * Fully custom, div-based scrubber. A single Pointer Events pipeline handles
 * mouse, touch, and pen identically (no separate touch path), which removes the
 * dual-system jank of a native <input type="range">. Keyboard accessibility is
 * re-implemented here since we no longer get it from the native control.
 */
export function ProgressBar({
    currentTime,
    duration,
    buffered,
    disabled,
    isSeeking,
    onSeek,
    onSeekStart,
    onSeekEnd,
}: ProgressBarProps) {
    const trackRef = useRef<HTMLDivElement>(null)

    const ratioFromEvent = useCallback(
        (clientX: number) => {
            const el = trackRef.current
            if (!el) return 0
            const rect = el.getBoundingClientRect()
            if (rect.width <= 0) return 0
            return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        },
        []
    )

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (disabled || duration <= 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            onSeekStart()
            onSeek(ratioFromEvent(event.clientX) * duration)
        },
        [disabled, duration, onSeek, onSeekStart, ratioFromEvent]
    )

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            if (disabled || duration <= 0) return
            onSeek(ratioFromEvent(event.clientX) * duration)
        },
        [disabled, duration, onSeek, ratioFromEvent]
    )

    const handlePointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
            }
            onSeekEnd()
        },
        [onSeekEnd]
    )

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (disabled || duration <= 0) return
            let next: number | null = null
            const step = event.shiftKey ? 30 : 5
            switch (event.key) {
                case "ArrowRight":
                case "ArrowUp":
                    next = currentTime + step
                    break
                case "ArrowLeft":
                case "ArrowDown":
                    next = currentTime - step
                    break
                case "Home":
                    next = 0
                    break
                case "End":
                    next = duration
                    break
                default:
                    return
            }
            event.preventDefault()
            onSeek(next)
        },
        [currentTime, disabled, duration, onSeek]
    )

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0

    return (
        <div
            ref={trackRef}
            className={`ap-progress${isSeeking ? " ap-progress--seeking" : ""}`}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={
                disabled ? "Seek unavailable. Audio file missing" : "Seek"
            }
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            aria-disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
        >
            <div className="ap-progress__track" />
            <div
                className="ap-progress__buffered"
                style={{ width: `${bufferedPct}%` }}
            />
            <div
                className="ap-progress__fill"
                style={{ width: `${progressPct}%` }}
            />
            <div
                className="ap-progress__thumb"
                style={{ left: `${progressPct}%` }}
            />
        </div>
    )
}
