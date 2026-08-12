/**
 * Canvas-based dominant-color extraction for album art.
 *
 * Pure, zero-dependency. The async `extractPalette` needs a DOM (it draws to a
 * `<canvas>`); the math helpers below are DOM-free and unit-tested. When the
 * image fails to load or the canvas is tainted by cross-origin pixels, the
 * extractor resolves to `null` so callers can leave manual colors untouched.
 */

/** An RGB triple, 0–255 per channel. */
export type Rgb = [number, number, number]

/** Palette derived from a piece of artwork. */
export interface ArtworkPalette {
    /** Most frequent vivid color in the image. */
    primary: Rgb
    /** A distinct, less-frequent vivid color, for gradients/secondary accents. */
    secondary: Rgb
    /** Best on-surface accent (primary, nudged for visibility). */
    accent: Rgb
    /** True when the primary color is dark (drives adaptive contrast choices). */
    isDark: boolean
}

export interface ExtractPaletteOptions {
    /** Square edge the image is downscaled to before sampling. Default 48. */
    sampleSize?: number
    /** Quantization step per channel (larger = coarser buckets). Default 24. */
    quantStep?: number
}

/** Convert an RGB triple to a CSS `rgb(...)` string. */
export function rgbToCss([r, g, b]: Rgb): string {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

/**
 * Relative luminance per WCAG 2.x (0 = black, 1 = white). Used to decide
 * adaptive text color and whether a swatch reads as "dark".
 */
export function relativeLuminance([r, g, b]: Rgb): number {
    const channel = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Pick black or white text for best contrast against a background color. */
export function contrastText(bg: Rgb): string {
    return relativeLuminance(bg) > 0.4 ? "#000000" : "#FFFFFF"
}

/** Build a 135° linear gradient between two colors. */
export function gradient(a: Rgb, b: Rgb): string {
    return `linear-gradient(135deg, ${rgbToCss(a)} 0%, ${rgbToCss(b)} 100%)`
}

/**
 * Extract a palette from an image URL.
 *
 * Resolves `null` (never rejects) when the image cannot be loaded or its pixels
 * cannot be read (e.g. a cross-origin host without permissive CORS headers).
 */
export function extractPalette(
    src: string,
    options: ExtractPaletteOptions = {}
): Promise<ArtworkPalette | null> {
    const sampleSize = options.sampleSize ?? 48
    const quantStep = options.quantStep ?? 24

    return new Promise((resolve) => {
        if (!src || typeof document === "undefined") {
            resolve(null)
            return
        }

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.decoding = "async"

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas")
                canvas.width = sampleSize
                canvas.height = sampleSize
                const ctx = canvas.getContext("2d", { willReadFrequently: true })
                if (!ctx) {
                    resolve(null)
                    return
                }
                ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
                // Throws SecurityError if the canvas is tainted by CORS.
                const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize)
                resolve(quantizePixels(data, quantStep))
            } catch {
                resolve(null)
            }
        }
        img.onerror = () => resolve(null)
        img.src = src
    })
}

/**
 * Bucket pixels into coarse color bins and pick the two most prominent vivid
 * colors. Exported for unit testing against a hand-built pixel array.
 */
export function quantizePixels(
    data: Uint8ClampedArray | number[],
    quantStep = 24
): ArtworkPalette | null {
    const buckets = new Map<number, { count: number; sum: Rgb }>()

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        if (a < 125) continue // skip near-transparent

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        // Skip near-grayscale extremes (very dark, very light, low saturation),
        // which otherwise dominate and wash the accent out.
        const saturation = max === 0 ? 0 : (max - min) / max
        if (saturation < 0.12 && (max < 40 || max > 225)) continue

        const key =
            (Math.round(r / quantStep) << 16) |
            (Math.round(g / quantStep) << 8) |
            Math.round(b / quantStep)
        const bucket = buckets.get(key)
        if (bucket) {
            bucket.count++
            bucket.sum[0] += r
            bucket.sum[1] += g
            bucket.sum[2] += b
        } else {
            buckets.set(key, { count: 1, sum: [r, g, b] })
        }
    }

    if (buckets.size === 0) return null

    const ranked = [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .map((bucket) => avg(bucket.sum, bucket.count))

    const primary = ranked[0]
    const secondary = pickDistinct(primary, ranked) ?? primary
    return {
        primary,
        secondary,
        accent: primary,
        isDark: relativeLuminance(primary) < 0.4,
    }
}

function avg(sum: Rgb, count: number): Rgb {
    return [sum[0] / count, sum[1] / count, sum[2] / count]
}

/** First ranked color far enough from `base` in RGB space to read as distinct. */
function pickDistinct(base: Rgb, ranked: Rgb[]): Rgb | null {
    const threshold = 60
    for (const color of ranked) {
        const dist = Math.sqrt(
            (color[0] - base[0]) ** 2 + (color[1] - base[1]) ** 2 + (color[2] - base[2]) ** 2
        )
        if (dist > threshold) return color
    }
    return null
}
