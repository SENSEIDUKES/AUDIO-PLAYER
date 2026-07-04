import { ReactNode } from 'react';
export interface ScrubberCanvasRendererProps {
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    /**
     * The existing scrubber content (e.g. the WaveformAdapter/progress group).
     * Rendered as the default fallback when no `scrubberCanvas` component is
     * active, so waveform/progress behavior is byte-identical to before.
     */
    children: ReactNode;
}
/**
 * Intake point for `scrubberCanvas` visuals. If a component is active for the
 * slot it is mounted with live timeline props + its settings; otherwise the
 * provided `children` (the existing waveform/progress) render unchanged. No
 * scrubberCanvas component ships in V1, so the default path is the fallback.
 */
export declare function ScrubberCanvasRenderer({ currentTime, duration, onSeek, children, }: ScrubberCanvasRendererProps): import("react").JSX.Element;
export default ScrubberCanvasRenderer;
//# sourceMappingURL=ScrubberCanvasRenderer.d.ts.map