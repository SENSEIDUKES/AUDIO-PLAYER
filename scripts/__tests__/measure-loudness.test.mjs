import { execFile } from "node:child_process"
import { mkdtemp, open, readFile, rmdir, unlink, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const exec = promisify(execFile)
const script = fileURLToPath(new URL("../measure-loudness.mjs", import.meta.url))
let directory
let files
let server

beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "reader-loudness-test-"))
    files = []
})
afterEach(async () => {
    if (server) {
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
        server = undefined
    }
    await Promise.all(files.map((file) => unlink(file)))
    await rmdir(directory)
})

async function fixture(name, contents) {
    const path = join(directory, name)
    await writeFile(path, contents)
    files.push(path)
    return path
}
async function run(entries) {
    const manifest = await fixture("manifest.json", JSON.stringify(entries))
    try {
        return { ...(await exec(process.execPath, [script, `--manifest=${manifest}`])), code: 0 }
    } catch (error) {
        return { stdout: error.stdout, stderr: error.stderr, code: error.code }
    }
}
function sineWav() {
    const sampleRate = 48000
    const samples = sampleRate / 2
    const bytes = Buffer.alloc(44 + samples * 2)
    bytes.write("RIFF", 0)
    bytes.writeUInt32LE(bytes.length - 8, 4)
    bytes.write("WAVEfmt ", 8)
    bytes.writeUInt32LE(16, 16)
    bytes.writeUInt16LE(1, 20)
    bytes.writeUInt16LE(1, 22)
    bytes.writeUInt32LE(sampleRate, 24)
    bytes.writeUInt32LE(sampleRate * 2, 28)
    bytes.writeUInt16LE(2, 32)
    bytes.writeUInt16LE(16, 34)
    bytes.write("data", 36)
    bytes.writeUInt32LE(samples * 2, 40)
    for (let i = 0; i < samples; i++)
        bytes.writeInt16LE(
            Math.round(8192 * Math.sin((2 * Math.PI * 997 * i) / sampleRate)),
            44 + i * 2
        )
    return bytes
}

describe("loudness CLI input failures", () => {
    it("reports malformed sources and keeps measuring valid files in the same manifest", async () => {
        const source = await fixture("tone.wav", sineWav())
        const result = await run([
            null,
            {},
            { source: null },
            { source: 42 },
            { source: false },
            { source: "" },
            { source: "   " },
            { id: "valid", source },
        ])
        expect(result.code).toBe(1)
        const rows = JSON.parse(result.stdout)
        expect(rows).toHaveLength(8)
        for (const row of rows.slice(0, -1))
            expect(row.error).toBe("Source must be a non-empty file path or URL string")
        expect(rows[7].id).toBe("valid")
        expect(rows[7].loudness.lufs).toBeTypeOf("number")
        expect(rows[7].sha256).toMatch(/^[a-f0-9]{64}$/)
        expect(await readFile(source)).toEqual(sineWav())
    })

    it("reports empty HTTP bodies and continues to a valid URL", async () => {
        server = createServer((request, response) => {
            if (request.url === "/no-content") response.writeHead(204).end()
            else if (request.url === "/empty") response.writeHead(200).end()
            else response.writeHead(200, { "Content-Type": "audio/wav" }).end(sineWav())
        })
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
        const root = `http://127.0.0.1:${server.address().port}`
        const result = await run([
            { source: `${root}/no-content` },
            { source: `${root}/empty` },
            { source: `${root}/tone.wav` },
        ])
        expect(result.code).toBe(1)
        const rows = JSON.parse(result.stdout)
        expect(rows.slice(0, 2).map((row) => row.error)).toEqual([
            "Source has no response body",
            "Source is empty",
        ])
        expect(rows[2].loudness.lufs).toBeTypeOf("number")
    })

    it.each([null, {}, "invalid"])(
        "rejects a manifest that is not an array (%j)",
        async (entries) => {
            const result = await run(entries)
            expect(result.code).toBe(1)
            expect(result.stderr).toContain("Manifest must be an array of sound entries")
        }
    )
    it("keeps request tokens out of saved results and progress/errors", async () => {
        const requests = []
        server = createServer((request, response) => {
            requests.push(request.url)
            response.writeHead(200, { "Content-Type": "audio/wav" }).end(sineWav())
        })
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
        const host = `127.0.0.1:${server.address().port}`
        const result = await run([
            { source: `http://${host}/tone.wav?token=secret-query#private-fragment` },
            {
                source: `http://private-user:private-password@${host}/tone.wav?token=another-secret`,
            },
        ])
        expect(result.code).toBe(1)
        expect(requests).toEqual(["/tone.wav?token=secret-query"])
        expect(result.stdout + result.stderr).not.toMatch(
            /secret-query|private-fragment|private-user|private-password|another-secret/
        )
        const rows = JSON.parse(result.stdout)
        expect(rows[0].loudness.lufs).toBeTypeOf("number")
        expect(rows.map((row) => row.source)).toEqual([
            `http://${host}/tone.wav`,
            `http://${host}/tone.wav`,
        ])
        expect(rows[1].error).toBeTypeOf("string")
    })
    it("rejects an oversized local file before decoding and continues the batch", async () => {
        const source = await fixture("oversized.wav", "")
        const handle = await open(source, "r+")
        try {
            await handle.truncate(256 * 1024 * 1024 + 1)
        } finally {
            await handle.close()
        }
        const valid = await fixture("tone.wav", sineWav())
        const result = await run([{ source }, { source: valid }])
        expect(result.code).toBe(1)
        const rows = JSON.parse(result.stdout)
        expect(rows[0].error).toBe("Source exceeds the 256 MiB measurement limit")
        expect(rows[1].loudness.lufs).toBeTypeOf("number")
    })
})
