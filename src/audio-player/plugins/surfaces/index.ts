/**
 * Plugin surface routing — public barrel.
 *
 * Phase 1 foundation: a declarative contract for where each plugin's UI belongs
 * (settings / SEI Canvas / both / headless), plus pure helpers and a default
 * catalog for the built-in plugins. No runtime menu/canvas behavior is changed.
 */

export type {
    PluginSurfaceKind,
    PluginSurfaceCategory,
    PluginMenuBranch,
    PluginSettingsSurface,
    PluginCanvasSurface,
    PluginMenuSurface,
    PluginSurfaceDefinition,
} from "./pluginSurfaceTypes"

export {
    hasSettingsSurface,
    hasCanvasSurface,
    isHeadlessPlugin,
    getPluginSettingsRoute,
    getPluginCanvasSurfaceId,
    sortPluginSurfaceDefinitions,
} from "./pluginSurfaceHelpers"

export {
    DEFAULT_PLUGIN_SURFACES,
    getPluginSurfaceDefinition,
    getPluginSurfaceDefinitionsByCategory,
    getPluginSurfaceDefinitionsForMenuBranch,
} from "./defaultPluginSurfaces"
