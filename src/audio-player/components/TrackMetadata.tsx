import { memo, type ReactNode } from "react";
import { TextMarquee } from "./TextMarquee";
import {
  formatFeatured,
  formatVersionedTitle,
  getDisplayArtist,
  getDisplayTitle,
} from "../utils/formatMetadata";
import type { TrackMetadataFields } from "../utils/formatMetadata";
import "./track-metadata.css";

/** Small "E" badge marking explicit content. Decorative glyph, real label. */
export function ExplicitBadge({ className }: { className?: string }) {
  return (
    <span
      className={`ap-explicit-badge${className ? ` ${className}` : ""}`}
      aria-label="Explicit content"
      title="Explicit content"
    >
      E
    </span>
  );
}

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
export const TrackMetadata = memo(function TrackMetadata({
  track,
  variant = "compact",
  enableMarquee = false,
  showTertiary = false,
  titleFallback = "Unknown Track",
  artistFallback = "Unknown Artist",
  className,
}: TrackMetadataProps) {
  const title = formatVersionedTitle(
    getDisplayTitle(track, titleFallback),
    track?.versionLabel,
  );
  const artist = getDisplayArtist(track, artistFallback);
  const featured = formatFeatured(track?.featuredArtists);
  const album = track?.albumTitle?.trim();
  const subtitle = !featured ? track?.subtitle?.trim() : "";
  const trailing = album || subtitle || "";
  const release = track?.releaseTitle?.trim();

  // A plain-text mirror of each line for the title attribute (full-text on
  // hover) and so screen readers get the complete string in order.
  const secondaryText = [artist, featured, trailing].filter(Boolean).join(" ");

  const primary: ReactNode = (
    <>
      {title}
      {track?.explicit && <ExplicitBadge />}
    </>
  );

  return (
    <div
      className={`ap-meta ap-meta--${variant}${className ? ` ${className}` : ""}`}
      data-variant={variant}
    >
      <div className="ap-meta__primary" dir="auto">
        {enableMarquee ? (
          <TextMarquee className="ap-meta__title" title={title}>
            {primary}
          </TextMarquee>
        ) : (
          <span className="ap-meta__title" title={title}>
            {primary}
          </span>
        )}
      </div>
      <div className="ap-meta__secondary" title={secondaryText} dir="auto">
        <span className="ap-meta__artist">{artist}</span>
        {featured && (
          <span
            className="ap-meta__featured"
            aria-label={`featuring ${track?.featuredArtists?.join(", ") ?? ""}`}
          >
            {" "}
            {featured}
          </span>
        )}
        {trailing && (
          <span className="ap-meta__album">
            <span className="ap-meta__sep" aria-hidden="true">
              {" · "}
            </span>
            {trailing}
          </span>
        )}
      </div>
      {showTertiary && release && release !== album && (
        <div className="ap-meta__tertiary" title={release}>
          {release}
        </div>
      )}
    </div>
  );
});

export default TrackMetadata;
