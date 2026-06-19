import { useMemo } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme, Track } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ExplicitBadge } from "../components/TrackMetadata"
import { formatTime } from "../utils/formatTime"
import {
    formatSecondaryLine,
    formatVersionedTitle,
} from "../utils/formatMetadata"
import { trackKey } from "../utils/trackKey"
import { faceSupportsAction } from "../surfaces/faceCapabilities"
import { ArcActionButton } from "../surfaces/ArcActionButton"
import type { ArcAction } from "../surfaces/ArcActionButton"
import { getVaultCategoryMeta } from "./vaultCategories"
import { buildThemeVars } from "./themeVars"
import { DotsIcon, PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import "./skins.css"

export interface VaultRowPlayerProps extends AudioPlayerTheme {
    /** The track this row represents. */
    track: Track
    /** Optional 1-based number shown at the left of the row. */
    number?: number
    /**
     * Row actions surfaced through the Arc Action Button (the primary row action
     * surface). A plain, extensible list — append actions or nest `children`
     * without touching the row. Supersedes `onAction`.
     */
    actions?: ArcAction[]
    /**
     * @deprecated Legacy single action entry point. When `actions` is omitted,
     * this is synthesized into a single "More" arc action so existing callers
     * keep working. Prefer `actions`.
     */
    onAction?: (track: Track) => void
    className?: string
    style?: CSSProperties
}

/** Identify a track within the queue the same way the session's playNow does. */
function sameTrack(a: Track, b: Track): boolean {
    return trackKey(a) === trackKey(b)
}

/**
 * A slim Vault list row. Each row controls the shared session: pressing play
 * starts this track in the one global engine (jumping if it's already queued,
 * else appending). When this row is the active track its play button mirrors the
 * global play state — so it stays in sync with every other skin.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.vaultRow`, CompactPlayer family):
 * the most compact face. `supportsSEICanvas: false`, `supportsContextualActions:
 * false`, and `supportsScrubberCanvas: false` — a list row mounts **no** scrubber
 * of its own; seeking lives on the shared StickyBottom master scrubber that
 * follows the active song. It keeps `supportsAction: true`, so it renders a row
 * action button. Visual identity comes from the track's `vaultCategory` (accent
 * color + status label), not per-row artwork, keeping long lists fast to render.
 */
export function VaultRowPlayer({
    track,
    number,
    actions,
    onAction,
    className,
    style,
    ...theme
}: VaultRowPlayerProps) {
    const s = useAudioSession()
    const isActive = s.currentTrack ? sameTrack(s.currentTrack, track) : false
    const isPlayingThis = isActive && s.isPlaying
    // Engine gates `isBuffering` to active/pending playback; scope it to this
    // row so only the active track's button can spin.
    const isBufferingThis = isActive && s.isBuffering
    const category = getVaultCategoryMeta(track.vaultCategory)
    // Resolve the arc actions: prefer the explicit list; otherwise synthesize a
    // single "More" action from the legacy `onAction` so existing callers keep a
    // working action surface (now an arc instead of a three-dot menu).
    const resolvedActions = useMemo<ArcAction[]>(() => {
        if (actions && actions.length > 0) return actions
        if (onAction) {
            return [
                { id: "more", label: "More", icon: DotsIcon, onSelect: () => onAction(track) },
            ]
        }
        return []
    }, [actions, onAction, track])
    // The capability allows the button, but only render it when there are actions
    // — otherwise it would be an interactive yet empty control.
    const showAction = faceSupportsAction("vaultRow") && resolvedActions.length > 0

    const handleToggle = () => {
        if (isActive) s.toggle()
        else s.playNow(track)
    }

    return (
        <div
            className={`ap-vr${isActive ? " ap-vr--active" : ""}${className ? ` ${className}` : ""}`}
            style={{
                ...buildThemeVars(theme),
                ...(category
                    ? ({ "--ap-vault-accent": category.color } as CSSProperties)
                    : {}),
                ...style,
            }}
            data-vault-category={track.vaultCategory}
            aria-current={isActive ? "true" : undefined}
        >
            {category && (
                <span className="ap-vr__chip ap-vr__chip--lead" title={category.label}>
                    {category.label}
                </span>
            )}
            {number !== undefined && <span className="ap-vr__num">{number}</span>}
            <button
                type="button"
                className="ap-btn ap-btn--play ap-vr__play ap-tap"
                onClick={handleToggle}
                aria-label={
                    isBufferingThis
                        ? "Buffering audio"
                        : isPlayingThis
                          ? `Pause ${track.title}`
                          : `Play ${track.title}`
                }
            >
                {isBufferingThis ? <SpinnerIcon /> : isPlayingThis ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="ap-vr__meta">
                <span
                    className="ap-vr__title"
                    title={formatVersionedTitle(track.title, track.versionLabel)}
                >
                    {formatVersionedTitle(track.title, track.versionLabel)}
                    {track.explicit && <ExplicitBadge />}
                </span>
                <span
                    className="ap-vr__artist"
                    title={formatSecondaryLine(track)}
                >
                    {category && (
                        <span className="ap-vr__chip ap-vr__chip--inline">
                            {category.label}
                        </span>
                    )}
                    <span className="ap-vr__artist-text">
                        {formatSecondaryLine(track)}
                    </span>
                </span>
            </div>
            {isActive && (
                <span className="ap-vr__time" aria-hidden="true">
                    {formatTime(s.currentTime)}
                </span>
            )}
            {isPlayingThis && (
                <span className="ap-eq" aria-hidden="true">
                    <i /><i /><i />
                </span>
            )}
            {showAction && (
                <ArcActionButton
                    actions={resolvedActions}
                    ariaLabel={`Actions for ${track.title}`}
                    className="ap-vr__action"
                />
            )}
        </div>
    )
}

export default VaultRowPlayer
