import { getVisualComponent } from "./visualRegistry"
import { useVisualSlots } from "./VisualSlotsContext"
import "./visualSlots.css"

/**
 * Mounts the active `seiCanvas` visual component into the SEI Canvas region with
 * its live settings. Replaces the old placeholder/demo content. When no seiCanvas
 * component is active it renders a clean empty state — not "plugins mount here".
 */
export function SEICanvasRenderer() {
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
    return <Component settings={slots.getSettings(def.id)} />
}

export default SEICanvasRenderer
