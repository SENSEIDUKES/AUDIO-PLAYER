import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

// Minimal harness for running the demo and type-checking the component.
export default defineConfig({
    plugins: [react()],
    test: {
        include: [
            "src/**/*.{test,spec}.{ts,tsx,mjs}",
            "scripts/__tests__/**/*.{test,spec}.{ts,tsx,mjs}",
        ],
    },
})
