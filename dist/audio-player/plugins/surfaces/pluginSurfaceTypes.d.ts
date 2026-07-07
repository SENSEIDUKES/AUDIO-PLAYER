/**
 * Plugin surface routing — Phase 1 contract (metadata only).
 *
 * These types describe *where a plugin's UI belongs* so future phases can route
 * each plugin to the right place: the three-dot / SAPController settings sheet,
 * the Ⓢ SEI Canvas rich visual surface, both, or nowhere (headless). This file
 * defines the declarative contract only — it does not change any runtime menu,
 * arc, or canvas behavior.
 */
/** Where a plugin renders its UI. */
export type PluginSurfaceKind = "headless" | "settings" | "canvas" | "dual";
/** Broad classification of a plugin, used for grouping and future routing. */
export type PluginSurfaceCategory = "visual" | "agent" | "playback" | "analytics" | "utility";
/**
 * Intended menu branch for a plugin. Declarative for now — future phases map
 * these onto the arc menu / SAPController. `agent` is reserved for future agent
 * plugins; no agent plugin is implemented in this phase.
 */
export type PluginMenuBranch = "plugin:visual" | "plugin:playback" | "plugin:analytics" | "agent" | "playback" | "library";
/** Settings surface: the plugin exposes options in the SAPController experience. */
export interface PluginSettingsSurface {
    enabled: boolean;
    /** Declarative workspace route string (e.g. "playback:automix"). Required:
     *  a settings surface is not navigable without a destination. */
    route: string;
    label?: string;
    description?: string;
}
/** Canvas surface: the plugin renders rich visual content inside SEI Canvas. */
export interface PluginCanvasSurface {
    enabled: boolean;
    /** Stable id used to address this plugin's SEI Canvas surface (e.g. "lyrics"). */
    surfaceId: string;
    label?: string;
    description?: string;
    /** True when the surface only makes sense with an active track loaded. */
    requiresActiveTrack?: boolean;
    preferredHeight?: "compact" | "standard" | "expanded";
}
/** Menu placement hints. Declarative only this phase. */
export interface PluginMenuSurface {
    showInArc?: boolean;
    branch?: PluginMenuBranch;
    order?: number;
}
/** Fields shared by every surface definition, regardless of kind. */
interface PluginSurfaceBase {
    pluginId: string;
    label: string;
    description?: string;
    category: PluginSurfaceCategory;
    menu?: PluginMenuSurface;
}
/**
 * The full surface routing definition for a single plugin, modeled as a
 * discriminated union on `kind` so impossible states (e.g. a "headless" plugin
 * with a canvas surface, or a "canvas" plugin without one) are unrepresentable.
 */
export type PluginSurfaceDefinition = (PluginSurfaceBase & {
    kind: "headless";
    settings?: never;
    canvas?: never;
}) | (PluginSurfaceBase & {
    kind: "settings";
    settings: PluginSettingsSurface;
    canvas?: never;
}) | (PluginSurfaceBase & {
    kind: "canvas";
    settings?: never;
    canvas: PluginCanvasSurface;
}) | (PluginSurfaceBase & {
    kind: "dual";
    settings: PluginSettingsSurface;
    canvas: PluginCanvasSurface;
});
export {};
//# sourceMappingURL=pluginSurfaceTypes.d.ts.map