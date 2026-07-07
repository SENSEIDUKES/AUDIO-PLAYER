interface ProgressBarProps {
    currentTime: number;
    duration: number;
    buffered: number;
    disabled: boolean;
    isSeeking: boolean;
    onSeek: (time: number) => void;
    onSeekStart: () => void;
    onSeekEnd: () => void;
}
/**
 * Fully custom, div-based scrubber. A single Pointer Events pipeline handles
 * mouse, touch, and pen identically (no separate touch path), which removes the
 * dual-system jank of a native <input type="range">. Keyboard accessibility is
 * re-implemented here since we no longer get it from the native control.
 *
 * During a drag, the thumb/fill update locally at full frame rate without
 * touching the <audio> element. The final seek is applied once on pointer up,
 * preventing repeated seeks at 60-120Hz from causing audio stutter or decode lag.
 *
 * Unmount safety: pointer capture is tracked in a ref and released in a
 * `useEffect` cleanup so a drag that ends in an unmount cannot leak a captured
 * pointer back to the document.
 */
export declare function ProgressBar({ currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, }: ProgressBarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ProgressBar.d.ts.map