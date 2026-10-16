import type { AudioPlayerTheme } from "../../../audio-player"
import { THEME_PRESETS } from "../../panel/SchemaPanel"

/* The four theme presets the Workshop offers by short id, shared by the
   Testing Lab previews and New Face compositions. */

export type ThemeId = "purple" | "green" | "glass" | "red"

export const THEME_OPTIONS: readonly { value: ThemeId; label: string }[] = [
    { value: "purple", label: "SEI Purple" },
    { value: "green", label: "Neon Green" },
    { value: "glass", label: "OG Glass" },
    { value: "red", label: "Error Red" },
]

export function themeFor(id: ThemeId): AudioPlayerTheme {
    const label = THEME_OPTIONS.find((option) => option.value === id)?.label
    return THEME_PRESETS.find((preset) => preset.label === label)?.theme ?? {}
}
