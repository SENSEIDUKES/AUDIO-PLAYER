import type { Track, TrackAnalysis, TrackTrims } from "../types"
import { trackKey } from "../utils/trackKey"
import { fetchAndDecodeTrack } from "./decodeTrack"
import { scanSilenceEdges, seedTrackTrims } from "./silenceAnalysis"
import { analyzeRhythm, type RhythmSegmentResult } from "./rhythmClient"
import { readStoredAnalysis, writeStoredAnalysis } from "./analysisStore"
import {
    bpmCompatibility,
    computeTransitionPoints,
    normalizeRhythmConfidence,
} from "./transitionPlanner"

/**
 * Automix Pro track analysis orchestrator.
 *
 * One download + decode per track feeds everything: silence trims (same scan
 * as Automix Lite), an energy estimate, and beat/BPM extraction in the
 * essentia worker. Results are cached in memory for the page (same
 * pending/settled/serializer pattern as the Lite analysis) and persisted to
 * IndexedDB when the rhythm data is trustworthy.
 *
 * Rhythm is only extracted from two windows — the first ~60s after the trim
 * start and the last ~120s before the trimmed end — because transitions only
 * need beats near the edges, and a full-length track would be a multi-hundred
 * megabyte Float32 transfer on long files.
 */

/** Target sample rate for rhythm extraction; RhythmExtractor2013 assumes it. */
const RHYTHM_SAMPLE_RATE = 44100
const HEAD_SEGMENT_MS = 60_000
const TAIL_SEGMENT_MS = 120_000
/** Tracks whose trimmed length fits in this analyze as a single segment. */
const SINGLE_SEGMENT_MAX_MS = HEAD_SEGMENT_MS + TAIL_SEGMENT_MS
/** RMS window for the energy estimate, matching the silence scan. */
const ENERGY_WINDOW_MS = 50
/** Window RMS treated as "full" energy when mapping to 0..1. */
const ENERGY_FULL_SCALE_RMS = 0.35
/** Penalty applied when head and tail disagree about the tempo. */
const SEGMENT_DISAGREEMENT_PENALTY = 0.7
/** Fade length used to bake default transition points into the analysis. */
const DEFAULT_FADE_MS = 5500

type RhythmFn = (
    samples: Float32Array,
    sampleRate: number,
    offsetMs: number
) => Promise<RhythmSegmentResult | null>

let rhythmFn: RhythmFn = analyzeRhythm
let decodeFn: (url: string) => Promise<AudioBuffer | null> = fetchAndDecodeTrack
let persist = true

/** Test seam: swap the rhythm/decode implementations. Pass null to restore. */
export function configureTrackAnalysis(overrides: {
    rhythm?: RhythmFn | null
    decode?: ((url: string) => Promise<AudioBuffer | null>) | null
    persist?: boolean
}): void {
    if (overrides.rhythm !== undefined) rhythmFn = overrides.rhythm ?? analyzeRhythm
    if (overrides.decode !== undefined) decodeFn = overrides.decode ?? fetchAndDecodeTrack
    if (overrides.persist !== undefined) persist = overrides.persist
}

const pending = new Map<string, Promise<TrackAnalysis | null>>()
const settled = new Map<string, TrackAnalysis | null>()
let lastJob: Promise<unknown> = Promise.resolve()

/**
 * Downmix a region of the decoded buffer to mono and linearly resample it to
 * 44.1kHz. Plain JS instead of OfflineAudioContext rendering so the result is
 * deterministic and testable; linear interpolation is plenty for beat
 * tracking.
 */
function extractMonoSegment(
    buffer: AudioBuffer,
    startMs: number,
    endMs: number
): Float32Array | null {
    const sourceRate = buffer.sampleRate
    const start = Math.max(0, Math.floor((startMs / 1000) * sourceRate))
    const end = Math.min(buffer.length, Math.ceil((endMs / 1000) * sourceRate))
    if (end - start < sourceRate) return null // under a second: not analyzable

    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        channels.push(buffer.getChannelData(c))
    }
    if (channels.length === 0) return null

    const ratio = sourceRate / RHYTHM_SAMPLE_RATE
    const outLength = Math.floor((end - start) / ratio)
    const out = new Float32Array(outLength)
    for (let i = 0; i < outLength; i++) {
        const sourcePos = start + i * ratio
        const i0 = Math.min(end - 1, Math.floor(sourcePos))
        const i1 = Math.min(end - 1, i0 + 1)
        const frac = sourcePos - i0
        let sum = 0
        for (const data of channels) {
            sum += data[i0] + (data[i1] - data[i0]) * frac
        }
        out[i] = sum / channels.length
    }
    return out
}

/** Mean windowed RMS over the trimmed region, mapped to 0..1. */
function computeEnergy(buffer: AudioBuffer, trims: TrackTrims): number {
    const win = Math.max(1, Math.round((ENERGY_WINDOW_MS / 1000) * buffer.sampleRate))
    const start = Math.floor((trims.trimStartMs / 1000) * buffer.sampleRate)
    const end = buffer.length - Math.floor((trims.trimEndMs / 1000) * buffer.sampleRate)
    const channels: Float32Array[] = []
    for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) {
        channels.push(buffer.getChannelData(c))
    }
    if (channels.length === 0 || end - start < win) return 0

    let total = 0
    let windows = 0
    for (let pos = start; pos + win <= end; pos += win) {
        let loudest = 0
        for (const data of channels) {
            let sum = 0
            for (let i = pos; i < pos + win; i++) {
                const v = data[i]
                sum += v * v
            }
            const rms = Math.sqrt(sum / win)
            if (rms > loudest) loudest = rms
        }
        total += loudest
        windows++
    }
    if (windows === 0) return 0
    return Math.min(1, total / windows / ENERGY_FULL_SCALE_RMS)
}

interface MergedRhythm {
    bpm?: number
    beats?: number[]
    confidence: number
}

function mergeSegments(
    head: RhythmSegmentResult | null,
    tail: RhythmSegmentResult | null
): MergedRhythm {
    if (!head && !tail) return { confidence: 0 }
    if (!head || !tail) {
        const only = (head ?? tail) as RhythmSegmentResult
        return {
            bpm: only.bpm,
            beats: only.ticksMs,
            // A missing segment means half the picture: penalize accordingly.
            confidence:
                normalizeRhythmConfidence(only.confidenceRaw) * SEGMENT_DISAGREEMENT_PENALTY,
        }
    }
    const beats = [...head.ticksMs, ...tail.ticksMs].sort((a, b) => a - b)
    const agreement = bpmCompatibility(head.bpm, tail.bpm)
    const confidence = Math.min(
        normalizeRhythmConfidence(head.confidenceRaw),
        normalizeRhythmConfidence(tail.confidenceRaw)
    )
    if (agreement >= 0.5) {
        const sameTempo = Math.abs(head.bpm - tail.bpm) / tail.bpm <= 0.08
        return {
            // Half/double-time pairs aren't averaged — the tail tempo is what
            // the next transition will blend against.
            bpm: sameTempo ? (head.bpm + tail.bpm) / 2 : tail.bpm,
            beats,
            confidence,
        }
    }
    return {
        bpm: tail.bpm,
        beats,
        confidence: confidence * SEGMENT_DISAGREEMENT_PENALTY,
    }
}

async function analyze(key: string, url: string): Promise<TrackAnalysis | null> {
    if (persist) {
        const stored = await readStoredAnalysis(key)
        if (stored) {
            seedTrackTrims(key, {
                trimStartMs: stored.trimStartMs ?? 0,
                trimEndMs: stored.trimEndMs ?? 0,
            })
            return stored
        }
    }

    const buffer = await decodeFn(url)
    if (!buffer) return null

    const trims = scanSilenceEdges(buffer)
    // Publish trims immediately: getTrackTrims() consumers (and the Lite
    // fallback inside AutomixPlugin) shouldn't wait out the rhythm extraction.
    seedTrackTrims(key, trims)
    const energy = computeEnergy(buffer, trims)
    const durationMs = buffer.duration * 1000
    const trimmedEndMs = durationMs - trims.trimEndMs
    const trimmedLengthMs = trimmedEndMs - trims.trimStartMs

    let rhythm: MergedRhythm
    if (trimmedLengthMs <= SINGLE_SEGMENT_MAX_MS) {
        const samples = extractMonoSegment(buffer, trims.trimStartMs, trimmedEndMs)
        const result = samples
            ? await rhythmFn(samples, RHYTHM_SAMPLE_RATE, trims.trimStartMs)
            : null
        rhythm = result
            ? {
                  bpm: result.bpm,
                  beats: result.ticksMs,
                  confidence: normalizeRhythmConfidence(result.confidenceRaw),
              }
            : { confidence: 0 }
    } else {
        const headEndMs = trims.trimStartMs + HEAD_SEGMENT_MS
        const tailStartMs = trimmedEndMs - TAIL_SEGMENT_MS
        const headSamples = extractMonoSegment(buffer, trims.trimStartMs, headEndMs)
        const tailSamples = extractMonoSegment(buffer, tailStartMs, trimmedEndMs)
        // Post both jobs at once: the worker processes them back to back
        // without waiting for a main-thread roundtrip in between.
        const [head, tail] = await Promise.all([
            headSamples ? rhythmFn(headSamples, RHYTHM_SAMPLE_RATE, trims.trimStartMs) : null,
            tailSamples ? rhythmFn(tailSamples, RHYTHM_SAMPLE_RATE, tailStartMs) : null,
        ])
        rhythm = mergeSegments(head, tail)
    }

    const analysis: TrackAnalysis = {
        trimStartMs: trims.trimStartMs,
        trimEndMs: trims.trimEndMs,
        energy,
        confidence: rhythm.confidence,
    }
    if (rhythm.bpm !== undefined && rhythm.confidence > 0) {
        analysis.bpm = rhythm.bpm
        analysis.beats = rhythm.beats
        const points = computeTransitionPoints(analysis, trims, durationMs, DEFAULT_FADE_MS)
        analysis.transitionInMs = points.transitionInMs
        analysis.transitionOutMs = points.transitionOutMs
    } else {
        analysis.transitionInMs = trims.trimStartMs
        analysis.transitionOutMs = Math.max(trims.trimStartMs, trimmedEndMs - DEFAULT_FADE_MS)
    }

    if (persist && rhythm.confidence > 0) {
        void writeStoredAnalysis(key, analysis)
    }
    return analysis
}

/**
 * Kick off (or join) Automix Pro analysis for a track. Results are cached for
 * the lifetime of the page and persisted to IndexedDB when rhythm extraction
 * succeeded; analyses run one at a time. Resolves to `null` when analysis is
 * entirely unavailable — callers fall back to Automix Lite behavior.
 */
export function ensureProTrackAnalysis(track: Track): Promise<TrackAnalysis | null> {
    const key = trackKey(track)
    const url = track.audioFile?.trim()
    if (!key || !url) return Promise.resolve(null)
    const existing = pending.get(key)
    if (existing) return existing
    const job = lastJob
        .catch(() => {})
        .then(() => analyze(key, url))
        .then(
            (analysis) => {
                settled.set(key, analysis)
                return analysis
            },
            () => {
                settled.set(key, null)
                return null
            }
        )
    lastJob = job
    pending.set(key, job)
    return job
}

/**
 * Synchronous read of a finished Pro analysis. Returns `null` while analysis
 * is pending, failed, or was never requested.
 */
export function getTrackAnalysis(track: Track | null): TrackAnalysis | null {
    if (!track) return null
    return settled.get(trackKey(track)) ?? null
}

/** Test seam: clear the page-lifetime caches. */
export function resetTrackAnalysisCacheForTests(): void {
    pending.clear()
    settled.clear()
    lastJob = Promise.resolve()
}
