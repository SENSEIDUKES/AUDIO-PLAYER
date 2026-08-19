#!/usr/bin/env node

/**
 * Script to audit test files for untyped `any` casts in mocks and fixtures.
 * Encourages replacing `any` with typed mock interfaces from `src/audio-player/testing/testMocks.ts`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()
const TEST_PATTERNS = [/__tests__\/.+\.tsx?$/, /\.test\.tsx?$/, /\.spec\.tsx?$/]

function findFiles(dir, fileList = []) {
    const files = readdirSync(dir)
    for (const file of files) {
        if (file === "node_modules" || file === "dist" || file === "coverage" || file === ".git") {
            continue
        }
        const fullPath = join(dir, file)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
            findFiles(fullPath, fileList)
        } else {
            const rel = relative(ROOT, fullPath).replace(/\\/g, "/")
            if (TEST_PATTERNS.some((p) => p.test(rel))) {
                fileList.push(fullPath)
            }
        }
    }
    return fileList
}

const testFiles = findFiles(ROOT)
let totalAnyFound = 0
const report = []

for (const filePath of testFiles) {
    const relPath = relative(ROOT, filePath)
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n")

    lines.forEach((line, index) => {
        // Simple regex matching `as any`, `: any`, `any[]`, `<any>`
        const anyMatch = line.match(/(\bas\s+any\b|:\s*any\b|\bany\[\]|<any>)/)
        // Skip comment lines
        const isComment = line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*")
        if (anyMatch && !isComment) {
            totalAnyFound++
            report.push({
                file: relPath,
                line: index + 1,
                snippet: line.trim(),
            })
        }
    })
}

console.log("==================================================")
console.log("  Test Fixture & Mock Type Audit (@typescript-eslint/no-explicit-any)")
console.log("==================================================")

if (totalAnyFound === 0) {
    console.log(" All test fixtures and mocks are strictly typed! No untyped `any` casts found.")
    console.log("Tip: Use `src/audio-player/testing/testMocks.ts` for MockAudioEngine, MockPluginContext, etc.\n")
    process.exit(0)
} else {
    console.log(` Found ${totalAnyFound} explicit \`any\` occurrences across ${testFiles.length} test files:\n`)
    for (const item of report) {
        console.log(`  ${item.file}:${item.line}`)
        console.log(`    ${item.snippet}\n`)
    }
    console.log("Recommendation: Replace these with typed mock interfaces from `src/audio-player/testing/testMocks.ts`.")
    // Non-zero exit if STRICT_TEST_TYPES is enabled, otherwise informative advisory
    if (process.env.STRICT_TEST_TYPES === "true" || process.env.STRICT_TEST_TYPES === "1") {
        process.exit(1)
    }
    process.exit(0)
}
