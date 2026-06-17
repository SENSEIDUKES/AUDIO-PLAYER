/// <reference types="vite/client" />

declare module "*.css" {}

/**
 * Network Information API — used by the HTML5 backend to select the
 * optimal `preload` attribute based on connection speed.
 */
interface NetworkInformation {
    readonly effectiveType: "slow-2g" | "2g" | "3g" | "4g"
    readonly type:
        | "bluetooth"
        | "cellular"
        | "ethernet"
        | "none"
        | "wifi"
        | "wimax"
        | "other"
        | "unknown"
    readonly downlink: number
    readonly downlinkMax: number
    readonly rtt: number
    readonly saveData: boolean
    onchange: ((this: NetworkInformation, ev: Event) => void) | null
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void
}

interface Navigator {
    readonly connection?: NetworkInformation
}
