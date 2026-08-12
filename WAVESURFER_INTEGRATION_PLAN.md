# Wavesurfer.js Integration Plan for SEIHouse Audio Player

> **Historical planning record.** This document predates the current public
> plugin, waveform, and backend contracts. Its proposed paths and snippets are
> not supported consumer APIs. Use [`docs/public-api.md`](./docs/public-api.md),
> [`docs/automix.md`](./docs/automix.md), and the current source tree for new
> work.

## Executive Summary

This document outlines a strategic approach to incorporate **three key concepts from wavesurfer.js** into the SEIHouse audio player architecture while **preserving all existing customizations**:
- ✅ Custom UI components (ProgressBar, VolumeControl)
- ✅ Skin system (FullCardPlayer, MiniSidebarPlayer, SeaCardPlayer, StickyBottomPlayer, VaultRowPlayer)
- ✅ Compact mode support
- ✅ SEIHouse player direction and branding
- ✅ Automix Lite functionality
- ✅ Session-based queue management

---

## 1. Wavesurfer.js Concepts to Adopt

### 1.1 Waveform Data Decoupling
**Concept:** Separate waveform visualization data from playback control logic.

**Current State:** 
- Your `ProgressBar` component already decouples visual feedback from the audio engine
- Uses `buffered`, `currentTime`, and `duration` from `AudioPlayerEngine`
- Local drag state (`dragTimeRef`) provides smooth scrubbing without affecting playback

**Enhancement Opportunity:**
- Add an optional waveform layer that renders pre-computed waveform data
- Keep it completely separate from the core playback engine
- Allow skins to opt-in to waveform visualization without affecting other skins

### 1.2 Plugin Architecture
**Concept:** Extract features into optional, composable plugins.

**Current State:**
- You already have a modular structure: `automix/`, `components/`, `skins/`, `utils/`
- `AutomixPlugin` is the current optional transition feature; the older
  standalone hook is retired
- Theme vars and icons are separated

**Enhancement Opportunity:**
- Formalize a plugin interface for future extensibility
- Create plugin hooks for: waveform visualization, analytics, keyboard shortcuts, etc.
- Maintain backward compatibility—plugins are purely additive

### 1.3 Web Audio API Fallback
**Concept:** Use Web Audio API for precise timing in critical scenarios while keeping HTML5 Audio as the default.

**Current State:**
- Your engine uses a single `<audio>` element with rAF-driven time updates
- Already handles autoplay blocking, volume unsupported detection, and mobile quirks
- Conservative, compatible approach

**Enhancement Opportunity:**
- Optional Web Audio backend for advanced use cases (DJ apps, precise beat-sync)
- Feature-detect and gracefully fallback to HTML5 Audio
- Keep the same `AudioPlayerEngine` interface regardless of backend

---

## 2. Implementation Strategy

### Phase 1: Waveform Visualization Layer (Non-Breaking)

#### 2.1 Create Waveform Data Provider

```typescript
// src/audio-player/waveform/types.ts
export interface WaveformData {
  /** Total duration in seconds */
  duration: number
  /** Sample rate used for analysis */
  sampleRate: number
  /** Array of amplitude values (-1 to 1 or 0-255) */
  samples: Float32Array | Uint8Array
  /** Pre-computed peaks for different zoom levels */
  peaks: number[][]
}

export interface WaveformProvider {
  /** Load and analyze waveform data for a track */
  load(track: Track): Promise<WaveformData>
  /** Cache management */
  clear(): void
  /** Get cached data if available */
  getCached(trackId: string): WaveformData | null
}
```

#### 2.2 Optional Waveform Component

```typescript
// src/audio-player/components/Waveform.tsx
interface WaveformProps {
  currentTime: number
  duration: number
  waveformData: WaveformData | null
  progressColor: string
  trackColor: string
  onSeek: (time: number) => void
  disabled?: boolean
  height?: number
  zoom?: number
}

export function Waveform({ 
  currentTime, 
  duration, 
  waveformData, 
  onSeek,
  // ... styling props
}: WaveformProps) {
  // Render canvas-based waveform
  // Independent from ProgressBar
  // Opt-in per skin
}
```

#### 2.3 Skin Integration Example

```typescript
// src/audio-player/skins/FullCardPlayer.tsx
// ADD OPTIONAL WAVEFORM LAYER
const showWaveform = skinConfig?.showWaveform ?? false

{showWaveform && waveformEnabled && (
  <Waveform
    currentTime={currentTime}
    duration={duration}
    waveformData={waveformStore.get(currentTrack)}
    progressColor={progressColor}
    trackColor={trackColor}
    onSeek={seek}
  />
)}

{/* Existing ProgressBar remains unchanged */}
<ProgressBar {...} />
```

**Key Benefits:**
- ✅ No impact on existing skins that don't use waveform
- ✅ Compact mode can hide waveform automatically
- ✅ Backward compatible—existing consumers see no change

---

### Phase 2: Formal Plugin Architecture

#### 2.1 Define Plugin Interface

```typescript
// src/audio-player/plugins/types.ts
import type { AudioPlayerEngine, Track } from '../types'

export interface PluginContext {
  engine: AudioPlayerEngine
  currentTrack: Track | null
  theme: {
    accentColor: string
    progressColor: string
    trackColor: string
    // ...
  }
}

export interface Plugin {
  /** Unique identifier for this plugin */
  id: string
  
  /** Called when plugin is registered */
  onMount?(ctx: PluginContext): void
  
  /** Called when plugin is unmounted */
  onUnmount?(): void
  
  /** Called when track changes */
  onTrackChange?(track: Track): void
  
  /** Called when playback state changes */
  onPlaybackChange?(isPlaying: boolean): void
  
  /** Optional render function for UI injection points */
  render?(ctx: PluginContext): ReactNode
}
```

#### 2.2 Plugin Registry Hook

```typescript
// src/audio-player/plugins/usePluginRegistry.ts
export function usePluginRegistry(
  engine: AudioPlayerEngine,
  plugins: Plugin[]
) {
  const contextRef = useRef<PluginContext>({
    engine,
    currentTrack: null,
    theme: { /* ... */ }
  })
  
  // Lifecycle management
  useEffect(() => {
    plugins.forEach(p => p.onMount?.(contextRef.current))
    return () => {
      plugins.forEach(p => p.onUnmount?.())
    }
  }, [plugins])
  
  // Event broadcasting
  useEffect(() => {
    if (!currentTrack) return
    plugins.forEach(p => p.onTrackChange?.(currentTrack))
  }, [currentTrack])
  
  return {
    register(plugin: Plugin): void { /* ... */ }
    unregister(pluginId: string): void { /* ... */ }
    getPlugin<T extends Plugin>(id: string): T | null { /* ... */ }
  }
}
```

#### 2.3 Example Plugins

```typescript
// src/audio-player/plugins/waveform-plugin.ts
export function createWaveformPlugin(options: WaveformOptions): Plugin {
  return {
    id: 'waveform',
    onMount(ctx) {
      // Initialize waveform analyzer
    },
    onTrackChange(track) {
      // Pre-fetch waveform data
    },
    render(ctx) {
      return <Waveform {...} />
    }
  }
}

// src/audio-player/plugins/analytics-plugin.ts
export function createAnalyticsPlugin(config: AnalyticsConfig): Plugin {
  return {
    id: 'analytics',
    onPlaybackChange(isPlaying) {
      // Track play/pause events
    },
    onTrackChange(track) {
      // Track track changes
    }
  }
}
```

#### 2.4 Usage in AudioPlayer

```typescript
// In AudioPlayer.tsx or skin components
const plugins = useMemo(() => [
  config.showWaveform && createWaveformPlugin({ /* options */ }),
  config.enableAnalytics && createAnalyticsPlugin({ /* options */ }),
].filter(Boolean), [config])

usePluginRegistry(engine, plugins)

// Render plugin UI injection points
{plugins.map(p => p.render?.(pluginContext))}
```

**Key Benefits:**
- ✅ Existing code works without plugins (empty array)
- ✅ Skins choose which plugins to enable
- ✅ Third-party developers can create custom plugins
- ✅ No breaking changes to current API

---

### Phase 3: Web Audio API Backend (Optional Advanced Mode)

#### 3.1 Abstract Audio Backend Interface

```typescript
// src/audio-player/backends/types.ts
export interface AudioBackend {
  /** Current playback time in seconds */
  currentTime: number
  /** Total duration in seconds */
  duration: number
  /** Is currently playing */
  isPlaying: boolean
  /** Is buffering/loading */
  isBuffering: boolean
  
  /** Load audio source */
  load(src: string): Promise<void>
  /** Start/resume playback */
  play(): Promise<void>
  /** Pause playback */
  pause(): void
  /** Seek to time */
  seek(time: number): void
  /** Set volume (0-1) */
  setVolume(value: number): void
  /** Mute/unmute */
  setMuted(muted: boolean): void
  
  /** Subscribe to time updates */
  onTimeUpdate(callback: (time: number) => void): () => void
  /** Subscribe to playback state changes */
  onStateChange(callback: (state: PlaybackState) => void): () => void
  /** Subscribe to errors */
  onError(callback: (error: Error) => void): () => void
  
  /** Cleanup resources */
  destroy(): void
}

export interface PlaybackState {
  isPlaying: boolean
  isBuffering: boolean
  hasError: boolean
  errorMessage?: string
}
```

#### 3.2 HTML5 Audio Backend (Current Behavior)

```typescript
// src/audio-player/backends/Html5AudioBackend.ts
export class Html5AudioBackend implements AudioBackend {
  private audio: HTMLAudioElement
  private timeUpdateListeners = new Set<(time: number) => void>()
  // ... implementation matching current useAudioPlayer behavior
}
```

#### 3.3 Web Audio Backend (Precise Timing)

```typescript
// src/audio-player/backends/WebAudioBackend.ts
export class WebAudioBackend implements AudioBackend {
  private context: AudioContext
  private sourceNode: AudioBufferSourceNode | null
  private gainNode: GainNode
  private startTime: number = 0
  private pauseTime: number = 0
  
  async load(src: string) {
    const response = await fetch(src)
    const arrayBuffer = await response.arrayBuffer()
    this.audioBuffer = await this.context.decodeAudioData(arrayBuffer)
  }
  
  play() {
    this.sourceNode = this.context.createBufferSource()
    this.sourceNode.buffer = this.audioBuffer
    this.sourceNode.connect(this.gainNode)
    this.startTime = this.context.currentTime - this.pauseTime
    this.sourceNode.start(0, this.pauseTime)
  }
  
  get currentTime() {
    if (!this.isPlaying) return this.pauseTime
    return this.context.currentTime - this.startTime
  }
  
  // Precise sample-accurate seeking
  seek(time: number) {
    this.pauseTime = time
    if (this.isPlaying) {
      this.pause()
      this.play()
    }
  }
}
```

#### 3.4 Backend Factory with Feature Detection

```typescript
// src/audio-player/backends/createBackend.ts
export function createBackend(options: BackendOptions): AudioBackend {
  const { preferredBackend, src } = options
  
  // Auto-detect best available backend
  if (preferredBackend === 'auto') {
    // Web Audio for DJ/dance apps needing beat-sync precision
    if (typeof AudioContext !== 'undefined' && options.needsPreciseTiming) {
      return new WebAudioBackend()
    }
    // Default to HTML5 for compatibility
    return new Html5AudioBackend()
  }
  
  if (preferredBackend === 'webaudio') {
    if (typeof AudioContext === 'undefined') {
      console.warn('Web Audio not supported, falling back to HTML5 Audio')
      return new Html5AudioBackend()
    }
    return new WebAudioBackend()
  }
  
  return new Html5AudioBackend()
}
```

#### 3.5 Integrate into useAudioPlayer

```typescript
// Modified useAudioPlayer hook
export function useAudioPlayer(
  options: UseAudioPlayerOptions & {
    backend?: 'auto' | 'html5' | 'webaudio'
    needsPreciseTiming?: boolean
  }
): AudioPlayerEngine {
  const backendRef = useRef<AudioBackend | null>(null)
  
  useEffect(() => {
    backendRef.current = createBackend({
      preferredBackend: options.backend ?? 'auto',
      needsPreciseTiming: options.needsPreciseTiming ?? false,
      src: options.src
    })
    
    return () => {
      backendRef.current?.destroy()
    }
  }, [options.backend, options.needsPreciseTiming])
  
  // Rest of hook remains identical
  // Same AudioPlayerEngine interface returned
}
```

**Key Benefits:**
- ✅ Default behavior unchanged (HTML5 Audio)
- ✅ Opt-in precise timing for critical apps
- ✅ Graceful fallback when Web Audio unavailable
- ✅ Same API surface—no consumer code changes

---

## 3. Preservation Guarantees

### What Stays Exactly the Same

| Feature | Status | Notes |
|---------|--------|-------|
| **Custom UI Components** | ✅ Preserved | `ProgressBar`, `VolumeControl` unchanged |
| **Skin System** | ✅ Preserved | All 5 skins work identically |
| **Compact Mode** | ✅ Preserved | Waveform/plugin opt-in respects compact mode |
| **Automix Lite** | ✅ Preserved | Crossfade logic untouched |
| **Session Context** | ✅ Preserved | Queue management unchanged |
| **Theme System** | ✅ Preserved | CSS vars, color props work as before |
| **Keyboard Navigation** | ✅ Preserved | All accessibility features intact |
| **Mobile Quirks Handling** | ✅ Preserved | iOS volume, autoplay blocking unchanged |
| **TypeScript Types** | ✅ Preserved | Existing interfaces remain valid |
| **Public API** | ✅ Preserved | Consumer props unchanged |

### What Gets Added (Opt-In Only)

| Feature | Default | Activation |
|---------|---------|------------|
| Waveform visualization | Disabled | Per-skin config flag |
| Plugin system | Empty array | Pass plugins to provider |
| Web Audio backend | HTML5 Audio | `backend="webaudio"` prop |
| Waveform data caching | N/A | Internal optimization |

---

## 4. Migration Path

### For Existing Consumers (Zero Changes Required)

```tsx
// Current usage continues to work identically
<AudioPlayer
  tracks={tracks}
  accentColor="#FF6B6B"
  automix
  shuffle
/>
```

### For New Features (Gradual Adoption)

```tsx
// Step 1: Enable waveform in specific skins
<FullCardPlayer
  tracks={tracks}
  skinConfig={{ showWaveform: true }}
/>

// Step 2: Add plugins
const plugins = [
  createWaveformPlugin({ height: 80 }),
  createAnalyticsPlugin({ endpoint: '/api/events' })
]

<AudioSessionProvider plugins={plugins}>
  <App />
</AudioSessionProvider>

// Step 3: Enable precise timing for DJ app
<AudioPlayer
  tracks={djTracks}
  backend="webaudio"
  needsPreciseTiming
/>
```

---

## 5. File Structure Additions

```
src/audio-player/
├── backends/                    # NEW: Audio backend abstraction
│   ├── types.ts
│   ├── createBackend.ts
│   ├── Html5AudioBackend.ts
│   └── WebAudioBackend.ts
├── components/
│   ├── ProgressBar.tsx          # EXISTING: Unchanged
│   ├── VolumeControl.tsx        # EXISTING: Unchanged
│   └── Waveform.tsx             # NEW: Optional waveform viz
├── plugins/                     # NEW: Plugin system
│   ├── types.ts
│   ├── usePluginRegistry.ts
│   ├── waveform-plugin.ts
│   └── analytics-plugin.ts
├── waveform/                    # NEW: Waveform data handling
│   ├── types.ts
│   ├── analyzer.ts              # Web Audio API analysis
│   └── cache.ts
├── skins/                       # EXISTING: All preserved
│   ├── FullCardPlayer.tsx       # Can opt-in to waveform
│   ├── MiniSidebarPlayer.tsx    # Compact mode stays minimal
│   ├── SeaCardPlayer.tsx
│   ├── StickyBottomPlayer.tsx
│   ├── VaultRowPlayer.tsx
│   ├── icons.tsx
│   ├── skins.css
│   └── themeVars.ts
├── automix/                     # EXISTING: Unchanged
├── session/                     # EXISTING: Unchanged
├── utils/                       # EXISTING: Unchanged
├── AudioPlayer.tsx              # EXISTING: Core unchanged
├── useAudioPlayer.ts            # MODIFIED: Backend abstraction
└── types.ts                     # EXTENDED: New optional props
```

---

## 6. Performance Considerations

### Waveform Analysis
- **Pre-compute on upload** (server-side) → Store JSON waveform data
- **Lazy client analysis** only for user-uploaded tracks
- **Web Worker** for heavy FFT computation to avoid UI blocking
- **Multi-resolution peaks** for zoom levels (like wavesurfer)

### Memory Management
- **LRU cache** for waveform data (max 10 tracks)
- **Auto-clear** on track eviction from queue
- **Canvas recycling** to avoid allocation churn

### Backend Choice Guidelines
| Use Case | Recommended Backend | Reason |
|----------|---------------------|--------|
| Standard music player | HTML5 Audio | Best compatibility |
| Podcast/audiobook | HTML5 Audio | No precision needed |
| DJ mixing app | Web Audio | Sample-accurate cueing |
| Dance/beat-sync | Web Audio | Sub-millisecond timing |
| Mobile-first | HTML5 Audio | Battery efficient |

---

## 7. Testing Strategy

### Unit Tests
- Plugin lifecycle (mount, unmount, events)
- Waveform data parsing and caching
- Backend feature detection

### Integration Tests
- Waveform rendering in each skin
- Plugin event broadcasting
- Backend switching mid-playback

### E2E Tests
- Existing smoke tests continue to pass
- Visual regression for skins with/without waveform
- Mobile browser matrix (iOS Safari, Chrome Android)

### Performance Budgets
- Waveform render: < 16ms frame time
- Plugin overhead: < 1ms per event
- Web Audio latency: < 10ms start time

---

## 8. Rollout Timeline

### Week 1-2: Foundation
- [ ] Create plugin interface and registry
- [ ] Implement waveform data types and cache
- [ ] Add backend abstraction layer

### Week 3-4: Components
- [ ] Build Waveform component (canvas-based)
- [ ] Create waveform plugin wrapper
- [ ] Integrate into 1-2 skins as beta

### Week 5-6: Advanced Features
- [ ] Implement Web Audio backend
- [ ] Add backend factory with feature detection
- [ ] Write documentation and examples

### Week 7-8: Polish & Launch
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Update docs and migration guide
- [ ] Release v1.1.0 with opt-in features

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing skins | High | All changes opt-in, zero default changes |
| Performance regression | Medium | Lazy loading, Web Workers, strict budgets |
| Browser incompatibility | Medium | Feature detection, graceful fallbacks |
| Bundle size increase | Low | Code-splitting, tree-shaking plugins |
| Complexity creep | Medium | Clear plugin boundaries, documentation |

---

## 10. Conclusion

This integration plan allows you to **adopt the best ideas from wavesurfer.js** while:
- ✅ **Preserving 100% of existing functionality**
- ✅ **Maintaining SEIHouse's custom UI direction**
- ✅ **Keeping all skins and compact mode intact**
- ✅ **Enabling gradual, opt-in adoption**
- ✅ **Future-proofing with plugin architecture**

The key principle: **everything new is additive and optional**. Your current consumers will see zero changes, while power users can unlock advanced features through explicit configuration.

---

## Appendix A: Quick Reference Code Snippets

### Enable Waveform in FullCardPlayer
```tsx
<FullCardPlayer
  tracks={playlist}
  skinConfig={{
    showWaveform: true,
    waveformHeight: 72,
    waveformZoom: 1.5
  }}
/>
```

### Create Custom Plugin
```tsx
const lyricsPlugin: Plugin = {
  id: 'lyrics',
  onTrackChange(track) {
    if (track.lyrics) fetchLyrics(track.lyrics)
  },
  render(ctx) {
    return currentLyrics && <LyricsPanel text={currentLyrics} />
  }
}
```

### Use Web Audio for DJ App
```tsx
<AudioPlayer
  tracks={djSet}
  backend="webaudio"
  needsPreciseTiming
  onCuePoint={(time) => saveCue(time)}
/>
```
