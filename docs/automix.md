# AutoMix Plugin

AutoMix is one smart automatic transition plugin:

```tsx
import { createAutomixPlugin } from "@seihouse/audio-player"

const plugins = [
  createAutomixPlugin(),
]
```

AutoMix preloads the resolved next track into a detached deck, runs an
equal-power fade near the best transition point, then advances through the
host's normal queue path. It uses BPM, beat, energy, and transition-point
analysis when that data is available and confident.

Fallbacks are automatic: smart analysis, silence-trimmed crossfade, basic fixed
crossfade, then normal track advance when the browser or media cannot support a
safe crossfade.

Legacy compatibility remains:

- `<AudioPlayer automix>` and `<AudioSessionProvider automix>` create an
  internal basic crossfade bridge for older integrations. A future core
  transition API is expected to expose this foundation more directly.
- `useAutomix()` remains exported for older code, but delegates to
  `AutomixPlugin`.
- Old mode/pro config and `createAutomixProPlugin()` remain exported as silent
  deprecated compatibility wrappers.

Known constraints are unchanged: crossfades require an HTML media element and
programmatic volume support, CORS-readable audio is needed for analysis, and
repeat-one or end-of-queue with repeat off do not AutoMix.
