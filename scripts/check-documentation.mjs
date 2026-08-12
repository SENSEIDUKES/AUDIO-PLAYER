import { access, readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const packagePath = path.join(projectRoot, "package.json")
const expectedRepository = "https://github.com/SENSEIDUKES/AUDIO-PLAYER.git"
const currentConsumerDocs = [
    "README.md",
    "PUBLISHING_GUIDE.md",
    "PACKAGE_SETUP_COMPLETE.md",
    "AUDIO_BACKEND_GUIDE.md",
    "PLUGIN_DEVELOPMENT_GUIDE.md",
    "SPATIAL_AUDIO_GUIDE.md",
    "USAGE_EXAMPLE.tsx",
    "docs/automix.md",
    "docs/playback-hardening.md",
    "docs/public-api.md",
]

const requiredApiSections = [
    "Playback and track data",
    "Shared sessions",
    "Skins and reusable UI",
    "Plugins",
    "Cues",
    "Narrative engines",
    "Automix and analysis",
    "Workspaces and Agent Scout contracts",
    "Diagnostics",
]
const allowedPublishedReadmeRelativeLinks = new Set(["./LICENSE"])

function fail(message) {
    throw new Error(`Documentation check failed: ${message}`)
}

async function pathExists(target) {
    try {
        await access(target)
        return true
    } catch {
        return false
    }
}

async function findMarkdownFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git")
            continue

        const target = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await findMarkdownFiles(target)))
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
            files.push(target)
        }
    }

    return files
}

function localMarkdownTargets(markdown) {
    const links = markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)
    return Array.from(links, (match) => match[1].trim())
        .map((target) => target.replace(/^<|>$/g, "").split(/[?#]/, 1)[0])
        .filter(
            (target) =>
                target.length > 0 &&
                !target.startsWith("#") &&
                !target.startsWith("http:") &&
                !target.startsWith("https:") &&
                !target.startsWith("mailto:")
        )
}

const packageJson = JSON.parse(await readFile(packagePath, "utf8"))

if (packageJson.repository?.url !== expectedRepository) {
    fail(`package repository must be ${expectedRepository}`)
}

if (packageJson.homepage !== "https://github.com/SENSEIDUKES/AUDIO-PLAYER#readme") {
    fail("package homepage must point to the canonical repository README")
}

if (packageJson.bugs?.url !== "https://github.com/SENSEIDUKES/AUDIO-PLAYER/issues") {
    fail("package bugs URL must point to the canonical repository issues")
}

if (!packageJson.exports?.["."] || !packageJson.exports?.["./styles.css"]) {
    fail("package exports must expose the root module and stylesheet subpath")
}

const apiMap = await readFile(path.join(projectRoot, "docs", "public-api.md"), "utf8")
for (const section of requiredApiSections) {
    if (!apiMap.includes(section)) fail(`public API map is missing the ${section} section`)
}

const publishedReadme = await readFile(path.join(projectRoot, "README.md"), "utf8")
for (const target of localMarkdownTargets(publishedReadme)) {
    if (!allowedPublishedReadmeRelativeLinks.has(target)) {
        fail(`published README links to excluded package file ${target}`)
    }
}

for (const relativePath of currentConsumerDocs) {
    const target = path.join(projectRoot, relativePath)
    if (!(await pathExists(target))) fail(`current consumer document is missing: ${relativePath}`)

    const content = await readFile(target, "utf8")
    const stalePatterns = [
        [/github\.com\/SEIHouse\/audio-player/i, "the old GitHub repository URL"],
        [/github\.com\/YOUR_ORG\/audio-player/i, "a placeholder GitHub repository URL"],
        [/from\s+["']seihouse-audio-player["']/i, "the obsolete unscoped package import"],
        [/from\s+["']\.\/src\/audio-player["']/i, "a source-directory consumer import"],
        [
            /import\s+(?:type\s+)?\{[^}]*\buseAutomix\b[^}]*\}\s+from\s+["'][^"']+["']/s,
            "a retired useAutomix import",
        ],
        [/sap\.seaportal\.world/i, "an undesignated hosted demo URL"],
    ]

    for (const [pattern, label] of stalePatterns) {
        if (pattern.test(content)) fail(`${relativePath} still contains ${label}`)
    }
}

const markdownFiles = await findMarkdownFiles(projectRoot)
for (const markdownPath of markdownFiles) {
    const content = await readFile(markdownPath, "utf8")
    for (const target of localMarkdownTargets(content)) {
        const resolved = path.resolve(path.dirname(markdownPath), target)
        if (!(await pathExists(resolved))) {
            fail(`${path.relative(projectRoot, markdownPath)} links to missing ${target}`)
        }
    }
}

console.log("Documentation checks passed.")
