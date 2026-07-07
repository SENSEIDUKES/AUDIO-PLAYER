import { z } from "zod"
import type { CueManifest } from "./cueTypes"

const cueTriggerTimeSchema = z.object({
    kind: z.literal("time"),
    at: z.number(),
})

const cueTriggerStateSchema = z.object({
    kind: z.enum([
        "scene",
        "paragraph",
        "chapter",
        "metadata",
        "tension",
        "powerShift",
        "emotion",
        "relationshipShift",
        "danger",
        "element",
        "signature",
        "intensity",
    ]),
    value: z.union([z.string(), z.number()]),
})

const cueTriggerSchema = z.union([cueTriggerTimeSchema, cueTriggerStateSchema])

const cueActionSchema = z.discriminatedUnion("command", [
    z.object({
        command: z.literal("sprite.play"),
        pack: z.string(),
        clip: z.string(),
        loop: z.boolean().optional(),
        fadeInMs: z.number().optional(),
        volume: z.number().optional(),
    }),
    z.object({
        command: z.literal("sprite.stop"),
        pack: z.string().optional(),
        clip: z.string().optional(),
        fadeOutMs: z.number().optional(),
    }),
    z.object({
        command: z.literal("sprite.fade"),
        pack: z.string(),
        clip: z.string(),
        volume: z.number(),
        durationMs: z.number(),
    }),
    z.object({
        command: z.literal("ambience.crossfade"),
        profile: z.string(),
        durationMs: z.number().optional(),
    }),
    z.object({
        command: z.literal("duck.set"),
        amount: z.number(),
    }),
    z.object({
        command: z.literal("volume.fadeNarration"),
        volume: z.number(),
        durationMs: z.number(),
    }),
    z.object({
        command: z.literal("player.seek"),
        time: z.number(),
    }),
    z.object({
        command: z.literal("player.pause"),
    }),
    z.object({
        command: z.literal("event.emit"),
        eventName: z.string(),
        detail: z.unknown().optional(),
    }),
    z.object({
        command: z.literal("layer.set"),
        layer: z.string(),
        state: z.union([z.string(), z.number()]),
    }),
    z.object({
        command: z.literal("spatial.pan"),
        pack: z.string().optional(),
        clip: z.string().optional(),
        x: z.number(),
        y: z.number(),
        z: z.number(),
        durationMs: z.number().optional(),
    }),
])

const cueEventSchema = z.object({
    id: z.string().optional().transform(val => val || "cue-" + (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9))),
    trigger: cueTriggerSchema,
    actions: z.array(
        z.any().transform((val) => {
            const parsed = cueActionSchema.safeParse(val)
            if (!parsed.success) {
                console.warn("SAP Cues: Ignoring invalid action:", parsed.error)
                return null
            }
            return parsed.data
        })
    ).transform(actions => actions.filter((a): a is z.infer<typeof cueActionSchema> => a !== null)),
    replayable: z.boolean().optional(),
    fireOnSeek: z.boolean().optional(),
})

const audioSpriteClipSchema = z.object({
    offset: z.number(),
    duration: z.number(),
    volume: z.number().optional(),
    loop: z.boolean().optional(),
})

const audioSpriteManifestSchema = z.object({
    src: z.string(),
    clips: z.record(z.string(), audioSpriteClipSchema),
})

const cueManifestSchema = z.object({
    version: z.literal("sap-cues/1"),
    id: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    assets: z.object({
        spritePacks: z.record(z.string(), audioSpriteManifestSchema).optional(),
    }).optional(),
    cues: z.array(
        z.any().transform((val, _ctx) => {
            const parsed = cueEventSchema.safeParse(val)
            if (!parsed.success) {
                console.warn("SAP Cues: Ignoring invalid cue:", parsed.error)
                return null
            }
            return parsed.data
        })
    ).transform(cues => cues.filter(c => c !== null)),
})

export function validateCueManifest(json: unknown): CueManifest | null {
    try {
        const parsed = cueManifestSchema.safeParse(json)
        if (parsed.success) {
            // Because we used .transform and .filter, the output type is actually slightly relaxed from Zod,
            // but we can cast it to the static type securely.
            return parsed.data as CueManifest
        }
        console.warn("SAP Cues: Manifest validation failed entirely.", parsed.error)
        return null
    } catch (e) {
        console.error("SAP Cues: Validation threw an exception", e)
        return null
    }
}
