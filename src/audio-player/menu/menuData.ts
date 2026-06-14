import type { ComponentType } from "react"
import {
    AgentIcon,
    AnalyticsIcon,
    AutomixIcon,
    CanvasIcon,
    CommentsIcon,
    LyricsIcon,
    PlaybackIcon,
    PluginIcon,
    QueueIcon,
    RepeatIcon,
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
}

export interface BuildMenuTreeOptions {
    /** Whether the current face can host the SEICanvas. Disables the Canvas node. */
    canvasSupported: boolean
    /** Whether the canvas surface is currently open (marks Canvas as `active`). */
    isCanvasActive: boolean
}

/**
 * The V1 hardcoded menu tree. A builder (not a constant) so per-face capability
 * and live surface state can adjust node states without the arc knowing about
 * the player. Replaceable later by a plugin-registry-driven tree of the same shape.
 */
export function buildMenuTree({
    canvasSupported,
    isCanvasActive,
}: BuildMenuTreeOptions): MenuNode[] {
    const canvasState: MenuItemState = !canvasSupported
        ? "disabled"
        : isCanvasActive
          ? "active"
          : "available"

    return [
        {
            id: "plugin",
            label: "Plugin",
            icon: PluginIcon,
            children: [
                {
                    id: "visual",
                    label: "Visual",
                    icon: VisualIcon,
                    children: [
                        {
                            id: "lyrics",
                            label: "Lyrics",
                            icon: LyricsIcon,
                            state: "inactive",
                            actionId: "select-lyrics",
                        },
                        {
                            id: "canvas",
                            label: "Canvas",
                            icon: CanvasIcon,
                            state: canvasState,
                            actionId: "activate-canvas",
                        },
                        {
                            id: "comments",
                            label: "Comments",
                            icon: CommentsIcon,
                            state: "coming-soon",
                        },
                    ],
                },
                {
                    id: "plugin-playback",
                    label: "Playback",
                    icon: PlaybackIcon,
                    state: "coming-soon",
                },
                {
                    id: "analytics",
                    label: "Analytics",
                    icon: AnalyticsIcon,
                    state: "coming-soon",
                },
            ],
        },
        {
            id: "playback",
            label: "Playback",
            icon: PlaybackIcon,
            children: [
                {
                    id: "up-next",
                    label: "Up Next",
                    icon: QueueIcon,
                    actionId: "open-queue",
                },
                {
                    id: "automix",
                    label: "Automix",
                    icon: AutomixIcon,
                    state: "coming-soon",
                },
                {
                    id: "repeat",
                    label: "Repeat",
                    icon: RepeatIcon,
                    state: "coming-soon",
                },
            ],
        },
        {
            id: "agent",
            label: "Agent",
            icon: AgentIcon,
            state: "coming-soon",
        },
    ]
}

/** Whether a node can be interacted with (entered or actioned). */
export function isNodeInteractive(node: MenuNode): boolean {
    const state = node.state ?? "available"
    return state !== "disabled" && state !== "locked" && state !== "coming-soon"
}
