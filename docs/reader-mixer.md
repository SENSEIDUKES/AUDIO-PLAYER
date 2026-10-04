# Reader mixer

`createReaderMixer` controls a story reader's audio as four independent layers,
each with its own on/off switch and volume, under one master switch:

| Layer | What it is | Chosen by | Behavior |
| --- | --- | --- | --- |
| **Soundscapes** | The music score | The app (per chapter, or mid-chapter when the story turns) | Loops; crossfades (about 2 s) when the track changes; repeating the current track does nothing. |
| **Atmosphere** | An ambient bed: rain, wind, waves, crowd, city | The reader, as a personal preference shared by every story | Loops under everything until the reader changes it or picks Off. |
| **Sound Cues** | Short one-shot effects placed on words: a growl, a chime | The app | Play over the other layers without pausing or ducking them; cues may overlap. |
| **Voice** | Recorded or AI-generated TTS audio | The host's narration session | Shares its existing transport, queue and playback speed; the mixer controls volume and on/off. Never ducked. |

The mixer is built from the player's existing engines: two looping
`SceneMixEngine`s (soundscapes and atmosphere) and one `OneShotEngine` (cues).
It is headless and works without React; `ReaderMixerProvider` shares one
instance across a React app, and `ReaderMixerPanel` is the inline mixer view.

Mount `ReaderMixerVoice` once inside both providers to connect an existing
`AudioSessionProvider` to Voice. A headless host can use `connectVoice(output)`
instead. The mixer does not generate speech or create a second narration player.
Browser `speechSynthesis` is not connected: use recorded/generated audio files
for the supported TTS path. Stand-alone `NarrativeFace` still works without a mixer.

## Host example

```tsx
import {
    ReaderMixerPanel,
    ReaderMixerProvider,
    useReaderMixer,
    type ReaderAtmosphereOption,
    type ReaderMixerPreferences,
} from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"

const ATMOSPHERES: ReaderAtmosphereOption[] = [
    { id: "rain", label: "Rain", group: "Weather", sources: [{ url: rainUrl }] },
    { id: "city", label: "City", group: "Places", sources: [{ url: cityUrl }] },
]

function App({ savedAudio }: { savedAudio: ReaderMixerPreferences | null }) {
    return (
        <ReaderMixerProvider
            options={{
                atmospheres: ATMOSPHERES,
                initialPreferences: savedAudio, // loaded per user, not per story
                onPreferencesChange: saveAudioPreferencesForUser, // coalesced by the mixer (300 ms)
            }}
        >
            <Reader />
        </ReaderMixerProvider>
    )
}

function ChapterView({ chapter }: { chapter: Chapter }) {
    const mixer = useReaderMixer()

    // A chapter opens → its score crossfades in, and the reader's atmosphere starts.
    useEffect(() => {
        mixer.playSoundscape(chapter.score)
        mixer.startAtmosphere()
    }, [mixer, chapter.score])

    // Warm the chapter's short cues before their words are reached.
    useEffect(() => {
        mixer.preloadCues(chapter.cues.map((cue) => cue.url))
    }, [mixer, chapter.cues])

    // Leaving the reader → fade both loops out; the reader's choices are kept.
    useEffect(() => () => mixer.stopAll(), [mixer])

    // The text reaches a cue → play it over the loops.
    const onCueReached = (cue: { url: string; volume?: number }) =>
        mixer.playCue(cue.url, { volume: cue.volume })

    // The story turns → switch the score mid-chapter.
    const onBattleStarts = () => mixer.playSoundscape(chapter.battleScore)

    return <ChapterText onCueReached={onCueReached} onBattleStarts={onBattleStarts} />
}

function AudioSettings() {
    // The reader picks rain here → mixer.setAtmosphere(rainOption) runs for you.
    return <ReaderMixerPanel />
}
```

Without React:

```ts
const mixer = createReaderMixer({ atmospheres: ATMOSPHERES, initialPreferences: saved })
mixer.playSoundscape(chapterScore) // a chapter opens
mixer.setAtmosphere("rain")        // the reader picks rain (an option, its id, or a Track)
mixer.preloadCues(chapterCueUrls)   // warm the bounded chapter cache ahead of the words
mixer.playCue(growlUrl)            // a cue is reached
mixer.dispose()                    // release everything
```

## API

| Member | Purpose |
| --- | --- |
| `playSoundscape(track, { fadeMs?, trimStartMs? })` | Crossfade the score to `track` (default `SCENE_FADE_MS`, 2 s). The same track again does nothing. |
| `stopSoundscape({ fadeMs? })` | Fade the score out. |
| `setAtmosphere(option \| id \| track \| null, { fadeMs? })` | Choose and play the reader's atmosphere and save it in the preferences. `null` saves Off and fades it out. |
| `startAtmosphere()` / `stopAtmosphere()` | Start the saved atmosphere (entering the reader) or fade it out without changing the choice (leaving). |
| `setAtmosphereOptions(options)` | Replace the catalog. A pending saved choice starts when it arrives; a removed choice fades out, and changed sources crossfade even under the same id. The saved choice is retained. |
| `playCue(url, { volume?, startTime? })` | Play a one-shot over the loops. Returns `false` when skipped: cues or master off, zero per-cue volume, a hidden page, the concurrency cap (`maxConcurrentCues`, default 6), or no audio. |
| `preloadCues(urls)` | Warm up to `maxCachedCueUrls` unique chapter cue URLs (default 8). No playback, active slot, gain sink or audio-session demand. Later triggers reuse loaded elements and keep their original 1.5 s start deadline. |
| `stopAll({ fadeMs? })` | Fade both loops out and pause connected Voice; preferences are untouched and cues finish on their own. |
| `connectVoice(output)` | Connect one `ReaderMixerVoiceOutput`; returns an idempotent cleanup. Replacing an output pauses and detaches the old one. Cleanup releases the mixer gate and subscription; the host owns the audio source and transport. |
| `setDuck(0..1, { fadeMs? })`, `getDuck()` | Temporarily lower Soundscapes and Atmosphere (for example under narration) without touching preferences. Cues and Voice are never ducked. `NarrativeFace` drives this for you. |
| `retainDuck()` | Get an independent `setDuck` / `release` owner. The strongest active duck wins; removing one narration control preserves the others. |
| `setLayerLevel(layer, 0..1)`, `setLayerEnabled(layer, on)`, `setMasterEnabled(on)` | The reader's controls. Changes apply live, including mid-crossfade. |
| `applyPreset(preset \| id)`, `getPresets()`, `resetPreferences()` | Pick a named mix in one tap, or return to the defaults (see Presets). |
| `getPreferences()`, `setPreferences(input)`, `subscribePreferences(fn)` | The reader's settings as one plain object (see below). |
| `flushPreferences()` | Deliver the latest pending persistence callback immediately; also runs on pagehide and dispose. |
| `getState()`, `subscribe(fn)` | Snapshot for UI: preferences, each layer's status and effective level, active cues, routing, volume control, page visibility, `needsGesture`. |
| `unlock()` | Unlock audio from a gesture handler (see Mobile). |
| `dispose()`, `isDisposed()` | Release every element, listener and audio node. |

React: `ReaderMixerProvider` (`mixer` to share an existing instance, or
`options` to create and own one), `useReaderMixer()`,
`useOptionalReaderMixer()` and `useReaderMixerState(mixer?)`.
An owned provider creates its mixer in an effect after the first committed render
and renders its children once it exists. Discarded renders create no listeners or
contexts; StrictMode disposes its first effect instance before replacing it.
A supplied `mixer` is available immediately and remains caller-owned.

### Level math

A layer plays at `master on/off × layer on/off × layer level`, and a cue also
multiplies its per-call `volume`. `computeReaderMixerGain(preferences, layer,
volume?)` is the same formula as a pure function. Turning the master off and on
again restores every layer exactly, because the layers' own switches and levels
are never changed by the master.

### Layer status

Each layer reports `idle`, `loading`, `playing`, `blocked` (the browser wants a
tap; the next one retries), `failed` (with a `failure` message) or `paused`
(the page is hidden or the system paused its media element). A loop that is silent only because its switch, level or
the master is off still reports `playing`.

## NarrativeFace as a companion

`NarrativeFace` (narration on the shared `AudioSessionProvider` session) pairs
with the mixer. Render it inside the same `ReaderMixerProvider`, or pass
`mixer={...}`, and:

- **One Voice control.** With `ReaderMixerVoice` connected, the face's voice
  slider and mute button share the saved Voice level and switch with the mixer.
  The master switch gates narration without changing the session's user mute,
  saved level, queue or playback position. Other session volume controls also
  update the saved Voice level.
- **Narration ducks the reader's music and atmosphere.** While the voice plays, the
  mixer's Soundscapes and Atmosphere drop by `duckAmount × intensity` (defaults
  0.6 × 1), with a short ramp, and return when it pauses or the face unmounts. Sound Cues
  keep their level. Muted, disabled or zero-volume narration restores the background mix.
- **One atmosphere control.** The face's Ambience slider reads and writes the
  mixer's Atmosphere level (the reader's saved setting), so it always agrees with
  `ReaderMixerPanel`.
- **One mood label.** Without a `sceneMood`, the face shows the reader's chosen
  atmosphere ("Rain").
- The face's `…` button (`showExpand` + `onExpand`) is the natural place to open
  the Settings › Audio view that holds `ReaderMixerPanel`.

```tsx
<AudioSessionProvider initialQueue={chapterNarration} audioBackend="webaudio">
    <ReaderMixerProvider options={mixerOptions}>
        <ReaderMixerVoice />
        <ChapterView />
        <NarrativeFace embedded showExpand onExpand={openAudioSettings} />
    </ReaderMixerProvider>
</AudioSessionProvider>
```

Mount one `ReaderMixerVoice` per narration session, even if several faces render
its controls. It accepts `mixer` for an explicit instance and `audioSessionType`
(default `"playback"`, or `null` to leave Safari's session untouched). The caller
continues to load/play TTS through the session. Mixer connection never starts
idle narration. Closing the chapter with `stopAll()` pauses narration, while
switches mute its output and keep transport running.

For another player, implement `ReaderMixerVoiceOutput`: `getState()` and
`subscribe()` report playback/mute/routing, `setLevel()` applies user volume,
`setEnabled()` gates output without overwriting that volume or user mute, and
`pause()`/`resume()` preserve playback position. Dispose pauses the connected
voice and releases its gate; it does not release the caller's source.

Pass `mixer={null}` to keep a face stand-alone inside a provider. A face with
its own `ambienceManifest` keeps that sprite ambience too, and it ducks as before.
On the element route where the browser ignores volume (`volumeControl:
"on-off"`), ducking cannot lower a layer partway; the default `"auto"` routing
avoids that on iPhone.

## Preferences

```json
{
    "version": 2,
    "masterEnabled": true,
    "layers": {
        "soundscapes": { "enabled": true, "level": 0.25 },
        "atmosphere": { "enabled": true, "level": 0.3 },
        "cues": { "enabled": true, "level": 0.75 },
        "voice": { "enabled": true, "level": 1 }
    },
    "atmosphereId": "gentle-rain"
}
```

The snapshot is plain JSON. The host decides where it lives (per user, not per
story), gets changes through `onPreferencesChange` or
`subscribePreferences`, and passes it back as `initialPreferences`. Missing or
invalid fields fall back to defaults (`normalizeReaderMixerPreferences`), so an
old or partial save is safe. Audio, state and `subscribePreferences` update
immediately on every slider change. `onPreferencesChange` receives the latest
snapshot after 300 ms without another preference change, coalescing a drag into
one persistence callback. Set `preferencesDebounceMs: 0` for the previous
immediate callback timing, or call `flushPreferences()` on an explicit commit.
Pagehide and dispose flush pending changes once. Asynchronous server writes still
belong to the host; flushing invokes the callback and cannot await a network save.

Version 1 saves migrate to version 2 without changing their three existing
layers, master switch or atmosphere. Voice defaults to enabled at 100%, or the
host's `defaultPreferences.layers.voice`. New snapshots always use version 2.
The package's 2.0.0 release expands the typed `ReaderMixerLayer` union and layer
records: update exhaustive host labels/maps to include `voice`, and normalize
stored JSON rather than casting a version 1 object as `ReaderMixerPreferences`.

## Loop boundaries and cue resources

ReaderMixer overlaps two media decks for the last 250 ms of a finite looping bed.
It preloads the silent standby, starts it at the selected `trimStartMs` on every
repeat, and fades before the outgoing asset ends to cover encoder padding and
restart gaps. The two unlocked elements are reused on successive repeats. Scene
switches stay transactional: an old bed can keep repeating while its requested
replacement loads. Pause, stop and dispose cancel boundary work. A failed standby
uses bounded retries; if it still misses the boundary, the current element
restarts at its trim rather than ending the bed. That recovery can have a gap.

`loopCrossfadeMs` defaults to 250 in the mixer, is capped to half the playable bed
length, and can be set to 0 to restore native looping. Standalone SceneMixEngine
keeps native looping by default; opt in with its additive `loopCrossfadeMs`
option. Browser timers and seek precision can affect boundaries. On an iPhone
element fallback that ignores volume, the overlap becomes a hard swap. **Listening
for rain-bed seams on a physical device remains required.**

The mixer retains about 8 idle cue URLs with at most 2 elements each; active cues
can temporarily exceed these cache limits up to the separate concurrency cap.
Use `maxCachedCueUrls` and `maxCuePoolSizePerUrl` to tune the cache. Idle cue sinks
disconnect from the Web Audio graph and reconnect the same captured source when
reused. Standalone OneShotEngine retains its prior 32 × 4 limits and connected
idle sinks unless configured otherwise. Its additive `preload(urls)` supports
the same bounded warm-up; `disconnectIdleSinks` requires a sink factory that can
reconnect a previously captured element.
Preloaded idle cues receive one gesture-time `load()` on the first subsequent
activation, so WebKit can unlock those existing elements too. Later taps do not
reload them. Hosts should still preload early enough for slow connections;
unready or blocked cues are dropped at their deadline.

The reader graph, WebAudioBackend narration and AudioSpriteEngine ambience share
one reference-counted AudioContext with separate output gains. An idle or hidden
mixer releases its own activity demand; another active consumer keeps the shared
context running. The last idle consumer suspends the render thread and the last
disposed consumer closes it. Merely loading a sprite pack or preloading cues does
not request playback. Each engine retains its own pause and disposal behavior.

For a browser-only save, `loadReaderMixerPreferences(key)` and
`saveReaderMixerPreferences(key, preferences)` wrap `localStorage` under a key
the host chooses. The package hardcodes no key.

## Defaults and presets

A new reader starts on the **default mix**: everything on, Soundscapes 25%,
Atmosphere 30% on the catalog option with id `"gentle-rain"`, and Sound Cues
75%, Voice 100% (`DEFAULT_READER_MIXER_PREFERENCES`). A host whose catalog uses different
ids, or that wants another starting mix, passes `defaultPreferences`; saved
`initialPreferences` fill in on top of it.

Presets switch the whole mix in one tap. The built-in `READER_MIXER_PRESETS` are:

| Preset | Soundscapes | Atmosphere | Sound Cues | Voice | Atmosphere choice |
| --- | --- | --- | --- | --- | --- |
| Default | 25% | 30% | 75% | 100% | resets to the default (gentle rain) |
| Cinematic | 60% | 35% | 90% | kept | kept |
| Calm | 15% | 40% | 40% | kept | kept |
| Focus | off | 30% | off | kept | kept |

Every preset turns the master on. Choosing Off keeps the open reader's
atmosphere lifetime: applying Default can
start its rain again. After `stopAtmosphere()` or `stopAll()` (leaving the reader),
presets only change saved settings until the host starts the atmosphere again.

A preset's `preferences` may be partial:
fields it leaves out keep the reader's current choice. `state.activePresetId`
names the preset the current mix matches, or `null` for a custom mix, and
`ReaderMixerPanel` shows the presets as a chip row above the master switch
(`showPresets={false}` hides it; `labels.presets` names it). Pass `presets` to
offer your own list and labels, for example translated ones.

## Routing and iPhone volume

iOS Safari ignores `HTMLMediaElement.volume`. The mixer therefore has two
routes for its loops and cues, chosen with `routing`:

| `routing` | How audio plays | Sliders on iPhone | File host needs CORS |
| --- | --- | --- | --- |
| `"auto"` (default) | Web Audio only where element volume is ignored (iOS), plain elements elsewhere | Real loudness; on/off for a layer that falls back | Yes, by default |
| `"element"` | Plain media elements everywhere | On/off: above 0 plays at the device volume, 0 silences | Yes by default; opt out with `crossOrigin: null` |
| `"web-audio"` | Web Audio everywhere | Real loudness | Yes, everywhere |

The Web Audio route sends each element through `MediaElementAudioSourceNode →
element gain → layer GainNode → destination`. Crossfades and per-cue volume use
the element gain; the layer GainNode carries the reader's layer level.
All mixer media, including plain elements and cues, now load with
`crossOrigin="anonymous"`. Consistent request modes prevent a plain mixer request
from caching a response that later breaks the iPhone route. For non-CORS hosts,
pass `crossOrigin: null`; this also selects element routing because Web Audio
cannot read those responses. Stand-alone `SceneMixEngine` and `OneShotEngine`
keep their existing opt-in CORS defaults.

Under `"auto"`, a Web Audio layer with a media or CORS failure retries once using
a fresh element without CORS or a connected source node. That layer stays on the
element route for the mixer's lifetime; other layers keep their route. On iPhone
this emergency fallback provides on/off volume. `state.layers[layer].routing`
reports it and `state.volumeControl` becomes `"on-off"`. Explicit `"web-audio"`
does not downgrade. A failed replacement still leaves the previous mix playing.

`state.volumeControl` is `"on-off"` when sliders cannot set loudness, and
`ReaderMixerPanel` then shows "Volume is set by your device on this browser".

**Voice routing belongs to the narration session.** Use
`AudioSessionProvider audioBackend="webaudio"` for real volume on decoded TTS
audio files, including iPhone. That backend downloads/decodes complete files and
requires CORS; it does not stream a live TTS response. HTML5 can play compatible
streams and non-CORS sources. Its volume works on browsers that honor element
volume, and falls back to on/off on iPhone. Voice zero, switch off and master off
still silence HTML5 output through its mute gate. `state.layers.voice.routing`
reports the session's active route; mixer `routing` does not change it.

### CORS on the SEIHouse audio hosts

The three hosts send `Access-Control-Allow-Origin: *` when the request carries
an `Origin` header. Responses to ordinary requests lack that header and
`Vary: Origin`, so another player can still poison the browser's HTTP cache:

| Hostname | Served by |
| --- | --- |
| `celestialaudio.seihouse.org` | R2 bucket `library` |
| `audio.seihouse.org` | R2 bucket `sea-audio` |
| `media.seihouse.org` | SEN soundscapes |

Both buckets carry this policy (Cloudflare dashboard → R2 → bucket → Settings →
CORS Policy):

```json
[
    {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["Range"],
        "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"],
        "MaxAgeSeconds": 86400
    }
]
```

**Required owner action (separate infrastructure change):** create a Cloudflare
[Response Header Transform Rule](https://developers.cloudflare.com/rules/transform/response-header-modification/)
matching these three hostnames, set `Access-Control-Allow-Origin: *` on every
response, and add `Origin` to `Vary` (preserving existing tokens). Then purge the
cache for all three hostnames. Verify ordinary and Origin-bearing GET/HEAD
requests, including ranged responses. The engine PR does not apply this rule.
Existing non-CORS cache entries from narration, previews or other players make
this step necessary even with the mixer's consistent CORS mode.

Silence-trim analysis stays off by default (`analysisPolicy: "off"`). It
downloads and decodes each score a second time, which is a lot of data for long
WAV scores. Pass `analysisPolicy: "automatic"` to trim leading silence, or
`trimStartMs` per track.

### The ring/silent switch

On iPhone, Web Audio follows the ring/silent switch (it is muted on silent) while
plain media elements keep playing. While Web Audio output is audible, the mixer
sets Safari's Audio Session API, `navigator.audioSession.type = "playback"`
(where the browser has it), so the reader's audio keeps playing on silent like other media.
The context suspends when no enabled loop is wanted and no enabled cue is active,
when the master is off, and while hidden under the default visibility policy.
An idle tap primes spares without resuming the context or claiming the session.
The previous session type is restored when all mixer/Voice owners release it,
so stopping one does not undo another's playback session. The mixer does not force an idle type: a host using mixable `"ambient"`
gets it back, and a host using `"auto"` gets that back. Pass `audioSessionType: null`
to leave the page's session untouched. The element route needs nothing.

This behavior is not verifiable from automated tests. See
[Manual verification](#manual-verification).

## Mobile unlock

Touchend, pointerup, click and non-Escape keydown unlock all three layers.
Touch pointerdown does not activate playback under the
[HTML user-activation rules](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event).
The spare pool also checks `navigator.userActivation.isActive` when available.
On an activation event the mixer:

- resumes its `AudioContext` only when enabled playback is wanted (Web Audio route);
- retries any loop that the browser blocked (`blocked` → `playing`);
- prepares a few spare media elements inside the gesture for each engine.

WebKit unlocks audio per element, so a later scene change or a cue reached while
the reader scrolls uses a prepared element and can start without another tap.
`unlock()` does the same on demand; call it from the handler of the control that
turns audio on.

A cue that the browser still refuses is skipped (cues are moments, not loops),
and the Sound Cues layer reports `blocked` until the next gesture.

## Network and interruption recovery

Mixer loop attempts have a 12-second load/start deadline, including metadata
waits for positive trims. Each source gets two retries with 500 ms then 1 s
backoff before advancing to the next source or reporting `failed`. A persistent
`waiting`/`stalled` event has the same deadline; `playing` clears it. A failure
mid-loop restarts the same source at its previous `currentTime`. An `online`
event re-requests a failed score or active atmosphere that is still wanted.
Stop, pause, superseding requests and disposal cancel obsolete attempts.
The old mix keeps playing until the newest candidate actually starts.

`loopAttemptTimeoutMs`, `loopMaxRetries` and `loopRetryDelayMs` configure these
bounds. Stand-alone engines keep their prior no-deadline/no-retry defaults;
their equivalent options are additive.

Cues have a 1.5-second start deadline (`cueStartTimeoutMs`), measured from the
original trigger, including any route fallback or suspended output context. A
cue that misses it is dropped and frees its concurrency slot. It is never
queued for a later gesture or network recovery. A cue that stalls during
playback is also dropped after 1.5 seconds without `playing`.

WebKit's `"interrupted"` context state is treated like `"suspended"` for
`needsGesture`. The mixer attempts resume on context state changes, returning
to visible, and activation events when playback is wanted. A system media pause
reports `paused`; `playing` restores the status. Non-autoplay resume errors use
the same bounded recovery and eventual `failed` state as load errors.
Phone calls, Siri and session ownership still **need physical iPhone verification**.

## Page visibility

**Decision:** while the page is hidden, the two loops pause in place; when it
returns they resume where they were. A switch requested while hidden, such as
the next chapter's score, starts on return. Active cues are dropped and new cues
are skipped while hidden, so none resume late with the context.
Layers report `paused`, and `state.pageHidden` is true. A reader cannot read a
hidden page, and this saves battery and data. Pass `pauseWhenHidden: false` to
keep playing in the background. If the browser refuses the resume (iOS after a
long time in the background), the layer reports `blocked` and the next tap
resumes it.

Connected Voice also pauses if it was playing, and resumes only when the mixer
paused it for visibility. A previously paused voice stays paused. Output is gated
while hidden, including a pending TTS load that finishes there; closing the
chapter with `stopAll()` cancels any automatic Voice resume.

## Mixer view

`ReaderMixerPanel` renders a master switch, then one row per layer
(Soundscapes, Atmosphere, Sound Cues, Voice), each with an on/off switch, a 0–100
slider and its percentage. An atmosphere picker sits under the Atmosphere row,
with Off first and the host's options grouped by `group`.

- **Inline only.** Normal document flow, no fixed positioning, so it fits in
  the Audio section of a settings menu.
- **Host-owned catalog.** `atmospheres` (or the mixer's catalog) supplies the options; the view only displays them.
- **Labels.** `labels` overrides every string, including `volume(layerLabel)`,
  `formatPercent(percent)`, row status messages and the device-volume hint.
  `DEFAULT_READER_MIXER_LABELS` lists them all.
- **Theme.** Set these custom properties on the panel (via `style` or CSS):

    | Property | Default |
    | --- | --- |
    | `--sap-reader-mixer-accent` | `#8b7cf6` |
    | `--sap-reader-mixer-accent-contrast` | `#ffffff` |
    | `--sap-reader-mixer-fg` / `--sap-reader-mixer-muted` | inherited text color |
    | `--sap-reader-mixer-bg` | `transparent` |
    | `--sap-reader-mixer-track` / `--sap-reader-mixer-border` / `--sap-reader-mixer-chip-bg` | translucent greys |
    | `--sap-reader-mixer-focus` | the accent |
    | `--sap-reader-mixer-radius` / `--sap-reader-mixer-gap` / `--sap-reader-mixer-padding` | `12px` / `12px` / `0` |
    | `--sap-reader-mixer-target-size` | `44px` |
    | `--sap-reader-mixer-font` | inherited |

- **Mobile first.** Designed for 390px, with every switch, slider and chip at least 44px tall.
- **Accessible.** Switches are `role="switch"` buttons named by their row;
  sliders are native range inputs named "Soundscapes volume" and so on, with the
  percentage as their value text; the picker is a native radio group in a
  `fieldset`; row status messages are polite live regions. Transitions are
  removed under `prefers-reduced-motion: reduce`.
- `titleAs` sets the heading element (default `h3`); `showTitle={false}` and
  `showAtmospherePicker={false}` hide those parts.

## Not included

- Ducking (lowering the score under cues). Cues play over the loops unchanged.
- Choosing scores, the sound catalog or cue placement. The host decides and calls the mixer.

## Manual verification

The Workshop's **SEN → Reader Mixer** workspace drives all four layers with the
mixer view. Before shipping a change to this path:

1. Desktop Chrome: open a chapter, pick an atmosphere, fire overlapping cues,
   switch the score mid-chapter, move each slider and switch, toggle the master,
   reload and confirm the settings return, then hide the tab and come back.
2. iPhone Safari, ring switch **on**, Element route: loops and cues play
   together after one tap; sliders act as on/off and the view says so (the
   fallback for hosts without CORS).
3. iPhone Safari, ring switch **silent**, Element route: audio keeps playing.
4. iPhone Safari, Auto route (the default) with SEIHouse files: sliders set
   loudness, with the ring switch on and on silent.
5. iPhone: trigger "Battle starts" and a cue without tapping first (after the
   first unlock tap) and confirm both start.
6. Start Spotify or a podcast before opening the reader. With the master off
   or no audio requested, tap and scroll; the other app must keep playing. Start
   reader audio, stop it, and confirm the session releases. Repeat with the
   ring switch on and silent.
7. Take a phone call (and try Siri) mid-chapter. Return to the visible reader;
   confirm the layer status reflects any system pause and playback resumes or
   asks for a tap. Confirm no old cue fires on return.
8. Toggle airplane mode during a chapter and during a score switch. The old
   score must survive the failed switch; on reconnect, the wanted score and
   atmosphere recover. Missed cues stay dropped and later cues still work.
9. Listen across several boundaries of a rain bed for loop seams (repeat after
   the follow-up loop-crossfade PR). Record a listening result separately from
   automated/browser checks.
10. **Voice/TTS on a physical iPhone (still required):** play a CORS-enabled
    generated/recorded TTS file with the narration session's Web Audio backend.
    Move the Voice slider, mute Voice, toggle master and restore each; confirm
    both actual loudness and unchanged playback position/queue/rate. Repeat
    with the ring switch on and silent, after backgrounding, and after a phone
    call. Test HTML5 separately: its zero/off gates must silence narration even
    when intermediate levels are controlled by the device. A slider test double
    or desktop screenshot is not physical listening evidence.
11. Desktop: compare the face's voice volume/mute with the fourth mixer row,
    try Off → Default for Atmosphere, and reset settings during a slider drag.
    Reload and confirm the saved defaults, including Voice, are restored.

Record browser and OS versions in the pull request.
