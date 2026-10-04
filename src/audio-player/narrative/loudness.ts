/** BS.1770 block measurement, stored alongside the exact decoded source. */
export interface LoudnessMeasurement {
    /** null for digital silence (JSON-safe, unlike negative infinity). */
    readonly lufs: number | null
    /** Sample peak in dBFS; not an oversampled true-peak measurement. */
    readonly peakDb: number | null
    readonly kind: "integrated" | "momentary-max"
}

export interface LoudnessLevelingOptions {
    enabled?: boolean
    /** Default −20 LUFS integrated. */
    loopReferenceLufs?: number
    /** Default −14 LUFS momentary maximum. */
    cueReferenceLufs?: number
    /** Default +12 dB. */
    maxBoostDb?: number
    /** Sample-peak ceiling before layer summation. Default −1 dBFS. */
    peakHeadroomDb?: number
}

export interface LoudnessGain {
    readonly gain: number
    readonly requestedGainDb: number
    readonly appliedGainDb: number
    /** The reference would require more than the configured boost cap. */
    readonly tooQuietToLevel: boolean
}

export const DEFAULT_LOUDNESS_LEVELING = Object.freeze({
    enabled: true,
    loopReferenceLufs: -20,
    cueReferenceLufs: -14,
    maxBoostDb: 12,
    peakHeadroomDb: -1,
})

/** Reference gain before reader sliders. Missing/invalid/mismatched measurements play at unity. */
export function computeLoudnessGain(
    measurement: LoudnessMeasurement | undefined,
    kind: LoudnessMeasurement["kind"],
    options: LoudnessLevelingOptions = {},
    routing: "web-audio" | "element" = "web-audio"
): LoudnessGain {
    if (
        options.enabled === false ||
        !measurement ||
        measurement.kind !== kind ||
        measurement.lufs === null ||
        !Number.isFinite(measurement.lufs) ||
        measurement.peakDb === null ||
        !Number.isFinite(measurement.peakDb)
    ) {
        return { gain: 1, requestedGainDb: 0, appliedGainDb: 0, tooQuietToLevel: false }
    }
    const finite = (value: number | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback
    const reference =
        kind === "integrated"
            ? finite(options.loopReferenceLufs, -20)
            : finite(options.cueReferenceLufs, -14)
    const cap = Math.max(0, finite(options.maxBoostDb, 12))
    const requestedGainDb = reference - measurement.lufs
    const appliedGainDb = Math.min(
        requestedGainDb,
        cap,
        finite(options.peakHeadroomDb, -1) - measurement.peakDb,
        routing === "element" ? 0 : Infinity
    )
    return {
        gain: Math.pow(10, appliedGainDb / 20),
        requestedGainDb,
        appliedGainDb,
        tooQuietToLevel: requestedGainDb > cap,
    }
}

export interface LoudnessMeasureOptions {
    kind?: LoudnessMeasurement["kind"]
    /** Explicit BS.1770 power weights for unusual channel layouts. LFE is 0. */
    channelWeights?: readonly number[]
}

function weightsFor(channels: number, explicit?: readonly number[]): readonly number[] {
    const layouts: Record<number, readonly number[]> = {
        1: [1],
        2: [1, 1],
        3: [1, 1, 1],
        4: [1, 1, 1.41, 1.41],
        5: [1, 1, 1, 1.41, 1.41],
        6: [1, 1, 1, 0, 1.41, 1.41],
    }
    const weights = explicit ?? layouts[channels]
    if (
        !weights ||
        weights.length !== channels ||
        weights.some((weight) => !Number.isFinite(weight) || weight < 0)
    )
        throw new Error("Supply valid channelWeights for this audio layout.")
    return weights
}

function validatePcm(channelData: readonly Float32Array[], sampleRate: number): number {
    const length = channelData[0]?.length ?? 0
    if (
        !length ||
        !Number.isFinite(sampleRate) ||
        sampleRate < 8000 ||
        channelData.some((channel) => channel.length !== length)
    )
        throw new Error("Expected equal-length PCM channels at a sample rate of at least 8 kHz.")
    return length
}

/** Shared gated block integration for browser Biquads and the equivalent Node PCM filter. */
function measureWeighted(
    raw: readonly Float32Array[],
    weighted: readonly Float32Array[],
    sampleRate: number,
    options: LoudnessMeasureOptions
): LoudnessMeasurement {
    const length = validatePcm(raw, sampleRate)
    const weights = weightsFor(raw.length, options.channelWeights)
    const blockSize = Math.round(sampleRate * 0.4)
    const hop = Math.round(sampleRate * 0.1)
    // Sub-400 ms cues have one zero-padded momentary block; silence is never amplified.
    const energy = new Float64Array(Math.max(length, blockSize))
    let peak = 0
    for (let c = 0; c < raw.length; c++) {
        for (let i = 0; i < length; i++) {
            if (!Number.isFinite(raw[c][i]) || !Number.isFinite(weighted[c][i]))
                throw new Error("Audio contains non-finite samples.")
            peak = Math.max(peak, Math.abs(raw[c][i]))
            energy[i] += weights[c] * weighted[c][i] ** 2
        }
    }
    const blocks: number[] = []
    let sum = 0
    for (let i = 0; i < blockSize; i++) sum += energy[i]
    blocks.push(sum / blockSize)
    for (let start = hop; start + blockSize <= energy.length; start += hop) {
        for (let i = start - hop; i < start; i++) sum -= energy[i]
        for (let i = start + blockSize - hop; i < start + blockSize; i++) sum += energy[i]
        blocks.push(Math.max(0, sum / blockSize))
    }
    // The requested W3C shelf is an approximation of the ITU shelf. Calibrate
    // its 997 Hz response instead of applying the ITU IIR's −0.691 unchanged.
    const offset = kCalibrationOffset(sampleRate)
    const toLufs = (power: number) => offset + 10 * Math.log10(power)
    const kind = options.kind ?? "integrated"
    let power = 0
    if (kind === "momentary-max")
        power = blocks.reduce((maximum, value) => Math.max(maximum, value), 0)
    else {
        const absolute = blocks.filter((value) => toLufs(value) > -70)
        if (absolute.length) {
            const mean = absolute.reduce((total, value) => total + value, 0) / absolute.length
            const relativeGate = toLufs(mean) - 10
            const gated = absolute.filter((value) => toLufs(value) > relativeGate)
            power = gated.reduce((total, value) => total + value, 0) / gated.length
        }
    }
    return Object.freeze({
        kind,
        lufs: power > 0 ? toLufs(power) : null,
        peakDb: peak > 0 ? 20 * Math.log10(peak) : null,
    })
}

/** W3C Biquad coefficient equivalents, for the dev-only Node decoder and deterministic calibration. */
function kCoefficients(rate: number): number[][] {
    const hpW = (2 * Math.PI * 38.13) / rate
    const hpCos = Math.cos(hpW),
        hpAlpha = Math.sin(hpW) / (2 * 0.5003)
    const w = (2 * Math.PI * 1681.97) / rate,
        c = Math.cos(w),
        s = Math.sin(w)
    const A = Math.pow(10, 4 / 40),
        alpha = (s * Math.SQRT2) / 2,
        beta = 2 * Math.sqrt(A) * alpha
    return [
        [(1 + hpCos) / 2, -(1 + hpCos), (1 + hpCos) / 2, 1 + hpAlpha, -2 * hpCos, 1 - hpAlpha],
        [
            A * (A + 1 + (A - 1) * c + beta),
            -2 * A * (A - 1 + (A + 1) * c),
            A * (A + 1 + (A - 1) * c - beta),
            A + 1 - (A - 1) * c + beta,
            2 * (A - 1 - (A + 1) * c),
            A + 1 - (A - 1) * c - beta,
        ],
    ]
}

/** Unity-amplitude 997 Hz in one channel is −3.01 LUFS at every supported sample rate. */
function kCalibrationOffset(rate: number): number {
    const w = (2 * Math.PI * 997) / rate
    return -kCoefficients(rate).reduce((db, [b0, b1, b2, a0, a1, a2]) => {
        const magnitude = (v0: number, v1: number, v2: number) =>
            (v0 + v1 * Math.cos(w) + v2 * Math.cos(2 * w)) ** 2 +
            (v1 * Math.sin(w) + v2 * Math.sin(2 * w)) ** 2
        return db + 10 * Math.log10(magnitude(b0, b1, b2) / magnitude(a0, a1, a2))
    }, 0)
}

function kWeight(samples: Float32Array, rate: number): Float32Array {
    const output = new Float32Array(samples)
    const run = (b0: number, b1: number, b2: number, a0: number, a1: number, a2: number) => {
        let x1 = 0,
            x2 = 0,
            y1 = 0,
            y2 = 0
        for (let i = 0; i < output.length; i++) {
            const x = output[i]
            const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
            output[i] = y
            x2 = x1
            x1 = x
            y2 = y1
            y1 = y
        }
    }
    for (const [b0, b1, b2, a0, a1, a2] of kCoefficients(rate)) run(b0, b1, b2, a0, a1, a2)
    return output
}

/** Measure decoded PCM without browser APIs; used by the Node file/URL command. No decoder is bundled. */
export function measureLoudnessPcm(
    channelData: readonly Float32Array[],
    sampleRate: number,
    options: LoudnessMeasureOptions = {}
): LoudnessMeasurement {
    validatePcm(channelData, sampleRate)
    return measureWeighted(
        channelData,
        channelData.map((channel) => kWeight(channel, sampleRate)),
        sampleRate,
        options
    )
}

/** Decode encoded bytes with OfflineAudioContext, then K-weight with two BiquadFilterNodes. */
export async function measureLoudness(
    input: ArrayBuffer | AudioBuffer,
    options: LoudnessMeasureOptions = {}
): Promise<LoudnessMeasurement> {
    const Ctor =
        globalThis.OfflineAudioContext ??
        (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
            .webkitOfflineAudioContext
    if (!Ctor)
        throw new Error(
            "OfflineAudioContext is unavailable; use measureLoudnessPcm with decoded samples."
        )
    const buffer =
        input instanceof ArrayBuffer
            ? await new Ctor(1, 1, 48000).decodeAudioData(input.slice(0))
            : input
    const raw = Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
        buffer.getChannelData(channel)
    )
    validatePcm(raw, buffer.sampleRate)
    weightsFor(raw.length, options.channelWeights)
    const context = new Ctor(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
    const source = context.createBufferSource()
    source.buffer = buffer
    const highPass = context.createBiquadFilter()
    highPass.type = "highpass"
    highPass.frequency.value = 38.13
    highPass.Q.value = 20 * Math.log10(0.5003)
    const shelf = context.createBiquadFilter()
    shelf.type = "highshelf"
    shelf.frequency.value = 1681.97
    shelf.gain.value = 4
    source.connect(highPass)
    highPass.connect(shelf)
    shelf.connect(context.destination)
    source.start()
    const rendered = await context.startRendering()
    return measureWeighted(
        raw,
        raw.map((_, channel) => rendered.getChannelData(channel)),
        buffer.sampleRate,
        options
    )
}
