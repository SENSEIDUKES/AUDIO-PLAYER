# Automix Pro (metadata layer, V1)

Automix Pro layers per-track metadata — BPM, beat positions, energy, silence
trims, and precomputed transition points — on top of the Automix Lite two-deck
crossfade. The metadata steers *when* a fade starts and *how long* it runs;
it does not time-stretch or beatmatch. Whenever the metadata is missing or
untrustworthy, behavior degrades to exactly Automix Lite.

## What it does

For every track it analyzes, Pro produces a `TrackAnalysis`:

```ts
interface TrackAnalysis {
    bpm?: number            // estimated tempo
    beats?: number[]        // beat positions (ms, head + tail windows only)
    downbeats?: number[]    // reserved, unfilled in V1
    energy?: number         // 0..1 mean windowed RMS over the trimmed region
    trimStartMs?: number    // silence trims (same scan as Automix Lite)
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
| Either side `confidence < 0.55` (or analysis failed) | Automix Lite behavior, unchanged |

BPM compatibility (`bpmCompatibility(a, b)`) scores 0..1 with half/double-time
awareness: 85 vs 170 BPM scores 1, 120 vs 124 is mixable, 100 vs 133 is not.

## Where it lives

- `automix/trackAnalysis.ts` — orchestrator: one download + decode per track
  feeds the silence scan, the energy estimate, and rhythm extraction. Public
  API: `ensureProTrackAnalysis(track)` / `getTrackAnalysis(track)`, same
  pending/settled/serialized-cache pattern as the Lite analysis.
- `automix/rhythmWorker.ts` + `automix/rhythmClient.ts` — essentia.js
  (`RhythmExtractor2013`) runs in a dedicated worker. The WASM payload
  (~2.5MB) lives entirely in the worker chunk and is fetched only when the
  first Pro analysis runs; the main bundle is unaffected. Any worker failure
  (construction, init timeout, hung job) latches rhythm off for the page and
  analyses settle as trims-only with `confidence: 0`.
- `automix/transitionPlanner.ts` — pure math: confidence normalization, BPM
  compatibility, beat snapping, transition points, and the fade policy. All
  unit-tested (`automix/__tests__/`).
- `automix/analysisStore.ts` — best-effort IndexedDB cache
  (`sap-automix/analysis`, keyed by `ANALYSIS_VERSION:trackKey`). Confident
  analyses persist across page loads; rhythm extraction is skipped entirely
  on a cache hit. Private-mode/quota failures silently degrade to in-memory.
- `plugins/AutomixPlugin.ts` — `pro: true` switches the plugin's analysis
  source and timing math; everything else (deck lifecycle, ramp mechanics,
  handoff) is shared with Lite.

## Controls

```tsx
import { createAutomixProPlugin } from "seihouse-audio-player"

<AudioPlayer tracks={tracks} plugins={[createAutomixProPlugin()]} />
```

`createAutomixProPlugin(config)` is `createAutomixPlugin({ ...config, pro:
true })`. `proConfidenceMin` (default 0.55) tunes the fallback threshold.
Don't enable the player's built-in `automix` prop on the same player — that
drives the legacy Lite hook and would run a second crossfade.

The Lab demo (section 11, `npm run dev`) wires a playlist player with the Pro
plugin and shows each track's live analysis readout.

## Analysis strategy

- Rhythm is extracted from two windows only: the first ~60s after the trim
  start and the last ~120s before the trimmed end (a single window when the
  trimmed track is ≤180s). Transitions only need beats near the edges, and a
  full-length transfer of a 15-minute track would be hundreds of megabytes.
- Segments are downmixed to mono and resampled to 44.1kHz in plain JS before
  the transfer (`RhythmExtractor2013` assumes 44100).
- Head/tail BPM disagreement applies a ×0.7 confidence penalty; half/double
  relationships keep the tail tempo (that's what the next fade blends
  against).
- The next track's analysis starts as soon as the current track loads — the
  15s preload lead is not enough for download + decode + WASM extraction.

## Known limits (intentional for V1)

- No time-stretching: "beat-near" means the fade *starts* on a beat of the
  outgoing track and the incoming deck parks on its first beat; the grids are
  not aligned for the duration of the blend.
- `downbeats` stays unfilled — essentia.js has no downbeat tracker in its
  standard algorithm set. A bar-anchoring heuristic (every 4th beat anchored
  to the highest-energy beat) is the natural follow-up.
- Pro only applies through `AutomixPlugin`. The deprecated `useAutomix` hook
  (and therefore the built-in `automix` toggle in `AudioPlayer` /
  `AudioSessionProvider`) stays Lite; parity is a follow-up.
- Same constraints as Lite: CORS-readable audio required for analysis, HTML5
  backend only, automix self-disables on volume-locked browsers (iOS Safari)
  — Pro analysis is also gated off there.
- Bundler note for source consumers: the worker is created with
  `new Worker(new URL("./rhythmWorker.ts", import.meta.url), { type:
  "module" })`, the idiom Vite and webpack 5 understand. Where it isn't
  supported, worker construction fails and everything degrades to Lite.
- Dependency note: essentia.js is **AGPL-3.0** — review the licensing
  implications before shipping this in a closed-source product.
