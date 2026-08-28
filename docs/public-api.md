# Public API map

`@seihouse/audio-player` has one supported JavaScript entry point and one
supported stylesheet subpath:

```ts
import { AudioPlayer } from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"
```

The root entry point is intentionally broad. This guide groups its public
exports by integration purpose so consumers can start at the right boundary
without deep-importing implementation files. The authoritative export list and
TypeScript signatures live in
[`src/audio-player/index.ts`](../src/audio-player/index.ts).

## Integration rules

- Import runtime values and types from `@seihouse/audio-player`; use `import
  type` for type-only imports.
- Do not import from `src/`, `dist/`, or a package-internal directory. The
  package only exports `.` and `./styles.css`.
- Choose one playback ownership model for a screen: standalone `AudioPlayer`,
  a shared `AudioSessionProvider`, or the headless `useAudioPlayer` hook.
  Multiple skins belong under one shared session; do not create multiple
  competing engines for the same queue.
- Treat the package as actively developed. Use a reviewed published release,
  pin an exact version when reproducibility matters, and validate an upgrade
  before moving that version.

## Start here

| Integration need | Start with | Notes |
| --- | --- | --- |
| One self-contained player | `AudioPlayer`, `Track`, `AudioPlayerProps` | The simplest default. It creates its own session and accepts a single track or a queue. |
| One queue, several visual players | `AudioSessionProvider`, `useAudioSession`, `FullCardPlayer` or another skin | One provider owns the audio element and queue; every skin reads that same session. |
| Fully custom controls | `useAudioPlayer` or `useSAPPropGetters` | Use `useAudioPlayer` for a standalone engine, or the prop getters over an existing session. |
| Extensible lifecycle behavior | `createAutomixPlugin`, `createKeyboardShortcutPlugin`, or `AudioPlayerPlugin` | Pass a memoized plugin array to `AudioPlayer` or `AudioSessionProvider`. |
| Timed scene or reader audio | `CueManifestPlugin`, `CueRuntime`, `useNarrativeAudio`, or `SceneMixEngine` | Use the cue/narrative contracts instead of manipulating a skin's internals. |

## API families

| Family | Key exports | Use it for |
| --- | --- | --- |
| Playback and track data | `AudioPlayer`, `useAudioPlayer`, `Track`, `TrackSource`, `AudioPlayerEngine`, `AudioPlayerProps` | Standard playback, source fallback, private-source resolution, and UI state. |
| Backends and advanced playback | `createAudioBackend`, `AudioBackend`, `HTML5AudioBackend`, `WebAudioBackend`, `AudioSpriteEngine` | Custom backend integrations, codec checks, sprites, and low-level capability work. [`AUDIO_BACKEND_GUIDE.md`](../AUDIO_BACKEND_GUIDE.md) explains the supported backend choices. |
| Shared sessions | `AudioSessionProvider`, `useAudioSession`, `useAudioTime`, `SessionEngine`, `serializeSession`, `deserializeSession` | A single queue and audio element shared by multiple React surfaces. |
| Skins and reusable UI | `FullCardPlayer`, `StickyBottomPlayer`, `VaultRowPlayer`, `MiniSidebarPlayer`, `SeaCardPlayer`, `NarrativeFace` | Presentational player faces driven by an existing shared session. |
| Plugins | `PluginManager`, `AudioPlayerPlugin`, `createAutomixPlugin`, `createKeyboardShortcutPlugin`, `createAnalyticsPlugin`, `createLyricsPlugin`, `createSleepTimerPlugin`, `createWaveformPlugin` | Optional lifecycle behavior without changing a skin. See [`PLUGIN_DEVELOPMENT_GUIDE.md`](../PLUGIN_DEVELOPMENT_GUIDE.md). |
| Cues | `CueManifestPlugin`, `CueRuntime`, `validateCueManifest`, `useNarrativeCueController`, `CueManifest` | Validated, time-based events that coordinate a player with host UI or a narrative experience. See [`CUE_MANIFEST_V1.md`](./CUE_MANIFEST_V1.md). |
| Narrative engines | `useNarrativeAudio`, `SceneMixEngine`, `createSceneMixEngine`, `OneShotEngine`, `createOneShotEngine` | Narration, ambience, one-shots, and scene-score transitions independent of a visible player skin. |
| Automix and analysis | `createAutomixPlugin`, `ensureTrackAnalysis`, `ensureProTrackAnalysis`, `planTransition`, `bpmCompatibility` | Progressive crossfades with a conservative fallback when analysis is unavailable. See [`automix.md`](./automix.md). |
| Headless, surfaces, and visual slots | `useSAPPropGetters`, `useMediaSessionObserver`, `usePlayerSurface`, `VisualSlotsProvider`, `registerVisualComponent`, `PROPERTY_REGISTRY` | Custom controls, canvas/render zones, visual extensions, and editable surface properties. |
| Player actions and menus | `resolvePlayerMenu`, `PlayerMenuProfile`, `buildVaultTrackArcActions`, `buildStandardTrackArcActions`, `buildCanonicalPlayerActions`, `ArcActionButton`, `SAPController`, `routeArcAction` | Host-owned menu composition over SAP's shared routing. See [Menu architecture](#menu-architecture). |
| Workspaces and Agent Scout contracts | `WorkspaceShell`, `WORKSPACE_ROUTES`, `AgentQueueDirectorWorkspace`, `AgentScoutRequest`, `AgentScoutResponse` | Host-owned workspace routing and typed Agent Scout client contracts. The server endpoint and credentials are not part of the browser package. |
| Diagnostics | `ActivityLogProvider`, `useActivityLog`, `ActivityLogPanel`, `ActivityLogWorkspace`, `createActivityLogStore` | Bounded playback/activity diagnostics for host applications. |
| Shared components and utilities | `ProgressBar`, `VolumeControl`, `WaveformProgress`, `TrackMetadata`, `formatTime`, `trackKey`, `getTrackSources` | Compose a custom UI from the same primitives used by the bundled skins. |

## Menu architecture

There are exactly two connected menu surfaces, and they are two halves of one
system:

1. **`SAPController`** — the three-dot controller and workspace shell. Every
   settings destination in the player renders inside it, at a `WorkspaceRoute`.
2. **The radial action menu** (`ArcActionButton`, presented by
   `SEICanvasActionMenu`) — a shortcut launcher whose settings leaves open their
   destination *inside that same controller*.

Nothing else is a menu destination. A leaf resolves to a controller workspace, a
genuinely immediate command (skip, queue, copy link, favorite), or an honest
entitlement lock — there is no drawer, pop-out, or face-specific menu to reach.

`buildCanonicalPlayerActions()` is the single hierarchy every music face builds:

```
Plugins  › Audio / Visual / Analytics   (active plugins, + Canvas)
Playback › Previous / Next / Controls / Debug
Queue    › Up Next / Play Next / Play Later / Director
Share    › Link / Add to / Favorite
Agents   › Scout / Memoir
Vault    › Tag / Rename / Playlist / Radio     (vault capability)
```

Faces may place and style the trigger however they like; the actions, their ids,
and their destinations are identical everywhere. The only thing that varies is
what survives capability filtering. `pruneDeadArcActions()` drops an action when

- a capability it declares (`requires: ["canvas"]`, `["vault"]`) is not present
  on the host,
- the workspace host isn't wired, or
- the immediate command it names isn't implemented.

Anything else — layout, density, taste — is not a reason to hide an action, so a
visible node always does something real. Transient unavailability (nothing to
skip back to) renders the action dimmed rather than removing it.

```tsx
const actions = buildCanonicalPlayerActions({ activePluginIds })

<ArcActionButton
    actions={actions}
    commands={{ "track.next": session.next }}
    capabilities={{ canvas: true, vault: false }}
    onOpenWorkspace={setControllerRoute}
/>
```

`describeArcRoutes(actions)` returns the route matrix — every leaf paired with
its destination — which is how the tests audit that nothing is dead and nothing
escapes the contract.

### Who owns what

The routing machinery is SAP's. **What is in the menu is the consuming
product's.** The canonical hierarchy is the default, not a mandate.

Every face that exposes the radial menu — `FullCardPlayer`, `AudioPlayer`,
`StickyBottomPlayer`, `MiniSidebarPlayer`, `SeaCardPlayer`, `VaultRowPlayer` —
takes the same three props:

| Prop | Effect |
| --- | --- |
| `actions` | Renders exactly this tree. No canonical category is merged in, appended, or reordered around it. |
| `menuProfile.categories` | Keeps the canonical arms, but only these, in this order. |
| `menuProfile.extraActions` | Keeps the canonical arms and adds yours (`placement: "append" \| "prepend"`). |

Omit all three and the face renders SAP's canonical hierarchy, unchanged.

```tsx
// A product shipping its own categories:
<VaultRowPlayer track={track} actions={buildVaultTrackArcActions()} … />

// Or keeping SAP's, minus the ones this surface has no use for:
<FullCardPlayer menuProfile={{ categories: ["playback", "queue", "share"] }} />

// Or SAP's plus your own:
<SeaCardPlayer
    track={track}
    menuProfile={{ extraActions: [buyArm] }}
    commands={{ "commerce.buy": openCheckout }}
/>
```

Host trees are not second-class: they go through the same router, the same
capability pruning, and open in the same controller. Wire immediate commands
through `commands` (they merge over the face's own, host winning) and declare
custom gates with `requires` + `menuCapabilities`.

### Pre-consolidation builders

`buildVaultTrackArcActions()` and `buildStandardTrackArcActions()` return the
trees they always returned — the Vault menu is still exactly Vault / Playback /
Share / Agents — so a product that shipped one keeps the menu it shipped.
`buildLegacyPlaybackArcBranch()` is the Up Next / Controls / Debug arm those
composites use; the canonical `buildPlaybackArcBranch()` carries transport
instead, so compose from the legacy one if you want the original leaves.

## Ownership boundaries

### Standalone playback

`AudioPlayer` owns a session internally. Pass it `tracks` for a queue, or the
single-track fields (`title`, `artist`, and `audioFile` or `sources`) for one
track. It is the right choice when a page has one self-contained player.

### Shared playback

`AudioSessionProvider` owns one audio element and its queue. Render any number
of skins or custom controls under it. Use `useAudioSession()` for state and
commands rather than passing engine internals between skins.

### Headless and low-level playback

`useAudioPlayer` owns a standalone engine. `useSAPPropGetters` adapts an
existing engine or session for accessible custom controls. `AudioBackend` and
the backend classes are advanced contracts: `AudioPlayer` accepts backend
selection through `audioBackend`, while its underlying engine/session exposes
status through `getBackendInfo()`. Neither exposes a mutable raw backend
instance. See the backend guide before integrating one directly.

## Plugins and Automix

Plugins receive a `PluginPlayerContext`, not React component internals. Keep a
plugin array stable with `useMemo`, then pass it through the player or session:

```tsx
const plugins = useMemo(() => [createAutomixPlugin()], [])

return <AudioPlayer tracks={tracks} plugins={plugins} />
```

The `automix` prop is a simpler built-in switch. If a host passes its own
`AutomixPlugin`, it takes precedence so only one Automix controller can run.
There is no public `useAutomix` hook in the current package surface.

`PluginRegistryProvider` manages the optional built-in registry UI; it does not
accept a `plugins` prop. Read its active instances with
`useActivePluginInstances()` and pass that array to a player or session when a
host needs registry-managed plugins.

## Focused guides

- [Backend choices and fallback behavior](../AUDIO_BACKEND_GUIDE.md)
- [Plugin development](../PLUGIN_DEVELOPMENT_GUIDE.md)
- [Automix behavior and limits](./automix.md)
- [CueManifest v1](./CUE_MANIFEST_V1.md)
- [Playback resilience and Media Session behavior](./playback-resilience-and-media-session.md)
- [Browser and mobile quality matrix](./browser-mobile-quality-matrix.md)
- [Visual-slot importing](../src/audio-player/visual-slots/IMPORTING.md)

The Wavesurfer planning files and `PACKAGE_SETUP_COMPLETE.md` are historical
records, not current consumer API references. Use this guide, the README, and
the focused guides above for new integrations.
