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


## Runtime readiness and replacement

Each installed manifest owns a sound scope. `sprite.play.pack` selects that exact
named pack; clip names may repeat across packs. Only referenced play packs preload.
Loads share the audio resource concurrency limit (two by default). Decoded packs
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
