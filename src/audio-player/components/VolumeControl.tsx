import { memo, useCallback, useEffect, useRef } from "react"
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from "react"

interface VolumeControlProps {
    volume: number
    isMuted: boolean
    disabled: boolean
    /**
     * True when the host environment (e.g. iOS Safari) ignores programmatic
     * volume changes. The UI shows a small hint and the slider remains
     * interactive so it still reflects user intent; the mute toggle is the
     * guaranteed-effective control on those platforms.
     */
    volumeUnsupported?: boolean
    onVolumeChange: (value: number) => void
    onToggleMute: () => void
}

/**
 * Mute toggle + a custom vertical-agnostic horizontal slider, built on the same
 * Pointer Events pattern as the scrubber for consistent behavior. Note: iOS
 * Safari ignores programmatic volume, so the mute button is the reliable control
 * there; the slider is effectively desktop-only. We surface a small hint to
 * users when we detect that the browser is not honoring the slider.
 */
export const VolumeControl = memo(function VolumeControl({
    volume,
    isMuted,
    disabled,
    volumeUnsupported = false,
    onVolumeChange,
    onToggleMute,
}: VolumeControlProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    // Pointer-capture bookkeeping so a drag in flight is released on unmount.
    const captureIdRef = useRef<number | null>(null)
    const captureTargetRef = useRef<HTMLElement | null>(null)

    const ratioFromEvent = useCallback((clientX: number) => {
        const el = trackRef.current
        if (!el) return 0
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0) return 0
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }, [])

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
            if (disabled || event.button !== 0) return
            const target = event.currentTarget
            try {
                target.setPointerCapture(event.pointerId)
            } catch {
                // Some embedded webviews reject capture; fall through.
            }
            captureTargetRef.current = target
            captureIdRef.current = event.pointerId
            onVolumeChange(ratioFromEvent(event.clientX))
        },
        [disabled, onVolumeChange, ratioFromEvent]
    )

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (disabled) return
            // Only react to the pointer that started the drag. Without this
            // guard, simply moving any pointer over the slider would yank
            // the thumb (and re-trigger onVolumeChange) on every hover.
            if (
                captureIdRef.current === null ||
                event.pointerId !== captureIdRef.current
            ) {
                return
            }
            onVolumeChange(ratioFromEvent(event.clientX))
        },
        [disabled, onVolumeChange, ratioFromEvent]
    )

    const handlePointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            // Only release capture for the pointer we actually captured.
            // A second touch or hover release must not yank capture away
            // from the active drag.
            const id = captureIdRef.current
            if (id === null || event.pointerId !== id) {
                return
            }
            releaseCapture()
        },
        [releaseCapture]
    )

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (disabled) return
            let next: number | null = null
            switch (event.key) {
                case "ArrowRight":
                case "ArrowUp":
                    next = volume + 0.05
                    break
                case "ArrowLeft":
                case "ArrowDown":
                    next = volume - 0.05
                    break
                case "PageUp":
                    next = volume + 0.1
                    break
                case "PageDown":
                    next = volume - 0.1
                    break
                case "Home":
                    next = 0
                    break
                case "End":
                    next = 1
                    break
                default:
                    return
            }
            event.preventDefault()
            onVolumeChange(Math.max(0, Math.min(1, next)))
        },
        [disabled, onVolumeChange, volume]
    )

    // Release any pointer capture if the component unmounts mid-drag.
    useEffect(() => {
        return () => {
            releaseCapture()
        }
    }, [releaseCapture])

    const effective = isMuted ? 0 : volume
    // Clamp pct to 0-100 (and treat non-finite as 0) so a bad prop value
    // cannot push the fill or thumb off the slider track.
    const rawPct = effective * 100
    const pct = Number.isFinite(rawPct) ? Math.max(0, Math.min(100, rawPct)) : 0

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
            {volumeUnsupported && !disabled && (
                <span
                    className="ap-volume__hint"
                    role="note"
                    aria-label="Use the mute button to silence audio; this browser does not support volume control"
                >
                    iOS
                </span>
            )}
        </div>
    )
})
