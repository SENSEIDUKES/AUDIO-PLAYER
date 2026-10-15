# Archived: v4 player faces and Workshop tools

These files were taken out of the package and the Workshop so a single new
player face can be designed from scratch on top of the existing engine. Nothing
here is built, linted, type-checked, tested, or published. It is kept for
reference and so any piece can be brought back.

Every file sits at the same path it had under `src/`, so restoring one is a move
back to that path, for example:

```bash
git mv archive/faces-v4/src/audio-player/skins/FullCardPlayer.tsx src/audio-player/skins/FullCardPlayer.tsx
```

A restored face also needs its export lines back in `src/audio-player/index.ts`
and its styles from `skins.css` (shared by all the faces). The package code
around them (engine, menus, controls, surfaces) stayed in place, so a restored
file may need small updates if that code has changed since.

## What is here

**Package faces** (`src/audio-player/`)

- `AudioPlayer.tsx`: the standalone "portable" player (the old default export)
- `skins/FullCardPlayer.tsx`, `SeaCardPlayer.tsx`, `StickyBottomPlayer.tsx`,
  `MiniSidebarPlayer.tsx`, `VaultRowPlayer.tsx`
- `skins/skins.css`: the shared face stylesheet (the narrator face's part now
  lives in `src/audio-player/skins/narrative-face.css`)
- Their tests, including the menu-composition tests across faces

**Workshop pages and tools** (`src/demo/`)

- Each face's workspace, and the New Face builder (`ComposedFace`, `faceSpec`)
- Customization pages: plugins, themes, face presets, scrubbers, waveforms,
  visuals, artwork, typography, and the property panel they shared
- The Testing Lab (Mix & Match, app shell, mobile/error/stress/playback checks)
  and the original No Luck showcase fixture
- The Menus & Controller and Headless Controls pages
- `workshop/catalog.ts` and `workshop/registry.ts` as they were, with the full
  notes on what each old page did

The narrator face (`NarrativeFace`) was not archived. It stays in the package
and the Workshop.
