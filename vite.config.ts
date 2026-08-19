import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

// Minimal harness for running the demo and type-checking the component.
export default defineConfig({
    plugins: [react()],
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
