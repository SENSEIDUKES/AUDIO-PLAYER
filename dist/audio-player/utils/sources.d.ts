import { Track, TrackSource } from '../types';
/**
 * Normalize a source URL once at the source-resolution boundary so playback,
 * waveform, automix, cache keys, and fallback comparisons all speak the same
 * URL language. Relative URLs become absolute in browser environments, matching
 * what HTMLMediaElement.currentSrc reports after the browser resolves `src`.
 */
export declare function normalizeSourceUrl(url: string): string;
/** Match stored source URLs against browser-resolved media URLs. */
export declare function sourceUrlsMatch(sourceUrl: string, failedUrl: string): boolean;
/**
 * Resolve the ordered source list for a track.
 *
 * `track.sources` is authoritative when present and non-empty. Otherwise the
 * legacy `audioFile` remains the primary URL and `fallbackSources` are appended.
 */
export declare function getTrackSources(track: Track | null | undefined): TrackSource[];
/** First playable URL for a track after source normalization. */
export declare function getPrimaryTrackSource(track: Track | null | undefined): string;
/** Stable signature used to detect source-list changes without storing objects. */
export declare function trackSourcesSignature(track: Track | null | undefined): string;
//# sourceMappingURL=sources.d.ts.map