/**
 * Canvas-based dominant-color extraction for album art.
 *
 * Pure, zero-dependency. The async `extractPalette` needs a DOM (it draws to a
 * `<canvas>`); the math helpers below are DOM-free and unit-tested. When the
 * image fails to load or the canvas is tainted by cross-origin pixels, the
 * extractor resolves to `null` so callers can leave manual colors untouched.
 */
/** An RGB triple, 0–255 per channel. */
export type Rgb = [number, number, number];
/** Palette derived from a piece of artwork. */
export interface ArtworkPalette {
    /** Most frequent vivid color in the image. */
    primary: Rgb;
    /** A distinct, less-frequent vivid color, for gradients/secondary accents. */
    secondary: Rgb;
    /** Best on-surface accent (primary, nudged for visibility). */
    accent: Rgb;
    /** True when the primary color is dark (drives adaptive contrast choices). */
    isDark: boolean;
}
export interface ExtractPaletteOptions {
    /** Square edge the image is downscaled to before sampling. Default 48. */
    sampleSize?: number;
    /** Quantization step per channel (larger = coarser buckets). Default 24. */
    quantStep?: number;
}
/** Convert an RGB triple to a CSS `rgb(...)` string. */
export declare function rgbToCss([r, g, b]: Rgb): string;
/**
 * Relative luminance per WCAG 2.x (0 = black, 1 = white). Used to decide
 * adaptive text color and whether a swatch reads as "dark".
 */
export declare function relativeLuminance([r, g, b]: Rgb): number;
/** Pick black or white text for best contrast against a background color. */
export declare function contrastText(bg: Rgb): string;
/** Build a 135° linear gradient between two colors. */
export declare function gradient(a: Rgb, b: Rgb): string;
/**
 * Extract a palette from an image URL.
 *
 * Resolves `null` (never rejects) when the image cannot be loaded or its pixels
 * cannot be read (e.g. a cross-origin host without permissive CORS headers).
 */
export declare function extractPalette(src: string, options?: ExtractPaletteOptions): Promise<ArtworkPalette | null>;
/**
 * Bucket pixels into coarse color bins and pick the two most prominent vivid
 * colors. Exported for unit testing against a hand-built pixel array.
 */
export declare function quantizePixels(data: Uint8ClampedArray | number[], quantStep?: number): ArtworkPalette | null;
//# sourceMappingURL=colorExtraction.d.ts.map