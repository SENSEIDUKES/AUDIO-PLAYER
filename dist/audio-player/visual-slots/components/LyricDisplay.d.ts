import { VisualComponentDefinition, VisualComponentProps, VisualSettingsPanelProps } from '../types';
/**
 * First real SEI Canvas visual: a lyric display, ported in the Workshop-Light
 * direction (a standalone visual + a matching settings panel). It reads the live
 * track lyrics and playback position from the audio session and renders styled
 * lyric lines; all styling comes from {@link LyricSettings} via React props (no
 * direct DOM manipulation). CSS is scoped under `.sap-visual-lyric`.
 */
export interface LyricSettings {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: number;
    highlightColor: string;
    animationMode: "none" | "fade" | "slide";
}
export declare const LYRIC_DISPLAY_ID = "lyric-display";
export declare const lyricDefaultSettings: LyricSettings;
/**
 * The mounted SEI Canvas visual. Playback context (lyrics, position, duration)
 * arrives via props from the host renderer rather than the global audio session,
 * so the component works in every player — including the portable one that has no
 * `AudioSessionProvider`. With no timed-lyric metadata available, the "active"
 * line is estimated from playback progress so the highlight still moves with the
 * track — a real, settings-driven visual rather than a placeholder.
 */
export declare function LyricDisplay({ settings, playback, }: VisualComponentProps<LyricSettings>): import("react").JSX.Element;
/**
 * Controlled settings editor for the lyric display. Rendered through the lyrics
 * workspace route via {@link ControllerPanelRenderer}; edits flow back through
 * `onChange` and update the live SEI Canvas visual.
 */
export declare function LyricSettingsPanel({ settings, onChange, }: VisualSettingsPanelProps<LyricSettings>): import("react").JSX.Element;
/** The registrable definition wiring the display + panel into the seiCanvas slot. */
export declare const lyricDisplayDefinition: VisualComponentDefinition<LyricSettings>;
//# sourceMappingURL=LyricDisplay.d.ts.map