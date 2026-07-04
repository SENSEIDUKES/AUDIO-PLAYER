import { PluginSurfaceCategory, PluginMenuBranch, PluginSurfaceDefinition } from './pluginSurfaceTypes';
export declare const DEFAULT_PLUGIN_SURFACES: readonly PluginSurfaceDefinition[];
/** Look up a single plugin's surface definition by its plugin id. */
export declare function getPluginSurfaceDefinition(pluginId: string): PluginSurfaceDefinition | undefined;
/** All surface definitions in a given category, sorted by menu order. */
export declare function getPluginSurfaceDefinitionsByCategory(category: PluginSurfaceCategory): PluginSurfaceDefinition[];
/** All surface definitions whose menu placement targets a given branch, sorted. */
export declare function getPluginSurfaceDefinitionsForMenuBranch(branch: PluginMenuBranch): PluginSurfaceDefinition[];
/**
 * Map a plugin instance name back to its catalog plugin id. Registry-created
 * instances are named `"registry-<id>"` (see usePluginRegistry); bare ids pass
 * through unchanged, so hosts can supply either form.
 */
export declare function normalizePluginId(nameOrId: string): string;
/**
 * The standardized arc menu's Plugins sub-branches. Every non-agent plugin
 * category folds into one of these three buckets.
 */
export type ArcPluginBucket = "audio" | "visual" | "analytics";
/**
 * Which Plugins sub-branch (Audio / Visual / Analytics) a plugin surfaces
 * under in the standardized arc menu. Playback- and utility-category plugins
 * are audio-affecting, so they fold into Audio. Agent-category plugins return
 * `null` — agents live under the arc's dedicated Agents branch, never Plugins.
 */
export declare function getArcPluginBucket(definition: PluginSurfaceDefinition): ArcPluginBucket | null;
/**
 * The surface definitions for the currently active plugins, sorted by menu
 * order. `activePluginIds` accepts catalog ids ("lyrics") or registry instance
 * names ("registry-lyrics"); unknown ids are ignored. This is what the arc
 * menu's Plugins branch renders — only plugins that are actually active, never
 * the full catalog.
 */
export declare function getActivePluginSurfaceDefinitions(activePluginIds: readonly string[]): PluginSurfaceDefinition[];
//# sourceMappingURL=defaultPluginSurfaces.d.ts.map