/**
 * Default surface routing catalog for the built-in plugins.
 *
 * This is declarative Phase 1 metadata only: it records where each plugin's UI
 * is *intended* to live. Nothing here is wired into the arc menu, the
 * SAPController, or SEI Canvas yet — future phases read this catalog to drive
 * routing.
 *
 * Routing intent:
 *  - lyrics renders primarily inside SEI Canvas (kind: "dual" — it also has a
 *    settings route).
 *  - all other current non-headless plugins live in the SAPController settings
 *    experience.
 *  - keyboard-shortcuts is headless (no UI).
 *
 * Settings `route` strings follow the existing "category:target" workspace-route
 * convention (see components/workspace/workspaceRoutes.ts). lyrics, waveform and
 * automix already have matching WorkspaceRoutes; the others are forward-declared
 * here and are NOT registered into WORKSPACE_ROUTES this phase (no runtime
 * wiring).
 *
 * Future agent plugins will register here with category "agent", kind "dual",
 * and a SEI Canvas surface — intentionally NOT added in this phase.
 */

import type {
    PluginSurfaceCategory,
    PluginMenuBranch,
    PluginSurfaceDefinition,
} from "./pluginSurfaceTypes"
import { sortPluginSurfaceDefinitions } from "./pluginSurfaceHelpers"

export const DEFAULT_PLUGIN_SURFACES: readonly PluginSurfaceDefinition[] = [
    {
        pluginId: "keyboard-shortcuts",
        label: "Keyboard Shortcuts",
        description: "Space / arrow / JKL transport controls.",
        category: "utility",
        kind: "headless",
    },
    {
        pluginId: "analytics",
        label: "Analytics",
        description: "Playback event reporting.",
        category: "analytics",
        kind: "settings",
        settings: {
            enabled: true,
            route: "plugin-settings:analytics",
            label: "Analytics",
        },
        menu: {
            branch: "plugin:analytics",
            order: 40,
        },
    },
    {
        pluginId: "lyrics",
        label: "Lyrics",
        description: "Synced lyrics — primary UI lives in SEI Canvas.",
        category: "visual",
        kind: "dual",
        settings: {
            enabled: true,
            route: "plugin-settings:lyrics",
            label: "Lyrics",
        },
        canvas: {
            enabled: true,
            surfaceId: "lyrics",
            label: "Lyrics",
            requiresActiveTrack: true,
            preferredHeight: "standard",
        },
        menu: {
            showInArc: true,
            branch: "plugin:visual",
            order: 10,
        },
    },
    {
        pluginId: "sleep-timer",
        label: "Sleep Timer",
        description: "Auto-stop after a chosen duration.",
        category: "utility",
        kind: "settings",
        settings: {
            enabled: true,
            route: "plugin-settings:sleep-timer",
            label: "Sleep Timer",
        },
        menu: {
            branch: "playback",
            order: 30,
        },
    },
    {
        pluginId: "automix",
        label: "Automix",
        description: "Beat-aware crossfades between tracks.",
        category: "playback",
        kind: "settings",
        settings: {
            enabled: true,
            route: "playback:automix",
            label: "Automix",
        },
        menu: {
            branch: "playback",
            order: 20,
        },
    },
    {
        pluginId: "auto-theme",
        label: "Auto Theme",
        description: "Derives player colors from album art.",
        category: "visual",
        kind: "settings",
        settings: {
            enabled: true,
            route: "plugin-settings:auto-theme",
            label: "Auto Theme",
        },
        menu: {
            branch: "plugin:visual",
            order: 50,
        },
    },
    {
        pluginId: "waveform",
        label: "Waveform",
        description: "Interactive waveform scrubber (no SEI Canvas surface yet).",
        category: "visual",
        kind: "settings",
        settings: {
            enabled: true,
            route: "plugin-settings:waveform",
            label: "Waveform",
        },
        menu: {
            branch: "plugin:visual",
            order: 60,
        },
    },
]

/** Look up a single plugin's surface definition by its plugin id. */
export function getPluginSurfaceDefinition(
    pluginId: string,
): PluginSurfaceDefinition | undefined {
    return DEFAULT_PLUGIN_SURFACES.find((def) => def.pluginId === pluginId)
}

/** All surface definitions in a given category, sorted by menu order. */
export function getPluginSurfaceDefinitionsByCategory(
    category: PluginSurfaceCategory,
): PluginSurfaceDefinition[] {
    return sortPluginSurfaceDefinitions(
        DEFAULT_PLUGIN_SURFACES.filter((def) => def.category === category),
    )
}

/** All surface definitions whose menu placement targets a given branch, sorted. */
export function getPluginSurfaceDefinitionsForMenuBranch(
    branch: PluginMenuBranch,
): PluginSurfaceDefinition[] {
    return sortPluginSurfaceDefinitions(
        DEFAULT_PLUGIN_SURFACES.filter((def) => def.menu?.branch === branch),
    )
}

/**
 * Map a plugin instance name back to its catalog plugin id. Registry-created
 * instances are named `"registry-<id>"` (see usePluginRegistry); bare ids pass
 * through unchanged, so hosts can supply either form.
 */
export function normalizePluginId(nameOrId: string): string {
    return nameOrId.startsWith("registry-")
        ? nameOrId.slice("registry-".length)
        : nameOrId
}

/**
 * The standardized arc menu's Plugins sub-branches. Every non-agent plugin
 * category folds into one of these three buckets.
 */
export type ArcPluginBucket = "audio" | "visual" | "analytics"

/**
 * Which Plugins sub-branch (Audio / Visual / Analytics) a plugin surfaces
 * under in the standardized arc menu. Playback- and utility-category plugins
 * are audio-affecting, so they fold into Audio. Agent-category plugins return
 * `null` — agents live under the arc's dedicated Agents branch, never Plugins.
 */
export function getArcPluginBucket(
    definition: PluginSurfaceDefinition,
): ArcPluginBucket | null {
    switch (definition.category) {
        case "visual":
            return "visual"
        case "analytics":
            return "analytics"
        case "playback":
        case "utility":
            return "audio"
        default:
            return null
    }
}

/**
 * The surface definitions for the currently active plugins, sorted by menu
 * order. `activePluginIds` accepts catalog ids ("lyrics") or registry instance
 * names ("registry-lyrics"); unknown ids are ignored. This is what the arc
 * menu's Plugins branch renders — only plugins that are actually active, never
 * the full catalog.
 */
export function getActivePluginSurfaceDefinitions(
    activePluginIds: readonly string[],
): PluginSurfaceDefinition[] {
    const ids = new Set(activePluginIds.map(normalizePluginId))
    return sortPluginSurfaceDefinitions(
        DEFAULT_PLUGIN_SURFACES.filter((def) => ids.has(def.pluginId)),
    )
}
