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
