# SEIHouse Audio Player Backend Guide

The audio player abstracts playback behind a backend interface. The default
backend is HTML5 Audio — with no configuration the player behaves exactly as it
always has. An optional Web Audio API backend is available for use cases that
need sample-accurate timing or reliable programmatic volume (DJ-style apps,
gapless-critical playback).

The backend system is intentionally additive:

- No config = the HTML5 element path, byte-for-byte the previous behavior.
- Skins, compact layouts, plugins, and the shared session work on both
  backends without changes.
- If Web Audio is requested but unavailable, the player falls back to HTML5
  automatically and logs a console warning.

---

## Choosing a backend

| | `"html5"` (default) | `"webaudio"` |
| --- | --- | --- |
| Playback starts | While downloading (streaming) | After full download + decode |
| Timing | Element-driven (ms-level jitter) | Sample-accurate scheduling |
| Volume / fades | Ignored on iOS Safari | GainNode — works everywhere |
| Track changes | HTTP cache warm via `preload` | Decode-ahead cache (near-instant) |
| Buffered ranges | Progressive multi-segment | All-or-nothing after decode |
| CORS | Not required | **Required** on remote audio |
| Memory | Small | Decoded PCM (~10 MB per stereo minute) |

Use `"html5"` for long tracks, podcasts, and anything streamed. Use
`"webaudio"` for short-to-mid music tracks where precise timing, tight track
changes, or working volume on iOS matter more than time-to-first-sound.

---

## Enabling the Web Audio backend

Both entry points accept the `audioBackend` option (default `"html5"`):

```tsx
<AudioSessionProvider initialQueue={tracks} audioBackend="webaudio">
  <AppControls />
</AudioSessionProvider>
```

```ts
const engine = useAudioPlayer({
  src: "/track.mp3",
  audioBackend: "webaudio",
})
```

The requested backend is **fixed at mount**. Web Audio context failures can
automatically change the active backend to HTML5. To change the request, remount the session —
for example with a React `key`:

```tsx
<AudioSessionProvider key={backend} audioBackend={backend} initialQueue={tracks}>
  <AppControls />
</AudioSessionProvider>
```

---

## Inspecting the active backend

Every engine exposes `getBackendInfo()`:

```ts
const info = engine.getBackendInfo()
// {
//   requested: "webaudio",
//   active: "webaudio",       // "html5" if the factory fell back
//   didFallback: false,
//   fallbackReason: undefined, // human-readable when didFallback is true
//   capabilities: {
//     streaming: false,
//     preciseTiming: true,
//     reliableVolume: true,
//     decodeAhead: true,
//     requiresCors: true,
//     progressiveBuffered: false,
//     stereoPanning: true,     // actual StereoPannerNode support
//   },
// }
```

`AudioBackendInfo`, `AudioBackendKind`, and `AudioBackendCapabilities` are
exported from `@seihouse/audio-player`.

---

## Feature detection and fallback

`createAudioBackend(kind, deps)` (exported for advanced use) validates browser
support before instantiating the Web Audio backend. When `AudioContext` or
`fetch` is missing, it logs:

```
[AudioPlayer] Web Audio API not available (<reason>); falling back to HTML5 audio backend.
```

and returns the HTML5 backend with `didFallback: true` and a `fallbackReason`
in `getBackendInfo()`. Playback keeps working — only the requested
capabilities differ.

The factory also handles context construction, graph initialization and
non-autoplay resume failures at runtime. Its stable backend facade switches
to the host's mounted `<audio>` element, transfers subscriptions, preserves
source, volume, mute, playback rate, output gain and loop, and restores position
after metadata. `getInfo()` reports `active: "html5"`, `didFallback: true` and a
reason. The switch lasts for the backend's lifetime; remount to request Web
Audio again. Advanced hosts must supply a mounted `audioRef` for this recovery.
Creating `new WebAudioBackend(...)` directly bypasses factory recovery.

`NotAllowedError` and a context that remains suspended still use the normal
tap-to-play path. Network, codec and resource-limit failures retain their error
contracts and do not trigger a backend switch. HTML5 autoplay failures remain
visible to the host. HTML5 fallback loses spatial controls, precise timing,
decode-ahead, and reliable programmatic volume on volume-locked browsers.

Spatial controls are a supported **advanced host API** through the factory's
`AudioBackend`, documented with lifecycle examples in the
[spatial guide](./SPATIAL_AUDIO_GUIDE.md). `supportsSpatial()` reports 3D
panning; `getInfo().capabilities.stereoPanning` reports dedicated stereo
panning. Before graph creation the latter probes the constructor prototype;
after creation it reflects the actual node. Without `StereoPannerNode`, both
initial and replacement panners connect directly to the gain node. Custom
backend capability reports must include `stereoPanning` (false if unsupported).

---

## Web Audio specifics

### CORS is required

The Web Audio backend loads audio with `fetch` + `decodeAudioData`, so remote
files must send `Access-Control-Allow-Origin` headers. A cross-origin file
that plays fine under HTML5 will fail under Web Audio with a
"Network error" banner if CORS is missing. Same-origin files are unaffected.

### Loading model

The full file is downloaded and decoded before playback starts (the player
shows its buffering state during this window). The decoded buffer is cached
(shared LRU, 4 entries and 250 MiB by default) so repeat plays and `preload()`ed next tracks start
near-instantly. Decoded PCM is large — roughly 10 MB per stereo minute at
44.1 kHz — which is why the cache is capped. Backends retain the cache when
loading or preloading and release ownership on destroy; only the last owner's
destroy clears it. Track changes preserve in-flight preloads, and `load()`
adopts their results. `releasePreload()` and destroy cancel that backend's
preloads; explicit cache invalidation still prevents stale cache writes.

### Autoplay

`AudioContext` requires a user gesture to start. The backend resumes the
context inside `play()`; when the browser refuses (no gesture), the engine
raises the same `autoplayBlocked` affordance the HTML5 path uses, so the UI
"tap to play" recovery is identical.

### Volume on iOS

iOS Safari ignores programmatic volume on media elements, so the HTML5 path
reports `volumeUnsupported` there. The Web Audio backend routes through a
GainNode, which iOS honors — the volume slider and `fade()` work normally.

Finite volume writes clamp to 0–1; non-finite writes are ignored by the hook
and both backends. `engine.fade(to, durationMs)` ramps a separate 0–1 fade
gain, multiplied by the host's `setOutputGain()` value and the user's volume.
It preserves the slider, mute state, and unmute-restore level. Manual volume or
mute controls reset the fade; `unload()` also resets it. Non-finite fade targets
or durations are ignored. A zero fade gain uses element mute as well as volume
on HTML5, so silence works on volume-locked browsers; partial fades still need
programmatic volume support.

### Automix

Automix Lite's two-deck crossfade drives `<audio>` elements directly, so it is
inert under the Web Audio backend: tracks end and advance normally without
crossfades. (A native gain-ramp crossfade for the Web Audio backend is future
work.)

### Media Session / lock-screen controls

Media Session metadata and action handlers work on both backends. Note that
some browsers (notably iOS Safari) only surface lock-screen "now playing"
controls when an active media element exists, so they may not appear under the
Web Audio backend. This is a platform limitation, not a player regression.

### Gapless playback

`AudioBufferSourceNode.start()` is sample-accurate and the decode cache makes
queue advances near-instant, which removes most audible gaps. Fully automatic
gapless scheduling (starting the next buffer at the exact end sample of the
current one) requires next-track awareness inside the backend and is planned
as future work.

---

## Backend interface (for implementers)

Backends implement `AudioBackend` from
`src/audio-player/core/audio/AudioBackend.ts`, which mirrors HTMLMediaElement
semantics:

- `setSource(src)` / `load()` / `clearSource()` — source lifecycle
- `play(): Promise<void>` — rejections carry `AbortError` /
  `NotAllowedError` / `NotSupportedError` names, matching `element.play()`
- `pause()`, `getCurrentTime()`, `setCurrentTime()`, `getDuration()`,
  `isPaused()`, `isEnded()`, `hasMetadata()`
- `setVolume()` / `getVolume()` / `setMuted()` / `setLoop()`
- Optional `setOutputGain(0..1)` — an independent output gain for the ReaderMixer
  Voice gate. Built-in backends implement it without changing user volume/mute.
  HTML5 also uses element mute at zero so the gate works when volume writes are
  ignored. Custom backends need this method to use `ReaderMixerVoice`.
- `getBufferedRanges()`, `getError()` (normalized `MediaError`-style codes)
- `addEventListener` / `removeEventListener` for the 13 media events the
  engine consumes (`play`, `pause`, `ended`, `loadedmetadata`, `waiting`,
  `stalled`, `canplay`, `canplaythrough`, `playing`, `progress`,
  `timeupdate`, `error`, `loadstart`)
- `preload(url)` / `releasePreload()` — cache warming
- `getMediaElement()` — the underlying element, or `null` (Web Audio);
  plugins that touch the element must guard for `null`
- `getInfo()` / `destroy()` — `destroy()` must be idempotent and revivable
  (React StrictMode remounts reuse the instance)

`HTML5AudioBackend` and `WebAudioBackend` are exported as reference
implementations.

---

## Demo

The Workshop's **Audio Engine & Backends** workspace (`npm run dev`, then open
`?workspace=audio-engine`) runs the same session on either backend with a
switch, plus a live `getBackendInfo()` readout. Its default playlist includes a
broken URL to exercise each backend's error path. To test the fallback warning,
stub the API in devtools before reload:

```js
Object.defineProperty(window, "AudioContext", { value: undefined })
```
