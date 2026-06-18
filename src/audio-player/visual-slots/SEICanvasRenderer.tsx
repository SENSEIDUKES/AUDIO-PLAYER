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
    currentTime = 0,
    duration = 0,
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

    const { Component } = def
    return (
        <Component
            settings={slots.getSettings(def.id)}
            playback={{ currentTime, duration, lyrics }}
        />
    )
}

export default SEICanvasRenderer
