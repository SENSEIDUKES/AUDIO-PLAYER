import { spawnSync } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const npmCli = process.env.npm_execpath

if (!npmCli) {
    throw new Error("Package smoke test must be run through npm so npm_execpath is available")
}

function runNpm(args, cwd) {
    const result = spawnSync(process.execPath, [npmCli, ...args], {
        cwd,
        encoding: "utf8",
        env: {
            ...process.env,
            npm_config_audit: "false",
            npm_config_fund: "false",
        },
    })

    if (result.error) {
        throw result.error
    }

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
        throw new Error(`npm ${args.join(" ")} failed${output ? `:\n${output}` : ""}`)
    }

    return result.stdout
}

function installBrowserFakes(workerUrls) {
    const sampleRate = 44_100
    const samples = new Float32Array(sampleRate * 12).fill(0.25)
    const audioBuffer = {
        duration: samples.length / sampleRate,
        length: samples.length,
        numberOfChannels: 1,
        sampleRate,
        getChannelData: () => samples,
    }

    class FakeOfflineAudioContext {
        decodeAudioData(_data, resolve) {
            resolve(audioBuffer)
        }
    }

    class FakeWorker {
        listeners = new Map()

        constructor(url) {
            workerUrls.push(String(url))
            queueMicrotask(() => this.emit("message", { type: "ready" }))
        }

        addEventListener(type, listener) {
            const listeners = this.listeners.get(type) ?? []
            listeners.push(listener)
            this.listeners.set(type, listeners)
        }

        postMessage(request) {
            queueMicrotask(() =>
                this.emit("message", {
                    id: request.id,
                    ok: false,
                    error: "package-smoke-test",
                })
            )
        }

        terminate() {}

        emit(type, data) {
            for (const listener of this.listeners.get(type) ?? []) {
                listener({ data })
            }
        }
    }

    globalThis.fetch = async () => ({
        ok: true,
        headers: { get: () => "4" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })
    globalThis.window = { OfflineAudioContext: FakeOfflineAudioContext }
    globalThis.Worker = FakeWorker
}

async function exerciseAutomixWorker(moduleExports, label, packageRoot) {
    const workerUrls = []
    installBrowserFakes(workerUrls)

    const analysis = await moduleExports.ensureProTrackAnalysis({
        id: `package-smoke-${label}`,
        title: "Package smoke test",
        artist: "SEIHouse",
        audioFile: "/smoke.mp3",
    })

    if (!analysis || workerUrls.length !== 1) {
        throw new Error(
            `${label} Automix Pro did not construct its worker ` +
                `(analysis: ${analysis ? "present" : "missing"}, workers: ${workerUrls.length})`
        )
    }

    const workerUrl = new URL(workerUrls[0])
    if (workerUrl.protocol !== "file:") {
        throw new Error(`${label} worker URL was not package-relative: ${workerUrl.href}`)
    }

    const workerPath = fileURLToPath(workerUrl)
    const distDir = path.join(packageRoot, "dist")
    const relativeWorkerPath = path.relative(distDir, workerPath)
    if (
        !relativeWorkerPath.startsWith(`assets${path.sep}`) ||
        relativeWorkerPath.startsWith(`..${path.sep}`)
    ) {
        throw new Error(`${label} worker escaped the installed package: ${workerPath}`)
    }
    await access(workerPath)
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seihouse-audio-player-package-"))

try {
    const packDir = path.join(temporaryRoot, "pack")
    const consumerDir = path.join(temporaryRoot, "consumer")
    await mkdir(packDir)
    await mkdir(consumerDir)

    const packOutput = runNpm(
        ["pack", "--json", "--ignore-scripts", "--pack-destination", packDir],
        projectRoot
    )
    const [{ filename }] = JSON.parse(packOutput)
    const tarballPath = path.join(packDir, filename)

    await writeFile(
        path.join(consumerDir, "package.json"),
        JSON.stringify(
            {
                name: "audio-player-package-smoke-consumer",
                private: true,
                type: "module",
                dependencies: {
                    "@seihouse/audio-player": pathToFileURL(tarballPath).href,
                },
            },
            null,
            2
        )
    )
    runNpm(["install", "--ignore-scripts", "--package-lock=false"], consumerDir)

    const packageRoot = path.join(consumerDir, "node_modules", "@seihouse", "audio-player")
    const installedPackage = JSON.parse(
        await readFile(path.join(packageRoot, "package.json"), "utf8")
    )
    if (installedPackage.name !== "@seihouse/audio-player") {
        throw new Error("Packed artifact did not install as @seihouse/audio-player")
    }

    const forbiddenBrowserMarkers = [
        "VITE_OPENROUTER_API_KEY",
        "https://openrouter.ai/api/v1/chat/completions",
    ]
    for (const bundleName of ["index.js", "index.cjs"]) {
        const bundle = await readFile(path.join(packageRoot, "dist", bundleName), "utf8")
        const exposedMarker = forbiddenBrowserMarkers.find((marker) => bundle.includes(marker))
        if (exposedMarker) {
            throw new Error(`${bundleName} exposes Agent Scout provider access: ${exposedMarker}`)
        }
    }

    // No DOM globals exist here: loading the advertised CommonJS export must
    // remain safe for Node and SSR tooling.
    const requireFromConsumer = createRequire(path.join(consumerDir, "smoke.cjs"))
    const commonJsExports = requireFromConsumer("@seihouse/audio-player")
    if (typeof commonJsExports.AudioPlayer !== "function") {
        throw new Error("CommonJS package export did not load the audio player")
    }
    await exerciseAutomixWorker(commonJsExports, "CommonJS", packageRoot)

    const esmFixturePath = path.join(consumerDir, "smoke.mjs")
    await writeFile(esmFixturePath, 'export * from "@seihouse/audio-player"\n')
    const esmExports = await import(`${pathToFileURL(esmFixturePath).href}?package-smoke`)
    await exerciseAutomixWorker(esmExports, "ESM", packageRoot)

    console.log("Installed package smoke test passed.")
    console.log(
        "Verified Node CommonJS loading, package-relative Automix workers, and no browser OpenRouter access."
    )
} finally {
    await rm(temporaryRoot, { recursive: true, force: true })
}
