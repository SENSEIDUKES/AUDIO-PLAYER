import type {
    PluginSoundLayer,
    PluginSoundScope,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { CueManifest, CueEvent, CueAction } from "./cueTypes"

export type CuePackState = "loading" | "ready" | "failed"
export interface CueStatusEvent {
    manifestId?: string
    status: "installed" | "loading" | "ready" | "failed" | "cleanup-failed"
    pack?: string
    message?: string
}
export interface CueOutcomeEvent {
    manifestId?: string
    cueId: string
    command: CueAction["command"]
    pack?: string
    clip?: string
    outcome: "accepted" | "started" | "executed" | "skipped" | "failed"
    reason?: string
}
export interface CueRuntimeOptions {
    onStatus?: (event: CueStatusEvent) => void
    onOutcome?: (event: CueOutcomeEvent) => void
}

/** Observer failures must never prevent a cue or a replacement runtime. */
export function notifyCue<T>(callback: ((event: T) => void) | undefined, event: T): void {
    try {
        callback?.(event)
    } catch (error) {
        console.warn("SAP Cues: observer failed", error)
    }
}

export class CueRuntime {
    private context: PluginPlayerContext
    private firedCueIds = new Set<string>()
    private timeCues: CueEvent[]
    private cueMap = new Map<string, CueEvent>()
    private triggerMap = new Map<string, CueEvent[]>()
    private lastTime = 0
    private activeSprites = new Map<string, string[]>()

    private sounds: PluginSoundLayer | undefined
    private scope: PluginSoundScope | undefined
    private disposed = false
    private stopTimers = new Map<ReturnType<typeof setTimeout>, string>()
    private packStates = new Map<string, CuePackState>()

    constructor(
        context: PluginPlayerContext,
        private manifest: CueManifest,
        private options: CueRuntimeOptions = {}
    ) {
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

        try {
            this.scope = context.sounds?.createScope?.()
            this.sounds = this.scope ?? context.sounds
        } catch (error) {
            this.reportStatus("failed", undefined, String(error))
        }
        this.reportStatus("installed")
        const packs = manifest.assets?.spritePacks ?? {}
        const referenced = new Set(
            manifest.cues.flatMap((cue) =>
                cue.actions.flatMap((action) =>
                    action.command === "sprite.play" ? [action.pack] : []
                )
            )
        )
        for (const name of referenced) {
            const pack = packs[name]
            if (!pack || !this.sounds || (!this.scope && referenced.size > 1)) {
                this.packStates.set(name, "failed")
                this.reportStatus(
                    "failed",
                    name,
                    !pack
                        ? "Missing sprite pack"
                        : !this.sounds
                          ? "Sound layer unavailable"
                          : "Custom sound layer does not support named packs"
                )
                continue
            }
            this.packStates.set(name, "loading")
            this.reportStatus("loading", name)
            // Start through a promise boundary to isolate synchronous custom-layer failures.
            void Promise.resolve()
                .then(() => {
                    if (this.disposed) return
                    return this.sounds!.loadSpritePack(pack, this.scope ? name : undefined)
                })
                .then(
                    () => {
                        if (this.disposed) return
                        this.packStates.set(name, "ready")
                        this.reportStatus("ready", name)
                    },
                    (error) => {
                        if (this.disposed) return
                        this.packStates.set(name, "failed")
                        this.reportStatus("failed", name, String(error))
                    }
                )
        }
    }

    private reportStatus(status: CueStatusEvent["status"], pack?: string, message?: string) {
        notifyCue(this.options.onStatus, { manifestId: this.manifest.id, status, pack, message })
    }

    /** Permanently retire a runtime before asynchronous loads can complete. */
    dispose() {
        if (this.disposed) return
        this.disposed = true
        try {
            this.reset()
        } finally {
            const scope = this.scope
            this.scope = undefined
            this.sounds = undefined
            try {
                scope?.dispose()
            } catch (error) {
                this.reportStatus("cleanup-failed", undefined, String(error))
            }
        }
    }

    reset() {
        const fading = [...this.stopTimers.values()]
        for (const timer of this.stopTimers.keys()) clearTimeout(timer)
        this.stopTimers.clear()
        this.firedCueIds.clear()
        this.lastTime = 0
        const ids = [...this.activeSprites.values()].flat().concat(fading)
        this.activeSprites.clear()
        for (const id of ids) {
            try {
                this.sounds?.stopSprite(id)
            } catch (error) {
                this.reportStatus("cleanup-failed", undefined, String(error))
            }
        }
    }

    handleTimeUpdate(currentTime: number, isSeeking = false) {
        // A backward jump in playback position is a rewind even when no explicit
        // seek event fired — e.g. automatic looping or a custom player rewind.
        // Detecting it here lets replayable cues reset in those cases too.
        if (this.disposed) return
        const isRewind = isSeeking || currentTime < this.lastTime

        for (const cue of this.timeCues) {
            if (cue.trigger.kind !== "time") continue

            const hasFired = this.firedCueIds.has(cue.id)
            const triggerTime = cue.trigger.at

            // If rewinding past a cue, allow replayable cues to fire again later.
            if (isRewind && currentTime < triggerTime) {
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
                    this.executeActions(cue)
                }
            }
        }

        this.lastTime = currentTime
    }

    /** Manually execute a cue by its ID, ignoring time checks. */
    executeCueById(id: string) {
        const cue = this.cueMap.get(id)
        if (cue) {
            this.executeActions(cue)
        }
    }

    /** Execute any cues matching the given trigger kind and value. */
    executeCueByTrigger(kind: string, value: string | number) {
        const triggerKey = `${kind}:${value}`
        const cues = this.triggerMap.get(triggerKey)
        if (cues) {
            for (const cue of cues) {
                this.executeActions(cue)
            }
        }
    }

    private stopSprite(id: string, fadeOutMs = 0) {
        if (fadeOutMs <= 0) {
            this.sounds?.stopSprite(id)
            return
        }
        this.sounds?.fadeSprite(id, 0, fadeOutMs)
        const timer = setTimeout(() => {
            this.stopTimers.delete(timer)
            if (!this.disposed) {
                try {
                    this.sounds?.stopSprite(id)
                } catch (error) {
                    this.reportStatus("cleanup-failed", undefined, String(error))
                }
            }
        }, fadeOutMs)
        this.stopTimers.set(timer, id)
    }

    private executeActions(cue: CueEvent) {
        if (this.disposed) return
        for (const action of cue.actions) {
            const report = (outcome: CueOutcomeEvent["outcome"], reason?: string) =>
                notifyCue(this.options.onOutcome, {
                    manifestId: this.manifest.id,
                    cueId: cue.id,
                    command: action.command,
                    pack: "pack" in action ? action.pack : undefined,
                    clip: "clip" in action ? action.clip : undefined,
                    outcome,
                    reason,
                })
            try {
                switch (action.command) {
                    case "sprite.play": {
                        const state = this.packStates.get(action.pack)
                        const clip =
                            this.manifest.assets?.spritePacks?.[action.pack]?.clips[action.clip]
                        if (!clip) {
                            report("skipped", "missing-asset")
                            break
                        }
                        if (state !== "ready") {
                            report("skipped", state === "loading" ? "pack-loading" : "pack-failed")
                            break
                        }
                        // Completion can be synchronous when a backend rejects a start.
                        // eslint-disable-next-line prefer-const
                        let id: string | null | undefined
                        id = this.sounds?.playSprite(action.clip, {
                            pack: this.scope ? action.pack : undefined,
                            loop: action.loop,
                            volume: action.volume,
                            onStarted: () => {
                                if (!this.disposed) report("started")
                            },
                            onEnded: () => {
                                if (!id) return
                                const key = JSON.stringify([action.pack, action.clip])
                                const remaining = (this.activeSprites.get(key) ?? []).filter(
                                    (active) => active !== id
                                )
                                if (remaining.length) this.activeSprites.set(key, remaining)
                                else this.activeSprites.delete(key)
                            },
                            onError: (reason) => {
                                if (!this.disposed) report("failed", reason)
                            },
                        })
                        if (id) {
                            const key = JSON.stringify([action.pack, action.clip])
                            if (!this.activeSprites.has(key)) this.activeSprites.set(key, [])
                            this.activeSprites.get(key)!.push(id)
                            if (action.fadeInMs && action.fadeInMs > 0) {
                                this.sounds!.fadeSprite(id, 0, 0)
                                this.sounds!.fadeSprite(
                                    id,
                                    action.volume ?? clip.volume ?? 1,
                                    action.fadeInMs
                                )
                            }
                            report("accepted")
                        } else
                            report(
                                "skipped",
                                this.sounds?.getLastSkipReason?.() ?? "playback-unavailable"
                            )
                        break
                    }
                    case "sprite.stop":
                        if (this.sounds) {
                            if (action.clip) {
                                const key = JSON.stringify([action.pack || "default", action.clip])
                                const ids = this.activeSprites.get(key)
                                if (ids) {
                                    for (const id of ids) {
                                        this.stopSprite(id, action.fadeOutMs)
                                    }
                                    this.activeSprites.delete(key)
                                }
                            } else {
                                for (const [key, ids] of this.activeSprites) {
                                    if (action.pack && JSON.parse(key)[0] !== action.pack) continue
                                    for (const id of ids) {
                                        this.stopSprite(id, action.fadeOutMs)
                                    }
                                    this.activeSprites.delete(key)
                                }
                            }
                        }
                        break
                    case "sprite.fade":
                        if (this.sounds) {
                            const key = JSON.stringify([action.pack || "default", action.clip])
                            const ids = this.activeSprites.get(key)
                            if (ids) {
                                for (const id of ids) {
                                    this.sounds.fadeSprite(id, action.volume, action.durationMs)
                                }
                            }
                        }
                        break
                    case "player.seek":
                        this.context.getEngine().seek(action.time)
                        break
                    case "player.pause":
                        this.context.getEngine().pause()
                        break
                    case "event.emit": {
                        const root = this.context.getRootElement() || window
                        root.dispatchEvent(
                            new CustomEvent(action.eventName, {
                                detail: action.detail,
                                bubbles: true,
                            })
                        )
                        break
                    }

                    // Narrative state actions - broadcast to UI layer
                    case "ambience.crossfade":
                    case "duck.set":
                    case "volume.fadeNarration":
                    case "layer.set":
                    case "spatial.pan": {
                        const target = this.context.getRootElement() || window
                        target.dispatchEvent(
                            new CustomEvent("sap-narrative-cue", {
                                detail: action, // Action itself is the payload now
                                bubbles: true,
                            })
                        )
                        break
                    }
                }
                if (action.command !== "sprite.play") report("executed")
            } catch (e) {
                report("failed", String(e))
                console.error("SAP Cues: Failed to execute cue action", action, e)
            }
        }
    }
}
