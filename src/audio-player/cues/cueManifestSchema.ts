import { z } from "zod"
import type { CueAction, CueEvent, CueManifest } from "./cueTypes"

const nonNegative = z.number().min(0)
const unit = z.number().min(0).max(1)

const cueTriggerTimeSchema = z.object({
    kind: z.literal("time"),
    at: nonNegative,
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

const actionSchemas = {
    "sprite.play": z.object({
        command: z.literal("sprite.play"),
        pack: z.string().min(1),
        clip: z.string().min(1),
        loop: z.boolean().optional(),
        fadeInMs: nonNegative.optional(),
        volume: nonNegative.optional(),
    }),
    "sprite.stop": z.object({
        command: z.literal("sprite.stop"),
        pack: z.string().optional(),
        clip: z.string().optional(),
        fadeOutMs: nonNegative.optional(),
    }),
    "sprite.fade": z.object({
        command: z.literal("sprite.fade"),
        pack: z.string().min(1),
        clip: z.string().min(1),
        volume: nonNegative,
        durationMs: nonNegative,
    }),
    "ambience.crossfade": z.object({
        command: z.literal("ambience.crossfade"),
        profile: z.string().min(1),
        durationMs: nonNegative.optional(),
    }),
    "duck.set": z.object({
        command: z.literal("duck.set"),
        amount: unit,
    }),
    "volume.fadeNarration": z.object({
        command: z.literal("volume.fadeNarration"),
        volume: unit,
        durationMs: nonNegative,
    }),
    "player.seek": z.object({
        command: z.literal("player.seek"),
        time: nonNegative,
    }),
    "player.pause": z.object({
        command: z.literal("player.pause"),
    }),
    "event.emit": z.object({
        command: z.literal("event.emit"),
        eventName: z.string().min(1),
        detail: z.unknown().optional(),
    }),
    "layer.set": z.object({
        command: z.literal("layer.set"),
        layer: z.string().min(1),
        state: z.union([z.string(), z.number()]),
    }),
    "spatial.pan": z.object({
        command: z.literal("spatial.pan"),
        pack: z.string().optional(),
        clip: z.string().optional(),
        x: z.number(),
        y: z.number(),
        z: z.number(),
        durationMs: nonNegative.optional(),
    }),
} satisfies Record<CueAction["command"], z.ZodType>

const KNOWN_COMMANDS = Object.keys(actionSchemas) as CueAction["command"][]

function generateSecureId(): string {
    if (typeof crypto !== "undefined") {
        if (typeof crypto.randomUUID === "function") {
            return crypto.randomUUID()
        }
        if (typeof crypto.getRandomValues === "function") {
            const buffer = new Uint8Array(4)
            crypto.getRandomValues(buffer)
            return Array.from(buffer)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
        }
    }
    return Math.random().toString(36).slice(2, 9)
}

const cueShellSchema = z.object({
    id: z.string().optional(),
    trigger: cueTriggerSchema,
    actions: z.array(z.unknown()),
    replayable: z.boolean().optional(),
    fireOnSeek: z.boolean().optional(),
})

const audioSpriteClipSchema = z.object({
    offset: nonNegative,
    duration: z.number().positive(),
    volume: nonNegative.optional(),
    loop: z.boolean().optional(),
})

const audioSpriteManifestSchema = z.object({
    src: z.string(),
    clips: z.record(z.string(), audioSpriteClipSchema),
})

const manifestEnvelopeSchema = z.object({
    version: z.literal("sap-cues/1"),
    id: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    assets: z
        .object({
            spritePacks: z.record(z.string(), audioSpriteManifestSchema).optional(),
        })
        .optional(),
    cues: z.array(z.unknown()),
})

export type CueManifestIssueCode =
    | "invalid-manifest"
    | "invalid-cue"
    | "invalid-action"
    | "unknown-command"
    | "duplicate-cue-id"
    | "cue-no-valid-actions"
    | "cue-no-actions"
    | "missing-asset"
    | "empty-manifest"

/** One actionable validation finding, located by cue and field. */
export interface CueManifestIssue {
    /** Errors cause the cue/action (or the whole manifest) to be omitted; warnings keep it. */
    severity: "error" | "warning"
    code: CueManifestIssueCode
    /** JSON-path style location, e.g. `cues[2].actions[0].profile`. */
    path: string
    message: string
    cueIndex?: number
    /** The cue's explicit id, when it has one. */
    cueId?: string
    actionIndex?: number
    command?: string
    /** The offending field inside the cue, trigger or action. */
    field?: string
}

/**
 * - `valid`: every cue and action was accepted (warnings may still be listed).
 * - `accepted-with-omissions`: a manifest was produced, but some cues or actions were
 *   dropped; `issues` says which and why.
 * - `invalid`: nothing usable; `manifest` is null.
 */
export type CueManifestParseStatus = "valid" | "accepted-with-omissions" | "invalid"

export type CueManifestParseResult =
    | {
          status: "valid" | "accepted-with-omissions"
          manifest: CueManifest
          issues: CueManifestIssue[]
          omittedCueCount: number
          omittedActionCount: number
      }
    | {
          status: "invalid"
          manifest: null
          issues: CueManifestIssue[]
          omittedCueCount: number
          omittedActionCount: number
      }

function joinPath(base: string, segments: readonly PropertyKey[]): string {
    let path = base
    for (const segment of segments) {
        path +=
            typeof segment === "number" ? `[${segment}]` : `${path ? "." : ""}${String(segment)}`
    }
    return path
}

function valueAt(root: unknown, segments: readonly PropertyKey[]): unknown {
    let current = root
    for (const segment of segments) {
        if (current === null || typeof current !== "object") return undefined
        current = (current as Record<PropertyKey, unknown>)[segment]
    }
    return current
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Turn zod issues for `raw` into located, human-readable issues. */
function zodIssues(
    error: z.ZodError,
    raw: unknown,
    base: string,
    context: Pick<CueManifestIssue, "code" | "cueIndex" | "cueId" | "actionIndex" | "command">
): CueManifestIssue[] {
    return error.issues.map((issue) => {
        const field = issue.path.length ? String(issue.path[issue.path.length - 1]) : undefined
        const missing = valueAt(raw, issue.path) === undefined
        const label = field ?? "value"
        return {
            severity: "error",
            ...context,
            path: joinPath(base, issue.path),
            field,
            message: missing ? `"${label}" is required.` : `"${label}": ${issue.message}`,
        }
    })
}

/**
 * Validate a cue manifest and report exactly what was accepted. Invalid cues and
 * actions are omitted (never silently): every omission is listed in `issues` with its
 * cue, action and field. A cue whose actions all fail is omitted rather than kept empty,
 * and duplicate explicit cue ids keep the first occurrence.
 */
export function parseCueManifest(json: unknown): CueManifestParseResult {
    const issues: CueManifestIssue[] = []
    const envelope = manifestEnvelopeSchema.safeParse(json)
    if (!envelope.success) {
        return {
            status: "invalid",
            manifest: null,
            issues: zodIssues(envelope.error, json, "", { code: "invalid-manifest" }),
            omittedCueCount: 0,
            omittedActionCount: 0,
        }
    }

    const data = envelope.data
    const packs = data.assets?.spritePacks ?? {}
    const seenIds = new Map<string, number>()
    const cues: CueEvent[] = []
    let omittedCueCount = 0
    let omittedActionCount = 0

    data.cues.forEach((rawCue, cueIndex) => {
        const base = `cues[${cueIndex}]`
        if (!isRecord(rawCue)) {
            omittedCueCount++
            issues.push({
                severity: "error",
                code: "invalid-cue",
                path: base,
                cueIndex,
                message: "A cue must be an object with a trigger and actions.",
            })
            return
        }
        const cueId = typeof rawCue.id === "string" && rawCue.id ? rawCue.id : undefined
        const shell = cueShellSchema.safeParse(rawCue)
        if (!shell.success) {
            omittedCueCount++
            issues.push(
                ...zodIssues(shell.error, rawCue, base, { code: "invalid-cue", cueIndex, cueId })
            )
            return
        }
        if (cueId !== undefined) {
            const first = seenIds.get(cueId)
            if (first !== undefined) {
                omittedCueCount++
                issues.push({
                    severity: "error",
                    code: "duplicate-cue-id",
                    path: `${base}.id`,
                    cueIndex,
                    cueId,
                    field: "id",
                    message: `Duplicate cue id "${cueId}" (first used by cues[${first}]); this cue was omitted.`,
                })
                return
            }
            seenIds.set(cueId, cueIndex)
        }

        const actions: CueAction[] = []
        shell.data.actions.forEach((rawAction, actionIndex) => {
            const actionBase = `${base}.actions[${actionIndex}]`
            const where = { cueIndex, cueId, actionIndex }
            const command = isRecord(rawAction) ? rawAction.command : undefined
            if (
                typeof command !== "string" ||
                !Object.prototype.hasOwnProperty.call(actionSchemas, command)
            ) {
                omittedActionCount++
                issues.push({
                    severity: "error",
                    code: "unknown-command",
                    path: `${actionBase}.command`,
                    field: "command",
                    ...where,
                    command: typeof command === "string" ? command : undefined,
                    message:
                        command === undefined
                            ? `"command" is required. Supported commands: ${KNOWN_COMMANDS.join(", ")}.`
                            : `Unknown command ${JSON.stringify(command)}. Supported commands: ${KNOWN_COMMANDS.join(", ")}.`,
                })
                return
            }
            const parsed = actionSchemas[command as CueAction["command"]].safeParse(rawAction)
            if (!parsed.success) {
                omittedActionCount++
                issues.push(
                    ...zodIssues(parsed.error, rawAction, actionBase, {
                        code: "invalid-action",
                        command,
                        ...where,
                    })
                )
                return
            }
            const action = parsed.data as CueAction
            if (action.command === "sprite.play" || action.command === "sprite.fade") {
                const pack = packs[action.pack]
                const field = !pack ? "pack" : !pack.clips[action.clip] ? "clip" : undefined
                if (field) {
                    issues.push({
                        severity: "warning",
                        code: "missing-asset",
                        path: `${actionBase}.${field}`,
                        field,
                        command,
                        ...where,
                        message:
                            field === "pack"
                                ? `Sprite pack "${action.pack}" is not declared in assets.spritePacks.`
                                : `Clip "${action.clip}" does not exist in sprite pack "${action.pack}".`,
                    })
                }
            }
            actions.push(action)
        })

        if (shell.data.actions.length === 0) {
            issues.push({
                severity: "warning",
                code: "cue-no-actions",
                path: `${base}.actions`,
                cueIndex,
                cueId,
                field: "actions",
                message: "This cue has no actions.",
            })
        } else if (actions.length === 0) {
            omittedCueCount++
            issues.push({
                severity: "error",
                code: "cue-no-valid-actions",
                path: `${base}.actions`,
                cueIndex,
                cueId,
                field: "actions",
                message: "None of this cue's actions are valid, so the cue was omitted.",
            })
            return
        }

        cues.push({
            ...shell.data,
            id: cueId ?? "cue-" + generateSecureId(),
            actions,
        } as CueEvent)
    })

    if (data.cues.length > 0 && cues.length === 0) {
        return { status: "invalid", manifest: null, issues, omittedCueCount, omittedActionCount }
    }
    if (data.cues.length === 0) {
        issues.push({
            severity: "warning",
            code: "empty-manifest",
            path: "cues",
            field: "cues",
            message: "The manifest has no cues.",
        })
    }

    const manifest: CueManifest = { ...data, cues } as CueManifest
    return {
        status: omittedCueCount || omittedActionCount ? "accepted-with-omissions" : "valid",
        manifest,
        issues,
        omittedCueCount,
        omittedActionCount,
    }
}

/** One-line description of an issue, e.g. `cues[2] (rain-in) › actions[0] › profile: …`. */
export function formatCueManifestIssue(issue: CueManifestIssue): string {
    const where = issue.cueId ? `${issue.path} (cue "${issue.cueId}")` : issue.path
    return `${where ? where + ": " : ""}${issue.message}`
}

/**
 * @deprecated Returns the manifest for both `valid` and `accepted-with-omissions`
 * results, hiding which one you got. Use {@link parseCueManifest}. Omissions are
 * summarized on the console for existing callers.
 */
export function validateCueManifest(json: unknown): CueManifest | null {
    try {
        const result = parseCueManifest(json)
        for (const issue of result.issues) {
            if (issue.severity === "error") {
                console.warn("SAP Cues:", formatCueManifestIssue(issue))
            }
        }
        return result.manifest
    } catch (e) {
        console.error("SAP Cues: Validation threw an exception", e)
        return null
    }
}
