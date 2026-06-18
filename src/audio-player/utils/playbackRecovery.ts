import type { AudioBackendErrorCode } from "../core/audio/AudioBackend"

/**
 * Keep automatic recovery intentionally conservative. Retrying decode,
 * unsupported-source, permission, CORS, or HTTP-classified failures can hide
 * real asset/configuration bugs and delay fallback selection.
 */
const TRANSIENT_RETRYABLE_ERRORS = new Set<AudioBackendErrorCode | string>([
    "network",
])

export function isRetryablePlaybackError(
    error: AudioBackendErrorCode | string | null | undefined
): boolean {
    if (!error) return false
    return TRANSIENT_RETRYABLE_ERRORS.has(error)
}
