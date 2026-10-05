# Public API map

`@seihouse/audio-player` has a core JavaScript entry point and an optional
reader UI entry, each with its own stylesheet:

```ts
import { AudioPlayer } from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"
// React 19 hosts using the approved settings panel:
import { ReaderMixerPanel } from "@seihouse/audio-player/reader-ui"
import "@seihouse/audio-player/reader-ui/styles.css"
```

The root entry point is intentionally broad. This guide groups its public
exports by integration purpose so consumers can start at the right boundary
without deep-importing implementation files. The authoritative export list and
TypeScript signatures live in
[`src/audio-player/index.ts`](../src/audio-player/index.ts) and
[`src/reader-ui/index.ts`](../src/reader-ui/index.ts).

## Integration rules

- Import core runtime values and types from `@seihouse/audio-player`; use `import
  type` for type-only imports.
- Do not import from `src/`, `dist/`, or a package-internal directory. The
  package exports `.`, `./styles.css`, `./reader-ui` and `./reader-ui/styles.css`.
- Import the panel and its label/prop types from `@seihouse/audio-player/reader-ui`.
  This ESM-only entry requires React 19, universal UI 0.10.1, Tailwind and the UI
  peers; the core keeps React >=18 without them. See [Reader UI setup](#reader-ui-entry).
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
| A story reader's music, atmosphere, sound cues and voice together | `createReaderMixer`, `ReaderMixerProvider`, `ReaderMixerPanel`, `ReaderMixerVoice`, `ReaderMixerNote` | Four layers with availability, soundtrack master, source leveling and session stop policies. See [`reader-mixer.md`](./reader-mixer.md). |

## API families

| Family | Key exports | Use it for |
| --- | --- | --- |
| Playback and track data | `AudioPlayer`, `useAudioPlayer`, `Track`, `TrackSource`, `AudioPlayerEngine`, `AudioPlayerProps` | Standard playback, source fallback, private-source resolution, and UI state. |
| Backends and advanced playback | `createAudioBackend`, `AudioBackend`, `HTML5AudioBackend`, `WebAudioBackend`, `AudioSpriteEngine` | Custom backend integrations, codec checks, sprites, and low-level capability work. [`AUDIO_BACKEND_GUIDE.md`](../AUDIO_BACKEND_GUIDE.md) explains the supported backend choices. |
| Shared sessions | `AudioSessionProvider`, `useAudioSession`, `useAudioTime`, `SessionEngine`, `serializeSession`, `deserializeSession` | A single queue and audio element shared by multiple React surfaces. |
| Skins and reusable UI | `FullCardPlayer`, `StickyBottomPlayer`, `VaultRowPlayer`, `MiniSidebarPlayer`, `SeaCardPlayer`, `NarrativeFace` | Presentational player faces driven by an existing shared session. |
| Plugins | `PluginManager`, `AudioPlayerPlugin`, `createAutomixPlugin`, `createKeyboardShortcutPlugin`, `createAnalyticsPlugin`, `createLyricsPlugin`, `createSleepTimerPlugin`, `createWaveformPlugin` | Optional lifecycle behavior without changing a skin. See [`PLUGIN_DEVELOPMENT_GUIDE.md`](../PLUGIN_DEVELOPMENT_GUIDE.md). |
| Cues | `CueManifestPlugin`, `CueRuntime`, `validateCueManifest`, `useNarrativeCueController`, `CueManifest` | Validated, time-based events that coordinate a player with host UI or a narrative experience. See [`CUE_MANIFEST_V1.md`](./CUE_MANIFEST_V1.md). |
| Narrative engines | `useNarrativeAudio`, `SceneMixEngine`, `createSceneMixEngine`, `OneShotEngine`, `createOneShotEngine`, `MediaGainSink` | Narration, ambience, one-shots, and scene-score transitions independent of a visible player skin. Both engines accept an optional `createGainSink` (Web Audio gain) and an `unlock()` for gesture-unlocked spare elements; `SceneMixEngine` adds `pause()`/`resume()`. |
| Reader mixer | `createReaderMixer`, `ReaderMixer`, `ReaderMixerProvider`, `useReaderMixer`, `useReaderMixerState`, `ReaderMixerNote`, `ReaderMixerVoice`, `ReaderMixerVoiceOutput`, `ReaderMixerPreferences`, `computeReaderMixerGain`, `loadReaderMixerPreferences`, `saveReaderMixerPreferences` | Core soundtrack/narration engines and chapter note. See [`reader-mixer.md`](./reader-mixer.md). |
| Reader UI (`/reader-ui`) | `ReaderMixerPanel`, `DEFAULT_READER_MIXER_LABELS`, `ReaderMixerPanelProps`, `ReaderMixerLabels`, `ReaderMixerLabelOverrides` | Approved universal SEIHouse UI controls, isolated from the core. |
| Loudness measurement | `measureLoudness`, `measureLoudnessPcm`, `computeLoudnessGain`, `DEFAULT_LOUDNESS_LEVELING`, `LoudnessMeasurement`, `LoudnessMeasureOptions`, `LoudnessLevelingOptions`, `LoudnessGain` | Offline browser/PCM measurement, integrated beds and momentary-max cues, sample peak and source gain before reader sliders. |
| Reader session policies | `READER_MIXER_SLEEP_TIMERS`, `ReaderMixerSleepTimerChoice`, `ReaderMixerSleepTimerState`, `ReaderMixerSleepEvent`, `ReaderMixerLayerAvailability`, `ReaderMixerNoteProps`, `ReaderMixerNoteLabels`, `DEFAULT_READER_MIXER_NOTE_LABELS` | Host-defined use, sleep events, activity holds and accessible chapter note. |
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
- [Reader mixer: soundtrack, Voice and reading policies](./reader-mixer.md)
- [Playback resilience and Media Session behavior](./playback-resilience-and-media-session.md)
- [Browser and mobile quality matrix](./browser-mobile-quality-matrix.md)
- [Visual-slot importing](../src/audio-player/visual-slots/IMPORTING.md)

The Wavesurfer planning files and `PACKAGE_SETUP_COMPLETE.md` are historical
records, not current consumer API references. Use this guide, the README, and
the focused guides above for new integrations.

### Host-owned Vault workspaces

The `renderWorkspace` prop on `<SAPController renderWorkspace={...} />` supplies host content inside the existing controller shell. Return `undefined` to use the built-in workspace; `null` intentionally leaves the body empty. Hosts own the selected attachment and asynchronous work outside the sheet lifecycle. Existing consumers are unchanged. The opt-in `vault:details` and `vault:route` destinations can be included in a host-provided `VaultRowPlayer.actions` tree; they are not added to the default menu.

## Reader UI entry

Version **4.0.0** moves the panel and its label/prop types from the root to
`@seihouse/audio-player/reader-ui`. The entry exports `ReaderMixerPanel`,
`DEFAULT_READER_MIXER_LABELS`, `ReaderMixerPanelProps`, `ReaderMixerLabels` and
`ReaderMixerLabelOverrides`. It is ESM-only and shares the root mixer/provider;
it does not create another playback engine. The core remains React >=18 with
ESM and CommonJS exports.

The optional panel needs React/React DOM **19**, universal `@seihouse/ui`
**0.10.1**, `@base-ui/react ^1.5.0`, `react-aria-components ^1.18.0`,
`tailwind-merge ^3.6.0`, `tailwind-variants ^3.2.2`, `vaul ^1.1.2`,
`clsx ^2.1.1`, `lucide-react ^0.546.0 || ^1.17.0`, and host Tailwind **4.3.3+**
within major 4. These UI peers are optional in the player manifest so a core-only
install needs none of the added peers; lucide-react was already a root dependency.

Use the exact `vendor/seihouse-ui-0.10.1.tgz` artifact from UI PR #87, commit
`d3c630181b5fb35cbb9be50847c96fff2dbd5e4a`, with integrity recorded in
[`vendor/ui-artifacts.json`](../vendor/ui-artifacts.json). Import
`@seihouse/ui/styles.css` (which includes its tokens and own Tailwind scan),
`@seihouse/audio-player/styles.css`, and
`@seihouse/audio-player/reader-ui/styles.css` into the host's Tailwind stylesheet.
Scan the shipped reader UI JavaScript as well. Choose `data-experience` and
`data-theme` on a host ancestor; the controls and root note use universal tokens.
See the complete [setup and migration example](./reader-mixer.md#reader-ui-setup-and-400-migration).

## Reader mixer

`createReaderMixer()` coordinates **Soundscapes**, **Atmosphere**, **Sound Cues**
and caller-owned **Voice**. Package 3.0.0 makes the master the soundtrack switch:
it gates the first three layers and leaves narration to its own Voice row.
Saved preference versions 1/2 normalize to version 3; an old master-off save also
migrates Voice to off so its previously silent output stays silent.

```ts
const mixer = createReaderMixer({ atmospheres, initialPreferences: saved, onPreferencesChange: save })
mixer.setLayerAvailability({ soundscapes: !!chapterScore, atmosphere: true, cues: chapterCueUrls.length > 0 })
if (chapterScore) mixer.playSoundscape(chapterScore, { scene: chapterId })
mixer.startAtmosphere()
mixer.playCue(growlUrl, { loudness: growlMeasurement })
mixer.setSleepTimer("chapter-end")
mixer.notifyChapterEnd() // actual host chapter-end signal
mixer.stopAll() // required when leaving the reader
```

`ReaderMixerProvider`, `useReaderMixer`, `useOptionalReaderMixer` and
`useReaderMixerState` share one instance. `ReaderMixerPanel` shows only layers
in use, preserves an interacting row, and exposes a collapsed native Atmosphere
picker and sleep controls. `ReaderMixerNote` is the small host-placed soundtrack
button; it shares master state, handles unlock/sleep resume, scroll opacity,
long-press Settings and accessible mute announcements. Labels and CSS variables
are host-overridable. Only Atmosphere can be auditioned; outside the reading
lifetime its saved selection previews for 10 seconds with fades.

Session methods are `setLayerAvailability`, `setSleepTimer`, `cancelSleepTimer`,
`notifyChapterEnd`, `subscribeSleep`, `retainActivity` and `resumeAudio`.
`getState()` includes `availability`, `sleepTimer`, `idle`, `soundscapePlays`,
`atmospherePreviewing` and `leveling`. Scores report `resting` after two plays
and restart on a new scene. Idle pauses after ten minutes without activity and
resumes in place on input. Sleep fades for twenty seconds and stays stopped
until explicit intent. These policies change no saved layer settings.

`NarrativeFace` shares the mixer's atmosphere and Voice settings and ducks beds
while audible narration plays. Connect one `ReaderMixerVoice` inside both
providers or `connectVoice(output)` headlessly. Voice uses the session's own
backend; decoded TTS files can use `audioBackend="webaudio"` for real iPhone
volume. Browser speech cannot be routed through the mixer: Listen uses
`retainActivity()`, `retainDuck()` and a sleep-event subscription instead.

Optional `loudness` metadata is supported on `Track`, `ReaderAtmosphereOption`
and `PlayCueOptions`. `measureLoudness` and `measureLoudnessPcm` export browser
and decoded-PCM measurement; `computeLoudnessGain` exports capped source gain.
Loops target −20 LUFS integrated and cues −14 LUFS momentary maximum, capped at
+12 dB and −1 dBFS sample peak. The browser filters are calibrated generic
K-weighting Biquads with BS.1770 gates; see the focused guide for their accuracy
boundary. `leveling` defaults on and `setLeveling()` changes it live. Auto uses
Web Audio while leveling is on, with a summed safety limiter; element routing
only attenuates and volume-locked iPhone fallback cannot level.

See [reader-mixer.md](./reader-mixer.md) for the API, configurable policies,
measurement CLI, defaults, migrations, source provenance and physical-device
checklist. The SEN import, note placement, Listen generation and publishing
remain host/owner work.
