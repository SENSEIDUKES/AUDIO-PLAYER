# WAVESURFER INTEGRATION PLAN - COPY-PASTE CHUNKS

---

## PHASE 1: WAVEFORM DATA DECOUPLING

**CONCEPT:**
Add optional canvas-based waveform visualization layer that runs parallel to existing progress bar. Zero impact on current UI/skins. Skins opt-in via config flag `showWaveform: true`. Waveform data fetched separately from audio, cached, and rendered independently.

**IMPLEMENTATION PLAN FOR BUILDERS:**

1. **Create Core Waveform Module** (`src/core/waveform/WaveformRenderer.js`)
   - Class that accepts container element + audio buffer
   - Renders waveform to canvas (peaks calculation)
   - Methods: `load(url)`, `draw()`, `progress(percent)`, `destroy()`
   - No dependency on existing ProgressBar component

2. **Add Data Fetching Utility** (`src/core/waveform/fetchPeaks.js`)
   - Function to fetch pre-computed peaks from backend OR compute client-side
   - Backend endpoint suggestion: `GET /tracks/:id/peaks?width=800&height=60`
   - Fallback: decode audio buffer client-side if no peaks available

3. **Extend Track Model** (`src/models/Track.js`)
   - Add optional property: `waveformUrl` or `peaks` array
   - No breaking changes - purely additive

4. **Create Wrapper Component** (`src/components/WaveformView.jsx`)
   - React wrapper around WaveformRenderer
   - Accepts track, colors, height
   - Only renders if `track.waveformUrl` exists

5. **Skin Integration** (Optional per skin)
   - Update skin configs to include `showWaveform: false` by default
   - Example skin enabling it: add `<WaveformView />` above/below progress bar
   - Respect compact mode: hide waveform when `compactMode === true`

6. **Performance Safeguards**
   - Canvas rendering outside React render cycle (use refs)
   - Debounce progress updates (max 30fps)
   - Lazy load waveform only when track > 30 seconds

**DELIVERABLES CHECKLIST:**
- [ ] `src/core/waveform/WaveformRenderer.js` - core rendering class
- [ ] `src/core/waveform/fetchPeaks.js` - data fetching utility  
- [ ] `src/components/WaveformView.jsx` - React component wrapper
- [ ] Update `src/models/Track.js` with waveform properties
- [ ] Demo: Enable waveform in 1 skin (e.g., "Modern" skin) as proof of concept
- [ ] Verify: All 5 existing skins still work with `showWaveform: false`
- [ ] Verify: Compact mode hides waveform correctly
- [ ] Verify: No performance degradation on low-end devices

**PRESERVATION GUARANTEES:**
✓ Existing ProgressBar unchanged
✓ All 5 skins work without modification
✓ Compact mode respected
✓ SEIHouse player direction maintained
✓ Zero breaking changes to public API

---

## PHASE 2: PLUGIN ARCHITECTURE ✅

**CONCEPT:**
Formalize existing modular patterns into standardized plugin interface. Extract features (automix, analytics, keyboard shortcuts) into swappable plugins. Plugins register hooks into player lifecycle (onTrackLoad, onPlay, onPause, onStop, onSeek, onTimeUpdate, onTrackEnded). Structured error boundary system ensures plugin failures never crash playback.

**IMPLEMENTATION PLAN FOR BUILDERS:**

1. **Define Plugin Interface** (`src/audio-player/core/plugins/PluginInterface.ts`)
   ```typescript
   // Standard methods all plugins must implement:
   init(playerInstance: PluginPlayerContext): void | (() => void)
   destroy(): void
   // Optional hooks:
   onTrackLoad?(track: Track | null): PluginHookResult
   onPlay?(): PluginHookResult
   onPause?(): PluginHookResult
   onStop?(): PluginHookResult
   onSeek?(position: number): PluginHookResult
   onTimeUpdate?(position: number): PluginHookResult
   onTrackEnded?(track: Track | null): PluginHookResult
   ```

2. **Create Plugin Manager** (`src/audio-player/core/plugins/PluginManager.ts`)
   - Methods: `register(plugin)`, `unregister(name)`, `replace(nextPlugins)`, `trigger(hook, ...args)`, `triggerUntilHandled(hook, ...args)`
   - Lifecycle integration: call hooks at appropriate player events
   - Error isolation via `PluginErrorBoundary` per plugin — one plugin failure doesn't crash player
   - Debug status monitoring via `getDebugStatus()`, `isPluginDisabled()`, `enablePlugin()`
   - React bridge via `usePluginManager` hook (`src/audio-player/core/plugins/usePluginManager.ts`)

3. **Plugin Error Boundary System** (`src/audio-player/core/plugins/PluginErrorBoundary.ts`)
   - `PluginError` custom error class with plugin context (pluginName, operation, cause, recoverable)
   - `PluginErrorHandler` interface for host-app error interception
   - `DefaultPluginErrorHandler` with configurable max-failures-before-disable
   - `PluginErrorBoundary` wraps sync/async operations with structured recovery
   - `GracefulDegradation` constants for safe fallback values
   - Recovery actions: disable, skip_hook, fallback, retry, reset

4. **Plugin Config Validation** (`src/audio-player/plugins/configValidators.ts`)
   - Zod schemas for all built-in plugins
   - `validateConfig()` helper: invalid config falls back to safe defaults with console warning

5. **Plugin Debugger** (`src/audio-player/core/plugins/PluginDebugger.ts`)
   - Performance measurement for hook execution times
   - Memory usage tracking
   - Enabled via `window.AUDIO_PLAYER_DEBUG = "1"`

6. **Migrate useAutomix to Plugin** (`src/audio-player/plugins/AutomixPlugin.ts`)
   - Convert existing `useAutomix` logic into AutomixPlugin class
   - Maintain exact same behavior (two-deck crossfade)
   - Returns `true` from `onTrackEnded` during handoff to prevent double-advancing

7. **Build Plugins** (demonstrate extensibility + real features)
   - `KeyboardShortcutPlugin` — space/arrows/JKL play/pause/seek, N/P for next/previous
   - `AnalyticsPlugin` — track play events, send via callback or sendBeacon/fetch endpoint
   - `LyricsPlugin` — sync LRC-style lyrics with playback position
   - `SleepTimerPlugin` — countdown presets + "until end of track" with scoped UI dropdown
   - `AutoThemePlugin` — derive player palette from album artwork via Canvas API
   - `WaveformPlugin` — marker plugin that activates wavesurfer scrubber + peaks pre-warming

8. **Update Player Initialization** (`src/audio-player/AudioPlayer.tsx` / `useAudioPlayer.ts`)
   - `plugins: []` prop on `<AudioPlayer>` and `<AudioSessionProvider>`
   - PluginManager initialized via `usePluginManager` React hook
   - Hooks triggered at existing lifecycle events

9. **Documentation and Examples**
   - `PLUGIN_DEVELOPMENT_GUIDE.md` — interface, hooks, context API, built-in plugin docs, error isolation guide
   - `ErrorBoundaryExample.ts` — comprehensive usage examples for host-app error handling

**DELIVERABLES CHECKLIST:**
- [x] `src/audio-player/core/plugins/PluginInterface.ts` — interface + context definition
- [x] `src/audio-player/core/plugins/PluginManager.ts` — registration + hook dispatch + error boundary integration
- [x] `src/audio-player/core/plugins/PluginErrorBoundary.ts` — structured error handling system
- [x] `src/audio-player/core/plugins/PluginDebugger.ts` — performance monitoring
- [x] `src/audio-player/core/plugins/usePluginManager.ts` — React bridge hook
- [x] `src/audio-player/plugins/configValidators.ts` — Zod schemas for all built-in plugins
- [x] `src/audio-player/plugins/AutomixPlugin.ts` — migrated from useAutomix
- [x] `src/audio-player/plugins/KeyboardShortcutPlugin.ts` — keyboard controls plugin
- [x] `src/audio-player/plugins/AnalyticsPlugin.ts` — event tracking plugin
- [x] `src/audio-player/plugins/LyricsPlugin.ts` — lyric sync plugin
- [x] `src/audio-player/plugins/SleepTimerPlugin.ts` — sleep timer plugin
- [x] `src/audio-player/plugins/AutoThemePlugin.ts` — artwork palette plugin
- [x] `src/audio-player/plugins/WaveformPlugin.ts` — waveform marker plugin
- [x] `src/audio-player/plugins/ErrorBoundaryExample.ts` — usage examples
- [x] Updated `src/audio-player/index.ts` to export plugin system + error boundary API
- [x] Backward compatibility: existing `useAutomix` import still works (deprecated warning)
- [x] Plugin test suites: AnalyticsPlugin, AutoThemePlugin, AutomixPlugin, KeyboardShortcutPlugin, LyricsPlugin, SleepTimerPlugin, PluginErrorBoundary
- [x] Docs: `PLUGIN_DEVELOPMENT_GUIDE.md`

**PRESERVATION GUARANTEES:**
✓ Existing automix behavior identical
✓ No plugins = zero overhead
✓ Current skin system untouched
✓ Compact mode unaffected
✓ All existing code continues working

---

## PHASE 3: WEB AUDIO API FALLBACK

**CONCEPT:**
Abstract audio backend behind interface. Default: HTML5 Audio (current behavior). Optional: Web Audio API for precise timing (DJ apps, gapless critical). Config flag `audioBackend: 'html5' | 'webaudio'`.

**IMPLEMENTATION PLAN FOR BUILDERS:**

1. **Create Backend Interface** (`src/core/audio/AudioBackendInterface.js`)
   ```javascript
   // Required methods:
   load(src)
   play()
   pause()
   seek(seconds)
   getCurrentTime()
   getDuration()
   setVolume(0-1)
   destroy()
   // Events: onTimeUpdate, onEnded, onReady
   ```

2. **Refactor Current Player** (`src/core/audio/HTML5AudioBackend.js`)
   - Extract existing HTML5 Audio logic into class implementing interface
   - No behavioral changes - just reorganization

3. **Build Web Audio Backend** (`src/core/audio/WebAudioBackend.js`)
   - Use AudioContext + AudioBufferSourceNode
   - Implement same interface as HTML5 backend
   - Handle precise scheduling for gapless playback
   - Manage AudioContext lifecycle (resume on user gesture)

4. **Create Backend Factory** (`src/core/audio/AudioBackendFactory.js`)
   - Function: `createBackend(type, config)`
   - Returns appropriate backend instance
   - Validate browser support for Web Audio

5. **Update SEIPlayer** (`src/core/SEIPlayer.js`)
   - Add `audioBackend` config option (default: 'html5')
   - Use factory to instantiate correct backend
   - All player methods delegate to backend

6. **Feature Detection & Fallback**
   - Auto-fallback to HTML5 if Web Audio not supported
   - Warning in console if requested backend unavailable
   - Method to check backend capabilities: `player.getBackendInfo()`

**DELIVERABLES CHECKLIST:**
- [ ] `src/core/audio/AudioBackendInterface.js` - interface spec
- [ ] `src/core/audio/HTML5AudioBackend.js` - extracted current logic
- [ ] `src/core/audio/WebAudioBackend.js` - new precise timing backend
- [ ] `src/core/audio/AudioBackendFactory.js` - factory function
- [ ] Update `src/core/SEIPlayer.js` to use backend abstraction
- [ ] Demo: Toggle between backends in dev tools
- [ ] Test: Gapless playback comparison (HTML5 vs WebAudio)
- [ ] Test: Memory leak check (proper cleanup on destroy)
- [ ] Test: Mobile Safari compatibility (Web Audio limitations)
- [ ] Docs: `AUDIO_BACKEND_GUIDE.md` with use cases

**PRESERVATION GUARANTEES:**
✓ Default behavior unchanged (HTML5 Audio)
✓ No config = zero differences
✓ Existing skins/UI unaffected
✓ Compact mode works identically
✓ Performance same or better

---

## PHASE 4: INTEGRATION & POLISH

**CONCEPT:**
Tie all phases together. Ensure interoperability. Add demos. Write documentation. Performance testing. Production readiness.

**IMPLEMENTATION PLAN FOR BUILDERS:**

1. **Integration Testing Matrix**
   - Test all combinations: 5 skins × compact mode × waveform on/off × 2 backends × plugins
   - Automated tests for critical paths
   - Manual QA checklist

2. **Build Demo Applications**
   - `demo-basic.html` - minimal player, default settings
   - `demo-advanced.html` - all features enabled
   - `demo-dj.html` - Web Audio backend + gapless focus

3. **Documentation Suite**
   - `INTEGRATION_GUIDE.md` - how to enable each feature
   - `MIGRATION_GUIDE.md` - upgrading from current version
   - `API_REFERENCE.md` - updated public API
   - Inline JSDoc comments on all new files

4. **Performance Optimization Pass**
   - Bundle size analysis (webpack bundle analyzer)
   - Lazy loading verification
   - Memory profiling (Chrome DevTools)
   - Frame rate testing during waveform rendering

5. **Error Handling & Edge Cases**
   - Graceful degradation if waveform fetch fails
   - Plugin error isolation testing
   - Backend fallback scenarios
   - Mobile network throttling tests

6. **Version Bump & Changelog**
   - Semantic versioning (likely minor version bump)
   - Detailed CHANGELOG.md
   - Deprecation warnings for old patterns (if any)

**DELIVERABLES CHECKLIST:**
- [ ] Test matrix completed (all combinations verified)
- [ ] 3 demo applications built and working
- [ ] Complete documentation (4 markdown files minimum)
- [ ] Bundle size report (< 5% increase target)
- [ ] Memory leak tests passed
- [ ] Mobile testing completed (iOS Safari, Android Chrome)
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created for release

**PRESERVATION GUARANTEES:**
✓ All existing functionality verified working
✓ Zero regressions in test suite
✓ Backward compatibility maintained
✓ SEIHouse brand/direction preserved

---

## QUICK START FOR BUILDERS

**To start Phase 1 immediately:**
1. Create folder: `mkdir -p src/core/waveform`
2. Create file: `src/core/waveform/WaveformRenderer.js`
3. Implement basic canvas drawing (peaks array → bars)
4. Test with hardcoded peaks data
5. Connect to track loading
6. Add to one skin as optional feature

**Estimated Time per Phase:**
- Phase 1: 4-8 hours
- Phase 2: ✅ Complete  
- Phase 3: 6-10 hours
- Phase 4: 4-6 hours

**Total Project Time:** 20-34 hours (not weeks)

---

## BACKEND RECOMMENDATIONS

**For Waveform Peaks Endpoint:**
```
GET /api/tracks/:id/peaks?width=800&height=60&format=json
Response: { peaks: [0.2, 0.5, 0.8, ...], duration: 245.6 }
```

**Implementation Options:**
1. Pre-compute peaks on upload (recommended)
2. Generate on-demand with caching
3. Client-side only (no backend changes needed)

**Tools for Backend:**
- Node.js: `node-wavesurfer` (extract peaks)
- Python: `librosa` library
- FFmpeg: `astats` filter for amplitude data

---

END OF PLAN
