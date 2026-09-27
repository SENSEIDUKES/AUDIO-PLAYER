import { useEffect, useState } from "react"
import {
    SAPController,
    VisualSlotsProvider,
    formatTime,
    useAudioSession,
    useAudioTime,
    useShareTrack,
} from "../../../audio-player"
import type {
    AudioPlayerTheme,
    FallbackSourceEvent,
    SessionEngine,
    Track,
    WorkspaceRoute,
} from "../../../audio-player"
import { Readout } from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"

/* Helpers shared by workspaces that sit inside an AudioSessionProvider. They
   read the session exactly the way a host app would: through the public hooks. */

/** A compact, always-current readout of the shared session. */
export function SessionReadout({ label = "Session" }: { label?: string }) {
    const s = useAudioSession()
    const { currentTime, duration, buffered } = useAudioTime()
    const state = s.hasError
        ? "Error"
        : s.isBuffering
          ? "Buffering"
          : s.isPlaying
            ? "Playing"
            : "Paused"
    return (
        <Readout
            label={label}
            rows={[
                [
                    "Now playing",
                    s.currentTrack ? `${s.currentTrack.title} — ${s.currentTrack.artist}` : "—",
                ],
                ["State", s.hasError ? `Error: ${s.errorMessage}` : state],
                [
                    "Time",
                    `${formatTime(currentTime)} / ${formatTime(duration)} (buffered ${formatTime(buffered)})`,
                ],
                ["Queue", s.queue.length ? `${s.currentIndex + 1} of ${s.queue.length}` : "empty"],
                [
                    "Shuffle · Repeat · Automix",
                    `${s.shuffle ? "on" : "off"} · ${s.repeatMode} · ${s.automix ? "on" : "off"}`,
                ],
                ["Volume", s.isMuted ? "muted" : `${Math.round(s.volume * 100)}%`],
            ]}
        />
    )
}

/* Event names and payloads, derived from the public SessionEngine type so the
   workshop never reaches past the package's published entry. */
type SessionEventType = Parameters<SessionEngine["subscribe"]>[0]
type SessionEventPayload = Parameters<Parameters<SessionEngine["subscribe"]>[1]>[0]

const EVENT_TYPES: readonly SessionEventType[] = [
    "track-change",
    "play",
    "pause",
    "queue-end",
    "error",
    "fallback-source",
]

function describeEvent(
    type: SessionEventType,
    payload: SessionEventPayload
): { text: string; tone: LogLine["tone"] } {
    switch (type) {
        case "track-change": {
            const p = payload as { track: Track | null }
            return { text: `track-change → ${p.track?.title ?? "(none)"}`, tone: "info" }
        }
        case "play": {
            const p = payload as { track: Track; currentTime: number }
            return { text: `play · ${p.track.title} at ${formatTime(p.currentTime)}`, tone: "ok" }
        }
        case "pause": {
            const p = payload as { currentTime: number }
            return { text: `pause at ${formatTime(p.currentTime)}`, tone: "info" }
        }
        case "queue-end": {
            const p = payload as { reason: string }
            return { text: `queue-end (${p.reason})`, tone: "warn" }
        }
        case "error": {
            const p = payload as { error: string; track: Track | null }
            return { text: `error · ${p.track?.title ?? "?"}: ${p.error}`, tone: "error" }
        }
        default: {
            const p = payload as FallbackSourceEvent
            return {
                text: `fallback-source → candidate ${p.sourceIndex + 1} of ${p.sourceCount}`,
                tone: "warn",
            }
        }
    }
}

/** Subscribe to every session event and forward a readable line to `append`. */
export function SessionEventFeed({
    append,
}: {
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const { subscribe } = useAudioSession()
    useEffect(() => {
        const unsubscribers = EVENT_TYPES.map((type) =>
            subscribe(type, (payload) => {
                const { text, tone } = describeEvent(type, payload)
                append(text, tone)
            })
        )
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
    }, [subscribe, append])
    return null
}

/**
 * A SAP Controller owned by the workspace instead of a face, wired to the
 * session the same way the faces wire theirs, so any destination can be opened
 * directly. Wrapped in its own visual-slot store for the canvas routes.
 */
export function SessionController({
    route,
    onClose,
    theme,
}: {
    route: WorkspaceRoute | null
    onClose: () => void
    theme?: AudioPlayerTheme
}) {
    const s = useAudioSession()
    const { duration } = useAudioTime()
    const { share, copied } = useShareTrack(
        s.currentTrack?.title ?? "",
        s.currentTrack?.artist ?? ""
    )
    return (
        <VisualSlotsProvider>
            <SAPController
                open={route !== null}
                route={route ?? "options"}
                onClose={onClose}
                playback={{
                    shuffle: s.shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode: s.repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix: s.automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                queue={
                    s.queue.length
                        ? {
                              count: s.queue.length,
                              tracks: s.queue,
                              currentIndex: s.currentIndex,
                              isPlaying: s.isPlaying,
                              onPlayTrack: s.playTrack,
                              onRemove: s.removeFromQueue,
                          }
                        : undefined
                }
                info={
                    s.currentTrack
                        ? {
                              title: s.currentTrack.title,
                              artist: s.currentTrack.artist,
                              duration,
                              lyrics: s.currentTrack.lyrics,
                          }
                        : undefined
                }
                share={s.currentTrack ? { onShare: share, copied } : undefined}
                pluginNames={s.pluginNames}
                {...theme}
            />
        </VisualSlotsProvider>
    )
}

/** Re-render on an interval — for readouts of values that have no event (caches, analysis). */
export function useTicker(intervalMs = 1000): number {
    const [tick, setTick] = useState(0)
    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), intervalMs)
        return () => clearInterval(timer)
    }, [intervalMs])
    return tick
}
