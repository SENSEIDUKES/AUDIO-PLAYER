import { useCallback, useMemo } from "react"
import { DotsIcon } from "../skins/icons"
import type { MenuNode } from "../menu/menuData"
import {
    pruneDeadArcActions,
    resolveArcActionState,
    routeArcAction,
} from "../menu/arcRouting"
import type { ArcAction, ArcCommandHost } from "../menu/arcRouting"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import { SEICanvasActionMenu } from "./SEICanvasActionMenu"

export type { ArcAction, ArcActionTarget, ArcCommandId, ArcCommandHost } from "../menu/arcRouting"

export interface ArcActionButtonProps {
    /** The declarative action tree to surface in the arc. */
    actions: ArcAction[]
    /**
     * Immediate command implementations, keyed by command id (e.g.
     * `"queue.insertAfterCurrent"`). Leaves with an `action` the host doesn't
     * implement are pruned, never rendered dead.
     */
    commands?: ArcCommandHost["commands"]
    /** Opens/toggles the SEI Canvas — the destination of `"sei-canvas"` leaves. */
    onOpenCanvas?: () => void
    /**
     * Opens a focused workspace route in the SAP Controller shell — the
     * destination of `"sap-controller"` leaves. Without it those leaves (and
     * any branch left empty) are pruned.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void
    ariaLabel?: string
    className?: string
}

/** Map the declarative action tree onto the arc menu's `MenuNode` tree. */
function toMenuNodes(actions: ArcAction[]): MenuNode[] {
    return actions.map((a) => ({
        id: a.id,
        label: a.label,
        icon: a.icon ?? DotsIcon,
        // Locked-entitlement targets render locked without the caller having
        // to set both fields; an explicit `state` still wins.
        state: resolveArcActionState(a),
        // No `actionId`/`workspaceRoute` on the nodes: all leaf dispatch goes
        // through the single router below, keeping this decoupled from the
        // menu's reserved queue/canvas actions. An empty `children` array stays
        // `undefined` so the node renders as a leaf, not an empty submenu.
        children:
            a.children && a.children.length > 0
                ? toMenuNodes(a.children)
                : undefined,
    }))
}

/** Flatten leaf actions into an id → action map for O(1) dispatch. */
function indexLeaves(actions: ArcAction[], map: Map<string, ArcAction>): void {
    for (const a of actions) {
        if (a.children && a.children.length > 0) indexLeaves(a.children, map)
        else map.set(a.id, a)
    }
}

/**
 * The Arc Action Button: the SEIHouse command-wheel affordance backed by a
 * plain `ArcAction[]` model, upgraded from a pretty radial UI into a command
 * router. Every leaf declares its `target`, and the button routes it into one
 * of exactly two real surfaces — the SEI Canvas (`onOpenCanvas`) or the SAP
 * Controller (`onOpenWorkspace`) — or runs an immediate command from
 * `commands`. Leaves the host hasn't wired are pruned before render, so every
 * visible node does a real action; entitlement-locked leaves stay visible but
 * render locked. The trigger is a single button when closed (cheap to mount in
 * long lists) and the arc overlay only renders on tap.
 */
export function ArcActionButton({
    actions,
    commands,
    onOpenCanvas,
    onOpenWorkspace,
    ariaLabel = "Actions",
    className,
}: ArcActionButtonProps) {
    const host = useMemo<ArcCommandHost>(
        () => ({
            commands,
            openCanvas: onOpenCanvas,
            openWorkspace: onOpenWorkspace,
        }),
        [commands, onOpenCanvas, onOpenWorkspace]
    )
    // No dead buttons: drop every leaf that can't reach a real destination on
    // this host (and every branch that ends up empty), then render the rest.
    const liveActions = useMemo(
        () => pruneDeadArcActions(actions, host),
        [actions, host]
    )
    const items = useMemo(() => toMenuNodes(liveActions), [liveActions])
    const leaves = useMemo(() => {
        const map = new Map<string, ArcAction>()
        indexLeaves(liveActions, map)
        return map
    }, [liveActions])

    const handleSelect = useCallback(
        (node: MenuNode) => {
            const action = leaves.get(node.id)
            if (action) routeArcAction(action, host)
        },
        [leaves, host]
    )

    if (liveActions.length === 0) return null
    return (
        <SEICanvasActionMenu
            items={items}
            onSelect={handleSelect}
            ariaLabel={ariaLabel}
            className={className}
        />
    )
}

export default ArcActionButton
