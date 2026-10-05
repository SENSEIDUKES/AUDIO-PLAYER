import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"

export default defineConfig({
    plugins: [
        react(),
        dts({
            tsconfigPath: "tsconfig.reader-ui.json",
            include: ["src/reader-ui"],
            exclude: ["src/reader-ui/__tests__/**"],
            entryRoot: "src/reader-ui",
            outDirs: "dist/reader-ui",
        }),
    ],
    build: {
        emptyOutDir: false,
        lib: {
            entry: "src/reader-ui/index.ts",
            formats: ["es"],
            fileName: () => "reader-ui.js",
            cssFileName: "reader-ui",
        },
        rolldownOptions: {
            external: [
                /^react($|\/)/,
                /^react-dom($|\/)/,
                /^@seihouse\/ui($|\/)/,
                /^@seihouse\/audio-player$/,
            ],
        },
        sourcemap: true,
    },
})
