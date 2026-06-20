import { useCallback, useEffect, useState } from "react"
import type { UseNarrativeAudioOptions } from "../narrative/useNarrativeAudio"
import type { CueAction } from "./cueTypes"

export interface NarrativeCueControllerState {
    sceneMood?: string
    ambientProfile?: string
    fxClip?: string
    fxLoop?: boolean
    duckAmount?: number
    intensity?: number
    chapterId?: string
}

export interface UseNarrativeCueControllerOptions {
    /** Target element to listen for narrative events. Defaults to window. */
    eventTarget?: HTMLElement | Window
}

/**
 * A host-facing React hook that acts as the bridge between generic Cue Manifest
 * events and the SAP narrative audio engine.
 */
export function useNarrativeCueController(options: UseNarrativeCueControllerOptions = {}) {
    const { eventTarget } = options

    const [state, setState] = useState<NarrativeCueControllerState>({
        sceneMood: undefined,
        ambientProfile: undefined,
        fxClip: undefined,
        fxLoop: false,
        duckAmount: 0.6,
        intensity: 1,
        chapterId: undefined,
    })

    useEffect(() => {
        const target = eventTarget || (typeof window !== "undefined" ? window : null)
        if (!target) return

        const handler = (e: CustomEvent<CueAction>) => {
            const action = e.detail
            if (!action || !action.command) return

            setState((s) => {
                const next = { ...s }
                switch (action.command) {
                    case "ambience.crossfade":
                        next.ambientProfile = action.profile
                        break
                    case "duck.set":
                        next.duckAmount = action.amount
                        break
                    // In V1, 'layer.set' could be used for generic properties, or 'volume.fadeNarration' for intensity
                }
                return next
            })
        }

        target.addEventListener("sap-narrative-cue", handler as EventListener)
        return () => target.removeEventListener("sap-narrative-cue", handler as EventListener)
    }, [eventTarget])

    const dispatchCueEvent = useCallback(
        (trigger: { kind?: string; value?: string | number; id?: string }) => {
            const target = eventTarget || (typeof window !== "undefined" ? window : null)
            if (!target) return
            target.dispatchEvent(
                new CustomEvent("sap-dispatch-cue", {
                    detail: trigger,
                    bubbles: true,
                })
            )
        },
        [eventTarget]
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
        dispatchCueEvent,
        enterScene,
        enterParagraph,
        enterChapter,
        applyMetadataSignature,
    }
}
