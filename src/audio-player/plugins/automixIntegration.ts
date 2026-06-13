import type { AudioPlayerPlugin } from "../core/plugins/PluginInterface"
import { AutomixPlugin } from "./AutomixPlugin"

/**
 * Canonical plugin name for Automix. The internal controller and the public
 * `createAutomixPlugin()` both use this, so the player can detect an externally
 * supplied Automix plugin and avoid running a second one beside it.
 */
export const AUTOMIX_PLUGIN_NAME = "automix"

/**
 * Whether a plugin list already contains an Automix controller.
 *
 * Detect by type first so any `AutomixPlugin` instance counts regardless of its
 * `name` — the built-in plugin registry, for example, registers Automix as
 * `"registry-automix"`. The canonical-name check is a defensive fallback for
 * automix-equivalent plugins that aren't `AutomixPlugin` instances.
 */
export function hasAutomixPlugin(
    plugins: readonly AudioPlayerPlugin[]
): boolean {
    return plugins.some(
        (plugin) =>
            plugin instanceof AutomixPlugin ||
            plugin.name === AUTOMIX_PLUGIN_NAME
    )
}

/**
 * Merge the player's internal Automix plugin into the consumer's plugin list,
 * but only when the consumer hasn't already supplied their own Automix plugin.
 *
 * This is what guarantees a *single* Automix controller: the `automix` prop/menu
 * drives the internal plugin, and an explicitly passed external Automix plugin
 * takes precedence (the internal one is omitted) so the two transition systems
 * can never both run and double-advance the queue.
 */
export function withInternalAutomix(
    externalPlugins: readonly AudioPlayerPlugin[],
    internal: AudioPlayerPlugin
): readonly AudioPlayerPlugin[] {
    return hasAutomixPlugin(externalPlugins)
        ? externalPlugins
        : [...externalPlugins, internal]
}
