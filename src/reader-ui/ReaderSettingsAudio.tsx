import type { CSSProperties, ReactNode } from "react"
import { useOptionalReaderMixer } from "@seihouse/audio-player"
import type { ReaderAtmosphereOption, ReaderMixer } from "@seihouse/audio-player"
import { ReaderMixerPanel } from "./ReaderMixerPanel.js"
import type { ReaderMixerLabelOverrides } from "./ReaderMixerPanel.js"
import { ReaderAudioPresets } from "./ReaderAudioPresets.js"
import "./reader-ui.css"

export interface ReaderSettingsAudioProps {
    /** The mixer to control. Defaults to the one from `ReaderMixerProvider`. */
    mixer?: ReaderMixer | null
    /** Atmosphere choices for the panel's picker. Defaults to the mixer's catalog. */
    atmospheres?: readonly ReaderAtmosphereOption[]
    /** One line above the levels. Pass `null` to leave it out. */
    help?: ReactNode
    /** The mixer panel's wording; `presets` also names the preset pills. */
    labels?: ReaderMixerLabelOverrides
    /**
     * Show the panel's own atmosphere picker. Defaults to true; turn it off when
     * the host's scene chooser (passed as `children`) picks the atmosphere.
     */
    showAtmospherePicker?: boolean
    /** Show the preset pills under the levels. Defaults to true. */
    showPresets?: boolean
    /** Host-owned pieces below the presets, such as SEN's scene and soundtrack chooser. */
    children?: ReactNode
    className?: string
    /** Theme overrides, typically `--sap-reader-settings-*` custom properties. */
    style?: CSSProperties
}

/**
 * The Audio page of the reader's Settings, composed the way SEN's reader
 * ships it: Master and each layer first, then the presets as pills, then
 * whatever the host adds. The root carries the opt-in `.sap-reader-settings`
 * theme, whose colors default to the SEN reader's own and are all
 * `--sap-reader-settings-*` variables.
 */
export function ReaderSettingsAudio({
    mixer: mixerProp,
    atmospheres,
    help = "The story’s music, atmosphere and sound effects.",
    labels,
    showAtmospherePicker = true,
    showPresets = true,
    children,
    className,
    style,
}: ReaderSettingsAudioProps) {
    const context = useOptionalReaderMixer()
    const mixer = mixerProp ?? context ?? undefined
    if (!mixer) return null
    return (
        <section
            aria-label={labels?.title ?? "Audio"}
            className={["sap-reader-settings", "sap-reader-settings-audio", className]
                .filter(Boolean)
                .join(" ")}
            style={style}
        >
            {help !== null && <p className="sap-reader-settings__help">{help}</p>}
            <ReaderMixerPanel
                mixer={mixer}
                atmospheres={atmospheres}
                labels={labels}
                showTitle={false}
                showPresets={false}
                showAtmospherePicker={showAtmospherePicker}
            />
            {showPresets && <ReaderAudioPresets mixer={mixer} legend={labels?.presets} />}
            {children}
        </section>
    )
}
