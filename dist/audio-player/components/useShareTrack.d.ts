export declare function useShareTrack(title: string, artist: string): {
    /** Trigger the share (native sheet or clipboard copy). */
    share: () => void;
    /** True for 2s after a successful clipboard copy. */
    copied: boolean;
    /** Whether the native share sheet will be used instead of the clipboard. */
    nativeShare: boolean;
};
//# sourceMappingURL=useShareTrack.d.ts.map