import { Track } from '../types';
/**
 * Returns a stable string that uniquely identifies a track.
 *
 * Prefers `track.id` when set — the cheapest, most reliable key.
 * Falls back to a composite of title + artist + source list for tracks that
 * were created before `id` was introduced. The fallback is good enough for
 * small playlists but can collide at Vault scale (duplicate titles, shared
 * CDN URLs after normalisation, stems/mixes with similar names), which is
 * why setting `id` is strongly recommended for production use.
 */
export declare function trackKey(track: Track): string;
//# sourceMappingURL=trackKey.d.ts.map