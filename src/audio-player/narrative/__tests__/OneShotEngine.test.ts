// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOneShotEngine } from "../OneShotEngine";

type VolumeWriteBehavior = "normal" | "ignore" | "throw";

class FakeAudio {
  static created: FakeAudio[] = [];
  static playBehavior: "resolve" | "not-allowed" | "reject" = "resolve";
  static throwOnSeek = false;
  static volumeWriteBehaviors: VolumeWriteBehavior[] = [];

  preload = "";
  crossOrigin: string | null = null;
  muted = false;
  paused = true;
  src = "";
  loadCalls = 0;
  playCalls = 0;
  pauseCalls = 0;
  private time = 0;
  private readonly volumeWriteBehavior: VolumeWriteBehavior;
  private volumeValue = 1;
  private listeners = new Map<string, Set<EventListener>>();

  constructor() {
    this.volumeWriteBehavior =
      FakeAudio.volumeWriteBehaviors.shift() ?? "normal";
    FakeAudio.created.push(this);
  }

  get currentTime(): number {
    return this.time;
  }

  set currentTime(value: number) {
    if (FakeAudio.throwOnSeek) throw new Error("metadata not loaded");
    this.time = value;
  }

  get volume(): number {
    return this.volumeValue;
  }

  set volume(value: number) {
    if (this.volumeWriteBehavior === "throw") {
      throw new Error("volume is locked");
    }
    if (this.volumeWriteBehavior === "ignore") return;
    this.volumeValue = value;
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.call(this, new Event(type));
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }

  load(): void {
    this.loadCalls += 1;
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
    this.dispatch("pause");
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (FakeAudio.playBehavior === "not-allowed") {
      const error = new Error("play blocked");
      error.name = "NotAllowedError";
      return Promise.reject(error);
    }
    if (FakeAudio.playBehavior === "reject") {
      return Promise.reject(new Error("decode failed"));
    }
    this.paused = false;
    return Promise.resolve();
  }
}

const URL_A = "https://cdn.example/door.mp3";
const URL_B = "https://cdn.example/thunder.mp3";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("OneShotEngine", () => {
  beforeEach(() => {
    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
    FakeAudio.created = [];
    FakeAudio.playBehavior = "resolve";
    FakeAudio.throwOnSeek = false;
    FakeAudio.volumeWriteBehaviors = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses the loaded element for cache hits of the same URL", () => {
    const engine = createOneShotEngine();
    const first = engine.playOneShot(URL_A);
    expect(FakeAudio.created).toHaveLength(1);
    expect(FakeAudio.created[0].loadCalls).toBe(1);

    FakeAudio.created[0].dispatch("ended");
    const second = engine.playOneShot(URL_A);

    expect(second).toBe(first);
    expect(FakeAudio.created).toHaveLength(1);
    expect(FakeAudio.created[0].loadCalls).toBe(1);
    expect(FakeAudio.created[0].playCalls).toBe(2);
    engine.dispose();
  });

  it("applies the engine level and fresh per-play volume on reuse", () => {
    const engine = createOneShotEngine({ level: 0.5 });
    engine.playOneShot(URL_A, { volume: 0.4 });
    const audio = FakeAudio.created[0];
    expect(audio.volume).toBeCloseTo(0.2);

    audio.dispatch("ended");
    engine.playOneShot(URL_A, { volume: 0.8 });
    expect(audio.volume).toBeCloseTo(0.4);

    engine.setLevel(0.25);
    expect(audio.volume).toBeCloseTo(0.2);
    engine.dispose();
  });

  it("keeps playing and reusing media when volume writes are locked", () => {
    FakeAudio.volumeWriteBehaviors = ["throw"];
    const engine = createOneShotEngine();
    expect(engine.getVolumeWritesUnsupported()).toBe(false);
    const first = engine.playOneShot(URL_A, { volume: 0.25 });
    const audio = FakeAudio.created[0];
    expect(audio.playCalls).toBe(1);
    expect(engine.getVolumeWritesUnsupported()).toBe(true);

    audio.dispatch("ended");
    const second = engine.playOneShot(URL_A, { volume: 0.5 });

    expect(second).toBe(first);
    expect(FakeAudio.created).toHaveLength(1);
    expect(audio.playCalls).toBe(2);
    // The engine latched the mobile-style volume lock and did not retry a
    // write that previously threw.
    expect(audio.volume).toBe(1);
    engine.dispose();
  });

  it("keeps volume-lock detection isolated between engine instances", () => {
    FakeAudio.volumeWriteBehaviors = ["ignore", "normal"];
    const lockedEngine = createOneShotEngine();

    expect(lockedEngine.getVolumeWritesUnsupported()).toBe(false);
    const lockedAudio = lockedEngine.playOneShot(URL_A, {
      volume: 0.25,
    }) as unknown as FakeAudio;

    const independentEngine = createOneShotEngine({ level: 0.5 });
    expect(independentEngine.getVolumeWritesUnsupported()).toBe(false);
    const independentAudio = independentEngine.playOneShot(URL_B, {
      volume: 0.5,
    }) as unknown as FakeAudio;

    expect(lockedEngine.getVolumeWritesUnsupported()).toBe(true);
    expect(independentEngine.getVolumeWritesUnsupported()).toBe(false);
    expect(lockedAudio.volume).toBe(1);
    expect(independentAudio.volume).toBeCloseTo(0.25);

    lockedEngine.setMuted(true);
    expect(lockedAudio.muted).toBe(true);
    expect(independentAudio.muted).toBe(false);

    lockedEngine.dispose();
    independentEngine.dispose();
  });

  it("evicts a failed media element instead of returning it to the cache", () => {
    const engine = createOneShotEngine();
    const failed = engine.playOneShot(URL_A);
    FakeAudio.created[0].dispatch("error");

    const replacement = engine.playOneShot(URL_A);
    expect(FakeAudio.created).toHaveLength(2);
    expect(replacement).not.toBe(failed);
    expect(FakeAudio.created[0].src).toBe("");
    engine.dispose();
  });

  it("supports overlapping playback for the same and different URLs", () => {
    const engine = createOneShotEngine();
    const first = engine.playOneShot(URL_A);
    const overlap = engine.playOneShot(URL_A);
    const different = engine.playOneShot(URL_B);

    expect(FakeAudio.created).toHaveLength(3);
    expect(new Set([first, overlap, different]).size).toBe(3);
    expect(FakeAudio.created.map((audio) => audio.playCalls)).toEqual([
      1, 1, 1,
    ]);
    engine.dispose();
  });

  it("bounds active playbacks and reclaims an externally paused element", () => {
    const engine = createOneShotEngine({ maxConcurrent: 2 });
    const first = engine.playOneShot(URL_A) as unknown as FakeAudio;
    engine.playOneShot(URL_A);

    expect(engine.playOneShot(URL_B)).toBeNull();
    expect(FakeAudio.created).toHaveLength(2);

    first.pause();
    expect(engine.playOneShot(URL_A)).toBe(first);
    expect(FakeAudio.created).toHaveLength(2);
    engine.dispose();
  });

  it("trims settled overlap and least-recent idle URL pools", () => {
    const engine = createOneShotEngine({
      maxCachedUrls: 1,
      maxPoolSizePerUrl: 1,
    });
    const first = engine.playOneShot(URL_A) as unknown as FakeAudio;
    const overlap = engine.playOneShot(URL_A) as unknown as FakeAudio;

    first.dispatch("ended");
    expect(first.src).toBe("");
    overlap.dispatch("ended");

    const other = engine.playOneShot(URL_B) as unknown as FakeAudio;
    expect(overlap.src).toBe("");
    other.dispatch("ended");

    engine.playOneShot(URL_A);
    expect(FakeAudio.created).toHaveLength(4);
    engine.dispose();
  });

  it("keeps an autoplay-blocked element reusable", async () => {
    FakeAudio.playBehavior = "not-allowed";
    const engine = createOneShotEngine();
    const first = engine.playOneShot(URL_A);
    await flush();

    FakeAudio.playBehavior = "resolve";
    const retry = engine.playOneShot(URL_A);
    expect(retry).toBe(first);
    expect(FakeAudio.created).toHaveLength(1);
    expect(FakeAudio.created[0].playCalls).toBe(2);
    engine.dispose();
  });

  it("continues playback when seeking throws before metadata loads", () => {
    FakeAudio.throwOnSeek = true;
    const engine = createOneShotEngine();
    const audio = engine.playOneShot(URL_A, { startTime: 0.25 });

    expect(audio).toBe(FakeAudio.created[0]);
    expect(FakeAudio.created[0].playCalls).toBe(1);

    FakeAudio.throwOnSeek = false;
    FakeAudio.created[0].dispatch("loadedmetadata");
    expect(FakeAudio.created[0].currentTime).toBe(0.25);
    engine.dispose();
  });

  it("applies an eager startTime seek when metadata is available", () => {
    const engine = createOneShotEngine();
    const audio = engine.playOneShot(URL_A, {
      startTime: 1.25,
    }) as unknown as FakeAudio;

    expect(audio.currentTime).toBe(1.25);
    engine.dispose();
  });

  it("updates idle and active mute state and fully disposes the pool", () => {
    const engine = createOneShotEngine();
    const idle = engine.playOneShot(URL_A) as unknown as FakeAudio;
    idle.dispatch("ended");
    const active = engine.playOneShot(URL_B) as unknown as FakeAudio;

    engine.setMuted(true);
    expect(idle.muted).toBe(true);
    expect(active.muted).toBe(true);
    expect(active.listenerCount("ended")).toBe(1);
    expect(idle.listenerCount("error")).toBe(1);

    engine.dispose();

    expect(idle.pauseCalls).toBeGreaterThanOrEqual(2);
    expect(active.pauseCalls).toBe(1);
    expect(idle.src).toBe("");
    expect(active.src).toBe("");
    expect(idle.listenerCount("error")).toBe(0);
    expect(active.listenerCount("ended")).toBe(0);
    expect(engine.playOneShot(URL_A)).toBeNull();
  });

  it("evicts non-policy play rejections", async () => {
    FakeAudio.playBehavior = "reject";
    const engine = createOneShotEngine();
    const failed = engine.playOneShot(URL_A);
    await flush();

    FakeAudio.playBehavior = "resolve";
    const replacement = engine.playOneShot(URL_A);
    expect(replacement).not.toBe(failed);
    expect(FakeAudio.created).toHaveLength(2);
    engine.dispose();
  });
});
