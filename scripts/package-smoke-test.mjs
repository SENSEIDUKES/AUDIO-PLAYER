import { spawnSync } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
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
            // `npm publish --dry-run` exports npm_config_dry_run to its
            // lifecycle scripts. Inheriting it here would turn the pack and the
            // consumer install into no-ops and the smoke test would verify
            // nothing, so pin it off for every child npm invocation.
            npm_config_dry_run: "false",
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

function checkInstalledTypes(consumerDir, label) {
    const result = spawnSync(
        process.execPath,
        [
            path.join(projectRoot, "node_modules/typescript/bin/tsc"),
            "--noEmit",
            "--strict",
            "--skipLibCheck",
            "--module",
            "ESNext",
            "--moduleResolution",
            "Bundler",
            "--target",
            "ES2020",
            "smoke.ts",
        ],
        { cwd: consumerDir, encoding: "utf8" }
    )
    if (result.error || result.status !== 0) {
        throw (
            result.error ??
            new Error(`Installed ${label} types failed: ${result.stdout}${result.stderr}`)
        )
    }
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

/** Verify installed Voice exports, preference migration, and independent master/cleanup gates. */
function exerciseReaderVoice(moduleExports, label) {
    for (const name of [
        "ReaderMixerNote",
        "measureLoudness",
        "measureLoudnessPcm",
        "computeLoudnessGain",
    ]) {
        if (typeof moduleExports[name] !== "function") {
            throw new Error(`${label} package export is missing ${name}`)
        }
    }
    if (moduleExports.READER_MIXER_SLEEP_TIMERS.length !== 6) {
        throw new Error(`${label} package export is missing the default reader timer choices`)
    }
    if (typeof moduleExports.ReaderMixerVoice !== "function") {
        throw new Error(`${label} package export is missing ReaderMixerVoice`)
    }
    const mixer = moduleExports.createReaderMixer({
        initialPreferences: { version: 1, layers: { voice: { level: 0.4 } } },
    })
    let enabled = true
    let level = 1
    const disconnect = mixer.connectVoice({
        getState: () => ({ status: "paused", current: "tts" }),
        subscribe: () => () => {},
        setLevel: (value) => {
            level = value
        },
        setEnabled: (value) => {
            enabled = value
        },
        pause: () => {},
        resume: () => {},
    })
    try {
        mixer.setLayerAvailability({ soundscapes: false, cues: false, atmosphere: false })
        if (!mixer.getState().availability.voice || mixer.getState().availability.soundscapes) {
            throw new Error(`${label} installed mixer did not expose host availability`)
        }
        mixer.setSleepTimer("chapter-end")
        mixer.notifyChapterEnd()
        if (mixer.getState().sleepTimer.status !== "fired") {
            throw new Error(`${label} installed mixer did not expose sleep firing`)
        }
        mixer.resumeAudio()
        const pcm = Float32Array.from({ length: 48000 }, (_, index) =>
            Math.sin((2 * Math.PI * 997 * index) / 48000)
        )
        const loudness = moduleExports.measureLoudnessPcm([pcm], 48000)
        if (Math.abs(loudness.lufs + 3.01) > 0.01) {
            throw new Error(`${label} installed measurement lost 997 Hz calibration`)
        }
        const gain = moduleExports.computeLoudnessGain(
            { lufs: -10, peakDb: 0, kind: "integrated" },
            "integrated"
        )
        if (Math.abs(gain.appliedGainDb + 10) > 0.001) {
            throw new Error(`${label} installed leveling gain did not attenuate loud loops`)
        }
        if (level !== 0.4 || mixer.getPreferences().version !== 3) {
            throw new Error(`${label} installed mixer did not migrate/apply Voice preferences`)
        }
        mixer.setMasterEnabled(false)
        if (!enabled || mixer.getPreferences().layers.voice.level !== 0.4) {
            throw new Error(
                `${label} installed mixer did not preserve Voice level under master mute`
            )
        }
        disconnect()
        if (!enabled || mixer.getState().layers.voice.status !== "idle") {
            throw new Error(`${label} installed mixer did not release the Voice connection`)
        }
    } finally {
        mixer.dispose()
    }
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seihouse-audio-player-package-"))

try {
    const packDir = path.join(temporaryRoot, "pack")
    const consumerDir = path.join(temporaryRoot, "consumer")
    await mkdir(packDir)
    await mkdir(consumerDir)

    // npm 10.9.7 still runs the `prepare` lifecycle here despite
    // `--ignore-scripts`, putting the build log on stdout. That rules out
    // `npm pack --json`, whose output would be interleaved with it and no longer
    // parseable, so read the tarball back from the fresh `packDir` instead.
    runNpm(["pack", "--ignore-scripts", "--pack-destination", packDir], projectRoot)
    const packedTarballs = (await readdir(packDir)).filter((entry) => entry.endsWith(".tgz"))
    if (packedTarballs.length !== 1) {
        throw new Error(
            `Expected npm pack to write exactly one tarball, found ${packedTarballs.length}`
        )
    }
    const tarballPath = path.join(packDir, packedTarballs[0])

    await writeFile(
        path.join(consumerDir, "package.json"),
        JSON.stringify(
            {
                name: "audio-player-package-smoke-consumer",
                private: true,
                type: "module",
                dependencies: {
                    "@seihouse/audio-player": pathToFileURL(tarballPath).href,
                    react: "18.3.1",
                    "react-dom": "18.3.1",
                    "@types/react": "^18.3.0",
                    "@types/react-dom": "^18.3.0",
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
    const sourcePackage = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"))
    if (installedPackage.version !== sourcePackage.version) {
        throw new Error("Installed package version differs from the release manifest")
    }
    await access(
        path.join(packageRoot, "dist", "audio-player", "narrative", "ReaderMixerVoice.d.ts")
    )

    const forbiddenBrowserMarkers = [
        "OPENROUTER_API_KEY",
        "openrouter.ai",
        "@seihouse/ui",
        "react-aria-components",
        "reader-ui.js",
    ]
    for (const bundleName of ["index.js", "index.cjs"]) {
        const bundle = await readFile(path.join(packageRoot, "dist", bundleName), "utf8")
        const exposedMarker = forbiddenBrowserMarkers.find((marker) => bundle.includes(marker))
        if (exposedMarker) {
            throw new Error(
                `${bundleName} contains a forbidden core dependency or browser marker: ${exposedMarker}`
            )
        }
    }

    // No DOM globals exist here: loading the advertised CommonJS export must
    // remain safe for Node and SSR tooling.
    const requireFromConsumer = createRequire(path.join(consumerDir, "smoke.cjs"))
    const commonJsExports = requireFromConsumer("@seihouse/audio-player")
    if (typeof commonJsExports.AudioPlayer !== "function") {
        throw new Error("CommonJS package export did not load the audio player")
    }
    exerciseReaderVoice(commonJsExports, "CommonJS")

    if (requireFromConsumer("react/package.json").version !== "18.3.1") {
        throw new Error("Core-only smoke consumer must run React 18")
    }
    for (const peer of Object.keys(sourcePackage.peerDependenciesMeta)) {
        try {
            requireFromConsumer.resolve(peer)
        } catch (error) {
            if (error.code === "MODULE_NOT_FOUND") continue
            throw error
        }
        throw new Error(`Core-only consumer unexpectedly installed optional reader UI peer ${peer}`)
    }
    if ("ReaderMixerPanel" in commonJsExports) {
        throw new Error("The panel must be isolated in the reader-ui entry")
    }
    await writeFile(
        path.join(consumerDir, "smoke.ts"),
        `
import { createReaderMixer } from "@seihouse/audio-player"
import type { ReaderMixerNoteProps } from "@seihouse/audio-player"
const note: ReaderMixerNoteProps = { mixer: createReaderMixer(), labels: { mute: "Mute" } }
note.mixer?.dispose()
`
    )
    checkInstalledTypes(consumerDir, "React 18 core")

    const esmFixturePath = path.join(consumerDir, "smoke.mjs")
    await writeFile(esmFixturePath, 'export * from "@seihouse/audio-player"\n')
    const esmExports = await import(`${pathToFileURL(esmFixturePath).href}?package-smoke`)
    exerciseReaderVoice(esmExports, "ESM")
    await exerciseAutomixWorker(commonJsExports, "CommonJS", packageRoot)
    await exerciseAutomixWorker(esmExports, "ESM", packageRoot)

    const uiConsumerDir = path.join(temporaryRoot, "reader-ui-consumer")
    await mkdir(uiConsumerDir)
    await writeFile(
        path.join(uiConsumerDir, "package.json"),
        JSON.stringify(
            {
                name: "audio-player-reader-ui-smoke-consumer",
                private: true,
                type: "module",
                dependencies: {
                    "@seihouse/audio-player": pathToFileURL(tarballPath).href,
                    ...Object.fromEntries(
                        Object.keys(sourcePackage.peerDependenciesMeta).map((peer) => [
                            peer,
                            sourcePackage.peerDependencies[peer],
                        ])
                    ),
                    "@seihouse/ui": pathToFileURL(
                        path.join(projectRoot, "vendor/seihouse-ui-0.10.1.tgz")
                    ).href,
                    react: "19.2.0",
                    "react-dom": "19.2.0",
                    "@types/react": "^19.2.0",
                    "@types/react-dom": "^19.2.0",
                },
            },
            null,
            2
        )
    )
    runNpm(["install", "--ignore-scripts", "--package-lock=false"], uiConsumerDir)
    const uiFixture = path.join(uiConsumerDir, "smoke.mjs")
    await writeFile(
        uiFixture,
        `
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createReaderMixer, ReaderMixerProvider } from "@seihouse/audio-player"
import { ReaderMixerPanel, DEFAULT_READER_MIXER_LABELS } from "@seihouse/audio-player/reader-ui"
const mixer = createReaderMixer()
try {
    const html = renderToStaticMarkup(createElement(ReaderMixerProvider, { mixer }, createElement(ReaderMixerPanel)))
    assert.ok(html.includes("Soundscapes volume"), "UI entry must share the root provider's context")
    assert.ok(html.includes('role="switch"'))
    assert.ok(html.includes('type="range"'))
    assert.ok(html.includes("Sleep timer"))
    assert.equal(DEFAULT_READER_MIXER_LABELS.master, "Master")
    assert.ok(import.meta.resolve("@seihouse/audio-player/reader-ui/styles.css").endsWith("reader-ui.css"))
} finally { mixer.dispose() }
`
    )
    const uiResult = spawnSync(process.execPath, [uiFixture], {
        cwd: uiConsumerDir,
        encoding: "utf8",
    })
    if (uiResult.error || uiResult.status !== 0) {
        throw uiResult.error ?? new Error(`Installed reader UI failed: ${uiResult.stderr}`)
    }
    // Compile against the packed declarations, not source aliases. A duplicated
    // ReaderMixer declaration would make this explicit mixer prop incompatible.
    await writeFile(
        path.join(uiConsumerDir, "smoke.ts"),
        `
import { createReaderMixer } from "@seihouse/audio-player"
import type { ReaderMixerPanelProps } from "@seihouse/audio-player/reader-ui"
const props: ReaderMixerPanelProps = { mixer: createReaderMixer(), labels: { volume: name => name } }
props.mixer?.dispose()
`
    )
    checkInstalledTypes(uiConsumerDir, "React 19 reader UI")
    const readerUiBundle = await readFile(
        path.join(uiConsumerDir, "node_modules/@seihouse/audio-player/dist/reader-ui.js"),
        "utf8"
    )
    if (
        !readerUiBundle.includes('from "@seihouse/ui"') ||
        !readerUiBundle.includes('from "@seihouse/audio-player"')
    ) {
        throw new Error("Reader UI must use the external approved UI and core entries")
    }

    console.log("Installed package smoke test passed.")
    console.log(
        "Verified React 18 core without UI peers, React 19 reader UI with the shared provider and packed types, package-relative Automix workers, and no browser OpenRouter access."
    )
} finally {
    await rm(temporaryRoot, { recursive: true, force: true })
}
