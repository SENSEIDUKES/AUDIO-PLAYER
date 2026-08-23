import type { ComponentType } from "react"

/**
 * The *render* model for the radial action menu.
 *
 * This file is deliberately tiny: it describes how a node looks, nothing about
 * what it does. The single source of truth for what actions exist and where
 * they go is the canonical hierarchy (`canonicalActions.ts`) plus the routing
 * contract (`arcRouting.ts`). Keeping dispatch out of here is what prevents a
 * second, drifting menu implementation from growing back.
 *
 * Free of any engine/session imports so the arc renderer and this data model
 * can later be promoted into the seihouse-ui design system.
 */

/**
 * Visual/behavioral state of a single menu node. These map to distinct stylings
 * in the arc and decide whether the node is interactive.
 *
 * - `active`    — currently on (accent ring/glow), still tappable
 * - `available` — ready to use (glass), the default
 * - `disabled`  — not usable in this context
 * - `locked`    — gated behind an entitlement; shows a lock, not interactive
 */
export type MenuItemState = "active" | "available" | "disabled" | "locked"

/**
 * A node in the radial menu tree. Either a branch (has `children`, pushes a
 * submenu) or a leaf. A leaf carries no destination of its own — the menu
 * reports the selected node by `id` and the action router resolves it.
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
}

/** Whether a node can be interacted with (entered or actioned). */
export function isNodeInteractive(node: MenuNode): boolean {
    const state = node.state ?? "available"
    return state !== "disabled" && state !== "locked"
}
