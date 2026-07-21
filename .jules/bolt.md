## 2026-07-09 - O(1) Map Lookup for Visual Slots Registry

**Learning:** The visual slots registry exposed an iterator `getVisualComponentIterator()` which was being used in a loop in `getDefaultsFor` to find defaults by ID. This resulted in an O(N) linear scan whenever `getSettings` needed fallback defaults on every render.
**Action:** Changed `getDefaultsFor` to use `getVisualComponent(id)` which provides direct O(1) Map lookup. Always look for O(1) map/registry accessor functions before using an iterator for ID lookups.

## 2026-07-10 - Add React.memo to TrackMetadata

**Learning:** The global audio engine (`useAudioPlayer`) updates `currentTime` playback state via a ~60fps `requestAnimationFrame` loop, triggering frequent re-renders in subscribing components.
**Action:** Always use `React.memo` on purely presentational components like `TrackMetadata` that are rendered inside containers tracking high-frequency audio state updates.

## 2026-07-21 - Benchmarking Visual Slots getDefaultsFor Lookup Inefficiencies

**Learning:** Benchmarking getDefaultsFor confirms that O(1) Map-based lookups (`getVisualComponent`) are significantly faster than O(N) linear array traversal (`getAllVisualComponents`). In our simulation with 1,000 components, direct Map lookups achieved ~90.4x speed improvement.
**Action:** When designing lookup utilities, always provide and prefer Map-based get/set operations over scanning array iterators. Write micro-benchmarks early to establish baseline performance metrics.
