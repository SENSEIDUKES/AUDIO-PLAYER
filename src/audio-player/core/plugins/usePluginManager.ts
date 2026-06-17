import { useEffect, useRef, useMemo } from "react"
import type { AudioPlayerPlugin, PluginPlayerContext } from "./PluginInterface"
import { PluginManager, type PluginManagerOptions } from "./PluginManager"

/** React bridge that keeps a PluginManager stable while plugin arrays change. */
export function usePluginManager(
    plugins: readonly AudioPlayerPlugin[],
    context: PluginPlayerContext,
    options?: PluginManagerOptions
): PluginManager {
    const managerRef = useRef<PluginManager | null>(null)
    
    // Memoize options to prevent recreation on every render
    const memoizedOptions = useMemo(() => options, [
        options?.errorHandler,
        options?.maxFailuresBeforeDisable
    ])
    
    if (managerRef.current === null) {
        managerRef.current = new PluginManager(context, memoizedOptions)
    } else {
        managerRef.current.setContext(context)
    }

    const manager = managerRef.current

    // Guardrail: if the array identity changes on every render but the set of
    // plugin *names* is unchanged, the consumer is almost certainly passing an
    // inline array (e.g. `plugins={[createAutomixPlugin()]}`). The playback rAF
    // loop re-renders ~60/s, so that would destroy and recreate every plugin
    // each frame — breaking stateful plugins like Automix mid-transition. Warn
    // (once) so they memoize. Legitimate plugin-set changes (different names)
    // still replace silently.
    const prevPluginsRef = useRef<readonly AudioPlayerPlugin[] | null>(null)
    const churnWarnedRef = useRef(false)
    const prev = prevPluginsRef.current
    if (
        prev !== null &&
        prev !== plugins &&
        !churnWarnedRef.current &&
        typeof console !== "undefined" &&
        sameNameSet(prev, plugins)
    ) {
        churnWarnedRef.current = true
        console.warn(
            "[AudioPlayer] The `plugins` array changed identity but contains " +
                "the same plugin names. Pass a stable reference (e.g. wrap it " +
                "in useMemo) so plugins are not destroyed and recreated on " +
                "every render."
        )
    }
    prevPluginsRef.current = plugins

    useEffect(() => {
        manager.replace(plugins)
    }, [manager, plugins])

    useEffect(() => () => manager.clear(), [manager])

    return manager
}

/** Whether two plugin arrays contain exactly the same multiset of plugin names. */
function sameNameSet(
    a: readonly AudioPlayerPlugin[],
    b: readonly AudioPlayerPlugin[]
): boolean {
    if (a.length !== b.length) return false
    // Sort and compare so duplicate names are handled correctly, e.g.
    // ["a","b"] vs ["a","a"] must differ.
    const namesA = a.map((plugin) => plugin.name).sort()
    const namesB = b.map((plugin) => plugin.name).sort()
    return namesA.every((name, i) => name === namesB[i])
}
