import type { TrackAnalysis, TrackTrims } from "../types"

/** Number of RMS bins sent to Agent Scout as a compact waveform envelope. */
export const SCOUT_WAVEFORM_BIN_COUNT = 32

const WINDOW_MS = 50
const SILENCE_RMS = 0.01
const ENERGY_FULL_SCALE_RMS = 0.35
const MIN_DBFS = -160

type AudioFeatureFields = Required<
    Pick<
        TrackAnalysis,
        | "durationMs"
        | "sampleRateHz"
        | "channelCount"
        | "peakDbfs"
        | "rmsDbfs"
        | "crestFactorDb"
        | "rmsRangeDb"
        | "clippingSampleRatio"
        | "silenceRatio"
        | "stereoCorrelation"
        | "waveformRmsDbfs"
        | "energy"
    >
>

function toDbfs(amplitude: number): number {
    if (!Number.isFinite(amplitude) || amplitude <= 0) return MIN_DBFS
    return Math.max(MIN_DBFS, 20 * Math.log10(amplitude))
}

function round(value: number, digits = 3): number {
    const scale = 10 ** digits
    return Math.round(value * scale) / scale
}

function percentile(sorted: readonly number[], fraction: number): number {
    if (sorted.length === 0) return MIN_DBFS
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(fraction * sorted.length)))
    return sorted[index]
}

/**
 * Extract deterministic PCM and waveform measurements from a decoded track.
 *
 * This intentionally reports sample/RMS measurements rather than pretending
 * they are broadcast loudness, true peak, or a mastering-grade spectrum. The
 * first two channels feed level/stereo metrics; `channelCount` still reports
 * the source buffer's actual channel count.
 */
export function extractAudioFeatures(
    buffer: AudioBuffer,
    trims: TrackTrims
): AudioFeatureFields | null {
    const analyzedChannels = Math.min(buffer.numberOfChannels, 2)
    if (analyzedChannels === 0 || buffer.length === 0 || buffer.sampleRate <= 0) return null

    const channels: Float32Array[] = []
    for (let channel = 0; channel < analyzedChannels; channel++) {
        channels.push(buffer.getChannelData(channel))
    }

    const start = Math.min(
        buffer.length,
        Math.max(0, Math.floor((trims.trimStartMs / 1000) * buffer.sampleRate))
    )
    const end = Math.max(
        start,
        Math.min(
            buffer.length,
            buffer.length - Math.floor((trims.trimEndMs / 1000) * buffer.sampleRate)
        )
    )
    if (end <= start) return null

    const windowSize = Math.max(1, Math.round((WINDOW_MS / 1000) * buffer.sampleRate))
    const windowCount = Math.ceil((end - start) / windowSize)
    const windowDbfs: number[] = []
    const waveformSquares = new Float64Array(SCOUT_WAVEFORM_BIN_COUNT)
    const waveformSamples = new Float64Array(SCOUT_WAVEFORM_BIN_COUNT)

    let totalSquares = 0
    let totalSamples = 0
    let peak = 0
    let clippedSamples = 0
    let silentWindows = 0
    let energyTotal = 0
    let energyWindows = 0

    let stereoSamples = 0
    let leftSum = 0
    let rightSum = 0
    let leftSquares = 0
    let rightSquares = 0
    let crossProducts = 0

    for (let windowIndex = 0; windowIndex < windowCount; windowIndex++) {
        const windowStart = start + windowIndex * windowSize
        const windowEnd = Math.min(end, windowStart + windowSize)
        let windowSquares = 0
        let windowSamples = 0
        const channelWindowSquares = new Float64Array(channels.length)

        for (let sampleIndex = windowStart; sampleIndex < windowEnd; sampleIndex++) {
            for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
                const channel = channels[channelIndex]
                const sample = channel[sampleIndex]
                const absolute = Math.abs(sample)
                const square = sample * sample
                peak = Math.max(peak, absolute)
                if (absolute >= 0.999) clippedSamples++
                windowSquares += square
                totalSquares += square
                channelWindowSquares[channelIndex] += square
                windowSamples++
                totalSamples++
            }

            if (channels.length === 2) {
                const left = channels[0][sampleIndex]
                const right = channels[1][sampleIndex]
                leftSum += left
                rightSum += right
                leftSquares += left * left
                rightSquares += right * right
                crossProducts += left * right
                stereoSamples++
            }
        }

        const windowRms = windowSamples > 0 ? Math.sqrt(windowSquares / windowSamples) : 0
        const windowLevel = toDbfs(windowRms)
        windowDbfs.push(windowLevel)
        if (windowRms < SILENCE_RMS) silentWindows++

        // Preserve Automix Pro's established energy semantics: mean 50ms RMS
        // of the louder channel, excluding a final partial window.
        if (windowEnd - windowStart === windowSize) {
            let loudestChannelRms = 0
            for (const squares of channelWindowSquares) {
                loudestChannelRms = Math.max(loudestChannelRms, Math.sqrt(squares / windowSize))
            }
            energyTotal += loudestChannelRms
            energyWindows++
        }

        const bin = Math.min(
            SCOUT_WAVEFORM_BIN_COUNT - 1,
            Math.floor((windowIndex / windowCount) * SCOUT_WAVEFORM_BIN_COUNT)
        )
        waveformSquares[bin] += windowSquares
        waveformSamples[bin] += windowSamples
    }

    if (totalSamples === 0) return null

    const rms = Math.sqrt(totalSquares / totalSamples)
    const peakDbfs = toDbfs(peak)
    const rmsDbfs = toDbfs(rms)
    const activeWindowLevels = windowDbfs.filter((level) => level > -60).sort((a, b) => a - b)
    const rmsRangeDb = Math.max(
        0,
        percentile(activeWindowLevels, 0.95) - percentile(activeWindowLevels, 0.1)
    )

    let stereoCorrelation: number | null = null
    if (stereoSamples > 1) {
        const covariance = crossProducts - (leftSum * rightSum) / stereoSamples
        const leftVariance = leftSquares - (leftSum * leftSum) / stereoSamples
        const rightVariance = rightSquares - (rightSum * rightSum) / stereoSamples
        const denominator = Math.sqrt(Math.max(0, leftVariance) * Math.max(0, rightVariance))
        if (denominator > 0) stereoCorrelation = Math.max(-1, Math.min(1, covariance / denominator))
    }

    const waveformRmsDbfs = Array.from(waveformSquares, (squares, index) => {
        const samples = waveformSamples[index]
        return round(toDbfs(samples > 0 ? Math.sqrt(squares / samples) : 0), 1)
    })

    return {
        durationMs: round(buffer.duration * 1000, 1),
        sampleRateHz: buffer.sampleRate,
        channelCount: buffer.numberOfChannels,
        peakDbfs: round(peakDbfs, 2),
        rmsDbfs: round(rmsDbfs, 2),
        crestFactorDb: round(Math.max(0, peakDbfs - rmsDbfs), 2),
        rmsRangeDb: round(rmsRangeDb, 2),
        clippingSampleRatio: round(clippedSamples / totalSamples, 6),
        silenceRatio: round(silentWindows / windowCount, 4),
        stereoCorrelation: stereoCorrelation === null ? null : round(stereoCorrelation, 4),
        waveformRmsDbfs,
        energy: round(
            energyWindows > 0
                ? Math.min(1, energyTotal / energyWindows / ENERGY_FULL_SCALE_RMS)
                : 0,
            4
        ),
    }
}
