import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { transform } from "esbuild"
import decode from "@audio/decode"

// Compile the shared, dependency-free measuring source in memory. Neither the
// decoder nor esbuild is imported by the published browser library.
const source = await readFile(
    new URL("../src/audio-player/narrative/loudness.ts", import.meta.url),
    "utf8"
)
const compiled = await transform(source, { loader: "ts", format: "esm" })
const { measureLoudnessPcm, computeLoudnessGain } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`
)
const args = process.argv.slice(2)
const kindArg = args.find((arg) => arg.startsWith("--kind="))?.slice(7) ?? "integrated"
if (!["integrated", "momentary-max"].includes(kindArg))
    throw new Error("--kind must be integrated or momentary-max")
const manifestArg = args.find((arg) => arg.startsWith("--manifest="))?.slice(11)
const entries = manifestArg
    ? JSON.parse(await readFile(manifestArg, "utf8"))
    : args.filter((arg) => !arg.startsWith("--")).map((source) => ({ source, kind: kindArg }))
if (!entries.length) {
    console.error(
        "Usage: npm run measure-loudness -- [--kind=momentary-max] <files or URLs>\n       npm run measure-loudness -- --manifest=path.json (array of {id?, source, kind?})"
    )
    process.exitCode = 1
}
const results = []
for (const entry of entries) {
    const location = entry.source
    try {
        const kind = entry.kind ?? kindArg
        if (!["integrated", "momentary-max"].includes(kind))
            throw new Error("Invalid measurement kind")
        console.error(`Measuring ${location}`)
        let bytes
        if (/^https?:\/\//i.test(location)) {
            const response = await fetch(location, { signal: AbortSignal.timeout(60000) })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const limit = 256 * 1024 * 1024
            if (Number(response.headers.get("content-length")) > limit)
                throw new Error("Source exceeds the 256 MiB measurement limit")
            const chunks = []
            let size = 0
            for await (const chunk of response.body) {
                size += chunk.length
                if (size > limit) throw new Error("Source exceeds the 256 MiB measurement limit")
                chunks.push(chunk)
            }
            bytes = Buffer.concat(chunks, size)
        } else
            bytes = await readFile(
                location.startsWith("file:") ? fileURLToPath(location) : location
            )
        const decoded = await decode(bytes)
        const loudness = measureLoudnessPcm(decoded.channelData, decoded.sampleRate, { kind })
        results.push({
            ...entry,
            loudness,
            leveling: computeLoudnessGain(loudness, kind),
            sha256: createHash("sha256").update(bytes).digest("hex"),
            sampleRate: decoded.sampleRate,
            channels: decoded.channelData.length,
            durationSeconds: decoded.channelData[0].length / decoded.sampleRate,
            method: "calibrated-w3c-k-biquads/bs1770-gates/v1",
            decoder: "@audio/decode 3.12.0",
        })
    } catch (error) {
        results.push({ ...entry, error: error.message })
        process.exitCode = 1
    }
}
console.log(JSON.stringify(results, null, 2))
