import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import type { ReaderMixer } from "../narrative/ReaderMixer"
import { useOptionalReaderMixer, useReaderMixerState } from "../narrative/ReaderMixerContext"
import "./reader-mixer.css"

export interface ReaderMixerNoteLabels {
    mute: string
    unmute: string
    needsTap: string
    resume: string
    soundOn: string
    muted: string
    blocked: string
    sleepStopped: string
    timerRunning: string
}

export const DEFAULT_READER_MIXER_NOTE_LABELS: ReaderMixerNoteLabels = Object.freeze({
    mute: "Mute story audio",
    unmute: "Unmute story audio",
    needsTap: "Tap to start story audio",
    resume: "Resume story audio",
    soundOn: "Story audio on",
    muted: "Story audio muted",
    blocked: "Story audio needs a tap",
    sleepStopped: "Story audio stopped by sleep timer",
    timerRunning: "Sleep timer running",
})

export interface ReaderMixerNoteProps {
    mixer?: ReaderMixer
    onOpenSettings?: () => void
    labels?: Partial<ReaderMixerNoteLabels>
    /** Defaults to 600 ms; keyboard activation always uses the native button click. */
    longPressMs?: number
    className?: string
    style?: CSSProperties
}

/** Small soundtrack switch in host-owned placement. Narration keeps its own switch. */
export function ReaderMixerNote({
    mixer: mixerProp,
    onOpenSettings,
    labels: overrides,
    longPressMs = 600,
    className,
    style,
}: ReaderMixerNoteProps) {
    const context = useOptionalReaderMixer()
    const mixer = mixerProp ?? context
    const state = useReaderMixerState(mixer)
    const labels = { ...DEFAULT_READER_MIXER_NOTE_LABELS, ...overrides }
    const [scrolling, setScrolling] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)
    const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const suppressClick = useRef(false)
    const openedSettings = useRef(false)
    const clearPress = () => {
        if (pressTimer.current !== null) clearTimeout(pressTimer.current)
        pressTimer.current = null
    }
    const becomeVisible = () => {
        if (scrollTimer.current !== null) clearTimeout(scrollTimer.current)
        scrollTimer.current = null
        setScrolling(false)
    }
    useEffect(() => {
        const scroll = () => {
            setScrolling(true)
            if (scrollTimer.current !== null) clearTimeout(scrollTimer.current)
            scrollTimer.current = setTimeout(() => {
                scrollTimer.current = null
                setScrolling(false)
            }, 2000)
        }
        document.addEventListener("scroll", scroll, { capture: true, passive: true })
        const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)")
        const motion = () => setReducedMotion(preference?.matches ?? false)
        motion()
        preference?.addEventListener("change", motion)
        return () => {
            document.removeEventListener("scroll", scroll, true)
            preference?.removeEventListener("change", motion)
            if (scrollTimer.current !== null) clearTimeout(scrollTimer.current)
            clearPress()
        }
    }, [])

    const visible = state && Object.values(state.availability).some(Boolean)
    if (!mixer || !state || !visible) return null
    const muted = !state.preferences.masterEnabled
    const stopped = state.sleepTimer.status === "fired"
    const needsTap =
        !stopped &&
        (state.needsGesture ||
            Object.values(state.layers).some(
                (layer) => layer.status === "blocked" && layer.effectiveLevel > 0
            ))
    const status = stopped ? "sleep-stopped" : needsTap ? "needs-tap" : muted ? "muted" : "on"
    const label = stopped
        ? labels.resume
        : needsTap
          ? labels.needsTap
          : muted
            ? labels.unmute
            : labels.mute
    const announcement = stopped
        ? labels.sleepStopped
        : needsTap
          ? labels.blocked
          : muted
            ? labels.muted
            : labels.soundOn
    return (
        <span
            className={["sap-reader-mixer-note", className].filter(Boolean).join(" ")}
            style={style}
            data-state={status}
            data-scrolling={scrolling}
            data-reduced-motion={reducedMotion}
            onPointerEnter={becomeVisible}
            onPointerMove={becomeVisible}
        >
            <button
                type="button"
                className="sap-reader-mixer-note__button"
                aria-label={label}
                onFocus={becomeVisible}
                onClick={(event) => {
                    if (suppressClick.current) {
                        suppressClick.current = false
                        openedSettings.current = false
                        event.preventDefault()
                        return
                    }
                    if (stopped) mixer.resumeAudio()
                    else if (needsTap) {
                        if (muted) mixer.setMasterEnabled(true)
                        mixer.unlock()
                    } else {
                        mixer.setMasterEnabled(muted)
                        if (muted) mixer.unlock()
                    }
                }}
                onPointerDown={(event) => {
                    openedSettings.current = false
                    if (event.button !== 0) return
                    clearPress()
                    suppressClick.current = false
                    openedSettings.current = false
                    if (onOpenSettings)
                        pressTimer.current = setTimeout(
                            () => {
                                pressTimer.current = null
                                suppressClick.current = true
                                openedSettings.current = true
                                onOpenSettings()
                            },
                            Math.max(0, longPressMs)
                        )
                }}
                onPointerUp={clearPress}
                onPointerCancel={clearPress}
                onPointerLeave={clearPress}
                onContextMenu={(event) => {
                    if (!onOpenSettings) return
                    event.preventDefault()
                    clearPress()
                    if (!openedSettings.current) onOpenSettings()
                    openedSettings.current = false
                }}
            >
                <svg
                    className="sap-reader-mixer-note__glyph"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                >
                    <path d="M9 18V5l11-2v13M9 9l11-2" />
                    <ellipse cx="6" cy="18" rx="3" ry="2.3" />
                    <ellipse cx="17" cy="16" rx="3" ry="2.3" />
                    {muted && (
                        <path
                            className="sap-reader-mixer-note__slash"
                            d="M3 3l18 18"
                            strokeWidth="2.5"
                        />
                    )}
                    {needsTap && <path d="M3 5v5m0 3v.5" />}
                    {stopped && <path d="M3 4v7m3-7v7" />}
                </svg>
                {state.sleepTimer.status === "running" && (
                    <span
                        className="sap-reader-mixer-note__timer"
                        role="img"
                        aria-label={labels.timerRunning}
                    >
                        ◷
                    </span>
                )}
            </button>
            <span
                className="sap-reader-mixer-note__announcement"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {announcement}
            </span>
        </span>
    )
}
