import { useMemo } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme, Track } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ExplicitBadge } from "../components/TrackMetadata"
import { AudioTimeText } from "../components/AudioTimeText"
import { formatSecondaryLine, formatVersionedTitle } from "../utils/formatMetadata"
import { trackKey } from "../utils/trackKey"
import { faceSupportsAction, faceSupportsSEICanvas } from "../surfaces/faceCapabilities"
import { ArcActionButton } from "../surfaces/ArcActionButton"
import type { ArcCommandHost } from "../surfaces/ArcActionButton"
import { buildCanonicalPlayerActions } from "../menu/canonicalActions"
import type { ArcMenuEntitlements } from "../menu/canonicalActions"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import { getVaultCategoryMeta } from "./vaultCategories"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import "./skins.css"

export interface VaultRowPlayerProps extends AudioPlayerTheme {
    /** The track this row represents. */
    track: Track
    /** Optional 1-based number shown at the left of the row. */
    number?: number
    /**
     * Ids of the plugins currently active on this player. Drives the canonical
     * menu's Plugins branch exactly as it does on every other face.
     */
    activePluginIds?: readonly string[]
    /** Entitlements gating the menu's Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements
    /**
     * Extra immediate command implementations for this row's arc (e.g.
     * `"share.email"` / `"share.url"`). Merged over the row's built-in queue
     * commands — `"queue.insertAfterCurrent"` (Play Next) and `"queue.append"`
     * (Play Later) are wired to the shared session for this track by default.
     */
    commands?: ArcCommandHost["commands"]
    /**
     * Opens a workspace inside the "…" SAP Controller — the destination of every
     * settings action in the row's menu. The host owns the controller instance
     * for the list. Without it those leaves are pruned rather than rendered dead.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void
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
 * the most compact face. `supportsSEICanvas: false` and
 * `supportsScrubberCanvas: false` — a list row mounts **no** scrubber of its own;
 * seeking lives on the shared StickyBottom master scrubber that follows the
 * active song.
 *
 * Its action button carries the same canonical hierarchy as every other face,
 * with one capability difference in each direction: no Canvas leaf (it can't host
 * the canvas), plus the Vault arm (it genuinely represents a vault-managed
 * track). Visual identity comes from the track's `vaultCategory` (accent color +
 * status label), not per-row artwork, keeping long lists fast to render.
 */
export function VaultRowPlayer({
    track,
    number,
    activePluginIds,
    entitlements,
    commands,
    onOpenWorkspace,
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
    // The row's built-in immediate commands bind the arc's queue leaves to the
    // shared session for *this* track: Play Next inserts right after the active
    // track, Play Later appends. Host `commands` merge over them, so a host can
    // add (or override) commands like share.email/share.url per row.
    // Depend on the two stable callbacks, not the whole session object — the
    // session value changes on every playback tick, which would re-memoize
    // this map on each render across a long list of rows.
    const { playNext, enqueue } = s
    const rowCommands = useMemo<ArcCommandHost["commands"]>(
        () => ({
            "queue.insertAfterCurrent": () => playNext(track),
            "queue.append": () => enqueue(track),
            ...commands,
        }),
        [playNext, enqueue, track, commands]
    )
    const rowActions = useMemo(
        () => buildCanonicalPlayerActions({ activePluginIds, entitlements }),
        [activePluginIds, entitlements]
    )
    // A vault row *is* a vault-managed track, so it declares that capability and
    // the Vault arm survives filtering here (and only here). It cannot host the
    // canvas, so the Canvas leaf does not.
    const rowCapabilities = useMemo(
        () => ({ vault: true, canvas: faceSupportsSEICanvas("vaultRow") }),
        []
    )
    const showAction = faceSupportsAction("vaultRow")

    const handleToggle = () => {
        if (isActive) s.toggle()
        else s.playNow(track)
    }

    return (
        <div
            className={`ap-vr${isActive ? " ap-vr--active" : ""}${className ? ` ${className}` : ""}`}
            style={{
                ...buildThemeVars(theme),
                ...(category ? ({ "--ap-vault-accent": category.color } as CSSProperties) : {}),
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
                <span className="ap-vr__artist" title={formatSecondaryLine(track)}>
                    {category && (
                        <span className="ap-vr__chip ap-vr__chip--inline">{category.label}</span>
                    )}
                    <span className="ap-vr__artist-text">{formatSecondaryLine(track)}</span>
                </span>
            </div>
            {isActive && (
                <span className="ap-vr__time" aria-hidden="true">
                    <AudioTimeText value="currentTime" fallback={s.currentTime} />
                </span>
            )}
            {isPlayingThis && (
                <span className="ap-eq" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </span>
            )}
            {showAction && (
                <ArcActionButton
                    actions={rowActions}
                    commands={rowCommands}
                    capabilities={rowCapabilities}
                    onOpenWorkspace={onOpenWorkspace}
                    ariaLabel={`Actions for ${track.title}`}
                    className="ap-vr__action"
                />
            )}
        </div>
    )
}

export default VaultRowPlayer
