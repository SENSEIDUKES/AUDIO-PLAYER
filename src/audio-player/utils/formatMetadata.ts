import type { Track } from "../types"

/**
 * Pure metadata-formatting helpers shared by every face and the reusable
 * TrackMetadata component. No React, no DOM, no engine imports — just string
 * composition with graceful fallbacks, so the presentation logic stays testable
 * and identical everywhere a track's title/artist/album is shown.
 */

/** The subset of a Track these helpers read. Accepting a partial keeps them
 *  usable with loose/streamed metadata, not just full Track objects. */
export type TrackMetadataFields = Partial<
    Pick<
        Track,
        | "title"
        | "artist"
        | "albumTitle"
        | "releaseTitle"
        | "featuredArtists"
        | "versionLabel"
        | "explicit"
        | "subtitle"
    >
>

/** Title for display, falling back to a labeled placeholder when empty. */
export function getDisplayTitle(
    track: TrackMetadataFields | null | undefined,
    fallback = "Unknown Track"
): string {
    return track?.title?.trim() || fallback
}

/** Artist for display, falling back to a labeled placeholder when empty. */
export function getDisplayArtist(
    track: TrackMetadataFields | null | undefined,
    fallback = "Unknown Artist"
): string {
    return track?.artist?.trim() || fallback
}

/** Append a version qualifier in parentheses, e.g. `Title (Radio Edit)`. */
export function formatVersionedTitle(title: string, versionLabel?: string): string {
    const version = versionLabel?.trim()
    return version ? `${title} (${version})` : title
}

/**
 * Compose the "feat. …" suffix from a list of featured artists, dropping blanks.
 * One name → `feat. A`; many → `feat. A, B & C`. Empty list → `""`.
 */
export function formatFeatured(featuredArtists?: readonly string[]): string {
    const names = (featuredArtists ?? [])
        .map((n) => n?.trim())
        .filter((n): n is string => Boolean(n))
    if (names.length === 0) return ""
    if (names.length === 1) return `feat. ${names[0]}`
    const last = names[names.length - 1]
    return `feat. ${names.slice(0, -1).join(", ")} & ${last}`
}

/**
 * The secondary line: `Artist [feat. …] [· Album]`. Album wins the trailing
 * slot; when there's neither album nor featured artists, an optional `subtitle`
 * fills it instead.
 */
export function formatSecondaryLine(
    track: TrackMetadataFields | null | undefined,
    artistFallback = "Unknown Artist"
): string {
    const artist = getDisplayArtist(track, artistFallback)
    const featured = formatFeatured(track?.featuredArtists)
    const lead = featured ? `${artist} ${featured}` : artist
    const album = track?.albumTitle?.trim()
    const subtitle = !featured ? track?.subtitle?.trim() : ""
    const trailing = album || subtitle || ""
    return trailing ? `${lead} · ${trailing}` : lead
}

export interface ShouldEnableMarqueeArgs {
    /** Rendered width of the text content, px. */
    contentWidth: number
    /** Inner width of the container clipping the text, px. */
    containerWidth: number
    /** Whether the user prefers reduced motion. */
    reducedMotion: boolean
    /** Minimum container width worth animating in. Defaults to 200px. */
    minWidth?: number
}

/**
 * Decide whether a marquee should scroll: only when the text actually overflows
 * its container, motion is allowed, and the container is wide enough to be worth
 * it. A 1px slack avoids sub-pixel false positives.
 */
export function shouldEnableMarquee({
    contentWidth,
    containerWidth,
    reducedMotion,
    minWidth = 200,
}: ShouldEnableMarqueeArgs): boolean {
    if (reducedMotion) return false
    if (containerWidth < minWidth) return false
    return contentWidth - containerWidth > 1
}
