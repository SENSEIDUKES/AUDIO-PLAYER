import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"

/**
 * Build the `--ap-*` CSS custom properties a skin sets on its root, so the
 * reused `ProgressBar` / `VolumeControl` (which read `var(--ap-progress)`
 * etc.) pick up the right colors — exactly as `.ap-root` does in AudioPlayer.
 * Defaults match the player's dark-glass look.
 */
export function buildThemeVars(theme: AudioPlayerTheme = {}): CSSProperties {
    const {
        accentColor = "#FFFFFF",
        playIconColor = "#000000",
        textColor = "#FFFFFF",
        progressColor = "#FFFFFF",
        trackColor = "rgba(204, 204, 204, 0.35)",
        backgroundColor = "rgba(20, 20, 28, 0.6)",
        glowColor = "transparent",
        glowIntensity = 100,
        buttonOpacity = 0,
    } = theme
    return {
        "--ap-accent": accentColor,
        "--ap-play-icon": playIconColor,
        "--ap-text": textColor,
        "--ap-progress": progressColor,
        "--ap-track": trackColor,
        "--ap-bg": backgroundColor,
        "--ap-glow": glowColor,
        "--ap-glow-intensity": glowIntensity / 100,
        "--ap-btn-opacity-delta": `${buttonOpacity}%`,
    } as CSSProperties
}
