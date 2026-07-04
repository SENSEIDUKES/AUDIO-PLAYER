/**
 * Lightweight client device detection, used to decide UI defaults that depend
 * on platform capability rather than viewport size.
 *
 * Why this exists: iOS Safari (and several other mobile browsers) ignore
 * programmatic `volume` changes on HTML5 audio — only the `muted` attribute is
 * honored. Rendering a volume slider there implies a control that does nothing,
 * so skins hide the slider by default on mobile and surface the mute button
 * instead. The `useAudioPlayer` engine still detects the unsupported case at
 * runtime (`volumeUnsupported`); this is the *default-visibility* heuristic so
 * the slider never appears in the first place on touch devices.
 *
 * All checks are SSR-safe: with no `window`/`navigator` they report "not
 * mobile", which keeps the desktop default (volume shown) on the server.
 */
/**
 * iOS / iPadOS detection. Covers classic iPhone/iPod/iPad user agents plus
 * iPadOS 13+, which masquerades as desktop Safari ("MacIntel") but exposes a
 * touch screen via `maxTouchPoints`.
 */
export declare function isIOS(): boolean;
/**
 * Best-effort "is this a phone/tablet touch browser" check. Combines a
 * user-agent signal with a feature-detection fallback (coarse pointer + touch
 * capability) so it still resolves correctly on UAs the regex doesn't list.
 */
export declare function isMobileDevice(): boolean;
/**
 * The default visibility for volume *sliders* in skins. Desktop keeps the
 * slider; mobile hides it (mute remains the reliable control). Skins still
 * accept an explicit `showVolume` prop, which always wins over this default.
 */
export declare function defaultShowVolume(): boolean;
//# sourceMappingURL=device.d.ts.map