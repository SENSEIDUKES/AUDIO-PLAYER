import { ReactNode } from 'react';
export interface TextMarqueeProps {
    children: ReactNode;
    /** Merged onto the clipping container. */
    className?: string;
    /** Tooltip / full-text affordance for the clipped content. */
    title?: string;
    /** Force the marquee off (e.g. compact faces) — renders static truncation. */
    disabled?: boolean;
    /** Container must be at least this wide to animate. Defaults to 200px. */
    minWidth?: number;
    /** Seconds of travel per 100px of overflow; tunes the scroll speed. */
    secondsPer100px?: number;
}
/**
 * Scrolls long text horizontally, but only when it genuinely overflows its
 * container. Overflow is measured with a ResizeObserver (RAF-debounced, never in
 * a render loop), and the scroll is a single GPU-composited transform driven by
 * CSS. When the text fits, or the user prefers reduced motion, it falls back to
 * static ellipsis truncation. The full text stays in one DOM node, so screen
 * readers read it once. Pauses on hover/focus (handled in CSS).
 */
export declare function TextMarquee({ children, className, title, disabled, minWidth, secondsPer100px, }: TextMarqueeProps): import("react").JSX.Element;
export default TextMarquee;
//# sourceMappingURL=TextMarquee.d.ts.map