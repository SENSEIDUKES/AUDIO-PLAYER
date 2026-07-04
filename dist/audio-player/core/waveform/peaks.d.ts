/**
 * Waveform peak extraction. Produces the `peaks` arrays wavesurfer.js accepts
 * (per-channel 0–1 amplitudes) from decoded PCM, plus a fetch+decode fallback
 * for backends that stream and never hold decoded data.
 */
/**
 * Reduce an AudioBuffer to a single merged-mono peaks channel: the abs-max
 * sample per bucket across up to two channels. wavesurfer renders a single
 * channel as a symmetric waveform, and `normalize: true` handles scaling.
 */
export declare function extractPeaks(buffer: AudioBuffer, buckets?: number): number[][];
export interface ComputedPeaks {
    peaks: number[][];
    duration: number;
}
/**
 * Fetch and decode an audio URL into waveform peaks. Used as the fallback for
 * the html5 backend, where no decoded data exists — note this downloads the
 * file a second time and requires CORS on remote sources.
 *
 * Decodes through a throwaway OfflineAudioContext so it never consumes the
 * shared playback AudioContext.
 */
export declare function computePeaksFromUrl(url: string, signal?: AbortSignal): Promise<ComputedPeaks>;
//# sourceMappingURL=peaks.d.ts.map