import { useCallback, useEffect, useRef, useState } from "react"
import type { ReaderMixer } from "../narrative/ReaderMixer"
import type { UseNarrativeAudioOptions } from "../narrative/useNarrativeAudio"
import { useAudioSessionCueTarget, useOptionalAudioSession } from "../session/AudioSessionContext"
import type { CueAction } from "./cueTypes"

export interface NarrativeCueControllerState {
    sceneMood?: string
    ambientProfile?: string
    fxClip?: string
    fxLoop?: boolean
    duckAmount?: number
    intensity?: number
    chapterId?: string
    /** Crossfade length requested by the latest `ambience.crossfade`; unset means the default. */
    crossfadeMs?: number
    /** Narration level driven by `volume.fadeNarration`; unset until a cue sets it. */
    narrationVolume?: number
}

export interface UseNarrativeCueControllerOptions {
    /**
     * Where cue events travel. Defaults to the surrounding `AudioSessionProvider`'s private
     * cue channel, or `window` outside a provider.
     */
    eventTarget?: EventTarget
    /**
     * The same reader mixer you pass to `useNarrativeAudio`. With it, narration lives on the
     * mixer's Voice level, so `volume.fadeNarration` starts from that level instead of the
     * session volume (which would jump the first step).
     */
    mixer?: ReaderMixer | null
}

const FADE_STEP_MS = 50

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/**
 * A host-facing React hook that acts as the bridge between generic Cue Manifest
 * events and the SAP narrative audio engine.
 *
 * Applies (and claims, so the runtime reports them as executed): `ambience.crossfade`
 * (profile + duration), `duck.set`, `volume.fadeNarration` (a timed ramp of
 * `narrationVolume`), and `layer.set` (`intensity`, `mood`/`scene`, plus every layer in
 * `layers`). `spatial.pan` is not supported here and is left unclaimed. Spread
 * `narrativeOptions` into `useNarrativeAudio` / `NarrativeFace` for the audio to follow.
 * A narration fade needs a starting level: it reads the `mixer` option's Voice level or the
 * surrounding session's volume. With neither (and no earlier fade) the level is unknown, so
 * the first `volume.fadeNarration` applies its target immediately rather than guessing.
 * See `CUE_ACTION_SUPPORT`.
 */
export function useNarrativeCueController(options: UseNarrativeCueControllerOptions = {}) {
    const { eventTarget, mixer } = options
    const mixerRef = useRef(mixer)
    mixerRef.current = mixer
    const sessionTarget = useAudioSessionCueTarget()
    const session = useOptionalAudioSession()
    const sessionVolumeRef = useRef(session?.volume)
    sessionVolumeRef.current = session?.volume

    const [state, setState] = useState<NarrativeCueControllerState>({
        sceneMood: undefined,
        ambientProfile: undefined,
        fxClip: undefined,
        fxLoop: false,
        duckAmount: 0.6,
        intensity: 1,
        chapterId: undefined,
    })
    const [layers, setLayers] = useState<Record<string, string | number>>({})
    const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const narrationVolumeRef = useRef<number | undefined>(undefined)

    const resolveTarget = useCallback(
        (): EventTarget | null =>
            eventTarget ?? sessionTarget ?? (typeof window !== "undefined" ? window : null),
        [eventTarget, sessionTarget]
    )

    useEffect(() => {
        const stopFade = () => {
            if (fadeTimerRef.current !== null) clearInterval(fadeTimerRef.current)
            fadeTimerRef.current = null
        }
        const setNarrationVolume = (value: number) => {
            narrationVolumeRef.current = value
            setState((s) => ({ ...s, narrationVolume: value }))
        }
        const fadeNarration = (target: number, durationMs: number) => {
            const ramping = fadeTimerRef.current !== null
            stopFade()
            const to = clamp01(target)
            // Mid-ramp, continue from our own last value; otherwise start from the level the
            // listener currently hears (mixer Voice, else session volume).
            const live =
                mixerRef.current?.getState().preferences.layers.voice.level ??
                sessionVolumeRef.current
            const from =
                (ramping ? narrationVolumeRef.current : live) ?? narrationVolumeRef.current ?? to
            if (!(durationMs > 0) || from === to) {
                setNarrationVolume(to)
                return
            }
            const startedAt = Date.now()
            fadeTimerRef.current = setInterval(() => {
                const progress = Math.min(1, (Date.now() - startedAt) / durationMs)
                setNarrationVolume(from + (to - from) * progress)
                if (progress >= 1) stopFade()
            }, FADE_STEP_MS)
        }

        const target = resolveTarget()
        if (!target) return stopFade

        const handler = (e: Event) => {
            const action = (e as CustomEvent<CueAction>).detail
            if (!action || !action.command) return

            switch (action.command) {
                case "ambience.crossfade":
                    setState((s) => ({
                        ...s,
                        ambientProfile: action.profile,
                        crossfadeMs: action.durationMs,
                    }))
                    break
                case "duck.set":
                    setState((s) => ({ ...s, duckAmount: clamp01(action.amount) }))
                    break
                case "volume.fadeNarration":
                    fadeNarration(action.volume, action.durationMs)
                    break
                case "layer.set":
                    setLayers((l) => ({ ...l, [action.layer]: action.state }))
                    if (action.layer === "intensity" && typeof action.state === "number") {
                        const intensity = clamp01(action.state)
                        setState((s) => ({ ...s, intensity }))
                    } else if (["mood", "scene", "sceneMood"].includes(action.layer)) {
                        setState((s) => ({ ...s, sceneMood: String(action.state) }))
                    }
                    break
                default:
                    return // not handled here (e.g. spatial.pan): leave it unclaimed
            }
            e.preventDefault() // claim: the runtime reports this action as executed
        }

        target.addEventListener("sap-narrative-cue", handler)
        return () => {
            target.removeEventListener("sap-narrative-cue", handler)
            stopFade()
        }
    }, [resolveTarget])

    const dispatchCueEvent = useCallback(
        (trigger: { kind?: string; value?: string | number; id?: string }) => {
            resolveTarget()?.dispatchEvent(
                new CustomEvent("sap-dispatch-cue", {
                    detail: trigger,
                    bubbles: true,
                })
            )
        },
        [resolveTarget]
    )

    const enterScene = useCallback(
        (sceneId: string) => {
            dispatchCueEvent({ kind: "scene", value: sceneId })
        },
        [dispatchCueEvent]
    )

    const enterParagraph = useCallback(
        (paragraphId: string) => {
            dispatchCueEvent({ kind: "paragraph", value: paragraphId })
        },
        [dispatchCueEvent]
    )

    const enterChapter = useCallback(
        (chapterId: string) => {
            dispatchCueEvent({ kind: "chapter", value: chapterId })
        },
        [dispatchCueEvent]
    )

    const applyMetadataSignature = useCallback(
        (signature: string) => {
            dispatchCueEvent({ kind: "signature", value: signature })
        },
        [dispatchCueEvent]
    )

    return {
        /** Options to spread into `useNarrativeAudio`. */
        narrativeOptions: state as UseNarrativeAudioOptions,
        /** Latest value of every layer set by `layer.set`, for host UI to render. */
        layers,
        dispatchCueEvent,
        enterScene,
        enterParagraph,
        enterChapter,
        applyMetadataSignature,
    }
}
