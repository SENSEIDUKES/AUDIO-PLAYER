import {
    buildAgentsArcBranch,
    buildPluginsArcBranch,
    buildShareArcBranch,
} from "./canonicalActions"
import type { ArcMenuEntitlements } from "./canonicalActions"
import {
    ControlsIcon,
    DebugIcon,
    PlaybackIcon,
    QueueIcon,
    RadioIcon,
    RenameIcon,
    TagIcon,
    VaultIcon,
} from "../skins/icons"
import type { ArcAction } from "./arcRouting"

/**
 * The pre-consolidation menu builders, restored.
 *
 * These are the trees consuming products composed against before the internal
 * menu architecture was unified. They return exactly what they returned then,
 * so an app that shipped one keeps the menu it shipped. What changed underneath
 * — one action model, one router, one controller — they inherit for free: their
 * leaves route through the same dispatcher and the same capability pruning as
 * the canonical hierarchy.
 *
 * These are *host* builders. Pass one to a face's `actions` prop and it renders
 * verbatim; nothing from the canonical hierarchy is merged in.
 */

/**
 * Entitlements gating the Vault command wheel. An alias of the shared arc-menu
 * entitlements, as it always was, so existing callers keep compiling.
 */
export type VaultTrackEntitlements = ArcMenuEntitlements

export interface BuildVaultTrackArcActionsOptions {
    entitlements?: VaultTrackEntitlements
}

export interface BuildStandardArcActionsOptions {
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics"). Only active
     * plugins render under Plugins › Audio / Visual / Analytics.
     */
    activePluginIds?: readonly string[]
    /** Entitlements gating the Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements
}

/**
 * Playback › Up Next / Controls / Debug — the arm as it stood before the
 * canonical hierarchy split transport into Playback and the queue into its own
 * Queue arm. Kept because a host tree built from these parts should not
 * silently gain or lose leaves.
 */
export function buildLegacyPlaybackArcBranch(): ArcAction {
    return {
        id: "playback",
        label: "Playback",
        icon: PlaybackIcon,
        children: [
            {
                id: "up-next",
                label: "Up Next",
                icon: QueueIcon,
                target: "sap-controller",
                workspaceRoute: "library:queue",
            },
            {
                id: "controls",
                label: "Controls",
                icon: ControlsIcon,
                target: "sap-controller",
                workspaceRoute: "playback:controls",
            },
            {
                id: "debug",
                label: "Debug",
                icon: DebugIcon,
                target: "sap-controller",
                workspaceRoute: "diagnostics:activity-log",
            },
        ],
    }
}

/**
 * Vault › Tag / Rename / Playlist / Radio, as a host arm.
 *
 * Unlike the canonical Vault arm this declares no `vault` capability
 * requirement: a host that asks for the Vault menu by name has already
 * asserted the surface is a vault track, and second-guessing that would make
 * the restored builder useless on any face but one.
 */
export function buildVaultTrackArcBranch(): ArcAction {
    return {
        id: "vault",
        label: "Vault",
        icon: VaultIcon,
        children: [
            {
                id: "vault-tag",
                label: "Tag",
                icon: TagIcon,
                target: "sap-controller",
                workspaceRoute: "vault:tag",
            },
            {
                id: "vault-rename",
                label: "Rename",
                icon: RenameIcon,
                target: "sap-controller",
                workspaceRoute: "vault:rename",
            },
            {
                id: "vault-playlist",
                label: "Playlist",
                icon: QueueIcon,
                target: "sap-controller",
                workspaceRoute: "library:playlists",
            },
            {
                id: "vault-radio",
                label: "Radio",
                icon: RadioIcon,
                target: "sap-controller",
                workspaceRoute: "vault:radio",
            },
        ],
    }
}

/**
 * The Vault face's command wheel — exactly four categories, as it has always
 * been:
 *
 *     Vault    › Tag / Rename / Playlist / Radio
 *     Playback › Up Next / Controls / Debug
 *     Share    › Link / Add to / Favorite
 *     Agents   › Scout / Memoir
 *
 * A vault row's primary actions are about organizing the track, not configuring
 * the player, which is why Vault stands where Plugins would. Pass it to a
 * face's `actions` prop to get this menu and only this menu.
 */
export function buildVaultTrackArcActions({
    entitlements,
}: BuildVaultTrackArcActionsOptions = {}): ArcAction[] {
    return [
        buildVaultTrackArcBranch(),
        buildLegacyPlaybackArcBranch(),
        buildShareArcBranch(),
        buildAgentsArcBranch(entitlements),
    ]
}

/**
 * The standardized non-Vault wheel — four categories:
 *
 *     Plugins  › Audio / Visual / Analytics   (only currently active plugins)
 *     Playback › Up Next / Controls / Debug
 *     Share    › Link / Add to / Favorite
 *     Agents   › Scout / Memoir
 *
 * The Plugins arm drops out when no plugin is active and the face cannot host
 * the canvas, exactly as before.
 */
export function buildStandardTrackArcActions({
    activePluginIds = [],
    entitlements,
}: BuildStandardArcActionsOptions = {}): ArcAction[] {
    const plugins = buildPluginsArcBranch(activePluginIds)
    return [
        ...(plugins ? [plugins] : []),
        buildLegacyPlaybackArcBranch(),
        buildShareArcBranch(),
        buildAgentsArcBranch(entitlements),
    ]
}
