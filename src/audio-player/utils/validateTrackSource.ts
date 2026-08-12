import { checkCodecSupport } from "./checkCodecSupport"

export interface SourceValidationResult {
    ok: boolean
    accessible: boolean // HTTP 200 or opaque response
    corsEnabled: boolean // Can read headers
    mimeType?: string
    codecSupported?: boolean
    error?: string
}

export interface ValidateTrackSourceOptions {
    timeoutMs?: number
    checkCodec?: boolean
}

/**
 * Validates an audio track URL by attempting a HEAD request.
 * Returns information about accessibility, CORS status, and optionally
 * checks codec support if the MIME type can be determined.
 */
export async function validateTrackSource(
    url: string,
    options: ValidateTrackSourceOptions = {}
): Promise<SourceValidationResult> {
    const { timeoutMs = 5000, checkCodec = true } = options

    let response: Response

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        // First try with CORS to extract headers like Content-Type
        response = await fetch(url, {
            method: "HEAD",
            mode: "cors",
            signal: controller.signal,
        })

        clearTimeout(timeoutId)
    } catch (error: any) {
        clearTimeout(timeoutId)

        if (error.name === "AbortError") {
            return {
                ok: false,
                accessible: false,
                corsEnabled: false,
                error: "Request timed out",
            }
        }

        // If the CORS request fails, try no-cors to check if it's reachable at all
        try {
            const fallbackController = new AbortController()
            const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), timeoutMs)

            response = await fetch(url, {
                method: "HEAD",
                mode: "no-cors",
                signal: fallbackController.signal,
            })

            clearTimeout(fallbackTimeoutId)

            // Opaque responses are type 'opaque' and status 0
            if (response.type === "opaque") {
                return {
                    ok: true,
                    accessible: true,
                    corsEnabled: false,
                }
            }
        } catch (fallbackError: any) {
            return {
                ok: false,
                accessible: false,
                corsEnabled: false,
                error: fallbackError.message || "Network error",
            }
        }
    }

    if (!response.ok && response.type !== "opaque") {
        return {
            ok: false,
            accessible: false,
            corsEnabled: true,
            error: `HTTP ${response.status} ${response.statusText}`,
        }
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || undefined
    let codecSupported: boolean | undefined = undefined

    if (mimeType && checkCodec) {
        codecSupported = checkCodecSupport(mimeType)
    }

    return {
        ok: codecSupported === false ? false : true,
        accessible: true,
        corsEnabled: true,
        mimeType,
        codecSupported,
    }
}
