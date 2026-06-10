# Automix Lite (V1)

Opt-in two-deck crossfade transitions between queued tracks, with conservative
silence trimming so fades don't run through dead air. Off by default; with the
toggle off, playback behavior is identical to a build without the feature.

## What it does

- **Two-deck crossfade.** Near the end of the current track (deck A, the
  engine's single `<audio>` element), the next track is preloaded into a
  hidden, detached second element (deck B). Over a fixed ~5.5 s window the
  audible balance swaps from A to B using an equal-power curve
  (`cos`/`sin`), then the queue advances through the host's normal
  end-of-track path and the engine takes over deck B's position.
- **Conservative silence trimming.** When enabled, each track is scanned once
  (fetch → `decodeAudioData` → 50 ms RMS windows at ≈ −40 dBFS) for
  near-silent head/tail regions. `trimStartMs`/`trimEndMs` are cached per
  `trackKey` for the page lifetime. The fade is scheduled against the trimmed
  end of A, and deck B starts at its trimmed start. No BPM, beat, key, or
  structure analysis — amplitude only.
- **Graceful fallback everywhere.** Analysis that is unavailable, slow,
  CORS-blocked, oversized (> 30 MB / > 15 min), or unreliable resolves to
  "no trims". Any disruption mid-transition — pause, seek away, manual
  next/previous, queue edits, deck errors, blocked `play()` — cancels the
  transition, restores the user's volume, and falls back to the existing
  hard-cut advance.

## Where it lives

| Piece | File |
| --- | --- |
| Silence analysis + per-track cache | `src/audio-player/automix/silenceAnalysis.ts` |
| Transition controller hook | `src/audio-player/automix/useAutomix.ts` |
| Global session wiring + `automix`/`toggleAutomix` API | `src/audio-player/session/AudioSessionContext.tsx` |
| Standalone player wiring + menu toggle | `src/audio-player/AudioPlayer.tsx` |
| Skin toggles (lit icon = active indicator) | `src/audio-player/skins/FullCardPlayer.tsx`, `src/audio-player/skins/StickyBottomPlayer.tsx` |

The engine (`useAudioPlayer.ts`) is untouched. The hook observes the engine
from outside through `engine.audioRef` and the host's existing advance path
(`requestAdvance`), and intercepts double-advances via `handleTrackEnded()`
inside the host's `onEnded` handler.

## Controls

- **Global session skins:** crossfade icon button in the `FullCardPlayer` and
  `StickyBottomPlayer` transport rows (`SessionEngine.automix` /
  `toggleAutomix()`); `FullCardPlayer` also appends "· Automix" to its track
  counter. All skins share the session, so toggling anywhere applies
  everywhere. Initial state: `<AudioSessionProvider automix>`.
- **Standalone `AudioPlayer`:** "Automix Lite" switch in the ellipsis menu
  (playlist mode only) plus an "· Automix" chip in the track counter.
  Initial state: `automix` prop.

## Transition lifecycle

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

## Known limits (intentional for V1)

- **iOS Safari / volume-locked browsers:** programmatic element volume is
  ignored, so crossfading is impossible. The first failed volume write latches
  a page-wide flag and Automix degrades to the normal hard-cut advance.
- **Background tabs:** trigger evaluation rides the engine's rAF clock, which
  browsers throttle when hidden; transitions fall back to normal hard cuts.
  An already-running fade keeps progressing (interval-driven).
- **Repeat-one** and end-of-queue (repeat off) never automix.
- Analysis downloads the audio file once more (usually HTTP-cached) and
  decodes it transiently; analyses run one at a time and only while the
  feature is enabled.
- Fixed fade length; no tempo/beat awareness by design.
