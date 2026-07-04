import { AudioPlayerTheme, RepeatMode } from '../types';
import { WorkspaceRoute } from './workspace/workspaceRoutes';
export interface SAPControllerPlayback {
    shuffle: boolean;
    onToggleShuffle: () => void;
    repeatMode: RepeatMode;
    onCycleRepeat: () => void;
    /** Omit to hide the Automix row (e.g. single-track players). */
    automix?: boolean;
    onToggleAutomix?: () => void;
    /** Omit to hide the Auto Play row (sessions have no autoplay toggle). */
    autoPlay?: boolean;
    onToggleAutoPlay?: () => void;
}
export interface SAPControllerQueue {
    count: number;
    /** Open the queue UI. The controller closes itself before calling this. */
    onOpenQueue: () => void;
}
export interface SAPControllerInfo {
    title: string;
    artist: string;
    /** Seconds; 0/NaN renders as a placeholder. */
    duration: number;
    lyrics?: string;
}
export interface SAPControllerShare {
    onShare: () => void;
    copied: boolean;
}
export interface SAPControllerProps extends AudioPlayerTheme {
    open: boolean;
    onClose: () => void;
    /**
     * Which workspace the sheet renders. Defaults to `"options"`, the legacy
     * three-dot content. Any other route renders the matching focused workspace
     * surface through the same portal/focus-trap shell.
     */
    route?: WorkspaceRoute;
    /** Sections render only when their prop is provided. */
    playback?: SAPControllerPlayback;
    queue?: SAPControllerQueue;
    info?: SAPControllerInfo;
    share?: SAPControllerShare;
    /** Read-only list of active plugin names (standalone player for V1). */
    pluginNames?: readonly string[];
    /**
     * Waveform plugin settings. Provided only when the Waveform plugin is active;
     * renders the "Show Waveform" toggle that switches the scrubber between the
     * wavesurfer waveform and the basic progress bar.
     */
    waveform?: {
        enabled: boolean;
        onToggle: () => void;
    };
}
export declare function SAPController({ open, onClose, route, playback, queue, info, share, pluginNames, waveform, accentColor, playIconColor, textColor, progressColor, trackColor, backgroundColor, }: SAPControllerProps): import('react').ReactPortal | null;
//# sourceMappingURL=SAPController.d.ts.map