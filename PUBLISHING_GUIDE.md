# Distribution and publishing

This document describes the current distribution contract for
`@seihouse/audio-player`. It supersedes the original package-setup notes.

## Current status

- The package name is `@seihouse/audio-player`.
- The canonical source repository is
  `https://github.com/SENSEIDUKES/AUDIO-PLAYER.git`.
- The package is published to the npm registry as a **private** package under
  the `@seihouse` scope. It is not publicly readable. `@seihouse` is a scope, not
  a membership group: install access belongs to the package owner plus any
  explicit collaborators, or — where the scope is backed by an npm organization —
  to the teams granted read access on the package.
- The package is proprietary (`UNLICENSED`), so a registry release requires
  explicit release-owner approval.
- `publishConfig.access` is set to `restricted` in `package.json`, so a publish
  defaults to private. A command-line `--access` flag still takes precedence over
  `publishConfig`, so never pass `--access public` for this package.
- Consumers may import the package root and
  `@seihouse/audio-player/styles.css`. No source-directory deep import is a
  supported package contract.

## Install from the private npm registry

The package is private, so a consumer must authenticate as a member of the
`@seihouse` scope before installing:

```bash
npm install @seihouse/audio-player
```

Authenticate either interactively with `npm login`, or in CI with a granular
access token carrying read-only permissions on this package (or the `@seihouse`
scope), supplied through the environment:

```ini
# .npmrc in the consumer repository — commit this file, it contains no secret
@seihouse:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Set `NPM_TOKEN` as a CI secret. npm removed legacy (classic and automation)
access tokens in November 2025, so a granular access token is the only supported
credential for installing a private package in CI. Never commit a literal token
value, and never write a resolved token into a checked-in `.npmrc`. This repository's own
`.gitignore` excludes `.npmrc` for that reason.

## Install from GitHub

For an internal consumer that should follow the current main branch:

```bash
npm install github:SENSEIDUKES/AUDIO-PLAYER#main
```

For a reproducible consumer, pin a reviewed commit SHA instead of a moving
branch:

```json
{
  "dependencies": {
    "@seihouse/audio-player": "github:SENSEIDUKES/AUDIO-PLAYER#<commit-sha>"
  }
}
```

Then run `npm install`. Do not reference a release tag until the tag has been
created and pushed in this repository.

When npm installs a Git dependency, this package's `prepare` lifecycle runs
`npm run build:lib`. `prepublishOnly` does **not** run for a Git installation;
it runs as part of `npm publish`.

## Local development with `npm link`

Use a link when iterating on a consumer and this repository at the same time:

```bash
# In this repository
npm run build:lib
npm link

# In the consumer repository
npm link @seihouse/audio-player
```

Re-run `npm run build:lib` after changes to refresh the linked distribution.
Use `npm unlink @seihouse/audio-player` in the consumer when the local test is
finished, then reinstall its declared dependency.

## Import contract

```tsx
import { AudioPlayer, type Track } from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"

const tracks: Track[] = [
  {
    id: "intro",
    title: "Intro",
    artist: "Artist",
    audioFile: "/audio/intro.mp3",
  },
]

export function App() {
  return <AudioPlayer tracks={tracks} />
}
```

For the full public surface and the correct entry point for sessions, skins,
plugins, cues, narrative engines, diagnostics, and workspaces, see
[`docs/public-api.md`](./docs/public-api.md).

## Release-owner checklist

Only a release owner should perform a registry release. Before publishing:

1. Confirm the package name, repository metadata, license, and intended npm
   access are approved for the release.
2. Start from a clean, reviewed commit.
3. Install dependencies reproducibly and validate the distributable artifact:

   ```bash
   npm ci
   npm run prepublishOnly
   npm pack --dry-run
   ```

   `prepublishOnly` runs type checking, documentation/example validation, and
   the installed-package smoke test. The smoke test builds the library, creates
   a tarball, installs it into a clean consumer, and checks both CommonJS and
   ESM loading.

4. Set the approved semantic version, commit/tag it according to the release
   process, and push the commit and tag.
5. Publish only after the preceding checks and authorization are complete:

   ```bash
   npm publish
   ```

   `publishConfig.access` is `restricted`, so no `--access` flag is needed and
   the release stays private. Never pass `--access public` — that would make a
   proprietary package world-readable and cannot be undone by republishing.

The final command intentionally has no automation wrapper: publishing changes
external package state and must remain an explicit release-owner action.

## What ships

The `files` field declares the intended project files in the package payload:

- `dist/` — ESM, CommonJS, declarations, CSS, and code-split assets
- `README.md`
- `LICENSE`

npm also always includes `package.json` and standard metadata files such as the
README and license. Run `npm pack --dry-run` to inspect the exact artifact for
the current build. Do not assume a fixed asset list or bundle size; code-split
worker names and their hashes are build outputs.

## Updating a Git consumer

For a branch-tracking consumer, refresh the moving Git reference explicitly
after the upstream ref changes. This updates the resolved commit in
`package-lock.json` when the consumer uses one:

```bash
npm install github:SENSEIDUKES/AUDIO-PLAYER#main
```

Review and commit the resulting lockfile change. For a pinned consumer, update
the commit SHA in `package.json`, review the public API and release changes,
then run `npm install`. `npm update @seihouse/audio-player` is not the source
of truth for Git-pinned dependencies.
