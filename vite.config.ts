import { readFileSync } from "node:fs"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    version: string
}

// Minimal harness for running the demo and type-checking the component.
export default defineConfig({
    plugins: [react()],
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
