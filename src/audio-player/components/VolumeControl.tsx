import { useCallback, useRef } from "react"
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from "react"

interface VolumeControlProps {
    volume: number
    isMuted: boolean
    disabled: boolean
    onVolumeChange: (value: number) => void
    onToggleMute: () => void
}

/**
 * Mute toggle + a custom vertical-agnostic horizontal slider, built on the same
 * Pointer Events pattern as the scrubber for consistent behavior. Note: iOS
 * Safari ignores programmatic volume, so the mute button is the reliable control
 * there; the slider is effectively desktop-only.
 */
export function VolumeControl({
    volume,
    isMuted,
    disabled,
    onVolumeChange,
    onToggleMute,
}: VolumeControlProps) {
    const trackRef = useRef<HTMLDivElement>(null)

    const ratioFromEvent = useCallback((clientX: number) => {
        const el = trackRef.current
        if (!el) return 0
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0) return 0
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }, [])

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (disabled) return
            event.currentTarget.setPointerCapture(event.pointerId)
            onVolumeChange(ratioFromEvent(event.clientX))
        },
        [disabled, onVolumeChange, ratioFromEvent]
    )

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            if (disabled) return
            onVolumeChange(ratioFromEvent(event.clientX))
        },
        [disabled, onVolumeChange, ratioFromEvent]
    )

    const handlePointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
            }
        },
        []
    )

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (disabled) return
            let next: number | null = null
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                next = volume + 0.05
            } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                next = volume - 0.05
            } else {
                return
            }
            event.preventDefault()
            onVolumeChange(Math.max(0, Math.min(1, next)))
        },
        [disabled, onVolumeChange, volume]
    )

    const effective = isMuted ? 0 : volume
    const pct = effective * 100

    return (
        <div className="ap-volume">
            <button
                type="button"
                className="ap-icon-btn ap-volume__mute"
                onClick={onToggleMute}
                disabled={disabled}
                aria-label={isMuted ? "Unmute" : "Mute"}
                aria-pressed={isMuted}
            >
                {isMuted || effective === 0 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                )}
            </button>
            <div
                ref={trackRef}
                className="ap-volume__slider"
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                aria-valuetext={`${Math.round(pct)}% volume`}
                aria-disabled={disabled}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={handleKeyDown}
            >
                <div className="ap-volume__track" />
                <div className="ap-volume__fill" style={{ width: `${pct}%` }} />
                <div className="ap-volume__thumb" style={{ left: `${pct}%` }} />
            </div>
        </div>
    )
}
