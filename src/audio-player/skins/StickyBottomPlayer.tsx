import { useState, useCallback } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { QueueDrawer } from "../components/QueueDrawer"
import { ProgressBar } from "../components/ProgressBar"
import { VolumeControl } from "../components/VolumeControl"
import { formatTime } from "../utils/formatTime"
import { buildThemeVars } from "./themeVars"
import {
    AutomixIcon,
    NextIcon,
    PauseIcon,
    PlayIcon,
    PrevIcon,
    RepeatIcon,
    RepeatOneIcon,
    ShuffleIcon,
    SpinnerIcon,
} from "./icons"
import "./skins.css"

export interface StickyBottomPlayerProps extends AudioPlayerTheme {
    /** Use CSS `position: fixed` to pin to the viewport bottom. Defaults to true. */
    fixed?: boolean
    /** Show the volume control (hidden on narrow layouts by default). */
    showVolume?: boolean
    className?: string
    style?: CSSProperties
}

/**
 * An always-visible now-playing bar (Spotify-style). Reads the shared session,
 * so it reflects and controls whatever any other skin is doing. Renders nothing
 * when the queue is empty.
 */
export function StickyBottomPlayer({
    fixed = true,
    showVolume = true,
    className,
    style,
    ...theme
}: StickyBottomPlayerProps) {
    const s = useAudioSession()
    const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)

    if (s.queue.length === 0 || !s.currentTrack) return null

    const { currentTrack, isPlaying, isBuffering, shuffle, repeatMode, automix } = s

    const handleOpenQueue = useCallback(() => setQueueDrawerOpen(true), [])
    const handleCloseQueue = useCallback(() => setQueueDrawerOpen(false), [])

    return (
        <div
            className={`ap-sb${fixed ? " ap-sb--fixed" : ""}${className ? ` ${className}` : ""}`}
            style={{ ...buildThemeVars(theme), ...style }}
            role="region"
            aria-label="Playback bar"
        >
            {/* Queue drawer (Up Next) — reads session queue directly */}
            <QueueDrawer
                queue={s.queue}
                currentIndex={s.currentIndex}
                isPlaying={s.isPlaying}
                open={queueDrawerOpen}
                onClose={handleCloseQueue}
                onPlayTrack={s.playTrack}
                onReorder={s.moveQueueItem}
                onRemove={s.removeFromQueue}
            />

            <div className="ap-sb__meta">
                <span className="ap-sb__title" title={currentTrack.title}>
                    {currentTrack.title}
                </span>
                <span className="ap-sb__artist" title={currentTrack.artist}>
                    {currentTrack.artist}
                </span>
            </div>

            <div className="ap-sb__center">
                <div className="ap-sb__controls">
                    <button
                        type="button"
                        className={`ap-icon-btn ap-tap${shuffle ? " ap-fc__toggle--on" : ""}`}
                        onClick={s.toggleShuffle}
                        aria-label="Shuffle"
                        aria-pressed={shuffle}
                    >
                        <ShuffleIcon />
                    </button>
                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                        onClick={s.previous}
                        disabled={!s.canPrevious}
                        aria-label="Previous track"
                    >
                        <PrevIcon />
                    </button>
                    <button
                        type="button"
                        className={`ap-btn ap-btn--play ap-sb__play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                        onClick={s.toggle}
                        disabled={!s.hasAudio}
                        aria-label={isBuffering ? "Buffering audio" : isPlaying ? "Pause" : "Play"}
                    >
                        {isBuffering ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                        onClick={s.next}
                        disabled={!s.canNext}
                        aria-label="Next track"
                    >
                        <NextIcon />
                    </button>
                    <button
                        type="button"
                        className={`ap-icon-btn ap-tap${repeatMode !== "off" ? " ap-fc__toggle--on" : ""}`}
                        onClick={s.cycleRepeat}
                        aria-label={`Repeat: ${repeatMode}`}
                    >
                        {repeatMode === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
                    </button>
                    <button
                        type="button"
                        className={`ap-icon-btn ap-tap${automix ? " ap-fc__toggle--on" : ""}`}
                        onClick={s.toggleAutomix}
                        aria-label="Automix Lite"
                        aria-pressed={automix}
                    >
                        <AutomixIcon />
                    </button>
                    <button
                        type="button"
                        className="ap-icon-btn ap-tap"
                        onClick={handleOpenQueue}
                        aria-label="Up next queue"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="ap-sb__scrub">
                    <span className="ap-sb__t" aria-hidden="true">{formatTime(s.currentTime)}</span>
                    <ProgressBar
                        currentTime={s.currentTime}
                        duration={s.duration}
                        buffered={s.buffered}
                        disabled={!s.hasAudio}
                        isSeeking={s.isSeeking}
                        onSeek={s.seek}
                        onSeekStart={() => s.setSeeking(true)}
                        onSeekEnd={() => s.setSeeking(false)}
                    />
                    <span className="ap-sb__t" aria-hidden="true">{formatTime(s.duration)}</span>
                </div>
            </div>

            {showVolume && (
                <div className="ap-sb__volume">
                    <VolumeControl
                        volume={s.volume}
                        isMuted={s.isMuted}
                        disabled={!s.hasAudio}
                        volumeUnsupported={s.volumeUnsupported}
                        onVolumeChange={s.setVolume}
                        onToggleMute={s.toggleMute}
                    />
                </div>
            )}
        </div>
    )
}

export default StickyBottomPlayer