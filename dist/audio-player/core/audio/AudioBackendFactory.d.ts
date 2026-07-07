import { RefObject } from 'react';
import { AudioBackend, AudioBackendKind } from './AudioBackend';
export interface AudioBackendDeps {
    /** Ref to the host-rendered `<audio>` element (used by the html5 backend). */
    audioRef: RefObject<HTMLAudioElement | null>;
}
/**
 * Instantiate the requested playback backend, falling back to HTML5 Audio
 * (with a console warning) when Web Audio is unavailable.
 */
export declare function createAudioBackend(requested: AudioBackendKind, deps: AudioBackendDeps): AudioBackend;
//# sourceMappingURL=AudioBackendFactory.d.ts.map