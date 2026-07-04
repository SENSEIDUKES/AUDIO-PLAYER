import { Track, TrackTrims } from '../types';
/**
 * RMS-scan the first/last seconds of a decoded buffer for near-silence.
 * Pure: also used by the Automix Pro analysis on its shared decode.
 */
export declare function scanSilenceEdges(buffer: AudioBuffer): TrackTrims;
/**
 * Kick off (or join) silence analysis for a track. Results are cached for the
 * lifetime of the page; analyses run one at a time. Resolves to `null` when
 * analysis is unavailable or unreliable — callers must fall back to the
 * track's natural start/end.
 */
export declare function ensureTrackAnalysis(track: Track): Promise<TrackTrims | null>;
/**
 * Synchronous read of a finished analysis. Returns `null` while analysis is
 * pending, failed, or was never requested.
 */
export declare function getTrackTrims(track: Track | null): TrackTrims | null;
/**
 * Seed the trims cache from another analysis pipeline. The Automix Pro
 * orchestrator shares this module's decode and silence scan; seeding lets
 * `getTrackTrims()` serve trims as soon as the scan finishes, long before the
 * slower rhythm extraction settles, without a second download. Existing
 * entries are never overwritten.
 */
export declare function seedTrackTrims(key: string, trims: TrackTrims | null): void;
//# sourceMappingURL=silenceAnalysis.d.ts.map