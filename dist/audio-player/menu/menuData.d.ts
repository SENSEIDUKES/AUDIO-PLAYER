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
export type MenuActionId = "open-queue" | "activate-canvas" | "select-lyrics" | "previous-track" | "next-track" | "share-link" | "toggle-favorite" | "open-activity-log" | (string & {});
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
/** Entitlements that gate parts of the standardized arc menu. */
export interface ArcMenuEntitlements {
    /** Studio Scout is the paid Scout tier; without it Scout routes to Demo Scout. */
    studioScout?: boolean;
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
     * whose only real destination is a focused workspace (the Plugins leaves,
     * Controls, Debug, Share › Add to, the Agents branch) are omitted entirely
     * when the host can't route there — the arc renders no dead buttons.
     * Defaults to off.
     */
    canRouteWorkspaces?: boolean;
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics") both work.
     * Drives the Plugins branch: only *currently active* plugins render, sorted
     * into Audio / Visual / Analytics. Omitted or empty means no plugin leaves
     * (Canvas can still keep the Visual branch alive on canvas-capable faces).
     */
    activePluginIds?: readonly string[];
    /** Whether the host wires the Share › Link leaf (copy/share the track URL). */
    canShareLink?: boolean;
    /** Whether the host wires the Share › Favorite leaf. */
    canFavorite?: boolean;
    /** Marks the Favorite leaf active (the track is already a favorite). */
    isFavorite?: boolean;
    /** Entitlements gating the Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements;
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
export declare function buildMenuTree({ canvasSupported, isCanvasActive, includeTransport, canPrevious, canNext, canRouteWorkspaces, activePluginIds, canShareLink, canFavorite, isFavorite, entitlements, }: BuildMenuTreeOptions): MenuNode[];
/** Whether a node can be interacted with (entered or actioned). */
export declare function isNodeInteractive(node: MenuNode): boolean;
//# sourceMappingURL=menuData.d.ts.map