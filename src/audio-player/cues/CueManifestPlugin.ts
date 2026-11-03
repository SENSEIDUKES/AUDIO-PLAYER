import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
    PluginHookResult,
} from "../core/plugins/PluginInterface"
import type { ReaderMixer } from "../narrative/ReaderMixer"
import type { Track } from "../types"
import { CueRuntime, notifyCue, type CueRuntimeOptions } from "./cueRuntime"
import { validateCueManifest } from "./cueManifestSchema"

export class CueManifestPlugin implements AudioPlayerPlugin {
    name = "cueManifest"

    private context: PluginPlayerContext | null = null
    private runtime: CueRuntime | null = null
    private abortController: AbortController | null = null

    private generation = 0
    private target: EventTarget | null = null

    constructor(private options: CueRuntimeOptions = {}) {}

    init(context: PluginPlayerContext) {
        this.destroy()
        this.context = context
        const target = this.context.getRootElement() || window
        this.target = target
        target.addEventListener("sap-dispatch-cue", this.handleDispatchCue as EventListener)
    }

    destroy() {
        this.target?.removeEventListener(
            "sap-dispatch-cue",
            this.handleDispatchCue as EventListener
        )
        this.target = null
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

    private cleanup() {
        ++this.generation
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

    onTrackLoad(track: Track | null): PluginHookResult {
        this.cleanup()
        if (!track || !this.context) return
        const generation = this.generation

        if (track.cueManifest) {
            const manifest = validateCueManifest(track.cueManifest)
            if (manifest) {
                this.runtime = new CueRuntime(this.context, manifest, this.options)
            } else
                notifyCue(this.options.onStatus, {
                    status: "failed",
                    message: "Invalid cue manifest",
                })
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
                    if (generation !== this.generation) return
                    const manifest = validateCueManifest(data)
                    if (manifest && this.context && generation === this.generation) {
                        this.runtime = new CueRuntime(this.context, manifest, this.options)
                    } else if (!manifest)
                        notifyCue(this.options.onStatus, {
                            status: "failed",
                            message: "Invalid cue manifest",
                        })
                })
                .catch((e) => {
                    if (generation === this.generation && e.name !== "AbortError") {
                        notifyCue(this.options.onStatus, { status: "failed", message: String(e) })
                    }
                })
        }
    }

    onTimeUpdate(position: number): PluginHookResult {
        if (this.runtime && this.context) {
            this.runtime.handleTimeUpdate(position, false)
        }
    }

    onSeek(position: number): PluginHookResult {
        if (this.runtime) {
            this.runtime.handleTimeUpdate(position, true)
        }
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
