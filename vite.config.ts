import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Minimal harness for running the demo and type-checking the component.
export default defineConfig({
    plugins: [react()],
})
