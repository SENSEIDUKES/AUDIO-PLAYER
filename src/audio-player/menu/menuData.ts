import type { ComponentType } from "react"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import {
    AgentIcon,
    AnalyticsIcon,
    AutomixIcon,
    CanvasIcon,
    LyricsIcon,
    NextIcon,
    PlaybackIcon,
    PluginIcon,
    PrevIcon,
    QueueIcon,
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
     * whose only real destination is a focused workspace (Lyrics, Automix,
     * Agent, Activity Log) are omitted entirely when the host can't route
     * there — the arc renders no dead buttons. Defaults to off.
     */
    canRouteWorkspaces?: boolean
}

/**
 * The V1 hardcoded menu tree. A builder (not a constant) so per-face capability
 * and live surface state can adjust node states without the arc knowing about
 * the player. Replaceable later by a plugin-registry-driven tree of the same shape.
 *
 * Command-router rules: every node this returns does a real action. Nodes whose
 * only destination is a focused SAP Controller workspace appear only when the
 * host routes workspaces; the Canvas leaf appears only on faces that can host
 * the SEICanvas. There are no "coming soon" placeholders — a capability that
 * doesn't exist yet simply isn't in the tree.
 */
export function buildMenuTree({
    canvasSupported,
    isCanvasActive,
    includeTransport = false,
    canPrevious = false,
    canNext = false,
    canRouteWorkspaces = false,
}: BuildMenuTreeOptions): MenuNode[] {
    const transportNodes: MenuNode[] = includeTransport
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

    // Plugin › Visual leaves. Lyrics is a workspace destination; Canvas is the
    // SEI Canvas toggle and exists only where the face can actually host it —
    // a face without canvas support gets no Canvas node at all.
    const visualNodes: MenuNode[] = []
    if (canRouteWorkspaces) {
        visualNodes.push({
            id: "lyrics",
            label: "Lyrics",
            icon: LyricsIcon,
            state: "inactive",
            actionId: "select-lyrics",
            workspaceRoute: "plugin-settings:lyrics",
        })
    }
    if (canvasSupported) {
        visualNodes.push({
            id: "canvas",
            label: "Canvas",
            icon: CanvasIcon,
            state: isCanvasActive ? "active" : "available",
            actionId: "activate-canvas",
        })
    }

    const playbackChildren: MenuNode[] = [
        ...transportNodes,
        {
            id: "up-next",
            label: "Up Next",
            icon: QueueIcon,
            actionId: "open-queue",
            workspaceRoute: "library:queue",
        },
    ]
    if (canRouteWorkspaces) {
        playbackChildren.push({
            id: "automix",
            label: "Automix",
            icon: AutomixIcon,
            workspaceRoute: "playback:automix",
        })
    }

    const tree: MenuNode[] = []
    if (visualNodes.length > 0) {
        tree.push({
            id: "plugin",
            label: "Plugin",
            icon: PluginIcon,
            children: [
                {
                    id: "visual",
                    label: "Visual",
                    icon: VisualIcon,
                    children: visualNodes,
                },
            ],
        })
    }
    tree.push({
        id: "playback",
        label: "Playback",
        icon: PlaybackIcon,
        children: playbackChildren,
    })
    if (canRouteWorkspaces) {
        tree.push(
            {
                id: "agent",
                label: "Agent",
                icon: AgentIcon,
                workspaceRoute: "agent:queue-director",
            },
            {
                id: "activity-log",
                label: "Activity Log",
                icon: AnalyticsIcon as ComponentType,
                workspaceRoute: "diagnostics:activity-log",
            }
        )
    }
    return tree
}

/** Whether a node can be interacted with (entered or actioned). */
export function isNodeInteractive(node: MenuNode): boolean {
    const state = node.state ?? "available"
    return state !== "disabled" && state !== "locked" && state !== "coming-soon"
}
