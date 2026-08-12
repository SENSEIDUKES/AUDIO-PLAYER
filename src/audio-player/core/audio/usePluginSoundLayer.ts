import { useEffect, useMemo, useRef } from "react"
import { AudioSpriteEngine } from "./AudioSpriteEngine"
import type { PluginSoundLayer } from "../plugins/PluginInterface"

/**
 * Creates the restricted sprite facade passed to plugins. One engine is shared
 * by the player/session so plugin-layer sounds never touch primary playback.
 */
export function usePluginSoundLayer(): PluginSoundLayer {
    const engineRef = useRef<AudioSpriteEngine | null>(null)
    if (engineRef.current === null) engineRef.current = new AudioSpriteEngine()

    useEffect(
        () => () => {
            engineRef.current?.dispose()
            engineRef.current = null
        },
        []
    )

    return useMemo<PluginSoundLayer>(
        () => ({
            loadSpritePack: (manifest) => engineRef.current!.load(manifest),
            playSprite: (clipName, options) => engineRef.current!.play(clipName, options),
            stopSprite: (id) => engineRef.current!.stop(id),
            fadeSprite: (id, toVolume, durationMs) =>
                engineRef.current!.fade(id, toVolume, durationMs),
            stopAllSprites: () => engineRef.current!.stopAll(),
        }),
        []
    )
}
