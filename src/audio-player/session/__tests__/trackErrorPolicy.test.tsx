/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  AudioSessionProviderProps,
  SessionEngine,
  Track,
} from "../../types";
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext";

const TRACKS: Track[] = [
  { id: "one", title: "One", artist: "Narrator", audioFile: "one.mp3" },
  { id: "two", title: "Two", artist: "Narrator", audioFile: "two.mp3" },
  { id: "three", title: "Three", artist: "Narrator", audioFile: "three.mp3" },
];

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installMediaError(audio: HTMLAudioElement, code = 3): void {
  Object.defineProperty(audio, "error", {
    configurable: true,
    value: {
      code,
      MEDIA_ERR_ABORTED: 1,
      MEDIA_ERR_NETWORK: 2,
      MEDIA_ERR_DECODE: 3,
      MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
    },
  });
}

describe("AudioSessionProvider track error policy", () => {
  let container: HTMLDivElement;
  let root: Root;
  let session: SessionEngine;
  let playSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      this.dispatchEvent(new Event("pause"));
    });
    playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      });
  });

  afterEach(async () => {
    await React.act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  async function mount(
    props: Omit<AudioSessionProviderProps, "children">,
  ): Promise<HTMLAudioElement> {
    function Probe() {
      session = useAudioSession();
      return null;
    }

    await React.act(async () => {
      root.render(
        <AudioSessionProvider {...props}>
          <Probe />
        </AudioSessionProvider>,
      );
    });
    return container.querySelector("audio")!;
  }

  async function startAndFail(audio: HTMLAudioElement): Promise<void> {
    installMediaError(audio);
    await React.act(async () => {
      session.play();
    });
    await React.act(async () => {
      audio.dispatchEvent(new Event("error"));
    });
  }

  it("keeps the existing stop behavior by default", async () => {
    const audio = await mount({ initialQueue: TRACKS.slice(0, 2) });
    const errors = vi.fn();
    session.subscribe("error", errors);

    await startAndFail(audio);

    expect(session.currentIndex).toBe(0);
    expect(session.hasError).toBe(true);
    expect(errors).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledOnce();
  });

  it("emits the error before skipping one bad track and continues playback", async () => {
    const audio = await mount({
      initialQueue: TRACKS,
      trackErrorPolicy: "skip",
    });
    const sequence: string[] = [];
    session.subscribe("error", () => sequence.push("error"));
    session.subscribe("track-change", () => sequence.push("track-change"));

    await startAndFail(audio);
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));

    expect(sequence).toEqual(["error", "track-change"]);
    expect(session.currentTrack).toEqual(TRACKS[1]);
    expect(session.isPlaying).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("does not skip a passive load failure when playback was not requested", async () => {
    const audio = await mount({
      initialQueue: TRACKS.slice(0, 2),
      trackErrorPolicy: "skip",
    });
    const errors = vi.fn();
    session.subscribe("error", errors);
    installMediaError(audio);

    await React.act(async () => {
      audio.dispatchEvent(new Event("error"));
    });

    expect(session.currentIndex).toBe(0);
    expect(session.hasError).toBe(true);
    expect(errors).toHaveBeenCalledOnce();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("exhausts fallback candidates before navigating the queue", async () => {
    const fallback = vi.fn();
    const first: Track = {
      id: "fallback-track",
      title: "Fallback Track",
      artist: "Narrator",
      sources: [{ url: "primary.mp3" }, { url: "backup.mp3" }],
    };
    const audio = await mount({
      initialQueue: [first, TRACKS[1]!],
      trackErrorPolicy: "skip",
      onFallbackSource: fallback,
    });
    const errors = vi.fn();
    session.subscribe("error", errors);
    installMediaError(audio);

    await React.act(async () => session.play());
    await React.act(async () => {
      audio.dispatchEvent(new Event("error"));
      // A duplicate late event for the detached primary must not consume
      // the fallback or trigger queue navigation.
      audio.dispatchEvent(new Event("error"));
    });
    await vi.waitFor(() => expect(session.currentSourceIndex).toBe(1));

    expect(session.currentIndex).toBe(0);
    expect(session.currentSrc).toMatch(/backup\.mp3$/);
    expect(fallback).toHaveBeenCalledOnce();
    expect(errors).not.toHaveBeenCalled();

    await React.act(async () => audio.dispatchEvent(new Event("error")));
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));

    expect(errors).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledTimes(3);
  });

  it("keeps NotAllowedError as autoplayBlocked without fallback or skipping", async () => {
    const blocked = new Error("play blocked");
    blocked.name = "NotAllowedError";
    playSpy.mockImplementationOnce(() => Promise.reject(blocked));
    const fallback = vi.fn();
    const audio = await mount({
      initialQueue: [
        {
          ...TRACKS[0]!,
          sources: [{ url: "one.mp3" }, { url: "one-backup.mp3" }],
        },
        TRACKS[1]!,
      ],
      autoPlay: true,
      trackErrorPolicy: "skip",
      onFallbackSource: fallback,
    });
    const errors = vi.fn();
    session.subscribe("error", errors);

    await vi.waitFor(() => expect(session.autoplayBlocked).toBe(true));

    expect(audio.getAttribute("src")).toContain("one.mp3");
    expect(session.currentIndex).toBe(0);
    expect(session.currentSourceIndex).toBe(0);
    expect(session.hasError).toBe(false);
    expect(fallback).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("terminates an all-bad repeat-all queue after one recovery sweep", async () => {
    const audio = await mount({
      initialQueue: TRACKS,
      repeatMode: "all",
      trackErrorPolicy: "skip",
    });
    const queueEnd = vi.fn();
    const errors = vi.fn();
    session.subscribe("queue-end", queueEnd);
    session.subscribe("error", errors);
    installMediaError(audio);

    await React.act(async () => session.play());
    await React.act(async () => audio.dispatchEvent(new Event("error")));
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));
    await React.act(async () => audio.dispatchEvent(new Event("error")));
    await vi.waitFor(() => expect(session.currentIndex).toBe(2));
    await React.act(async () => audio.dispatchEvent(new Event("error")));

    expect(session.currentIndex).toBe(2);
    expect(session.isPlaying).toBe(false);
    expect(errors).toHaveBeenCalledTimes(3);
    expect(queueEnd).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledTimes(3);

    await React.act(async () => audio.dispatchEvent(new Event("error")));
    expect(queueEnd).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledTimes(3);
  });

  it("scans past previously failed tracks after the play order changes", async () => {
    const randomValues = [0xffffffff, 0xffffffff, 0];
    vi.stubGlobal("crypto", {
      getRandomValues: (values: Uint32Array) => {
        values[0] = randomValues.shift() ?? 0;
        return values;
      },
    });
    const audio = await mount({
      initialQueue: [...TRACKS, { ...TRACKS[0]!, id: "four", title: "Four" }],
      repeatMode: "all",
      trackErrorPolicy: "skip",
    });
    installMediaError(audio);

    await React.act(async () => session.play());
    await React.act(async () => audio.dispatchEvent(new Event("error")));
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));
    await React.act(async () => session.toggleShuffle());
    await React.act(async () => audio.dispatchEvent(new Event("error")));
    await vi.waitFor(() => expect(session.currentIndex).toBe(2));

    expect(session.currentTrack).toEqual(TRACKS[2]);
    expect(playSpy).toHaveBeenCalledTimes(3);
  });

  it("keeps normal single-track repeat-all restarts working", async () => {
    const audio = await mount({
      initialQueue: TRACKS.slice(0, 1),
      repeatMode: "all",
      trackErrorPolicy: "skip",
    });

    await React.act(async () => session.play());
    await React.act(async () => audio.dispatchEvent(new Event("ended")));
    await React.act(async () => audio.dispatchEvent(new Event("ended")));

    expect(session.currentIndex).toBe(0);
    expect(session.isPlaying).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(3);
  });

  it("skips a failed repeat-one track but does not loop at queue end", async () => {
    const audio = await mount({
      initialQueue: TRACKS.slice(0, 2),
      repeatMode: "one",
      trackErrorPolicy: "skip",
    });
    const queueEnd = vi.fn();
    session.subscribe("queue-end", queueEnd);
    installMediaError(audio);

    await React.act(async () => session.play());
    await React.act(async () => audio.dispatchEvent(new Event("error")));
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));
    await React.act(async () => audio.dispatchEvent(new Event("error")));

    expect(session.currentIndex).toBe(1);
    expect(queueEnd).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("uses the shuffled playback order when skipping", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (values: Uint32Array) => values,
    });
    const audio = await mount({
      initialQueue: TRACKS,
      shuffle: true,
      trackErrorPolicy: "skip",
    });

    await startAndFail(audio);
    await vi.waitFor(() => expect(session.currentIndex).not.toBe(0));

    expect(session.currentTrack).not.toEqual(TRACKS[0]);
    expect(TRACKS).toContainEqual(session.currentTrack);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves requested playback when failure pauses before error", async () => {
    const audio = await mount({
      initialQueue: TRACKS.slice(0, 2),
      trackErrorPolicy: "skip",
    });
    installMediaError(audio);

    await React.act(async () => session.play());
    await React.act(async () => {
      audio.dispatchEvent(new Event("pause"));
      audio.dispatchEvent(new Event("error"));
    });
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));

    expect(session.isPlaying).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps empty queues valid and never attempts playback", async () => {
    await mount({
      initialQueue: [],
      autoPlay: true,
      trackErrorPolicy: "skip",
    });
    const errors = vi.fn();
    session.subscribe("error", errors);

    await React.act(async () => session.play());

    expect(session.currentIndex).toBe(-1);
    expect(session.currentTrack).toBeNull();
    expect(session.hasAudio).toBe(false);
    expect(playSpy).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("ignores a stale play rejection after explicit track navigation", async () => {
    const stalePlay = deferred<void>();
    playSpy
      .mockImplementationOnce(() => stalePlay.promise)
      .mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      });
    await mount({
      initialQueue: TRACKS,
      trackErrorPolicy: "skip",
    });
    const errors = vi.fn();
    session.subscribe("error", errors);

    await React.act(async () => session.play());
    await React.act(async () => session.playTrack(1));
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));

    const staleError = new Error("old source failed");
    staleError.name = "NotSupportedError";
    await React.act(async () => {
      stalePlay.reject(staleError);
      await stalePlay.promise.catch(() => undefined);
    });

    expect(session.currentIndex).toBe(1);
    expect(session.currentTrack).toEqual(TRACKS[1]);
    expect(session.isPlaying).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("does not double-advance when error and ended race", async () => {
    const audio = await mount({
      initialQueue: TRACKS,
      trackErrorPolicy: "skip",
    });
    const changes = vi.fn();
    session.subscribe("track-change", changes);
    installMediaError(audio);

    await React.act(async () => session.play());
    await React.act(async () => {
      audio.dispatchEvent(new Event("error"));
      audio.dispatchEvent(new Event("ended"));
    });
    await vi.waitFor(() => expect(session.currentIndex).toBe(1));

    expect(session.currentTrack).toEqual(TRACKS[1]);
    expect(changes).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("ignores a late ended event after the player is unloaded", async () => {
    const audio = await mount({
      initialQueue: TRACKS,
      trackErrorPolicy: "skip",
    });
    const changes = vi.fn();
    session.subscribe("track-change", changes);

    await React.act(async () => session.play());
    const unloadedSource = audio.src;
    await React.act(async () => session.unload());
    Object.defineProperty(audio, "currentSrc", {
      configurable: true,
      value: unloadedSource,
    });
    await React.act(async () => audio.dispatchEvent(new Event("ended")));

    expect(session.currentIndex).toBe(0);
    expect(session.isPlaying).toBe(false);
    expect(changes).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalledOnce();
  });
});
