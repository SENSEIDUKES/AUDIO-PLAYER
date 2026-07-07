import { ReactNode } from 'react';
import { VisualSlot } from './types';
/** The per-player visual-slot store exposed through context. */
export interface VisualSlotsContextValue {
    /** The active component id for a slot (or null when none is active). */
    getActive: (slot: VisualSlot) => string | null;
    /** Set (or clear, with null) the active component for a slot. */
    setActive: (slot: VisualSlot, id: string | null) => void;
    /** Current settings for a component id (falls back to its defaults). */
    getSettings: (id: string) => Record<string, unknown>;
    /** Merge a partial settings update for a component id. */
    updateSettings: (id: string, partial: Record<string, unknown>) => void;
}
export interface VisualSlotsProviderProps {
    children: ReactNode;
}
/**
 * Holds the active component per slot and the live settings per component for a
 * single player instance. Mounted inside each skin so the state reaches both the
 * SEI Canvas (player stage) and the settings panel (rendered through the
 * SAPController portal) — React context flows through portals.
 */
export declare function VisualSlotsProvider({ children }: VisualSlotsProviderProps): import("react").JSX.Element;
/** Access the per-player visual-slot store (or the read-only fallback). */
export declare function useVisualSlots(): VisualSlotsContextValue;
//# sourceMappingURL=VisualSlotsContext.d.ts.map