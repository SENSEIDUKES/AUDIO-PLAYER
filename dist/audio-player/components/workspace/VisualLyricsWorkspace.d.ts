export interface VisualLyricsWorkspaceProps {
    /** Current track lyrics, when available. Threaded through later so this
     *  surface can render alongside the existing LyricsPlugin state instead of
     *  owning its own copy. */
    lyrics?: string;
}
export declare function VisualLyricsWorkspace({ lyrics }: VisualLyricsWorkspaceProps): import("react").JSX.Element;
export default VisualLyricsWorkspace;
//# sourceMappingURL=VisualLyricsWorkspace.d.ts.map