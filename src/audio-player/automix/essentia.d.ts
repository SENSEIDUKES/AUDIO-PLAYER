/**
 * Ambient declarations for the deep essentia.js dist imports used by the
 * rhythm worker. essentia.js@0.1.3 ships type definitions for its core API
 * but not for the per-file ES module builds, so the small surface we use is
 * declared here.
 */

declare module "essentia.js/dist/essentia-wasm.es.js" {
    /** Emscripten module with the embedded essentia WASM build. */
    export const EssentiaWASM: {
        calledRun?: boolean
        onRuntimeInitialized?: () => void
    }
}

declare module "essentia.js/dist/essentia.js-core.es.js" {
    export interface VectorFloat {
        size(): number
        get(index: number): number
        delete(): void
    }

    export interface RhythmExtractor2013Result {
        bpm: number
        ticks: VectorFloat
        confidence: number
        estimates: VectorFloat
        bpmIntervals: VectorFloat
    }

    class Essentia {
        constructor(wasmModule: unknown, isDebug?: boolean)
        readonly version: string
        readonly algorithmNames: string
        arrayToVector(array: Float32Array): VectorFloat
        vectorToArray(vector: VectorFloat): Float32Array
        RhythmExtractor2013(
            signal: VectorFloat,
            maxTempo?: number,
            method?: "multifeature" | "degara",
            minTempo?: number
        ): RhythmExtractor2013Result
    }

    export default Essentia
}
