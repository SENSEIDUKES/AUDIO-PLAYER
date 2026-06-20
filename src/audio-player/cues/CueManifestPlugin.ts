import type { AudioPlayerPlugin, PluginPlayerContext, PluginHookResult } from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import { CueRuntime } from "./cueRuntime"
import { validateCueManifest } from "./cueManifestSchema"

export class CueManifestPlugin implements AudioPlayerPlugin {
    name = "cueManifest"
    
    private context: PluginPlayerContext | null = null
    private runtime: CueRuntime | null = null
    private abortController: AbortController | null = null

    init(context: PluginPlayerContext) {
        this.context = context
        this.handleDispatchCue = this.handleDispatchCue.bind(this)
        const target = this.context.getRootElement() || window
        target.addEventListener("sap-dispatch-cue", this.handleDispatchCue as EventListener)
    }

    destroy() {
        if (this.context) {
            const target = this.context.getRootElement() || window
            target.removeEventListener("sap-dispatch-cue", this.handleDispatchCue as EventListener)
        }
        this.cleanup()
        this.context = null
    }

    private handleDispatchCue(e: CustomEvent) {
        if (!this.runtime) return
        
        const detail = e.detail
        if (!detail) return

        if (detail.id) {
            this.runtime.executeCueById(detail.id)
        } else if (detail.kind && detail.value !== undefined) {
            this.runtime.executeCueByTrigger(detail.kind, detail.value)
        }
    }

    private cleanup() {
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
        if (this.runtime) {
            this.runtime.reset()
            this.runtime = null
        }
    }

    onTrackLoad(track: Track | null): PluginHookResult {
        this.cleanup()
        if (!track || !this.context) return
        
        if (track.cueManifest) {
            const manifest = validateCueManifest(track.cueManifest)
            if (manifest) {
                this.runtime = new CueRuntime(this.context, manifest)
            }
        } else if (track.cueManifestUrl) {
            this.abortController = new AbortController()
            fetch(track.cueManifestUrl, { signal: this.abortController.signal })
                .then(res => res.json())
                .then(data => {
                    const manifest = validateCueManifest(data)
                    if (manifest && this.context) {
                        this.runtime = new CueRuntime(this.context, manifest)
                    }
                })
                .catch(e => {
                    if (e.name !== 'AbortError') {
                        console.warn("Failed to fetch cue manifest from URL:", e)
                    }
                })
        }
    }

    onTimeUpdate(position: number): PluginHookResult {
        if (this.runtime && this.context) {
            this.runtime.handleTimeUpdate(position)
        }
    }

    onSeek(position: number): PluginHookResult {
        if (this.runtime) {
            this.runtime.handleTimeUpdate(position)
        }
    }

    onStop(): PluginHookResult {
        this.cleanup()
    }
}

export function createCueManifestPlugin(): CueManifestPlugin {
    return new CueManifestPlugin()
}
