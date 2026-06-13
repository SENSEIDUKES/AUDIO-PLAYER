import { useState, useCallback } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { QueueDrawer } from "../components/QueueDrawer"
import { ProgressBar } from "../components/ProgressBar"
import { VolumeControl } from "../components/VolumeControl"
import { SAPController } from "../components/SAPController"
import { useShareTrack } from "../components/useShareTrack"
import { formatTime } from "../utils/formatTime"
import { buildThemeVars } from "./themeVars"
import {
    Back10Icon,
    DotsIcon,
    Fwd10Icon,
    NextIcon,
    PauseIcon,
    PlayIcon,
    PrevIcon,
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
 * so it reflects and controls whatever any other skin is doing. Core transport
 * only — shuffle, repeat, automix, queue, info, and share live in the SAP
 * Controller behind the "…" button. Renders nothing when the queue is empty.
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
    const [controllerOpen, setControllerOpen] = useState(false)

    const handleOpenQueue = useCallback(() => setQueueDrawerOpen(true), [])
    const handleCloseQueue = useCallback(() => setQueueDrawerOpen(false), [])

    const { share, copied: shareCopied, nativeShare } = useShareTrack(
        s.currentTrack?.title ?? "",
        s.currentTrack?.artist ?? ""
    )
    const handleShareClick = useCallback(() => {
        if (nativeShare) setControllerOpen(false)
        share()
    }, [nativeShare, share])

    // All hooks run before this bail-out so the hook order stays stable when
    // the queue transitions between empty and non-empty.
    if (s.queue.length === 0 || !s.currentTrack) return null

    const { currentTrack, isPlaying, isBuffering, shuffle, repeatMode, automix } = s
    // Engine gates `isBuffering` to active/pending playback (and clears it on
    // pause/ended), so the spinner can render straight from it.
    const showPlaySpinner = isBuffering

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

            {/* SAP Controller: shuffle/repeat/automix, queue, info, share. */}
            <SAPController
                open={controllerOpen}
                onClose={() => setControllerOpen(false)}
                playback={{
                    shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                queue={{ count: s.queue.length, onOpenQueue: handleOpenQueue }}
                info={{
                    title: currentTrack.title ?? "",
                    artist: currentTrack.artist ?? "",
                    duration: s.duration,
                    lyrics: currentTrack.lyrics,
                }}
                share={{ onShare: handleShareClick, copied: shareCopied }}
                {...theme}
            />

            <div className="ap-sb__inner">
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
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={s.previous}
                            disabled={!s.canPrevious}
                            aria-label="Previous track"
                        >
                            <PrevIcon />
                        </button>
                        <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={() => s.seekBy(-10)}
                            disabled={!s.hasAudio}
                            aria-label="Skip backward 10 seconds"
                        >
                            <Back10Icon />
                        </button>
                        <button
                            type="button"
                            className={`ap-btn ap-btn--play ap-sb__play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                            onClick={s.toggle}
                            disabled={!s.hasAudio}
                            aria-label={showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play"}
                        >
                            {showPlaySpinner ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>
                        <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={() => s.seekBy(10)}
                            disabled={!s.hasAudio}
                            aria-label="Skip forward 10 seconds"
                        >
                            <Fwd10Icon />
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
                            className="ap-icon-btn ap-tap"
                            onClick={() => setControllerOpen(true)}
                            aria-label="Player options"
                            aria-haspopup="dialog"
                            aria-expanded={controllerOpen}
                        >
                            <DotsIcon />
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
        </div>
    )
}

export default StickyBottomPlayer
