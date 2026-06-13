import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import {
    contrastText,
    extractPalette,
    gradient,
    rgbToCss,
    type ArtworkPalette,
    type ExtractPaletteOptions,
} from "../utils/colorExtraction"

export interface AutoThemePluginConfig extends ExtractPaletteOptions {
    name?: string
    /** Drive an ambient glow (`--ap-glow`) from the dominant color. Default true. */
    applyGlow?: boolean
    /** Use a gradient (primary→secondary) for the progress fill. Default true. */
    applyGradient?: boolean
    /** Notified whenever a palette is applied (or cleared with `null`). */
    onPaletteChange?: (palette: ArtworkPalette | null, track: Track | null) => void
}

/** CSS custom properties this plugin writes onto the player root. */
const MANAGED_VARS = [
    "--ap-accent",
    "--ap-progress",
    "--ap-bg",
    "--ap-text",
    "--ap-glow",
] as const

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
export class AutoThemePlugin implements AudioPlayerPlugin {
    readonly name: string
    private readonly applyGlow: boolean
    private readonly applyGradient: boolean
    private readonly extractOptions: ExtractPaletteOptions
    private readonly onPaletteChange?: AutoThemePluginConfig["onPaletteChange"]
    private context: PluginPlayerContext | null = null
    private currentSrc: string | null = null
    private generation = 0

    constructor(config: AutoThemePluginConfig = {}) {
        this.name = config.name ?? "auto-theme"
        this.applyGlow = config.applyGlow ?? true
        this.applyGradient = config.applyGradient ?? true
        this.extractOptions = {
            sampleSize: config.sampleSize,
            quantStep: config.quantStep,
        }
        this.onPaletteChange = config.onPaletteChange
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
        void this.refresh(playerInstance.getCurrentTrack())
    }

    destroy() {
        this.generation++ // invalidate any in-flight extraction
        this.clearVars()
        this.currentSrc = null
        this.context = null
    }

    onTrackLoad = (track: Track | null) => {
        void this.refresh(track)
    }

    private async refresh(track: Track | null) {
        const root = this.context?.getRootElement()
        if (!root) return
        const src = this.resolveArtworkSrc(root)
        if (src === this.currentSrc) return
        this.currentSrc = src

        const token = ++this.generation
        if (!src) {
            this.clearVars()
            this.onPaletteChange?.(null, track)
            return
        }

        const palette = await extractPalette(src, this.extractOptions)
        // A newer track loaded (or the plugin was destroyed) while we decoded.
        if (token !== this.generation) return
        if (!palette) {
            // Extraction failed (load error or CORS taint). Clear any vars from
            // a prior track so we revert to the player's manual theme rather
            // than leaving stale colors behind.
            this.clearVars()
            this.onPaletteChange?.(null, track)
            return
        }
        this.applyPalette(root, palette)
        this.onPaletteChange?.(palette, track)
    }

    /** Read the artwork URL from the rendered backdrop, else Media Session. */
    private resolveArtworkSrc(root: HTMLElement): string | null {
        const bg = root.querySelector<HTMLElement>(".ap-bg-image")
        const fromBackdrop = bg
            ? parseCssUrl(bg.style.backgroundImage)
            : null
        if (fromBackdrop) return fromBackdrop

        if (typeof navigator !== "undefined" && navigator.mediaSession) {
            const artwork = navigator.mediaSession.metadata?.artwork
            if (artwork && artwork.length > 0) return artwork[0].src
        }
        return null
    }

    private applyPalette(root: HTMLElement, palette: ArtworkPalette) {
        const { primary, secondary, accent, isDark } = palette
        const surface = isDark ? primary : secondary
        root.style.setProperty("--ap-accent", rgbToCss(accent))
        root.style.setProperty(
            "--ap-progress",
            this.applyGradient ? gradient(primary, secondary) : rgbToCss(accent)
        )
        // Tint the background with the dominant color at low opacity so the
        // controls read as part of the artwork without hiding it.
        root.style.setProperty("--ap-bg", rgbaTint(surface, 0.55))
        root.style.setProperty("--ap-text", contrastText(surface))
        if (this.applyGlow) {
            root.style.setProperty("--ap-glow", rgbaTint(accent, 0.45))
        }
    }

    private clearVars() {
        const root = this.context?.getRootElement()
        if (!root) return
        for (const name of MANAGED_VARS) root.style.removeProperty(name)
    }
}

/** Pull the URL out of a CSS `url("...")` value, if present. */
function parseCssUrl(value: string): string | null {
    const match = /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(value)
    return match?.[2] || null
}

function rgbaTint([r, g, b]: ArtworkPalette["primary"], alpha: number): string {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}

export function createAutoThemePlugin(config?: AutoThemePluginConfig) {
    return new AutoThemePlugin(config)
}
