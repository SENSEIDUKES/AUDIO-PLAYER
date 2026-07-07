export interface ControllerPanelRendererProps {
    /** The component whose SettingsPanel should render in the workspace sheet. */
    componentId: string;
    /** Optional preview context (e.g. the active track's lyrics). */
    lyrics?: string;
}
/**
 * Renders a registered component's `SettingsPanel` inside the SAPController
 * workspace sheet, wired to the per-player settings store. Used by the lyrics
 * workspace route to edit the lyric display's settings; edits flow straight back
 * to the live SEI Canvas visual through context.
 */
export declare function ControllerPanelRenderer({ componentId, lyrics, }: ControllerPanelRendererProps): import("react").JSX.Element;
export default ControllerPanelRenderer;
//# sourceMappingURL=ControllerPanelRenderer.d.ts.map