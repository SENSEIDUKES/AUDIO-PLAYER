import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useAudioSession } from "../session/AudioSessionContext"
import { trackKey } from "../utils/trackKey"
import { useOptionalReaderMixer, useReaderMixerState } from "./ReaderMixerContext"
import type { ReaderMixer, ReaderMixerVoiceOutput } from "./ReaderMixer"
import { applyAudioSessionType, probeElementVolumeWrites } from "./layerGainGraph"

export interface ReaderMixerVoiceProps {
    /** Defaults to the surrounding ReaderMixerProvider. Connect once per narration session. */
    mixer?: ReaderMixer
    /** Safari audio session type while narration is audible. Defaults to playback. */
    audioSessionType?: string | null
}

/** Connect the shared audio session's recorded/generated TTS to the mixer's Voice slot. */
export function ReaderMixerVoice({
    mixer: mixerProp,
    audioSessionType = "playback",
}: ReaderMixerVoiceProps) {
    const contextMixer = useOptionalReaderMixer()
    const mixer = mixerProp ?? contextMixer
    const state = useReaderMixerState(mixer)
    const session = useAudioSession()
    const sessionRef = useRef(session)
    useLayoutEffect(() => {
        sessionRef.current = session
    }, [session])
    const binding = useMemo(() => {
        const listeners = new Set<() => void>()
        const elementVolumeWorks = probeElementVolumeWrites()
        const levels: {
            applied: number | null
            pending: { expected: number; previous: number } | null
        } = {
            applied: null,
            pending: null,
        }
        const output: ReaderMixerVoiceOutput = {
            getState: () => {
                const current = sessionRef.current
                const backend = current.getBackendInfo()
                return {
                    status: current.autoplayBlocked
                        ? "blocked"
                        : current.hasError
                          ? "failed"
                          : current.isBuffering
                            ? "loading"
                            : current.isPlaying
                              ? "playing"
                              : current.hasAudio
                                ? "paused"
                                : "idle",
                    current: current.currentTrack ? trackKey(current.currentTrack) : null,
                    failure: current.hasError ? current.errorMessage : null,
                    muted: current.isMuted,
                    routing: backend.active === "webaudio" ? "web-audio" : "element",
                    volumeControl:
                        backend.capabilities.reliableVolume ||
                        (elementVolumeWorks && !current.volumeUnsupported)
                            ? "level"
                            : "on-off",
                }
            },
            subscribe: (listener) => {
                listeners.add(listener)
                return () => {
                    listeners.delete(listener)
                }
            },
            setLevel: (level) => {
                if (levels.applied === level) return
                levels.applied = level
                const current = sessionRef.current
                levels.pending =
                    current.volume !== level ? { expected: level, previous: current.volume } : null
                if (levels.pending !== null) current.setVolume(level)
            },
            setEnabled: (enabled) => sessionRef.current.setOutputGain?.(enabled ? 1 : 0),
            pause: () => sessionRef.current.pause(),
            resume: () => sessionRef.current.play(),
        }
        return { output, listeners, levels }
    }, [])
    useEffect(() => {
        if (!mixer || !session.setOutputGain) return
        binding.levels.applied = null
        return mixer.connectVoice(binding.output)
    }, [mixer, binding, session.setOutputGain])
    useEffect(() => {
        if (!mixer || !session.setOutputGain) return
        const levels = binding.levels
        // Consume each write guard on its next observation. Ignore only its
        // old render or acknowledgement; a different value may be a newer
        // external write that superseded ours in the same React batch.
        const pending = levels.pending
        levels.pending = null
        if (
            pending &&
            (session.volume === pending.previous || session.volume === pending.expected)
        ) {
            return
        }
        if (session.volume !== levels.applied) mixer.setLayerLevel("voice", session.volume)
    }, [mixer, binding, session.volume, session.setOutputGain])
    useEffect(() => {
        for (const listener of binding.listeners) listener()
    }, [
        binding,
        session.isPlaying,
        session.isBuffering,
        session.hasError,
        session.errorMessage,
        session.hasAudio,
        session.autoplayBlocked,
        session.currentTrack,
        session.isMuted,
        session.volumeUnsupported,
    ])
    const routed = session.getBackendInfo().active === "webaudio"
    const audible =
        session.isPlaying && !session.isMuted && (state?.layers.voice.effectiveLevel ?? 0) > 0
    useEffect(() => {
        if (routed && audible) return applyAudioSessionType(audioSessionType)
    }, [routed, audible, audioSessionType])
    return null
}
