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
- Opt-in **AutoMix** plugin transitions with smart automatic fallback behavior.
- Optional waveform scrubber via `createWaveformPlugin()`.
- Multiple player surfaces, including standalone/full-card and sticky bottom player contexts.

---

## Planned direction

This repo is still in active development. Planned and ongoing directions include:

- A compact Vault-ready player for large song libraries.
- A persistent bottom-screen global player for SEIHouse apps.
- More robust shared session state: one audio source, many UI skins.
- Expanded plugin render slots for player UI extensions.
- SEA Portal and tap-card integration.
- Arc Notes-aware playback.
- Vault Radio station mode.
- AutoMix refinements.
- Animated album/hero support.
- Expanded metadata and lyric display modes.
- Better mobile-first playback recovery and touch behavior.
- Future artist-facing embed options once the project reaches a stable public shape.

---

## Architecture overview

Primary source locations:

- Component entry point: `src/audio-player/AudioPlayer.tsx`
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

## AutoMix and Waveform Plugins

**AutoMix** is an opt-in smart transition system for smoother playlist movement.
Use one plugin:

```tsx
import { createAutomixPlugin, createWaveformPlugin } from "@seihouse/audio-player"

const plugins = [
  createAutomixPlugin(),
  createWaveformPlugin(),
]
```

AutoMix uses BPM, beat, energy, and transition-point analysis when it is available and confident. It falls back automatically to silence-trimmed crossfade, then basic crossfade, then normal track advance when browser or media limits prevent a transition.

Legacy AutoMix wrappers still work:

- the standalone player's ellipsis menu in playlist mode,
- the `FullCardPlayer` transport row,
- the `StickyBottomPlayer` transport row,
- or programmatically through `SessionEngine.toggleAutomix()` / the `automix` props.

The existing `automix` props and session toggle still enable the legacy basic crossfade bridge for backward compatibility. New integrations should use `createAutomixPlugin()` for smart AutoMix. With AutoMix off, normal playback behavior is unchanged.

Waveforms are now available as a progress render-slot plugin through `createWaveformPlugin()`. The old `showWaveform` prop remains as a compatibility wrapper for standalone `AudioPlayer`.

See [`docs/automix.md`](./docs/automix.md) for details, fallbacks, and known limits.

---

## Playback resilience & Media Session API

Details on error recovery, retry flow, autoplay-blocked handling, token-based stale-callback protection, and the Media Session API integration (lock-screen metadata, hardware media keys) are documented in [`docs/playback-resilience-and-media-session.md`](./docs/playback-resilience-and-media-session.md).

---

## Browser / mobile quality matrix

The officially supported browser and mobile behavior is documented in [`docs/browser-mobile-quality-matrix.md`](./docs/browser-mobile-quality-matrix.md).

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
- `npm run preview` — serve the built `dist/` output with Vite preview.
- `npm run preview:smoke` — start Vite preview on `127.0.0.1:4173`, fetch the demo page, and verify referenced built assets return HTTP 200.
- `npm test` — run type-checking, production build, and the preview smoke test.

---

## Development status

This project is currently in active internal development.

The repository should be treated as an evolving SEIHouse infrastructure component, not a finished public package. APIs, file structure, player surfaces, and internal playback behavior may change as the player is refined for SEA Portal, Vault, Arc Notes, Vault Radio, and other SEIHouse use cases.

Live demo: https://sap.seaportal.world/

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
