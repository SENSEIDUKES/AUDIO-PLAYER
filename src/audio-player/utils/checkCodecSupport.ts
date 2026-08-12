/**
 * Check if the browser supports a given audio MIME type.
 * Returns false in SSR/non-browser environments.
 */
export function checkCodecSupport(mimeType: string): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return false
    }
    const a = document.createElement("audio")
    if (!a.canPlayType) return false
    const result = a.canPlayType(mimeType)
    return result === "probably" || result === "maybe"
}
