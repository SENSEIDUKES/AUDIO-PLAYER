import { useCallback, useEffect, useRef, useState } from "react"

/* Shared share action: native share sheet where available, clipboard copy with
   a 2s "copied" flag as the fallback. Extracted from AudioPlayer so the
   session skins and the SAP Controller reuse one implementation. */
export function useShareTrack(title: string, artist: string): {
    /** Trigger the share (native sheet or clipboard copy). */
    share: () => void
    /** True for 2s after a successful clipboard copy. */
    copied: boolean
    /** Whether the native share sheet will be used instead of the clipboard. */
    nativeShare: boolean
} {
    const [copied, setCopied] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const share = useCallback(() => {
        if (typeof window === "undefined") return
        const url = window.location.href
        const text = `${title} by ${artist}`
        if (navigator.share) {
            navigator.share({ title: text, url }).catch(() => {})
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                if (timeoutRef.current !== null) {
                    clearTimeout(timeoutRef.current)
                }
                setCopied(true)
                timeoutRef.current = setTimeout(() => setCopied(false), 2000)
            }).catch(() => {
                // Clipboard permission denied / document unfocused: no
                // feedback, but never an unhandled rejection.
            })
        }
    }, [title, artist])

    const nativeShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"

    return { share, copied, nativeShare }
}
