import type { CSSProperties } from "react"
import type { AudioPlayerTheme, MediaSource } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { BackgroundMedia, resolveMedia } from "../components/BackgroundMedia"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { PlayerSurfaceButtons } from "../surfaces/PlayerSurfaceButtons"
import { QueueSurface } from "../surfaces/QueueSurface"
import { ExplicitBadge } from "../components/TrackMetadata"
import {
    formatSecondaryLine,
    formatVersionedTitle,
} from "../utils/formatMetadata"
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
 * family): a compact face. `supportsSEICanvas: false`, so the canvas zone and its
 * left surface button are auto-hidden. `supportsScrubberCanvas: false` — the mini
 * mounts **no** scrubber; seeking lives on the shared StickyBottom master. It is
 * the only compact face with the contextual radial menu
 * (`supportsContextualActions`), which is also where skip/next now live (via
 * `showTransport`) — freeing the row for title/artist instead of a Next button.
 * `PlayerSurfaceButtons` reads the capability flags from the model, so passing
 * `surface` plus the transport wiring yields the correct menu.
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
    // New media wins; gradient/url `art` remains the fallback.
    const blockArt = resolveMedia({ media: artMedia, legacyCss: art })
    const { currentTrack, isPlaying, isBuffering, hasAudio } = s
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
                    Skip/next live inside the radial menu (`showTransport`) so the
                    row keeps room for title/artist instead of an inline Next. */}
                <PlayerSurfaceButtons
                    surface={surface}
                    showTransport
                    canPrevious={s.canPrevious}
                    canNext={s.canNext}
                    onPrevious={s.previous}
                    onNext={s.next}
                />
            </div>

            <div className="ap-ms__surface" data-open={surface.isQueueOpen ? "true" : "false"}>
                {surface.isQueueOpen && <QueueSurface maxItems={6} />}
            </div>
        </div>
    )
}

export default MiniSidebarPlayer