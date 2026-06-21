/**
 * Per-face capability model — the single source of truth for which render zones
 * and surface behaviors a player face supports.
 *
 * Rules are declared here, never inferred from layout/width. Every consumer asks
 * these getters (e.g. `faceSupportsSEICanvas`) so support is a property of the
 * face, not of the current viewport.
 */
/** Every player face the library ships. */
export type PlayerFace = "fullCard" | "miniSidebar" | "seaCard" | "stickyBottom" | "vaultRow" | "portable" | "narrative";
/**
 * The two player families. Every face belongs to exactly one, and inherits that
 * family's capability defaults (overriding only the few deltas it needs).
 *
 * - `primary` — rich release presentation: hero artwork, release metadata, the
 *   SEICanvas + waveform ScrubberCanvas, queue surface, plugins. The faces that
 *   feel "foundational" (fullCard flagship, the seaCard/marketplace variant, the
 *   portable standalone player, and a future full-screen canvas mode).
 * - `compact` — minimal transport: artwork, title/artist, play/pause, action
 *   button. No SEICanvas/waveform, no per-instance scrubber (the stickyBottom
 *   master owns the shared scrubber for the family). The list/bar/widget faces
 *   (miniSidebar, stickyBottom, vaultRow, and a future queueRow).
 * - `narrative` — a "faceless" control surface for story/reader apps. It keeps
 *   the full SAP audio engine underneath (narration on the shared session,
 *   ambience/FX on the sprite layer) but exposes only story-native controls:
 *   a soundscape indicator, play/pause, mute, and ambience/narration volume.
 *   Every music-player capability is off (no SEICanvas, scrubber, waveform,
 *   contextual/action menus, or hero), so it embeds as a tiny inline overlay.
 */
export type PlayerFamily = "primary" | "compact" | "narrative";
export type ScrubberDensity = "compact" | "standard" | "expanded";
export type PlayerFaceCapability = {
    /** The family this face belongs to; its capability defaults flow from here. */
    family: PlayerFamily;
    /** May host the SEICanvas main visual area. Compact/mini faces are false. */
    supportsSEICanvas: boolean;
    /**
     * Renders an action button — the per-face entry point into actions (the
     * three-dot / row action affordance). Distinct from `supportsContextualActions`
     * (the radial command wheel). Both families default this `true`; even the
     * compact vault row gets an action button.
     */
    supportsAction: boolean;
    /**
     * May host the ScrubberCanvas timeline zone. Primary faces and the compact
     * master (stickyBottom) are true; other compact faces (rows, mini) are false
     * by default and defer scrubbing to the shared master.
     */
    supportsScrubberCanvas: boolean;
    /**
     * The scrubber zone may render an interactive wavesurfer waveform (via
     * `WaveformAdapter`) when peak data is available. Faces that opt out keep the
     * plain `ProgressBar`. This is independent of `supportsScrubberCanvas` (the
     * host always renders; this only decides waveform vs. progress content) and
     * can be overridden per call site (e.g. the standalone player's
     * `showWaveform` prop, or the seaCard overlay).
     */
    supportsWaveform: boolean;
    /**
     * Renders the contextual action menu (the bottom-arc SEI Canvas Action Menu /
     * "command wheel") via `PlayerSurfaceButtons`. This is the radial, in-context
     * affordance — distinct from the `SAPController` three-dot deep-action sheet,
     * which faces own separately. Compact faces that rely solely on the three-dot
     * menu (or have no room for a menu at all) declare this `false`.
     */
    supportsContextualActions: boolean;
    /** Hero can collapse into a compact identity header when a surface opens. */
    supportsHeroCollapse?: boolean;
    /** Where the canvas prefers to live relative to the face. */
    preferredCanvasPlacement?: "main" | "overlay" | "none";
    /** How dense the scrubber renders on this face. */
    scrubberDensity?: ScrubberDensity;
};
/**
 * Declared capabilities for all faces — the contract every face renders against.
 *
 * Wiring status (what physically renders today vs. what is a forward-looking
 * declaration for later phases):
 * - `fullCard`     — fully wired: SEICanvas, ScrubberCanvas (waveform),
 *                    contextual menu.
 * - `miniSidebar`  — wired: ScrubberCanvas (progress) + contextual menu.
 * - `portable`     — standalone player with full surface support: SEICanvas,
 *                    ScrubberCanvas (waveform), and contextual action menu.
 * - `seaCard`      — inline progress + an overlay SEICanvas that shows the
 *                    waveform behind a small trigger (Phase 4).
 * - `stickyBottom` — compact bar; ScrubberCanvas (progress), deep actions in its
 *                    SAPController, so it declares no contextual (radial) menu.
 * - `vaultRow`     — slim list row; ScrubberCanvas (progress) on the active row.
 *
 * `supportsContextualActions` is the source of truth for the radial command-wheel
 * menu (`PlayerSurfaceButtons` → `SEICanvasActionMenu`). It is independent of the
 * three-dot `SAPController`, which any face may host for deep actions.
 *
 * `supportsWaveform` decides whether the scrubber zone draws an interactive
 * waveform (when peaks exist) vs. the plain progress bar. Spacious faces opt in;
 * compact list/bar faces stay on the progress bar for performance and legibility
 * (flipping one of them on later is a single boolean here).
 */
/** A family's baseline capabilities — everything a face inherits before deltas. */
type FamilyCapabilityDefaults = Omit<PlayerFaceCapability, "family">;
/**
 * Family-level capability defaults. A face declares its `family` and overrides
 * only the handful of fields where it diverges, so the contract lives in one
 * place per family instead of being re-spelled per face.
 */
export declare const FAMILY_DEFAULTS: Record<PlayerFamily, FamilyCapabilityDefaults>;
export declare const PLAYER_FACE_CAPABILITIES: Record<PlayerFace, PlayerFaceCapability>;
export declare function getFaceCapability(face: PlayerFace): PlayerFaceCapability;
/** The family a face belongs to (primary | compact). */
export declare function getFaceFamily(face: PlayerFace): PlayerFamily;
/** Whether a face renders its own action button (the per-face action entry). */
export declare function faceSupportsAction(face: PlayerFace): boolean;
export declare function faceSupportsSEICanvas(face: PlayerFace): boolean;
export declare function faceSupportsScrubberCanvas(face: PlayerFace): boolean;
export declare function faceSupportsContextualActions(face: PlayerFace): boolean;
export declare function faceSupportsWaveform(face: PlayerFace): boolean;
/**
 * Pixel height for the waveform canvas at a given scrubber density. Compact
 * faces draw a shorter wave; the standalone/expanded faces get the full height.
 * Callers may still override with an explicit `height` prop.
 */
export declare function getScrubberHeight(density: ScrubberDensity): number;
export declare function faceSupportsHeroCollapse(face: PlayerFace): boolean;
export declare function getScrubberDensity(face: PlayerFace): ScrubberDensity;
export declare function getPreferredCanvasPlacement(face: PlayerFace): "main" | "overlay" | "none";
export {};
//# sourceMappingURL=faceCapabilities.d.ts.map