# Automix

One plugin, automatic fallback. Automix crossfades between queued tracks and —
whenever the analysis is trustworthy — steers *when* a fade starts and *how
long* it runs from per-track BPM/beat/energy metadata. Whenever that metadata is
missing, low-confidence, or impossible to compute, every transition degrades
gracefully to **light mode**: a conservative, silence-trimmed equal-power
crossfade. There is no "lite vs pro" choice to make — `createAutomixPlugin()`
does both.

> The player's built-in `automix` prop / menu toggle (and `AudioSessionProvider`)
> now drives a **single internal `AutomixPlugin`** through the same plugin system
> external plugins use — there is only ever one Automix controller. If you also
> pass your own Automix plugin via `plugins`, that external plugin wins and the
> internal one is omitted automatically, so the two can never both run and
> double-advance the queue. The former standalone `useAutomix` hook is not part
> of the current public package surface.
>
> **Memoize the `plugins` array.** Pass a stable reference (e.g.
> `useMemo(() => [createAutomixPlugin()], [])`). An inline array
> (`plugins={[createAutomixPlugin()]}`) changes identity on every render, and the
> playback loop re-renders ~60×/s — that would destroy and recreate the plugin
> each frame and break transitions mid-fade. In dev the player warns when it
> detects this.

## Light mode (always available, the fallback floor)

- **Two-deck crossfade.** Near the end of the current track (deck A, the
  engine's single `<audio>` element), the next track is preloaded into a hidden,
  detached second element (deck B). Over a ~5.5 s window the audible balance
  swaps from A to B using an equal-power curve (`cos`/`sin`), then the queue
  advances through the host's normal end-of-track path and the engine takes over
  deck B's position.
- **Conservative silence trimming.** Each track is scanned once (fetch →
  `decodeAudioData` → 50 ms RMS windows at ≈ −40 dBFS) for near-silent head/tail
  regions. `trimStartMs`/`trimEndMs` are cached per `trackKey`. The fade is
  scheduled against the trimmed end of A; deck B starts at its trimmed start.
  Amplitude only — no BPM, beat, key, or structure analysis.
- **Graceful fallback everywhere.** Analysis that is unavailable, slow,
  CORS-blocked, oversized (> 30 MB / > 15 min), or unreliable resolves to "no
  trims". Any disruption mid-transition — pause, seek away, manual
  next/previous, queue edits, deck errors, blocked `play()` — cancels the
  transition, restores volume, and falls back to the hard-cut advance.

## Rich mode (beat/BPM/energy aware, when analysis is confident)

For every track it can analyze, Automix produces a `TrackAnalysis`:

```ts
interface TrackAnalysis {
    bpm?: number            // estimated tempo
    beats?: number[]        // beat positions (ms, head + tail windows only)
    downbeats?: number[]    // reserved, unfilled in V1
    energy?: number         // 0..1 mean windowed RMS over the trimmed region
    trimStartMs?: number    // silence trims (same scan as light mode)
    trimEndMs?: number
    transitionInMs?: number // beat-snapped park point for an incoming deck
    transitionOutMs?: number// beat-snapped fade-start point on the way out
    confidence?: number     // 0..1 rhythm reliability; 0 = trims only
}
```

At transition time, `planTransition(outgoingAnalysis, incomingAnalysis, …)`
turns a pair of analyses into a fade plan:

| Pair | Fade |
| --- | --- |
| Both confident, BPM compatible, high energy | Long blend, 9–12s scaled by energy, starting on a beat |
| Both confident, BPM compatible, low energy | Base 5.5s fade, starting on a beat |
| Both confident, BPM incompatible | Short 2.5–3.5s fade so the tempo clash stays brief |
| Either side `confidence < confidenceMin` (or analysis failed) | Light-mode behavior, unchanged |

BPM compatibility (`bpmCompatibility(a, b)`) scores 0..1 with half/double-time
awareness: 85 vs 170 BPM scores 1, 120 vs 124 is mixable, 100 vs 133 is not. The
metadata steers timing only — it does not time-stretch or beatmatch.

## Controls

```tsx
import { useMemo } from "react"
import { AudioPlayer, createAutomixPlugin } from "@seihouse/audio-player"

function PlaylistPlayer() {
  const plugins = useMemo(() => [createAutomixPlugin()], [])

  return <AudioPlayer tracks={tracks} plugins={plugins} />
}
```

`createAutomixPlugin(config)` accepts:

- `enabled` (default `true`) — master switch.
- `confidenceMin` (default 0.55) — minimum normalized rhythm confidence before a
  beat-aware plan is used; below it (or with no analysis) the pair falls back to
  light mode.
- `onTransitionChange(isTransitioning)` — bridge for React UIs.

It is also available in the plugin registry / Plugin Manager as a single
**Automix** entry. The Lab demo (`npm run dev`) wires a playlist player with the
plugin and shows each track's live analysis readout.

## Where it lives

| Piece | File |
| --- | --- |
| Plugin: deck lifecycle, ramp, handoff, fallback | `src/audio-player/plugins/AutomixPlugin.ts` |
| Silence analysis + per-track cache (light mode) | `src/audio-player/automix/silenceAnalysis.ts` |
| Rich analysis orchestrator | `src/audio-player/automix/trackAnalysis.ts` |
| essentia.js worker + client | `src/audio-player/automix/rhythmWorker.ts`, `rhythmClient.ts` |
| Pure transition math (unit-tested) | `src/audio-player/automix/transitionPlanner.ts` |
| IndexedDB analysis cache | `src/audio-player/automix/analysisStore.ts` |
| Built-in `automix` prop/menu → internal plugin wiring | `AudioPlayer.tsx`, `session/AudioSessionContext.tsx`, `plugins/automixIntegration.ts` |

The `AutomixPlugin` always attempts rich analysis (`usePro()` is on except where
fades are impossible); per-pair confidence in `planTransition` decides whether a
given transition uses the rich plan or the light fallback. The essentia.js WASM
payload (~2.5 MB) lives entirely in the worker chunk and is fetched only when the
first rich analysis runs — the main bundle is unaffected. Any worker failure
latches rhythm extraction off for the page, and analyses settle as trims-only
with `confidence: 0`.

## Transition lifecycle (light mode)

```
idle ──(≤15 s before trimmed end of A)──▶ preloading
     deck B created (new Audio(), never in the DOM → no native controls),
     src set, silence analysis kicked off, parked at B's trimmed start
preloading ──(≤5.5 s before trimmed end of A)──▶ fading
     deck B plays at 0 volume; wall-clock interval ramps
     A: cos(t·π/2)·vol, B: sin(t·π/2)·vol
fading ──(ramp done, or A ends first)──▶ handoff
     host advances its queue normally; engine reloads B's URL (HTTP-cached);
     main element is time-synced to deck B and, on its first 'playing',
     volume is restored and deck B is paused and released
handoff ──▶ idle (normal playback, indistinguishable from before)
```

In rich mode the same lifecycle runs, but the park point (`transitionInMs`) and
fade-start (`transitionOutMs`) are beat-snapped and the fade length comes from
the plan.

## Analysis strategy (rich mode)

- Rhythm is extracted from two windows only: the first ~60s after the trim start
  and the last ~120s before the trimmed end (a single window when the trimmed
  track is ≤180s). Transitions only need beats near the edges.
- Segments are downmixed to mono and resampled to 44.1kHz in plain JS before the
  transfer (`RhythmExtractor2013` assumes 44100).
- Head/tail BPM disagreement applies a ×0.7 confidence penalty; half/double
  relationships keep the tail tempo (what the next fade blends against).
- The next track's analysis starts as soon as the current track loads — the 15s
  preload lead is not enough for download + decode + WASM extraction.

## Known limits (intentional for V1)

- **iOS Safari / volume-locked browsers:** programmatic element volume is
  ignored, so crossfading is impossible. The first failed volume write latches a
  page-wide flag and Automix degrades to the normal hard-cut advance (rich
  analysis is gated off there too).
- **Background tabs:** trigger evaluation rides the engine's rAF clock, which
  browsers throttle when hidden; transitions fall back to hard cuts. An
  already-running fade keeps progressing (interval-driven).
- **Repeat-one** and end-of-queue (repeat off) never automix.
- **No time-stretching:** "beat-near" means the fade *starts* on a beat of the
  outgoing track and the incoming deck parks on its first beat; the grids are not
  aligned for the duration of the blend.
- `downbeats` stays unfilled — essentia.js has no downbeat tracker in its
  standard algorithm set.
- The built-in `automix` prop uses the same internal `AutomixPlugin` as the
  explicit plugin path. An explicitly supplied `AutomixPlugin` takes precedence
  and can set `confidenceMin` or observe transition state.
- Analysis requires CORS-readable audio and the HTML5 backend.
- Bundler note: the worker is created with `new Worker(new URL(...))`, the idiom
  Vite and webpack 5 understand. Where unsupported, worker construction fails and
  everything degrades to light mode.
- Dependency note: essentia.js is **AGPL-3.0** — review the licensing
  implications before shipping in a closed-source product.
```
