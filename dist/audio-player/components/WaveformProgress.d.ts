export interface WaveformProgressProps {
    currentTime: number;
    duration: number;
    buffered: number;
    disabled: boolean;
    isSeeking: boolean;
    onSeek: (time: number) => void;
    onSeekStart: () => void;
    onSeekEnd: () => void;
    /** Precomputed peaks (priority 1) with their duration. */
    peaks?: number[][];
    peaksDuration?: number;
    /** Decoded PCM from the engine (priority 2 — webaudio backend). */
    getDecodedData?: () => AudioBuffer | null;
    /**
     * Audio URL for the fetch+decode fallback (priority 3). Only pass this on
     * backends that will not decode the file themselves (html5) — it costs a
     * second download and requires CORS on remote sources.
     */
    url?: string;
    /** Logical track identity; changing it resets the waveform. */
    sourceKey?: string;
    /** Canvas height in px. Default 48. */
    height?: number;
    /** Concrete colors. Fall back to --ap-track / --ap-progress / --ap-accent. */
    waveColor?: string;
    progressColor?: string;
    cursorColor?: string;
}
/**
 * Waveform scrubber rendered by wavesurfer.js. The engine remains the only
 * playback owner: wavesurfer is created with pre-resolved `peaks` + `duration`
 * only (never a URL or media element), progress is pushed in via `setTime`,
 * and click/drag interactions are forwarded out through the same
 * onSeek/onSeekStart/onSeekEnd contract as ProgressBar.
 *
 * While peaks are loading — or when they cannot be produced at all — the
 * regular ProgressBar renders in the same fixed-height slot, so scrubbing
 * always works and the layout never shifts.
 */
export declare function WaveformProgress({ currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, peaks, peaksDuration, getDecodedData, url, sourceKey, height, waveColor, progressColor, cursorColor, }: WaveformProgressProps): import("react").JSX.Element;
//# sourceMappingURL=WaveformProgress.d.ts.map