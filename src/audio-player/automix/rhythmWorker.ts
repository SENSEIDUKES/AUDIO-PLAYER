import { EssentiaWASM } from "essentia.js/dist/essentia-wasm.es.js"
import Essentia, {
    type RhythmExtractor2013Result,
} from "essentia.js/dist/essentia.js-core.es.js"
import type { RhythmRequest, RhythmResponse } from "./rhythmProtocol"

/**
 * Dedicated worker that runs essentia.js rhythm extraction off the main
 * thread. The essentia imports are static on purpose: the WASM payload then
 * lives entirely in the worker chunk, which the browser only fetches when the
 * first `new Worker(...)` is constructed — and dynamic imports inside Vite's
 * default IIFE worker format would fail the build.
 */

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<RhythmRequest>) => void) | null
    postMessage: (message: RhythmResponse) => void
}

function waitForRuntime(): Promise<void> {
    return new Promise((resolve) => {
        if (EssentiaWASM.calledRun) return resolve()
        const previous = EssentiaWASM.onRuntimeInitialized
        EssentiaWASM.onRuntimeInitialized = () => {
            previous?.()
            resolve()
        }
    })
}

const essentiaReady = waitForRuntime().then(() => {
    const essentia = new Essentia(EssentiaWASM)
    scope.postMessage({ type: "ready" })
    return essentia
})

scope.onmessage = (event) => {
    const { id, samples, sampleRate, offsetMs } = event.data
    void essentiaReady
        .then((essentia) => {
            const vector = essentia.arrayToVector(samples)
            let result: RhythmExtractor2013Result | null = null
            try {
                result = essentia.RhythmExtractor2013(vector, 208, "multifeature", 40)
                const ticks = essentia.vectorToArray(result.ticks)
                const ticksMs: number[] = []
                for (let i = 0; i < ticks.length; i++) {
                    // Ticks arrive in seconds relative to the segment start.
                    ticksMs.push(Math.round(ticks[i] * 1000 * (44100 / sampleRate)) + offsetMs)
                }
                scope.postMessage({
                    id,
                    ok: true,
                    bpm: result.bpm,
                    ticksMs,
                    confidence: result.confidence,
                })
            } finally {
                // WASM-side vectors are not garbage-collected; free them even
                // when conversion or postMessage throws.
                result?.ticks.delete()
                result?.estimates.delete()
                result?.bpmIntervals.delete()
                vector.delete()
            }
        })
        .catch((error: unknown) => {
            scope.postMessage({
                id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            })
        })
}
