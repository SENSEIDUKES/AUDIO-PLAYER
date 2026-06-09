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

## Audio player source

- Component entry point: `src/audio-player/AudioPlayer.tsx`
- Hook / audio engine: `src/audio-player/useAudioPlayer.ts`
- Demo harness: `src/demo/main.tsx`
- Demo styling: `src/demo/audio-player-lab.css`
