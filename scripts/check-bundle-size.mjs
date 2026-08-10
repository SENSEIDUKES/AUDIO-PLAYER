import { stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// These budgets stay below the measured unminified outputs while leaving room
// for incremental library growth.
const bundleLimits = {
    "dist/index.js": 550 * 1024,
    "dist/index.cjs": 500 * 1024,
}

let hasFailure = false

for (const [relativePath, maxBytes] of Object.entries(bundleLimits)) {
    const bundlePath = path.join(projectRoot, relativePath)

    try {
        const { size } = await stat(bundlePath)
        const sizeKiB = (size / 1024).toFixed(1)
        const maxKiB = (maxBytes / 1024).toFixed(0)

        if (size > maxBytes) {
            hasFailure = true
            console.error(`Bundle size exceeded: ${relativePath} is ${sizeKiB} KiB (limit: ${maxKiB} KiB).`)
        } else {
            console.log(`Bundle size OK: ${relativePath} is ${sizeKiB} KiB (limit: ${maxKiB} KiB).`)
        }
    } catch (error) {
        hasFailure = true
        const message = error instanceof Error ? error.message : String(error)
        console.error(`Bundle size check failed for ${relativePath}: ${message}`)
    }
}

if (hasFailure) {
    process.exitCode = 1
}
