import type { ReactNode } from "react"
import type { RepeatMode } from "../../types"
import {
    AutomixIcon,
    AutoPlayIcon,
    RepeatIcon,
    RepeatOneIcon,
    ShuffleIcon,
} from "../../skins/icons"

/* The Playback › Controls workspace: the dedicated "…" menu section the arc's
   Controls quick action opens. It surfaces the same playback switches as the
   options sheet (shuffle, repeat, automix, autoplay) as a focused panel. The
   state shape mirrors SAPController's `playback` prop — the controller passes
   it straight through — but is declared here so the workspace stays free of a
   runtime dependency on the controller. */

export interface PlaybackControlsState {
    shuffle: boolean
    onToggleShuffle: () => void
    repeatMode: RepeatMode
    onCycleRepeat: () => void
    /** Omit to hide the Automix row (e.g. single-track players). */
    automix?: boolean
    onToggleAutomix?: () => void
    /** Omit to hide the Auto Play row (sessions have no autoplay toggle). */
    autoPlay?: boolean
    onToggleAutoPlay?: () => void
}

function SwitchRow({
    icon,
    label,
    on,
    onToggle,
}: {
    icon: ReactNode
    label: string
    on: boolean
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            className="sap-ctl__row ap-tap"
            role="switch"
            aria-checked={on}
            onClick={onToggle}
        >
            <span className="sap-ctl__label">
                {icon}
                {label}
            </span>
            <span
                className={`sap-ctl__switch${on ? " sap-ctl__switch--on" : ""}`}
                aria-hidden="true"
            >
                <span className="sap-ctl__knob" />
            </span>
        </button>
    )
}

export function PlaybackControlsWorkspace({
    playback,
}: {
    playback?: PlaybackControlsState
}) {
    // A host that routes here without wiring playback state gets an honest
    // empty panel rather than dead switches.
    if (!playback) {
        return (
            <div className="sap-ctl__workspace-empty">
                <p className="sap-ctl__workspace-lead">Controls</p>
                <p className="sap-ctl__workspace-sub">
                    Playback controls are not available on this player.
                </p>
            </div>
        )
    }
    return (
        <section className="sap-ctl__section" aria-label="Playback controls">
            <SwitchRow
                icon={<ShuffleIcon />}
                label="Shuffle"
                on={playback.shuffle}
                onToggle={playback.onToggleShuffle}
            />
            <button
                type="button"
                className="sap-ctl__row ap-tap"
                onClick={playback.onCycleRepeat}
                aria-label={`Repeat: ${playback.repeatMode}. Activate to change.`}
            >
                <span className="sap-ctl__label">
                    {playback.repeatMode === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
                    Repeat
                </span>
                <span className="sap-ctl__value">{playback.repeatMode}</span>
            </button>
            {playback.onToggleAutomix && (
                <SwitchRow
                    icon={<AutomixIcon />}
                    label="Automix"
                    on={playback.automix ?? false}
                    onToggle={playback.onToggleAutomix}
                />
            )}
            {playback.onToggleAutoPlay && (
                <SwitchRow
                    icon={<AutoPlayIcon />}
                    label="Auto Play"
                    on={playback.autoPlay ?? false}
                    onToggle={playback.onToggleAutoPlay}
                />
            )}
        </section>
    )
}

export default PlaybackControlsWorkspace
