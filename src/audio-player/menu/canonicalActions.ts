import {
    getActivePluginSurfaceDefinitions,
    getArcPluginBucket,
} from "../plugins/surfaces/defaultPluginSurfaces"
import { getPluginSettingsRoute } from "../plugins/surfaces/pluginSurfaceHelpers"
import { isWorkspaceRoute } from "../components/workspace/workspaceRoutes"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import {
    AgentIcon,
    AnalyticsIcon,
    AudioIcon,
    CanvasIcon,
    ControlsIcon,
    DebugIcon,
    HeartIcon,
    LinkIcon,
    LyricsIcon,
    NextIcon,
    PlaybackIcon,
    PluginIcon,
    PrevIcon,
    QueueIcon,
    RadioIcon,
    RenameIcon,
    ShareIcon,
    TagIcon,
    VaultIcon,
    VisualIcon,
} from "../skins/icons"
import type { ArcAction } from "./arcRouting"

/**
 * **The canonical player action hierarchy** — the one action tree every music
 * face shares.
 *
 *     Plugins  › Audio / Visual / Analytics   (active plugins, + Canvas)
 *     Playback › Previous / Next / Controls / Debug
 *     Queue    › Up Next / Play Next / Play Later / Director
 *     Share    › Link / Add to / Favorite
 *     Agents   › Scout / Memoir
 *     Vault    › Tag / Rename / Playlist / Radio        (vault capability)
 *
 * Faces may place and style the trigger however they like, but they all build
 * *this* tree: identities (ids + labels) and destinations are identical
 * everywhere. The only thing that varies between faces is which actions survive
 * capability filtering — a face never hides an action it could actually
 * perform.
 *
 * Every settings leaf targets `"sap-controller"`, i.e. it opens its workspace
 * inside the three-dot controller. The handful of `"immediate-action"` leaves
 * are deliberately *commands* (skip, queue, copy link, favorite), never
 * settings screens, and prune away on hosts that don't wire them.
 */

/** Entitlements that gate parts of the canonical hierarchy. */
export interface ArcMenuEntitlements {
    /** Studio Scout is the paid Scout tier; without it Scout routes to Demo Scout. */
    studioScout?: boolean
}

export interface BuildCanonicalPlayerActionsOptions {
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics"). Only active
     * plugins render under Plugins › Audio / Visual / Analytics.
     */
    activePluginIds?: readonly string[]
    /** Entitlements gating the Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements
    /** Marks the Favorite leaf active (the track is already a favorite). */
    isFavorite?: boolean
    /** Marks the Canvas leaf active (the SEI Canvas surface is showing). */
    isCanvasActive?: boolean
    /**
     * Whether skipping backward/forward is possible right now. These gate the
     * *state* of the transport leaves, not their existence: a face that can skip
     * always shows Previous/Next, dimmed at the ends of the queue exactly like
     * its inline transport buttons. Default `true`.
     */
    canPrevious?: boolean
    canNext?: boolean
}

/** Icons for the Plugins › Audio/Visual/Analytics sub-branches. */
const PLUGIN_BUCKET_META = {
    audio: { id: "plugins-audio", label: "Audio", icon: AudioIcon },
    visual: { id: "plugins-visual", label: "Visual", icon: VisualIcon },
    analytics: { id: "plugins-analytics", label: "Analytics", icon: AnalyticsIcon },
} as const

/** Per-plugin leaf icon: lyrics keeps its glyph; everything else gets the plug. */
function pluginLeafIcon(pluginId: string) {
    return pluginId === "lyrics" ? LyricsIcon : PluginIcon
}

/**
 * Plugins › Audio / Visual / Analytics, holding only the *currently active*
 * plugins (e.g. when Lyrics is active, tapping Visual reveals a Lyrics button).
 * Each plugin leaf opens that plugin's settings workspace in the controller.
 * Canvas is the one built-in Visual leaf: it opens the Canvas workspace, where
 * the visual is chosen and configured — the canvas *surface* itself is toggled
 * by the face's own canvas button, not from a menu.
 *
 * Returns `null` when no bucket has any leaf.
 *
 * Accepts either an options object or a bare list of active plugin ids — the
 * positional form is the signature hosts composed against before the options
 * object existed, and both are supported so neither call site has to change.
 */
export type BuildPluginsArcBranchOptions = Pick<
    BuildCanonicalPlayerActionsOptions,
    "activePluginIds" | "isCanvasActive"
>

export function buildPluginsArcBranch(
    optionsOrActivePluginIds: BuildPluginsArcBranchOptions | readonly string[] = {}
): ArcAction | null {
    const { activePluginIds = [], isCanvasActive = false } = Array.isArray(optionsOrActivePluginIds)
        ? { activePluginIds: optionsOrActivePluginIds as readonly string[] }
        : (optionsOrActivePluginIds as BuildPluginsArcBranchOptions)
    const buckets: Record<"audio" | "visual" | "analytics", ArcAction[]> = {
        audio: [],
        visual: [],
        analytics: [],
    }
    for (const def of getActivePluginSurfaceDefinitions(activePluginIds)) {
        const bucket = getArcPluginBucket(def)
        const route = getPluginSettingsRoute(def)
        // A plugin leaf must resolve to a real registered workspace section;
        // forward-declared routes that aren't registered yet are skipped.
        if (!bucket || !route || !isWorkspaceRoute(route)) continue
        buckets[bucket].push({
            id: `plugin-${def.pluginId}`,
            label: def.label,
            icon: pluginLeafIcon(def.pluginId),
            target: "sap-controller",
            workspaceRoute: route,
        })
    }
    buckets.visual.push({
        id: "canvas",
        label: "Canvas",
        icon: CanvasIcon,
        state: isCanvasActive ? "active" : "available",
        target: "sap-controller",
        workspaceRoute: "visual:canvas",
        requires: ["canvas"],
    })
    const children: ArcAction[] = (["audio", "visual", "analytics"] as const).flatMap((bucket) => {
        if (buckets[bucket].length === 0) return []
        const meta = PLUGIN_BUCKET_META[bucket]
        return [{ id: meta.id, label: meta.label, icon: meta.icon, children: buckets[bucket] }]
    })
    if (children.length === 0) return null
    return { id: "plugins", label: "Plugins", icon: PluginIcon, children }
}

/**
 * Playback › Previous / Next / Controls / Debug. Previous and Next are
 * immediate transport commands — they prune on hosts that don't wire them, and
 * render dimmed at the ends of the queue rather than silently no-opping.
 * Controls and Debug open their workspaces in the controller.
 */
export function buildPlaybackArcBranch(canPrevious = true, canNext = true): ArcAction {
    return {
        id: "playback",
        label: "Playback",
        icon: PlaybackIcon,
        children: [
            {
                id: "previous-track",
                label: "Previous",
                icon: PrevIcon,
                state: canPrevious ? "available" : "disabled",
                target: "immediate-action",
                action: "track.previous",
            },
            {
                id: "next-track",
                label: "Next",
                icon: NextIcon,
                state: canNext ? "available" : "disabled",
                target: "immediate-action",
                action: "track.next",
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
 * Queue › Up Next / Play Next / Play Later / Director. Up Next opens the queue
 * *inside the controller* (never a separate drawer); Play Next / Play Later are
 * immediate queue commands that only exist on surfaces representing a queueable
 * track; Director opens the queue-agent workspace.
 */
export function buildQueueArcBranch(): ArcAction {
    return {
        id: "queue",
        label: "Queue",
        icon: QueueIcon,
        children: [
            {
                id: "up-next",
                label: "Up Next",
                icon: QueueIcon,
                target: "sap-controller",
                workspaceRoute: "library:queue",
            },
            {
                id: "queue-play-next",
                label: "Play Next",
                icon: NextIcon,
                target: "immediate-action",
                action: "queue.insertAfterCurrent",
            },
            {
                id: "queue-play-later",
                label: "Play Later",
                icon: QueueIcon,
                target: "immediate-action",
                action: "queue.append",
            },
            {
                id: "agent-queue-director",
                label: "Director",
                icon: AgentIcon,
                target: "sap-controller",
                workspaceRoute: "agent:queue-director",
            },
        ],
    }
}

/**
 * Share › Link / Add to / Favorite. Link and Favorite are immediate host
 * commands (`"share.url"`, `"track.favorite"`) and prune away on hosts that
 * don't wire them; Add to opens the Add to Vault workspace in the controller.
 */
export function buildShareArcBranch(isFavorite = false): ArcAction {
    return {
        id: "share",
        label: "Share",
        icon: ShareIcon,
        children: [
            {
                id: "share-link",
                label: "Link",
                icon: LinkIcon,
                target: "immediate-action",
                action: "share.url",
            },
            {
                id: "share-add-to",
                label: "Add to",
                icon: VaultIcon,
                target: "sap-controller",
                workspaceRoute: "library:vault",
            },
            {
                id: "share-favorite",
                label: "Favorite",
                icon: HeartIcon,
                state: isFavorite ? "active" : "available",
                target: "immediate-action",
                action: "track.favorite",
            },
        ],
    }
}

/**
 * Agents › Scout / Memoir. Scout is the audio-analysis agent — it routes to
 * its paid Studio tier when entitled, else the free Demo tier. Memoir is
 * assistance and info (a narrated history of the track's vault versions).
 */
export function buildAgentsArcBranch(entitlements?: ArcMenuEntitlements): ArcAction {
    const scoutRoute: WorkspaceRoute =
        entitlements?.studioScout === true ? "agent:studio-scout" : "agent:demo-scout"
    return {
        id: "agents",
        label: "Agents",
        icon: AgentIcon,
        children: [
            {
                id: "agent-scout",
                label: "Scout",
                icon: AgentIcon,
                target: "sap-controller",
                workspaceRoute: scoutRoute,
            },
            {
                id: "agent-memoir",
                label: "Memoir",
                icon: LyricsIcon,
                target: "sap-controller",
                workspaceRoute: "agent:memoir",
            },
        ],
    }
}

/**
 * Vault › Tag / Rename / Playlist / Radio — organizing a vault-managed track.
 * Gated on the `vault` capability, so it appears on any surface that genuinely
 * represents a vault track and nowhere else. It is an *addition* to the shared
 * hierarchy, never a replacement for part of it.
 */
export function buildVaultArcBranch(): ArcAction {
    return {
        id: "vault",
        label: "Vault",
        icon: VaultIcon,
        requires: ["vault"],
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
 * Build the canonical hierarchy. The result is identical for every music face
 * given the same options — differences between faces come *only* from the
 * capability/command filtering `pruneDeadArcActions` applies against the host.
 */
export function buildCanonicalPlayerActions({
    activePluginIds = [],
    entitlements,
    isFavorite = false,
    isCanvasActive = false,
    canPrevious = true,
    canNext = true,
}: BuildCanonicalPlayerActionsOptions = {}): ArcAction[] {
    const plugins = buildPluginsArcBranch({ activePluginIds, isCanvasActive })
    return [
        ...(plugins ? [plugins] : []),
        buildPlaybackArcBranch(canPrevious, canNext),
        buildQueueArcBranch(),
        buildShareArcBranch(isFavorite),
        buildAgentsArcBranch(entitlements),
        buildVaultArcBranch(),
    ]
}
