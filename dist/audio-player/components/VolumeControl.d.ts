interface VolumeControlProps {
    volume: number;
    isMuted: boolean;
    disabled: boolean;
    /**
     * True when the host environment (e.g. iOS Safari) ignores programmatic
     * volume changes. The UI shows a small hint and the slider remains
     * interactive so it still reflects user intent; the mute toggle is the
     * guaranteed-effective control on those platforms.
     */
    volumeUnsupported?: boolean;
    onVolumeChange: (value: number) => void;
    onToggleMute: () => void;
}
/**
 * Mute toggle + a custom vertical-agnostic horizontal slider, built on the same
 * Pointer Events pattern as the scrubber for consistent behavior. Note: iOS
 * Safari ignores programmatic volume, so the mute button is the reliable control
 * there; the slider is effectively desktop-only. We surface a small hint to
 * users when we detect that the browser is not honoring the slider.
 */
export declare function VolumeControl({ volume, isMuted, disabled, volumeUnsupported, onVolumeChange, onToggleMute, }: VolumeControlProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=VolumeControl.d.ts.map