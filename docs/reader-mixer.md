# Reader mixer

`createReaderMixer` plays a story reader's audio as three independent layers,
each with its own on/off switch and volume, under one master switch:

| Layer | What it is | Chosen by | Behavior |
| --- | --- | --- | --- |
| **Soundscapes** | The music score | The app (per chapter, or mid-chapter when the story turns) | Loops; crossfades (about 2 s) when the track changes; repeating the current track does nothing. |
| **Atmosphere** | An ambient bed: rain, wind, waves, crowd, city | The reader, as a personal preference shared by every story | Loops under everything until the reader changes it or picks Off. |
| **Sound Cues** | Short one-shot effects placed on words: a growl, a chime | The app | Play over the other layers without pausing or ducking them; cues may overlap. |

The mixer is built from the player's existing engines: two looping
`SceneMixEngine`s (soundscapes and atmosphere) and one `OneShotEngine` (cues).
It is headless and works without React; `ReaderMixerProvider` shares one
instance across a React app, and `ReaderMixerPanel` is the inline mixer view.

Narration is not one of these layers. `useNarrativeAudio` and `NarrativeFace`
keep working as before, independently of the mixer.

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
                onPreferencesChange: saveAudioPreferencesForUser, // debounce if you write to a server
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
| `setAtmosphereOptions(options)` | Replace the catalog. A saved choice waiting for its option starts when it arrives. |
| `playCue(url, { volume?, startTime? })` | Play a one-shot over the loops. Returns `false` when skipped: cues or master off, the concurrency cap (`maxConcurrentCues`, default 6), or no audio. |
| `stopAll({ fadeMs? })` | Fade both loops out; preferences are untouched. |
| `setLayerLevel(layer, 0..1)`, `setLayerEnabled(layer, on)`, `setMasterEnabled(on)` | The reader's controls. Changes apply live, including mid-crossfade. |
| `getPreferences()`, `setPreferences(input)`, `subscribePreferences(fn)` | The reader's settings as one plain object (see below). |
| `getState()`, `subscribe(fn)` | Snapshot for UI: preferences, each layer's status and effective level, active cues, routing, volume control, page visibility, `needsGesture`. |
| `unlock()` | Unlock audio from a gesture handler (see Mobile). |
| `dispose()`, `isDisposed()` | Release every element, listener and audio node. |

React: `ReaderMixerProvider` (`mixer` to share an existing instance, or
`options` to create and own one), `useReaderMixer()`,
`useOptionalReaderMixer()` and `useReaderMixerState(mixer?)`.

### Level math

A layer plays at `master on/off × layer on/off × layer level`, and a cue also
multiplies its per-call `volume`. `computeReaderMixerGain(preferences, layer,
volume?)` is the same formula as a pure function. Turning the master off and on
again restores every layer exactly, because the layers' own switches and levels
are never changed by the master.

### Layer status

Each layer reports `idle`, `loading`, `playing`, `blocked` (the browser wants a
tap; the next one retries), `failed` (with a `failure` message) or `paused`
(the page is hidden). A loop that is silent only because its switch, level or
the master is off still reports `playing`.

## Preferences

```json
{
    "version": 1,
    "masterEnabled": true,
    "layers": {
        "soundscapes": { "enabled": true, "level": 0.6 },
        "atmosphere": { "enabled": true, "level": 0.4 },
        "cues": { "enabled": true, "level": 0.8 }
    },
    "atmosphereId": "rain"
}
```

The snapshot is plain JSON. The host decides where it lives (per user, not per
story), gets every change through `onPreferencesChange` or
`subscribePreferences`, and passes it back as `initialPreferences`. Missing or
invalid fields fall back to defaults (`normalizeReaderMixerPreferences`), so an
old or partial save is safe. Slider drags report many changes; debounce before
writing to a server.

For a browser-only save, `loadReaderMixerPreferences(key)` and
`saveReaderMixerPreferences(key, preferences)` wrap `localStorage` under a key
the host chooses. The package hardcodes no key.

## Routing and iPhone volume

iOS Safari ignores `HTMLMediaElement.volume`. The mixer therefore has two
routes, chosen with `routing`:

| `routing` | How audio plays | Sliders on iPhone | File host needs CORS |
| --- | --- | --- | --- |
| `"element"` (default) | Plain media elements | On/off: above 0 plays at the device volume, 0 silences | No |
| `"auto"` | Web Audio only where element volume is ignored (iOS), elements elsewhere | Real loudness | Yes, on those browsers |
| `"web-audio"` | Web Audio everywhere | Real loudness | Yes, everywhere |

The Web Audio route sends each element through `MediaElementAudioSourceNode →
element gain → layer GainNode → destination`. Crossfades and per-cue volume use
the element gain; the layer GainNode carries the reader's layer level. Both
routes load audio with `crossOrigin="anonymous"`, because a cross-origin
element routed into Web Audio without CORS plays silence. With CORS missing the
files instead fail to load, and the layer reports `failed`.

`state.volumeControl` is `"on-off"` when sliders cannot set loudness, and
`ReaderMixerPanel` then shows "Volume is set by your device on this browser".

### CORS status of the SEIHouse audio hosts

Checked on 2026-10-01 with `curl -H "Origin: …"` against
`https://celestialaudio.seihouse.org/DEFAULT/Beasts/Growl/Tiger_Growl_1.mp3`
(and `https://audio.seihouse.org/SEA-NL/SEA-NL-0101.wav`):

- `GET` returns `200`/`206` with **no `Access-Control-Allow-Origin`** for any origin tried.
- An `OPTIONS` preflight returns `403`.

So the default stays `"element"`: playback works everywhere, and on iPhone the
sliders act as on/off. To get real sliders on iPhone:

1. Add a CORS policy to the R2 bucket behind `celestialaudio.seihouse.org`
   (Cloudflare dashboard → R2 → the bucket → Settings → CORS Policy):

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

    Replace `"*"` with the reader's own origins if the files should not be
    readable by other sites' scripts. The files stay public either way.
2. Purge the Cloudflare cache for that hostname, since cached responses lack the header.
3. Confirm: `curl -sI -H "Origin: https://example.com" <file url>` shows `access-control-allow-origin`.
4. Switch the host to `routing: "auto"`. Optionally also pass
   `analysisPolicy: "automatic"` so scores skip leading silence; the mixer leaves
   that analysis off by default because it re-fetches each score and needs CORS.

### The ring/silent switch

On iPhone, Web Audio follows the ring/silent switch (it is muted on silent) while
plain media elements keep playing. When the Web Audio route is active, the mixer
sets Safari's Audio Session API, `navigator.audioSession.type = "playback"`
(where the browser has it), so the reader's audio keeps playing on silent like other media.
Pass `audioSessionType: null` to leave the page's session untouched. The
element route needs nothing.

This behavior is not verifiable from automated tests. See
[Manual verification](#manual-verification).

## Mobile unlock

One tap, click or key press unlocks all three layers. On every such gesture the mixer:

- resumes its `AudioContext` (Web Audio route);
- retries any loop that the browser blocked (`blocked` → `playing`);
- prepares a few spare media elements inside the gesture for each engine.

WebKit unlocks audio per element, so a later scene change or a cue reached while
the reader scrolls uses a prepared element and can start without another tap.
`unlock()` does the same on demand; call it from the handler of the control that
turns audio on.

A cue that the browser still refuses is skipped (cues are moments, not loops),
and the Sound Cues layer reports `blocked` until the next gesture.

## Page visibility

**Decision:** while the page is hidden, the two loops pause in place; when it
returns they resume where they were. A switch requested while hidden, such as
the next chapter's score, starts on return. Cues already playing finish.
Layers report `paused`, and `state.pageHidden` is true. A reader cannot read a
hidden page, and this saves battery and data. Pass `pauseWhenHidden: false` to
keep playing in the background. If the browser refuses the resume (iOS after a
long time in the background), the layer reports `blocked` and the next tap
resumes it.

## Mixer view

`ReaderMixerPanel` renders a master switch, then one row per layer
(Soundscapes, Atmosphere, Sound Cues), each with an on/off switch, a 0–100
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

The Workshop's **SEN → Reader Mixer** workspace drives all three layers with the
mixer view. Before shipping a change to this path:

1. Desktop Chrome: open a chapter, pick an atmosphere, fire overlapping cues,
   switch the score mid-chapter, move each slider and switch, toggle the master,
   reload and confirm the settings return, then hide the tab and come back.
2. iPhone Safari, ring switch **on**, Element route: all three layers play
   together after one tap; sliders act as on/off and the view says so.
3. iPhone Safari, ring switch **silent**, Element route: audio keeps playing.
4. iPhone Safari, Web Audio route with the CORS sample (and, once CORS is
   enabled, with SEIHouse files): sliders set loudness, with the ring switch on
   and on silent.
5. iPhone: trigger "Battle starts" and a cue without tapping first (after the
   first unlock tap) and confirm both start.

Record browser and OS versions in the pull request.
