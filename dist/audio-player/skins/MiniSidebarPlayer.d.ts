import { CSSProperties } from 'react';
import { AudioPlayerTheme, MediaSource } from '../types';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
export interface MiniSidebarPlayerProps extends AudioPlayerTheme {
    /** Optional CSS background image for the small art block (gradient or url).
        Applied as background-image so the cover/center sizing rules hold. */
    art?: string;
    /**
    /**
     * Unified artwork media (image or video). Supersedes `art` when set; video
     * renders muted/looping in the small art block.
     */
    artMedia?: MediaSource | null;
    /**
     * Opens a focused workspace in the SAP Controller shell. Required for the
     * radial menu to render its full set of workspace-routed options.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void;
    /** Active plugin ids to populate the Plugins branch. */
    activePluginIds?: readonly string[];
    className?: string;
    style?: CSSProperties;
}
/**
 * A condensed widget for a sidebar: small art, current track, play/pause, and
 * the action menu. Reads the shared session so it always shows what is globally
 * playing.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.miniSidebar`, CompactPlayer
 * family): a compact face. `supportsSEICanvas: false`, so the canvas zone and its
 * left surface button are auto-hidden. `supportsScrubberCanvas: false` — the mini
 * mounts **no** scrubber; seeking lives on the shared StickyBottom master. It is
 * the only compact face with the contextual radial menu
 * (`supportsContextualActions`), which is also where skip/next now live (via
 * `showTransport`) — freeing the row for title/artist instead of a Next button.
 * `PlayerSurfaceButtons` reads the capability flags from the model, so passing
 * `surface` plus the transport wiring yields the correct menu.
 */
export declare function MiniSidebarPlayer({ art, artMedia, onOpenWorkspace, activePluginIds, className, style, ...theme }: MiniSidebarPlayerProps): import("react").JSX.Element;
export default MiniSidebarPlayer;
//# sourceMappingURL=MiniSidebarPlayer.d.ts.map