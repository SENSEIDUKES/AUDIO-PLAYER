import type { AudioBackendKind } from "./AudioBackend"

export interface AudioResourcePolicy {
    /** Across all WebAudioBackend instances; includes download, decode and disk write. */
    maxConcurrentLoads: number
    maxEncodedBytes: number
    maxDecodedBytes: number
}

const defaults: AudioResourcePolicy = {
    maxConcurrentLoads: 2,
    maxEncodedBytes: 32 * 1024 * 1024,
    maxDecodedBytes: 64 * 1024 * 1024,
}
let policy = { ...defaults }

/** Applies to new jobs. Existing jobs keep their policy snapshot. */
export function configureAudioResources(next: Partial<AudioResourcePolicy>): void {
    for (const value of Object.values(next)) {
        if (!Number.isSafeInteger(value) || value < 1)
            throw new RangeError("Audio limits must be positive integers.")
    }
    policy = { ...policy, ...next }
    drain()
}

export function getAudioResourcePolicy(): AudioResourcePolicy {
    return { ...policy }
}

/** Select before mounting the player; unknown or long assets should stream. */
export function recommendAudioBackend(asset: {
    durationSeconds?: number
    encodedBytes?: number
    decodedBytes?: number
}): AudioBackendKind {
    return !Number.isFinite(asset.durationSeconds) ||
        asset.durationSeconds! <= 0 ||
        asset.durationSeconds! > 45 ||
        (asset.encodedBytes ?? 0) > policy.maxEncodedBytes ||
        (asset.decodedBytes ?? 0) > policy.maxDecodedBytes
        ? "html5"
        : "webaudio"
}

export class AudioResourceLimitError extends Error {
    constructor() {
        super("Audio exceeds the Web Audio resource policy; use HTML5 streaming.")
    }
}

export function decodedBytes(buffer: AudioBuffer): number {
    const bytes = buffer.length * buffer.numberOfChannels * 4
    return Number.isFinite(bytes) ? Math.max(0, bytes) : 0
}

/** Preflight PCM/float WAV before native decode; other codecs have no reliable generic estimate. */
export function estimateWavDecodedBytes(
    data: ArrayBuffer,
    outputSampleRate: number
): number | null {
    if (data.byteLength < 12) return null
    const view = new DataView(data)
    const tag = (offset: number) => view.getUint32(offset, false)
    if (tag(0) !== 0x52494646 || tag(8) !== 0x57415645) return null
    let channels = 0
    let blockAlign = 0
    let sampleRate = 0
    let dataBytes: number | null = null
    for (let offset = 12; offset + 8 <= data.byteLength;) {
        const size = view.getUint32(offset + 4, true)
        if (tag(offset) === 0x666d7420 && size >= 16 && offset + 24 <= data.byteLength) {
            const format = view.getUint16(offset + 8, true)
            if (format !== 1 && format !== 3) return null
            channels = view.getUint16(offset + 10, true)
            sampleRate = view.getUint32(offset + 12, true)
            blockAlign = view.getUint16(offset + 20, true)
        }
        if (tag(offset) === 0x64617461) dataBytes = size
        offset += 8 + size + (size % 2)
    }
    if (!channels || !sampleRate || !blockAlign || dataBytes === null) return null
    return Math.ceil(((dataBytes / blockAlign) * outputSampleRate) / sampleRate) * channels * 4
}

export type AudioLoadJob = { encodedBytes: number; decoding: boolean; policy: AudioResourcePolicy }
const jobs = new Set<AudioLoadJob>()
const queue: Array<() => void> = []
const activeBuffers = new Map<object, AudioBuffer>()

function drain() {
    while (queue.length && jobs.size < policy.maxConcurrentLoads) queue.shift()!()
}

/** Callers check cancellation before allocating inside the admitted job. */
export async function withAudioLoad<T>(work: (job: AudioLoadJob) => Promise<T>): Promise<T> {
    const job = await new Promise<AudioLoadJob>((resolve) => {
        queue.push(() => {
            const next = { encodedBytes: 0, decoding: false, policy: { ...policy } }
            jobs.add(next)
            resolve(next)
        })
        drain()
    })
    try {
        return await work(job)
    } finally {
        jobs.delete(job)
        drain()
    }
}

export function trackActiveAudioBuffer(owner: object, buffer: AudioBuffer | null): void {
    if (buffer) activeBuffers.set(owner, buffer)
    else activeBuffers.delete(owner)
}

export function getAudioResourceStats() {
    return {
        activeBufferBytes: [...new Set(activeBuffers.values())].reduce(
            (sum, buffer) => sum + decodedBytes(buffer),
            0
        ),
        inFlightEncodedBytes: [...jobs].reduce((sum, job) => sum + job.encodedBytes, 0),
        // Native decoder allocations are opaque; this is a reservation, not measured heap usage.
        decodingReservedBytes: [...jobs].reduce(
            (sum, job) => sum + (job.decoding ? job.policy.maxDecodedBytes : 0),
            0
        ),
        activeLoads: jobs.size,
        queuedLoads: queue.length,
    }
}

/** Reject declared oversize bodies before reading, and count chunked bodies too. */
export async function readBoundedAudio(
    response: Response,
    maxBytes: number,
    signal?: AbortSignal,
    onBytes: (bytes: number) => void = () => {}
): Promise<ArrayBuffer> {
    const declared = Number(response.headers?.get("Content-Length"))
    if (declared > maxBytes) {
        await response.body?.cancel().catch(() => {})
        throw new AudioResourceLimitError()
    }
    const reader = response.body?.getReader()
    if (!reader) {
        const data = await response.arrayBuffer()
        if (data.byteLength > maxBytes) throw new AudioResourceLimitError()
        onBytes(data.byteLength)
        return data
    }
    const chunks: Uint8Array[] = []
    let size = 0
    const cancel = () => {
        void reader.cancel().catch(() => {})
    }
    signal?.addEventListener("abort", cancel, { once: true })
    try {
        for (;;) {
            if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
            const { value, done } = await reader.read()
            if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
            if (done) break
            size += value.byteLength
            if (size > maxBytes) throw new AudioResourceLimitError()
            chunks.push(value)
            // Assembly temporarily holds both chunks and the contiguous result.
            onBytes(size * 2)
        }
        const data = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
            data.set(chunk, offset)
            offset += chunk.byteLength
        }
        onBytes(size)
        return data.buffer
    } finally {
        signal?.removeEventListener("abort", cancel)
        await reader.cancel().catch(() => {})
        reader.releaseLock()
    }
}
