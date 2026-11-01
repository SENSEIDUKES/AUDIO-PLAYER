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
 * levels, so presets stay secondary to them, as two columns of 44px pills.
 */
export function ReaderAudioPresets({
    mixer: mixerProp,
    legend = "Presets",
    className,
}: ReaderAudioPresetsProps) {
    const context = useOptionalReaderMixer()
    const mixer = mixerProp ?? context
    const state = useReaderMixerState(mixer)
    const name = `sap-reader-preset-${useId()}`
    if (!mixer || !state?.presets.length) return null
    return (
        <div className={["sap-reader-settings__group", className].filter(Boolean).join(" ")}>
            <fieldset className="sap-reader-settings__field" data-control="reader-audio-preset">
                <legend className="sap-reader-settings__label">{legend}</legend>
                <div className="sap-reader-settings__options sap-reader-settings__options--two">
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
            </fieldset>
        </div>
    )
}
