import { AudioSpriteEngine } from "./AudioSpriteEngine"
import type { AudioSpriteManifest, AudioSpritePlayOptions } from "./AudioSpriteEngine"
import type { PluginSoundScope } from "../plugins/PluginInterface"

/** Minimal owned engine used by standalone and mixer-backed sprite scopes. */
export interface SpriteScopeEngine {
    load(manifest: AudioSpriteManifest): Promise<void>
    play(clip: string, options?: AudioSpritePlayOptions): string | null
    stop(id: string): void
    fade(id: string, volume: number, durationMs: number): void
    stopAll(): void
    dispose(): void
}

/** Continue releasing resources after an individual backend failure. */
export function cleanupSounds(work: Iterable<() => void>): void {
    for (const cleanup of work) {
        try {
            cleanup()
        } catch (error) {
            console.warn("SAP Cues: sound cleanup failed", error)
        }
    }
}

/** Lazy per-pack engines, isolated from every other manifest and plugin. */
export function createPluginSoundScope(
    createEngine: () => SpriteScopeEngine = () => new AudioSpriteEngine({ startTimeoutMs: 1500 }),
    onDispose: () => void = () => {}
): PluginSoundScope {
    const engines = new Map<string, SpriteScopeEngine>()
    let disposed = false
    const scope: PluginSoundScope = {
        async loadSpritePack(manifest, pack = "default") {
            if (disposed) throw new DOMException("Sound scope disposed", "AbortError")
            let engine = engines.get(pack)
            if (!engine) {
                engine = createEngine()
                engines.set(pack, engine)
            }
            await engine.load(manifest)
            if (disposed) throw new DOMException("Sound scope disposed", "AbortError")
        },
        playSprite: (clip, options) =>
            disposed
                ? null
                : (engines.get(options?.pack ?? "default")?.play(clip, options) ?? null),
        stopSprite: (id) =>
            cleanupSounds([...engines.values()].map((engine) => () => engine.stop(id))),
        fadeSprite: (id, volume, duration) =>
            cleanupSounds(
                [...engines.values()].map((engine) => () => engine.fade(id, volume, duration))
            ),
        stopAllSprites: () =>
            cleanupSounds([...engines.values()].map((engine) => () => engine.stopAll())),
        dispose() {
            if (disposed) return
            disposed = true
            const owned = [...engines.values()]
            engines.clear()
            cleanupSounds([...owned.map((engine) => () => engine.dispose()), onDispose])
        },
    }
    return scope
}
