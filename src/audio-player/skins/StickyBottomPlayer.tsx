import { useState, useCallback, useMemo } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { WaveformAdapter } from "../components/WaveformAdapter"
import { VolumeControl } from "../components/VolumeControl"
import { SAPController } from "../components/SAPController"
import { HoldSkipButton } from "../components/HoldSkipButton"
import { useShareTrack } from "../components/useShareTrack"
import { ExplicitBadge } from "../components/TrackMetadata"
import { AudioTimeText } from "../components/AudioTimeText"
import { formatSecondaryLine, formatVersionedTitle } from "../utils/formatMetadata"
import { defaultShowVolume } from "../utils/device"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { PlayerSurfaceButtons } from "../surfaces/PlayerSurfaceButtons"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import { buildThemeVars } from "./themeVars"
import { DotsIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, SpinnerIcon } from "./icons"
import "./skins.css"

export interface StickyBottomPlayerProps extends AudioPlayerTheme {
    /** Use CSS `position: fixed` to pin to the viewport bottom. Defaults to true. */
    fixed?: boolean
    /**
     * Show the volume slider. Defaults to `true` on desktop and `false` on
     * mobile/touch devices (e.g. iOS Safari), where programmatic volume is
     * ignored and the mute button is the reliable control. Pass an explicit
     * boolean to override the per-device default.
     */
    showVolume?: boolean
    className?: string
    style?: CSSProperties
}

/**
 * An always-visible now-playing bar (Spotify-style). Reads the shared session,
 * so it reflects and controls whatever any other skin is doing. Core transport
 * only — shuffle, repeat, automix, queue, info, and share live in the SAP
 * Controller behind the "…" button. Renders nothing when the queue is empty.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.stickyBottom`): a compact bar
 * carrying both entry points into the one controller — its "…" button (opening
 * Options) and the shared radial action menu beside it (opening any workspace
 * route directly). `supportsSEICanvas: false`, so the canvas zone and the menu's
 * Canvas leaf are filtered out; that is the only difference from a primary face's
 * menu. Its scrubber runs through `ScrubberCanvasHost` (compact density) so the
 * timeline is a real plugin mount point.
 */
export function StickyBottomPlayer({
    fixed = true,
    showVolume = defaultShowVolume(),
    className,
    style,
    ...theme
}: StickyBottomPlayerProps) {
    const s = useAudioSession()
    const surface = usePlayerSurface("stickyBottom")
    const [controllerOpen, setControllerOpen] = useState(false)
    const [controllerRoute, setControllerRoute] = useState<WorkspaceRoute>("options")

    const {
        share,
        copied: shareCopied,
        nativeShare,
    } = useShareTrack(s.currentTrack?.title ?? "", s.currentTrack?.artist ?? "")
    const handleShareClick = useCallback(() => {
        if (nativeShare) setControllerOpen(false)
        share()
    }, [nativeShare, share])

    // Both entry points drive one controller: "…" opens Options, a radial
    // settings action opens that action's workspace.
    const handleOpenOptions = useCallback(() => {
        setControllerRoute("options")
        setControllerOpen(true)
    }, [])
    const handleOpenFocusedController = useCallback((route: WorkspaceRoute) => {
        setControllerRoute(route)
        setControllerOpen(true)
    }, [])
    const handleCloseController = useCallback(() => {
        setControllerOpen(false)
        setControllerRoute("options")
    }, [])

    const menuCommands = useMemo(
        () => ({
            "track.previous": s.previous,
            "track.next": s.next,
            "share.url": handleShareClick,
        }),
        [s.previous, s.next, handleShareClick]
    )

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
            {/* The single controller instance: Options plus every workspace the
                radial menu beside the "…" button routes into. */}
            <SAPController
                open={controllerOpen}
                onClose={handleCloseController}
                route={controllerRoute}
                playback={{
                    shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                queue={{
                    count: s.queue.length,
                    tracks: s.queue,
                    currentIndex: s.currentIndex,
                    isPlaying: s.isPlaying,
                    onPlayTrack: s.playTrack,
                    onRemove: s.removeFromQueue,
                }}
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
                    <span
                        className="ap-sb__title"
                        title={formatVersionedTitle(currentTrack.title, currentTrack.versionLabel)}
                    >
                        {formatVersionedTitle(currentTrack.title, currentTrack.versionLabel)}
                        {currentTrack.explicit && <ExplicitBadge />}
                    </span>
                    <span className="ap-sb__artist" title={formatSecondaryLine(currentTrack)}>
                        {formatSecondaryLine(currentTrack)}
                    </span>
                </div>

                <div className="ap-sb__center">
                    <div className="ap-sb__controls">
                        <HoldSkipButton
                            direction="previous"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            disabled={!s.hasAudio}
                            skipDisabled={!s.canPrevious}
                            seekLabel="Skip backward 10 seconds"
                            skipLabel="Previous track"
                            onSeek={() => s.seekBy(-10)}
                            onSkip={s.previous}
                        >
                            <PrevIcon />
                        </HoldSkipButton>
                        <button
                            type="button"
                            className={`ap-btn ap-btn--play ap-sb__play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                            onClick={s.toggle}
                            disabled={!s.hasAudio}
                            aria-label={
                                showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play"
                            }
                        >
                            {showPlaySpinner ? (
                                <SpinnerIcon />
                            ) : isPlaying ? (
                                <PauseIcon />
                            ) : (
                                <PlayIcon />
                            )}
                        </button>
                        <HoldSkipButton
                            direction="next"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            disabled={!s.hasAudio}
                            skipDisabled={!s.canNext}
                            seekLabel="Skip forward 10 seconds"
                            skipLabel="Next track"
                            onSeek={() => s.seekBy(10)}
                            onSkip={s.next}
                        >
                            <NextIcon />
                        </HoldSkipButton>
                        <button
                            type="button"
                            className="ap-icon-btn ap-tap"
                            onClick={handleOpenOptions}
                            aria-label="Player options"
                            aria-haspopup="dialog"
                            aria-expanded={controllerOpen}
                        >
                            <DotsIcon />
                        </button>
                        {/* Same canonical menu as every other music face, placed
                            inline in the bar instead of a dock. */}
                        <PlayerSurfaceButtons
                            surface={surface}
                            activePluginIds={s.pluginNames}
                            commands={menuCommands}
                            canPrevious={s.canPrevious}
                            canNext={s.canNext}
                            onOpenFocusedController={handleOpenFocusedController}
                            className="ap-sb__actions"
                        />
                    </div>
                    <div className="ap-sb__scrub">
                        <span className="ap-sb__t" aria-hidden="true">
                            <AudioTimeText value="currentTime" fallback={s.currentTime} />
                        </span>
                        {/* ScrubberCanvasHost (Phase 3): the timeline render zone /
                            future plugin mount point. The bespoke ProgressBar is
                            passed as children, so seeking is byte-identical. */}
                        <ScrubberCanvasHost
                            face="stickyBottom"
                            density={getScrubberDensity("stickyBottom")}
                            currentTime={s.currentTime}
                            duration={s.duration}
                            progress={s.duration > 0 ? s.currentTime / s.duration : 0}
                            onSeek={s.seek}
                        >
                            {/* Compact face: WaveformAdapter resolves to the plain
                                ProgressBar (supportsWaveform: false). */}
                            <WaveformAdapter
                                face="stickyBottom"
                                density={getScrubberDensity("stickyBottom")}
                                currentTime={s.currentTime}
                                duration={s.duration}
                                buffered={s.buffered}
                                disabled={!s.hasAudio}
                                isSeeking={s.isSeeking}
                                onSeek={s.seek}
                                onSeekStart={() => s.setSeeking(true)}
                                onSeekEnd={() => s.setSeeking(false)}
                            />
                        </ScrubberCanvasHost>
                        <span className="ap-sb__t" aria-hidden="true">
                            <AudioTimeText value="duration" fallback={s.duration} />
                        </span>
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
