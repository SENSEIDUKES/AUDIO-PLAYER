# Distribution and publishing

This document describes the current distribution contract for
`@seihouse/audio-player`. It supersedes the original package-setup notes.

## Current status

- The package name is `@seihouse/audio-player`.
- The canonical source repository is
  `https://github.com/SENSEIDUKES/AUDIO-PLAYER.git`.
- The package is publicly installable from the npm registry:
  [@seihouse/audio-player](https://www.npmjs.com/package/@seihouse/audio-player).
  A scoped package name does not make a package private.
- The package is proprietary (`UNLICENSED`), so a registry release requires
  explicit release-owner approval. Public registry availability does not change
  the license or grant rights beyond the included `LICENSE`.
- `publishConfig.access` is set to `public` in `package.json`, keeping future
  releases aligned with the public package.
- Consumers may import the package root and
  `@seihouse/audio-player/styles.css`. No source-directory deep import is a
  supported package contract.

## Install from npm

The public package needs no npm login, access token, or special `.npmrc`
configuration in a consuming app:

```bash
npm install @seihouse/audio-player
```

## Update an npm consumer

Install the newest published release:

```bash
npm install @seihouse/audio-player@latest
```

Review the public API and release changes, then commit the resulting
`package.json` and lockfile update together. For a deliberately pinned
release, set an exact published version:

```bash
npm install --save-exact @seihouse/audio-player@<version>
```

## Install unreleased code from Git

Use a Git dependency only when testing player work that has not been published
to npm. Normal app integrations should use the npm release above.

```bash
npm install github:SENSEIDUKES/AUDIO-PLAYER#main
```

For an unreleased test that must be reproducible, pin a reviewed commit SHA
instead of a moving branch:

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
5. Publish only after the preceding checks and authorization are complete,
   using the GitHub Actions release below.

Publishing changes external package state, so it stays an explicit release-owner
action: the release workflow is `workflow_dispatch`-only and never runs on a
push, a tag, or a merge.

## Releasing from GitHub Actions (trusted publishing)

`.github/workflows/publish.yml` publishes the package through npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers). GitHub Actions
acts as an OIDC identity provider, so the job exchanges a short-lived identity
token for publish rights. **No npm token or repository secret is involved**, and
nothing long-lived has to be stored or rotated.

To release: open the repository's **Actions** tab, select **Publish**, and run
the workflow on the reviewed commit. It installs dependencies with `npm ci`,
runs the full `npm test` suite, and then publishes.

### One-time npmjs.com setup

Trusted publishing does not work until the package trusts this repository. A
package owner configures that once, on npmjs.com:

1. Open the package page → **Settings** → **Trusted Publishing**.
2. Add a publisher with provider **GitHub Actions**, organization
   `SENSEIDUKES`, repository `AUDIO-PLAYER`, and workflow filename
   `publish.yml`.

Until that entry exists, the workflow's publish step fails authentication. This
is configured on an already-published package, which is why the first release
was made from the CLI.

### Requirements the workflow already encodes

- `id-token: write` permission on the publishing job, so the runner can mint the
  OIDC token. Without it npm falls back to looking for a token and fails.
- npm **11.5.1 or later**. Node 22 ships npm 10.x, which predates OIDC support,
  so the workflow upgrades npm before touching the registry.
- No `--provenance` flag: trusted publishing attests provenance automatically.
- No `--access` flag: `publishConfig.access` keeps the release public.

### Manual fallback

If trusted publishing is unavailable, a release owner can still publish from the
CLI on a clean, reviewed commit:

```bash
npm publish
```

`publishConfig.access` is `public`, so no `--access` flag is needed. Do not
override it with `--access restricted`; releases should remain aligned with the
public npm package.

Note that npm stopped issuing TOTP (authenticator app) enrollments for accounts
created after September 2025, and the npm CLI cannot complete a passkey or
security-key challenge during `npm publish`. On such an account the CLI publish
fails with `EOTP` unless an account recovery code is supplied via `--otp`.
Trusted publishing avoids this problem entirely.

## What ships

The `files` field declares the intended project files in the package payload:

- `dist/` — ESM, CommonJS, declarations, CSS, and code-split assets
- `README.md`
- `LICENSE`

npm also always includes `package.json` and standard metadata files such as the
README and license. Run `npm pack --dry-run` to inspect the exact artifact for
the current build. Do not assume a fixed asset list or bundle size; code-split
worker names and their hashes are build outputs.

## Refreshing an unreleased Git consumer

Only a consumer testing unpublished work should track a Git ref. Refresh the
moving reference explicitly after the upstream ref changes; this updates the
resolved commit in `package-lock.json` when the consumer uses one:

```bash
npm install github:SENSEIDUKES/AUDIO-PLAYER#main
```

Review and commit the resulting lockfile change. For a pinned consumer, update
the commit SHA in `package.json`, review the public API and release changes,
then run `npm install`. `npm update @seihouse/audio-player` is not the source
of truth for Git-pinned dependencies.
