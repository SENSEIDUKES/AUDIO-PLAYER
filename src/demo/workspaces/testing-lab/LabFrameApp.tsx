import { useEffect, useMemo } from "react"
import { installSoloPlayback, pauseOtherAudio } from "../../workshop/soloPlayback"
import { isParentMessage, postToLab } from "./bridge"
import type { FrameStatus } from "./bridge"
import { LabContextView } from "./contexts"
import { parseLabConfig } from "./labConfig"

/* A Testing Lab preview page (`?frame=lab`). The Mix & Match Lab loads it in an
   <iframe> so its width is a real viewport: media queries, pinned bars, and the
   controller sheet all behave exactly as they would on that device. It can also
   be opened on its own (for example on a phone). */

/** Describe an element briefly for the overflow readout. */
function describe(element: Element): string {
    const className =
        typeof element.className === "string" ? element.className.trim().split(/\s+/)[0] : ""
    return `${element.tagName.toLowerCase()}${className ? `.${className}` : ""}`
}

const CLIPPING = new Set(["hidden", "clip", "auto", "scroll"])

/**
 * The first visible element that pokes past the right edge of the viewport and
 * is not clipped by a scrolling or clipping ancestor inside the viewport.
 */
export function findOverflow(
    doc: Document,
    viewportWidth: number
): { px: number; target: string } | null {
    const body = doc.body
    if (!body) return null
    const elements = body.querySelectorAll("*")
    const limit = Math.min(elements.length, 4000)
    for (let i = 0; i < limit; i += 1) {
        const element = elements[i]
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0 || rect.right <= viewportWidth + 1) continue
        let clipped = false
        for (
            let parent = element.parentElement;
            parent && parent !== body;
            parent = parent.parentElement
        ) {
            const style = doc.defaultView?.getComputedStyle(parent)
            if (style && CLIPPING.has(style.overflowX)) {
                const parentRect = parent.getBoundingClientRect()
                if (parentRect.right <= viewportWidth + 1) {
                    clipped = true
                    break
                }
            }
        }
        if (!clipped)
            return { px: Math.ceil(rect.right - viewportWidth), target: describe(element) }
    }
    return null
}

function measure(): FrameStatus {
    const width = window.innerWidth
    const docOverflow = Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    const offender = findOverflow(document, width)
    const audios = Array.from(document.querySelectorAll("audio"))
    return {
        width,
        height: window.innerHeight,
        overflowPx: Math.max(docOverflow, offender?.px ?? 0),
        overflowTarget: offender?.target ?? (docOverflow > 0 ? "document" : null),
        engines: audios.length,
        playing: audios.filter((audio) => !audio.paused).length,
        errors: document.querySelectorAll('[role="alert"]').length,
    }
}

export function LabFrameApp() {
    const params = useMemo(() => new URLSearchParams(window.location.search), [])
    const config = useMemo(() => parseLabConfig(params), [params])
    const fid = params.get("fid") ?? "main"

    useEffect(() => {
        document.title = "Testing Lab preview"
        document.body.classList.add("lab-frame-body")
    }, [])

    // One engine at a time inside this page; tell the lab so it can pause the
    // other previews too.
    useEffect(
        () => installSoloPlayback(document, { onPlay: () => postToLab(fid, { type: "playing" }) }),
        [fid]
    )

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== window.parent) return
            if (!isParentMessage(event.data)) return
            if (event.data.type === "pause-all") pauseOtherAudio(document, null)
            if (event.data.type === "stress") {
                window.dispatchEvent(
                    new CustomEvent("sap-lab:stress", { detail: event.data.action })
                )
            }
        }
        window.addEventListener("message", onMessage)
        return () => window.removeEventListener("message", onMessage)
    }, [])

    useEffect(() => {
        let frame = 0
        const report = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() =>
                postToLab(fid, { type: "status", status: measure() })
            )
        }
        report()
        const timer = setInterval(report, 1000)
        window.addEventListener("resize", report)
        return () => {
            clearInterval(timer)
            cancelAnimationFrame(frame)
            window.removeEventListener("resize", report)
        }
    }, [fid])

    return <LabContextView config={config} fid={fid} />
}
