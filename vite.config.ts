import { readFileSync } from "node:fs"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version: string
}

// Minimal harness for running the demo and type-checking the component.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            {
                find: /^@seihouse\/audio-player$/,
                replacement: fileURLToPath(new URL("./src/audio-player/index.ts", import.meta.url)),
            },
            {
                find: /^@seihouse\/audio-player\/reader-ui$/,
                replacement: fileURLToPath(new URL("./src/reader-ui/index.ts", import.meta.url)),
            },
        ],
    },
    // The Workshop shows which package version it is exercising.
    define: {
        __SAP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
        host: "0.0.0.0",
        port: 3000,
    },
    test: {
        include: [
            "src/**/*.{test,spec}.{ts,tsx,mjs}",
            "scripts/__tests__/**/*.{test,spec}.{ts,tsx,mjs}",
        ],
    },
})
