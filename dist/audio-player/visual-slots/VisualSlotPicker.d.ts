import { VisualSlot } from './types';
export interface VisualSlotPickerProps {
    /** Which slot to list components for. Defaults to `"seiCanvas"`. */
    slot?: VisualSlot;
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
export declare function VisualSlotPicker({ slot }: VisualSlotPickerProps): import("react").JSX.Element;
export default VisualSlotPicker;
//# sourceMappingURL=VisualSlotPicker.d.ts.map