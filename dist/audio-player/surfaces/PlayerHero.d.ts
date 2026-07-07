import { CSSProperties, ReactNode } from 'react';
import { PlayerFace } from './faceCapabilities';
export interface PlayerHeroProps {
    face: PlayerFace;
    /** When true, render as a compact identity header (= surface.isHeroCollapsed). */
    collapsed: boolean;
    title: string;
    artist: string;
    /** Optional art node shown in the compact header. */
    art?: ReactNode;
    className?: string;
    /** Album / release name appended to the secondary line. */
    album?: string;
    /** Featured artists, rendered as "feat. …" after the artist. */
    featuredArtists?: string[];
    /** Version qualifier, e.g. "Radio Edit" — appended to the title. */
    versionLabel?: string;
    /** Explicit-content flag; renders an "E" badge next to the title. */
    explicit?: boolean;
    /** Release title shown as a tertiary line in the expanded hero. */
    releaseTitle?: string;
    /** Secondary-line fallback when there's no album/featured artist. */
    subtitle?: string;
    /** Animate the title when it overflows (ignored while collapsed). */
    marquee?: boolean;
    /** Optional inline typography for the title line. */
    titleFont?: CSSProperties;
    /** Optional inline typography for the artist (secondary) line. */
    artistFont?: CSSProperties;
}
/**
 * The hero identity block. It renders the full hero by default and a compact
 * identity header when `collapsed` — the SAME DOM node with a `data-collapsed`
 * flag, so the transition animates and nothing navigates away (no route/modal/
 * tab). Faces that don't support hero collapse always receive `collapsed={false}`.
 *
 * The title shows an optional version qualifier and explicit badge and can
 * marquee when it overflows; the artist line composes featured artists + album.
 */
export declare function PlayerHero({ face, collapsed, title, artist, art, className, album, featuredArtists, versionLabel, explicit, releaseTitle, subtitle, marquee, titleFont, artistFont, }: PlayerHeroProps): import("react").JSX.Element;
export default PlayerHero;
//# sourceMappingURL=PlayerHero.d.ts.map