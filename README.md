# SEIHouse Audio Player

A custom audio playback foundation for expanded music experiences.

**SEIHouse Audio Player** is a portable React + TypeScript audio player created by **SEIHouse Productions LLC** for the **SEA expanded music ecosystem**. It is being built as the shared playback layer for SEIHouse album worlds, SEA cards, artist portals, Arc Notes, Vault experiences, and future expanded music formats.

This is not just a demo player. It is the beginning of a reusable audio system designed to support music with context: lyrics, credits, references, archives, alternate versions, hosted listening modes, visual album environments, and artist-approved expanded experiences beyond traditional streaming.

---

## Ecosystem role

The goal of this repository is to give SEIHouse one consistent, custom-controlled audio foundation across its apps instead of relying on scattered native players or one-off embedded widgets.

| SEIHouse surface | Role of the player |
| --- | --- |
| **SEA Portal** | Listener-facing playback for tap-card and album-world entry points. |
| **SEA Cards** | Portable playback access for physical/digital expanded album experiences. |
| **SEIHouse Vault** | Large-catalog playback for demos, masters, alternates, archives, and recovered songs. |
| **Vault Radio** | Hosted contextual listening sessions using approved tracks, transitions, and commentary. |
| **Arc Notes** | Song-linked playback alongside lyrics, credits, references, outcomes, and creation context. |
| **Artist pages** | Embeddable playback for release pages, artist sites, and future SEIHouse-powered portals. |
| **Future SEA apps** | Shared playback engine for new expanded music tools, skins, and interfaces. |

The long-term purpose is simple: **one source of truth for audio playback across the SEIHouse ecosystem, with many possible skins and experiences on top.**

---

## Current capabilities

The player currently supports:

- Portable **React + TypeScript** component architecture.
- Custom, headless audio playback logic instead of relying on native browser controls.
- Vite-powered demo harness for development, production builds, and preview smoke tests.
- Play / pause, previous / next, seeking, and playlist progression.
- Sequential playback by default.
- Shuffle support.
- Repeat modes: off, all, and one.
- Legacy `loop` compatibility.
- Loading, buffering, and playback-state handling.
- Browser and mobile quality checks documented in the repo.
- Opt-in **Automix Lite** transitions with conservative silence trimming.
- Multiple player surfaces, including standalone/full-card and sticky bottom player contexts.

---

## Install in another app

**Public npm package:** [@seihouse/audio-player](https://www.npmjs.com/package/@seihouse/audio-player)

Use the published npm release in every app. It gives each integration a
versioned dependency and a lockfile-backed upgrade path; do not point a
production app at the moving `main` branch.

### Install or update

```bash
npm install @seihouse/audio-player
```

For an existing app, move to the newest published release:

```bash
npm install @seihouse/audio-player@latest
```

Commit the resulting `package.json` and lockfile together. To confirm what an
app resolved:

```bash
npm ls @seihouse/audio-player
```

### Pin a release when needed

Use `@latest` for normal upgrades. When an app needs a deliberately reviewed,
fully reproducible release, pin its published version instead:

```bash
npm install --save-exact @seihouse/audio-player@<version>
```

Git and local-link installs are reserved for testing **unreleased** player
changes. See the
[distribution and publishing guide](https://github.com/SENSEIDUKES/AUDIO-PLAYER/blob/main/PUBLISHING_GUIDE.md)
for those development workflows and the release-owner process.

### Use it in React

Import only from the package root and import the stylesheet once in the host
application:

```tsx
import { AudioPlayer, type Track } from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"

const tracks: Track[] = [
  {
    id: "demo-track",
    title: "Demo Track",
    artist: "SEIHouse",
    audioFile: "https://example.com/audio/demo-track.mp3",
    artwork: "https://example.com/art/demo-cover.jpg",
  },
]

export function PlayerExample() {
  return <AudioPlayer tracks={tracks} />
}
```

A track needs `title`, `artist`, and either `audioFile` or `sources`. Use a
stable `id` whenever possible so the player can reliably distinguish tracks.

### Managed offline or private sources

`AudioPlayer`, `useAudioPlayer`, and `AudioSessionProvider` accept an optional
`sourceResolver`. It runs before the active URL reaches the playback backend and
receives the declared `TrackSource` plus an `AbortSignal`. Return a URL string,
or return `{ url, release }` when the URL owns a resource such as an object URL:

```tsx
<AudioSessionProvider
  initialQueue={tracks}
  sourceResolver={async (source, signal) => {
    const blob = await narrationStore.get(source.url, { signal })
    const url = URL.createObjectURL(blob)
    return { url, release: () => URL.revokeObjectURL(url) }
  }}
>
  {children}
</AudioSessionProvider>
```

Changing sources aborts stale work, and the player releases managed results on
fallback, replacement, unload, and unmount. Preloading intentionally bypasses
the resolver and warms declared URLs only; resolver-owned resources are acquired
only for the active playback source. Automix and waveform pre-analysis keep
their existing declared-URL behavior.

---

## Public API and integration boundaries

The package has a large public surface, so integrations should use the root
entry point (`@seihouse/audio-player`) and the single stylesheet subpath
(`@seihouse/audio-player/styles.css`). Do not deep-import files from `src/` or
`dist/`; those paths are implementation details and are not package exports.

[The public API map](https://github.com/SENSEIDUKES/AUDIO-PLAYER/blob/main/docs/public-api.md)
is the canonical map of playback, sessions, skins, plugins, cues, narrative
engines, diagnostics, workspaces, agents, Automix, and advanced utilities. It
links each family to its focused guide and identifies the appropriate entry
point for a new integration.

---

## Planned direction

This repo is still in active development. Planned and ongoing directions include:

- A compact Vault-ready player for large song libraries.
- A persistent bottom-screen global player for SEIHouse apps.
- More robust shared session state: one audio source, many UI skins.
- Improved waveform/scrubber behavior.
- SEA Portal and tap-card integration.
- Arc Notes-aware playback.
- Vault Radio station mode.
- Automix-lite refinements.
- Animated album/hero support.
- Expanded metadata and lyric display modes.
- Better mobile-first playback recovery and touch behavior.
- Future artist-facing embed options once the project reaches a stable public shape.

---

## Architecture overview

Primary source locations:

- Public package entry point: `src/audio-player/index.ts`
- Standalone component: `src/audio-player/AudioPlayer.tsx`
- Hook / audio engine: `src/audio-player/useAudioPlayer.ts`
- Demo harness: `src/demo/main.tsx`
- Demo styling: `src/demo/audio-player-lab.css`

The intended architecture is:

```text
Audio engine / session state
        ↓
Reusable player logic
        ↓
Multiple UI surfaces / skins
        ↓
SEA Portal, Vault, Arc Notes, Vault Radio, artist pages, and future SEA apps
```

This allows SEIHouse to keep the playback behavior consistent while designing different visual experiences for different contexts.

---

## Playback modes

`AudioPlayer` supports sequential playback by default plus richer playlist controls:

- `shuffle` — starts playlist mode with a shuffled playback order while keeping the active track anchored.
- `repeatMode="off"` — stops advancing at the end of the current playback order.
- `repeatMode="all"` — wraps from the end of the playback order back to the beginning.
- `repeatMode="one"` — loops the active track without advancing.
- `loop` — legacy compatibility prop; when `repeatMode` is omitted, `loop={true}` initializes repeat-one behavior.

---

## Automix

**Automix** is an opt-in transition system for smoother playlist movement. It is
a single plugin (`createAutomixPlugin()`) with automatic fallback: it crossfades
between tracks and, when per-track BPM/beat/energy analysis is confident, steers
fade timing and length from that metadata — otherwise every transition degrades
gracefully to **light mode** (a conservative, silence-trimmed equal-power fade).

The built-in light-mode crossfade is also available without the plugin via the
`automix` prop, and can be toggled from:

- the standalone player's ellipsis menu in playlist mode,
- the `FullCardPlayer` transport row,
- the `StickyBottomPlayer` transport row,
- or programmatically through `SessionEngine.toggleAutomix()` / the `automix` props.

With Automix off, normal playback behavior is unchanged.

See the [Automix guide](https://github.com/SENSEIDUKES/AUDIO-PLAYER/blob/main/docs/automix.md)
for details, fallbacks, and known limits.

---

## Agent Scout audio analysis

Agent Scout analyzes the active audio before it asks the language model for a
review. The browser downloads and decodes the resolved track source, then
extracts sample peak and RMS levels, crest factor, RMS-window range, clipping
and silence ratios, stereo correlation, a compact waveform envelope, duration,
channel/sample-rate data, BPM confidence, and energy. If the audio cannot be
decoded, Scout stops instead of substituting metadata-only sonic feedback.

The audio file and its URL are not sent to the agent endpoint. Only the bounded
measurement report, track metadata, lyrics, and chat messages are posted to the
same-origin `/api/agent-scout` function. That function owns the OpenRouter key,
model presets, prompt, input validation, and upstream call. Its request limit is
enforced by Vercel Firewall rather than process-local function memory.

Copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY` in the server
environment. Never use a `VITE_` prefix for this credential because Vite
variables are browser-visible. The optional preset overrides are also
server-only:

- `OPENROUTER_PRESET_DEMO_SCOUT`
- `OPENROUTER_PRESET_STUDIO_SCOUT`
- `OPENROUTER_PRESET_MEMOIR`

Before enabling Scout on Vercel, publish a WAF rate-limit rule whose
`@vercel/firewall` ID is `agent-scout`: use a fixed 60-second window, allow six
requests per source IP, and return 429 after the limit. The function fails
closed with 503 if that rule is missing or the shared limiter is unavailable.
See [Vercel's Rate Limiting SDK setup](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk).

Use `vercel dev` when exercising the complete local Scout flow; the plain Vite
development server does not execute files in `api/`. Installed-package hosts
must provide the same-origin `/api/agent-scout` server boundary and keep their
provider credentials outside the browser bundle.

---

## Playback resilience & Media Session API

Details on error recovery, retry flow, autoplay-blocked handling, token-based
stale-callback protection, and the Media Session API integration (lock-screen
metadata, hardware media keys) are in the
[playback resilience and Media Session guide](https://github.com/SENSEIDUKES/AUDIO-PLAYER/blob/main/docs/playback-resilience-and-media-session.md).

---

## Browser / mobile quality matrix

The officially supported browser and mobile behavior is documented in the
[browser and mobile quality matrix](https://github.com/SENSEIDUKES/AUDIO-PLAYER/blob/main/docs/browser-mobile-quality-matrix.md).

Use it to verify:

- autoplay-blocked recovery,
- iOS volume limitations,
- pointer/touch scrubbing,
- reduced-motion behavior,
- playlist shuffle/repeat modes,
- and preview smoke coverage before merging player changes.

---

## Local development

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` required by Vite 8.
- npm.
- Use the committed `package-lock.json` for reproducible installs.

### Setup

From the repository root:

```bash
npm ci
npm run build
npm run preview
```

Open the printed Vite preview URL to inspect the production build. The preview script binds to `0.0.0.0` so browser-based preview tools and remote containers can reach it.

### Available scripts

- `npm run dev` — start the Vite dev server on `0.0.0.0`.
- `npm run typecheck` — run TypeScript without emitting files.
- `npm run build` — type-check and build the production demo into `dist/`.
- `npm run build:lib` — build the package version for installing into other apps.
- `npm run test:package` — pack and install the library in a clean consumer, then verify its CommonJS entry and Automix worker asset.
- `npm run preview` — serve the built `dist/` output with Vite preview.
- `npm run preview:smoke` — start Vite preview on `127.0.0.1:4173`, fetch the demo page, and verify referenced built assets return HTTP 200.
- `npm test` — run type-checking, unit and installed-package tests, the production build, and the preview smoke test.

---

## Documentation checks

Run `npm run test:docs` to verify the canonical repository metadata, public API
map, supported consumer imports, local Markdown links, and the type-checked
consumer example.

## Development status and demo

This project is currently in active internal development. The repository does
not designate a hosted demo URL; the canonical demonstration surface is the
local Lab:

```bash
npm run dev
```

The repository should be treated as an evolving SEIHouse infrastructure
component, not a finished public package. APIs, file structure, player
surfaces, and internal playback behavior may change as the player is refined
for SEA Portal, Vault, Arc Notes, Vault Radio, and other SEIHouse use cases.

---

## License / usage restrictions

This repository is **not open source at this time**.

The code, documentation, designs, styles, demos, audio-player logic, and related materials are proprietary to **SEIHouse Productions LLC / SEIHOUSE** unless a separate written agreement says otherwise.

Public visibility, private review access, or repository access does **not** grant permission to copy, reuse, redistribute, modify, publish, sell, host, embed, repackage, or create derivative works from any part of this project.

All rights are reserved. See [`LICENSE`](./LICENSE) for the full proprietary license terms before using any code from this repository.

### Future licensing intent

The current all-rights-reserved status exists because the player is still being shaped as part of the larger SEIHouse ecosystem.

Once the project reaches a stable release stage, SEIHouse may introduce a more open license or source-available model so other artists, builders, or music projects can use the player while preserving proper attribution, authorship, and SEIHouse ecosystem identity.

Until a new license is published, no usage rights are granted.

---

## Attribution

Created by **SEIHouse Productions LLC**.

Built for the **SEA expanded music ecosystem** by **SENSEI / SEIHouse**.
