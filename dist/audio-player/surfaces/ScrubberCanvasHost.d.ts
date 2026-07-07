import { ReactNode } from 'react';
import { PlayerFace, ScrubberDensity } from './faceCapabilities';
export interface ScrubberCanvasHostProps {
    face: PlayerFace;
    density: ScrubberDensity;
    currentTime: number;
    duration: number;
    /** 0..1, precomputed by the caller (kept for plugin/aria use). */
    progress: number;
    onSeek: (time: number) => void;
    activeSurfaceId?: string;
    /**
     * Future plugin scrubber content. When provided it replaces the fallback;
     * when absent the default progress bar renders (NO waveform in Phase 1).
     * Faces with a bespoke ProgressBar (e.g. FullCard) pass it here so seek
     * behavior stays byte-identical to before the retrofit.
     */
    children?: ReactNode;
}
/**
 * The timeline render zone (ScrubberCanvas). Available on every face; density
 * adapts the layout. It owns only chrome/layout — seeking flows straight through
 * `onSeek`. The default fallback is the existing ProgressBar.
 *
 * The stable `[data-scrubber-host]` container is the future plugin mount point.
 */
export declare function ScrubberCanvasHost({ face, density, currentTime, duration, progress, onSeek, activeSurfaceId, children, }: ScrubberCanvasHostProps): import("react").JSX.Element;
export default ScrubberCanvasHost;
//# sourceMappingURL=ScrubberCanvasHost.d.ts.map