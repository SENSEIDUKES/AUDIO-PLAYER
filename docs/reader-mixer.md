# Reader mixer

`createReaderMixer` controls a story reader's audio as four independent layers,
each with its own on/off switch and volume. The master is the soundtrack switch:
it gates Soundscapes, Atmosphere and Sound Cues, while Voice stays independent.

| Layer | What it is | Chosen by | Behavior |
| --- | --- | --- | --- |
| **Soundscapes** | The music score | The app (per chapter, or mid-chapter when the story turns) | Crossfades (about 2 s); rests after 2 plays. Same track and scene does nothing; a new scene restarts it. |
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

## Reader UI setup and 4.0.0 migration

The approved settings panel lives in the **ESM-only**
`@seihouse/audio-player/reader-ui` entry. Import `ReaderMixerPanel`,
`DEFAULT_READER_MIXER_LABELS`, `ReaderMixerPanelProps`, `ReaderMixerLabels` and
`ReaderMixerLabelOverrides` from that entry instead of the package root. This
import change is the reason for the **4.0.0 major release**. Mixer behavior,
panel props, labels and saved preference version 3 stay the same.

The root entry keeps `react >= 18` / `react-dom >= 18`, including
`ReaderMixerProvider`, `ReaderMixerVoice` and `ReaderMixerNote`. It never imports
the UI package or its peers. They are optional peers of the player; a core-only
installation does not install them. Using the settings panel requires **React
19** and the following host dependencies:

| Dependency | Version |
| --- | --- |
| `@seihouse/ui` | **0.10.1**, exact vendored artifact |
| `react` / `react-dom` | `^19.0.0` |
| `@base-ui/react` | `^1.5.0` |
| `react-aria-components` | `^1.18.0` |
| `tailwind-merge` | `^3.6.0` |
| `tailwind-variants` | `^3.2.2` |
| `vaul` | `^1.1.2` |
| `clsx` | `^2.1.1` |
| `lucide-react` | `^0.546.0 \|\| ^1.17.0` (already a player dependency) |
| `tailwindcss` | `^4.3.3`, with the host's Tailwind integration |

This repository vendors `vendor/seihouse-ui-0.10.1.tgz`, copied from the
development repository. It is the universal UI package from [UI PR #87](https://github.com/SENSEIDUKES/UI/pull/87),
source commit `d3c630181b5fb35cbb9be50847c96fff2dbd5e4a`. Its source and SHA-512
integrity are recorded in [`vendor/ui-artifacts.json`](../vendor/ui-artifacts.json)
and checked against the tarball and lockfile by `npm test`. No Library-specific
skin is included.

For an npm consumer, copy that exact tarball into its own `vendor/` directory
and install the panel dependencies:

```bash
npm install react@^19 react-dom@^19 ./vendor/seihouse-ui-0.10.1.tgz \
  @base-ui/react@^1.5.0 react-aria-components@^1.18.0 \
  tailwind-merge@^3.6.0 tailwind-variants@^3.2.2 vaul@^1.1.2 \
  clsx@^2.1.1 lucide-react@^1.17.0 tailwindcss@^4.3.3
```

The host owns Tailwind and imports the styles once. In a stylesheet under
`src/`, for example:

```css
@import "tailwindcss";
@import "@seihouse/ui/styles.css";
@import "@seihouse/audio-player/styles.css";
@import "@seihouse/audio-player/reader-ui/styles.css";
@source "../node_modules/@seihouse/audio-player/dist/reader-ui.js";
```

Adjust the `@source` path relative to the host stylesheet. UI's `styles.css`
imports `tokens.css` and registers its own shipped JavaScript for Tailwind's
scan. Neither player stylesheet adds Tailwind preflight. If the host already
imports Tailwind/UI, add just the player styles and source registration.
The Workshop imports theme/utilities without preflight so its existing pages
keep their layout.

Choose the host's skin with `data-experience="default"`, `"sea"` or `"sen"`,
and contrast with `data-theme="dark"` or `"light"` on an ancestor. Every
control color comes from universal `--sh-*` tokens. The panel uses `SEISwitch`,
`SEISlider`, `SEISelect`, `SEIRadioGroup` / `SEIRadio`, and `SEIField`; local CSS
supplies layout and touch target sizing. The note keeps its root entry and glyph
and reads the same tokens when available, with inherited-color fallbacks for
core-only hosts.

## Host example

```tsx
import {
    ReaderMixerProvider,
    useReaderMixer,
    type ReaderAtmosphereOption,
    type ReaderMixerPreferences,
} from "@seihouse/audio-player"
import { ReaderMixerPanel } from "@seihouse/audio-player/reader-ui"
import "@seihouse/audio-player/styles.css"
// Include reader-ui styles and Tailwind/UI setup as shown above.

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
        mixer.setLayerAvailability({ soundscapes: !!chapter.score, atmosphere: true, cues: chapter.cues.length > 0 })
        if (chapter.score) mixer.playSoundscape(chapter.score, { scene: chapter.id })
        else mixer.stopSoundscape()
        mixer.startAtmosphere()
    }, [mixer, chapter.id, chapter.score, chapter.cues])

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
    const onBattleStarts = () => mixer.playSoundscape(chapter.battleScore, { scene: `${chapter.id}:battle` })

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
mixer.setLayerAvailability({ soundscapes: true, cues: chapterCueUrls.length > 0 })
mixer.playSoundscape(chapterScore, { scene: chapterId }) // a chapter opens
mixer.startAtmosphere()
mixer.setAtmosphere("rain")        // the reader picks rain (an option, its id, or a Track)
mixer.preloadCues(chapterCueUrls)   // warm the bounded chapter cache ahead of the words
mixer.playCue(growlUrl)            // a cue is reached
mixer.notifyChapterEnd()           // host signals the actual chapter end
mixer.stopAll()                    // required when leaving the reader
mixer.dispose()                    // release everything
```

## API

| Member | Purpose |
| --- | --- |
| `setLayerAvailability(partial)` | Declare rows in use; merged with the previous declaration, independent of playback and saved on/off. Read `state.availability`. |
| `setSleepTimer(id)` / `cancelSleepTimer()` | Choose a session-only timer or cancel a running timer. A new choice explicitly resumes audio stopped by sleep. |
| `notifyChapterEnd()` | Fire a running End of chapter timer; the host owns this signal. |
| `subscribeSleep(fn)` | Observe `{ choiceId, firedAt }`; stop host-owned browser Listen when it fires. `onSleepTimer` is the options callback form. |
| `retainActivity()` | Hold activity while Listen speaks; returns an idempotent release function. Playing connected Voice holds activity automatically. |
| `resumeAudio()` | Explicitly clear the sleep latch, turn the soundtrack on and unlock. Activity and scrolling never call it. |
| `setLeveling(on)` | Compare automatic source leveling on/off without changing saved preferences. |
| `playSoundscape(track, { scene?, fadeMs?, trimStartMs? })` | Crossfade the score to `track` (default `SCENE_FADE_MS`, 2 s). The same track in the same scene does nothing, including while resting. |
| `stopSoundscape({ fadeMs? })` | Fade the score out. |
| `setAtmosphere(option \| id \| track \| null, { fadeMs? })` | Choose and play the reader's atmosphere and save it in the preferences. `null` saves Off and fades it out. |
| `startAtmosphere()` / `stopAtmosphere()` | Start the saved atmosphere (entering the reader) or fade it out without changing the choice (leaving). |
| `setAtmosphereOptions(options)` | Replace the catalog. A pending saved choice starts when it arrives; a removed choice fades out, and changed sources crossfade even under the same id. The saved choice is retained. |
| `playCue(url, { loudness?, volume?, startTime? })` | Play a one-shot over the loops. Returns `false` when skipped: cues or master off, zero per-cue volume, a hidden page, sleep stopped, the concurrency cap (`maxConcurrentCues`, default 6), or no audio. |
| `preloadCues(urls)` | Warm up to `maxCachedCueUrls` unique chapter cue URLs (default 8). No playback, active slot, gain sink or audio-session demand. Later triggers reuse loaded elements and keep their original 1.5 s start deadline. |
| `stopAll({ fadeMs? })` | Required on leaving the reader: fade both loops out, pause connected Voice, and cancel sleep, idle and rest state. Preferences are untouched; existing cues finish on their own. |
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

## Availability and atmosphere auditions

The host declares use, for example
`setLayerAvailability({ soundscapes: !!chapter.score, cues: chapter.cues.length > 0, atmosphere: true })`.
Undeclared soundtrack layers default to true; undeclared Voice follows its output
connection. Explicit values remain until changed. A disabled layer is still in
use and keeps its row. Availability affects presentation; it does not stop audio
or overwrite preferences. Presets apply to hidden layers too.

The panel retains an unavailable row while a control in it has focus or while
its pointer interaction is in progress. Once the interaction ends the row can
disappear. If every layer is unused, `labels.noAudio` supplies the short empty
line under the master. The note also disappears.

Only Atmosphere has an audition path. `startAtmosphere()` marks the reading
lifetime, including when Off is selected. Within that lifetime a choice loops
immediately. Before it starts or after `stopAtmosphere()`/`stopAll()`, selecting a
choice saves it and plays a **10 second** preview with **1 second** fades at both
ends, then returns to silence. Changing choice replaces the preview; Off,
page hiding and disposal cancel it. `atmospherePreviewMs` and
`atmospherePreviewFadeMs` override those durations. Preview does not open a
chapter. The collapsed choice button expands the native grouped radio picker.
Reader-facing UI contains no score/cue/voice preview or catalog.

## Sleep, music rests and activity

`READER_MIXER_SLEEP_TIMERS` contains Off, 15/30/45/60 minutes and End of chapter.
Supply `sleepTimerChoices` with `{ id, label, kind, durationMs? }` to replace it
or translate labels. Kinds are `off`, `duration` and `chapter-end`; a duration
must be positive and finite. Timers are never persisted. `state.sleepTimer`
reports `status`, `choiceId`, `endsAt` and `remainingMs`; the panel rounds the
remaining wall-clock time up to minutes and provides Cancel.

When sleep fires, both beds fade for **20 seconds** (`sleepFadeMs`) and stop,
connected Voice pauses, and new cues are skipped. Preferences remain intact.
The event tells the host to stop its own Listen. Input, chapter changes and
visibility return cannot restart the audio. The note, the panel's master or a
new timer choice resumes it deliberately. Voice resumes only if sleep paused
an active/pending output; a previously paused voice stays paused. Timer expiry is
checked against `Date.now()` before visibility resume even if timers were
throttled while hidden. Cancel removes a running timer without stopping audio.

Scores rest after **2 plays** (`soundscapeMaxPlays`, or `null` for never rest),
with an **8 second** fade in the final play's tail (`soundscapeRestFadeMs`,
bounded by the playable duration). Overlapped loop boundaries count as plays;
the final tail fades without adding an extra repeat. Rest leaves Atmosphere
playing. `state.soundscapePlays` records the completed count and Soundscapes
reports `resting`. Same track/sources and same `scene` remains resting; a new
scene or another track starts a fresh count. Use a stable chapter/scene id;
omitting it retains the same-track no-op behavior.

Idle stops after **10 minutes** without input (`idleTimeoutMs: 600000`, or
`null` to disable). Both beds fade for **8 seconds** (`idleFadeMs`), then pause
in place; Voice pauses. Passive document capture listeners observe scroll,
wheel, touch, pointer and key input, including nested scroll containers. Input
resumes idle-paused beds at their positions, unless hidden or sleep-stopped.
A refused resume reports `blocked` and retries on the next activation. Playing
Voice holds activity; `retainActivity()` holds it for external Listen. Releasing
the last hold starts a fresh idle timeout. `state.idle` is separate from sleep.

The host **must call `stopAll()` when leaving the reader**. It cancels sleep,
idle scheduling and rest counts as well as stopping the beds and pausing Voice.
Release host activity/duck leases when Listen stops or unmounts.

```tsx
useEffect(() => {
    if (!listenSpeaking) return
    const releaseActivity = mixer.retainActivity()
    const duck = mixer.retainDuck()
    duck.setDuck(0.6)
    return () => { releaseActivity(); duck.release() }
}, [mixer, listenSpeaking])
useEffect(() => mixer.subscribeSleep(stopListen), [mixer, stopListen])
// Actual chapter-end signal: mixer.notifyChapterEnd()
// Reader cleanup: mixer.stopAll()
```

The checked `ReaderChapterAudioExample` in [USAGE_EXAMPLE.tsx](../USAGE_EXAMPLE.tsx)
combines chapter availability, scene ids, atmosphere, cue warm-up, Listen holds,
sleep events, chapter end, the note and required reader cleanup.

## Automatic loudness leveling

`Track.loudness`, `ReaderAtmosphereOption.loudness` and
`playCue(url, { loudness })` accept `LoudnessMeasurement`:
`{ lufs, peakDb, kind }`. Use `integrated` for loops and `momentary-max` for cues.
Values belong to the exact decoded source; remeasure after replacing a file.
Missing, invalid or mismatched measurements play at unity. Digital silence uses
JSON-safe nulls and is never boosted. Voice stays on its host-owned output and
is outside this soundtrack leveling/limiter graph.

`leveling` defaults to on. Reference levels are **−20 LUFS integrated** for beds
and **−14 LUFS momentary maximum** for cues, with **+12 dB** maximum boost and
**−1 dBFS** sample-peak headroom. Supply a `LoudnessLevelingOptions` object to
override them. The requested gain in dB is reference minus measurement; applied
gain is capped by boost and sample-peak headroom, then converted with
`10 ** (dB / 20)`. Source gain is before fades, cue volume and reader sliders.
`computeLoudnessGain(measurement, kind, options?, route?)` exports the same math
and reports requested/applied gain, `shortfallLu` and the binding `limitedBy`
limits (`boost-cap`, `peak-ceiling`, or `element-volume`). `tooQuietToLevel`
flags every measured source left **more than 1 LU** below its reference. These
reporting fields do not change the applied playback gain.

Web Audio supports attenuation and boost. The three layer buses sum into one
`DynamicsCompressorNode` safety limiter (threshold −1 dB, knee 0, ratio 20:1,
attack 1 ms, release 100 ms). This is a compressor limiter, not an oversampled
true-peak brick wall; the measured peak is a sample peak. Keep adequate headroom
when listening to stacked layers. Element routing can only attenuate because
`volume` cannot exceed 1. On volume-locked iPhone element fallback it cannot
apply leveling at all; the UI reports on/off output. Preset numbers are unchanged
so the owner can retune them by ear with leveling on.

### Measuring browser buffers and pack files

`measureLoudness(bytesOrAudioBuffer, { kind?, channelWeights? })` decodes encoded
bytes through `OfflineAudioContext` and renders two K-weighting Biquads: high-pass
38.13 Hz, linear Q 0.5003, then high-shelf 1681.97 Hz, +4 dB. Web Audio expresses
high-pass Q in dB, so the implementation converts the linear Q. It uses 400 ms
blocks, a 100 ms hop, the −70 LUFS absolute gate and −10 LU relative gate for
integrated measurement. Cues take the loudest block; a cue under 400 ms is padded
with silence. Surround-channel weights follow BS.1770 (LFE zero); unusual layouts
require explicit `channelWeights`.

The requested generic Biquads approximate the ITU reference IIR coefficients.
Their response is calibrated at 997 Hz to **−3.01 LUFS** for a full-scale
single-channel sine, per sample rate. Measurements are identified as
`calibrated-w3c-k-biquads/bs1770-gates/v1`; they are not claimed bit-identical to
a laboratory meter using the exact ITU coefficient tables. See the
[Web Audio Biquad definitions](https://www.w3.org/TR/webaudio-1.0/#BiquadFilterNode)
and [BS.1770-4](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-4-201510-S!!PDF-E.pdf).

`measureLoudnessPcm(channels, sampleRate, options?)` provides the equivalent
dependency-free filter and gated integration for already decoded PCM. The Node
CLI uses the dev-only `@audio/decode` decoder; it adds no package runtime import.

```sh
npm run measure-loudness -- score.wav https://example.com/rain.mp3
npm run measure-loudness -- --kind=momentary-max cue.mp3
npm run measure-loudness -- --manifest=measurements-input.json
```

A manifest is an array of `{ id?, source, kind? }`. JSON output records source,
SHA-256, decoder, sample rate, channels, duration, measurement and leveling gain.
HTTP URL credentials, queries and fragments are redacted in progress and JSON
reports; fetching still uses the original URL. Files and downloads share a
256 MiB limit, and invalid entries produce errors without stopping later files.
Decode differences between Node and a browser can affect sample peaks; remeasure
with the browser function when exact browser-decoder output matters. The
Workshop calibration control compares browser and PCM filters directly.

The demo catalog stores measured values for all **43 SEN Volume 1 scores**, ten
atmosphere beds and five Workshop cues, with provenance in
[readerLoudness.json](../src/demo/readerLoudness.json). This is not a measurement
of all 147 cues in the external SEN library. The complete owner re-export list
below includes both boost-cap and peak-ceiling shortfalls at the default
−20 LUFS loop reference, +12 dB cap and −1 dBFS sample-peak ceiling:

| Atmosphere file | Shortfall below reference | Limiting reason |
| --- | --- | --- |
| `Noise/Forest_1.mp3` | 14.89 LU | +12 dB boost cap |
| `Wind/Gentle_Wind_1.mp3` | 9.92 LU | +12 dB boost cap |
| `Noise/Village_1.mp3` | 6.99 LU | +12 dB boost cap |
| `Wind/Strong_Wind_2.mp3` | 5.94 LU | −1 dBFS peak ceiling |
| `Rain/Gentle_Rain_1.mp3` (default) | 3.63 LU | −1 dBFS peak ceiling |
| `Waves/Gentle_Waves_1.mp3` | 1.77 LU | −1 dBFS peak ceiling |
| `Noise/Cave_1.mp3` | 1.03 LU | −1 dBFS peak ceiling |

All paths are under `https://celestialaudio.seihouse.org/DEFAULT/atmosphere/`.
These remain playable with exactly the previous gain. The Cave value rounds
to 1.0 LU at one decimal but is above the strict 1 LU threshold. No measured
score or Workshop cue exceeds this threshold. Measurements are metadata;
the script does not modify or re-export the owner's files.

## Ghost audio note

Place `ReaderMixerNote` in normal chapter flow and keep `ReaderMixerPanel` in
Settings. They share `preferences.masterEnabled`, the **soundtrack** switch.
Tapping never mutes narration. A needed-tap state unlocks without muting; a
sleep-stopped state explicitly resumes. The note is hidden when no layer is in
use, shows a clock indicator while a timer runs, and uses different glyphs and
labels for on, muted, blocked and sleep-stopped states.

```tsx
<ReaderMixerNote onOpenSettings={openAudioSettings} />
// In the host's Audio settings:
<ReaderMixerPanel labels={{ master: "Story audio", noAudio: "This chapter has no audio" }} />
```

The native button has a 44 px target, a 24 px glyph, overridable action labels
and a polite state announcement. Its label describes mute, unmute, start or
resume; it does not also expose `aria-pressed`. Enter/Space activate
it. Long-press (600 ms, `longPressMs` override) and desktop context menu call
`onOpenSettings`. Settings remain accessible through the host menu. Captured
scroll lowers opacity, restoring it after 2 seconds or pointer/focus approach;
layout never moves. Reduced motion removes the opacity transition.

Theme with `--sap-reader-mixer-*` and the note's matching
`--sap-reader-mixer-note-glyph-size`, `--sap-reader-mixer-note-ghost-opacity` and
`--sap-reader-mixer-note-bg`. Class names and `data-state`, `data-scrolling` and
`data-reduced-motion` expose the visual hooks; there is no fixed positioning.

### Level math

A soundtrack layer plays at `master on/off × layer on/off × layer level`;
Voice plays at `voice on/off × voice level`. A cue also
multiplies its per-call `volume`. `computeReaderMixerGain(preferences, layer,
volume?)` is the same formula as a pure function. Turning the master off and on
again restores the soundtrack exactly, because the layers' own switches and levels
are never changed by the master.

### Layer status

Each layer reports `idle`, `loading`, `playing`, `blocked` (the browser wants a
tap; the next one retries), `failed` (with a `failure` message) or `paused`
(the page is hidden or the system paused its media element). A score can also be
`resting` after its play limit; activity alone does not restart a resting score. A loop that is silent only because its switch, level or
the master is off still reports `playing`.

## NarrativeFace as a companion

`NarrativeFace` (narration on the shared `AudioSessionProvider` session) pairs
with the mixer. Render it inside the same `ReaderMixerProvider`, or pass
`mixer={...}`, and:

- **One Voice control.** With `ReaderMixerVoice` connected, the face's voice
  slider and mute button share the saved Voice level and switch with the mixer.
  The soundtrack master leaves narration audible. Voice's own switch gates
  narration without changing the session's user mute,
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
    "version": 3,
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

Version 1 and 2 saves normalize to version 3. The three soundtrack switches,
levels, master and atmosphere choice are retained. Old saves with master off
also migrate Voice to off, preserving the previously silent output; the reader
can enable Voice independently afterwards. Otherwise Voice keeps its setting
(or defaults to 100% for version 1). Always normalize saved JSON rather than
casting old records. Package **3.0.0** changes the master's meaning and defaults
Auto to Web Audio when leveling is enabled. Update exhaustive status maps for
`resting` as well as the fourth `voice` layer.

## Loop boundaries and cue resources

ReaderMixer overlaps two media decks for the last 250 ms of a finite looping bed.
It preloads the silent standby, starts it at the selected `trimStartMs` on every
repeat, and fades before the outgoing asset ends to cover encoder padding and
restart gaps. The two unlocked elements are reused on successive repeats. Scene
switches stay transactional: an old bed can keep repeating while its requested
replacement loads, within its own rest limit. Reaching that limit never cancels
the pending replacement. Pause, stop and dispose cancel boundary work. A failed standby
uses bounded retries; if it still misses the boundary, the current element
restarts at its trim rather than ending the bed. That recovery can have a gap.

`loopCrossfadeMs` defaults to 250 in the mixer, is capped to half the playable bed
length, and can be set to 0 to remove boundary overlap. Unlimited loops then use native
looping; a finite score still counts ended events to enforce its rest limit. Standalone SceneMixEngine
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
Selecting an atmosphere outside that lifetime starts a bounded audition instead.

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
| `"auto"` (default) | Web Audio with leveling on, or where element volume is ignored; plain elements elsewhere when leveling is off | Real loudness; on/off for a layer that falls back | Yes, by default |
| `"element"` | Plain media elements everywhere | On/off: above 0 plays at the device volume, 0 silences | Yes by default; opt out with `crossOrigin: null` |
| `"web-audio"` | Web Audio everywhere | Real loudness | Yes, everywhere |

The Web Audio route sends each element through `MediaElementAudioSourceNode →
element gain → layer GainNode → summed safety limiter → destination`. Crossfades and per-cue volume use
the element gain, including source loudness leveling; the layer GainNode carries the reader's layer level.
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
volume, and falls back to on/off on iPhone. Voice zero and its own switch off
silence HTML5 output through its mute gate. The soundtrack master leaves Voice alone. `state.layers.voice.routing`
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

`ReaderMixerPanel` renders a soundtrack master switch, then one row per layer in use
(Soundscapes, Atmosphere, Sound Cues, connected Voice), each with an on/off switch, a 0–100
slider and its percentage. An atmosphere picker sits under the Atmosphere row,
collapsed by default to a current-choice button. Expanding it reveals native
radios with Off first and the host's options grouped by `group`.

- **Inline only.** Normal document flow, no fixed positioning, so it fits in
  the Audio section of a settings menu.
- **Host-owned catalog.** `atmospheres` (or the mixer's catalog) supplies the options; the view only displays them.
- **Labels.** `labels` overrides every string, including `volume(layerLabel)`,
  `formatPercent(percent)`, row status messages and the device-volume hint.
  `DEFAULT_READER_MIXER_LABELS` lists them all.
- **Theme.** Set these custom properties on the panel (via `style` or CSS):

    | Property | Default |
    | --- | --- |
    | `--sap-reader-mixer-fg` / `--sap-reader-mixer-muted` | `--sh-text-primary` / `--sh-text-subtle` |
    | `--sap-reader-mixer-bg` | `--sh-surface-elevated` |
    | `--sap-reader-mixer-border` | `--sh-border` |
    | `--sap-reader-mixer-focus` | `--sh-focus-ring` |
    | `--sap-reader-mixer-radius` / `--sap-reader-mixer-gap` / `--sap-reader-mixer-padding` | `--sh-radius-panel` / `--sh-space-4` / `--sh-space-4` |
    | `--sap-reader-mixer-target-size` | `44px`, with a 44px minimum |
    | `--sap-reader-mixer-font` | inherited |

- **Mobile first.** Designed for 390px, with every switch, slider and chip at least 44px tall.
- **Accessible.** Switches are native inputs with `role="switch"` named by their row;
  sliders are native range inputs named "Soundscapes volume" and so on, with the
  percentage as their value text; the picker is a native radio group in a
  `fieldset`; row status messages are polite live regions. Transitions are
  removed under `prefers-reduced-motion: reduce`.
- **Tokens.** Style switch, slider, select and radio colors through universal
  `--sh-*` tokens such as `--sh-interactive-primary`, `--sh-progress-track`,
  `--sh-field-surface` and `--sh-field-border`. The previous custom accent,
  track and chip color variables no longer style the approved controls.
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
    both actual loudness and unchanged playback position/queue/rate. The soundtrack
    master must leave narration audible; use Voice off to silence narration. Repeat
    with the ring switch on and silent, after backgrounding, and after a phone
    call. Test HTML5 separately: its zero/off gates must silence narration even
    when intermediate levels are controlled by the device. A slider test double
    or desktop screenshot is not physical listening evidence.
11. Desktop: compare the face's voice volume/mute with the fourth mixer row,
    try Off → Default for Atmosphere, and reset settings during a slider drag.
    Reload and confirm the saved defaults, including Voice, are restored.

12. Enable **Short policy tests**. Verify the note's mute/unmute, unlock and sleep
    resume states, timer indicator, keyboard activation, right-click and long-press
    Settings callback, scroll fade and reduced motion. Hide every availability row;
    the note disappears, the empty label appears and preferences remain intact.
13. Select each short timer and End of chapter. Observe fades, silence and skipped
    cues; scroll and background/return must not restart sleep-stopped audio. Resume
    explicitly with the note, master or a new timer choice. Cancel a running timer.
14. Let the 6 s score tail play twice and rest, with Atmosphere continuing. Repeat
    the same scene, then mark Next scene: only the new scene restarts the score.
    Leave inputs alone for the 15 s idle timeout and observe a fade and pause;
    scroll inside the chapter to resume in place. Simulated Listen and playing
    Voice must hold activity. Repeat after backgrounding.
15. Compare leveling on/off for score, heavy rain, gentle rain and a cue. Check
    **Check loudness calibration** for −3.01 LUFS in both browser and PCM paths.
    On iPhone Element fallback, confirm the documented lack of leveling and the
    on/off volume hint rather than claiming audible normalization.

Record browser and OS versions and listening results in the PR. Desktop Chrome
and physical iPhone Safari (ring on and silent) are separate evidence. A responsive
Chrome viewport does not satisfy the physical-device gate.
