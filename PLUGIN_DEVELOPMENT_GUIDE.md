# SEIHouse Audio Player Plugin Development Guide

The audio player supports optional lifecycle plugins for features that should be
swappable instead of hard-wired into skins. Plugins can observe playback,
control the engine, add keyboard behavior, send analytics, or coordinate UI such
as synced lyrics.

The plugin system is intentionally additive:

- No plugins are required.
- Plugin failures are isolated by `PluginManager` and logged as warnings.
- Existing skins and compact layouts do not need to know which plugins are
  registered.
- Existing `useAutomix` imports still work, but direct hook usage now emits a
  deprecation warning. New integrations should prefer `AutomixPlugin`.

---

## Public API

```ts
import {
  AudioPlayer,
  AudioSessionProvider,
  createKeyboardShortcutPlugin,
  createAnalyticsPlugin,
  createLyricsPlugin,
  createSleepTimerPlugin,
  createAutomixPlugin,
} from "./src/audio-player"
```

Both standalone and shared-session entry points accept plugins:

```tsx
<AudioPlayer
  title="Plugin Demo"
  artist="SEIHouse"
  audioFile="/track.mp3"
  plugins={[
    createKeyboardShortcutPlugin(),
    createAnalyticsPlugin({ send: console.log }),
    createSleepTimerPlugin(),
  ]}
/>
```

```tsx
<AudioSessionProvider
  initialQueue={tracks}
  plugins={[createKeyboardShortcutPlugin({ scope: "document" })]}
>
  <AppSkins />
</AudioSessionProvider>
```

---

## Plugin interface

All plugins implement `AudioPlayerPlugin` from
`src/audio-player/core/plugins/PluginInterface.ts`.

```ts
import type {
  AudioPlayerPlugin,
  PluginPlayerContext,
} from "./src/audio-player"

export class ExamplePlugin implements AudioPlayerPlugin {
  name = "example"
  private player: PluginPlayerContext | null = null

  init(playerInstance: PluginPlayerContext) {
    this.player = playerInstance
  }

  destroy() {
    this.player = null
  }

  onTrackLoad(track) {
    console.log("loaded", track?.title)
  }

  onPlay() {
    console.log("play")
  }

}
```

### Required methods

| Method | Purpose |
| --- | --- |
| `init(playerInstance)` | Called when the plugin is registered. Store the context and attach any DOM/listener resources here. May return a cleanup function. |
| `destroy()` | Called when the plugin is unregistered or the player unmounts. Release timers, listeners, detached audio elements, and references. |

### Optional hooks

| Hook | Args | Fired when |
| --- | --- | --- |
| `onTrackLoad(track)` | `Track | null` | The logical source/track identity changes. |
| `onPlay()` | none | Playback transitions from paused to playing. |
| `onPause()` | none | Playback transitions from playing to paused. |
| `onStop()` | none | The player/session unloads, has no audio, clears queue, or unmounts. |
| `onSeek(position)` | seconds | A plugin-aware seek action is requested. |
| `onTimeUpdate(position)` | seconds | Playback time updates. Keep this hook cheap. |
| `onTrackEnded(track)` | `Track | null` | The active track ends. Return `true` to claim the event and suppress normal host advance. |

---

## Player context

Plugins receive a `PluginPlayerContext` instead of component internals. The
context provides lazy getters so plugins always read current state:

```ts
player.getEngine()          // AudioPlayerEngine controls/state
player.getAudioElement()    // underlying HTMLAudioElement | null
player.getRootElement()     // standalone player root | null
player.getCurrentTrack()    // active Track | null
player.getNextTrack()       // resolved next Track | null
player.getSourceKey()       // logical source identity
player.requestAdvance?.()   // normal queue advance path
player.next?.()             // optional queue next
player.previous?.()         // optional queue previous
player.getQueue?.()         // optional queue snapshot
player.getCurrentIndex?.()  // optional queue index
player.getRepeatMode?.()    // optional repeat mode
player.getShuffle?.()       // optional shuffle state
```

Avoid storing values returned by getters for long periods. Store the context,
then call getters when a hook/listener runs.

---

## Built-in plugins

### `KeyboardShortcutPlugin`

Adds keyboard controls without changing skins.

```ts
createKeyboardShortcutPlugin({
  scope: "root",          // "root" or "document"
  seekSeconds: 10,
  enableJKL: true,
  enablePlaylistKeys: true,
})
```

Default keys:

- `Space` / `K`: play-pause toggle
- `ArrowLeft` / `J`: seek backward
- `ArrowRight` / `L`: seek forward
- `N`: next track when available
- `P`: previous track when available

The plugin ignores inputs, buttons, sliders, links, selects, textareas, and
contenteditable targets.

### `AnalyticsPlugin`

Tracks playback lifecycle events and sends them to either a callback or an HTTP
endpoint.

```ts
createAnalyticsPlugin({
  send: (event) => {
    // event.type: track_load | play | pause | stop | seek | time_update | track_ended
    console.log(event)
  },
})
```

For network delivery:

```ts
createAnalyticsPlugin({ endpoint: "/api/audio-events" })
```

The endpoint path uses `navigator.sendBeacon` when available and falls back to
`fetch(..., { keepalive: true })`.

### `LyricsPlugin`

Syncs plain or LRC-style lyrics with playback. LRC timestamps look like
`[00:12.50]Line text`.

```ts
createLyricsPlugin({
  lyrics: "[00:00.00]Intro\n[00:10.00]First line",
  onLineChange: (line, index, track) => {
    console.log(index, line?.text, track?.title)
  },
})
```

You can also provide `target` to write the active line into a DOM node.

### `SleepTimerPlugin`

Adds a compact dropdown with `15 min`, `30 min`, `45 min`, `1 hr`, and
`Until end of track` options. Countdown presets use wall-clock time and pause
the engine when they expire. `Until end of track` pauses when the active track
ends and claims the hook so the host does not auto-advance.

```ts
createSleepTimerPlugin()
```

Standalone players mount the dropdown into the player root. Shared sessions can
pass `target` to render the dropdown somewhere else, or call `setTimer` on a
plugin instance from custom UI.

### `AutomixPlugin`

Automix Lite is available as a plugin class/factory:

```ts
createAutomixPlugin({ enabled: true })
```

It mirrors the legacy two-deck crossfade behavior: the main engine audio element
remains deck A/source-of-truth, while the plugin owns a detached deck B around
the transition window. It returns `true` from `onTrackEnded` during handoff to
prevent double-advancing.

> Compatibility: the existing `useAutomix` hook remains exported for older code,
> but direct hook usage is deprecated.

---

## Error Isolation and Graceful Degradation

Plugins use a structured error boundary system (`PluginErrorBoundary`) to ensure failures do not crash the core audio player experience:

1. **Config Validation**: All built-in plugins validate their configuration at construction time using `zod`. Invalid config gracefully falls back to safe defaults, emitting a console warning.
2. **Error Boundaries**: `PluginManager` wraps every plugin lifecycle call in an error boundary.
3. **Structured Errors**: Failures are wrapped in a `PluginError` object that includes the `pluginName`, `operation`, `cause`, and whether the error is `recoverable`.
4. **Graceful Degradation**: 
   - A failing `init` disables the plugin and prevents registration.
   - A failing hook (like `onTrackLoad`) uses a fallback value from `GracefulDegradation` to skip the action safely, allowing the player to continue.
   - A failing `destroy` logs a warning but does not block memory cleanup.

Host applications can inject a custom `PluginErrorHandler` to intercept these errors, log them to tracking services, or notify users gracefully when a plugin fails repeatedly.

---

## Best practices

1. Give every plugin a stable, unique `name`.
2. Memoize plugin arrays in React (`useMemo`) so plugins are not recreated every
   render.
3. Keep `onTimeUpdate` lightweight; it may fire frequently during playback.
4. Use `destroy` for cleanup: event listeners, intervals, timeouts, detached
   audio elements, and references.
5. Use `getRootElement()` for scoped DOM behavior. Use `scope: "document"` only
   for global sessions or intentional app-wide shortcuts.
6. Return `true` from `onTrackEnded` only if your plugin has fully claimed the
   end-of-track behavior.

---

## Minimal plugin template

```ts
import type { AudioPlayerPlugin, PluginPlayerContext } from "./src/audio-player"

export function createMyPlugin(): AudioPlayerPlugin {
  let player: PluginPlayerContext | null = null

  return {
    name: "my-plugin",
    init(instance) {
      player = instance
    },
    destroy() {
      player = null
    },
    onPlay() {
      const track = player?.getCurrentTrack()
      console.log("Playing", track?.title)
    },
  }
}
```
