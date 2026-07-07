export interface SourceValidationResult {
    ok: boolean;
    accessible: boolean;
    corsEnabled: boolean;
    mimeType?: string;
    codecSupported?: boolean;
    error?: string;
}
export interface ValidateTrackSourceOptions {
    timeoutMs?: number;
    checkCodec?: boolean;
}
/**
 * Validates an audio track URL by attempting a HEAD request.
 * Returns information about accessibility, CORS status, and optionally
 * checks codec support if the MIME type can be determined.
 */
export declare function validateTrackSource(url: string, options?: ValidateTrackSourceOptions): Promise<SourceValidationResult>;
//# sourceMappingURL=validateTrackSource.d.ts.map