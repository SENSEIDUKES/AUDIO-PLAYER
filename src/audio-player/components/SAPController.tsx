import { useEffect, useRef, useState, useMemo } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { createPortal } from "react-dom"
import type { AudioPlayerTheme, RepeatMode } from "../types"
import { buildThemeVars } from "../skins/themeVars"
import { formatTime } from "../utils/formatTime"
import {
    AutomixIcon,
    AutoPlayIcon,
    CheckIcon,
    LyricsIcon,
    PluginIcon,
    QueueIcon,
    RepeatIcon,
    RepeatOneIcon,
    ShareIcon,
    ShuffleIcon,
    WaveIcon,
} from "../skins/icons"
import { WorkspaceShell } from "./workspace/WorkspaceShell"
import type { WorkspaceRoute } from "./workspace/workspaceRoutes"
import { useAudioSession } from "../session/AudioSessionContext"
import "./sap-controller.css"

/* The SAP Controller: one shared, screen-level command sheet for the advanced
   actions that used to be jammed onto every face (shuffle, repeat, automix,
   autoplay, queue, lyrics/info, share, plugins). Faces keep core transport
   visible and open this from their "…" button. Rendered through a portal so
   it can never clip inside a card, sidebar, or sticky bar. */

export interface SAPControllerPlayback {
    shuffle: boolean
    onToggleShuffle: () => void
    repeatMode: RepeatMode
    onCycleRepeat: () => void
    /** Omit to hide the Automix row (e.g. single-track players). */
    automix?: boolean
    onToggleAutomix?: () => void
    /** Omit to hide the Auto Play row (sessions have no autoplay toggle). */
    autoPlay?: boolean
    onToggleAutoPlay?: () => void
}

export interface SAPControllerQueue {
    count: number
    /** Open the queue UI. The controller closes itself before calling this. */
    onOpenQueue: () => void
}

export interface SAPControllerInfo {
    title: string
    artist: string
    /** Seconds; 0/NaN renders as a placeholder. */
    duration: number
    lyrics?: string
}

export interface SAPControllerShare {
    onShare: () => void
    copied: boolean
}

export interface SAPControllerProps extends AudioPlayerTheme {
    open: boolean
    onClose: () => void
    /**
     * Which workspace the sheet renders. Defaults to `"options"`, the legacy
     * three-dot content. Any other route renders the matching focused workspace
     * surface through the same portal/focus-trap shell.
     */
    route?: WorkspaceRoute
    /** Sections render only when their prop is provided. */
    playback?: SAPControllerPlayback
    queue?: SAPControllerQueue
    info?: SAPControllerInfo
    share?: SAPControllerShare
    /** Read-only list of active plugin names (standalone player for V1). */
    pluginNames?: readonly string[]
    /**
     * Waveform plugin settings. Provided only when the Waveform plugin is active;
     * renders the "Show Waveform" toggle that switches the scrubber between the
     * wavesurfer waveform and the basic progress bar.
     */
    waveform?: { enabled: boolean; onToggle: () => void }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="sap-ctl__section" aria-label={title}>
            <h3 className="sap-ctl__heading">{title}</h3>
            {children}
        </section>
    )
}

function SwitchRow({
    icon,
    label,
    on,
    onToggle,
}: {
    icon: ReactNode
    label: string
    on: boolean
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            className="sap-ctl__row ap-tap"
            role="switch"
            aria-checked={on}
            onClick={onToggle}
        >
            <span className="sap-ctl__label">
                {icon}
                {label}
            </span>
            <span className={`sap-ctl__switch${on ? " sap-ctl__switch--on" : ""}`} aria-hidden="true">
                <span className="sap-ctl__knob" />
            </span>
        </button>
    )
}

const CloseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
)

function KaraokeLyrics({ lyrics }: { lyrics: string }) {
    const { currentTime } = useAudioSession()
    const parsed = useMemo(() => {
        const lines = lyrics.split('\n')
        const result: { time: number; text: string }[] = []
        for (const line of lines) {
            const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/)
            if (match) {
                const m = parseInt(match[1], 10)
                const s = parseFloat(match[2])
                result.push({ time: m * 60 + s, text: match[3].trim() })
            } else {
                result.push({ time: -1, text: line })
            }
        }
        return result
    }, [lyrics])

    const containerRef = useRef<HTMLDivElement>(null)
    const isKaraoke = parsed.some((l) => l.time >= 0)

    if (!isKaraoke) {
        return <div className="sap-ctl__lyrics">{lyrics}</div>
    }

    let activeIndex = -1
    for (let i = 0; i < parsed.length; i++) {
        if (parsed[i].time >= 0 && currentTime >= parsed[i].time) {
            activeIndex = i
        }
    }

    useEffect(() => {
        if (activeIndex >= 0 && containerRef.current) {
            const container = containerRef.current
            const el = container.children[activeIndex] as HTMLElement
            if (el) {
                const containerRect = container.getBoundingClientRect()
                const elRect = el.getBoundingClientRect()
                const relativeTop = elRect.top - containerRect.top + container.scrollTop
                container.scrollTo({
                    top: relativeTop - containerRect.height / 2 + elRect.height / 2,
                    behavior: "smooth",
                })
            }
        }
    }, [activeIndex])

    return (
        <div className="sap-ctl__lyrics sap-ctl__lyrics--karaoke" ref={containerRef}>
            {parsed.map((line, idx) => (
                <div
                    key={idx}
                    className={`sap-ctl__lyric-line ${idx === activeIndex ? "sap-ctl__lyric-line--active" : ""}`}
                >
                    {line.text || '\u00A0'}
                </div>
            ))}
        </div>
    )
}

export function SAPController({
    open,
    onClose,
    route = "options",
    playback,
    queue,
    info,
    share,
    pluginNames,
    waveform,
    accentColor,
    playIconColor,
    textColor,
    progressColor,
    trackColor,
    backgroundColor,
}: SAPControllerProps) {
    const sheetRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const [lyricsOpen, setLyricsOpen] = useState(false)

    // Faces typically pass an inline onClose; route it through a ref so the
    // open/close effect doesn't re-run (and re-steal focus) on every render.
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    // Lock body scroll while the sheet is up (same pattern as QueueDrawer).
    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prev
        }
    }, [open])

    // Escape closes. Focus moves into the sheet on open and back to the
    // opener on close (whatever was focused before the sheet appeared).
    useEffect(() => {
        if (!open) return
        const opener = document.activeElement as HTMLElement | null
        const raf = requestAnimationFrame(() => {
            // Options renders its own header (closeRef); a workspace route's close
            // button lives inside WorkspaceShell, so fall back to the first
            // focusable in the sheet.
            if (closeRef.current) closeRef.current.focus()
            else
                sheetRef.current
                    ?.querySelector<HTMLElement>(
                        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
                    )
                    ?.focus()
        })
        const handleKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") onCloseRef.current()
        }
        document.addEventListener("keydown", handleKey)
        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener("keydown", handleKey)
            // The opener can unmount while the sheet is up (face switches,
            // queue empties); only restore focus to a node still in the DOM.
            if (opener?.isConnected) opener.focus()
        }
    }, [open])

    // Collapse lyrics whenever the sheet closes so it reopens tidy.
    useEffect(() => {
        if (!open) setLyricsOpen(false)
    }, [open])

    // Trap Tab inside the sheet — the page behind is inert while it's open.
    const handleTrapKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Tab" || !sheetRef.current) return
        const focusables = Array.from(
            sheetRef.current.querySelectorAll<HTMLElement>(
                "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
            )
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (!active || !sheetRef.current.contains(active)) {
            // Focus drifted outside the dialog — pull it back in.
            event.preventDefault()
            ;(event.shiftKey ? last : first).focus()
        } else if (event.shiftKey && active === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && active === last) {
            event.preventDefault()
            first.focus()
        }
    }

    if (!open || typeof document === "undefined") return null

    const themeVars = buildThemeVars({
        accentColor,
        playIconColor,
        textColor,
        progressColor,
        trackColor,
        backgroundColor,
    })

    const isOptions = route === "options"

    return createPortal(
        <div className="sap-ctl" style={themeVars}>
            <div className="sap-ctl__backdrop" onClick={onClose} aria-hidden="true" />
            <div
                ref={sheetRef}
                className="sap-ctl__sheet"
                role="dialog"
                aria-modal="true"
                aria-label={isOptions ? "Player options" : "Player workspace"}
                onKeyDown={handleTrapKeyDown}
            >
                <div className="sap-ctl__grab" aria-hidden="true" />
                {/* Focused workspace route: render workspace panel above options */}
                {!isOptions && (
                    <>
                        <WorkspaceShell
                            route={route}
                            onClose={onClose}
                            lyrics={info?.lyrics}
                        />
                        <div className="sap-ctl__divider" role="separator" aria-hidden="true" />
                    </>
                )}
                <header className="sap-ctl__header">
                    <h2 className="sap-ctl__title">{isOptions ? "Options" : "Options"}</h2>
                    <button
                        ref={closeRef}
                        type="button"
                        className="sap-ctl__close ap-tap"
                        onClick={onClose}
                        aria-label={isOptions ? "Close player options" : "Close workspace"}
                    >
                        <CloseIcon />
                    </button>
                </header>

                {playback && (
                    <Section title="Playback">
                        <SwitchRow
                            icon={<ShuffleIcon />}
                            label="Shuffle"
                            on={playback.shuffle}
                            onToggle={playback.onToggleShuffle}
                        />
                        <button
                            type="button"
                            className="sap-ctl__row ap-tap"
                            onClick={playback.onCycleRepeat}
                            aria-label={`Repeat: ${playback.repeatMode}. Activate to change.`}
                        >
                            <span className="sap-ctl__label">
                                {playback.repeatMode === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
                                Repeat
                            </span>
                            <span className="sap-ctl__value">{playback.repeatMode}</span>
                        </button>
                        {playback.onToggleAutomix && (
                            <SwitchRow
                                icon={<AutomixIcon />}
                                label="Automix"
                                on={playback.automix ?? false}
                                onToggle={playback.onToggleAutomix}
                            />
                        )}
                        {playback.onToggleAutoPlay && (
                            <SwitchRow
                                icon={<AutoPlayIcon />}
                                label="Auto Play"
                                on={playback.autoPlay ?? false}
                                onToggle={playback.onToggleAutoPlay}
                            />
                        )}
                    </Section>
                )}

                {queue && (
                    <Section title="Queue">
                        <button
                            type="button"
                            className="sap-ctl__row ap-tap"
                            onClick={() => {
                                onClose()
                                queue.onOpenQueue()
                            }}
                        >
                            <span className="sap-ctl__label">
                                <QueueIcon />
                                Up Next
                            </span>
                            <span className="sap-ctl__value">
                                {queue.count} track{queue.count !== 1 ? "s" : ""}
                            </span>
                        </button>
                    </Section>
                )}

                {info && (
                    <Section title="Info">
                        <div className="sap-ctl__meta">
                            <div className="sap-ctl__meta-row">
                                <span className="sap-ctl__meta-key">Track</span>
                                <span className="sap-ctl__meta-val">{info.title}</span>
                            </div>
                            <div className="sap-ctl__meta-row">
                                <span className="sap-ctl__meta-key">Artist</span>
                                <span className="sap-ctl__meta-val">{info.artist}</span>
                            </div>
                            <div className="sap-ctl__meta-row">
                                <span className="sap-ctl__meta-key">Length</span>
                                <span className="sap-ctl__meta-val">
                                    {Number.isFinite(info.duration) && info.duration > 0
                                        ? formatTime(info.duration)
                                        : "–:––"}
                                </span>
                            </div>
                        </div>
                        {info.lyrics && (
                            <>
                                <button
                                    type="button"
                                    className="sap-ctl__row ap-tap"
                                    onClick={() => setLyricsOpen((v) => !v)}
                                    aria-expanded={lyricsOpen}
                                >
                                    <span className="sap-ctl__label">
                                        <LyricsIcon />
                                        Lyrics
                                    </span>
                                    <span className="sap-ctl__value">
                                        {lyricsOpen ? "hide" : "show"}
                                    </span>
                                </button>
                                {lyricsOpen && (
                                    <KaraokeLyrics lyrics={info.lyrics} />
                                )}
                            </>
                        )}
                    </Section>
                )}

                {share && (
                    <Section title="Share">
                        <button
                            type="button"
                            className="sap-ctl__row ap-tap"
                            onClick={share.onShare}
                        >
                            <span className="sap-ctl__label">
                                {share.copied ? <CheckIcon /> : <ShareIcon />}
                                Share
                            </span>
                            {share.copied && <span className="sap-ctl__value">copied</span>}
                        </button>
                    </Section>
                )}

                {waveform && (
                    <Section title="Visual">
                        <SwitchRow
                            icon={<WaveIcon />}
                            label="Show Waveform"
                            on={waveform.enabled}
                            onToggle={waveform.onToggle}
                        />
                    </Section>
                )}

                {pluginNames && pluginNames.length > 0 && (
                    <Section title="Plugins">
                        <ul className="sap-ctl__plugins">
                            {pluginNames.map((name) => (
                                <li key={name} className="sap-ctl__plugin">
                                    <span className="sap-ctl__label">
                                        <PluginIcon />
                                        {name}
                                    </span>
                                    <span className="sap-ctl__value">active</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}
            </div>
        </div>,
        document.body
    )
}
