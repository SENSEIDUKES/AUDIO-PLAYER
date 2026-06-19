import type { CSSProperties } from "react"
import type { MediaSource } from "../properties/propertyTypes"
import type { BackgroundImage } from "../types"

/** Inputs `resolveMedia` accepts — the new model plus the two legacy props. */
export interface ResolveMediaInput {
    /** New unified media descriptor. Wins over the legacy props when present. */
    media?: MediaSource | null
    /** Legacy `backgroundImage={{ src }}` prop (background role). */
    legacyImage?: BackgroundImage | null
    /** Legacy `art` CSS string — a `url(...)` or gradient (art role). */
    legacyCss?: string | null
}

/**
 * A normalized media result. Exactly one of `media` (a video layer to mount) or
 * `cssBackground` (a `background-image` value) is set — or both null when there
 * is nothing to render. Images and gradients resolve to `cssBackground` so they
 * keep flowing through the existing `.ap-bg-image` / container-background path
 * (byte-identical legacy output); only video needs a dedicated element.
 */
export interface ResolvedMedia {
    media: MediaSource | null
    cssBackground: string | null
}

/** Map the new media prop and the legacy props onto a single normalized shape. */
export function resolveMedia(input: ResolveMediaInput): ResolvedMedia {
    const { media, legacyImage, legacyCss } = input
    if (media && media.src) {
        if (media.kind === "video") return { media, cssBackground: null }
        return { media: null, cssBackground: `url("${media.src}")` }
    }
    if (legacyImage?.src) {
        return { media: null, cssBackground: `url("${legacyImage.src}")` }
    }
    if (legacyCss && legacyCss.trim()) {
        return { media: null, cssBackground: legacyCss }
    }
    return { media: null, cssBackground: null }
}

/**
 * Force the `muted` DOM property on a `<video>`. React's `muted` prop is applied
 * as a property and is unreliable on first paint, which can block autoplay; a ref
 * that sets `el.muted = true` guarantees it before the browser evaluates autoplay.
 */
export function ensureMuted(el: HTMLVideoElement | null) {
    if (el) el.muted = true
}

export interface BackgroundMediaProps {
    /** A resolved video layer. Use `resolveMedia` to produce it. */
    media?: MediaSource | null
    /** A resolved `background-image` value (image url or gradient). */
    cssBackground?: string | null
    /** Darken overlay, 0–100. Rendered over the media when > 0. */
    darkenAmount?: number
    /** Extra class on the rendered media layer (e.g. a face-scoped position). */
    className?: string
}

/**
 * The shared background/artwork media renderer used across faces. Renders a
 * muted, looping `<video>` for video media (visual-only — the engine `<audio>`
 * stays the sole audio owner) or the existing `.ap-bg-image` div for an image /
 * gradient, plus the optional darken overlay. Blur is inherited from the
 * `--ap-blur` CSS variable the face root sets, so callers don't pass it here.
 * Returns `null` when there is nothing to render.
 */
export function BackgroundMedia({
    media,
    cssBackground,
    darkenAmount = 0,
    className,
}: BackgroundMediaProps) {
    const darken =
        darkenAmount > 0 ? (
            <div
                className="ap-bg-darken"
                style={{ backgroundColor: `rgba(0,0,0,${darkenAmount / 100})` }}
                aria-hidden="true"
            />
        ) : null

    if (media && media.kind === "video") {
        const style: CSSProperties | undefined =
            media.fit === "contain" ? { objectFit: "contain" } : undefined
        return (
            <>
                <video
                    className={`ap-bg-video${className ? ` ${className}` : ""}`}
                    src={media.src}
                    poster={media.poster}
                    ref={ensureMuted}
                    // Background video is visual-only: always muted so the audio
                    // engine remains the single source of sound. The `ensureMuted`
                    // ref forces the muted property before autoplay is evaluated.
                    muted
                    autoPlay={media.autoPlay ?? true}
                    loop={media.loop ?? true}
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    style={style}
                />
                {darken}
            </>
        )
    }

    if (cssBackground) {
        return (
            <>
                <div
                    className={`ap-bg-image${className ? ` ${className}` : ""}`}
                    style={{ backgroundImage: cssBackground }}
                    aria-hidden="true"
                />
                {darken}
            </>
        )
    }

    return null
}

export default BackgroundMedia
