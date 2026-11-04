import { stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// These budgets stay below the measured unminified outputs while leaving room
// for incremental library growth.
const bundleLimits = {
    // Reader policies, note and loudness measurement brought the measured ESM to 603 KiB;
    // SEIHouse's official icon set (skins/seihouse-icons.tsx) adds ~6 KiB. Keep ~10 KiB of
    // explicit headroom; the CJS budget remains unchanged.
    "dist/index.js": 620 * 1024,
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
            console.error(
                `Bundle size exceeded: ${relativePath} is ${sizeKiB} KiB (limit: ${maxKiB} KiB).`
            )
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
