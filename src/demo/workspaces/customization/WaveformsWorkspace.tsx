import { useEffect, useMemo, useState } from "react"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    computePeaksFromUrl,
    createWaveformPlugin,
} from "../../../audio-player"
import type { AudioBackendKind, ComputedPeaks, Track } from "../../../audio-player"
import { SAMPLE, SEA_THEME, TRACK_SETS, isTrackSetId } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Note,
    Panel,
    RangeField,
    Readout,
    Segmented,
    SelectField,
    SplitLayout,
    Switch,
} from "../../workshop/ui"

/* Waveforms: the wavesurfer.js scrubber. The engine stays the only playback
   owner; the waveform only draws peaks and forwards seeks. Peaks come from the
   decoded buffer (Web Audio), a separate fetch-and-decode (HTML5, needs
   cross-site decoding), or precomputed values on the track itself. */

function withPeaks(tracks: Track[], peaks: ComputedPeaks | null): Track[] {
    if (!peaks) return tracks
    return tracks.map((track) =>
        track.audioFile === SAMPLE
            ? { ...track, peaks: peaks.peaks, waveformDuration: peaks.duration }
            : track
    )
}

export function WaveformsWorkspace() {
    const [backendParam, setBackend] = useWorkspaceParam("backend", "html5")
    const backend: AudioBackendKind = backendParam === "webaudio" ? "webaudio" : "html5"
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "sample")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "sample"
    const [height, setHeight] = useState(48)
    const [precomputed, setPrecomputed] = useState(false)
    const [peaks, setPeaks] = useState<ComputedPeaks | null>(null)
    const [peaksStatus, setPeaksStatus] = useState("Not computed")

    useEffect(() => {
        if (!precomputed || peaks) return
        const controller = new AbortController()
        setPeaksStatus("Computing from the sample…")
        computePeaksFromUrl(SAMPLE, controller.signal)
            .then((result) => {
                setPeaks(result)
                setPeaksStatus(
                    `${result.peaks[0]?.length ?? 0} buckets × ${result.peaks.length} channel(s), ${result.duration.toFixed(1)} s`
                )
            })
            .catch((error: unknown) => {
                if ((error as Error).name !== "AbortError")
                    setPeaksStatus(`Failed: ${String(error)}`)
            })
        return () => controller.abort()
    }, [precomputed, peaks])

    const tracks = useMemo(
        () => withPeaks(TRACK_SETS[trackSetId].tracks, precomputed ? peaks : null),
        [trackSetId, precomputed, peaks]
    )
    const waveformPlugins = useMemo(() => [createWaveformPlugin({ name: "registry-waveform" })], [])
    const key = `${backend}:${trackSetId}:${precomputed && peaks ? "peaks" : "live"}`

    return (
        <SplitLayout
            stage={
                <>
                    <div className="wk-stage-card">
                        <p className="wk-stage-card__title">
                            Portable AudioPlayer · showWaveform ·{" "}
                            {backend === "webaudio" ? "Web Audio" : "HTML5"}
                        </p>
                        <AudioPlayer
                            key={key}
                            audioBackend={backend}
                            showWaveform
                            waveformHeight={height}
                            tracks={tracks}
                            showTracklist
                            repeatMode="all"
                            accentColor="#F59E0B"
                            progressColor="#F59E0B"
                            trackColor="rgba(245,158,11,0.3)"
                            backgroundColor="rgba(40,30,14,0.6)"
                        />
                        <Note>
                            Expect: the waveform appears once peaks are ready; click or drag to seek
                            (audio seeks on release); ←/→ work on the waveform. The broken track
                            stays a plain bar. On Web Audio the peaks come from the decoded file, so
                            they can appear only after the first play.
                        </Note>
                    </div>
                    <AudioSessionProvider
                        key={`plugin:${key}`}
                        initialQueue={tracks}
                        audioBackend={backend}
                        plugins={waveformPlugins}
                    >
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                FullCardPlayer with the Waveform plugin
                            </p>
                            <FullCardPlayer {...SEA_THEME} />
                            <Note>
                                The plugin adds a Show Waveform switch to this face's “…”
                                controller.
                            </Note>
                        </div>
                    </AudioSessionProvider>
                </>
            }
            controls={
                <>
                    <Panel title="Source of peaks" hint="Changing these reloads the players.">
                        <Segmented
                            label="Backend"
                            value={backend}
                            options={[
                                { value: "html5", label: "HTML5 (fetch + decode)" },
                                { value: "webaudio", label: "Web Audio (decoded)" },
                            ]}
                            onChange={setBackend}
                        />
                        <SelectField
                            label="Tracks"
                            value={trackSetId}
                            options={[
                                { value: "sample", label: TRACK_SETS.sample.label },
                                { value: "no-luck", label: TRACK_SETS["no-luck"].label },
                                { value: "long", label: TRACK_SETS.long.label },
                            ]}
                            onChange={setTrackSet}
                        />
                        {trackSetId === "no-luck" && (
                            <Note tone="placeholder">
                                The No Luck host does not allow cross-site decoding, so on HTML5
                                these tracks fall back to the plain progress bar. On Web Audio they
                                cannot load at all for the same reason.
                            </Note>
                        )}
                        <Switch
                            label="Precomputed peaks"
                            hint="Attach peaks to the sample tracks so they draw instantly"
                            checked={precomputed}
                            onChange={setPrecomputed}
                        />
                        <Readout rows={[["Precomputed peaks", peaksStatus]]} />
                    </Panel>
                    <Panel title="Appearance">
                        <RangeField
                            label="Waveform height"
                            value={height}
                            min={24}
                            max={120}
                            step={4}
                            unit="px"
                            onChange={setHeight}
                        />
                    </Panel>
                </>
            }
        />
    )
}
