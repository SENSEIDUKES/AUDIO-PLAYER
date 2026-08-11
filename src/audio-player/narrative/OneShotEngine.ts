function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback;
}

type PoolEntry = {
  el: HTMLAudioElement;
  active: boolean;
  generation: number;
  needsLoad: boolean;
  playbackGain: number;
  lastUsed: number;
  removeElementListeners: (() => void) | null;
  removePlaybackListeners: (() => void) | null;
};

type UrlPool = {
  entries: PoolEntry[];
  lastUsed: number;
};

export interface OneShotEngineOptions {
  /** Initial master level for every one-shot, from 0 to 1. Defaults to 1. */
  level?: number;
  /** Initial mute state. Defaults to false. */
  muted?: boolean;
  /** Maximum number of URL pools retained while idle. Defaults to 32. */
  maxCachedUrls?: number;
  /** Maximum elements retained per URL after playback settles. Defaults to 4. */
  maxPoolSizePerUrl?: number;
  /** Maximum one-shots playing at once. Further calls return null. Defaults to 32. */
  maxConcurrent?: number;
  /**
   * Optional CORS mode for the detached audio elements. It is intentionally
   * unset by default so ordinary media hosts do not require CORS headers.
   */
  crossOrigin?: "anonymous" | "use-credentials";
}

export interface PlayOneShotOptions {
  /** Per-play gain, multiplied by the engine level. Defaults to 1. */
  volume?: number;
  /** Playback start position in seconds. Defaults to the asset start. */
  startTime?: number;
}

/**
 * Pooled HTMLAudioElement player for standalone narrative cues and sound FX.
 *
 * Elements keep their `src` while idle, allowing the browser to retain loaded
 * media for later calls with the same URL. An active element is never stolen:
 * overlapping calls allocate temporary pool entries and those entries are
 * trimmed back to the configured bound as they finish.
 */
export class OneShotEngine {
  private readonly pools = new Map<string, UrlPool>();
  private readonly maxCachedUrls: number;
  private readonly maxPoolSizePerUrl: number;
  private readonly maxConcurrent: number;
  private readonly crossOrigin?: "anonymous" | "use-credentials";
  private level: number;
  private muted: boolean;
  private volumeWritesUnsupported = false;
  private disposed = false;
  private useCounter = 0;

  constructor(options: OneShotEngineOptions = {}) {
    this.level = clamp01(options.level ?? 1);
    this.muted = options.muted ?? false;
    this.maxCachedUrls = positiveInteger(options.maxCachedUrls, 32);
    this.maxPoolSizePerUrl = positiveInteger(options.maxPoolSizePerUrl, 4);
    this.maxConcurrent = positiveInteger(options.maxConcurrent, 32);
    this.crossOrigin = options.crossOrigin;
  }

  setLevel(value: number): void {
    this.level = clamp01(value);
    for (const pool of this.pools.values()) {
      for (const entry of pool.entries) {
        if (entry.active) this.applyVolume(entry);
      }
    }
  }

  getLevel(): number {
    return this.level;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const pool of this.pools.values()) {
      for (const entry of pool.entries) entry.el.muted = muted;
    }
  }

  getMuted(): boolean {
    return this.muted;
  }

  /** Whether this engine has detected ignored or rejected element-volume writes. */
  getVolumeWritesUnsupported(): boolean {
    return this.volumeWritesUnsupported;
  }

  /**
   * Start a standalone sound without interrupting any cue already playing.
   * Returns the owned element, or `null` when audio is unavailable.
   *
   * Browser autoplay rejections are intentionally swallowed: that cue is
   * skipped, but its loaded element stays cached so a later user-initiated
   * call can reuse it. Decode/network and other playback failures evict the
   * failing element so it cannot poison subsequent calls.
   */
  playOneShot(
    url: string,
    options: PlayOneShotOptions = {},
  ): HTMLAudioElement | null {
    const key = url.trim();
    if (this.disposed || !key || typeof Audio === "undefined") return null;

    const entry = this.acquire(key);
    if (!entry) return null;

    const generation = entry.generation;
    entry.playbackGain = clamp01(options.volume ?? 1);
    entry.el.muted = this.muted;
    this.applyVolume(entry);

    const startTime =
      typeof options.startTime === "number" &&
      Number.isFinite(options.startTime)
        ? Math.max(0, options.startTime)
        : 0;
    const seekWhenReady = () => {
      if (!this.isCurrent(entry, generation)) return;
      try {
        entry.el.currentTime = startTime;
      } catch {
        // Some browsers reject seeks until metadata is available.
        // Playback from the natural start is a safe fallback.
      }
    };

    const onEnded = () => {
      if (this.isCurrent(entry, generation)) this.release(key, entry);
    };
    const onPause = () => {
      if (this.isCurrent(entry, generation)) this.release(key, entry);
    };
    // Attach before assigning src/loading: cached media events may arrive
    // immediately, and no lifecycle event should slip past the pool.
    entry.el.addEventListener("loadedmetadata", seekWhenReady);
    entry.el.addEventListener("ended", onEnded);
    entry.el.addEventListener("pause", onPause);
    entry.removePlaybackListeners = () => {
      entry.el.removeEventListener("loadedmetadata", seekWhenReady);
      entry.el.removeEventListener("ended", onEnded);
      entry.el.removeEventListener("pause", onPause);
    };

    let playPromise: Promise<void> | undefined;
    try {
      const needsLoad = entry.needsLoad;
      if (needsLoad) {
        entry.el.src = key;
        entry.needsLoad = false;
        if (!this.isCurrent(entry, generation)) return null;
      }
      try {
        entry.el.currentTime = startTime;
      } catch {
        // loadedmetadata will retry the seek. A natural start remains
        // valid if that later seek is rejected too.
      }
      if (needsLoad) entry.el.load();
      if (!this.isCurrent(entry, generation)) return null;
      playPromise = entry.el.play();
    } catch {
      this.evict(key, entry);
      return null;
    }

    playPromise?.catch((error: unknown) => {
      if (!this.isCurrent(entry, generation)) return;
      if ((error as { name?: string } | null)?.name === "NotAllowedError") {
        this.release(key, entry);
      } else {
        this.evict(key, entry);
      }
    });

    return entry.el;
  }

  /** Stop active cues and release every retained media element. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [url, pool] of [...this.pools]) {
      for (const entry of [...pool.entries]) this.evict(url, entry);
    }
    this.pools.clear();
  }

  private acquire(url: string): PoolEntry | null {
    if (this.getActiveCount() >= this.maxConcurrent) return null;

    let pool = this.pools.get(url);
    if (!pool) {
      pool = { entries: [], lastUsed: 0 };
      this.pools.set(url, pool);
    }

    this.touch(pool);
    let entry = pool.entries.find((candidate) => !candidate.active);
    if (!entry) {
      try {
        const el = new Audio();
        el.preload = "auto";
        if (this.crossOrigin) el.crossOrigin = this.crossOrigin;
        el.muted = this.muted;
        const created: PoolEntry = {
          el,
          active: false,
          generation: 0,
          needsLoad: true,
          playbackGain: 1,
          lastUsed: 0,
          removeElementListeners: null,
          removePlaybackListeners: null,
        };
        // This listener remains while the entry is idle as well as
        // active: a late media failure must not leave a poisoned URL
        // in the reusable pool.
        const onError = () => this.evict(url, created);
        el.addEventListener("error", onError);
        created.removeElementListeners = () => {
          el.removeEventListener("error", onError);
        };
        entry = created;
        pool.entries.push(entry);
      } catch {
        if (pool.entries.length === 0) this.pools.delete(url);
        return null;
      }
    }

    entry.active = true;
    entry.generation += 1;
    entry.lastUsed = ++this.useCounter;
    this.pruneUrlPools();
    return entry;
  }

  private release(url: string, entry: PoolEntry): void {
    entry.removePlaybackListeners?.();
    entry.removePlaybackListeners = null;
    entry.active = false;
    entry.lastUsed = ++this.useCounter;
    try {
      entry.el.pause();
      entry.el.currentTime = 0;
    } catch {
      // A seek can still fail if metadata never arrived (for example
      // after an autoplay rejection). Keeping the loaded src is safe.
    }

    const pool = this.pools.get(url);
    if (!pool || !pool.entries.includes(entry)) return;
    this.touch(pool);
    this.trimPool(url, pool);
    this.pruneUrlPools();
  }

  private evict(url: string, entry: PoolEntry): void {
    entry.removePlaybackListeners?.();
    entry.removePlaybackListeners = null;
    entry.removeElementListeners?.();
    entry.removeElementListeners = null;
    entry.active = false;

    const pool = this.pools.get(url);
    if (pool) {
      pool.entries = pool.entries.filter((candidate) => candidate !== entry);
      if (pool.entries.length === 0) this.pools.delete(url);
    }

    try {
      entry.el.pause();
      entry.el.removeAttribute("src");
      entry.el.load();
    } catch {
      // Best-effort teardown; removing our reference still evicts it.
    }
  }

  private trimPool(url: string, pool: UrlPool): void {
    while (pool.entries.length > this.maxPoolSizePerUrl) {
      const oldestIdle = pool.entries
        .filter((entry) => !entry.active)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (!oldestIdle) return;
      this.evict(url, oldestIdle);
    }
  }

  private pruneUrlPools(): void {
    while (this.pools.size > this.maxCachedUrls) {
      const oldestIdlePool = [...this.pools.entries()]
        .filter(([, pool]) => pool.entries.every((entry) => !entry.active))
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)[0];
      if (!oldestIdlePool) return;
      const [url, pool] = oldestIdlePool;
      if (pool.entries.length === 0) {
        this.pools.delete(url);
        continue;
      }
      for (const entry of [...pool.entries]) this.evict(url, entry);
    }
  }

  private touch(pool: UrlPool): void {
    pool.lastUsed = ++this.useCounter;
  }

  private isCurrent(entry: PoolEntry, generation: number): boolean {
    return entry.active && entry.generation === generation;
  }

  private getActiveCount(): number {
    let count = 0;
    for (const pool of this.pools.values()) {
      for (const entry of pool.entries) {
        if (entry.active) count += 1;
      }
    }
    return count;
  }

  /**
   * Apply composed gain while latching the same volume-lock fallback used by
   * SceneMixEngine. A locked browser still plays the cue at its native level
   * instead of repeatedly throwing and corrupting pool state.
   */
  private applyVolume(entry: PoolEntry): void {
    if (this.volumeWritesUnsupported) return;
    const target = clamp01(this.level * entry.playbackGain);
    try {
      entry.el.volume = target;
      if (target > 0.1 && Math.abs(entry.el.volume - target) > 0.05) {
        this.volumeWritesUnsupported = true;
      }
    } catch {
      this.volumeWritesUnsupported = true;
    }
  }
}

export function createOneShotEngine(
  options: OneShotEngineOptions = {},
): OneShotEngine {
  return new OneShotEngine(options);
}
