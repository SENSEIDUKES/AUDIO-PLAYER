import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
import { ArtworkPalette, ExtractPaletteOptions } from '../utils/colorExtraction';
export interface AutoThemePluginConfig extends ExtractPaletteOptions {
    name?: string;
    /** Drive an ambient glow (`--ap-glow`) from the dominant color. Default true. */
    applyGlow?: boolean;
    /** Use a gradient (primary→secondary) for the progress fill. Default true. */
    applyGradient?: boolean;
    /** Notified whenever a palette is applied (or cleared with `null`). */
    onPaletteChange?: (palette: ArtworkPalette | null, track: Track | null) => void;
}
/**
 * Auto Theme: derive the player's palette from the current album art.
 *
 * While active, this plugin reads the artwork rendered behind the player
 * (`.ap-bg-image`, falling back to Media Session artwork), extracts its dominant
 * colors via the Canvas API, and writes `--ap-*` CSS variables onto the player
 * root — accent, a gradient progress fill, a tinted background, contrast-correct
 * text, and an ambient glow. Removing the plugin restores the manual theme: the
 * managed vars are cleared on `destroy`, so the root's original inline values
 * take over again.
 */
export declare class AutoThemePlugin implements AudioPlayerPlugin {
    readonly name: string;
    private readonly applyGlow;
    private readonly applyGradient;
    private readonly extractOptions;
    private readonly onPaletteChange?;
    private context;
    private currentSrc;
    private generation;
    constructor(config?: AutoThemePluginConfig);
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    onTrackLoad: (track: Track | null) => void;
    private refresh;
    /** Read the artwork URL from the rendered backdrop, else Media Session. */
    private resolveArtworkSrc;
    private applyPalette;
    private clearVars;
}
export declare function createAutoThemePlugin(config?: AutoThemePluginConfig): AutoThemePlugin;
//# sourceMappingURL=AutoThemePlugin.d.ts.map