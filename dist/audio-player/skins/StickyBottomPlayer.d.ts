import { CSSProperties } from 'react';
import { AudioPlayerTheme } from '../types';
export interface StickyBottomPlayerProps extends AudioPlayerTheme {
    /** Use CSS `position: fixed` to pin to the viewport bottom. Defaults to true. */
    fixed?: boolean;
    /**
     * Show the volume slider. Defaults to `true` on desktop and `false` on
     * mobile/touch devices (e.g. iOS Safari), where programmatic volume is
     * ignored and the mute button is the reliable control. Pass an explicit
     * boolean to override the per-device default.
     */
    showVolume?: boolean;
    className?: string;
    style?: CSSProperties;
}
/**
 * An always-visible now-playing bar (Spotify-style). Reads the shared session,
 * so it reflects and controls whatever any other skin is doing. Core transport
 * only — shuffle, repeat, automix, queue, info, and share live in the SAP
 * Controller behind the "…" button. Renders nothing when the queue is empty.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.stickyBottom`): a compact bar
 * with `supportsContextualActions: false` — deep actions and queue access route
 * through its SAPController three-dot sheet instead of a radial menu, so it does
 * not render `PlayerSurfaceButtons`. `supportsSEICanvas: false` (no canvas
 * zone). Phase 3 wires its scrubber through `ScrubberCanvasHost` (compact
 * density) so the timeline becomes a real plugin mount point.
 */
export declare function StickyBottomPlayer({ fixed, showVolume, className, style, ...theme }: StickyBottomPlayerProps): import("react").JSX.Element | null;
export default StickyBottomPlayer;
//# sourceMappingURL=StickyBottomPlayer.d.ts.map