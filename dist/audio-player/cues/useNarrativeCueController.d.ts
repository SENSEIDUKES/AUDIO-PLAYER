import { UseNarrativeAudioOptions } from '../narrative/useNarrativeAudio';
export interface NarrativeCueControllerState {
    sceneMood?: string;
    ambientProfile?: string;
    fxClip?: string;
    fxLoop?: boolean;
    duckAmount?: number;
    intensity?: number;
    chapterId?: string;
}
export interface UseNarrativeCueControllerOptions {
    /** Target element to listen for narrative events. Defaults to window. */
    eventTarget?: HTMLElement | Window;
}
/**
 * A host-facing React hook that acts as the bridge between generic Cue Manifest
 * events and the SAP narrative audio engine.
 */
export declare function useNarrativeCueController(options?: UseNarrativeCueControllerOptions): {
    /** Options to spread into `useNarrativeAudio`. */
    narrativeOptions: UseNarrativeAudioOptions;
    dispatchCueEvent: (trigger: {
        kind?: string;
        value?: string | number;
        id?: string;
    }) => void;
    enterScene: (sceneId: string) => void;
    enterParagraph: (paragraphId: string) => void;
    enterChapter: (chapterId: string) => void;
    applyMetadataSignature: (signature: string) => void;
};
//# sourceMappingURL=useNarrativeCueController.d.ts.map