import { getVisualComponentsForSlot } from "./visualRegistry"
import { useVisualSlots } from "./VisualSlotsContext"
import type { VisualSlot } from "./types"

export interface VisualSlotPickerProps {
    /** Which slot to list components for. Defaults to `"seiCanvas"`. */
    slot?: VisualSlot
}

/**
 * Segmented-control picker that lists every visual component registered for a
 * slot, plus a "None" option. Selecting an entry calls `setActive` on the
 * per-player visual-slot store; the corresponding renderer picks it up
 * immediately through context.
 *
 * Mounted inside the `visual:canvas` workspace route so the Canvas page becomes
 * "choose a visual + tune it".
 */
export function VisualSlotPicker({ slot = "seiCanvas" }: VisualSlotPickerProps) {
    const { getActive, setActive } = useVisualSlots()
    const components = getVisualComponentsForSlot(slot)
    const activeId = getActive(slot)

    return (
        <div className="sap-visual-switcher">
            <span className="sap-visual-switcher__label">Choose Visual</span>
            <div className="sap-visual-switcher__list">
                {components.map((def) => (
                    <button
                        key={def.id}
                        type="button"
                        className={`sap-visual-switcher__btn${
                            activeId === def.id ? " sap-visual-switcher__btn--active" : ""
                        }`}
                        onClick={() => setActive(slot, def.id)}
                        aria-pressed={activeId === def.id}
                    >
                        {def.name}
                    </button>
                ))}
                <button
                    key="__none__"
                    type="button"
                    className={`sap-visual-switcher__btn${
                        activeId === null ? " sap-visual-switcher__btn--active" : ""
                    }`}
                    onClick={() => setActive(slot, null)}
                    aria-pressed={activeId === null}
                >
                    None
                </button>
            </div>
        </div>
    )
}

export default VisualSlotPicker
