import { useEffect, useMemo } from "react"
import { AudioSpriteEngine } from "./AudioSpriteEngine"
import type { PluginSoundLayer, PluginSoundScope } from "../plugins/PluginInterface"
import { cleanupSounds, createPluginSoundScope } from "./pluginSoundScope"

/** Stable facade with commit-owned resources, including Strict Mode effect replay. */
export function usePluginSoundLayer(): PluginSoundLayer {
    const lifetime = useMemo(() => {
        let active = false
        let primary: PluginSoundScope | null = null
        const scopes = new Set<PluginSoundScope>()
        const createOwnedScope = (bounded: boolean) => {
            if (!active) throw new DOMException("Sound layer inactive", "AbortError")
            const scope = createPluginSoundScope(
                bounded ? undefined : () => new AudioSpriteEngine(),
                () => scopes.delete(scope)
            )
            scopes.add(scope)
            return scope
        }
        const layer: PluginSoundLayer = {
            createScope: () => createOwnedScope(true),
            loadSpritePack: async (manifest, pack) => {
                primary ??= createOwnedScope(false)
                return primary.loadSpritePack(manifest, pack)
            },
            playSprite: (clip, options) => primary?.playSprite(clip, options) ?? null,
            stopSprite: (id) => primary?.stopSprite(id),
            fadeSprite: (id, volume, duration) => primary?.fadeSprite(id, volume, duration),
            stopAllSprites: () => primary?.stopAllSprites(),
        }
        return {
            layer,
            setup() {
                active = true
            },
            cleanup() {
                active = false
                primary = null
                const owned = [...scopes]
                scopes.clear()
                cleanupSounds(owned.map((scope) => () => scope.dispose()))
            },
        }
    }, [])
    useEffect(() => {
        lifetime.setup()
        return () => lifetime.cleanup()
    }, [lifetime])
    return lifetime.layer
}
