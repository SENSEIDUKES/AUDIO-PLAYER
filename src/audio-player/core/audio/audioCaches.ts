import {
    AudioResourceLimitError,
    getAudioResourcePolicy,
    getAudioResourceStats,
    readBoundedAudio,
} from "./audioResources"

/** Shared decoded-buffer LRU cache for Web Audio playback. */
export class LRUAudioCache {
    private cache = new Map<string, AudioBuffer>()
    private decodedBufferBytes = 0

    constructor(
        private maxSize = 4,
        private readonly maxDecodedBufferBytes = 250 * 1024 * 1024
    ) {}

    private getBufferBytes(buffer: AudioBuffer): number {
        const bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT
        return Number.isFinite(bytes) && bytes > 0 ? bytes : 0
    }

    private deleteEntry(url: string): boolean {
        const buffer = this.cache.get(url)
        if (!buffer) return false

        this.decodedBufferBytes = Math.max(0, this.decodedBufferBytes - this.getBufferBytes(buffer))
        return this.cache.delete(url)
    }

    getStats() {
        return {
            decodedBufferCount: this.cache.size,
            decodedBufferBytes: this.decodedBufferBytes,
            lruOrder: [...this.cache.keys()],
        }
    }

    setMaxSize(size: number) {
        this.maxSize = size
        this.enforceSize()
    }

    prune(keepKeys: string[], keepRecent: number = 0) {
        const toKeep = new Set(keepKeys)
        const keys = [...this.cache.keys()]
        let recentKept = 0

        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i]
            if (toKeep.has(key)) continue

            if (recentKept < keepRecent) {
                recentKept++
                continue
            }

            this.deleteEntry(key)
        }
    }

    private enforceSize() {
        while (
            this.cache.size > 0 &&
            (this.cache.size > this.maxSize || this.decodedBufferBytes > this.maxDecodedBufferBytes)
        ) {
            const oldestKey = this.cache.keys().next().value as string
            // A single oversized buffer is evicted too, keeping the byte cap strict.
            this.deleteEntry(oldestKey)
        }
    }

    get(url: string): AudioBuffer | null {
        const buffer = this.cache.get(url)
        if (!buffer) return null

        this.cache.delete(url)
        this.cache.set(url, buffer)

        return buffer
    }

    set(url: string, buffer: AudioBuffer): void {
        this.deleteEntry(url)
        this.cache.set(url, buffer)
        this.decodedBufferBytes += this.getBufferBytes(buffer)
        this.enforceSize()
    }

    has(url: string): boolean {
        return this.cache.has(url)
    }

    delete(url: string): void {
        this.deleteEntry(url)
    }

    clear(): void {
        this.cache.clear()
        this.decodedBufferBytes = 0
    }
}

function getMimeType(url: string): string {
    const pathname = url.split("?")[0]?.toLowerCase() ?? ""
    if (pathname.endsWith(".wav")) return "audio/wav"
    if (pathname.endsWith(".ogg") || pathname.endsWith(".oga")) return "audio/ogg"
    if (pathname.endsWith(".m4a") || pathname.endsWith(".mp4")) return "audio/mp4"
    if (pathname.endsWith(".aac")) return "audio/aac"
    if (pathname.endsWith(".flac")) return "audio/flac"
    if (pathname.endsWith(".webm")) return "audio/webm"
    return "audio/mpeg"
}

export interface AudioCacheRetention {
    maxEntries: number
    maxBytes: number
    maxAgeMs: number
}

/** Persistent raw audio cache with FIFO retention and serialized mutations. */
export class PersistentAudioCache {
    private readonly cacheName = "seihouse-audio-vault-v1"
    private tail: Promise<unknown> = Promise.resolve()
    private retention: AudioCacheRetention = {
        maxEntries: 32,
        maxBytes: 256 * 1024 * 1024,
        maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    }

    private get isAvailable(): boolean {
        return typeof caches !== "undefined" && typeof Response !== "undefined"
    }

    private serial<T>(work: () => Promise<T>): Promise<T> {
        const pending = this.tail.then(work)
        this.tail = pending.catch(() => {})
        return pending
    }

    /** Apply defined retention options atomically, then prune existing disk entries. */
    async configureRetention(next: Partial<AudioCacheRetention>): Promise<void> {
        const updated = { ...this.retention }
        for (const key of Object.keys(updated) as (keyof AudioCacheRetention)[]) {
            const value = next[key]
            if (value === undefined) continue
            if (!Number.isSafeInteger(value) || value < 0)
                throw new RangeError("Cache retention limits must be nonnegative integers.")
            updated[key] = value
        }
        this.retention = updated
        await this.prune()
    }

    /** Remove expired/legacy entries and evict oldest entries until storage limits hold. */
    private async trim(cache: Cache): Promise<void> {
        const entries: Array<{ key: Request; bytes: number }> = []
        let total = 0
        for (const key of await cache.keys()) {
            const response = await cache.match(key)
            const saved = Number(response?.headers.get("X-SEI-Audio-Saved"))
            const bytes = Number(response?.headers.get("Content-Length"))
            if (
                !saved ||
                Date.now() - saved >= this.retention.maxAgeMs ||
                !Number.isFinite(bytes) ||
                bytes <= 0
            ) {
                await cache.delete(key)
            } else {
                entries.push({ key, bytes })
                total += bytes
            }
        }
        while (entries.length > this.retention.maxEntries || total > this.retention.maxBytes) {
            const entry = entries.shift()!
            total -= entry.bytes
            await cache.delete(entry.key)
        }
    }

    async prune(): Promise<void> {
        await this.serial(async () => {
            if (!this.isAvailable) return
            try {
                await this.trim(await caches.open(this.cacheName))
            } catch {
                /* Storage is best effort. */
            }
        })
    }

    async delete(url: string): Promise<void> {
        await this.serial(async () => {
            if (!this.isAvailable) return
            try {
                await (await caches.open(this.cacheName)).delete(url)
            } catch {
                /* Storage is best effort. */
            }
        })
    }

    async clear(): Promise<void> {
        await this.serial(async () => {
            if (!this.isAvailable) return
            try {
                await caches.delete(this.cacheName)
            } catch {
                /* Storage is best effort. */
            }
        })
    }

    /** Read fresh bytes within the caller's memory limit, preserving healthy oversized entries. */
    async getArrayBuffer(
        url: string,
        maxBytes = getAudioResourcePolicy().maxEncodedBytes
    ): Promise<ArrayBuffer | null> {
        if (!this.isAvailable) return null
        try {
            await this.tail
            const cache = await caches.open(this.cacheName)
            const response = await cache.match(url)
            if (!response) return null
            const saved = Number(response.headers.get("X-SEI-Audio-Saved"))
            if (
                !saved ||
                Date.now() - saved >= this.retention.maxAgeMs ||
                !this.retention.maxEntries ||
                !this.retention.maxBytes
            ) {
                await this.delete(url)
                return null
            }
            try {
                return await readBoundedAudio(response, Math.min(maxBytes, this.retention.maxBytes))
            } catch (error) {
                // A per-load limit does not make an otherwise valid offline copy corrupt.
                if (error instanceof AudioResourceLimitError) return null
                await this.delete(url)
                return null
            }
        } catch {
            return null
        }
    }

    /** Serialize best-effort writes with deletion and enforce retention after each write. */
    async putArrayBuffer(url: string, buffer: ArrayBuffer): Promise<void> {
        await this.serial(async () => {
            if (
                !this.isAvailable ||
                !this.retention.maxEntries ||
                !this.retention.maxAgeMs ||
                buffer.byteLength > this.retention.maxBytes ||
                buffer.byteLength > getAudioResourcePolicy().maxEncodedBytes
            )
                return
            try {
                const cache = await caches.open(this.cacheName)
                const response = new Response(buffer, {
                    headers: {
                        "Content-Type": getMimeType(url),
                        "Content-Length": buffer.byteLength.toString(),
                        "X-SEI-Audio-Saved": Date.now().toString(),
                    },
                })
                await cache.put(url, response)
                await this.trim(cache)
            } catch (error) {
                console.warn("Persistent cache full or unavailable, skipping disk write.", error)
            }
        })
    }
}

/**
 * Pool of detached HTMLAudioElements for passive preload / streaming fallbacks.
 * Ownership is tracked explicitly: preload elements are normally paused, so
 * `paused` cannot tell an idle element from one a backend is still using.
 */
export class HTML5AudioPool {
    private pool: HTMLAudioElement[] = []
    private checkedOut = new Set<HTMLAudioElement>()

    constructor(private maxSize = 5) {}

    getStats() {
        return { preloadElementCount: this.pool.length }
    }

    acquire(): HTMLAudioElement {
        let audio = this.pool.find((candidate) => !this.checkedOut.has(candidate))
        if (!audio) {
            audio = new Audio()
            audio.preload = "auto"
            // At capacity the extra element stays unpooled rather than stealing an owned one.
            if (this.pool.length < this.maxSize) this.pool.push(audio)
        }
        this.checkedOut.add(audio)
        return audio
    }

    /** Clear and return an element to the pool; elements this pool did not hand out are untouched. */
    release(audio: HTMLAudioElement): void {
        if (!this.checkedOut.delete(audio)) return
        this.reset(audio)
    }

    releaseAll(): void {
        for (const audio of new Set([...this.pool, ...this.checkedOut])) this.reset(audio)
        this.checkedOut.clear()
    }

    private reset(audio: HTMLAudioElement): void {
        audio.pause()
        audio.removeAttribute("src")
        audio.src = ""
        audio.load()
    }
}

export const sharedAudioBufferCache = new LRUAudioCache()
let audioBufferCacheOwners = 0

/** Retain decoded buffers until the last backend using this shared cache releases them. */
export function retainAudioBufferCache(): () => void {
    audioBufferCacheOwners += 1
    let released = false
    return () => {
        if (released) return
        released = true
        audioBufferCacheOwners -= 1
        if (audioBufferCacheOwners === 0) sharedAudioBufferCache.clear()
    }
}

export class AudioStorageCache extends PersistentAudioCache {}

export const sharedAudioStorageCache = new PersistentAudioCache()
export const sharedPersistentAudioCache = sharedAudioStorageCache
export const sharedHTML5AudioPool = new HTML5AudioPool()

// Invalidation prevents jobs in this shared module instance from repopulating either cache.
let cacheRevision = 0
export function getAudioCacheRevision(): number {
    return cacheRevision
}

/** Clear cache entries and guard this page's jobs; other tabs may write independently.
 * Mounted backends retain their current buffer until reloaded.
 */
export async function invalidateAudioCache(url?: string): Promise<void> {
    cacheRevision += 1
    if (url !== undefined) {
        const key = url.trim()
        sharedAudioBufferCache.delete(key)
        await sharedAudioStorageCache.delete(key)
    } else {
        sharedAudioBufferCache.clear()
        await sharedAudioStorageCache.clear()
    }
}

export async function configureAudioCacheRetention(
    retention: Partial<AudioCacheRetention>
): Promise<void> {
    await sharedAudioStorageCache.configureRetention(retention)
}

export function getAudioCacheStats() {
    return {
        ...sharedAudioBufferCache.getStats(),
        ...getAudioResourceStats(),
        ...sharedHTML5AudioPool.getStats(),
    }
}
