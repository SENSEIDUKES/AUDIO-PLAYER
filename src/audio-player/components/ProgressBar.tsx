import { useCallback, useEffect, useRef, useState } from "react"
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
 *
 * During a drag, the thumb/fill update locally at full frame rate without
 * touching the <audio> element. The final seek is applied once on pointer up,
 * preventing repeated seeks at 60-120Hz from causing audio stutter or decode lag.
 *
 * Unmount safety: pointer capture is tracked in a ref and released in a
 * `useEffect` cleanup so a drag that ends in an unmount cannot leak a captured
 * pointer back to the document.
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
    // Local drag position for instant visual feedback during scrub.
    const dragTimeRef = useRef<number | null>(null)
    /**
     * Captured pointer bookkeeping. `captureId` is the pointer id we asked the
     * browser to capture; `captureTarget` is the element that owns the
     * capture. The unmount effect calls `releasePointerCapture` on the stored
     * target so a mid-drag unmount never leaves the browser with a dangling
     * capture pointing at a detached node.
     */
    const captureIdRef = useRef<number | null>(null)
    const captureTargetRef = useRef<HTMLElement | null>(null)
    const [dragTime, setDragTime] = useState<number | null>(null)

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

    const releaseCapture = useCallback(() => {
        const target = captureTargetRef.current
        const id = captureIdRef.current
        if (target !== null && id !== null) {
            try {
                if (target.hasPointerCapture(id)) {
                    target.releasePointerCapture(id)
                }
            } catch {
                // The element may have been detached; nothing to release.
            }
        }
        captureTargetRef.current = null
        captureIdRef.current = null
    }, [])

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (disabled || duration <= 0 || event.button !== 0) return
            const target = event.currentTarget
            try {
                target.setPointerCapture(event.pointerId)
            } catch {
                // Some embedded webviews reject capture; the drag still works,
                // we just lose the "events keep flowing when off element"
                // guarantee. Fall through.
            }
            captureTargetRef.current = target
            captureIdRef.current = event.pointerId
            const time = ratioFromEvent(event.clientX) * duration
            dragTimeRef.current = time
            setDragTime(time)
            onSeekStart()
            // Seek immediately on initial click so the audio responds at once.
            onSeek(time)
        },
        [disabled, duration, onSeek, onSeekStart, ratioFromEvent]
    )

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (disabled || duration <= 0) return
            // Only react to the pointer that started the drag. Without this
            // guard, simply moving any pointer over the track would yank the
            // thumb around.
            if (
                captureIdRef.current === null ||
                event.pointerId !== captureIdRef.current
            ) {
                return
            }
            // Visual-only update while dragging — audio gets the final position
            // on pointer up to avoid high-frequency seeks causing stutter.
            const time = ratioFromEvent(event.clientX) * duration
            dragTimeRef.current = time
            setDragTime(time)
        },
        [disabled, duration, ratioFromEvent]
    )

    const handlePointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const id = captureIdRef.current
            // Only handle up/cancel for the pointer we actually captured.
            // Other pointers (e.g. a second touch or a hover release) must
            // not clear drag state or call onSeekEnd mid-drag.
            if (id === null || event.pointerId !== id) {
                return
            }
            if (dragTimeRef.current !== null) {
                onSeek(dragTimeRef.current)
            }
            releaseCapture()
            dragTimeRef.current = null
            setDragTime(null)
            onSeekEnd()
        },
        [onSeek, onSeekEnd, releaseCapture]
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
                case "PageUp":
                    next = currentTime + 10
                    break
                case "PageDown":
                    next = currentTime - 10
                    break
                default:
                    return
            }
            event.preventDefault()
            onSeek(next)
        },
        [currentTime, disabled, duration, onSeek]
    )

    // Unmount safety: if a drag is in flight when the component unmounts, we
    // need to release the captured pointer on the now-detached element, or the
    // browser will hold the capture forever and a subsequent click on a
    // different element can misroute.
    useEffect(() => {
        return () => {
            releaseCapture()
        }
    }, [releaseCapture])

    // Show local drag position while scrubbing; fall back to engine time otherwise.
    const displayTime = dragTime !== null ? dragTime : currentTime
    // Clamp percentages to 0-100 so a metadata glitch or out-of-range
    // currentTime/buffered value cannot push the fill or thumb off the track.
    const rawProgressPct = duration > 0 ? (displayTime / duration) * 100 : 0
    const rawBufferedPct = duration > 0 ? (buffered / duration) * 100 : 0
    const clampPct = (v: number) =>
        Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0
    const progressPct = clampPct(rawProgressPct)
    const bufferedPct = clampPct(rawBufferedPct)

    // Use a single decimal place for the aria-valuenow so screen readers report
    // smooth movement during scrubbing instead of the coarse second-by-second
    // jumps caused by Math.floor.
    const ariaValueNow =
        Number.isFinite(displayTime) && displayTime > 0
            ? Math.round(displayTime * 10) / 10
            : 0

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
            aria-valuenow={ariaValueNow}
            aria-valuetext={`${formatTime(displayTime)} of ${formatTime(duration)}`}
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
