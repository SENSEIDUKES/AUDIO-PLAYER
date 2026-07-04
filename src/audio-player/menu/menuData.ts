import type { ComponentType } from "react"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import { isWorkspaceRoute } from "../components/workspace/workspaceRoutes"
import {
    getActivePluginSurfaceDefinitions,
    getArcPluginBucket,
} from "../plugins/surfaces/defaultPluginSurfaces"
import { getPluginSettingsRoute } from "../plugins/surfaces/pluginSurfaceHelpers"
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
    ShareIcon,
    VaultIcon,
    VisualIcon,
} from "../skins/icons"

/**
 * Visual/behavioral state of a single menu node. These map to distinct stylings
 * in the arc and decide whether the node is interactive.
 *
 * - `active`      — currently on (accent ring/glow), still tappable to toggle off
 * - `available`   — ready to use (glass), the default
 * - `inactive`    — available but not selected; dimmed glass, tappable no-op for V1
 * - `disabled`    — not usable in this context (e.g. canvas on a face without it)
 * - `locked`      — gated behind an entitlement; shows a lock, not interactive
 * - `coming-soon` — placeholder for a future capability; "soon" badge, not interactive
 */
export type MenuItemState =
    | "active"
    | "available"
    | "inactive"
    | "disabled"
    | "locked"
    | "coming-soon"

/** Known leaf actions the host resolves to real callbacks. Open string union so
 *  the tree can carry future action ids without a type change. */
export type MenuActionId =
    | "open-queue"
    | "activate-canvas"
    | "select-lyrics"
    | "previous-track"
    | "next-track"
    | "share-link"
    | "toggle-favorite"
    | "open-activity-log"
    | (string & {})

/**
 * A node in the SEI Canvas Action Menu tree. Either a branch (has `children`,
 * pushes a submenu) or a leaf (has an `actionId`, resolves to a host callback).
 * Deliberately free of any engine/session imports so the arc renderer and this
 * data model can later be promoted into the seihouse-ui design system.
 */
export interface MenuNode {
    id: string
    label: string
    /** Icon component rendered as `<Icon />` inside the node button. */
    icon: ComponentType
    /** Defaults to `"available"` when omitted. */
    state?: MenuItemState
    /** Branch: entering this node opens a submenu of `children`. */
    children?: MenuNode[]
    /** Leaf: resolved against host callbacks (e.g. `"open-queue"`). */
    actionId?: MenuActionId
    /**
     * Leaf: the focused workspace this node opens in the SAP Controller shell.
     * When the host wires `onOpenWorkspace`, this takes precedence over the
     * legacy `actionId`; without it the node falls back to `actionId`, so the
     * field is additive and backward compatible.
     */
    workspaceRoute?: WorkspaceRoute
}

/** Entitlements that gate parts of the standardized arc menu. */
export interface ArcMenuEntitlements {
    /** Studio Scout is the paid Scout tier; without it Scout routes to Demo Scout. */
    studioScout?: boolean
}

export interface BuildMenuTreeOptions {
    /** Whether the current face can host the SEICanvas. Disables the Canvas node. */
    canvasSupported: boolean
    /** Whether the canvas surface is currently open (marks Canvas as `active`). */
    isCanvasActive: boolean
    /**
     * Add Previous/Next transport leaves under Playback. Compact faces that drop
     * their inline skip buttons (e.g. the mini sidebar) opt in so skip/next moves
     * into the menu, freeing the row for title/artist. Defaults to off, so faces
     * with their own transport controls (fullCard) keep the menu uncluttered.
     */
    includeTransport?: boolean
    /** Whether previous/next are currently available (gates the transport leaves). */
    canPrevious?: boolean
    canNext?: boolean
    /**
     * Whether the host wires `onOpenWorkspace` (SAP Controller routing). Nodes
     * whose only real destination is a focused workspace (the Plugins leaves,
     * Controls, Debug, Share › Add to, the Agents branch) are omitted entirely
     * when the host can't route there — the arc renders no dead buttons.
     * Defaults to off.
     */
    canRouteWorkspaces?: boolean
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics") both work.
     * Drives the Plugins branch: only *currently active* plugins render, sorted
     * into Audio / Visual / Analytics. Omitted or empty means no plugin leaves
     * (Canvas can still keep the Visual branch alive on canvas-capable faces).
     */
    activePluginIds?: readonly string[]
    /** Whether the host wires the Share › Link leaf (copy/share the track URL). */
    canShareLink?: boolean
    /** Whether the host wires the Share › Favorite leaf. */
    canFavorite?: boolean
    /** Marks the Favorite leaf active (the track is already a favorite). */
    isFavorite?: boolean
    /** Entitlements gating the Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements
}

/** Icons for the Plugins › Audio/Visual/Analytics sub-branches. */
const PLUGIN_BUCKET_META = {
    audio: { id: "plugins-audio", label: "Audio", icon: AudioIcon },
    visual: { id: "plugins-visual", label: "Visual", icon: VisualIcon },
    analytics: { id: "plugins-analytics", label: "Analytics", icon: AnalyticsIcon },
} as const

/** Per-plugin leaf icon: lyrics keeps its glyph; everything else gets the plug. */
function pluginLeafIcon(pluginId: string): ComponentType {
    return pluginId === "lyrics" ? LyricsIcon : PluginIcon
}

/**
 * The standardized arc menu tree, shared by every face that hosts an arc menu:
 *
 *     Plugins  › Audio / Visual / Analytics   (only currently active plugins)
 *     Playback › Up Next / Controls / Debug
 *     Share    › Link / Add to / Favorite
 *     Agents   › Scout / Memoir
 *
 * A builder (not a constant) so per-face capability and live surface state can
 * adjust node states without the arc knowing about the player.
 *
 * Command-router rules: every node this returns does a real action. Arc quick
 * actions open a dedicated section in the "…" menu — leaves carry a
 * `workspaceRoute` into the SAP Controller shell and appear only when the host
 * routes workspaces; the Canvas leaf appears only on faces that can host the
 * SEICanvas; Share › Link / Favorite appear only when the host wires their
 * callbacks. Branches left empty by those rules are omitted. There are no
 * "coming soon" placeholders — a capability that doesn't exist yet simply
 * isn't in the tree.
 */
export function buildMenuTree({
    canvasSupported,
    isCanvasActive,
    includeTransport = false,
    canPrevious = false,
    canNext = false,
    canRouteWorkspaces = false,
    activePluginIds = [],
    canShareLink = false,
    canFavorite = false,
    isFavorite = false,
    entitlements,
}: BuildMenuTreeOptions): MenuNode[] {
    const tree: MenuNode[] = []

    // ---- Plugins › Audio / Visual / Analytics -----------------------------
    // Only the plugins that are active right now, each leaf opening the
    // plugin's dedicated settings section in the "…" menu. The Canvas toggle
    // is the one built-in Visual leaf; it exists only where the face can
    // actually host the SEICanvas.
    const buckets: Record<"audio" | "visual" | "analytics", MenuNode[]> = {
        audio: [],
        visual: [],
        analytics: [],
    }
    if (canRouteWorkspaces) {
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
                workspaceRoute: route,
            })
        }
    }
    if (canvasSupported) {
        buckets.visual.push({
            id: "canvas",
            label: "Canvas",
            icon: CanvasIcon,
            state: isCanvasActive ? "active" : "available",
            actionId: "activate-canvas",
        })
    }
    const pluginChildren: MenuNode[] = (
        ["audio", "visual", "analytics"] as const
    ).flatMap((bucket) => {
        const children = buckets[bucket]
        if (children.length === 0) return []
        const meta = PLUGIN_BUCKET_META[bucket]
        return [{ id: meta.id, label: meta.label, icon: meta.icon, children }]
    })
    if (pluginChildren.length > 0) {
        tree.push({
            id: "plugins",
            label: "Plugins",
            icon: PluginIcon,
            children: pluginChildren,
        })
    }

    // ---- Playback › Up Next / Controls / Debug ----------------------------
    const playbackChildren: MenuNode[] = includeTransport
        ? [
              {
                  id: "previous-track",
                  label: "Previous",
                  icon: PrevIcon,
                  state: canPrevious ? "available" : "disabled",
                  actionId: "previous-track",
              },
              {
                  id: "next-track",
                  label: "Next",
                  icon: NextIcon,
                  state: canNext ? "available" : "disabled",
                  actionId: "next-track",
              },
          ]
        : []
    playbackChildren.push({
        id: "up-next",
        label: "Up Next",
        icon: QueueIcon,
        actionId: "open-queue",
        workspaceRoute: "library:queue",
    })
    if (canRouteWorkspaces) {
        playbackChildren.push(
            {
                id: "controls",
                label: "Controls",
                icon: ControlsIcon,
                workspaceRoute: "playback:controls",
            },
            {
                id: "debug",
                label: "Debug",
                icon: DebugIcon,
                workspaceRoute: "diagnostics:activity-log",
            }
        )
    }
    tree.push({
        id: "playback",
        label: "Playback",
        icon: PlaybackIcon,
        children: playbackChildren,
    })

    // ---- Share › Link / Add to / Favorite ---------------------------------
    const shareChildren: MenuNode[] = []
    if (canShareLink) {
        shareChildren.push({
            id: "share-link",
            label: "Link",
            icon: LinkIcon,
            actionId: "share-link",
        })
    }
    if (canRouteWorkspaces) {
        shareChildren.push({
            id: "share-add-to",
            label: "Add to",
            icon: VaultIcon,
            workspaceRoute: "library:vault",
        })
    }
    if (canFavorite) {
        shareChildren.push({
            id: "share-favorite",
            label: "Favorite",
            icon: HeartIcon,
            state: isFavorite ? "active" : "available",
            actionId: "toggle-favorite",
        })
    }
    if (shareChildren.length > 0) {
        tree.push({
            id: "share",
            label: "Share",
            icon: ShareIcon,
            children: shareChildren,
        })
    }

    // ---- Agents › Scout / Memoir ------------------------------------------
    // Scout is the audio-analysis agent (routes to its paid Studio tier when
    // entitled, else the free Demo tier); Memoir is assistance and info.
    if (canRouteWorkspaces) {
        tree.push({
            id: "agents",
            label: "Agents",
            icon: AgentIcon,
            children: [
                {
                    id: "agent-scout",
                    label: "Scout",
                    icon: AgentIcon,
                    workspaceRoute:
                        entitlements?.studioScout === true
                            ? "agent:studio-scout"
                            : "agent:demo-scout",
                },
                {
                    id: "agent-memoir",
                    label: "Memoir",
                    icon: LyricsIcon,
                    workspaceRoute: "agent:memoir",
                },
            ],
        })
    }

    return tree
}

/** Whether a node can be interacted with (entered or actioned). */
export function isNodeInteractive(node: MenuNode): boolean {
    const state = node.state ?? "available"
    return state !== "disabled" && state !== "locked" && state !== "coming-soon"
}
