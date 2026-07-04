/**
 * Event-handler composition for the headless prop getters (inspired by
 * Downshift's `callAllEventHandlers`, reimplemented for SAP — no dependency).
 *
 * A caller's handler runs before SAP's internal handler. The caller can stop
 * the chain (i.e. suppress SAP's internal behavior) in two ways:
 *
 * 1. `event.preventDefault()` — also cancels native browser behavior.
 * 2. Setting the SAP-specific escape flag, which leaves native behavior
 *    intact: `event.sapPreventDefault = true` (or, on a React synthetic
 *    event, `event.nativeEvent.sapPreventDefault = true`).
 */
/** True when a previous handler asked for the rest of the chain to be skipped. */
export declare function isSAPDefaultPrevented(event: unknown): boolean;
/**
 * Merge any number of optional event handlers into one. Handlers run in
 * order, nullish entries are skipped, and the chain stops as soon as
 * `isSAPDefaultPrevented(event)` reports true.
 */
export declare function composeEventHandlers<E>(...handlers: Array<((event: E) => void) | null | undefined>): (event: E) => void;
//# sourceMappingURL=composeEventHandlers.d.ts.map