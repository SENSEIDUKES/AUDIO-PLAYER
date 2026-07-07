export interface RhythmSegmentResult {
    bpm: number;
    /** Beat positions in milliseconds of track time. */
    ticksMs: number[];
    /** Raw RhythmExtractor2013 confidence, 0–5.32. */
    confidenceRaw: number;
}
export declare function isRhythmUnavailable(): boolean;
/**
 * Run beat/BPM extraction on a mono 44.1kHz segment. `samples` is transferred
 * to the worker and must not be reused afterwards. Resolves to `null` when
 * rhythm analysis is unavailable or fails.
 */
export declare function analyzeRhythm(samples: Float32Array, sampleRate: number, offsetMs: number): Promise<RhythmSegmentResult | null>;
//# sourceMappingURL=rhythmClient.d.ts.map