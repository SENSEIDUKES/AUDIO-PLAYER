import { Track, TrackAnalysis } from '../types';
import { RhythmSegmentResult } from './rhythmClient';
type RhythmFn = (samples: Float32Array, sampleRate: number, offsetMs: number) => Promise<RhythmSegmentResult | null>;
/** Test seam: swap the rhythm/decode implementations. Pass null to restore. */
export declare function configureTrackAnalysis(overrides: {
    rhythm?: RhythmFn | null;
    decode?: ((url: string) => Promise<AudioBuffer | null>) | null;
    persist?: boolean;
}): void;
/**
 * Kick off (or join) Automix Pro analysis for a track. Results are cached for
 * the lifetime of the page and persisted to IndexedDB when rhythm extraction
 * succeeded; analyses run one at a time. Resolves to `null` when analysis is
 * entirely unavailable — callers fall back to Automix Lite behavior.
 */
export declare function ensureProTrackAnalysis(track: Track): Promise<TrackAnalysis | null>;
/**
 * Synchronous read of a finished Pro analysis. Returns `null` while analysis
 * is pending, failed, or was never requested.
 */
export declare function getTrackAnalysis(track: Track | null): TrackAnalysis | null;
/** Test seam: clear the page-lifetime caches. */
export declare function resetTrackAnalysisCacheForTests(): void;
export {};
//# sourceMappingURL=trackAnalysis.d.ts.map