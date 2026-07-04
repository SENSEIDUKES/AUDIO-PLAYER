import { WorkspaceRoute } from './workspaceRoutes';
import { PlaybackControlsState } from './PlaybackControlsWorkspace';
export interface WorkspaceShellProps {
    /** The destination to render. Must not be `"options"` — that path stays on
     *  SAPController's original content. */
    route: WorkspaceRoute;
    /** Closes the whole sheet (same handler SAPController uses elsewhere). */
    onClose: () => void;
    /** Optional lyrics snapshot forwarded to the lyrics workspace. */
    lyrics?: string;
    /** Optional playback state forwarded to the Controls workspace. */
    playback?: PlaybackControlsState;
}
export declare function WorkspaceShell({ route, onClose, lyrics, playback, }: WorkspaceShellProps): import("react").JSX.Element;
export default WorkspaceShell;
//# sourceMappingURL=WorkspaceShell.d.ts.map