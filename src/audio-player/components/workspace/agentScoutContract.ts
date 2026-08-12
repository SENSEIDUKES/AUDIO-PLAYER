import type { TrackAnalysis } from "../../types"
import { SCOUT_WAVEFORM_BIN_COUNT } from "../../automix/audioFeatureAnalysis"

export type AgentScoutVariant = "demo-scout" | "studio-scout" | "memoir"

export interface AgentScoutMessage {
    role: "user" | "assistant"
    content: string
}

export interface AgentScoutTrackContext {
    title: string
    artist: string
    albumTitle?: string
    vaultCategory?: string
    lyrics?: string
}

export interface AgentScoutQueueItem {
    title: string
    artist: string
}

/** Measurements extracted from decoded PCM; the audio file itself is never uploaded. */
export interface AgentScoutAudioEvidence {
    durationMs: number
    sampleRateHz: number
    channelCount: number
    peakDbfs: number
    rmsDbfs: number
    crestFactorDb: number
    rmsRangeDb: number
    clippingSampleRatio: number
    silenceRatio: number
    stereoCorrelation: number | null
    waveformRmsDbfs: number[]
    energy: number
    bpm: number | null
    beatCount: number
    rhythmConfidence: number
    trimStartMs: number
    trimEndMs: number
}

export interface AgentScoutRequest {
    variant: AgentScoutVariant
    track: AgentScoutTrackContext
    queue: AgentScoutQueueItem[]
    audio: AgentScoutAudioEvidence
    messages: AgentScoutMessage[]
}

export interface AgentScoutResponse {
    content: string
}

const REQUIRED_NUMERIC_FIELDS = [
    "durationMs",
    "sampleRateHz",
    "channelCount",
    "peakDbfs",
    "rmsDbfs",
    "crestFactorDb",
    "rmsRangeDb",
    "clippingSampleRatio",
    "silenceRatio",
    "energy",
    "confidence",
    "trimStartMs",
    "trimEndMs",
] as const satisfies readonly (keyof TrackAnalysis)[]

/** Convert a completed Automix Pro analysis into the bounded evidence Scout accepts. */
export function toAgentScoutAudioEvidence(
    analysis: TrackAnalysis | null
): AgentScoutAudioEvidence | null {
    if (!analysis) return null
    for (const field of REQUIRED_NUMERIC_FIELDS) {
        if (typeof analysis[field] !== "number" || !Number.isFinite(analysis[field])) return null
    }
    if (
        !Array.isArray(analysis.waveformRmsDbfs) ||
        analysis.waveformRmsDbfs.length !== SCOUT_WAVEFORM_BIN_COUNT ||
        analysis.waveformRmsDbfs.some((value) => !Number.isFinite(value))
    ) {
        return null
    }

    return {
        durationMs: analysis.durationMs as number,
        sampleRateHz: analysis.sampleRateHz as number,
        channelCount: analysis.channelCount as number,
        peakDbfs: analysis.peakDbfs as number,
        rmsDbfs: analysis.rmsDbfs as number,
        crestFactorDb: analysis.crestFactorDb as number,
        rmsRangeDb: analysis.rmsRangeDb as number,
        clippingSampleRatio: analysis.clippingSampleRatio as number,
        silenceRatio: analysis.silenceRatio as number,
        stereoCorrelation:
            typeof analysis.stereoCorrelation === "number" ? analysis.stereoCorrelation : null,
        waveformRmsDbfs: [...analysis.waveformRmsDbfs],
        energy: analysis.energy as number,
        bpm: typeof analysis.bpm === "number" ? analysis.bpm : null,
        beatCount: analysis.beats?.length ?? 0,
        rhythmConfidence: analysis.confidence as number,
        trimStartMs: analysis.trimStartMs as number,
        trimEndMs: analysis.trimEndMs as number,
    }
}
