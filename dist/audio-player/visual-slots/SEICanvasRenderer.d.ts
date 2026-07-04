export interface SEICanvasRendererProps {
    /** Current playback position (seconds) handed to the active visual. */
    currentTime?: number;
    /** Total track duration (seconds) handed to the active visual. */
    duration?: number;
    /** The active track's lyrics blob, for lyric-style visuals. */
    lyrics?: string | null;
}
/**
 * Mounts the active `seiCanvas` visual component into the SEI Canvas region with
 * its live settings. Replaces the old placeholder/demo content. When no seiCanvas
 * component is active it renders a clean empty state — not "plugins mount here".
 *
 * Playback context is passed in via props (sourced from the session in
 * session-based skins, or the portable player's own engine) and forwarded to the
 * component, so visual components stay decoupled from the global audio session.
 */
export declare function SEICanvasRenderer({ currentTime, duration, lyrics, }?: SEICanvasRendererProps): import("react").JSX.Element;
export default SEICanvasRenderer;
//# sourceMappingURL=SEICanvasRenderer.d.ts.map