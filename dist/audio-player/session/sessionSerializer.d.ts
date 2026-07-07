import { SessionEngine, Track, RepeatMode } from '../types';
export interface SerializedSession {
    queue: Track[];
    currentIndex: number;
    currentTime: number;
    shuffle: boolean;
    repeatMode: RepeatMode;
    timestamp: number;
}
export interface DeserializeOptions {
    /** Optional callback to transform track URLs, e.g., to refresh stale CDN tokens */
    urlTransformer?: (url: string) => string;
    /** Maximum age in milliseconds for a session to be considered valid. Defaults to infinite. */
    maxAgeMs?: number;
}
/**
 * Serializes the current session state into a plain object suitable for
 * localStorage or sharing.
 */
export declare function serializeSession(session: SessionEngine): SerializedSession;
/**
 * Deserializes a session state, validating its structure.
 * Returns the validated session, or null if the data is invalid or expired.
 */
export declare function deserializeSession(data: unknown, options?: DeserializeOptions): SerializedSession | null;
//# sourceMappingURL=sessionSerializer.d.ts.map