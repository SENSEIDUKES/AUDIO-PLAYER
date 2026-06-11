import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

const host = process.env.PREVIEW_HOST ?? "127.0.0.1"
const port = Number(process.env.PREVIEW_PORT ?? 4173)
const origin = `http://${host}:${port}`
const timeoutMs = Number(process.env.PREVIEW_TIMEOUT_MS ?? 15_000)

async function stop(child) {
    if (child.exitCode !== null || child.killed) return

    if (process.platform === "win32") {
        // The preview runs under a shell wrapper (see spawn below), so kill
        // the whole process tree or vite keeps the port bound for later runs.
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]).on(
            "error",
            () => {}
        )
        await Promise.race([
            new Promise((resolve) => child.once("close", resolve)),
            delay(2_000),
        ])
        return
    }

    const killTarget = -child.pid
    try {
        process.kill(killTarget, "SIGTERM")
    } catch {
        child.kill("SIGTERM")
    }

    await Promise.race([
        new Promise((resolve) => child.once("close", resolve)),
        delay(1_000).then(() => {
            if (child.exitCode === null && !child.killed) {
                try {
                    process.kill(killTarget, "SIGKILL")
                } catch {
                    child.kill("SIGKILL")
                }
            }
        }),
    ])
}

async function waitForPreview(child) {
    const startedAt = Date.now()
    let lastError

    while (Date.now() - startedAt < timeoutMs) {
        if (child.exitCode !== null) {
            throw new Error(`Preview server exited early with code ${child.exitCode}`)
        }

        try {
            const response = await fetch(origin)
            if (response.ok) return response
            lastError = new Error(`HTTP ${response.status} from ${origin}`)
        } catch (error) {
            lastError = error
        }

        await delay(250)
    }

    throw new Error(
        `Preview server did not respond at ${origin} within ${timeoutMs}ms: ${lastError}`
    )
}

function collectAssets(html) {
    return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((asset) => asset.startsWith("/assets/"))
}

const previewArgs = [
    "vite",
    "preview",
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
]
// Node >= 20.12 refuses to spawn .cmd shims directly (EINVAL), so Windows goes
// through the shell with a pre-joined command string.
const preview =
    process.platform === "win32"
        ? spawn(["npx", ...previewArgs].join(" "), {
              shell: true,
              stdio: ["ignore", "pipe", "pipe"],
          })
        : spawn("npx", previewArgs, {
              detached: true,
              stdio: ["ignore", "pipe", "pipe"],
          })

let logs = ""
preview.stdout.on("data", (chunk) => {
    logs += chunk.toString()
})
preview.stderr.on("data", (chunk) => {
    logs += chunk.toString()
})

try {
    const response = await waitForPreview(preview)
    const html = await response.text()

    if (!html.includes('<div id="root"></div>')) {
        throw new Error("Preview HTML is missing the React root element")
    }

    const assets = collectAssets(html)
    if (assets.length === 0) {
        throw new Error("Preview HTML did not reference built assets")
    }

    await Promise.all(
        assets.map(async (asset) => {
            const assetResponse = await fetch(new URL(asset, origin))
            if (!assetResponse.ok) {
                throw new Error(`${asset} returned HTTP ${assetResponse.status}`)
            }
        })
    )

    console.log(`Preview smoke test passed at ${origin}`)
    console.log(`Verified ${assets.length} built asset(s).`)
} catch (error) {
    console.error("Preview smoke test failed.")
    console.error(error)
    if (logs.trim()) {
        console.error("\nPreview output:\n" + logs.trim())
    }
    process.exitCode = 1
} finally {
    await stop(preview)
}
