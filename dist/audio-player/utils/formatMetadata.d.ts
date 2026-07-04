import { Track } from '../types';
/**
 * Pure metadata-formatting helpers shared by every face and the reusable
 * TrackMetadata component. No React, no DOM, no engine imports — just string
 * composition with graceful fallbacks, so the presentation logic stays testable
 * and identical everywhere a track's title/artist/album is shown.
 */
/** The subset of a Track these helpers read. Accepting a partial keeps them
 *  usable with loose/streamed metadata, not just full Track objects. */
export type TrackMetadataFields = Partial<Pick<Track, "title" | "artist" | "albumTitle" | "releaseTitle" | "featuredArtists" | "versionLabel" | "explicit" | "subtitle">>;
/** Title for display, falling back to a labeled placeholder when empty. */
export declare function getDisplayTitle(track: TrackMetadataFields | null | undefined, fallback?: string): string;
/** Artist for display, falling back to a labeled placeholder when empty. */
export declare function getDisplayArtist(track: TrackMetadataFields | null | undefined, fallback?: string): string;
/** Append a version qualifier in parentheses, e.g. `Title (Radio Edit)`. */
export declare function formatVersionedTitle(title: string, versionLabel?: string): string;
/**
 * Compose the "feat. …" suffix from a list of featured artists, dropping blanks.
 * One name → `feat. A`; many → `feat. A, B & C`. Empty list → `""`.
 */
export declare function formatFeatured(featuredArtists?: readonly string[]): string;
/**
 * The secondary line: `Artist [feat. …] [· Album]`. Album wins the trailing
 * slot; when there's neither album nor featured artists, an optional `subtitle`
 * fills it instead.
 */
export declare function formatSecondaryLine(track: TrackMetadataFields | null | undefined, artistFallback?: string): string;
export interface ShouldEnableMarqueeArgs {
    /** Rendered width of the text content, px. */
    contentWidth: number;
    /** Inner width of the container clipping the text, px. */
    containerWidth: number;
    /** Whether the user prefers reduced motion. */
    reducedMotion: boolean;
    /** Minimum container width worth animating in. Defaults to 200px. */
    minWidth?: number;
}
/**
 * Decide whether a marquee should scroll: only when the text actually overflows
 * its container, motion is allowed, and the container is wide enough to be worth
 * it. A 1px slack avoids sub-pixel false positives.
 */
export declare function shouldEnableMarquee({ contentWidth, containerWidth, reducedMotion, minWidth, }: ShouldEnableMarqueeArgs): boolean;
//# sourceMappingURL=formatMetadata.d.ts.map