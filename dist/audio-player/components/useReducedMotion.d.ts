/**
 * Tracks the user's `prefers-reduced-motion` setting and updates if it changes
 * mid-session. SSR-safe: with no `window`/`matchMedia` it reports `false`, the
 * motion-on default, matching the server render.
 */
export declare function useReducedMotion(): boolean;
export default useReducedMotion;
//# sourceMappingURL=useReducedMotion.d.ts.map