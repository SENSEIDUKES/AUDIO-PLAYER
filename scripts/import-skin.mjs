#!/usr/bin/env node
/**
 * Sea-Workshop-Light → SAP skin import CLI.
 *
 * Usage:
 *   npm run skin:import -- --in <path> --slot <slot> --name "<Name>"
 *
 * See IMPORTING.md for full documentation.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { scopeCss } from "./lib/scopeCss.mjs"
import { slugify, toPascal, toCamel } from "./lib/idHelpers.mjs"

// ─── Paths ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..")
const IMPORTED_DIR = path.join(
    PROJECT_ROOT,
    "src",
    "audio-player",
    "visual-slots",
    "components",
    "imported"
)
const GENERATED_BARREL = path.join(
    PROJECT_ROOT,
    "src",
    "audio-player",
    "visual-slots",
    "importedSkins.generated.ts"
)

// ─── CLI flag parsing ────────────────────────────────────────────────────────

const VALID_SLOTS = ["seiCanvas", "scrubberCanvas", "controllerPanel"]
const VALID_FORMATS = ["auto", "react", "split", "tailwind"]

function parseArgs(argv) {
    const args = argv.slice(2)
    const flags = {
        in: null,
        slot: "seiCanvas",
        name: null,
        id: null,
        format: "auto",
        force: false,
    }

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--in":
                flags.in = args[++i]
                break
            case "--slot":
                flags.slot = args[++i]
                break
            case "--name":
                flags.name = args[++i]
                break
            case "--id":
                flags.id = args[++i]
                break
            case "--format":
                flags.format = args[++i]
                break
            case "--force":
                flags.force = true
                break
            case "--help":
            case "-h":
                printUsage()
                process.exit(0)
                break
            default:
                fatal(`Unknown flag: ${args[i]}. Run with --help for usage.`)
        }
    }

    // Validation
    if (!flags.in) fatal("--in is required.")
    if (!flags.name) fatal("--name is required.")
    if (!VALID_SLOTS.includes(flags.slot)) {
        fatal(`--slot must be one of: ${VALID_SLOTS.join(", ")}`)
    }
    if (!VALID_FORMATS.includes(flags.format)) {
        fatal(`--format must be one of: ${VALID_FORMATS.join(", ")}`)
    }

    flags.in = path.resolve(flags.in)
    flags.id = flags.id || slugify(flags.name)

    if (!flags.id) fatal("Could not derive an id from the name. Pass --id explicitly.")

    return flags
}

function printUsage() {
    console.log(`
Sea-Workshop-Light Skin Importer
─────────────────────────────────

Usage:
  npm run skin:import -- --in <path> --slot <slot> --name "<Name>"

Flags:
  --in <path>       Path to a .tsx/.jsx file (formats #2/#3) or a directory
                    containing *.html + *.css + *.js (format #1). Required.
  --slot <slot>     Target slot: seiCanvas | scrubberCanvas | controllerPanel.
                    Default: seiCanvas.
  --name "<Name>"   Display name for the skin. Required.
  --id <id>         Override the auto-slugified id.
  --format <fmt>    Force format detection: auto | react | split | tailwind.
                    Default: auto.
  --force           Overwrite an existing skin folder.
  --help            Show this message.
`)
}

// ─── Format detection ────────────────────────────────────────────────────────

function detectFormat(inputPath, forced) {
    if (forced !== "auto") return forced

    const stat = fs.statSync(inputPath, { throwIfNoEntry: false })
    if (!stat) fatal(`Input path does not exist: ${inputPath}`)

    if (stat.isDirectory()) {
        const files = fs.readdirSync(inputPath)
        if (files.some((f) => f.endsWith(".html"))) return "split"
        // Directory with .tsx/.jsx but no .html → treat as react (format #2)
        const reactFile = files.find(
            (f) => f.endsWith(".tsx") || f.endsWith(".jsx")
        )
        if (reactFile) {
            const content = fs.readFileSync(
                path.join(inputPath, reactFile),
                "utf-8"
            )
            const hasTailwind =
                /class(?:Name)?=["'][^"']*\b(?:flex|grid|p-|m-|text-|bg-|rounded|shadow|border)\b/i.test(
                    content
                )
            return hasTailwind ? "tailwind" : "react"
        }
        fatal(
            "Directory input detected but no .html, .tsx, or .jsx file found."
        )
    }

    // Single file — detect react vs tailwind
    if (stat.isFile()) {
        const ext = path.extname(inputPath).toLowerCase()
        if (![".tsx", ".jsx"].includes(ext)) {
            fatal(`File must be .tsx or .jsx, got: ${ext}`)
        }
        const content = fs.readFileSync(inputPath, "utf-8")
        // Heuristic: look for Tailwind utility classes in className strings
        const hasTailwind = /class(?:Name)?=["'][^"']*\b(?:flex|grid|p-|m-|text-|bg-|rounded|shadow|border)\b/i.test(content)
        return hasTailwind ? "tailwind" : "react"
    }

    fatal(`Input is neither a file nor a directory: ${inputPath}`)
}

/**
 * For directory inputs with react/tailwind format, resolve the actual .tsx/.jsx
 * entry file. Returns the original path for file inputs or split format.
 */
function resolveInputFile(inputPath, format) {
    const stat = fs.statSync(inputPath)
    if (stat.isFile()) return inputPath
    if (format === "split") return inputPath // directory stays as-is for split

    // Directory + react/tailwind: find the .tsx/.jsx entry
    const files = fs.readdirSync(inputPath)
    const reactFile = files.find(
        (f) => f.endsWith(".tsx") || f.endsWith(".jsx")
    )
    if (!reactFile) fatal("No .tsx/.jsx file found in directory for react format.")
    return path.join(inputPath, reactFile)
}

// ─── Code generation templates ───────────────────────────────────────────────

function reactAdapterTemplate({ id, pascal, camel, slot, name, hasCSS }) {
    return `/**
 * Auto-generated adapter for "${name}".
 * Wraps the raw Workshop-Light component in a SAP VisualComponentDefinition.
 *
 * ⚡ Review the TODO(skin) block below to map the raw component's props to
 *    SAP's settings and playback context. The adapter passes settings/playback
 *    through as-is until you wire them to the raw component's API.
 */
import type {
    VisualComponentDefinition,
    VisualComponentProps,
    VisualSettingsPanelProps,
} from "../../../types"
import RawComponent from "./raw"
${hasCSS ? `import "./${id}.css"\n` : ""}
// ─── Settings ────────────────────────────────────────────────────────────────

/** Default settings for this skin. Edit to match your component's API. */
export const ${camel}DefaultSettings: Record<string, unknown> = {
    // TODO(skin): add default settings that your component needs.
}

type ${pascal}Settings = Record<string, unknown>

// ─── Component ───────────────────────────────────────────────────────────────

export function ${pascal}({ settings, playback }: VisualComponentProps<${pascal}Settings>) {
    // TODO(skin): map \`settings\` and \`playback\` to props your raw component expects.
    // Example: <RawComponent primaryColor={settings.primaryColor as string} />
    void settings
    void playback
    return (
        <div className="sap-visual-${id}">
            <RawComponent />
        </div>
    )
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

export function ${pascal}SettingsPanel({
    settings,
    onChange,
}: VisualSettingsPanelProps<${pascal}Settings>) {
    void settings
    void onChange
    return (
        <div className="sap-visual-settings">
            {/* TODO(skin): build settings controls for your component. */}
            <p style={{ opacity: 0.6, fontSize: 12 }}>
                No settings configured yet. Edit this panel in {${pascal}.name}.tsx.
            </p>
        </div>
    )
}

// ─── Definition ──────────────────────────────────────────────────────────────

export const ${camel}Definition: VisualComponentDefinition<${pascal}Settings> = {
    id: "${id}",
    name: "${name}",
    slot: "${slot}",
    Component: ${pascal},
    SettingsPanel: ${pascal}SettingsPanel,
    defaultSettings: ${camel}DefaultSettings,
}
`
}

function splitAdapterTemplate({ id, pascal, camel, slot, name }) {
    return `/**
 * Auto-generated adapter for "${name}" (format #1: split HTML/CSS/JS).
 * Uses dangerouslySetInnerHTML to inject the markup and runs behavior.js
 * against the container node via useEffect.
 *
 * ⚠️ Caveats:
 *   - behavior.js runs with \`this\` bound to the container DOM node.
 *   - Top-level imports/exports in behavior.js won't work (it's evaluated
 *     as a plain script body).
 *   - Scripts that add global event listeners (window.addEventListener)
 *     will persist — consider cleanup in the returned function, or
 *     refactor to format #2.
 */
import { useEffect, useRef } from "react"
import type {
    VisualComponentDefinition,
    VisualComponentProps,
    VisualSettingsPanelProps,
} from "../../../types"
import { MARKUP } from "./markup.html"
import BEHAVIOR_SRC from "./behavior.js?raw"
import "./${id}.css"

// ─── Settings ────────────────────────────────────────────────────────────────

export const ${camel}DefaultSettings: Record<string, unknown> = {
    // TODO(skin): add default settings that your component needs.
}

type ${pascal}Settings = Record<string, unknown>

// ─── Component ───────────────────────────────────────────────────────────────

export function ${pascal}({ settings, playback }: VisualComponentProps<${pascal}Settings>) {
    const containerRef = useRef<HTMLDivElement>(null)

    // TODO(skin): map \`settings\` and \`playback\` to the behavior script's needs.
    void settings
    void playback

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        // Run the behavior script scoped to this container.
        try {
            const fn = new Function("container", BEHAVIOR_SRC)
            fn(el)
        } catch (err) {
            console.error("[${id}] behavior.js error:", err)
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className="sap-visual-${id}"
            dangerouslySetInnerHTML={{ __html: MARKUP }}
        />
    )
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

export function ${pascal}SettingsPanel({
    settings,
    onChange,
}: VisualSettingsPanelProps<${pascal}Settings>) {
    void settings
    void onChange
    return (
        <div className="sap-visual-settings">
            {/* TODO(skin): build settings controls for your component. */}
            <p style={{ opacity: 0.6, fontSize: 12 }}>
                No settings configured yet. Edit this panel in {${pascal}.name}.tsx.
            </p>
        </div>
    )
}

// ─── Definition ──────────────────────────────────────────────────────────────

export const ${camel}Definition: VisualComponentDefinition<${pascal}Settings> = {
    id: "${id}",
    name: "${name}",
    slot: "${slot}",
    Component: ${pascal},
    SettingsPanel: ${pascal}SettingsPanel,
    defaultSettings: ${camel}DefaultSettings,
}
`
}

function readmeTemplate({ id, name, format, slot }) {
    const formatLabel =
        format === "react"
            ? "#2 (structured React)"
            : format === "split"
              ? "#1 (split HTML/CSS/JS)"
              : "#3 (Tailwind React)"

    return `# ${name}

Imported from Sea-Workshop-Light format ${formatLabel}.

| Property | Value |
|----------|-------|
| **ID** | \`${id}\` |
| **Slot** | \`${slot}\` |
| **Format** | ${formatLabel} |

## Review Checklist

- [ ] Open the adapter (\`${toPascal(id)}.tsx\`) and map \`settings\`/\`playback\` to the raw component's props in the \`TODO(skin)\` block.
- [ ] Add meaningful default settings in \`${toCamel(id)}DefaultSettings\`.
- [ ] Build out the \`SettingsPanel\` stub with controls for each setting.
- [ ] Verify the scoped CSS (\`${id}.css\`) doesn't contain un-scoped selectors (check the header comment).
- [ ] Run \`npm run build\` to confirm everything compiles.
${format === "tailwind" ? "\n> ⚠️ **Tailwind utilities** detected — they won't render unless Tailwind is configured in the build pipeline. Consider re-exporting from Workshop-Light as format #2.\n" : ""}
`
}

// ─── Main logic ──────────────────────────────────────────────────────────────

function main() {
    const flags = parseArgs(process.argv)
    const format = detectFormat(flags.in, flags.format)
    // For directory inputs with react/tailwind, resolve the actual .tsx/.jsx file
    const resolvedIn = resolveInputFile(flags.in, format)
    const { id, name, slot, force } = flags
    const pascal = toPascal(id)
    const camel = toCamel(id)

    console.log(`\n🎨 Importing skin: "${name}" (${format})\n`)
    console.log(`   ID:     ${id}`)
    console.log(`   Slot:   ${slot}`)
    console.log(`   Format: ${format}`)

    // Create output directory
    const outDir = path.join(IMPORTED_DIR, id)
    if (fs.existsSync(outDir)) {
        if (!force) {
            fatal(
                `Output directory already exists: ${outDir}\n   Use --force to overwrite.`
            )
        }
        console.log(`   ⚠️  Overwriting existing skin folder.`)
        fs.rmSync(outDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outDir, { recursive: true })

    // ── Process by format ────────────────────────────────────────────────────

    let hasCSS = false

    if (format === "react" || format === "tailwind") {
        // Copy the source file preserving its original extension
        const src = fs.readFileSync(resolvedIn, "utf-8")
        const ext = path.extname(resolvedIn).toLowerCase()
        const rawFileName = `raw${ext}`
        fs.writeFileSync(path.join(outDir, rawFileName), src, "utf-8")

        // Look specifically for a CSS file matching the base name of the input file
        const inputDir = path.dirname(resolvedIn)
        const baseName = path.basename(resolvedIn, path.extname(resolvedIn))
        const expectedCssPath = path.join(inputDir, `${baseName}.css`)
        if (fs.existsSync(expectedCssPath)) {
            const rawCSS = fs.readFileSync(expectedCssPath, "utf-8")
            const scopedCSS = scopeCss(rawCSS, `sap-visual-${id}`, id)
            fs.writeFileSync(path.join(outDir, `${id}.css`), scopedCSS, "utf-8")
            hasCSS = true
        }

        // Generate adapter
        const adapter = reactAdapterTemplate({ id, pascal, camel, slot, name, hasCSS })
        fs.writeFileSync(path.join(outDir, `${pascal}.tsx`), adapter, "utf-8")

        if (format === "tailwind") {
            console.log(
                `\n   ⚠️  Tailwind utilities detected in this component.`
            )
            console.log(
                `      Utilities won't render unless Tailwind is configured.`
            )
            console.log(
                `      Recommend: re-export from Workshop-Light as format #2.\n`
            )
        }
    } else if (format === "split") {
        // Read all files from the directory
        const files = fs.readdirSync(flags.in)
        const htmlFile = files.find((f) => f.endsWith(".html"))
        const cssFile = files.find((f) => f.endsWith(".css"))
        const jsFile = files.find((f) => f.endsWith(".js"))

        if (!htmlFile) fatal("No .html file found in the input directory.")

        // markup.html.ts — export the HTML as a string
        const html = fs.readFileSync(path.join(flags.in, htmlFile), "utf-8")
        const markupTs = `// Auto-generated HTML markup from split export.\n// Do not edit — changes will be overwritten on re-import.\n\nexport const MARKUP = ${JSON.stringify(html)}\n`
        fs.writeFileSync(path.join(outDir, "markup.html.ts"), markupTs, "utf-8")

        // behavior.js — copy verbatim
        if (jsFile) {
            fs.copyFileSync(
                path.join(flags.in, jsFile),
                path.join(outDir, "behavior.js")
            )
        } else {
            // Write an empty behavior stub
            fs.writeFileSync(
                path.join(outDir, "behavior.js"),
                "// No behavior script in the original export.\n",
                "utf-8"
            )
        }

        // CSS — scope and write
        if (cssFile) {
            const rawCSS = fs.readFileSync(path.join(flags.in, cssFile), "utf-8")
            const scopedCSS = scopeCss(rawCSS, `sap-visual-${id}`, id)
            fs.writeFileSync(path.join(outDir, `${id}.css`), scopedCSS, "utf-8")
        }

        // Generate split adapter
        const adapter = splitAdapterTemplate({ id, pascal, camel, slot, name })
        fs.writeFileSync(path.join(outDir, `${pascal}.tsx`), adapter, "utf-8")
    }

    // Generate README
    const readme = readmeTemplate({ id, name, format, slot })
    fs.writeFileSync(path.join(outDir, "README.md"), readme, "utf-8")

    console.log(`\n   ✅ Skin files written to: ${path.relative(PROJECT_ROOT, outDir)}/`)

    // ── Regenerate barrel ────────────────────────────────────────────────────
    regenerateBarrel()

    console.log(`   ✅ importedSkins.generated.ts regenerated.`)
    console.log(`\n   Next steps:`)
    console.log(`   1. Open ${pascal}.tsx and map props in the TODO(skin) block.`)
    console.log(`   2. Run \`npm run build\` to verify.`)
    console.log(`   3. Test in the app: Plugin ▸ Visual ▸ Canvas.\n`)
}

// ─── Barrel regeneration ─────────────────────────────────────────────────────

function regenerateBarrel() {
    // Ensure the imported directory exists
    fs.mkdirSync(IMPORTED_DIR, { recursive: true })

    const entries = fs.readdirSync(IMPORTED_DIR, { withFileTypes: true })
    const skinDirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()

    /** @type {{ id: string, pascal: string, camel: string }[]} */
    const skins = []

    for (const dirName of skinDirs) {
        const pascal = toPascal(dirName)
        const camel = toCamel(dirName)
        // Verify the adapter file exists
        const adapterPath = path.join(IMPORTED_DIR, dirName, `${pascal}.tsx`)
        if (fs.existsSync(adapterPath)) {
            skins.push({ id: dirName, pascal, camel })
        }
    }

    const imports = skins
        .map(
            (s) =>
                `import { ${s.camel}Definition } from "./components/imported/${s.id}/${s.pascal}"`
        )
        .join("\n")

    const arrayEntries = skins.map((s) => `    ${s.camel}Definition,`).join("\n")

    const content = `// AUTO-GENERATED by \`npm run skin:import\`. Do not edit manually.
// Re-run the importer or delete skin folders and re-run to regenerate.
${skins.length > 0 ? "\n" + imports + "\n" : ""}
import type { AnyVisualComponentDefinition } from "./types"

export const IMPORTED_VISUAL_SKINS: AnyVisualComponentDefinition[] = [
${arrayEntries}
]
`

    fs.writeFileSync(GENERATED_BARREL, content, "utf-8")
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fatal(msg) {
    console.error(`\n❌ ${msg}\n`)
    process.exit(1)
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main()
