import { useAudioTime } from "../session/AudioSessionContext"
import { getVisualComponent } from "./visualRegistry"
import { useVisualSlots } from "./VisualSlotsContext"
import "./visualSlots.css"

export interface SEICanvasRendererProps {
    /** Current playback position (seconds) handed to the active visual. */
    currentTime?: number
    /** Total track duration (seconds) handed to the active visual. */
    duration?: number
    /** The active track's lyrics blob, for lyric-style visuals. */
    lyrics?: string | null
}

/**
 * Mounts the active `seiCanvas` visual component into the SEI Canvas region with
 * its live settings. Replaces the old placeholder/demo content. When no seiCanvas
 * component is active it renders a clean empty state — not "plugins mount here".
 *
 * Playback context is passed in via props (sourced from the session in
 * session-based skins, or the portable player's own engine) and forwarded to the
 * component, so visual components stay decoupled from the global audio session.
 */
export function SEICanvasRenderer({
    currentTime: fallbackCurrentTime = 0,
    duration: fallbackDuration = 0,
    lyrics,
}: SEICanvasRendererProps = {}) {
    const slots = useVisualSlots()
    const activeId = slots.getActive("seiCanvas")
    const def = getVisualComponent(activeId)

    if (!def) {
        return (
            <div className="sap-visual-empty">
                <span className="sap-visual-empty__title">SEI Canvas</span>
                <span className="sap-visual-empty__hint">No visual selected.</span>
            </div>
        )
    }

    return (
        <ActiveSEICanvas
            fallbackCurrentTime={fallbackCurrentTime}
            fallbackDuration={fallbackDuration}
            lyrics={lyrics}
            definition={def}
            settings={slots.getSettings(def.id)}
        />
    )
}

function ActiveSEICanvas({
    fallbackCurrentTime,
    fallbackDuration,
    lyrics,
    definition,
    settings,
}: {
    fallbackCurrentTime: number
    fallbackDuration: number
    lyrics?: string | null
    definition: NonNullable<ReturnType<typeof getVisualComponent>>
    settings: Record<string, unknown>
}) {
    const { currentTime, duration } = useAudioTime({
        currentTime: fallbackCurrentTime,
        duration: fallbackDuration,
        buffered: 0,
    })
    const { Component } = definition

    return (
        <Component
            settings={settings}
            playback={{ currentTime, duration, lyrics }}
        />
    )
}

export default SEICanvasRenderer
