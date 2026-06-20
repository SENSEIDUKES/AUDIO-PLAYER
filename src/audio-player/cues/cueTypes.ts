import type { AudioSpriteManifest } from "../core/audio/AudioSpriteEngine"

export interface CueManifestMetadata {
    title?: string
    chapterId?: string
    source?: string
    [key: string]: unknown
}

export interface CueManifestAssets {
    spritePacks?: Record<string, AudioSpriteManifest>
}

export type CueTriggerKind =
    | "time"
    | "scene"
    | "paragraph"
    | "chapter"
    | "metadata"
    | "tension"
    | "powerShift"
    | "emotion"
    | "relationshipShift"
    | "danger"
    | "element"
    | "signature"
    | "intensity"

export interface CueTriggerTime {
    kind: "time"
    at: number
}

export interface CueTriggerState {
    kind: Exclude<CueTriggerKind, "time">
    value: string | number
}

export type CueTrigger = CueTriggerTime | CueTriggerState

export interface ActionSpritePlay {
    command: "sprite.play"
    pack: string
    clip: string
    loop?: boolean
    fadeInMs?: number
    volume?: number
}

export interface ActionSpriteStop {
    command: "sprite.stop"
    pack?: string
    clip?: string
    fadeOutMs?: number
}

export interface ActionSpriteFade {
    command: "sprite.fade"
    pack: string
    clip: string
    volume: number
    durationMs: number
}

export interface ActionAmbienceCrossfade {
    command: "ambience.crossfade"
    profile: string
    durationMs?: number
}

export interface ActionDuckSet {
    command: "duck.set"
    amount: number
}

export interface ActionVolumeFadeNarration {
    command: "volume.fadeNarration"
    volume: number
    durationMs: number
}

export interface ActionPlayerSeek {
    command: "player.seek"
    time: number
}

export interface ActionPlayerPause {
    command: "player.pause"
}

export interface ActionEventEmit {
    command: "event.emit"
    eventName: string
    detail?: unknown
}

export interface ActionLayerSet {
    command: "layer.set"
    layer: string
    state: string | number
}

export interface ActionSpatialPan {
    command: "spatial.pan"
    pack?: string
    clip?: string
    x: number
    y: number
    z: number
    durationMs?: number
}

export type CueAction =
    | ActionSpritePlay
    | ActionSpriteStop
    | ActionSpriteFade
    | ActionAmbienceCrossfade
    | ActionDuckSet
    | ActionVolumeFadeNarration
    | ActionPlayerSeek
    | ActionPlayerPause
    | ActionEventEmit
    | ActionLayerSet
    | ActionSpatialPan

export interface CueEvent {
    /** Unique identifier for this cue event. Will be generated if omitted in JSON. */
    id: string
    /** The trigger that fires this cue. */
    trigger: CueTrigger
    /** Actions to execute when this cue fires. */
    actions: CueAction[]
    /** If true, the cue will refire if playback is seeked backward before its trigger time. Defaults to false. */
    replayable?: boolean
    /** If true, jumping forward past this cue's time will still trigger it. Defaults to false. */
    fireOnSeek?: boolean
}

export interface CueManifest {
    version: "sap-cues/1"
    id?: string
    metadata?: CueManifestMetadata
    assets?: CueManifestAssets
    cues: CueEvent[]
}
