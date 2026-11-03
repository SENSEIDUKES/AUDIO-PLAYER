# SAP JSON Cue Manifest V1

The `sap-cues/1` specification provides a generic, decoupled format for authoring immersive audio and narrative metadata events. Manifests can be tied to time or tied directly to host app events (such as paragraphs or scenes).

## Structure

```json
{
  "version": "sap-cues/1",
  "id": "optional-manifest-id",
  "metadata": {},
  "assets": {
    "spritePacks": {}
  },
  "cues": []
}
```

---

## Examples

### 1. Simple Time FX
Fires a sound effect exactly at 5.2 seconds in the audio track.

```json
{
  "version": "sap-cues/1",
  "assets": {
    "spritePacks": {
      "default": {
        "src": "/audio/chapter-01-sprites.mp3",
        "clips": {
          "door_knock": { "offset": 14, "duration": 1.2, "volume": 0.9 }
        }
      }
    }
  },
  "cues": [
    {
      "id": "cue-001",
      "trigger": { "kind": "time", "at": 5.2 },
      "actions": [
        { "command": "sprite.play", "pack": "default", "clip": "door_knock" }
      ]
    }
  ]
}
```

### 2. Scene Ambience Change
Crossfades the ambient background loop when the user's host app signals it has entered the "rain-temple" scene.

```json
{
  "version": "sap-cues/1",
  "cues": [
    {
      "trigger": { "kind": "scene", "value": "rain-temple" },
      "actions": [
        { "command": "ambience.crossfade", "profile": "heavy_rain", "durationMs": 2000 }
      ]
    }
  ]
}
```

### 3. Paragraph Sting
Plays a tension sting when the reader hits paragraph `p-14`.

```json
{
  "version": "sap-cues/1",
  "cues": [
    {
      "trigger": { "kind": "paragraph", "value": "p-14" },
      "actions": [
        { "command": "sprite.play", "pack": "default", "clip": "tension_sting_01" },
        { "command": "duck.set", "amount": 0.3 }
      ]
    }
  ]
}
```

### 4. Chapter Intro
Initializes the emotional layer and pans sound spatially when the chapter begins.

```json
{
  "version": "sap-cues/1",
  "cues": [
    {
      "trigger": { "kind": "chapter", "value": "chapter-1" },
      "actions": [
        { "command": "layer.set", "layer": "emotion", "state": "sad" },
        { "command": "spatial.pan", "x": -1.0, "y": 0, "z": 0.5, "durationMs": 5000 }
      ]
    }
  ]
}
```

### 5. Metadata Signature
Fires an arbitrary event back to the host UI using a string signature matching when tension shifts.

```json
{
  "version": "sap-cues/1",
  "cues": [
    {
      "trigger": { "kind": "tension", "value": 80 },
      "actions": [
        { "command": "event.emit", "eventName": "ui.pulse_red", "detail": { "intensity": "high" } }
      ]
    }
  ]
}
```


## Time-cue playback policy

Time cues are driven by the player's live playback position, sampled every 100 ms
while playing (and immediately when a hidden page becomes visible), not by
animation frames. Timing is by position, not wall clock, so playback rate does not
matter.

| Moment | What happens |
| --- | --- |
| **Paused / loaded** | Nothing fires. A cue at `0:00` does not fire just because the track loaded or the player is paused. |
| **Start / resume** | Cues before the starting position count as passed. A cue exactly at the starting position fires immediately. A cue already fired this playthrough never fires twice. |
| **Normal playback** | Each sample fires the unfired cues between the previous and current position, once, in time order. |
| **Delayed samples** (backgrounded page, throttled timers) | Crossed cues still fire, in order, on the next sample. A `sprite.play` more than `lateCueToleranceSeconds` (default 2) overdue is skipped with outcome reason `late`; state and event actions still apply so the scene ends up correct. Nothing is dropped silently. |
| **Pause** | Catches up to the pause position, then stops timing. Seeks while paused only reposition; cues with `fireOnSeek` wait and fire when playback resumes. |
| **Seek** | Cues at or behind the target are consumed without firing, unless `fireOnSeek`. Replayable cues at or after the target re-arm. Samples are ignored while the engine reports a seek in progress. |
| **Rewind / loop** (position jumps back without a seek) | Replayable cues at or after the new position re-arm and can fire again. Non-replayable cues never repeat. Backward jitter under 0.1 s is ignored. |
| **Track change** | The previous manifest's runtime is disposed before the next track's cues are installed; late completions cannot fire old cues. The new track's cues stay inactive until its source is confirmed playing (the player's play event, or the media element reporting it), so a source that is still loading or fails never fires zero-time cues. A same-source metadata refresh (for example `playNow` with a refreshed track object) is not a track change: the runtime keeps running, or is swapped without interrupting playback if the manifest changed. |
| **Track end** | Every remaining cue up to the track's end fires once, then timing stops. The plugin never claims the end-of-track advance. |

Background behavior depends on the browser: audio keeps playing, but timers on a
hidden page may be throttled or suspended. The policy above makes that safe (late
cues catch up, overdue sprites are skipped), but exact timing in the background is
not guaranteed, and it has not been verified on iOS Safari.

Direct `CueRuntime` users: call `setPlaying(true, position)` / `setPlaying(false)`;
without it the runtime treats every `handleTimeUpdate` sample as playing, and the
first sample is the starting position (earlier cues count as passed).

## Validation

`parseCueManifest(json)` returns a result that says what was accepted:

- `status: "valid"` — everything was accepted (warnings may still be listed).
- `status: "accepted-with-omissions"` — a manifest was produced but cues or actions
  were dropped; `omittedCueCount`, `omittedActionCount` and `issues` say which.
- `status: "invalid"` — nothing usable; `manifest` is `null`.

Each issue has `severity` (`error` omits something, `warning` keeps it), `code`,
a JSON `path` such as `cues[2].actions[0].profile`, `cueIndex`, `cueId`,
`actionIndex`, `command`, `field` and a `message`. `formatCueManifestIssue` renders
one line. The plugin reports the same through `onStatus`
(`accepted-with-omissions`, `failed` and `installed` carry `issues`).

Checks: required fields per command; finite non-negative times and durations;
`duck.set.amount` and `volume.fadeNarration.volume` within 0 to 1; unknown commands
(with the supported list); duplicate explicit cue ids (the first is kept, later ones
are omitted); `sprite.play`/`sprite.fade` pointing at an undeclared pack or clip
(warning). A cue whose actions all fail is omitted instead of being kept empty, and
a manifest with cues but none usable is `invalid`.

Compatibility: `validateCueManifest` still returns the manifest for both `valid` and
`accepted-with-omissions` (and `null` for `invalid`), logging errors to the console,
but is deprecated because it cannot tell them apart. Earlier versions accepted
negative times, a duplicate id (only the first time cue fired; `executeCueById` ran the
last) and cues left with no actions; those now appear as omissions.

## Event channels

`event.emit`, the `sap-narrative-cue` broadcast and the `sap-dispatch-cue` trigger
travel on a per-session event target, so two players on one page cannot trigger each
other. Inside an `AudioSessionProvider` use `useAudioSessionCueTarget()` to listen
(`useNarrativeCueController` already does). Outside a provider the plugin falls back
to the player's root element, then `window`.

Migration: hosts that listened for these events on `window` under a provider should
listen on `useAudioSessionCueTarget()`, or pass `cueEventTarget={window}` to the
provider to keep the old page-wide behavior (and share it between sessions on
purpose).

## Which actions take effect

| Action | Applied by | Notes |
| --- | --- | --- |
| `sprite.play` | cue runtime | `loop`, `volume` and `fadeInMs` (starts from silence and ramps up) |
| `sprite.stop` | cue runtime | optional `fadeOutMs` |
| `sprite.fade` | cue runtime | |
| `player.seek`, `player.pause` | cue runtime | session player |
| `event.emit` | cue runtime | dispatches a DOM event on the session cue target for the host |
| `ambience.crossfade` | `useNarrativeCueController` | profile and `durationMs` (as `crossfadeMs`) |
| `duck.set` | `useNarrativeCueController` | |
| `volume.fadeNarration` | `useNarrativeCueController` | timed ramp of `narrationVolume`; pass the same `mixer` you give `useNarrativeAudio` so it starts from the reader's Voice level |
| `layer.set` | `useNarrativeCueController` (partial) | `intensity` and `mood`/`scene` drive narrative options; every layer is exposed as `layers` for host UI |
| `spatial.pan` | **host only** | Not supported yet: nothing bundled pans sprites or narration |

The controller applies narrative actions only when its `narrativeOptions` reach
`useNarrativeAudio` or `NarrativeFace`. A handler claims an action by calling
`event.preventDefault()` on the cancelable `sap-narrative-cue` event; the runtime then
reports outcome `executed`. An action nobody claims is reported as `skipped` with
reason `no-host-handler` instead of being counted as done. `CUE_ACTION_SUPPORT` and
`describeCueManifestSupport(manifest)` expose this table programmatically; the
Workshop shows it for the manifest being edited.

## Runtime readiness and replacement

Each installed manifest owns a sound scope. `sprite.play.pack` selects that exact
named pack; clip names may repeat across packs. Only referenced play packs preload.
By default at most four valid referenced packs are admitted in manifest cue order;
additional packs report `failed` with a pack-limit message and are never queued.
Set `maxSpritePacks` in the plugin/runtime options to a positive safe integer to
choose a different per-manifest budget; invalid values use four. With the default
64 MiB decoded-per-asset limit, this bounds retained pack buffers to 256 MiB per
runtime (not a whole-process heap cap). Split large manifests rather than raising
the limit without a memory budget. Loads share the audio resource concurrency
limit (two by default). Decoded packs
also obey the encoded/decoded byte limits; element packs stream instead of decoding
the whole asset. Element preloads have a 12-second readiness deadline.

Pack states are `loading`, `ready`, and `failed`. **A trigger while its pack is
loading or failed is skipped immediately.** It is never replayed when the pack
becomes ready. A later explicit trigger can play; time cues retain their existing
`replayable`/`fireOnSeek` rules. Non-audio actions in the same cue still execute.

`createCueManifestPlugin({ onStatus, onOutcome })` accepts optional observers.
`onStatus` reports installation, per-pack readiness/failure, and cleanup failures.
`onOutcome` reports each action with manifest/cue/pack/clip identifiers. `accepted`
means an instance was allocated; `started` means its playback start was observed,
not proof that a listener heard it. Skips include `pack-loading`, `pack-failed`,
`missing-asset`, and playback/policy rejection reasons. Asynchronous playback
failures are reported separately. Observer exceptions cannot stop playback.

Replacement, stop and destruction retire the runtime before releasing sounds.
Late fetch/decode completions cannot install or revive it. Cleanup is idempotent,
isolated per sound, and safe before or after the session sound layer is disposed.
React development Strict Mode is supported. Keep plugin arrays stable during a
session; create a new plugin instance for a new keyed session.

Custom `PluginSoundLayer` implementations can implement `createScope()` to return
a disposable `PluginSoundScope` supporting named packs. Existing single-pack
facades still work; multi-pack use without this capability reports a failure
instead of silently choosing the first pack. A custom layer owns cancellation of
its own asynchronous work; implementing scopes is recommended for replacement.

## Reader-owned story cues

Use `createReaderMixerCuePlugin(mixer, options)` instead of the standalone factory
when a reader's controls should govern the sounds. See the integration example in
[Reader mixer](./reader-mixer.md#story-manifest-integration). The standalone factory
does not discover a surrounding mixer automatically.
