import { TrackMetadataFields } from '../utils/formatMetadata';
/** Small "E" badge marking explicit content. Decorative glyph, real label. */
export declare function ExplicitBadge({ className }: {
    className?: string;
}): import("react").JSX.Element;
/** Visual density / context the metadata renders in. */
export type TrackMetadataVariant = "hero" | "compact" | "bar" | "row";
export interface TrackMetadataProps {
    track: TrackMetadataFields | null | undefined;
    /** Density preset; drives typography via CSS. Defaults to "compact". */
    variant?: TrackMetadataVariant;
    /** Animate the title when it overflows (spacious contexts only). */
    enableMarquee?: boolean;
    /** Show the release line under the secondary line (expanded contexts). */
    showTertiary?: boolean;
    titleFallback?: string;
    artistFallback?: string;
    className?: string;
}
/**
 * The shared title / artist / album hierarchy. A single, accessible building
 * block so every face presents metadata identically: primary line (title +
 * version + explicit badge), secondary line (artist + featured + album), and an
 * optional tertiary release line. Display-only — it reads a few optional Track
 * fields and nothing else.
 */
export declare function TrackMetadata({ track, variant, enableMarquee, showTertiary, titleFallback, artistFallback, className, }: TrackMetadataProps): import("react").JSX.Element;
export default TrackMetadata;
//# sourceMappingURL=TrackMetadata.d.ts.map