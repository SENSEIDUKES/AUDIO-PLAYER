import type { RefObject } from "react"
import type { AudioBackend, AudioBackendInfo, AudioBackendKind } from "./AudioBackend"
import { HTML5AudioBackend, HTML5_CAPABILITIES } from "./HTML5AudioBackend"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "./WebAudioBackend"

export interface AudioBackendDeps {
    /** Ref to the host-rendered `<audio>` element (used by the html5 backend). */
    audioRef: RefObject<HTMLAudioElement | null>
}

/**
 * Returns why the Web Audio backend cannot run in this environment, or null
 * when it is supported.
 */
function webAudioUnsupportedReason(): string | null {
    if (typeof window === "undefined") {
        return "no window (non-browser environment)"
    }
    const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
        return "AudioContext is not available"
    }
    if (typeof fetch !== "function") {
        return "fetch is not available"
    }
    return null
}

/**
 * Instantiate the requested playback backend, falling back to HTML5 Audio
 * (with a console warning) when Web Audio is unavailable.
 */
export function createAudioBackend(
    requested: AudioBackendKind,
    deps: AudioBackendDeps
): AudioBackend {
    if (requested === "webaudio") {
        const reason = webAudioUnsupportedReason()
        if (!reason) {
            const info: AudioBackendInfo = {
                requested: "webaudio",
                active: "webaudio",
                didFallback: false,
                capabilities: WEBAUDIO_CAPABILITIES,
            }
            return new WebAudioBackend(info)
        }
        console.warn(
            `[AudioPlayer] Web Audio API not available (${reason}); ` +
                "falling back to HTML5 audio backend."
        )
        return new HTML5AudioBackend(deps.audioRef, {
            requested: "webaudio",
            active: "html5",
            didFallback: true,
            fallbackReason: reason,
            capabilities: HTML5_CAPABILITIES,
        })
    }

    return new HTML5AudioBackend(deps.audioRef, {
        requested: "html5",
        active: "html5",
        didFallback: false,
        capabilities: HTML5_CAPABILITIES,
    })
}
