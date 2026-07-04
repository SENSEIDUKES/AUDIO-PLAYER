import { ComponentType } from 'react';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
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
export type MenuItemState = "active" | "available" | "inactive" | "disabled" | "locked" | "coming-soon";
/** Known leaf actions the host resolves to real callbacks. Open string union so
 *  the tree can carry future action ids without a type change. */
export type MenuActionId = "open-queue" | "activate-canvas" | "select-lyrics" | "previous-track" | "next-track" | "open-activity-log" | (string & {});
/**
 * A node in the SEI Canvas Action Menu tree. Either a branch (has `children`,
 * pushes a submenu) or a leaf (has an `actionId`, resolves to a host callback).
 * Deliberately free of any engine/session imports so the arc renderer and this
 * data model can later be promoted into the seihouse-ui design system.
 */
export interface MenuNode {
    id: string;
    label: string;
    /** Icon component rendered as `<Icon />` inside the node button. */
    icon: ComponentType;
    /** Defaults to `"available"` when omitted. */
    state?: MenuItemState;
    /** Branch: entering this node opens a submenu of `children`. */
    children?: MenuNode[];
    /** Leaf: resolved against host callbacks (e.g. `"open-queue"`). */
    actionId?: MenuActionId;
    /**
     * Leaf: the focused workspace this node opens in the SAP Controller shell.
     * When the host wires `onOpenWorkspace`, this takes precedence over the
     * legacy `actionId`; without it the node falls back to `actionId`, so the
     * field is additive and backward compatible.
     */
    workspaceRoute?: WorkspaceRoute;
}
export interface BuildMenuTreeOptions {
    /** Whether the current face can host the SEICanvas. Disables the Canvas node. */
    canvasSupported: boolean;
    /** Whether the canvas surface is currently open (marks Canvas as `active`). */
    isCanvasActive: boolean;
    /**
     * Add Previous/Next transport leaves under Playback. Compact faces that drop
     * their inline skip buttons (e.g. the mini sidebar) opt in so skip/next moves
     * into the menu, freeing the row for title/artist. Defaults to off, so faces
     * with their own transport controls (fullCard) keep the menu uncluttered.
     */
    includeTransport?: boolean;
    /** Whether previous/next are currently available (gates the transport leaves). */
    canPrevious?: boolean;
    canNext?: boolean;
    /**
     * Whether the host wires `onOpenWorkspace` (SAP Controller routing). Nodes
     * whose only real destination is a focused workspace (Lyrics, Automix,
     * Agent, Activity Log) are omitted entirely when the host can't route
     * there — the arc renders no dead buttons. Defaults to off.
     */
    canRouteWorkspaces?: boolean;
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
export declare function buildMenuTree({ canvasSupported, isCanvasActive, includeTransport, canPrevious, canNext, canRouteWorkspaces, }: BuildMenuTreeOptions): MenuNode[];
/** Whether a node can be interacted with (entered or actioned). */
export declare function isNodeInteractive(node: MenuNode): boolean;
//# sourceMappingURL=menuData.d.ts.map