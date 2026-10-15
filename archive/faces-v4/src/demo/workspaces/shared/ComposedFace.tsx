import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
    CSSProperties,
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
} from "react"
import {
    Ellipsis,
    LoaderCircle,
    Pause,
    Play,
    Repeat,
    Repeat1,
    RotateCcw,
    RotateCw,
    Shuffle,
    SkipBack,
    SkipForward,
} from "lucide-react"
import {
    PlayerSurfaceButtons,
    ProgressBar,
    QueueSurface,
    TrackMetadata,
    VolumeControl,
    WaveformAdapter,
    formatTime,
    getScrubberDensity,
    trackKey,
    useAudioSession,
    useAudioTime,
    usePlayerSurface,
    useShareTrack,
} from "../../../audio-player"
import type { AudioPlayerTheme, TrackMetadataVariant, WorkspaceRoute } from "../../../audio-player"
import { PIECES, pieceOption } from "./faceSpec"
import type { FaceInteractions, FaceSpec, PieceInstance } from "./faceSpec"
import { themeFor } from "./themes"
import "./composed-face.css"

/* Renders a New Face composition against the surrounding AudioSessionProvider.
   Each piece is a public package building block (or a plain control over the
   public session API), so a composed face never needs a second engine and
   plays, seeks, and errors exactly like the bundled faces. */

export interface ComposedFaceProps {
    spec: FaceSpec
    /** CSS background-image for the artwork when the track carries none. */
    art?: string
    /** Opens the host's SAP controller (the action menu and gestures use it). */
    onOpenController?: (route: WorkspaceRoute) => void
    /** Reports each gesture and what it did, for an interaction log. */
    onInteraction?: (description: string) => void
    /** Flash a short label on the surface when a gesture fires. */
    gestureHints?: boolean
    /** Shown inside an empty surface. */
    emptyMessage?: string
}

/**
 * The `--ap-*` custom properties the package's pieces read (ProgressBar,
 * VolumeControl, TrackMetadata). This mirrors the contract every bundled face
 * sets on its root, with the same dark-glass defaults.
 */
function themeVars(theme: AudioPlayerTheme): CSSProperties {
    const {
        accentColor = "#FFFFFF",
        playIconColor = "#000000",
        textColor = "#FFFFFF",
        progressColor = "#FFFFFF",
        trackColor = "rgba(204, 204, 204, 0.35)",
        backgroundColor = "rgba(20, 20, 28, 0.6)",
        glowColor = "transparent",
        glowIntensity = 100,
        buttonOpacity = 0,
    } = theme
    return {
        "--ap-accent": accentColor,
        "--ap-play-icon": playIconColor,
        "--ap-text": textColor,
        "--ap-progress": progressColor,
        "--ap-track": trackColor,
        "--ap-bg": backgroundColor,
        "--ap-glow": glowColor,
        "--ap-glow-intensity": glowIntensity / 100,
        "--ap-btn-opacity-delta": `${buttonOpacity}%`,
    } as CSSProperties
}

/* ----------------------------- Pieces ----------------------------- */

function ArtworkPiece({ piece }: { piece: PieceInstance }) {
    const { currentTrack, isPlaying } = useAudioSession()
    const motion = pieceOption(piece, "motion")
    return (
        <div
            className={[
                "nf-art",
                `nf-art--${pieceOption(piece, "size")}`,
                `nf-art--${pieceOption(piece, "shape")}`,
                isPlaying && motion !== "none" ? `nf-art--${motion}` : "",
            ]
                .filter(Boolean)
                .join(" ")}
            role="img"
            aria-label={currentTrack ? `Artwork for ${currentTrack.title}` : "Artwork"}
        />
    )
}

function TitlePiece({ piece }: { piece: PieceInstance }) {
    const { currentTrack } = useAudioSession()
    return (
        <div className={`nf-title nf-text-align--${pieceOption(piece, "align")}`}>
            <TrackMetadata
                track={currentTrack}
                variant={pieceOption(piece, "variant") as TrackMetadataVariant}
                enableMarquee={pieceOption(piece, "marquee") === "on"}
                titleFallback="Nothing playing"
                artistFallback="—"
            />
        </div>
    )
}

function TextPiece({ piece }: { piece: PieceInstance }) {
    const style = pieceOption(piece, "style")
    const className = `nf-text nf-text--${style} nf-text-align--${pieceOption(piece, "align")}`
    return style === "heading" ? (
        <h2 className={className}>{piece.text}</h2>
    ) : (
        <p className={className}>{piece.text}</p>
    )
}

function PlayButton({ size = "m" }: { size?: string }) {
    const s = useAudioSession()
    const label = s.isBuffering ? "Buffering audio" : s.isPlaying ? "Pause" : "Play"
    const icon = size === "l" ? 30 : size === "s" ? 18 : 24
    return (
        <button
            type="button"
            className={`nf-btn nf-btn--play nf-btn--${size}`}
            onClick={s.toggle}
            disabled={!s.hasAudio}
            aria-label={label}
        >
            {s.isBuffering ? (
                <LoaderCircle size={icon} className="nf-spin" />
            ) : s.isPlaying ? (
                <Pause size={icon} fill="currentColor" />
            ) : (
                <Play size={icon} fill="currentColor" />
            )}
        </button>
    )
}

function TransportPiece({ piece }: { piece: PieceInstance }) {
    const s = useAudioSession()
    const skip = pieceOption(piece, "skip")
    const tracks = skip !== "seconds"
    const seconds = skip !== "tracks"
    return (
        <div className="nf-transport" role="group" aria-label="Transport">
            {tracks && (
                <button
                    type="button"
                    className="nf-btn"
                    onClick={s.previous}
                    disabled={!s.canPrevious}
                    aria-label="Previous track"
                >
                    <SkipBack size={18} />
                </button>
            )}
            {seconds && (
                <button
                    type="button"
                    className="nf-btn"
                    onClick={() => s.seekBy(-10)}
                    disabled={!s.hasAudio}
                    aria-label="Back 10 seconds"
                >
                    <RotateCcw size={18} />
                </button>
            )}
            <PlayButton />
            {seconds && (
                <button
                    type="button"
                    className="nf-btn"
                    onClick={() => s.seekBy(10)}
                    disabled={!s.hasAudio}
                    aria-label="Forward 10 seconds"
                >
                    <RotateCw size={18} />
                </button>
            )}
            {tracks && (
                <button
                    type="button"
                    className="nf-btn"
                    onClick={s.next}
                    disabled={!s.canNext}
                    aria-label="Next track"
                >
                    <SkipForward size={18} />
                </button>
            )}
        </div>
    )
}

function Times() {
    const { currentTime, duration } = useAudioTime()
    return (
        <div className="nf-times" aria-hidden="true">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
        </div>
    )
}

function ScrubberPiece({ piece }: { piece: PieceInstance }) {
    const s = useAudioSession()
    const { currentTime, duration, buffered } = useAudioTime()
    return (
        <div className="nf-scrubber">
            <ProgressBar
                currentTime={currentTime}
                duration={duration}
                buffered={buffered}
                disabled={!s.hasAudio}
                isSeeking={s.isSeeking}
                onSeek={s.seek}
                onSeekStart={() => s.setSeeking(true)}
                onSeekEnd={() => s.setSeeking(false)}
            />
            {pieceOption(piece, "times") === "on" && <Times />}
        </div>
    )
}

const WAVEFORM_HEIGHT: Record<string, number> = { s: 32, m: 48, l: 72 }

function WaveformPiece({ piece }: { piece: PieceInstance }) {
    const s = useAudioSession()
    const { currentTime, duration, buffered } = useAudioTime()
    const { currentTrack } = s
    return (
        <div className="nf-scrubber">
            <WaveformAdapter
                face="fullCard"
                density={getScrubberDensity("fullCard")}
                waveform
                currentTime={currentTime}
                duration={duration}
                buffered={buffered}
                disabled={!s.hasAudio}
                isSeeking={s.isSeeking}
                onSeek={s.seek}
                onSeekStart={() => s.setSeeking(true)}
                onSeekEnd={() => s.setSeeking(false)}
                peaks={currentTrack?.peaks}
                peaksDuration={currentTrack?.waveformDuration}
                getDecodedData={s.getDecodedData}
                url={s.getBackendInfo().active === "html5" ? s.currentSrc : undefined}
                sourceKey={currentTrack ? trackKey(currentTrack) : undefined}
                height={WAVEFORM_HEIGHT[pieceOption(piece, "height")]}
            />
            <Times />
        </div>
    )
}

function TimePiece({ piece }: { piece: PieceInstance }) {
    const { currentTime, duration } = useAudioTime()
    const format = pieceOption(piece, "format")
    const remaining = `−${formatTime(Math.max(0, duration - currentTime))}`
    const text =
        format === "elapsed"
            ? formatTime(currentTime)
            : format === "remaining"
              ? remaining
              : `${formatTime(currentTime)} / ${formatTime(duration)}`
    return <span className="nf-time">{text}</span>
}

function VolumePiece() {
    const s = useAudioSession()
    return (
        <VolumeControl
            volume={s.volume}
            isMuted={s.isMuted}
            disabled={!s.hasAudio}
            volumeUnsupported={s.volumeUnsupported}
            onVolumeChange={s.setVolume}
            onToggleMute={s.toggleMute}
        />
    )
}

function ModesPiece() {
    const s = useAudioSession()
    return (
        <div className="nf-modes" role="group" aria-label="Shuffle and repeat">
            <button
                type="button"
                className="nf-btn"
                onClick={s.toggleShuffle}
                aria-pressed={s.shuffle}
                aria-label="Shuffle"
            >
                <Shuffle size={18} />
            </button>
            <button
                type="button"
                className="nf-btn"
                onClick={s.cycleRepeat}
                aria-pressed={s.repeatMode !== "off"}
                aria-label={`Repeat: ${s.repeatMode}`}
            >
                {s.repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
        </div>
    )
}

function MenuPiece({
    piece,
    onOpenController,
}: {
    piece: PieceInstance
    onOpenController?: (route: WorkspaceRoute) => void
}) {
    const s = useAudioSession()
    // A compact surface: no SEI Canvas, so the menu leaves its Canvas leaf out.
    const surface = usePlayerSurface("miniSidebar")
    const { share } = useShareTrack(s.currentTrack?.title ?? "", s.currentTrack?.artist ?? "")
    const commands = useMemo(
        () => ({
            "track.previous": s.previous,
            "track.next": s.next,
            ...(s.currentTrack ? { "share.url": share } : {}),
        }),
        [s.previous, s.next, s.currentTrack, share]
    )
    return (
        <div className="nf-menu">
            <PlayerSurfaceButtons
                surface={surface}
                showCanvasButton={false}
                activePluginIds={s.pluginNames}
                commands={commands}
                canPrevious={s.canPrevious}
                canNext={s.canNext}
                onOpenFocusedController={onOpenController}
            />
            {pieceOption(piece, "more") === "on" && (
                <button
                    type="button"
                    className="nf-btn"
                    onClick={() => onOpenController?.("options")}
                    disabled={!onOpenController}
                    aria-label="More options"
                >
                    <Ellipsis size={18} />
                </button>
            )}
        </div>
    )
}

function StatusPiece() {
    const s = useAudioSession()
    const position = s.queue.length ? `Track ${s.currentIndex + 1} of ${s.queue.length}` : "Empty"
    if (s.hasError) {
        return (
            <div className="nf-status nf-status--error" role="alert">
                <span>{s.errorMessage || "This track can't play."}</span>
                <button type="button" className="nf-status__retry" onClick={s.retry}>
                    Retry
                </button>
            </div>
        )
    }
    const state = !s.hasAudio
        ? "Audio file missing"
        : s.isBuffering
          ? "Loading…"
          : s.isPlaying
            ? "Playing"
            : "Paused"
    return (
        <p className="nf-status" role="status">
            {state} · {position}
        </p>
    )
}

function UpNextPiece() {
    const s = useAudioSession()
    const last = s.currentIndex + 1 >= s.queue.length
    const nextIndex = !last
        ? s.currentIndex + 1
        : s.repeatMode === "all" && s.queue.length > 1
          ? 0
          : -1
    const next = s.shuffle || nextIndex < 0 ? null : s.queue[nextIndex]
    return (
        <button
            type="button"
            className="nf-upnext"
            onClick={() => s.playTrack(nextIndex)}
            disabled={!next}
        >
            <span className="nf-upnext__label">Up next</span>
            <span className="nf-upnext__title">
                {next
                    ? `${next.title} — ${next.artist}`
                    : s.shuffle
                      ? "Shuffle picks the next track"
                      : "End of the queue"}
            </span>
        </button>
    )
}

function PieceView({
    piece,
    onOpenController,
}: {
    piece: PieceInstance
    onOpenController?: (route: WorkspaceRoute) => void
}) {
    switch (piece.kind) {
        case "artwork":
            return <ArtworkPiece piece={piece} />
        case "title":
            return <TitlePiece piece={piece} />
        case "text":
            return <TextPiece piece={piece} />
        case "play":
            return <PlayButton size={pieceOption(piece, "size")} />
        case "transport":
            return <TransportPiece piece={piece} />
        case "scrubber":
            return <ScrubberPiece piece={piece} />
        case "waveform":
            return <WaveformPiece piece={piece} />
        case "time":
            return <TimePiece piece={piece} />
        case "volume":
            return <VolumePiece />
        case "modes":
            return <ModesPiece />
        case "menu":
            return <MenuPiece piece={piece} onOpenController={onOpenController} />
        case "status":
            return <StatusPiece />
        case "upnext":
            return <UpNextPiece />
        case "queue":
            return <QueueSurface maxItems={Number(pieceOption(piece, "rows"))} />
        case "divider":
            return pieceOption(piece, "style") === "line" ? (
                <hr className="nf-divider" />
            ) : (
                <div className="nf-space" aria-hidden="true" />
            )
    }
}

/* ----------------------------- Gestures ----------------------------- */

type FaceAction = "toggle" | "controller" | "next" | "previous" | "forward" | "back" | "restart"

const ACTION_LABELS: Record<FaceAction, string> = {
    toggle: "play / pause",
    controller: "open the controller",
    next: "next track",
    previous: "previous track",
    forward: "+10 seconds",
    back: "−10 seconds",
    restart: "restart the track",
}

const TAP_SLOP = 10
const SWIPE_MIN = 48
const LONG_PRESS_MS = 550
const DOUBLE_TAP_MS = 280
const REVEAL_MS = 3500

/** Buttons, sliders, links, fields, and menus keep their own clicks and keys. */
function isOwnControl(target: EventTarget | null, surface: HTMLElement): boolean {
    if (!(target instanceof Element)) return false
    const control = target.closest(
        "button, a, input, select, textarea, [role='slider'], [role='button'], [role='menu'], [role='menuitem'], [role='dialog']"
    )
    return control !== null && control !== surface && surface.contains(control)
}

interface PointerStart {
    id: number
    x: number
    y: number
    moved: boolean
    longFired: boolean
}

function useFaceGestures(
    interactions: FaceInteractions,
    run: (action: FaceAction, gesture: string) => void
) {
    const start = useRef<PointerStart | null>(null)
    const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastTap = useRef(0)
    const [revealed, setRevealed] = useState(false)
    const revealedRef = useRef(false)

    const clear = (timer: { current: ReturnType<typeof setTimeout> | null }) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
    }

    useEffect(
        () => () => {
            clear(longTimer)
            clear(tapTimer)
            clear(revealTimer)
        },
        []
    )

    const reveal = useCallback(() => {
        revealedRef.current = true
        setRevealed(true)
        clear(revealTimer)
        revealTimer.current = setTimeout(() => {
            revealedRef.current = false
            setRevealed(false)
        }, REVEAL_MS)
    }, [])

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || isOwnControl(event.target, event.currentTarget)) return
        // Keep receiving the gesture if the pointer drifts off the surface mid-swipe.
        try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
        } catch {
            // Capture is best-effort.
        }
        start.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
            longFired: false,
        }
        clear(longTimer)
        if (interactions.longPress !== "none") {
            const action = interactions.longPress
            longTimer.current = setTimeout(() => {
                if (!start.current || start.current.moved) return
                start.current.longFired = true
                run(action, "Long-press")
            }, LONG_PRESS_MS)
        }
    }

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = start.current
        if (!current || current.id !== event.pointerId || current.moved) return
        const dx = event.clientX - current.x
        const dy = event.clientY - current.y
        if (Math.hypot(dx, dy) > TAP_SLOP) {
            current.moved = true
            clear(longTimer)
        }
    }

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = start.current
        start.current = null
        clear(longTimer)
        if (!current || current.id !== event.pointerId || current.longFired) return
        const dx = event.clientX - current.x
        const dy = event.clientY - current.y

        if (interactions.swipe !== "none" && Math.abs(dx) >= SWIPE_MIN) {
            if (Math.abs(dx) > Math.abs(dy) * 1.3) {
                const forward = dx < 0
                const action: FaceAction =
                    interactions.swipe === "tracks"
                        ? forward
                            ? "next"
                            : "previous"
                        : forward
                          ? "forward"
                          : "back"
                run(action, forward ? "Swipe left" : "Swipe right")
            }
            return
        }
        if (Math.hypot(dx, dy) > TAP_SLOP) return

        // With hidden controls, the first touch only shows them.
        if (interactions.reveal && event.pointerType !== "mouse" && !revealedRef.current) {
            reveal()
            return
        }
        if (interactions.reveal) reveal()

        const tap = interactions.tap
        if (interactions.doubleTap !== "none") {
            const now = Date.now()
            if (now - lastTap.current < DOUBLE_TAP_MS) {
                lastTap.current = 0
                clear(tapTimer)
                run(interactions.doubleTap, "Double-tap")
                return
            }
            lastTap.current = now
            if (tap !== "none") {
                clear(tapTimer)
                tapTimer.current = setTimeout(() => run(tap, "Tap"), DOUBLE_TAP_MS)
            }
            return
        }
        if (tap !== "none") run(tap, "Tap")
    }

    const onPointerCancel = () => {
        start.current = null
        clear(longTimer)
    }

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, revealed }
}

/* ----------------------------- Face ----------------------------- */

export function ComposedFace({
    spec,
    art,
    onOpenController,
    onInteraction,
    gestureHints = false,
    emptyMessage = "Blank surface. Add pieces to start a new face.",
}: ComposedFaceProps) {
    const s = useAudioSession()
    const { layout, interactions } = spec
    const theme = useMemo(() => themeFor(layout.theme), [layout.theme])
    const [hint, setHint] = useState<{ id: number; text: string } | null>(null)

    useEffect(() => {
        if (!hint) return
        const timer = setTimeout(() => setHint(null), 1400)
        return () => clearTimeout(timer)
    }, [hint])

    const run = useCallback(
        (action: FaceAction, gesture: string) => {
            switch (action) {
                case "toggle":
                    s.toggle()
                    break
                case "controller":
                    onOpenController?.("options")
                    break
                case "next":
                    if (s.canNext) s.next()
                    break
                case "previous":
                    if (s.canPrevious) s.previous()
                    break
                case "forward":
                    s.seekBy(10)
                    break
                case "back":
                    s.seekBy(-10)
                    break
                case "restart":
                    s.seek(0)
                    break
            }
            const text = `${gesture} → ${ACTION_LABELS[action]}`
            onInteraction?.(text)
            if (gestureHints) setHint({ id: Date.now(), text })
        },
        [s, onOpenController, onInteraction, gestureHints]
    )

    const gestures = useFaceGestures(interactions, run)

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!interactions.keyboard || event.altKey || event.ctrlKey || event.metaKey) return
        if (isOwnControl(event.target, event.currentTarget)) return
        let action: FaceAction | null = null
        let key = event.key
        switch (event.key) {
            case " ":
            case "k":
                action = "toggle"
                key = event.key === " " ? "Space" : "K"
                break
            case "ArrowRight":
            case "l":
                action = event.shiftKey ? "next" : "forward"
                break
            case "ArrowLeft":
            case "j":
                action = event.shiftKey ? "previous" : "back"
                break
            case "m":
                event.preventDefault()
                s.toggleMute()
                onInteraction?.(`M → ${s.isMuted ? "unmute" : "mute"}`)
                return
        }
        if (!action) return
        event.preventDefault()
        run(action, `${event.shiftKey ? "Shift+" : ""}${key}`)
    }

    const artwork = s.currentTrack?.artwork ? `url("${s.currentTrack.artwork}")` : art
    const hasGestures =
        interactions.tap !== "none" ||
        interactions.doubleTap !== "none" ||
        interactions.swipe !== "none" ||
        interactions.longPress !== "none"

    const className = [
        "nf-surface",
        `nf-surface--${layout.direction}`,
        `nf-align--${layout.align}`,
        `nf-gap--${layout.gap}`,
        `nf-pad--${layout.padding}`,
        `nf-shape--${layout.shape}`,
        `nf-bg--${layout.background}`,
        hasGestures ? "nf-surface--gestures" : "",
        interactions.swipe !== "none" ? "nf-surface--swipe" : "",
        interactions.reveal ? "nf-surface--reveal" : "",
        gestures.revealed ? "is-revealed" : "",
    ]
        .filter(Boolean)
        .join(" ")

    return (
        <div
            className={className}
            style={{
                ...themeVars(theme),
                ...(artwork ? ({ "--nf-art": artwork } as CSSProperties) : {}),
            }}
            role="region"
            aria-label="New Face"
            tabIndex={interactions.keyboard ? 0 : undefined}
            aria-keyshortcuts={
                interactions.keyboard
                    ? "Space K ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight M"
                    : undefined
            }
            onPointerDown={gestures.onPointerDown}
            onPointerMove={gestures.onPointerMove}
            onPointerUp={gestures.onPointerUp}
            onPointerCancel={gestures.onPointerCancel}
            onKeyDown={onKeyDown}
        >
            {layout.background === "artwork" && (
                <div className="nf-surface__backdrop" aria-hidden="true">
                    <span />
                </div>
            )}
            {spec.pieces.length === 0 ? (
                <p className="nf-empty">{emptyMessage}</p>
            ) : (
                spec.pieces.map((piece) => {
                    const definition = PIECES[piece.kind]
                    // Full-size artwork spans the surface like the other wide pieces.
                    const wide =
                        definition.wide ||
                        (piece.kind === "artwork" && pieceOption(piece, "size") === "full")
                    return (
                        <div
                            key={piece.id}
                            className={[
                                "nf-piece",
                                `nf-piece--${piece.kind}`,
                                definition.control ? "nf-piece--control" : "",
                                wide ? "nf-piece--wide" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            <PieceView piece={piece} onOpenController={onOpenController} />
                        </div>
                    )
                })
            )}
            {hint && (
                <span key={hint.id} className="nf-hint" aria-hidden="true">
                    {hint.text}
                </span>
            )}
        </div>
    )
}
