export interface QueueSurfaceProps {
    /** Optional cap on how many upcoming tracks to list. */
    maxItems?: number;
    className?: string;
}
/**
 * In-region "Up Next" surface (Apple-Music style), rendered inside the shared
 * surface region by the right surface button. Reads the shared session queue;
 * tap a row to jump to that track. This is intentionally lightweight — the full
 * drag-to-reorder/remove experience stays in the existing QueueDrawer overlay.
 */
export declare function QueueSurface({ maxItems, className }: QueueSurfaceProps): import("react").JSX.Element;
export default QueueSurface;
//# sourceMappingURL=QueueSurface.d.ts.map