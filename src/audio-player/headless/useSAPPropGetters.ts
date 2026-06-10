import { useMemo } from "react"
import type {
    AudioHTMLAttributes,
    HTMLAttributes,
    KeyboardEvent,
    Ref,
} from "react"
import type { AudioPlayerEngine, SessionEngine } from "../types"
import { composeEventHandlers } from "./composeEventHandlers"
import { mergeRefs } from "./mergeRefs"
import { formatTime } from "../utils/formatTime"

/** Caller props accepted by the button-like prop getters. */
export interface SAPButtonProps extends HTMLAttributes<HTMLElement> {
    ref?: Ref<any>
    disabled?: boolean
}

/** Caller props accepted by `getProgressBarProps`. */
export interface SAPProgressBarProps extends HTMLAttributes<HTMLElement> {
    ref?: Ref<any>
}

/** Caller props accepted by `getAudioElementProps`. */
export interface SAPAudioElementProps
    extends AudioHTMLAttributes<HTMLAudioElement> {
    ref?: Ref<HTMLAudioElement>
}

export interface UseSAPPropGettersOptions {
    /**
     * Seconds moved by the seek forward/backward getters and by the progress
     * bar arrow keys. Default 10.
     */
    seekStep?: number
}

/** True when the engine is a `SessionEngine` (has queue navigation). */
export function isSessionEngine(
    engine: AudioPlayerEngine | SessionEngine
): engine is SessionEngine {
    const candidate = engine as SessionEngine
    return (
        typeof candidate.next === "function" &&
        typeof candidate.previous === "function"
    )
}

/**
 * Downshift-style prop getters over an EXISTING SAP engine. This is an
 * adapter, not an engine creator: pass it the engine you already have —
 * `useAudioPlayer(...)` for a standalone player, or `useAudioSession()` so a
 * custom skin shares the one global `<audio>` source with every other skin.
 *
 * Each getter returns spreadable, unstyled props: correct accessibility
 * attributes, disabled handling, Enter/Space activation for non-`<button>`
 * hosts, and caller props preserved (caller event handlers run first; set
 * `event.sapPreventDefault = true` or call `event.preventDefault()` to skip
 * SAP's internal handler).
 *
 * Queue getters (`getNextButtonProps` / `getPreviousButtonProps`) are only
 * active on a `SessionEngine`; on a plain `AudioPlayerEngine` they render
 * disabled and no-op safely.
 */
export function useSAPPropGetters(
    engine: AudioPlayerEngine | SessionEngine,
    options: UseSAPPropGettersOptions = {}
) {
    const { seekStep = 10 } = options

    return useMemo(() => {
        const session = isSessionEngine(engine) ? engine : null
        const noAudio = !engine.hasAudio

        // Native buttons already fire click on Enter/Space; this only fills
        // the gap for button-like hosts (div, span, custom elements).
        const keyboardActivation =
            (run: () => void) => (event: KeyboardEvent<HTMLElement>) => {
                const tag = event.currentTarget.tagName
                if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return
                if (event.key !== "Enter" && event.key !== " ") return
                event.preventDefault()
                run()
            }

        const buttonProps = (
            sap: {
                label: string
                action: () => void
                disabled: boolean
                pressed?: boolean
            },
            user: SAPButtonProps = {}
        ) => {
            const { onClick, onKeyDown, disabled: userDisabled, ...rest } = user
            const isDisabled = userDisabled ?? sap.disabled
            const run = () => {
                if (!isDisabled) sap.action()
            }
            return {
                type: "button" as const,
                "aria-label": sap.label,
                "aria-pressed": sap.pressed,
                disabled: isDisabled || undefined,
                "aria-disabled": isDisabled || undefined,
                ...rest,
                onClick: composeEventHandlers(onClick, run),
                onKeyDown: composeEventHandlers(
                    onKeyDown,
                    keyboardActivation(run)
                ),
            }
        }

        const getPlayButtonProps = (user: SAPButtonProps = {}) =>
            buttonProps(
                {
                    label: engine.isPlaying ? "Pause" : "Play",
                    pressed: engine.isPlaying,
                    action: () => engine.toggle(),
                    disabled: noAudio,
                },
                user
            )

        const getMuteButtonProps = (user: SAPButtonProps = {}) =>
            buttonProps(
                {
                    label: engine.isMuted ? "Unmute" : "Mute",
                    pressed: engine.isMuted,
                    action: () => engine.toggleMute(),
                    disabled: false,
                },
                user
            )

        const getNextButtonProps = (user: SAPButtonProps = {}) =>
            buttonProps(
                {
                    label: "Next track",
                    action: () => session?.next(),
                    disabled: !session || !session.canNext,
                },
                user
            )

        const getPreviousButtonProps = (user: SAPButtonProps = {}) =>
            buttonProps(
                {
                    label: "Previous track",
                    action: () => session?.previous(),
                    disabled: !session || !session.canPrevious,
                },
                user
            )

        const getSeekForwardButtonProps = (user: SAPButtonProps = {}) =>
            buttonProps(
                {
                    label: `Seek forward ${seekStep} seconds`,
                    action: () => engine.seekBy(seekStep),
                    disabled: noAudio,
                },
                user
            )

        const getSeekBackwardButtonProps = (user: SAPButtonProps = {}) =>
            buttonProps(
                {
                    label: `Seek backward ${seekStep} seconds`,
                    action: () => engine.seekBy(-seekStep),
                    disabled: noAudio,
                },
                user
            )

        /**
         * Simple slider fallback for fully custom skins. For advanced
         * scrubbing (pointer capture, buffered ranges) keep using the
         * exported `ProgressBar` component.
         */
        const getProgressBarProps = (user: SAPProgressBarProps = {}) => {
            const { onKeyDown, ...rest } = user
            const duration = engine.duration || 0
            const now =
                duration > 0
                    ? Math.min(Math.max(engine.currentTime, 0), duration)
                    : 0
            const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
                if (noAudio) return
                switch (event.key) {
                    case "ArrowRight":
                    case "ArrowUp":
                        event.preventDefault()
                        engine.seekBy(seekStep)
                        break
                    case "ArrowLeft":
                    case "ArrowDown":
                        event.preventDefault()
                        engine.seekBy(-seekStep)
                        break
                    case "Home":
                        event.preventDefault()
                        engine.seek(0)
                        break
                    case "End":
                        if (duration > 0) {
                            event.preventDefault()
                            engine.seek(duration)
                        }
                        break
                }
            }
            return {
                role: "slider" as const,
                tabIndex: noAudio ? -1 : 0,
                "aria-label": "Seek slider",
                "aria-valuemin": 0,
                "aria-valuemax": Math.max(0, Math.floor(duration)),
                "aria-valuenow": Math.floor(now),
                "aria-valuetext": `${formatTime(now)} of ${formatTime(duration)}`,
                "aria-disabled": noAudio || undefined,
                ...rest,
                onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown),
            }
        }

        /**
         * Props for a host-rendered hidden `<audio>` element. The engine's
         * internal ref stays attached (merged with the caller's), keeping the
         * engine the single source of truth — no direct backend mutation is
         * exposed. Not needed under `AudioSessionProvider`, which already
         * renders the one shared element.
         */
        const getAudioElementProps = (user: SAPAudioElementProps = {}) => {
            const { ref, ...rest } = user
            return {
                ...rest,
                ref: mergeRefs(engine.audioRef, ref),
            }
        }

        return {
            getPlayButtonProps,
            getMuteButtonProps,
            getNextButtonProps,
            getPreviousButtonProps,
            getSeekForwardButtonProps,
            getSeekBackwardButtonProps,
            getProgressBarProps,
            getAudioElementProps,
        }
    }, [engine, seekStep])
}

export type SAPPropGetters = ReturnType<typeof useSAPPropGetters>
