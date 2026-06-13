# 📦 Publishing Your Audio Player as an npm Package

This guide shows you how to publish your audio player as a package that other repositories can install and use, while keeping the master repo updatable.

## ✅ What's Already Configured

Your repository is now configured with:

1. **Scoped package name**: `@seihouse/audio-player`
2. **Library build script**: `npm run build:lib`
3. **Proper exports**: ESM (`dist/index.js`), CJS (`dist/index.cjs`), and TypeScript types (`dist/index.d.ts`)
4. **CSS export**: Available via `@seihouse/audio-player/styles.css`
5. **Pre-publish hook**: Automatically runs typecheck and build before publishing

---

## 🚀 Option 1: Publish to npm (Recommended for Production)

### Step 1: Update Package Metadata

Edit `package.json` to set your actual repository URL and optionally change the license:

```json
{
  "name": "@seihouse/audio-player",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_ORG/audio-player.git"
  },
  "license": "MIT"
}
```

### Step 2: Login to npm

```bash
npm login
```

If using a scoped package (`@seihouse/`), you may need to create an organization on npmjs.com first, or publish publicly with:

```bash
npm publish --access public
```

### Step 3: Build and Publish

```bash
# Run the library build
npm run build:lib

# Publish to npm
npm publish --access public
```

### Step 4: Install in Other Repos

In any other repository:

```bash
npm install @seihouse/audio-player
```

Or with yarn:
```bash
yarn add @seihouse/audio-player
```

Or with pnpm:
```bash
pnpm add @seihouse/audio-player
```

---

## 🔄 Option 2: Use Git Repository Directly (Great for Development)

This allows other repos to track specific commits/branches/tags directly from GitHub.

### In Your Consumer Repository

Install directly from GitHub:

```bash
# Latest main branch
npm install git+https://github.com/SEIHouse/audio-player.git

# Specific branch
npm install git+https://github.com/SEIHouse/audio-player.git#develop

# Specific tag
npm install git+https://github.com/SEIHouse/audio-player.git#v1.0.0

# Specific commit
npm install git+https://github.com/SEIHouse/audio-player.git#abc123def
```

**Note:** When installing from Git, npm will automatically run `npm run build:lib` (via the `prepublishOnly` script) during installation.

---

## 🔗 Option 3: Local Development with npm link

For testing changes across multiple local repositories without publishing:

### In the Audio Player Repo

```bash
cd /path/to/audio-player
npm run build:lib
npm link
```

### In Each Consumer Repo

```bash
cd /path/to/consumer-repo
npm link @seihouse/audio-player
```

Now changes in the audio player repo are immediately reflected in consumer repos (after running `npm run build:lib`).

---

## 📝 Usage in Consumer Applications

### Basic Import (TypeScript/ESM)

```typescript
import { AudioPlayer, useAudioPlayer } from '@seihouse/audio-player'
import '@seihouse/audio-player/styles.css'

function App() {
  return <AudioPlayer tracks={tracks} />
}
```

### CommonJS Import

```javascript
const { AudioPlayer } = require('@seihouse/audio-player')
require('@seihouse/audio-player/styles.css')
```

### Using Individual Components

```typescript
import { 
  AudioPlayer,
  FullCardPlayer,
  VaultRowPlayer,
  StickyBottomPlayer,
  MiniSidebarPlayer,
  SeaCardPlayer,
  PluginManager,
  useAudioPlayer,
  createAutomixPlugin,
  createWaveformPlugin
} from '@seihouse/audio-player'
```

---

## 🔄 Keeping the Master Repo Updatable

### Best Practices

1. **Use Semantic Versioning**: Tag releases with `v1.0.0`, `v1.1.0`, etc.
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Consumer repos can pin versions**:
   ```json
   {
     "dependencies": {
       "@seihouse/audio-player": "^1.0.0"
     }
   }
   ```

3. **Update workflow**:
   - Make changes in master repo
   - Run tests: `npm test`
   - Bump version: `npm version patch` (or `minor`/`major`)
   - Push tag: `git push && git push --tags`
   - Publish: `npm publish`
   - Consumer repos run: `npm update @seihouse/audio-player`

### For Git-based installs (Option 2)

Consumer repos can update to latest main:
```bash
npm update @seihouse/audio-player
# or reinstall
npm install git+https://github.com/SEIHouse/audio-player.git
```

---

## 🛠️ Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build:lib` | Builds the library for distribution |
| `npm run typecheck` | Runs TypeScript type checking |
| `npm run test` | Runs full test suite |
| `npm run prepublishOnly` | Auto-runs before `npm publish` |

---

## 📦 Published Files

The following files are included in the published package:

```
dist/
├── index.js          # ESM bundle
├── index.cjs         # CommonJS bundle
├── index.d.ts        # TypeScript definitions
├── styles.css        # All player styles
└── assets/           # Worker files and lazy-loaded chunks
```

Files excluded: demo code, tests, docs, scripts, and development configs.

---

## ⚠️ Important Notes

1. **Peer Dependencies**: React and React-DOM are peer dependencies. Consumer apps must have these installed.

2. **Optional Dependencies**: `essentia.js` and `wavesurfer.js` are bundled but loaded lazily only when smart AutoMix analysis or waveform plugins are used.

3. **CSS Import**: Don't forget to import the CSS file in your app's entry point:
   ```typescript
   import '@seihouse/audio-player/styles.css'
   ```

4. **Browser Support**: The package targets modern browsers with ES2020 support.

---

## 🎯 Quick Start Checklist

- [ ] Update `package.json` with correct repository URL
- [ ] Set appropriate license in `package.json`
- [ ] Run `npm run build:lib` to verify build works
- [ ] Test locally with `npm link` if needed
- [ ] Choose publish method (npm vs Git)
- [ ] Publish/tag release
- [ ] Install in consumer repos
- [ ] Document usage in consumer repo READMEs

---

**Need help?** Check the main README.md for player usage examples and API documentation.
