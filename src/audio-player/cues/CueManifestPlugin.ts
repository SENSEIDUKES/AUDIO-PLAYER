import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
    PluginHookResult,
} from "../core/plugins/PluginInterface"
import type { ReaderMixer } from "../narrative/ReaderMixer"
import type { Track } from "../types"
import { CueRuntime, notifyCue, resolveCueEventTarget, type CueRuntimeOptions } from "./cueRuntime"
import {
    formatCueManifestIssue,
    parseCueManifest,
    type CueManifestParseResult,
} from "./cueManifestSchema"

/** How often the playback clock samples the live position while playing. */
const CLOCK_INTERVAL_MS = 100
/** How far past its remembered start the live position may be and still count as that start. */
const START_GRACE_SECONDS = 1

export class CueManifestPlugin implements AudioPlayerPlugin {
    name = "cueManifest"

    private context: PluginPlayerContext | null = null
    private runtime: CueRuntime | null = null
    private abortController: AbortController | null = null

    private generation = 0
    private target: EventTarget | null = null
    private playing = false
    private clock: ReturnType<typeof setInterval> | null = null
    /** Where the next play window begins: track start, pause position, or last seek target. */
    private resumeFrom: number | null = 0

    constructor(private options: CueRuntimeOptions = {}) {}

    /** Bind one exact event target; reinitialization retires the previous context first. */
    init(context: PluginPlayerContext) {
        this.destroy()
        this.context = context
        const target = resolveCueEventTarget(context)
        this.target = target
        target.addEventListener("sap-dispatch-cue", this.handleDispatchCue as EventListener)
        this.playing = this.readIsPlaying()
    }

    /** Remove the original listener and release the runtime regardless of session cleanup order. */
    destroy() {
        this.target?.removeEventListener(
            "sap-dispatch-cue",
            this.handleDispatchCue as EventListener
        )
        this.target = null
        this.stopClock()
        this.playing = false
        try {
            this.cleanup()
        } finally {
            this.context = null
        }
    }

    private handleDispatchCue = (e: CustomEvent) => {
        if (!this.runtime || !e.detail) return
        if (e.detail.id) this.runtime.executeCueById(e.detail.id)
        else if (e.detail.kind && e.detail.value !== undefined)
            this.runtime.executeCueByTrigger(e.detail.kind, e.detail.value)
    }

    /** Invalidate asynchronous work before best-effort cleanup so replacement can always continue. */
    private cleanup() {
        ++this.generation
        this.stopClock()
        const abort = this.abortController
        const runtime = this.runtime
        this.abortController = null
        this.runtime = null
        for (const cleanup of [() => abort?.abort(), () => runtime?.dispose()]) {
            try {
                cleanup()
            } catch (error) {
                notifyCue(this.options.onStatus, {
                    status: "cleanup-failed",
                    message: String(error),
                })
            }
        }
    }

    // ===================== PLAYBACK CLOCK =====================
    // Cues are timed from the live backend position, sampled on an interval, not from the
    // rAF-driven `onTimeUpdate` state: animation frames stop in hidden tabs, which would
    // delay or drop cues while audio keeps playing. A sample after a long gap catches up
    // (see CueRuntime policy), and returning to the page samples immediately.

    private readIsPlaying(): boolean {
        return this.context?.getEngine().isPlaying === true
    }

    private readPosition(fallback?: number): number | undefined {
        const context = this.context
        if (!context) return fallback
        const live = context.getPlaybackPosition?.() ?? context.getAudioElement()?.currentTime
        return typeof live === "number" && Number.isFinite(live) ? live : fallback
    }

    /** True while a seek has been requested but the live position has not caught up. */
    private isSeekPending(): boolean {
        const context = this.context
        return context?.getEngine().isSeeking === true || !!context?.getAudioElement()?.seeking
    }

    private poll(fallback?: number) {
        if (!this.runtime || !this.playing || this.isSeekPending()) return
        const position = this.readPosition(fallback)
        if (position !== undefined) this.runtime.handleTimeUpdate(position)
    }

    private handleVisibility = () => {
        if (typeof document === "undefined" || document.visibilityState === "visible") this.poll()
    }

    private startClock() {
        if (this.clock !== null) return
        this.clock = setInterval(() => this.poll(), CLOCK_INTERVAL_MS)
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.handleVisibility)
        }
    }

    private stopClock() {
        if (this.clock !== null) clearInterval(this.clock)
        this.clock = null
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.handleVisibility)
        }
    }

    /**
     * Where a play window starts. `onPlay` runs from a React effect after audio has
     * already begun, so the live sample can be slightly past the true start (0.02 s into the
     * track); starting the window there would skip a cue at 0:00. Prefer the remembered
     * start (track start, pause position, seek target) when the live position is just past
     * it, and the live position otherwise (e.g. a restored position).
     */
    private startPosition(): number | undefined {
        const live = this.readPosition()
        const from = this.resumeFrom
        this.resumeFrom = null
        if (from === null) return live
        if (live === undefined) return from
        return live >= from && live - from <= START_GRACE_SECONDS ? from : live
    }

    /** Hand a freshly installed runtime the player's current state. */
    private activate(runtime: CueRuntime) {
        this.runtime = runtime
        if (this.playing) {
            runtime.setPlaying(true, this.startPosition())
            this.startClock()
            this.poll() // catch up from the start position to the live one
        } else {
            runtime.setPlaying(false)
        }
    }

    /** Report validation to the host and return the manifest when it is usable. */
    private admit(data: unknown): { result: CueManifestParseResult; ok: boolean } {
        const result = parseCueManifest(data)
        const rawId = (data as { id?: unknown } | null)?.id
        const id = result.manifest?.id ?? (typeof rawId === "string" ? rawId : undefined)
        if (result.status === "invalid") {
            const errors = result.issues.filter((issue) => issue.severity === "error")
            notifyCue(this.options.onStatus, {
                manifestId: id,
                status: "failed",
                message: `Invalid cue manifest: ${errors.length} error(s)${errors[0] ? `; first: ${formatCueManifestIssue(errors[0])}` : ""}`,
                issues: result.issues,
            })
            return { result, ok: false }
        }
        if (result.status === "accepted-with-omissions") {
            notifyCue(this.options.onStatus, {
                manifestId: id,
                status: "accepted-with-omissions",
                message: `${result.omittedCueCount} cue(s) and ${result.omittedActionCount} action(s) omitted`,
                issues: result.issues,
            })
        }
        return { result, ok: true }
    }

    private install(data: unknown) {
        if (!this.context) return
        const { result, ok } = this.admit(data)
        if (!ok || !result.manifest) return
        this.activate(
            new CueRuntime(this.context, result.manifest, {
                ...this.options,
                validationIssues: result.issues,
            })
        )
    }

    /** Install the newest inline or fetched manifest; superseded fetch completions are ignored. */
    onTrackLoad(track: Track | null): PluginHookResult {
        this.cleanup()
        this.resumeFrom = 0
        if (!track || !this.context) return
        const generation = this.generation
        if (this.readIsPlaying()) this.playing = true

        if (track.cueManifest) {
            this.install(track.cueManifest)
        } else if (track.cueManifestUrl) {
            this.abortController = new AbortController()
            fetch(track.cueManifestUrl, { signal: this.abortController.signal })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(
                            `Failed to fetch cue manifest: ${res.status} ${res.statusText}`
                        )
                    }
                    return res.json()
                })
                .then((data) => {
                    if (generation !== this.generation || !this.context) return
                    this.install(data)
                })
                .catch((e) => {
                    if (generation === this.generation && e.name !== "AbortError") {
                        notifyCue(this.options.onStatus, { status: "failed", message: String(e) })
                    }
                })
        }
    }

    /** Start (or resume) the play window at the live position; cues at that moment fire now. */
    onPlay(): PluginHookResult {
        this.playing = true
        if (!this.runtime) return
        this.runtime.setPlaying(true, this.startPosition())
        this.startClock()
        this.poll() // catch up from the start position to the live one
    }

    /** Catch up to the pause position, then stop timing: nothing fires while paused. */
    onPause(): PluginHookResult {
        this.poll()
        this.resumeFrom = this.readPosition() ?? this.resumeFrom
        this.playing = false
        this.runtime?.setPlaying(false)
        this.stopClock()
    }

    /** Nudge the clock; the live position, not the throttled argument, is authoritative. */
    onTimeUpdate(position: number): PluginHookResult {
        this.poll(position)
    }

    onSeek(position: number): PluginHookResult {
        this.resumeFrom = position
        this.runtime?.handleTimeUpdate(position, true)
    }

    /** Fire any cues up to the end of the track, then stop timing. Never claims the advance. */
    onTrackEnded(): PluginHookResult {
        const engine = this.context?.getEngine()
        const duration = engine?.duration
        const end =
            typeof duration === "number" && Number.isFinite(duration) && duration > 0
                ? duration
                : this.readPosition()
        if (end !== undefined) this.runtime?.handleTrackEnd(end)
        this.playing = false
        this.resumeFrom = null
        this.stopClock()
        return false
    }

    onStop(): PluginHookResult {
        this.cleanup()
    }
}

export function createCueManifestPlugin(options: CueRuntimeOptions = {}): CueManifestPlugin {
    return new CueManifestPlugin(options)
}

/** Opt-in story sprites governed by the supplied mixer; the host still owns it. */
export function createReaderMixerCuePlugin(
    mixer: ReaderMixer,
    options: CueRuntimeOptions = {}
): CueManifestPlugin {
    const plugin = new CueManifestPlugin(options)
    const init = plugin.init.bind(plugin)
    plugin.init = (context) =>
        init({
            ...context,
            sounds: {
                createScope: () => mixer.createCueSoundScope(),
                loadSpritePack: async () => {
                    throw new Error("Acquire a cue scope first")
                },
                playSprite: () => null,
                stopSprite: () => {},
                fadeSprite: () => {},
                stopAllSprites: () => {},
            },
        })
    return plugin
}
