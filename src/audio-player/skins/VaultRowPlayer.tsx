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
     * Action entry point for this row (opens the host's row actions: add to
     * playlist, share, edit, etc.). Deep actions belong to the container; the
     * row only surfaces the affordance. The action button is part of the compact
     * family contract (`faceSupportsAction("vaultRow")`).
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
    // The capability allows the button, but only render it when there's a real
    // handler — otherwise it would be an interactive yet non-functional control.
    const showAction = faceSupportsAction("vaultRow") && !!onAction

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
                <span
                    className="ap-vr__cat"
                    role="img"
                    title={category.label}
                    aria-label={category.label}
                />
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
                    {category ? `${category.label} · ` : ""}
                    {formatSecondaryLine(track)}
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
                <button
                    type="button"
                    className="ap-icon-btn ap-vr__action ap-tap"
                    onClick={() => onAction?.(track)}
                    aria-label={`More actions for ${track.title}`}
                    aria-haspopup="menu"
                >
                    <DotsIcon />
                </button>
            )}
        </div>
    )
}

export default VaultRowPlayer
