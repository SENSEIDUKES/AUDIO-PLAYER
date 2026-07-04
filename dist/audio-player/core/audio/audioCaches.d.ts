/** Shared decoded-buffer LRU cache for Web Audio playback. */
export declare class LRUAudioCache {
    private maxSize;
    private cache;
    private order;
    constructor(maxSize?: number);
    getStats(): {
        decodedBufferCount: number;
        decodedBufferBytes: number;
        lruOrder: string[];
    };
    setMaxSize(size: number): void;
    prune(keepKeys: string[], keepRecent?: number): void;
    private enforceSize;
    get(url: string): AudioBuffer | null;
    set(url: string, buffer: AudioBuffer): void;
    has(url: string): boolean;
    delete(url: string): void;
    clear(): void;
}
/** Persistent raw audio cache backed by the browser Cache API. */
export declare class PersistentAudioCache {
    private readonly cacheName;
    private get isAvailable();
    getArrayBuffer(url: string): Promise<ArrayBuffer | null>;
    putArrayBuffer(url: string, buffer: ArrayBuffer): Promise<void>;
}
/** Pool of detached HTMLAudioElements for passive preload / streaming fallbacks. */
export declare class HTML5AudioPool {
    private maxSize;
    private pool;
    constructor(maxSize?: number);
    getStats(): {
        preloadElementCount: number;
    };
    acquire(): HTMLAudioElement;
    release(audio: HTMLAudioElement): void;
    releaseAll(): void;
}
export declare const sharedAudioBufferCache: LRUAudioCache;
export declare class AudioStorageCache extends PersistentAudioCache {
}
export declare const sharedAudioStorageCache: PersistentAudioCache;
export declare const sharedPersistentAudioCache: PersistentAudioCache;
export declare const sharedHTML5AudioPool: HTML5AudioPool;
//# sourceMappingURL=audioCaches.d.ts.map