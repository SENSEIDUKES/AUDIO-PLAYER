import { Ref, RefCallback } from 'react';
/**
 * Merge callback refs and object refs into a single callback ref, so a prop
 * getter can attach SAP's internal ref without losing the caller's:
 *
 *     <audio {...getAudioElementProps({ ref: myRef })} />
 *
 * Nullish refs are skipped.
 */
export declare function mergeRefs<T>(...refs: Array<Ref<T> | null | undefined>): RefCallback<T>;
//# sourceMappingURL=mergeRefs.d.ts.map