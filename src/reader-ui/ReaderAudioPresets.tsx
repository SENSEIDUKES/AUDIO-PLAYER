import { useId } from "react"
import { useOptionalReaderMixer, useReaderMixerState } from "@seihouse/audio-player"
import type { ReaderMixer } from "@seihouse/audio-player"
import "./reader-ui.css"

export interface ReaderAudioPresetsProps {
    /** The mixer to control. Defaults to the one from `ReaderMixerProvider`. */
    mixer?: ReaderMixer | null
    /** Legend above the choices. Preset names come from each preset's `label`. */
    legend?: string
    className?: string
}

/**
 * The reader's preset choices as SEN places them: below Master and the layer
 * levels, so presets stay secondary to them: one options-table row, its name
 * on the left and a segmented row of 44px pills on the right.
 */
export function ReaderAudioPresets({
    mixer: mixerProp,
    legend = "Presets",
    className,
}: ReaderAudioPresetsProps) {
    const context = useOptionalReaderMixer()
    const mixer = mixerProp ?? context
    const state = useReaderMixerState(mixer)
    const id = useId()
    const name = `sap-reader-preset-${id}`
    const legendId = `${name}-legend`
    if (!mixer || !state?.presets.length) return null
    return (
        <div className={["sap-reader-settings__group", className].filter(Boolean).join(" ")}>
            {/* One options-table row: the name on the left, the pills on the right. A
                labelled group rather than a fieldset, whose legend can't sit in a row. */}
            <div
                role="group"
                aria-labelledby={legendId}
                className="sap-reader-settings__field sap-reader-settings__row"
                data-control="reader-audio-preset"
            >
                <span className="sap-reader-settings__label" id={legendId}>
                    {legend}
                </span>
                <div className="sap-reader-settings__options sap-reader-settings__options--segmented">
                    {state.presets.map((preset) => (
                        <label key={preset.id} className="sap-reader-settings__option">
                            <input
                                type="radio"
                                name={name}
                                value={preset.id}
                                checked={state.activePresetId === preset.id}
                                onChange={() => mixer.applyPreset(preset.id)}
                                className="sap-reader-settings__radio"
                            />
                            <span className="sap-reader-settings__choice">{preset.label}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    )
}
