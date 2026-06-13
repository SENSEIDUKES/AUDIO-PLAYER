# Playback Hardening Pass — Notes

Scope: real playback bugs only (buffering spinner + Automix). No UI redesign; the
player faces are visually unchanged.

## 1. Fake buffering spinner

**Problem.** The main play button rendered `SpinnerIcon` whenever `isBuffering` was
true. The engine set `isBuffering = true` on every `waiting`/`stalled` event —
including passive media preload while paused — and never cleared it on
`pause`/`ended`. Result: the play button could spin while idle/paused at 0:00.

**Fix** (`src/audio-player/useAudioPlayer.ts`):
- `handleWaiting` now only enters buffering when playback is actually active or a
  play attempt is pending (`isPlayingRef.current || playPromiseRef.current !== null
  || !backend.isPaused()`), via the pure `shouldEnterBuffering` helper. Passive
  preload while paused no longer arms the spinner.
- `handlePause` and `handleEnded` now clear `isBuffering`. (Error, unload, source
  reset, and autoplay-rejection paths already cleared it.)
- With the engine gate + clears, `isBuffering` is an accurate source of truth (only
  true during active/pending-play waiting). The play button renders the spinner
  straight from `isBuffering` — no idle/paused spinner, and the initial
  pending-play load still shows one (the Web Audio backend emits `waiting` before
  `play`, so an `isBuffering && isPlaying` UI gate would wrongly hide it).

New pure helper (DOM-free, unit-tested): `shouldEnterBuffering`
(`src/audio-player/utils/buffering.ts`).

## 2. One Automix path (no duplicate controllers)

**Problem.** `AudioPlayer.tsx` and `AudioSessionContext.tsx` both mounted the legacy
`useAutomix` hook (driven by the `automix` prop/menu) **and** a `pluginManager`
that could also hold an external `AutomixPlugin`. With both present, two
independent transition lifecycles could each call `requestAdvance()` → double
advance / double play.

**Fix.** The `automix` prop/menu now drives a **single internal `AutomixPlugin`**
registered through the plugin system; legacy `useAutomix` is no longer mounted
(the hook + its public export remain for backwards compatibility, already marked
deprecated).
- The internal plugin is created once via a ref (stable identity) so the rAF
  re-render loop can't destroy/recreate it.
- `enabled` is driven from the prop/menu through `updateConfig` (no re-register).
- If the consumer passes their own Automix plugin via `plugins`, it wins and the
  internal one is omitted — guaranteed by `withInternalAutomix` /
  `hasAutomixPlugin` in `src/audio-player/plugins/automixIntegration.ts`.
- `advanceRef` is now a single path: `pluginManager.triggerUntilHandled("onTrackEnded")`
  then the host advance. The plugin's `handleTrackEnded` returns `false` while
  `fading` (host runs its one normal advance) and `true` while `handoff` (advance
  already happened), so a crossfade can't double-advance. Handoff relies on the
  host advance + engine auto-play (no extra `play()`), and `cancel()` restores
  `engine.volume` and releases deck B — so pause/seek mid-fade restores normal audio.

## 3. Plugin re-register hardening

**Problem.** `usePluginManager` calls `manager.replace(plugins)` on array-identity
change; with the rAF loop re-rendering ~60×/s, an inline
`plugins={[createAutomixPlugin()]}` would destroy/recreate the plugin every frame.

**Fix** (`src/audio-player/core/plugins/usePluginManager.ts`): the internal-automix
routing makes the prop path safe by construction. For external consumers, a
one-shot `console.warn` fires when the `plugins` array identity changes but the
set of plugin *names* is unchanged (the inline-array signature), advising
memoization. Legitimate plugin-set changes still replace normally. Docs updated in
`docs/automix.md`.

## Tests (Vitest, no new deps)
- `utils/__tests__/buffering.test.ts` — `shouldEnterBuffering` (waiting while
  paused vs playing vs pending).
- `plugins/__tests__/automixIntegration.test.ts` — only one Automix controller is
  ever resolved; an external plugin (incl. a differently-named `AutomixPlugin`
  instance like the registry's `registry-automix`) wins over the internal one.
- `plugins/__tests__/AutomixPlugin.test.ts` — `handleTrackEnded` does not suppress
  the host advance while idle (single advance); disabled/cancel stays idle.

## Manual QA checklist (Showcase "No Luck", mobile-sized viewport)
DOM-event cases not covered by unit tests:
1. Initial page load — no spinner on the play button while idle.
2. Tap play/pause repeatedly — spinner only appears during genuine load *while
   playing*; pausing clears it immediately.
3. Let a track play to the end — spinner clears.
4. next / previous and any source change *while paused* — no fake spinner.
5. Seek forward/back; repeat all.
6. Automix on/off; wait near the end of a track with Automix enabled — exactly one
   advance, audio volume restored after the crossfade; cancelling mid-fade (pause
   or seek back) restores normal volume and releases deck B.
7. iPhone Safari if available (volume-locked fallback: Automix degrades to the
   hard-cut advance, no stuck state).
