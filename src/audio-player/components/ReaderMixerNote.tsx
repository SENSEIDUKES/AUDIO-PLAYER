import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import type { ReaderMixer } from "../narrative/ReaderMixer"
import { useOptionalReaderMixer, useReaderMixerState } from "../narrative/ReaderMixerContext"
import "./reader-mixer-note.css"

export interface ReaderMixerNoteLabels {
    mute: string
    unmute: string
    needsTap: string
    resume: string
    soundOn: string
    muted: string
    blocked: string
    /** Button label while a wanted loop has failed to play. */
    retry: string
    /** Announced when a wanted loop has failed to play. */
    failed: string
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
    retry: "Retry story audio",
    failed: "Story audio could not play",
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
    /** Opt-in independent mute; Master off is controlled by the host's Settings switch. */
    muteMode?: "master-switch" | "soundtrack-mute"
}

/** Small soundtrack switch in host-owned placement. Narration keeps its own switch. */
export function ReaderMixerNote({
    mixer: mixerProp,
    onOpenSettings,
    labels: overrides,
    longPressMs = 600,
    className,
    style,
    muteMode = "master-switch",
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
    const independentMute = muteMode === "soundtrack-mute"
    if (independentMute && !state.preferences.masterEnabled) return null
    const muted = independentMute
        ? Boolean(state.preferences.masterMuted) || state.preferences.masterLevel === 0
        : !state.preferences.masterEnabled ||
          Boolean(state.preferences.masterMuted) ||
          state.preferences.masterLevel === 0
    const stopped = state.sleepTimer.status === "fired"
    const needsTap =
        !stopped &&
        (state.needsGesture ||
            Object.values(state.layers).some(
                (layer) => layer.status === "blocked" && layer.effectiveLevel > 0
            ))
    // A real problem, not a tap: a wanted loop gave up after its retries.
    const failed =
        !stopped &&
        (["soundscapes", "atmosphere"] as const).some(
            (layer) =>
                state.layers[layer].status === "failed" && state.layers[layer].effectiveLevel > 0
        )
    const status = stopped
        ? "sleep-stopped"
        : failed
          ? "failed"
          : needsTap
            ? "needs-tap"
            : muted
              ? "muted"
              : "on"
    const label = stopped
        ? labels.resume
        : failed
          ? labels.retry
          : needsTap
            ? labels.needsTap
            : muted
              ? labels.unmute
              : labels.mute
    const announcement = stopped
        ? labels.sleepStopped
        : failed
          ? labels.failed
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
                    if (independentMute) {
                        if (muted) {
                            mixer.setMasterMuted(false)
                            if (stopped) mixer.resumeAudio()
                            mixer.unlock()
                        } else if (stopped) mixer.resumeAudio()
                        else if (failed || needsTap) {
                            mixer.unlock()
                            if (failed) mixer.retryFailed()
                        } else mixer.setMasterMuted(true)
                    } else if (stopped) {
                        if (muted) mixer.setMasterMuted(false)
                        mixer.resumeAudio()
                    } else if (failed || needsTap) {
                        if (muted) {
                            mixer.setMasterEnabled(true)
                            mixer.setMasterMuted(false)
                        }
                        mixer.unlock()
                        if (failed) mixer.retryFailed()
                    } else {
                        mixer.setMasterEnabled(muted)
                        if (muted) {
                            mixer.setMasterMuted(false)
                            mixer.unlock()
                        }
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
