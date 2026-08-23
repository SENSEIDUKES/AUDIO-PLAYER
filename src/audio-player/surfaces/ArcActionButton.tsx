import { useCallback, useMemo } from "react"
import { DotsIcon } from "../skins/icons"
import type { MenuNode } from "../menu/menuData"
import {
    collectArcLeaves,
    pruneDeadArcActions,
    resolveArcActionState,
    routeArcAction,
} from "../menu/arcRouting"
import type { ArcAction, ArcCommandHost } from "../menu/arcRouting"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import { SEICanvasActionMenu } from "./SEICanvasActionMenu"

export type {
    ArcAction,
    ArcActionTarget,
    ArcCommandId,
    ArcCommandHost,
    PlayerActionCapability,
} from "../menu/arcRouting"

export interface ArcActionButtonProps {
    /** The declarative action tree to surface in the arc. */
    actions: ArcAction[]
    /**
     * Immediate command implementations, keyed by command id (e.g.
     * `"queue.insertAfterCurrent"`). Leaves with an `action` the host doesn't
     * implement are pruned, never rendered dead.
     */
    commands?: ArcCommandHost["commands"]
    /**
     * Opens a workspace route inside the "…" SAP Controller — the destination of
     * every `"sap-controller"` leaf, which is to say every settings action.
     * Without it those leaves (and any branch left empty) are pruned.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void
    /**
     * Capabilities this face/host genuinely has (e.g. `{ canvas: true }`).
     * Actions declaring a capability that isn't `true` here are pruned — the
     * only sanctioned reason an action is missing from a face.
     */
    capabilities?: ArcCommandHost["capabilities"]
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
        // Nodes carry no destination: all leaf dispatch goes through the single
        // router below, so the renderer can't grow a second way to open things.
        // An empty `children` array stays `undefined` so the node renders as a
        // leaf, not an empty submenu.
        children: a.children && a.children.length > 0 ? toMenuNodes(a.children) : undefined,
    }))
}

/**
 * The Arc Action Button: the radial action menu as a *shortcut launcher*.
 *
 * It owns the one dispatch path for the radial surface. Every leaf declares its
 * `target`, and this button routes it: a settings leaf opens its workspace
 * inside the "…" SAP Controller via `onOpenWorkspace`, and an immediate leaf
 * runs a command from `commands`. There is no third destination — the radial
 * menu can never open a drawer, pop-out, or face-specific surface of its own.
 *
 * Leaves the host hasn't wired, and actions whose required capability is
 * absent, are pruned before render, so every visible node does a real action;
 * entitlement-locked leaves stay visible but render locked. The trigger is a
 * single button when closed (cheap to mount in long lists) and the arc overlay
 * only renders on tap.
 */
export function ArcActionButton({
    actions,
    commands,
    onOpenWorkspace,
    capabilities,
    ariaLabel = "Actions",
    className,
}: ArcActionButtonProps) {
    const host = useMemo<ArcCommandHost>(
        () => ({
            commands,
            openWorkspace: onOpenWorkspace,
            capabilities,
        }),
        [commands, onOpenWorkspace, capabilities]
    )
    // No dead buttons: drop every leaf that can't reach a real destination on
    // this host (and every branch that ends up empty), then render the rest.
    const liveActions = useMemo(() => pruneDeadArcActions(actions, host), [actions, host])
    const items = useMemo(() => toMenuNodes(liveActions), [liveActions])
    const leaves = useMemo(
        () => new Map(collectArcLeaves(liveActions).map((leaf) => [leaf.id, leaf])),
        [liveActions]
    )

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
