import { PluginSurfaceDefinition } from './pluginSurfaceTypes';
/** True when the plugin exposes a (enabled) settings surface. */
export declare function hasSettingsSurface(definition: PluginSurfaceDefinition): boolean;
/** True when the plugin exposes a (enabled) SEI Canvas surface. */
export declare function hasCanvasSurface(definition: PluginSurfaceDefinition): boolean;
/** True when the plugin renders no UI at all. */
export declare function isHeadlessPlugin(definition: PluginSurfaceDefinition): boolean;
/** The declarative settings route, when the plugin has an enabled settings surface. */
export declare function getPluginSettingsRoute(definition: PluginSurfaceDefinition): string | undefined;
/** The SEI Canvas surface id, when the plugin has an enabled canvas surface. */
export declare function getPluginCanvasSurfaceId(definition: PluginSurfaceDefinition): string | undefined;
/**
 * Return a new array sorted by menu order (ascending), tie-broken by pluginId.
 * Stable and non-mutating — the input array is left untouched.
 */
export declare function sortPluginSurfaceDefinitions(definitions: readonly PluginSurfaceDefinition[]): PluginSurfaceDefinition[];
//# sourceMappingURL=pluginSurfaceHelpers.d.ts.map