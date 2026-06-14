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
export function isIOS(): boolean {
    if (typeof navigator === "undefined") return false
    const ua = navigator.userAgent || ""
    if (/iPad|iPhone|iPod/.test(ua)) return true
    // iPadOS 13+ reports as Mac; disambiguate with touch capability.
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
}

/**
 * Best-effort "is this a phone/tablet touch browser" check. Combines a
 * user-agent signal with a feature-detection fallback (coarse pointer + touch
 * capability) so it still resolves correctly on UAs the regex doesn't list.
 */
export function isMobileDevice(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false
    }
    if (isIOS()) return true

    const ua = navigator.userAgent || ""
    if (/Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
        return true
    }

    // Feature-detection fallback: a touch-capable device whose primary pointer
    // is coarse (finger) — i.e. not a desktop with an attached touchscreen.
    const hasTouch =
        "ontouchstart" in window || navigator.maxTouchPoints > 0
    const coarsePointer =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches
    return hasTouch && coarsePointer
}

/**
 * The default visibility for volume *sliders* in skins. Desktop keeps the
 * slider; mobile hides it (mute remains the reliable control). Skins still
 * accept an explicit `showVolume` prop, which always wins over this default.
 */
export function defaultShowVolume(): boolean {
    return !isMobileDevice()
}
