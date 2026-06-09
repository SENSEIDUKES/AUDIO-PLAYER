import type { Track } from "../types"

/**
 * Returns a stable string that uniquely identifies a track.
 *
 * Prefers `track.id` when set — the cheapest, most reliable key.
 * Falls back to a composite of title + artist + audioFile for tracks that
 * were created before `id` was introduced. The fallback is good enough for
 * small playlists but can collide at Vault scale (duplicate titles, shared
 * CDN URLs after normalisation, stems/mixes with similar names), which is
 * why setting `id` is strongly recommended for production use.
 */
export function trackKey(track: Track): string {
    if (!track) return ""
    if (track.id) return `id:${track.id}`
    // Unambiguous tuple encoding. A raw "title:artist:audioFile" join collides
    // when user-controlled metadata itself contains the delimiter (e.g. a title
    // with a colon vs. an artist with one). JSON.stringify escapes each field so
    // distinct (title, artist, audioFile) triples always map to distinct keys.
    return `t:${JSON.stringify([
        track.title ?? "",
        track.artist ?? "",
        track.audioFile ?? "",
    ])}`
}
