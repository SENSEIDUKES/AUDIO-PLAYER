import { AudioPlayerEngine } from '../types';
export interface UseMediaSessionObserverOptions {
    /** Track title shown on the lock screen / OS media UI. */
    title: string;
    artist?: string;
    album?: string;
    /** Lock-screen artwork, e.g. `[{ src, sizes: "512x512", type: "image/jpeg" }]`. */
    artwork?: MediaImage[];
    /** Advance to the next track. Omit when the host has no queue. */
    onNext?: () => void;
    /** Go back to the previous track. Omit when the host has no queue. */
    onPrevious?: () => void;
    /**
     * Opaque key identifying the logical track. Metadata and action handlers
     * re-register when it changes. Defaults to `title`.
     */
    sourceKey?: string;
    /** Seconds moved by the OS seekforward/seekbackward actions. Default 10. */
    seekStep?: number;
}
/**
 * Build a Media Session artwork array with multiple sizes from a single URL.
 * The OS picks the best size for its display (e.g. iOS lock screen).
 */
export declare function buildMediaSessionArtwork(src: string): MediaImage[];
/** Pull a bare URL out of a CSS `url("…")` value, if it is one. */
export declare function extractUrlFromCss(css: string): string | null;
/**
 * Resolve an artwork candidate (a track/background source) to a bare image URL
 * usable as Media Session artwork, or `undefined` when it isn't a real image.
 *
 * Callers may pass a plain URL or a raw CSS value. A `url("…")` wrapper is
 * unwrapped; a gradient (or any other CSS function) is rejected so a non-image
 * background never yields a malformed `MediaImage` the OS can't render.
 */
export declare function resolveArtworkSrc(value: string | null | undefined): string | undefined;
/**
 * Media Session API integration (progressive enhancement) as a reusable hook,
 * so any skin — the built-in `AudioPlayer` or a custom headless one — gets
 * lock-screen metadata and OS media controls from the same engine.
 *
 * Does nothing (silently) when the browser has no `navigator.mediaSession`.
 *
 * IMPORTANT: metadata is *not* cleared on dependency changes — doing so
 * causes iOS to briefly lose artwork on track transitions. The new metadata
 * overwrites the previous entry directly.
 */
export declare function useMediaSessionObserver(engine: AudioPlayerEngine, options: UseMediaSessionObserverOptions): void;
//# sourceMappingURL=useMediaSessionObserver.d.ts.map