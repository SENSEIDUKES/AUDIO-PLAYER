## 2026-07-09 - O(1) Map Lookup for Visual Slots Registry
**Learning:** The visual slots registry exposed an iterator `getVisualComponentIterator()` which was being used in a loop in `getDefaultsFor` to find defaults by ID. This resulted in an O(N) linear scan whenever `getSettings` needed fallback defaults on every render.
**Action:** Changed `getDefaultsFor` to use `getVisualComponent(id)` which provides direct O(1) Map lookup. Always look for O(1) map/registry accessor functions before using an iterator for ID lookups.
