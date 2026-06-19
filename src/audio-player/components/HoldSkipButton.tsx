import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react"

export interface HoldSkipButtonProps {
    direction: "previous" | "next"
    disabled?: boolean
    skipDisabled?: boolean
    seekLabel: string
    skipLabel: string
    onSeek: () => void
    onSkip: () => void
    children: ReactNode
    className?: string
    holdMs?: number
}

const DEFAULT_HOLD_MS = 1200

/**
 * Consolidated transport button: a short press seeks, an intentional hold skips
 * tracks. Pointer and keyboard paths share the same timer so mobile, desktop,
 * and assistive keyboard users get equivalent behavior.
 */
export function HoldSkipButton({
    direction,
    disabled = false,
    skipDisabled = false,
    seekLabel,
    skipLabel,
    onSeek,
    onSkip,
    children,
    className = "",
    holdMs = DEFAULT_HOLD_MS,
}: HoldSkipButtonProps) {
    const hintId = useId()
    const timerRef = useRef<number | null>(null)
    const heldRef = useRef(false)
    const pressingRef = useRef(false)
    const [isHolding, setIsHolding] = useState(false)

    const clearHoldTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const resetHold = useCallback(() => {
        clearHoldTimer()
        pressingRef.current = false
        heldRef.current = false
        setIsHolding(false)
    }, [clearHoldTimer])

    const startHold = useCallback(() => {
        if (disabled || pressingRef.current) return
        pressingRef.current = true
        heldRef.current = false
        setIsHolding(!skipDisabled)
        if (skipDisabled) return
        timerRef.current = window.setTimeout(() => {
            heldRef.current = true
            pressingRef.current = false
            setIsHolding(false)
            onSkip()
        }, holdMs)
    }, [disabled, holdMs, onSkip, skipDisabled])

    const finishPress = useCallback(() => {
        if (disabled || !pressingRef.current) {
            resetHold()
            return
        }
        const completedHold = heldRef.current
        resetHold()
        if (!completedHold) onSeek()
    }, [disabled, onSeek, resetHold])

    const cancelPress = useCallback(() => {
        resetHold()
    }, [resetHold])

    useEffect(() => { resetHold(); }, [resetHold, disabled, skipDisabled])

    const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return
        startHold()
    }

    const handlePointerEnd = (_event: PointerEvent<HTMLButtonElement>) => {
        finishPress()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== " " && event.key !== "Enter") return
        if (event.repeat) return
        event.preventDefault()
        startHold()
    }

    const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== " " && event.key !== "Enter") return
        event.preventDefault()
        finishPress()
    }

    const label = `${seekLabel}; hold for ${skipLabel.toLowerCase()}`

    return (
        <button
            type="button"
            className={`${className} ap-hold-skip ap-hold-skip--${direction}${isHolding ? " ap-hold-skip--holding" : ""}`.trim()}
            style={{ "--ap-hold-ms": `${holdMs}ms` } as CSSProperties}
            disabled={disabled}
            aria-label={label}
            aria-describedby={hintId}
            data-hold-label={skipDisabled ? "Unavailable" : "Hold"}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerEnd}
            onPointerCancel={cancelPress}
            onPointerLeave={cancelPress}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
        >
            <span className="ap-hold-skip__icon" aria-hidden="true">{children}</span>
            <span className="ap-hold-skip__progress" aria-hidden="true" />
            <span id={hintId} className="ap-sr-only">
                Tap to {seekLabel.toLowerCase()}. Hold for about one second for {skipLabel.toLowerCase()}.
            </span>
        </button>
    )
}
