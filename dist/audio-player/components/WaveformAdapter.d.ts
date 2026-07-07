import { PlayerFace, ScrubberDensity } from '../surfaces/faceCapabilities';
export interface WaveformAdapterProps {
    /** The face whose capability decides waveform vs. progress by default. */
    face: PlayerFace;
    /** Scrubber density; drives the default waveform height. */
    density: ScrubberDensity;
    currentTime: number;
    duration: number;
    buffered: number;
    disabled: boolean;
    isSeeking: boolean;
    onSeek: (time: number) => void;
    onSeekStart: () => void;
    onSeekEnd: () => void;
    peaks?: number[][];
    peaksDuration?: number;
    getDecodedData?: () => AudioBuffer | null;
    url?: string;
    sourceKey?: string;
    /** Explicit canvas height; defaults to `getScrubberHeight(density)`. */
    height?: number;
    waveColor?: string;
    progressColor?: string;
    cursorColor?: string;
    /**
     * Force the waveform on/off regardless of the face capability. Used by the
     * standalone player (`showWaveform`) and the seaCard overlay. When omitted,
     * the face's `supportsWaveform` capability decides.
     */
    waveform?: boolean;
}
/**
 * The single, session-agnostic bridge between a scrubber zone and its content.
 * It chooses the waveform (`WaveformProgress`) or the plain `ProgressBar` from
 * the face capability (overridable via `waveform`), so every face — session-based
 * or the standalone player — renders the same scrubber through one component.
 *
 * It owns no playback state: all seeking flows out through the same
 * onSeek/onSeekStart/onSeekEnd contract as `ProgressBar`. `WaveformProgress`
 * already falls back to a `ProgressBar` internally while peaks load or when none
 * can be produced, so the timeline always works and never shifts layout.
 */
export declare function WaveformAdapter({ face, density, currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, peaks, peaksDuration, getDecodedData, url, sourceKey, height, waveColor, progressColor, cursorColor, waveform, }: WaveformAdapterProps): import("react").JSX.Element;
export default WaveformAdapter;
//# sourceMappingURL=WaveformAdapter.d.ts.map