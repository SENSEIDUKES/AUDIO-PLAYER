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

**Problem.** `AudioPlayer.tsx` and `AudioSessionContext.tsx` previously had
separate Automix lifecycle paths for the `automix` prop/menu and an external
`AutomixPlugin` in the `pluginManager`. With both present, two
independent transition lifecycles could each call `requestAdvance()` → double
advance / double play.

**Fix.** The `automix` prop/menu now drives a **single internal `AutomixPlugin`**
registered through the plugin system. The former standalone `useAutomix` hook
is not part of the current public package surface.
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

## 4. Pause cancels pending Web Audio playback

`WebAudioBackend.pause()` invalidates pending playback even when the backend is
still downloading, decoding, or resuming its AudioContext. Playback has a separate
cancellation token from source loading: Pause releases this backend's active
context demand, while the load can finish and retain its buffer for a later Play.
The cancelled `play()` rejects with `AbortError` when its asynchronous wait settles;
it cannot start a source or release a newer Play's demand. Other active consumers
of the shared context continue playing.

Automated regression coverage delays download, decode, and context resume, checks
that no source starts or playback events fire after Pause, and verifies buffer
reuse, rapid Play → Pause → Play, and shared-context ownership.

### Manual iPhone/listening checklist (not verified by unit tests)

1. On iPhone Safari, use Web Audio playback with an uncached track and a slow
   connection. Tap Play, then Pause before loading completes. Wait for loading to
   finish: no sound should start and the player should remain paused.
2. Tap Play again: the loaded track should start normally. Repeat with rapid
   Play → Pause → Play and confirm only the final request plays.
3. While another shared-context audio consumer is playing, pause the pending
   track and confirm the other audio remains audible.

## 5. Persistent cache recovery, retention, and loading limits

A persistent-cache decode failure deletes that URL and attempts one fresh network
fetch within the same load. Only the final failure reaches the player error
handler. Successful fresh bytes replace the bad entry. Reads/writes remain best
effort when browser storage is unavailable.

The root package exports `invalidateAudioCache(url?)` to clear a trimmed URL from
memory and persistent storage, or all stored audio when the URL is omitted.
Invalidation prevents older in-flight jobs in this page's shared cache instance
from repopulating the caches. Other tabs or separately loaded package instances
can still write to the origin's persistent cache; cross-tab coordination is not
provided. It does
not stop audio or release a mounted backend's buffer: clear/reload its source to
adopt replaced bytes. Versioned URLs remain preferable for replaced files.
`configureAudioCacheRetention()` controls persistent FIFO retention. Defaults:
32 entries, 256 MiB total encoded bytes, seven days from storage. Expired and
legacy entries without timestamps are removed on access; writes and explicit
retention configuration prune the store. There is no background expiry timer.
Per-load encoded/decoded limits preserve healthy stored bytes, so raising a
memory limit later can reuse them offline. Storage-retention limits still prune
entries according to the configured policy.
Set `maxEntries: 0` to clear and disable persistence. These controls affect only
the named audio cache, not other application Cache API stores. Storage deletion
is best effort if the browser denies Cache API access.

`configureAudioResources()` controls WebAudioBackend loading across instances:
two concurrent load jobs, 32 MiB encoded per asset, and 64 MiB decoded per asset
by default. Slots cover disk reads, network download, decode and disk writes;
queued jobs check cancellation before allocating. Preload cancellation also
prevents a completed native decode from entering the cache. New jobs snapshot
the policy; existing jobs keep their limits.

Preloads use their own abort lifecycle, independent of active-track generations.
Changing tracks preserves active and queued preloads, so the next load can adopt
the same download and decode. Releasing preloads or destroying their backend
still cancels them. Decoded-cache ownership is retained lazily by loading or
preloading backends: one player's teardown preserves other players' buffers,
and the last owner's teardown clears the shared LRU. A revived backend retains
ownership again on its next load or preload.

The reader checks declared sizes before downloading and counts streamed chunks,
including missing or inaccurate Content-Length headers. PCM/float WAV headers
provide a decoded-size estimate before calling the native decoder, accounting
for resampling. All decoded buffers are checked before cache insertion and
backend adoption. Oversize assets produce `src-not-supported`; use HTML5 for
those sources. Existing HTML5 playback remains the default. For host metadata,
`recommendAudioBackend({ durationSeconds, encodedBytes, decodedBytes })` selects
HTML5 for unknown duration, durations over 45 seconds, or known over-budget size.
Choose before mounting; explicit Web Audio requests do not silently switch
backend contracts. This follows [MDN's AudioBuffer guidance](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
to use media-element sources for longer audio.

**Memory accounting limits:** `getAudioCacheStats()` and session
`getCacheStats()` include `activeBufferBytes` (also includes paused/ready backend
buffers), `inFlightEncodedBytes` (including copy estimates),
`decodingReservedBytes`, `activeLoads`, and `queuedLoads`. Active-buffer bytes
can overlap decoded-cache bytes and must not simply be summed. Native decoder
scratch/output allocations, external references and other audio engines are not
measured. Native decoding cannot be cancelled mid-call or hard-capped by this
API: non-WAV decoded size is known only after decode returns. A reservation is
not a measured heap value or a guarantee of peak memory. Streaming is the safe
choice for long or untrusted assets.

Manual browser/iPhone checks (not physical listening evidence):

1. Seed corrupt stored bytes, load the URL, and verify one network recovery and
   normal playback. Replace bytes at a URL, invalidate it, reload, and listen for
   the replacement.
2. Queue several preloads with network throttling. Observe at most the configured
   number of active jobs; release preloads and confirm queued work does not fetch.
3. Try an over-limit asset in Web Audio, then remount with HTML5. Confirm the
   former fails without starting audio and the latter streams from a user tap.
4. Clear stored audio and reload the page. Verify the cache is empty and normal
   playback fetches again. Recheck the earlier Play/Pause checklist on iPhone.

## 6. Runtime context recovery and independent fades

The backend factory keeps one stable facade while switching to HTML5 after
context/graph creation or non-autoplay resume failure. Existing subscriptions,
source and settings transfer, position restores on metadata, and diagnostics
report the active fallback. Cancellation prevents a late context failure from
starting HTML5 after Pause, source replacement or teardown. Ordinary autoplay,
codec, network and resource errors keep their existing handling.

Non-finite volume inputs are ignored in the hook and both backends. Finite
levels clamp to 0–1. Fades multiply a private gain by the host output gain;
they no longer change user volume, mute or the saved unmute level. Manual
volume/mute actions and unload reset the fade without reopening a host mute gate.

Spatial controls remain a documented advanced backend API. Capability reports
include actual stereo-panner availability, and active lite-mode replacement is
covered with and without that node.

## Tests (Vitest, no new deps)
- `core/audio/__tests__/AudioBackendFactory.test.ts` — static selection,
  runtime context failures, retained settings/events, cancellation and revival.
- `core/audio/__tests__/audioCaches.test.ts` — preload adoption across track
  changes, cache/pool ownership, spatial initialization and live graph changes.
- `core/audio/__tests__/outputGain.test.ts` and
  `__tests__/useAudioPlayer.volume.test.tsx` — finite volume, independent fades,
  host-gain composition, unmute restoration and hook runtime recovery.
- `core/audio/__tests__/WebAudioBackend.playback.test.ts` — pending playback
  cancellation, retained loading/buffers, resume races, and active context demand.
- `utils/__tests__/buffering.test.ts` — `shouldEnterBuffering` (waiting while
  paused vs playing vs pending).
- `plugins/__tests__/automixIntegration.test.ts` — only one Automix controller is
  ever resolved; an external plugin (incl. a differently-named `AutomixPlugin`
  instance like the registry's `registry-automix`) wins over the internal one.
- `plugins/__tests__/AutomixPlugin.test.ts` — `handleTrackEnded` does not suppress
  the host advance while idle (single advance); disabled/cancel stays idle.

## Manual QA checklist ("No Luck", mobile-sized viewport)
DOM-event cases not covered by unit tests. Run them in the Workshop's Testing
Lab: the **Playback checks** card (`?workspace=testing-lab&scenario=playback`)
opens a preset with these checks beside the preview; switch the device width
to a phone size. The Showcase fixture (`?workspace=showcase-fixture`) still
plays the same release.
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
