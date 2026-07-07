import { CSSProperties } from 'react';
import { AudioPlayerTheme, MediaSource, Track } from '../types';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
export interface SeaCardPlayerProps extends AudioPlayerTheme {
    /** The track this card represents and plays into the shared session. */
    track: Track;
    /** CSS background image for the card art (gradient or url). Applied as
        background-image so the cover/center sizing rules hold. */
    art?: string;
    /**
     * Unified artwork media (image or video). Supersedes `art` when set; video
     * renders muted/looping in the card art block.
     */
    artMedia?: MediaSource | null;
    /** Optional price / tag chip. */
    tag?: string;
    /**
     * Opens a focused workspace in the SAP Controller shell — the destination
     * of the arc's `"sap-controller"` leaves (the standardized Plugins,
     * Playback, Agents arms). Without it those leaves are pruned from the
     * wheel rather than rendered dead.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void;
    /** Inline typography for the card title. */
    titleFont?: CSSProperties;
    /** Inline typography for the card artist line. */
    artistFont?: CSSProperties;
    className?: string;
    style?: CSSProperties;
}
/**
 * An embeddable "SEA card" surface — a marketplace/album card with an overlaid
 * play button that plays its track in the global session. When its track is the
 * active one it shows live progress and a pause state, kept in sync with every
 * other skin through the shared engine.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.seaCard`): a marketplace card.
 * `supportsContextualActions: false`, so it renders no contextual menu — taps on
 * the card are about previewing/playing the track, not deep actions. The inline
 * scrubber stays a plain progress bar; Phase 4 adds a small wave trigger on the
 * active card that opens the overlay `SEICanvasHost`, which shows the hero +
 * the interactive `WaveformAdapter` (`supportsWaveform: true`). No radial menu is
 * added — the card stays clean and tap-to-play.
 */
export declare function SeaCardPlayer({ track, art, artMedia, tag, onOpenWorkspace, titleFont, artistFont, className, style, ...theme }: SeaCardPlayerProps): import("react").JSX.Element;
export default SeaCardPlayer;
//# sourceMappingURL=SeaCardPlayer.d.ts.map