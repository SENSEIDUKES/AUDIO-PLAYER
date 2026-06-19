import type { MediaKind, MediaSource } from "../../audio-player"
import { ensureMuted } from "../../audio-player"
import { NO_LUCK_COVER } from "../data"

/* Demo presets so a creator can drop in a real asset with one click. */
const IMAGE_PRESET = NO_LUCK_COVER
const VIDEO_PRESET =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

/**
 * A unified media control: choose Image or Video, set the source (and poster for
 * video), and see a live thumbnail of the currently-assigned asset so it's never
 * ambiguous what's applied.
 */
export function MediaPicker({
    label,
    description,
    value,
    onChange,
}: {
    label: string
    description?: string
    value: MediaSource | null
    onChange: (value: MediaSource | null) => void
}) {
    const kind: MediaKind = value?.kind ?? "image"
    const src = value?.src ?? ""

    const patch = (next: Partial<MediaSource>) =>
        onChange({ kind, src, ...value, ...next } as MediaSource)

    const setKind = (k: MediaKind) => {
        if (k === kind && value) return
        onChange({ kind: k, src: value?.src ?? "", poster: value?.poster })
    }

    const hasAsset = Boolean(src)

    return (
        <div className="ws-media">
            <div className="ws-media__top">
                <div
                    className="ws-media__thumb"
                    data-empty={hasAsset ? "false" : "true"}
                >
                    {hasAsset && kind === "video" ? (
                        <video
                            className="ws-media__thumb-el"
                            src={src}
                            poster={value?.poster}
                            ref={ensureMuted}
                            muted
                            loop
                            autoPlay
                            playsInline
                        />
                    ) : hasAsset ? (
                        <img className="ws-media__thumb-el" src={src} alt="" />
                    ) : (
                        <span className="ws-media__thumb-empty">No media</span>
                    )}
                    {hasAsset && (
                        <span className="ws-media__badge">
                            {kind === "video" ? "VIDEO" : "IMAGE"}
                        </span>
                    )}
                </div>
                <div className="ws-media__meta">
                    <div className="ws-media__label">{label}</div>
                    {description && (
                        <div className="ws-media__desc">{description}</div>
                    )}
                    <div className="ws-media__kind" role="group" aria-label={`${label} type`}>
                        <button
                            type="button"
                            className={`ws-media__kind-btn${kind === "image" ? " ws-media__kind-btn--on" : ""}`}
                            onClick={() => setKind("image")}
                            aria-pressed={kind === "image"}
                        >
                            Image
                        </button>
                        <button
                            type="button"
                            className={`ws-media__kind-btn${kind === "video" ? " ws-media__kind-btn--on" : ""}`}
                            onClick={() => setKind("video")}
                            aria-pressed={kind === "video"}
                        >
                            Video
                        </button>
                    </div>
                </div>
            </div>

            <div className="framer-panel__row framer-panel__row--col">
                <label className="framer-panel__label">
                    {kind === "video" ? "Video URL" : "Image URL"}
                </label>
                <input
                    className="framer-panel__input"
                    value={src}
                    placeholder="https://…"
                    onChange={(e) => patch({ src: e.target.value.trim() })}
                />
            </div>

            {kind === "video" && (
                <div className="framer-panel__row framer-panel__row--col">
                    <label className="framer-panel__label">Poster URL</label>
                    <input
                        className="framer-panel__input"
                        value={value?.poster ?? ""}
                        placeholder="Optional preview frame"
                        onChange={(e) => patch({ poster: e.target.value.trim() })}
                    />
                </div>
            )}

            <div className="framer-panel__preset-row">
                <button
                    type="button"
                    className="framer-panel__preset"
                    onClick={() =>
                        onChange({ kind: "image", src: IMAGE_PRESET })
                    }
                >
                    Sample image
                </button>
                <button
                    type="button"
                    className="framer-panel__preset"
                    onClick={() =>
                        onChange({ kind: "video", src: VIDEO_PRESET })
                    }
                >
                    Sample video
                </button>
                <button
                    type="button"
                    className="framer-panel__preset framer-panel__preset--err"
                    onClick={() => onChange(null)}
                    disabled={!value}
                >
                    Clear
                </button>
            </div>
        </div>
    )
}
