import { CSSProperties } from 'react';
import { AudioPlayerTheme } from '../types';
/**
 * Build the `--ap-*` CSS custom properties a skin sets on its root, so the
 * reused `ProgressBar` / `VolumeControl` (which read `var(--ap-progress)`
 * etc.) pick up the right colors — exactly as `.ap-root` does in AudioPlayer.
 * Defaults match the player's dark-glass look.
 */
export declare function buildThemeVars(theme?: AudioPlayerTheme): CSSProperties;
//# sourceMappingURL=themeVars.d.ts.map