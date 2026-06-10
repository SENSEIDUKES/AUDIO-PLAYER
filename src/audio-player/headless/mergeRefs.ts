import type { MutableRefObject, Ref, RefCallback } from "react"

/**
 * Merge callback refs and object refs into a single callback ref, so a prop
 * getter can attach SAP's internal ref without losing the caller's:
 *
 *     <audio {...getAudioElementProps({ ref: myRef })} />
 *
 * Nullish refs are skipped.
 */
export function mergeRefs<T>(
    ...refs: Array<Ref<T> | null | undefined>
): RefCallback<T> {
    return (node: T | null) => {
        for (const ref of refs) {
            if (!ref) continue
            if (typeof ref === "function") {
                ref(node)
            } else {
                ;(ref as MutableRefObject<T | null>).current = node
            }
        }
    }
}
