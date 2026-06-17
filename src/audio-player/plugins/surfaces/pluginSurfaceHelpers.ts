/**
 * Pure helpers over a single PluginSurfaceDefinition. No React, no engine
 * imports — these only answer questions about a definition's shape.
 */

import type { PluginSurfaceDefinition } from "./pluginSurfaceTypes"

/** True when the plugin exposes a (enabled) settings surface. */
export function hasSettingsSurface(definition: PluginSurfaceDefinition): boolean {
    if (definition.kind !== "settings" && definition.kind !== "dual") return false
    return definition.settings?.enabled === true
}

/** True when the plugin exposes a (enabled) SEI Canvas surface. */
export function hasCanvasSurface(definition: PluginSurfaceDefinition): boolean {
    if (definition.kind !== "canvas" && definition.kind !== "dual") return false
    return definition.canvas?.enabled === true
}

/** True when the plugin renders no UI at all. */
export function isHeadlessPlugin(definition: PluginSurfaceDefinition): boolean {
    return (
        definition.kind === "headless" &&
        !hasSettingsSurface(definition) &&
        !hasCanvasSurface(definition)
    )
}

/** The declarative settings route, when the plugin has an enabled settings surface. */
export function getPluginSettingsRoute(
    definition: PluginSurfaceDefinition,
): string | undefined {
    return hasSettingsSurface(definition) ? definition.settings?.route : undefined
}

/** The SEI Canvas surface id, when the plugin has an enabled canvas surface. */
export function getPluginCanvasSurfaceId(
    definition: PluginSurfaceDefinition,
): string | undefined {
    return hasCanvasSurface(definition) ? definition.canvas?.surfaceId : undefined
}

/**
 * Return a new array sorted by menu order (ascending), tie-broken by pluginId.
 * Stable and non-mutating — the input array is left untouched.
 */
export function sortPluginSurfaceDefinitions(
    definitions: readonly PluginSurfaceDefinition[],
): PluginSurfaceDefinition[] {
    return [...definitions].sort((a, b) => {
        const orderA = a.menu?.order ?? Number.MAX_SAFE_INTEGER
        const orderB = b.menu?.order ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.pluginId.localeCompare(b.pluginId)
    })
}
