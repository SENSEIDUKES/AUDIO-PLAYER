/**
 * Shared fetch + decode pipeline for automix track analysis.
 *
 * Extracted from the Automix Lite silence analysis so the Pro analysis can
 * reuse one download/decode per track. Every failure mode (no Web Audio,
 * CORS-blocked fetch, decode error, file too large, timeout) resolves to
 * `null`; callers treat that as "no analysis available".
 */
/**
 * Download and decode a track within the conservative size/duration limits.
 * Resolves to `null` on any failure.
 */
export declare function fetchAndDecodeTrack(url: string): Promise<AudioBuffer | null>;
//# sourceMappingURL=decodeTrack.d.ts.map