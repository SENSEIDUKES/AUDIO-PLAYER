import { CSSProperties } from 'react';
import { AudioPlayerTheme, Track } from '../types';
import { ArcAction, ArcCommandHost } from '../surfaces/ArcActionButton';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
export interface VaultRowPlayerProps extends AudioPlayerTheme {
    /** The track this row represents. */
    track: Track;
    /** Optional 1-based number shown at the left of the row. */
    number?: number;
    /**
     * Row actions surfaced through the Arc Action Button (the primary row action
     * surface). A plain, extensible list — append actions or nest `children`
     * without touching the row.
     */
    actions?: ArcAction[];
    /**
     * Extra immediate command implementations for this row's arc (e.g.
     * `"share.email"` / `"share.url"`). Merged over the row's built-in queue
     * commands — `"queue.insertAfterCurrent"` (Play Next) and `"queue.append"`
     * (Play Later) are wired to the shared session for this track by default.
     */
    commands?: ArcCommandHost["commands"];
    /**
     * Opens a focused workspace in the SAP Controller shell — the destination
     * of the arc's `"sap-controller"` leaves (Vault, Agent). Without it those
     * leaves are pruned from the wheel rather than rendered dead.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void;
    className?: string;
    style?: CSSProperties;
}
/**
 * A slim Vault list row. Each row controls the shared session: pressing play
 * starts this track in the one global engine (jumping if it's already queued,
 * else appending). When this row is the active track its play button mirrors the
 * global play state — so it stays in sync with every other skin.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.vaultRow`, CompactPlayer family):
 * the most compact face. `supportsSEICanvas: false`, `supportsContextualActions:
 * false`, and `supportsScrubberCanvas: false` — a list row mounts **no** scrubber
 * of its own; seeking lives on the shared StickyBottom master scrubber that
 * follows the active song. It keeps `supportsAction: true`, so it renders a row
 * action button. Visual identity comes from the track's `vaultCategory` (accent
 * color + status label), not per-row artwork, keeping long lists fast to render.
 */
export declare function VaultRowPlayer({ track, number, actions, commands, onOpenWorkspace, className, style, ...theme }: VaultRowPlayerProps): import("react").JSX.Element;
export default VaultRowPlayer;
//# sourceMappingURL=VaultRowPlayer.d.ts.map