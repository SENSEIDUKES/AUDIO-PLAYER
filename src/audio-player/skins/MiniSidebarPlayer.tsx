import { useCallback, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme, MediaSource } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { BackgroundMedia, resolveMedia } from "../components/BackgroundMedia"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { PlayerSurfaceButtons } from "../surfaces/PlayerSurfaceButtons"
import { SAPController } from "../components/SAPController"
import { useShareTrack } from "../components/useShareTrack"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import { ExplicitBadge } from "../components/TrackMetadata"
import { formatSecondaryLine, formatVersionedTitle } from "../utils/formatMetadata"
import "./skins.css"

export interface MiniSidebarPlayerProps extends AudioPlayerTheme {
    /** Optional CSS background image for the small art block (gradient or url).
        Applied as background-image so the cover/center sizing rules hold. */
    art?: string
    /**
     * Unified artwork media (image or video). Supersedes `art` when set; video
     * renders muted/looping in the small art block.
     */
    artMedia?: MediaSource | null
    className?: string
    style?: CSSProperties
}

/**
 * A condensed widget for a sidebar: small art, current track, play/pause, and
 * the action menu. Reads the shared session so it always shows what is globally
 * playing.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.miniSidebar`, CompactPlayer
 * family): a compact face. `supportsSEICanvas: false`, so the canvas zone, its
 * left surface button, and the menu's Canvas leaf are all filtered out — the one
 * capability this face genuinely lacks. `supportsScrubberCanvas: false` — the
 * mini mounts **no** scrubber; seeking lives on the shared StickyBottom master.
 *
 * Everything else is the shared contract: the same canonical action menu as every
 * other music face, opening the same SAPController workspaces. Skip/next live in
 * that menu (Playback › Previous / Next), freeing the row for title/artist.
 */
export function MiniSidebarPlayer({
    art = "linear-gradient(135deg,#7C5CFF,#22D3A6)",
    artMedia,
    className,
    style,
    ...theme
}: MiniSidebarPlayerProps) {
    const s = useAudioSession()
    const surface = usePlayerSurface("miniSidebar")
    const [controllerOpen, setControllerOpen] = useState(false)
    const [controllerRoute, setControllerRoute] = useState<WorkspaceRoute>("options")
    // New media wins; gradient/url `art` remains the fallback.
    const blockArt = resolveMedia({ media: artMedia, legacyCss: art })
    const { currentTrack, isPlaying, isBuffering, hasAudio } = s

    const { share, copied: shareCopied } = useShareTrack(
        currentTrack?.title ?? "",
        currentTrack?.artist ?? ""
    )

    // The radial menu and the controller are one system: a settings action opens
    // this face's single SAPController on that action's route.
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
            ...(currentTrack ? { "share.url": share } : {}),
        }),
        [s.previous, s.next, currentTrack, share]
    )
    const msTitle = currentTrack
        ? formatVersionedTitle(currentTrack.title, currentTrack.versionLabel)
        : "Nothing playing"
    const msSecondary = currentTrack ? formatSecondaryLine(currentTrack) : "—"

    return (
        <div
            className={`ap-ms-shell${className ? ` ${className}` : ""}`}
            style={{ ...buildThemeVars(theme), ...style }}
        >
            <div
                className="ap-ms ap-glass-surface ap-glass-surface--compact"
                role="region"
                aria-label="Mini player"
            >
                <div
                    className={`ap-ms__art${isPlaying ? " ap-ms__art--playing" : ""}`}
                    style={
                        blockArt.cssBackground
                            ? { backgroundImage: blockArt.cssBackground }
                            : undefined
                    }
                    aria-hidden="true"
                >
                    {blockArt.media && (
                        <BackgroundMedia media={blockArt.media} className="ap-ms__bg" />
                    )}
                </div>
                <div className="ap-ms__meta">
                    <span className="ap-ms__title" title={msTitle}>
                        {msTitle}
                        {currentTrack?.explicit && <ExplicitBadge />}
                    </span>
                    <span className="ap-ms__artist" title={msSecondary}>
                        {msSecondary}
                    </span>
                </div>
                <button
                    type="button"
                    className="ap-btn ap-btn--play ap-ms__play ap-tap"
                    onClick={s.toggle}
                    disabled={!hasAudio}
                    aria-label={isBuffering ? "Buffering audio" : isPlaying ? "Pause" : "Play"}
                >
                    {isBuffering ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                {/* Canvas button auto-hidden (mini doesn't support SEICanvas).
                    Skip/next live inside the radial menu (Playback › Previous /
                    Next) so the row keeps room for title/artist. */}
                <PlayerSurfaceButtons
                    surface={surface}
                    activePluginIds={s.pluginNames}
                    commands={menuCommands}
                    canPrevious={s.canPrevious}
                    canNext={s.canNext}
                    onOpenFocusedController={handleOpenFocusedController}
                />
            </div>

            {/* The single controller instance every action on this face opens. */}
            <SAPController
                open={controllerOpen}
                onClose={handleCloseController}
                route={controllerRoute}
                playback={{
                    shuffle: s.shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode: s.repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix: s.automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                queue={{
                    count: s.queue.length,
                    tracks: s.queue,
                    currentIndex: s.currentIndex,
                    isPlaying,
                    onPlayTrack: s.playTrack,
                    onRemove: s.removeFromQueue,
                }}
                info={
                    currentTrack
                        ? {
                              title: currentTrack.title ?? "",
                              artist: currentTrack.artist ?? "",
                              duration: s.duration,
                              lyrics: currentTrack.lyrics,
                          }
                        : undefined
                }
                share={currentTrack ? { onShare: share, copied: shareCopied } : undefined}
                {...theme}
            />
        </div>
    )
}

export default MiniSidebarPlayer
