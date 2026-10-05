import { describe, expect, it } from "vitest"

/* The Workshop is a development surface around the published package, not part
   of it. It may only use @seihouse/audio-player through the package's public
   entry (src/audio-player/index.ts), exactly as an app would; and the package
   must never reach back into the demo, or demo code would ship in dist. */

const HERE = "file:///src/demo/workshop/__tests__/packageBoundary.test.ts"
const PACKAGE_ROOT = "/src/audio-player"
const READER_UI_ROOT = "/src/reader-ui"
const PUBLIC_ENTRY = new Set([
    PACKAGE_ROOT,
    `${PACKAGE_ROOT}/index`,
    READER_UI_ROOT,
    `${READER_UI_ROOT}/index`,
])

const demoSources = import.meta.glob<string>("../../**/*.{ts,tsx,css}", {
    query: "?raw",
    import: "default",
    eager: true,
})
const packageSources = import.meta.glob<string>("../../../audio-player/**/*.{ts,tsx,css}", {
    query: "?raw",
    import: "default",
    eager: true,
})

const IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|@import\s+)["']([^"']+)["']/g

interface SourceFile {
    path: string
    imports: { spec: string; resolved: string }[]
}

function files(sources: Record<string, string>): SourceFile[] {
    return Object.entries(sources).map(([key, text]) => {
        const path = new URL(key, HERE).pathname
        const imports = Array.from(text.matchAll(IMPORT), (match) => match[1])
            .filter((spec) => spec.startsWith("."))
            .map((spec) => ({
                spec,
                resolved: new URL(spec, `file://${path}`).pathname.replace(/\.(tsx?|js)$/, ""),
            }))
        return { path, imports }
    })
}

const inPackage = (resolved: string) =>
    resolved === PACKAGE_ROOT ||
    resolved.startsWith(`${PACKAGE_ROOT}/`) ||
    resolved === READER_UI_ROOT ||
    resolved.startsWith(`${READER_UI_ROOT}/`)

describe("package boundary", () => {
    const demo = files(demoSources)
    const pkg = files(packageSources)

    it("reads the sources it guards", () => {
        expect(demo.some((file) => file.path === "/src/demo/main.tsx")).toBe(true)
        expect(pkg.some((file) => file.path === "/src/audio-player/index.ts")).toBe(true)
    })

    it("uses the package only through its public entry from the Workshop", () => {
        const deepImports = demo.flatMap((file) =>
            file.imports
                .filter(({ resolved }) => inPackage(resolved) && !PUBLIC_ENTRY.has(resolved))
                .map(({ spec }) => `${file.path} → ${spec}`)
        )
        expect(deepImports).toEqual([])
        const entryUsers = demo.filter((file) =>
            file.imports.some(({ resolved }) => PUBLIC_ENTRY.has(resolved))
        )
        expect(entryUsers.length).toBeGreaterThan(20)
    })

    it("keeps the package self-contained", () => {
        const escapes = pkg.flatMap((file) =>
            file.imports
                .filter(({ resolved }) => !inPackage(resolved))
                .map(({ spec }) => `${file.path} → ${spec}`)
        )
        expect(escapes).toEqual([])
    })

    it("keeps the core's source independent of the optional reader UI", () => {
        const uiImports = Object.entries(packageSources)
            .filter(([file]) => !file.includes("/__tests__/"))
            .flatMap(([file, source]) =>
                Array.from(source.matchAll(IMPORT), (match) => match[1])
                    .filter(
                        (spec) =>
                            spec.includes("reader-ui") ||
                            spec === "@seihouse/ui" ||
                            spec === "react-aria-components"
                    )
                    .map((spec) => `${file} → ${spec}`)
            )
        expect(uiImports).toEqual([])
    })
})
