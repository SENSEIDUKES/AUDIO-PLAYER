# Spatial Audio Implementation Guide

## Overview

SAP (SeiHouse Audio Player) now includes comprehensive spatial audio support modeled after Howler.js's spatial API. This implementation provides:

- **Stereo panning** via `StereoPannerNode` (-1 left to 1 right)
- **3D positioning** via `PannerNode` with HRTF (default) or equalpower (lite mode)
- **Source orientation** for directional audio
- **Distance modeling** (inverse/linear/exponential)
- **Cone settings** for directional audio effects
- **Playback rate control** (0.5x to 4.0x)
- **Lite mode** for mobile/low-power scenarios

## Browser Support Matrix

| Browser | Spatial Audio Support | Notes |
|---------|----------------------|-------|
| Chrome/Edge (Desktop) | ✅ Full | HRTF + all features |
| Firefox (Desktop) | ✅ Full | HRTF + all features |
| Safari (Desktop) | ✅ Full | HRTF + all features |
| iOS Safari | ⚠️ Lite Mode Recommended | Web Audio API available but resource-constrained; use `setLiteMode(true)` |
| Android Chrome | ✅ Full | Performance varies by device |
| Mobile browsers (general) | ⚠️ Use Lite Mode | Enable lite mode for battery/CPU efficiency |

## Backend Support

### WebAudioBackend (Full Support)
- All spatial audio features available
- Default panning model: **HRTF** (high-quality 3D)
- Lite mode uses **equalpower** (simpler, lower CPU)

### HTML5AudioBackend (No Support)
- Returns `false` from `supportsSpatial()`
- All spatial methods are no-ops with console warnings
- Does NOT break playback—graceful degradation

## API Reference

### Types

```typescript
// Distance modeling algorithms
type DistanceModelType = "linear" | "inverse" | "exponential"

// Spatial audio configuration
interface SpatialAudioOptions {
    stereo?: number              // -1 to 1
    pos?: [number, number, number]
    orientation?: [number, number, number]
    rate?: number                // 0.5 to 4.0
    distanceModel?: DistanceModelType
    refDistance?: number         // Default: 1
    maxDistance?: number         // Default: 10000
    rolloffFactor?: number       // Default: 1
    coneInnerAngle?: number      // Default: 360
    coneOuterAngle?: number      // Default: 360
    coneOuterGain?: number       // Default: 0
}

// Current spatial state
interface SpatialAudioState {
    stereo: number
    pos: [number, number, number]
    orientation: [number, number, number]
    rate: number
    distanceModel: DistanceModelType
    refDistance: number
    maxDistance: number
    rolloffFactor: number
    coneInnerAngle: number
    coneOuterAngle: number
    coneOuterGain: number
    isSpatialEnabled: boolean
    liteMode: boolean
}
```

### Backend Methods

All spatial methods are available on the `AudioBackend` interface:

```typescript
// Check support
backend.supportsSpatial(): boolean

// Stereo panning
backend.setStereo(pan: number): void
backend.getStereo(): number

// 3D positioning
backend.setPos(x: number, y: number, z: number): void
backend.getPos(): [number, number, number]

// Orientation
backend.setOrientation(x: number, y: number, z: number): void
backend.getOrientation(): [number, number, number]

// Rate/pitch
backend.setRate(rate: number): void
backend.getRate(): number

// Distance model
backend.setDistanceModel(model: DistanceModelType): void
backend.getDistanceModel(): DistanceModelType

backend.setRefDistance(distance: number): void
backend.getRefDistance(): number

backend.setMaxDistance(distance: number): void
backend.getMaxDistance(): number

backend.setRolloffFactor(factor: number): void
backend.getRolloffFactor(): number

// Cone settings
backend.setConeInnerAngle(angle: number): void
backend.getConeInnerAngle(): number

backend.setConeOuterAngle(angle: number): void
backend.getConeOuterAngle(): number

backend.setConeOuterGain(gain: number): void
backend.getConeOuterGain(): number

// Lite mode
backend.setLiteMode(enabled: boolean): void
backend.isLiteMode(): boolean
```

## Usage Examples

### Example 1: Basic Stereo Panning

```typescript
import { useAudioPlayer } from '@seihouse/audio-player'

function MyComponent() {
    const engine = useAudioPlayer({ src: '/audio/track.mp3', audioBackend: 'webaudio' })
    
    // Pan hard left
    engine.backend?.setStereo(-1)
    
    // Center
    engine.backend?.setStereo(0)
    
    // Pan hard right
    engine.backend?.setStereo(1)
}
```

### Example 2: 3D Positioning

```typescript
// Place sound 5 units to the right, 2 units up, 10 units forward
engine.backend?.setPos(5, 2, 10)

// Move sound in a circle
const angle = Date.now() * 0.001
const radius = 5
engine.backend?.setPos(
    Math.sin(angle) * radius,
    0,
    Math.cos(angle) * radius
)
```

### Example 3: Distance-Based Attenuation

```typescript
// Configure distance falloff
engine.backend?.setDistanceModel('inverse')  // Natural sound decay
engine.backend?.setRefDistance(1)            // Start attenuating at 1 unit
engine.backend?.setMaxDistance(50)           // Silent beyond 50 units
engine.backend?.setRolloffFactor(1)          // Standard rolloff
```

### Example 4: Directional Audio (Cone Effect)

```typescript
// Sound points forward (default orientation is [1, 0, 0])
engine.backend?.setOrientation(1, 0, 0)

// Narrow cone: full volume within 30°, reduced outside
engine.backend?.setConeInnerAngle(30)
engine.backend?.setConeOuterAngle(90)
engine.backend?.setConeOuterGain(0.3)  // 30% volume outside cone
```

### Example 5: Mobile Lite Mode

```typescript
// Detect mobile and enable lite mode
if (isMobileDevice()) {
    engine.backend?.setLiteMode(true)  // Uses equalpower instead of HRTF
}

// Still supports stereo pan in lite mode
engine.backend?.setStereo(0.5)
```

### Example 6: Playback Rate Control

```typescript
// Slow motion (0.5x)
engine.backend?.setRate(0.5)

// Normal speed
engine.backend?.setRate(1.0)

// Fast forward (2x)
engine.backend?.setRate(2.0)
```

## Global Listener Position

Web Audio API has **one listener per AudioContext**. SAP shares one AudioContext across all WebAudioBackend instances, so:

- **Listener position is global** across all players using webaudio backend
- Individual sounds can have their own `pos` and `orientation`
- To move the listener (camera), access the shared AudioContext:

```typescript
// Access shared context through any webaudio backend
const ctx = (backend as WebAudioBackend).getAudioContext()
if (ctx) {
    // Move listener to origin
    ctx.listener.positionX.value = 0
    ctx.listener.positionY.value = 0
    ctx.listener.positionZ.value = 0
    
    // Point listener forward
    ctx.listener.forwardX.value = 0
    ctx.listener.forwardY.value = 0
    ctx.listener.forwardZ.value = -1
    
    // Up vector
    ctx.listener.upX.value = 0
    ctx.listener.upY.value = 1
    ctx.listener.upZ.value = 0
}
```

## Fallback Strategy

When spatial audio is requested on HTML5 backend:

1. **No playback disruption**: Audio continues playing normally
2. **Console warning**: Developers see clear warnings about unsupported features
3. **Graceful defaults**: Getters return sensible defaults (e.g., `getStereo()` returns 0)

```typescript
// This won't break anything, even on html5 backend
backend.setStereo(0.5)  // Console warning on html5, works on webaudio
backend.setPos(5, 0, 10)  // Console warning on html5, works on webaudio
```

## Performance Considerations

### HRTF vs Equalpower

- **HRTF** (default): High-quality 3D spatialization using head-related transfer functions
  - More CPU intensive
  - Better for desktop/VR/immersive experiences
  - Recommended for Chrome/Firefox/Safari desktop

- **Equalpower** (lite mode): Simple stereo panning
  - Lower CPU usage
  - Good enough for basic left/right positioning
  - Recommended for mobile/battery-constrained devices

### When to Use Lite Mode

Enable lite mode when:
- Targeting mobile devices
- Battery life is a concern
- Multiple simultaneous spatial sources
- Simple stereo positioning is sufficient

```typescript
// Auto-detect and enable lite mode
if (isMobileDevice() || isLowPowerMode()) {
    backend.setLiteMode(true)
}
```

## Migration from Howler.js

If migrating from Howler.js, the API is intentionally similar:

| Howler.js | SAP Equivalent |
|-----------|----------------|
| `sound.stereo(pan)` | `backend.setStereo(pan)` |
| `sound.pos(x, y, z)` | `backend.setPos(x, y, z)` |
| `sound.orientation(x, y, z)` | `backend.setOrientation(x, y, z)` |
| `sound.rate(rate)` | `backend.setRate(rate)` |
| `sound.distanceModel(model)` | `backend.setDistanceModel(model)` |
| `sound.refDistance(dist)` | `backend.setRefDistance(dist)` |
| `sound.maxDistance(dist)` | `backend.setMaxDistance(dist)` |
| `sound.rolloffFactor(factor)` | `backend.setRolloffFactor(factor)` |
| `sound.coneInnerAngle(angle)` | `backend.setConeInnerAngle(angle)` |
| `sound.coneOuterAngle(angle)` | `backend.setConeOuterAngle(angle)` |
| `sound.coneOuterGain(gain)` | `backend.setConeOuterGain(gain)` |

## Testing & Debugging

### Verify Spatial Audio is Active

```typescript
const backend = engine.backend
console.log('Supports spatial:', backend.supportsSpatial())
console.log('Current position:', backend.getPos())
console.log('Lite mode:', backend.isLiteMode())
console.log('Distance model:', backend.getDistanceModel())
```

### Common Issues

**Issue**: "setStereo() called but spatial audio is not supported"
- **Cause**: Using HTML5 backend
- **Solution**: Switch to `audioBackend: 'webaudio'` in player props

**Issue**: No 3D effect on mobile
- **Cause**: HRTF may be disabled or lite mode active
- **Solution**: Check `backend.isLiteMode()` and disable if appropriate

**Issue**: Audio cuts out at distance
- **Cause**: `maxDistance` too low or `rolloffFactor` too high
- **Solution**: Increase `maxDistance` or decrease `rolloffFactor`

## Future Enhancements

Potential additions for future versions:

- [ ] Listener position/orientation API at engine level
- [ ] Spatial audio plugin with preset configurations
- [ ] Visual spatial debugger overlay
- [ ] Automatic lite mode detection based on device capabilities
- [ ] Convolution reverb for room simulation
- [ ] Doppler effect support

## References

- [Web Audio API PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode)
- [Web Audio API StereoPannerNode](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode)
- [Howler.js Spatial Audio](https://howlerjs.com/#spatial)
- [Web Audio API Distance Models](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel)
