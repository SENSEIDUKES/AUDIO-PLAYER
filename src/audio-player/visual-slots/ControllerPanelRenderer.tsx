import { getVisualComponent } from "./visualRegistry"
import { useVisualSlots } from "./VisualSlotsContext"

export interface ControllerPanelRendererProps {
    /** The component whose SettingsPanel should render in the workspace sheet. */
    componentId: string
    /** Optional preview context (e.g. the active track's lyrics). */
    lyrics?: string
}

/**
 * Renders a registered component's `SettingsPanel` inside the SAPController
 * workspace sheet, wired to the per-player settings store. Used by the lyrics
 * workspace route to edit the lyric display's settings; edits flow straight back
 * to the live SEI Canvas visual through context.
 */
export function ControllerPanelRenderer({
    componentId,
    lyrics,
}: ControllerPanelRendererProps) {
    const slots = useVisualSlots()
    const def = getVisualComponent(componentId)

    if (!def || !def.SettingsPanel) {
        return (
            <div className="sap-ctl__workspace-empty">
                <p className="sap-ctl__workspace-lead">{def?.name ?? "Settings"}</p>
                <p className="sap-ctl__workspace-sub">
                    This visual has no configurable settings.
                </p>
            </div>
        )
    }

    const { SettingsPanel } = def
    return (
        <SettingsPanel
            settings={slots.getSettings(def.id)}
            onChange={(partial) => slots.updateSettings(def.id, partial)}
            lyrics={lyrics}
        />
    )
}

export default ControllerPanelRenderer
