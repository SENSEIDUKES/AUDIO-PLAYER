import {
    getActivePluginSurfaceDefinitions,
    getArcPluginBucket,
} from "../plugins/surfaces/defaultPluginSurfaces"
import { getPluginSettingsRoute } from "../plugins/surfaces/pluginSurfaceHelpers"
import { isWorkspaceRoute } from "../components/workspace/workspaceRoutes"
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
    PlaybackIcon,
    PluginIcon,
    QueueIcon,
    ShareIcon,
    VaultIcon,
    VisualIcon,
} from "../skins/icons"
import type { ArcAction } from "./arcRouting"
import type { ArcMenuEntitlements } from "./menuData"

/**
 * The standardized arc wheel in the declarative `ArcAction` model (the command
 * router `ArcActionButton` renders). Every arc-menu face shares the same four
 * arms —
 *
 *     Plugins  › Audio / Visual / Analytics   (only currently active plugins)
 *     Playback › Up Next / Controls / Debug
 *     Share    › Link / Add to / Favorite
 *     Agents   › Scout / Memoir
 *
 * — and each quick action opens a dedicated section in the "…" menu (a
 * `"sap-controller"` workspace route) or runs an immediate host command. The
 * Vault face swaps Plugins for its dedicated Vault arm (see vaultTrackMenu.ts).
 * As always, leaves whose destination the host hasn't wired are pruned before
 * render — the shared arms below can be composed onto any face without dead
 * buttons appearing.
 */

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

/** Playback › Up Next / Controls / Debug — each a dedicated "…" menu section. */
export function buildPlaybackArcBranch(): ArcAction {
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
 * Share › Link / Add to / Favorite. Link and Favorite are immediate host
 * commands (`"share.url"`, `"track.favorite"`) and prune away on hosts that
 * don't wire them; Add to opens the Add to Vault section in the "…" menu.
 */
export function buildShareArcBranch(): ArcAction {
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
export function buildAgentsArcBranch(
    entitlements?: ArcMenuEntitlements
): ArcAction {
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
                workspaceRoute: "agent:demo-scout",
            },
            {
                id: "agent-memoir",
                label: "Memoir",
                icon: LyricsIcon,
                target: "sap-controller",
                workspaceRoute: "agent:memoir",
            },
            {
                id: "agent-studio-scout",
                label: "Studio Scout",
                icon: AgentIcon,
                target: entitlements?.studioScout ? "sap-controller" : "locked-entitlement",
                workspaceRoute: "agent:studio-scout",
            },
        ],
    }
}

const PLUGIN_BUCKET_META = {
    audio: { id: "plugins-audio", label: "Audio", icon: AudioIcon },
    visual: { id: "plugins-visual", label: "Visual", icon: VisualIcon },
    analytics: { id: "plugins-analytics", label: "Analytics", icon: AnalyticsIcon },
} as const

/**
 * Plugins › Audio / Visual / Analytics, holding only the *currently active*
 * plugins (e.g. when Lyrics is active, tapping Visual reveals a Lyrics
 * button). Each plugin leaf opens that plugin's dedicated settings section in
 * the "…" menu. The Canvas toggle is the one built-in Visual leaf (target
 * `"sei-canvas"`); like everything else it prunes away on hosts that don't
 * wire the canvas. Returns `null` when no bucket has any live leaf.
 */
export function buildPluginsArcBranch(
    activePluginIds: readonly string[] = []
): ArcAction | null {
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
            icon: def.pluginId === "lyrics" ? LyricsIcon : PluginIcon,
            target: "sap-controller",
            workspaceRoute: route,
        })
    }
    buckets.visual.push({
        id: "canvas",
        label: "Canvas",
        icon: CanvasIcon,
        target: "sei-canvas",
    })
    const children: ArcAction[] = (
        ["audio", "visual", "analytics"] as const
    ).flatMap((bucket) => {
        if (buckets[bucket].length === 0) return []
        const meta = PLUGIN_BUCKET_META[bucket]
        return [
            {
                id: meta.id,
                label: meta.label,
                icon: meta.icon,
                children: buckets[bucket],
            },
        ]
    })
    if (children.length === 0) return null
    return { id: "plugins", label: "Plugins", icon: PluginIcon, children }
}

/**
 * The full standardized wheel for non-Vault faces:
 * Plugins | Playback | Share | Agents.
 */
export function buildStandardTrackArcActions({
    activePluginIds = [],
    entitlements,
}: BuildStandardArcActionsOptions = {}): ArcAction[] {
    const plugins = buildPluginsArcBranch(activePluginIds)
    return [
        ...(plugins ? [plugins] : []),
        buildPlaybackArcBranch(),
        buildShareArcBranch(),
        buildAgentsArcBranch(entitlements),
    ]
}
