import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

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
    "src/reader-ui/index.ts",
    "vendor/ui-artifacts.json",
    "vendor/seihouse-ui-0.10.1.tgz",
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

    if (await pathExists("vendor/ui-artifacts.json")) {
        const provenance = JSON.parse(
            await readFile(path.join(projectRoot, "vendor/ui-artifacts.json"), "utf8")
        )
        const artifact = provenance.artifacts["@seihouse/ui"]
        const integrity = `sha512-${createHash("sha512")
            .update(await readFile(path.join(projectRoot, artifact.file)))
            .digest("base64")}`
        if (
            artifact.version !== "0.10.1" ||
            artifact.sourceCommit !== "d3c630181b5fb35cbb9be50847c96fff2dbd5e4a"
        ) {
            errors.push("reader UI must use the approved UI 0.10.1 artifact from PR #87")
        }
        if (
            artifact.integrity !== integrity ||
            packageLock.packages["node_modules/@seihouse/ui"]?.integrity !== integrity
        ) {
            errors.push(
                "vendored UI artifact, provenance and package lock must have identical integrity"
            )
        }
    }
}

if (errors.length > 0) {
    console.error("Repository contract check failed:")
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
} else {
    console.log("Repository contract checks passed.")
}
