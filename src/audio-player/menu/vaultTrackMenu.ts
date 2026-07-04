import {
    AgentIcon,
    LinkIcon,
    LyricsIcon,
    MailIcon,
    NextIcon,
    QueueIcon,
    ShareIcon,
    VaultIcon,
} from "../skins/icons"
import type { ArcAction } from "./arcRouting"

/**
 * Entitlements that gate parts of the Vault command wheel. Absent/false means
 * the corresponding leaf renders locked (visible, honest, not tappable).
 */
export interface VaultTrackEntitlements {
    /** Studio Scout is a paid agent; without this it renders locked. */
    studioScout?: boolean
}

export interface BuildVaultTrackArcActionsOptions {
    entitlements?: VaultTrackEntitlements
}

/**
 * The Vault face's selected-track command wheel:
 *
 *     Add to Queue › Play Next / Play Later     (immediate queue commands)
 *     Share        › Email / URL                (immediate share commands)
 *     Vault        › Add To / Playlist          (SAP Controller workspaces)
 *     Agent        › Demo Scout / Studio Scout / Memoir (SAP Controller workspaces)
 *
 * Every leaf carries an explicit `target`, so the arc renders it only when the
 * host actually wires that destination — there are no dead buttons, and the
 * only surfaces reachable from here are immediate commands, the SEI Canvas,
 * and the SAP Controller. A builder (not a constant) so entitlement state can
 * flip Studio Scout between routed and locked per render.
 */
export function buildVaultTrackArcActions({
    entitlements,
}: BuildVaultTrackArcActionsOptions = {}): ArcAction[] {
    const hasStudioScout = entitlements?.studioScout === true
    return [
        {
            id: "add-to-queue",
            label: "Add to Queue",
            icon: QueueIcon,
            children: [
                {
                    id: "play-next",
                    label: "Play Next",
                    icon: NextIcon,
                    target: "immediate-action",
                    action: "queue.insertAfterCurrent",
                },
                {
                    id: "play-later",
                    label: "Play Later",
                    icon: QueueIcon,
                    target: "immediate-action",
                    action: "queue.append",
                },
            ],
        },
        {
            id: "share",
            label: "Share",
            icon: ShareIcon,
            children: [
                {
                    id: "share-email",
                    label: "Email",
                    icon: MailIcon,
                    target: "immediate-action",
                    action: "share.email",
                },
                {
                    id: "share-url",
                    label: "URL",
                    icon: LinkIcon,
                    target: "immediate-action",
                    action: "share.url",
                },
            ],
        },
        {
            id: "vault",
            label: "Vault",
            icon: VaultIcon,
            children: [
                {
                    id: "vault-add-to",
                    label: "Add To",
                    icon: VaultIcon,
                    target: "sap-controller",
                    workspaceRoute: "library:vault",
                },
                {
                    id: "vault-playlist",
                    label: "Playlist",
                    icon: QueueIcon,
                    target: "sap-controller",
                    workspaceRoute: "library:playlists",
                },
            ],
        },
        {
            id: "agent",
            label: "Agent",
            icon: AgentIcon,
            children: [
                {
                    id: "agent-demo-scout",
                    label: "Demo Scout",
                    icon: AgentIcon,
                    target: "sap-controller",
                    workspaceRoute: "agent:demo-scout",
                },
                {
                    id: "agent-studio-scout",
                    label: "Studio Scout",
                    icon: AgentIcon,
                    // Paid agent: routed when entitled, locked (visible, honest,
                    // not tappable) when the entitlement is missing.
                    target: hasStudioScout ? "sap-controller" : "locked-entitlement",
                    workspaceRoute: "agent:studio-scout",
                },
                {
                    id: "agent-memoir",
                    label: "Memoir",
                    icon: LyricsIcon,
                    target: "sap-controller",
                    workspaceRoute: "agent:memoir",
                },
            ],
        },
    ]
}
