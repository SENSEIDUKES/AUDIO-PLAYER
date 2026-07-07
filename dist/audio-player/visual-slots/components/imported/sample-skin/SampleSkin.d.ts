import { VisualComponentDefinition, VisualComponentProps, VisualSettingsPanelProps } from '../../../types';
/** Default settings for this skin. Edit to match your component's API. */
export declare const sampleSkinDefaultSettings: Record<string, unknown>;
type SampleSkinSettings = Record<string, unknown>;
export declare function SampleSkin({ settings, playback }: VisualComponentProps<SampleSkinSettings>): import("react").JSX.Element;
export declare function SampleSkinSettingsPanel({ settings, onChange, }: VisualSettingsPanelProps<SampleSkinSettings>): import("react").JSX.Element;
export declare const sampleSkinDefinition: VisualComponentDefinition<SampleSkinSettings>;
export {};
//# sourceMappingURL=SampleSkin.d.ts.map