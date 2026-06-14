import { useState, useEffect } from "react"

/**
 * Conservative mobile-browser detection for UI defaults that should differ from
 * desktop. This intentionally avoids relying on a single signal: older iOS Safari
 * versions report iPad as a Mac, while some Android tablets omit "Mobile" from
 * their user agent.
 */
export function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false

    const ua = navigator.userAgent ?? ""
    const platform = navigator.platform ?? ""
    const maxTouchPoints = navigator.maxTouchPoints ?? 0

    const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (platform === "MacIntel" && maxTouchPoints > 1)

    const isAndroid = /Android/i.test(ua)
    const isMobileUserAgent =
        /Mobi|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)

    return isIOS || isAndroid || isMobileUserAgent
}

/**
 * React hook for SSR-safe mobile device detection.
 * Returns false during initial render (server and client hydration) to avoid
 * hydration mismatches, then updates to the real value after mount.
 */
export function useIsMobileDevice(): boolean {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        setIsMobile(isMobileDevice())
    }, [])

    return isMobile
}
