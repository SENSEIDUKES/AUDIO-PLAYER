# Playback resilience & Media Session API

This document complements the main [`README.md`](../README.md) with details on how
the SEIHouse audio player handles errors, retries, autoplay blocking, and
platform media integration.

---

## Architecture overview

| Layer | File | Responsibility |
|---|---|---|
| Headless engine | `src/audio-player/useAudioPlayer.ts` | Owns a single hidden `<audio>`, manages playback, error recovery, buffering, volume, and a rAF-driven time-update loop. |
| Session provider | `src/audio-player/session/AudioSessionContext.tsx` | Wraps the headless engine with a queue, shuffle, repeat, and automix management so multiple skins share one audio element. |
| Faces | `src/audio-player/skins/NarrativeFace.tsx` | The narrator face. The v4 music faces (`AudioPlayer`, FullCard, StickyBottom, MiniSidebar, VaultRow, SeaCard) were archived in 5.0.0 under `archive/faces-v4/` while one new face is designed. |

The core principle: **the engine drives state; the UI reads state and calls
actions** — it never touches the `<audio>` element directly.

---

## Error states and retry flow

Errors originate from one of two sources:

1. **`<audio>` element `error` event** — the browser reports a failed load.
   The player categorises the error by code:

   | Error code | User-facing message |
   |---|---|
   | `MEDIA_ERR_ABORTED` | "Playback was aborted. Please try again." |
   | `MEDIA_ERR_NETWORK` | "Network error. Check your connection and try again." |
   | `MEDIA_ERR_DECODE` | "Audio file is corrupted or unsupported." |
   | `MEDIA_ERR_SRC_NOT_SUPPORTED` | "Audio file not found or format not supported." |
   | Other / unknown | "Failed to load audio. Please try again." |

2. **`audio.play()` promise rejection** — the call threw synchronously or the
   promise rejected.

   - `AbortError` → silently ignored (caused by rapid src changes).
   - `NotAllowedError` → sets `autoplayBlocked` flag (see below).
   - `NotSupportedError` → surfaces "Audio file not found or format not supported."
   - Anything else → surfaces "Playback failed. Please try again."

### Retry

The `retry` action calls `audio.load()` followed by `audio.play()` and bumps
the internal playback token so stale promises from the previous attempt become
no-ops. The Retry button is exposed in the error banner.

### Token-based stale-callback protection

A monotonic `playbackTokenRef` is bumped on every source change, retry, and
`loadAndPlay` call. All async `.then`/`.catch` callbacks capture the token at
creation time and compare it to the current token before mutating state. A
mismatch means the callback is stale — the action is ignored.

This prevents race conditions when the user rapidly skips tracks or retries
while a previous `audio.play()` promise is still settling.

---

## Autoplay-blocked handling

Browsers block audible autoplay without a prior user gesture. The player
handles this with a two-tier approach:

1. **First load with `autoPlay = true`** — the engine attempts `audio.play()`
   silently (no error banner). If the promise rejects with `NotAllowedError`,
   the `autoplayBlocked` flag is set. The UI shows an info banner with a Play
   button so the user can tap to start.

2. **Subsequent play attempts** — non-first-load calls to `play(true)` **do**
   surface errors via the banner, and the autoplay-blocked path is only taken
   for `NotAllowedError`.

The `autoplayBlocked` flag is cleared when:
- The user taps Play on the banner (calls `dismissAutoplayBlocked()` + `toggle()`).
- The user clicks the play button.
- A new source is loaded.

---

## Media Session API integration

The Media Session API is a **progressive enhancement** — it only activates when
`"mediaSession" in navigator` is true (supported in all modern browsers,
including mobile Chrome and Safari).

### What it provides

| Feature | Benefit |
|---|---|
| **Lock-screen metadata** | OS lock screen and notification centre shows the current track title, artist, and artwork. |
| **Hardware media keys** | Keyboard media keys, Bluetooth headset buttons, Apple Watch, and Android auto-launch controls work without focus on the player. |
| **Playback state** | The OS displays the correct play/pause icon and responds to voice commands ("Hey Siri, pause"). |

### Implementation location

The integration is the exported `useMediaSessionObserver` hook
(`src/audio-player/headless/useMediaSessionObserver.ts`). It is not in the
headless engine because metadata comes from the consumer-level track object,
not the raw audio URL. In v4 the archived `AudioPlayer` and `FullCardPlayer`
faces called it; since 5.0.0 no bundled face does, so the new player face (or a
host) must call it for lock-screen controls to appear.

### Metadata set

```
navigator.mediaSession.metadata = new MediaMetadata({
  title: currentTrack.title,
  artist: currentTrack.artist,
  album: "",
  artwork: backgroundImage?.src
    ? [{ src: backgroundImage.src, sizes: "512x512", type: "image/jpeg" }]
    : [],
})
```

### Action handlers registered

| Action | Handler |
|---|---|
| `play` | Calls `engine.play(true)` |
| `pause` | Calls `engine.pause()` |
| `previoustrack` | Calls `previousTrack()` |
| `nexttrack` | Calls `nextTrack()` |
| `seekbackward` | Calls `seekBy(-10)` |
| `seekforward` | Calls `seekBy(10)` |
| `stop` | Calls `engine.pause()` |

All handlers are wrapped in `try/catch` because older browsers throw when
registering unsupported action types.

### Playback state

A separate effect updates `navigator.mediaSession.playbackState` to `"playing"`
or `"paused"` whenever `isPlaying` changes.

### Cleanup

When the component unmounts or the track changes, metadata is cleared and all
handlers are deregistered (`setActionHandler(action, null)`).

---

## Mobile-specific limitations

| Behaviour | Details |
|---|---|
| **Programmatic volume** | iOS Safari ignores `audio.volume`. Detected once and exposed via `volumeUnsupported` flag. The UI shows a mute-only control and hides the slider on iOS. |
| **Autoplay** | Never guaranteed on mobile. The info banner handles this. |
| **Media Session artwork** | Some mobile browsers ignore artwork served over HTTP or with missing `type` hints. Ensure the `backgroundImage.src` is HTTPS and JPEG/PNG. |
| **Background playback** | iOS Safari requires the `<audio>` element to stay in the DOM. The player keeps its `<audio>` mounted as long as the component is rendered. |

---

## What is intentionally not yet handled

- **Exponential backoff for automatic retry** — the player relies on explicit
  user-driven retry. Automatic backoff can fight with source changes and
  produce unexpected network traffic. A future version may add limited
  automatic retries for `MEDIA_ERR_NETWORK` with a cap and cancellation on
  source change.

- **`seekto` Media Session action** — The `seekto` action passes a `seekTime`
  in seconds. It is not registered because the player's progress bar already
  provides fine-grained seeking and the hardware-action granularity adds
  complexity without clear benefit for audio playback. This can be added later
  if needed.

- **`play`/`pause` autoplay policy violation detection** — Chrome's autoplay
  policy can change during a session (e.g. if the user interacts with another
  audio element). The player does not watch for such changes.

- **Offline playback** — No Service Worker or cache-first strategy is in place
  for audio files.