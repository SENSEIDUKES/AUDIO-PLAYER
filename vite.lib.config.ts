import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"

// Library build configuration for publishing as npm package
export default defineConfig({
    plugins: [
        react(),
        dts({
            include: ["src/audio-player"],
            outDir: "dist",
            strictOutput: true,
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: "src/audio-player/index.ts",
            name: "SEIHouseAudioPlayer",
            fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
            cssFileName: "styles",
        },
        outDir: "dist",
        rollupOptions: {
            // Regexes so subpath imports (react/jsx-runtime, react-dom/client)
            // stay external too — bundling the CJS jsx-runtime leaves a bare
            // `require("react")` in the ESM output, which breaks consumers.
            external: [
                /^react($|\/)/,
                /^react-dom($|\/)/,
                "essentia.js",
                "wavesurfer.js",
            ],
            output: {
                globals: {
                    react: "React",
                    "react-dom": "ReactDOM",
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith(".css")) {
                        return "styles.css"
                    }
                    return assetInfo.name ?? "[name][extname]"
                },
            },
        },
        sourcemap: true,
        minify: false,
        cssCodeSplit: true,
    },
})
