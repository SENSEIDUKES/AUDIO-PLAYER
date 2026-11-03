import type { CueAction, CueManifest } from "./cueTypes"

/**
 * Who makes a cue action audible:
 * - `runtime`: the cue plugin applies it to the player or the sound layer itself.
 * - `controller`: the runtime broadcasts it and `useNarrativeCueController` applies it,
 *   provided the host renders the controller's `narrativeOptions` with `useNarrativeAudio`
 *   (or `NarrativeFace`).
 * - `host`: nothing bundled applies it; it only takes effect if the host handles
 *   `sap-narrative-cue` itself and calls `event.preventDefault()` to claim it.
 */
export type CueActionHandler = "runtime" | "controller" | "host"

export interface CueActionSupport {
    handledBy: CueActionHandler
    /** True when every field of the action is honored by `handledBy`. */
    complete: boolean
    summary: string
    /** Fields that are accepted but not applied by the bundled handler. */
    ignoredFields?: readonly string[]
}

export const CUE_ACTION_SUPPORT: Readonly<Record<CueAction["command"], CueActionSupport>> = {
    "sprite.play": {
        handledBy: "runtime",
        complete: true,
        summary: "Plays a clip from a loaded pack, including loop, volume and fadeInMs.",
    },
    "sprite.stop": {
        handledBy: "runtime",
        complete: true,
        summary: "Stops matching clips, with an optional fadeOutMs.",
    },
    "sprite.fade": {
        handledBy: "runtime",
        complete: true,
        summary: "Fades active instances of a clip to a volume.",
    },
    "player.seek": {
        handledBy: "runtime",
        complete: true,
        summary: "Seeks the session player.",
    },
    "player.pause": {
        handledBy: "runtime",
        complete: true,
        summary: "Pauses the session player.",
    },
    "event.emit": {
        handledBy: "runtime",
        complete: true,
        summary: "Dispatches a DOM event on the session's cue event target for the host.",
    },
    "ambience.crossfade": {
        handledBy: "controller",
        complete: true,
        summary:
            "Controller sets ambientProfile and crossfadeMs (durationMs) for useNarrativeAudio.",
    },
    "duck.set": {
        handledBy: "controller",
        complete: true,
        summary: "Controller sets duckAmount for useNarrativeAudio.",
    },
    "volume.fadeNarration": {
        handledBy: "controller",
        complete: true,
        summary:
            "Controller ramps narrationVolume over durationMs; useNarrativeAudio applies it to the session.",
    },
    "layer.set": {
        handledBy: "controller",
        complete: false,
        summary:
            'Controller maps layer "intensity" (number) and "mood"/"scene" to narrative options and exposes every layer in `layers`; other layers need host UI.',
    },
    "spatial.pan": {
        handledBy: "host",
        complete: false,
        summary:
            "Not supported yet: neither the sprite layer nor the session exposes panning. A host must handle it.",
        ignoredFields: ["x", "y", "z", "durationMs", "pack", "clip"],
    },
}

export interface CueManifestSupportReport {
    /** Actions used by the manifest, grouped by who applies them. */
    byHandler: Record<CueActionHandler, CueAction["command"][]>
    /** Commands whose fields are only partly applied or that need host work. */
    needsAttention: {
        command: CueAction["command"]
        handledBy: CueActionHandler
        summary: string
    }[]
}

/** Summarize which of a manifest's actions need the controller or host integration. */
export function describeCueManifestSupport(manifest: CueManifest): CueManifestSupportReport {
    const used = new Set<CueAction["command"]>()
    for (const cue of manifest.cues) for (const action of cue.actions) used.add(action.command)
    const byHandler: CueManifestSupportReport["byHandler"] = {
        runtime: [],
        controller: [],
        host: [],
    }
    const needsAttention: CueManifestSupportReport["needsAttention"] = []
    for (const command of used) {
        const support = CUE_ACTION_SUPPORT[command]
        byHandler[support.handledBy].push(command)
        if (support.handledBy !== "runtime" || !support.complete) {
            needsAttention.push({
                command,
                handledBy: support.handledBy,
                summary: support.summary,
            })
        }
    }
    return { byHandler, needsAttention }
}
