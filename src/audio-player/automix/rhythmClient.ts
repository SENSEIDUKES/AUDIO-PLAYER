import type { RhythmRequest, RhythmResponse } from "./rhythmProtocol"

/**
 * Main-thread client for the essentia rhythm worker.
 *
 * The worker (and with it the multi-megabyte essentia WASM chunk) is created
 * lazily on the first analysis request. Any failure — construction, WASM
 * init timeout, a hung job — latches `rhythmUnavailable` for the rest of the
 * page so callers degrade to trims-only analysis instead of retrying forever.
 */

const INIT_TIMEOUT_MS = 20_000
const JOB_TIMEOUT_MS = 30_000

export interface RhythmSegmentResult {
    bpm: number
    /** Beat positions in milliseconds of track time. */
    ticksMs: number[]
    /** Raw RhythmExtractor2013 confidence, 0–5.32. */
    confidenceRaw: number
}

type Pending = {
    resolve: (result: RhythmSegmentResult | null) => void
    timer: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
let ready: Promise<boolean> | null = null
let unavailable = false
let nextId = 1
const inflight = new Map<number, Pending>()

export function isRhythmUnavailable(): boolean {
    return unavailable
}

function failEverything() {
    unavailable = true
    for (const pending of inflight.values()) {
        clearTimeout(pending.timer)
        pending.resolve(null)
    }
    inflight.clear()
    try {
        worker?.terminate()
    } catch {
        // Already dead.
    }
    worker = null
    ready = null
}

function handleMessage(event: MessageEvent<RhythmResponse>) {
    const data = event.data
    if (!data || typeof data !== "object" || !("id" in data)) return
    const pending = inflight.get(data.id)
    if (!pending) return
    inflight.delete(data.id)
    clearTimeout(pending.timer)
    if (data.ok) {
        pending.resolve({
            bpm: data.bpm,
            ticksMs: data.ticksMs,
            confidenceRaw: data.confidence,
        })
    } else {
        pending.resolve(null)
    }
}

function ensureWorker(): Promise<boolean> {
    if (unavailable) return Promise.resolve(false)
    if (ready) return ready
    if (typeof Worker === "undefined") {
        unavailable = true
        return Promise.resolve(false)
    }
    ready = new Promise<boolean>((resolve) => {
        let instance: Worker
        try {
            instance = new Worker(new URL("./rhythmWorker.ts", import.meta.url), {
                type: "module",
            })
        } catch {
            unavailable = true
            resolve(false)
            return
        }
        const initTimer = setTimeout(() => {
            failEverything()
            resolve(false)
        }, INIT_TIMEOUT_MS)
        instance.addEventListener("message", (event: MessageEvent<RhythmResponse>) => {
            if (event.data && typeof event.data === "object" && "type" in event.data) {
                if (event.data.type === "ready") {
                    clearTimeout(initTimer)
                    resolve(true)
                }
                return
            }
            handleMessage(event)
        })
        instance.addEventListener("error", () => {
            clearTimeout(initTimer)
            failEverything()
            resolve(false)
        })
        worker = instance
    })
    return ready
}

/**
 * Run beat/BPM extraction on a mono 44.1kHz segment. `samples` is transferred
 * to the worker and must not be reused afterwards. Resolves to `null` when
 * rhythm analysis is unavailable or fails.
 */
export async function analyzeRhythm(
    samples: Float32Array,
    sampleRate: number,
    offsetMs: number
): Promise<RhythmSegmentResult | null> {
    const ok = await ensureWorker()
    const target = worker
    if (!ok || !target) return null

    const id = nextId++
    return new Promise<RhythmSegmentResult | null>((resolve) => {
        const timer = setTimeout(() => {
            // A hung WASM job blocks every later job on this worker: give up
            // on rhythm analysis for the rest of the page.
            inflight.delete(id)
            failEverything()
            resolve(null)
        }, JOB_TIMEOUT_MS)
        inflight.set(id, { resolve, timer })
        const request: RhythmRequest = { id, samples, sampleRate, offsetMs }
        try {
            target.postMessage(request, [samples.buffer])
        } catch {
            clearTimeout(timer)
            inflight.delete(id)
            failEverything()
            resolve(null)
        }
    })
}
