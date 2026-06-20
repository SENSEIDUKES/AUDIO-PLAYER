import type { PluginPlayerContext } from "../core/plugins/PluginInterface"
import type { CueManifest, CueEvent, CueAction } from "./cueTypes"

export class CueRuntime {
    private context: PluginPlayerContext
    private firedCueIds = new Set<string>()
    private timeCues: CueEvent[]
    private cueMap = new Map<string, CueEvent>()
    private triggerMap = new Map<string, CueEvent[]>()
    private lastTime = 0

    constructor(context: PluginPlayerContext, manifest: CueManifest) {
        this.context = context

        // Sort cues that are bound to a specific time
        this.timeCues = manifest.cues
            .filter((c) => c.trigger.kind === "time")
            .sort((a, b) => {
                const aTime = a.trigger.kind === "time" ? a.trigger.at : 0
                const bTime = b.trigger.kind === "time" ? b.trigger.at : 0
                return aTime - bTime
            })

        // Build lookup maps
        for (const cue of manifest.cues) {
            if (cue.id) {
                this.cueMap.set(cue.id, cue)
            }
            if (cue.trigger.kind !== "time") {
                const triggerKey = `${cue.trigger.kind}:${cue.trigger.value}`
                if (!this.triggerMap.has(triggerKey)) {
                    this.triggerMap.set(triggerKey, [])
                }
                this.triggerMap.get(triggerKey)!.push(cue)
            }
        }

        // Preload assets if available. Currently we just load the 'default' pack
        // if multiple packs are provided, or the first one we find.
        if (manifest.assets?.spritePacks && this.context.sounds) {
            const packToLoad = manifest.assets.spritePacks["default"] || Object.values(manifest.assets.spritePacks)[0]
            if (packToLoad) {
                this.context.sounds.loadSpritePack(packToLoad).catch(e => {
                    console.warn("SAP Cues: Failed to load sprite pack", e)
                })
            }
        }
    }

    reset() {
        this.firedCueIds.clear()
        this.lastTime = 0
    }

    handleTimeUpdate(currentTime: number) {
        const isSeeking = Math.abs(currentTime - this.lastTime) > 1.0

        for (const cue of this.timeCues) {
            if (cue.trigger.kind !== "time") continue

            const hasFired = this.firedCueIds.has(cue.id)
            const triggerTime = cue.trigger.at

            // If seeking backward, allow replayable cues to fire again in the future
            if (isSeeking && currentTime < triggerTime) {
                if (cue.replayable) {
                    this.firedCueIds.delete(cue.id)
                }
                continue
            }

            // Normal playback: fire if we crossed the cue time
            if (!hasFired && currentTime >= triggerTime) {
                // If this is a forward seek, respect fireOnSeek flag
                if (isSeeking && !cue.fireOnSeek) {
                    this.firedCueIds.add(cue.id)
                    continue
                }

                // Either normal playback crossing, or a seek that allows firing
                if (isSeeking || (this.lastTime <= triggerTime && currentTime >= triggerTime)) {
                    this.firedCueIds.add(cue.id)
                    this.executeActions(cue.actions)
                }
            }
        }
        
        this.lastTime = currentTime
    }

    /** Manually execute a cue by its ID, ignoring time checks. */
    executeCueById(id: string) {
        const cue = this.cueMap.get(id)
        if (cue) {
            this.executeActions(cue.actions)
        }
    }

    /** Execute any cues matching the given trigger kind and value. */
    executeCueByTrigger(kind: string, value: string | number) {
        const triggerKey = `${kind}:${value}`
        const cues = this.triggerMap.get(triggerKey)
        if (cues) {
            for (const cue of cues) {
                this.executeActions(cue.actions)
            }
        }
    }

    private executeActions(actions: CueAction[]) {
        for (const action of actions) {
            try {
                switch (action.command) {
                    case "sprite.play":
                        this.context.sounds?.playSprite(action.clip, {
                            loop: action.loop,
                            volume: action.volume,
                        })
                        break
                    case "sprite.stop":
                        // If no clip is specified, stop everything
                        if (action.clip) {
                            // The engine doesn't expose a specific clip stop easily, 
                            // but this is a placeholder if we expand AudioSpriteEngine
                        }
                        break
                    case "sprite.fade":
                        // Placeholder for sprite fading
                        break
                    case "player.seek":
                        this.context.getEngine().seek(action.time)
                        break
                    case "player.pause":
                        this.context.getEngine().pause()
                        break
                    case "event.emit":
                        const root = this.context.getRootElement() || window
                        root.dispatchEvent(
                            new CustomEvent(action.eventName, {
                                detail: action.detail,
                                bubbles: true,
                            })
                        )
                        break

                    // Narrative state actions - broadcast to UI layer
                    case "ambience.crossfade":
                    case "duck.set":
                    case "volume.fadeNarration":
                    case "layer.set":
                    case "spatial.pan":
                        const target = this.context.getRootElement() || window
                        target.dispatchEvent(
                            new CustomEvent("sap-narrative-cue", {
                                detail: action, // Action itself is the payload now
                                bubbles: true,
                            })
                        )
                        break
                }
            } catch (e) {
                console.error("SAP Cues: Failed to execute cue action", action, e)
            }
        }
    }
}
