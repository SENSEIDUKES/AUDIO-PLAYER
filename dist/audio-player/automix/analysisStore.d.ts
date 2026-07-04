import { TrackAnalysis } from '../types';
/** Bump to invalidate stored results when the analysis pipeline changes. */
export declare const ANALYSIS_VERSION = 1;
export declare function readStoredAnalysis(trackKey: string): Promise<TrackAnalysis | null>;
export declare function writeStoredAnalysis(trackKey: string, analysis: TrackAnalysis): Promise<void>;
//# sourceMappingURL=analysisStore.d.ts.map