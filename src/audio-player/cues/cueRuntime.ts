import type {
    PluginSoundLayer,
    PluginSoundScope,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { CueManifest, CueEvent, CueAction } from "./cueTypes"
import type { CueManifestIssue } from "./cueManifestSchema"

export type CuePackState = "loading" | "ready" | "failed"
export interface CueStatusEvent {
    manifestId?: string
    /**
     * `accepted-with-omissions` is reported just before `installed` when validation dropped
     * cues or actions; `failed` with `issues` means the manifest was rejected outright.
     */
    status:
        "installed" | "accepted-with-omissions" | "loading" | "ready" | "failed" | "cleanup-failed"
    pack?: string
    message?: string
    /** Validation findings (errors and warnings) behind this status. */
    issues?: CueManifestIssue[]
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
    /** Maximum referenced packs admitted per manifest. Defaults to 4; invalid values use 4. */
    maxSpritePacks?: number
    /**
     * How late (seconds) a time cue may fire before its `sprite.play` actions are skipped
     * with reason `late`. Delayed updates (e.g. a backgrounded page) still apply state
     * changes in order, but a one-shot sound that is long overdue is not played.
     * Defaults to 2; use `Infinity` to never skip. Invalid values use the default.
     */
    lateCueToleranceSeconds?: number
    /** Validation findings to attach to the `installed` status. Set by the cue plugin. */
    validationIssues?: CueManifestIssue[]
    onStatus?: (event: CueStatusEvent) => void
    onOutcome?: (event: CueOutcomeEvent) => void
}

export const DEFAULT_LATE_CUE_TOLERANCE_SECONDS = 2
/** Backward position jitter below this is decoder noise, not a rewind. */
const REWIND_EPSILON_SECONDS = 0.1

/**
 * Where cue events (`event.emit`, `sap-narrative-cue`, `sap-dispatch-cue`) travel.
 * A session-scoped target wins so two players never hear each other; the root element
 * and finally `window` remain the fallback for standalone and legacy hosts.
 */
export function resolveCueEventTarget(context: PluginPlayerContext): EventTarget {
    return context.getEventTarget?.() ?? context.getRootElement() ?? window
}

/** Observer failures must never prevent a cue or a replacement runtime. */
export function notifyCue<T>(callback: ((event: T) => void) | undefined, event: T): void {
    try {
        callback?.(event)
    } catch (error) {
        console.warn("SAP Cues: observer failed", error)
    }
}

/**
 * Runs one manifest against a player.
 *
 * Time-cue playback policy (see docs/CUE_MANIFEST_V1.md):
 * - **Playing only.** Position updates are ignored while paused, so a cue at 0:00 never
 *   fires on a paused player; `setPlaying(true, position)` is the start of a play window.
 * - **Start / resume.** Cues before the starting position are treated as already passed;
 *   a cue exactly at the starting position fires immediately.
 * - **Forward playback.** Each update fires the unfired cues in `[previous, current]`,
 *   in time order, once. A delayed update (backgrounded page) therefore catches up
 *   instead of dropping cues, subject to `lateCueToleranceSeconds` for sprites.
 * - **Seek.** Cues behind the target are consumed without firing unless `fireOnSeek`.
 *   While paused, `fireOnSeek` cues wait and fire when playback resumes. Replayable cues
 *   at or after the target re-arm.
 * - **Rewind** (position jumps backward without a seek, e.g. a loop) re-arms replayable
 *   cues at or after the new position; non-replayable cues never repeat.
 * - **Track end.** Callers flush the final position; `dispose()` retires the runtime.
 */
export class CueRuntime {
    private context: PluginPlayerContext
    private firedCues = new Set<CueEvent>()
    private timeCues: CueEvent[]
    private cueMap = new Map<string, CueEvent>()
    private triggerMap = new Map<string, CueEvent[]>()
    private lastTime: number | null = null
    private playing = true
    private deferredSeekCues: CueEvent[] = []
    /** Bumped by every seek so a sample can tell that one of its own cues moved playback. */
    private seekEpoch = 0
    private lateToleranceSeconds: number
    private activeSprites = new Map<string, string[]>()

    private sounds: PluginSoundLayer | undefined
    private scope: PluginSoundScope | undefined
    private disposed = false
    private stopTimers = new Map<ReturnType<typeof setTimeout>, string>()
    private packStates = new Map<string, CuePackState>()

    /** Index cues and admit a bounded set of exact named packs for this manifest lifetime. */
    constructor(
        context: PluginPlayerContext,
        private manifest: CueManifest,
        private options: CueRuntimeOptions = {}
    ) {
        this.context = context
        const tolerance = options.lateCueToleranceSeconds
        this.lateToleranceSeconds =
            typeof tolerance === "number" && tolerance >= 0 && !Number.isNaN(tolerance)
                ? tolerance
                : DEFAULT_LATE_CUE_TOLERANCE_SECONDS

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
            // The first cue with an id wins, matching manifest validation.
            if (cue.id && !this.cueMap.has(cue.id)) {
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
        notifyCue(this.options.onStatus, {
            manifestId: this.manifest.id,
            status: "installed",
            issues: options.validationIssues?.length ? options.validationIssues : undefined,
        })
        const packs = manifest.assets?.spritePacks ?? {}
        const referenced = new Set(
            manifest.cues.flatMap((cue) =>
                cue.actions.flatMap((action) =>
                    action.command === "sprite.play" ? [action.pack] : []
                )
            )
        )
        const packLimit =
            Number.isSafeInteger(options.maxSpritePacks) && options.maxSpritePacks! > 0
                ? options.maxSpritePacks!
                : 4
        let admitted = 0
        for (const name of referenced) {
            if (admitted >= packLimit) {
                this.packStates.set(name, "failed")
                this.reportStatus("failed", name, `Sprite pack limit exceeded (${packLimit})`)
                continue
            }
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
            ++admitted
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

    /** Publish readiness and cleanup diagnostics without letting host observers interrupt the runtime. */
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

    /** Stop tracked and fading sprites and reset timeline eligibility while keeping loaded packs. */
    reset() {
        const fading = [...this.stopTimers.values()]
        for (const timer of this.stopTimers.keys()) clearTimeout(timer)
        this.stopTimers.clear()
        this.firedCues.clear()
        this.deferredSeekCues = []
        this.lastTime = null
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

    /** Time cues are always `trigger.kind === "time"`; narrow once. */
    private cueTime(cue: CueEvent): number {
        return cue.trigger.kind === "time" ? cue.trigger.at : Number.NaN
    }

    /** Make replayable cues at or after `position` eligible to fire again. */
    private rearmFrom(position: number) {
        for (const cue of this.timeCues) {
            if (cue.replayable && this.cueTime(cue) >= position) this.firedCues.delete(cue)
        }
    }

    private fireTimeCue(cue: CueEvent, position: number) {
        this.firedCues.add(cue)
        this.executeActions(cue, Math.max(0, position - this.cueTime(cue)))
    }

    /**
     * Tell the runtime whether the player is playing. Position updates are ignored while
     * paused. Resuming at `position` starts a fresh window there: earlier cues count as
     * passed, cues exactly at `position` fire now, and `fireOnSeek` cues deferred by a
     * paused seek fire first. Direct users that never call this are treated as playing.
     */
    setPlaying(playing: boolean, position?: number) {
        if (this.disposed) return
        if (!playing) {
            this.playing = false
            return
        }
        this.playing = true
        if (position === undefined || !Number.isFinite(position)) return
        // Resuming behind where we stopped (loop / repeat-one restart) is a rewind.
        if (this.lastTime !== null && position < this.lastTime - REWIND_EPSILON_SECONDS) {
            this.rearmFrom(position)
        }
        this.lastTime = position
        const deferred = this.deferredSeekCues
        this.deferredSeekCues = []
        for (const cue of deferred) this.fireTimeCue(cue, position)
        this.advance(position)
    }

    /**
     * Report the playback position. `isSeeking` marks an explicit seek; otherwise this is
     * a continuous-playback sample (see the class policy for start/pause/seek/rewind).
     */
    handleTimeUpdate(currentTime: number, isSeeking = false) {
        if (this.disposed || !Number.isFinite(currentTime)) return
        if (isSeeking) this.handleSeek(currentTime)
        else this.advance(currentTime)
    }

    /**
     * The track finished at `position`: fire every remaining cue up to it (even if the
     * player already reported paused), then stop timing. Later cues never fire.
     */
    handleTrackEnd(position: number) {
        if (this.disposed || !Number.isFinite(position)) return
        this.playing = true
        this.advance(position)
        this.playing = false
    }

    private advance(currentTime: number) {
        if (!this.playing) return
        const previous = this.lastTime
        // A backward jump without an explicit seek (loop, custom rewind) is a rewind.
        if (previous !== null && currentTime < previous - REWIND_EPSILON_SECONDS) {
            this.rearmFrom(currentTime)
            this.lastTime = currentTime
        } else if (previous !== null && currentTime < previous) {
            return // decoder jitter
        } else {
            this.lastTime = currentTime
        }
        const from = previous === null || currentTime < previous ? currentTime : previous
        for (const cue of this.timeCues) {
            const at = this.cueTime(cue)
            if (at > currentTime) break
            if (at >= from && !this.firedCues.has(cue)) {
                const epoch = this.seekEpoch
                this.fireTimeCue(cue, currentTime)
                // A cue's player.seek made the rest of this sample stale; the next sample
                // continues from the seek target with replayable cues re-armed.
                if (epoch !== this.seekEpoch) break
            }
        }
    }

    private handleSeek(target: number) {
        ++this.seekEpoch
        // A newer seek supersedes cues an earlier paused seek was holding back.
        for (const cue of this.deferredSeekCues) this.firedCues.delete(cue)
        this.deferredSeekCues = []
        this.lastTime = target
        this.rearmFrom(target)
        for (const cue of this.timeCues) {
            if (this.cueTime(cue) > target) break
            if (this.firedCues.has(cue)) continue
            if (!cue.fireOnSeek) {
                this.firedCues.add(cue)
            } else if (this.playing) {
                this.fireTimeCue(cue, target)
            } else {
                this.firedCues.add(cue)
                this.deferredSeekCues.push(cue)
            }
        }
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

    /** Stop immediately or schedule a fade stop owned and cancelled by this runtime. */
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

    /**
     * Run independent actions, reporting unavailable sprites immediately without queuing
     * late playback. `lateBySeconds` is how far past its trigger a time cue fired.
     */
    private executeActions(cue: CueEvent, lateBySeconds = 0) {
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
                        if (lateBySeconds > this.lateToleranceSeconds) {
                            report("skipped", "late")
                            break
                        }
                        const fadeInMs =
                            action.fadeInMs && action.fadeInMs > 0 ? action.fadeInMs : 0
                        // Completion can be synchronous when a backend rejects a start.
                        // eslint-disable-next-line prefer-const
                        let id: string | null | undefined
                        let startFailed = false
                        id = this.sounds?.playSprite(action.clip, {
                            pack: this.scope ? action.pack : undefined,
                            loop: action.loop,
                            // A fade-in ramps up from silence rather than from the clip level.
                            volume: fadeInMs ? 0 : action.volume,
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
                                startFailed = true
                                if (!this.disposed) report("failed", reason)
                            },
                        })
                        if (id) {
                            const key = JSON.stringify([action.pack, action.clip])
                            if (!this.activeSprites.has(key)) this.activeSprites.set(key, [])
                            this.activeSprites.get(key)!.push(id)
                            if (fadeInMs) {
                                this.sounds!.fadeSprite(
                                    id,
                                    action.volume ?? clip.volume ?? 1,
                                    fadeInMs
                                )
                            }
                            report("accepted")
                        } else if (!startFailed)
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
                        resolveCueEventTarget(this.context).dispatchEvent(
                            new CustomEvent(action.eventName, {
                                detail: action.detail,
                                bubbles: true,
                            })
                        )
                        break
                    }

                    // Narrative state actions are applied by a handler on the UI layer
                    // (see CUE_ACTION_SUPPORT). A handler claims one with preventDefault();
                    // an unclaimed action is reported as skipped rather than "executed".
                    case "ambience.crossfade":
                    case "duck.set":
                    case "volume.fadeNarration":
                    case "layer.set":
                    case "spatial.pan": {
                        const handled = !resolveCueEventTarget(this.context).dispatchEvent(
                            new CustomEvent("sap-narrative-cue", {
                                detail: action,
                                bubbles: true,
                                cancelable: true,
                            })
                        )
                        if (handled) report("executed")
                        else report("skipped", "no-host-handler")
                        continue
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
