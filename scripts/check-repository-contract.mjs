import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const requiredPaths = [
    "package.json",
    "package-lock.json",
    "api/agent-scout.ts",
    "src/server/agentScout.ts",
    "src/audio-player/index.ts",
    "src/audio-player/visual-slots/components/imported/sample-skin/raw.tsx",
    "scripts/check-documentation.mjs",
    "scripts/package-smoke-test.mjs",
]

const alternatePackageManagerLocks = ["bun.lock", "bun.lockb", "pnpm-lock.yaml", "yarn.lock"]

async function pathExists(relativePath) {
    try {
        await access(path.join(projectRoot, relativePath))
        return true
    } catch {
        return false
    }
}

const errors = []

for (const relativePath of requiredPaths) {
    if (!(await pathExists(relativePath))) {
        errors.push(`required repository file is missing: ${relativePath}`)
    }
}

for (const relativePath of alternatePackageManagerLocks) {
    if (await pathExists(relativePath)) {
        errors.push(
            `unexpected package-manager lockfile: ${relativePath}; this repository uses npm and package-lock.json`
        )
    }
}

if (await pathExists("package.json")) {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"))

    if (packageJson.name !== "@seihouse/audio-player") {
        errors.push("package.json must retain the @seihouse/audio-player package identity")
    }

    if (!packageJson.scripts?.test?.includes("test:repository")) {
        errors.push("the default test command must include the repository contract check")
    }
}

if (await pathExists("package-lock.json")) {
    const packageLock = JSON.parse(
        await readFile(path.join(projectRoot, "package-lock.json"), "utf8")
    )

    if (packageLock.name !== "@seihouse/audio-player") {
        errors.push("package-lock.json must retain the @seihouse/audio-player package identity")
    }

    if (packageLock.lockfileVersion !== 3) {
        errors.push("package-lock.json must use the npm lockfile v3 contract")
    }
}

if (errors.length > 0) {
    console.error("Repository contract check failed:")
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
} else {
    console.log("Repository contract checks passed.")
}
