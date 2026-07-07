import { RepeatMode } from '../../types';
export interface PlaybackControlsState {
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
export declare function PlaybackControlsWorkspace({ playback, }: {
    playback?: PlaybackControlsState;
}): import("react").JSX.Element;
export default PlaybackControlsWorkspace;
//# sourceMappingURL=PlaybackControlsWorkspace.d.ts.map