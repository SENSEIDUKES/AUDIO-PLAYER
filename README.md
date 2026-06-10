# SEIHOUSE-AUDIO-LAB

Audio player lab for SEIHOUSE. This repository contains a portable React + TypeScript audio player and a Vite-powered demo harness for local development, production builds, and preview smoke tests.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8)
- npm (use the committed `package-lock.json` for reproducible installs)

## Codex / local workflow

From the repository root:

```bash
npm ci
npm run build
npm run preview
```

Open the printed Vite preview URL to inspect the production build. The preview script binds to `0.0.0.0` so browser-based preview tools and remote containers can reach it.

## Available scripts

- `npm run dev` — start the Vite dev server on `0.0.0.0`.
- `npm run typecheck` — run TypeScript without emitting files.
- `npm run build` — type-check and build the production demo into `dist/`.
- `npm run preview` — serve the built `dist/` output with Vite preview.
- `npm run preview:smoke` — start Vite preview on `127.0.0.1:4173`, fetch the demo page, and verify referenced built assets return HTTP 200.
- `npm test` — run type-checking, production build, and the preview smoke test.

## Browser / mobile quality matrix

The officially supported browser and mobile behavior is documented in [`docs/browser-mobile-quality-matrix.md`](./docs/browser-mobile-quality-matrix.md). Use it to verify autoplay-blocked recovery, iOS volume limitations, pointer/touch scrubbing, reduced-motion behavior, playlist shuffle/repeat modes, and preview smoke coverage before merging player changes.

## Audio player source

- Component entry point: `src/audio-player/AudioPlayer.tsx`
- Hook / audio engine: `src/audio-player/useAudioPlayer.ts`
- Demo harness: `src/demo/main.tsx`
- Demo styling: `src/demo/audio-player-lab.css`

## Playback modes

`AudioPlayer` supports sequential playback by default plus richer playlist controls:

- `shuffle` — starts playlist mode with a shuffled playback order while keeping the active track anchored.
- `repeatMode="off"` — stops advancing at the end of the current playback order.
- `repeatMode="all"` — wraps from the end of the playback order back to the beginning.
- `repeatMode="one"` — loops the active track without advancing.
- `loop` — legacy compatibility prop; when `repeatMode` is omitted, `loop={true}` initializes repeat-one behavior.

## Automix Lite

Opt-in two-deck crossfade transitions (~5.5 s equal-power fade) with conservative RMS-based silence trimming so fades skip dead air. Toggle it from the standalone player's ellipsis menu (playlist mode), the `FullCardPlayer` / `StickyBottomPlayer` transport rows, or programmatically via `SessionEngine.toggleAutomix()` / the `automix` props. With the toggle off, playback is unchanged. Details, fallbacks, and known limits: [`docs/automix-lite.md`](./docs/automix-lite.md).

## License / usage restrictions

This repository is **not open source**. The code is publicly visible for review and evaluation only; public visibility does not grant permission to copy, reuse, redistribute, modify, publish, sell, host, embed, or create derivative works from any part of this project.

All rights are reserved by SEIHOUSE. See [`LICENSE`](./LICENSE) for the full proprietary license terms before using any code from this repository.

