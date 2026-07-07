/**
 * Message protocol between the main-thread rhythm client and the essentia
 * worker. Kept in its own module so both sides can import the types without
 * the client ever importing the worker module (which would pull the essentia
 * WASM payload into the main bundle).
 */
export interface RhythmRequest {
    id: number;
    /** Mono PCM, transferred (not copied) to the worker. */
    samples: Float32Array;
    /** Must be 44100 — RhythmExtractor2013 assumes it. */
    sampleRate: number;
    /** Where the segment starts in track time; ticks are returned offset by it. */
    offsetMs: number;
}
export interface RhythmSuccess {
    id: number;
    ok: true;
    bpm: number;
    /** Beat positions in milliseconds of track time. */
    ticksMs: number[];
    /** Raw RhythmExtractor2013 confidence, 0–5.32. */
    confidence: number;
}
export interface RhythmFailure {
    id: number;
    ok: false;
    error: string;
}
export type RhythmResponse = RhythmSuccess | RhythmFailure | {
    type: "ready";
};
//# sourceMappingURL=rhythmProtocol.d.ts.map