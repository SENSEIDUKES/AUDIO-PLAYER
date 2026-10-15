import { memo, useMemo } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme, Track } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ExplicitBadge } from "../components/TrackMetadata"
import { AudioTimeText } from "../components/AudioTimeText"
import { formatSecondaryLine, formatVersionedTitle } from "../utils/formatMetadata"
import { trackKey } from "../utils/trackKey"
import { faceSupportsAction, faceSupportsSEICanvas } from "../surfaces/faceCapabilities"
import { ArcActionButton } from "../surfaces/ArcActionButton"
import type { ArcAction, ArcCommandHost } from "../surfaces/ArcActionButton"
import { resolvePlayerMenu } from "../menu/menuProfile"
import type { PlayerMenuProfile } from "../menu/menuProfile"
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
     * A complete host-provided action menu for this row. When set, the wheel is
     * exactly this tree — no canonical category is merged in. This is the
     * extension point vault apps compose `buildVaultTrackArcActions()` into.
     * Omit to get SAP's canonical hierarchy.
     */
    actions?: ArcAction[]
    /**
     * Structured control over the canonical hierarchy: choose and order its
     * categories, or add your own alongside them. Ignored when `actions` is set.
     */
    menuProfile?: PlayerMenuProfile
    /**
     * Extra capabilities for host actions that declare `requires`, merged over
     * this row's own (which already declares `vault`).
     */
    menuCapabilities?: ArcCommandHost["capabilities"]
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

/** Static capabilities descriptor for VaultRowPlayer to avoid per-render allocations across lists. */
const VAULT_ROW_CAPABILITIES: ArcCommandHost["capabilities"] = Object.freeze({
    vault: true,
    canvas: faceSupportsSEICanvas("vaultRow"),
})

const SHOW_VAULT_ACTION = faceSupportsAction("vaultRow")

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
 * Its action button carries SAP's canonical hierarchy by default, with one
 * capability difference in each direction: no Canvas leaf (it can't host the
 * canvas), plus the Vault arm (it genuinely represents a vault-managed track).
 * A host owns that composition though — pass `actions` (e.g.
 * `buildVaultTrackArcActions()`) for its own menu, or `menuProfile` to pick from
 * the canonical categories. Visual identity comes from the track's
 * `vaultCategory` (accent color + status label), not per-row artwork, keeping
 * long lists fast to render.
 */
export const VaultRowPlayer = memo(function VaultRowPlayer({
    track,
    number,
    actions,
    menuProfile,
    menuCapabilities,
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
    const category = track.vaultCategory ? getVaultCategoryMeta(track.vaultCategory) : undefined

    const versionedTitle = formatVersionedTitle(track.title, track.versionLabel)
    const secondaryLine = formatSecondaryLine(track)

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
        () => resolvePlayerMenu({ actions, menuProfile, activePluginIds, entitlements }),
        [actions, menuProfile, activePluginIds, entitlements]
    )
    // The frozen module constant covers the common case, so a long list
    // allocates nothing here; only a host adding its own gates pays for a merge.
    const rowCapabilities = useMemo(
        () =>
            menuCapabilities
                ? { ...VAULT_ROW_CAPABILITIES, ...menuCapabilities }
                : VAULT_ROW_CAPABILITIES,
        [menuCapabilities]
    )

    const handleToggle = () => {
        if (isActive) s.toggle()
        else s.playNow(track)
    }

    const themeVars = useMemo(
        () => buildThemeVars(theme),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            theme.accentColor,
            theme.playIconColor,
            theme.textColor,
            theme.progressColor,
            theme.trackColor,
            theme.backgroundColor,
            theme.glowColor,
            theme.glowIntensity,
            theme.buttonOpacity,
        ]
    )

    return (
        <div
            className={`ap-vr${isActive ? " ap-vr--active" : ""}${className ? ` ${className}` : ""}`}
            style={{
                ...themeVars,
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
                <span className="ap-vr__title" title={versionedTitle}>
                    <span className="ap-vr__title-text">{versionedTitle}</span>
                    {track.explicit && <ExplicitBadge />}
                </span>
                <span className="ap-vr__artist" title={secondaryLine}>
                    {category && (
                        <span className="ap-vr__chip ap-vr__chip--inline">{category.label}</span>
                    )}
                    <span className="ap-vr__artist-text">{secondaryLine}</span>
                </span>
            </div>
            {isActive && (
                <span className="ap-vr__time" aria-hidden="true">
                    <AudioTimeText value="currentTime" fallback={s.currentTime} />
                </span>
            )}
            {isPlayingThis && (
                <span className="ap-eq ap-vr__eq" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </span>
            )}
            {SHOW_VAULT_ACTION && (
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
})

export default VaultRowPlayer
