/**
 * Auto-generated adapter for "Sample Skin".
 * Wraps the raw Workshop-Light component in a SAP VisualComponentDefinition.
 *
 * ⚡ Review the TODO(skin) block below to map the raw component's props to
 *    SAP's settings and playback context. The adapter passes settings/playback
 *    through as-is until you wire them to the raw component's API.
 */
import type {
    VisualComponentDefinition,
    VisualComponentProps,
    VisualSettingsPanelProps,
} from "../../../types"
import RawComponent from "./raw"
import "./sample-skin.css"

// ─── Settings ────────────────────────────────────────────────────────────────

/** Default settings for this skin. Edit to match your component's API. */
export const sampleSkinDefaultSettings: Record<string, unknown> = {
    // TODO(skin): add default settings that your component needs.
}

type SampleSkinSettings = Record<string, unknown>

// ─── Component ───────────────────────────────────────────────────────────────

export function SampleSkin({ settings, playback }: VisualComponentProps<SampleSkinSettings>) {
    // TODO(skin): map `settings` and `playback` to props your raw component expects.
    // Example: <RawComponent primaryColor={settings.primaryColor as string} />
    void settings
    void playback
    return (
        <div className="sap-visual-sample-skin">
            <RawComponent />
        </div>
    )
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

export function SampleSkinSettingsPanel({
    settings,
    onChange,
}: VisualSettingsPanelProps<SampleSkinSettings>) {
    void settings
    void onChange
    return (
        <div className="sap-visual-settings">
            {/* TODO(skin): build settings controls for your component. */}
            <p style={{ opacity: 0.6, fontSize: 12 }}>
                No settings configured yet. Edit this panel in {SampleSkin.name}.tsx.
            </p>
        </div>
    )
}

// ─── Definition ──────────────────────────────────────────────────────────────

export const sampleSkinDefinition: VisualComponentDefinition<SampleSkinSettings> = {
    id: "sample-skin",
    name: "Sample Skin",
    slot: "seiCanvas",
    Component: SampleSkin,
    SettingsPanel: SampleSkinSettingsPanel,
    defaultSettings: sampleSkinDefaultSettings,
}
