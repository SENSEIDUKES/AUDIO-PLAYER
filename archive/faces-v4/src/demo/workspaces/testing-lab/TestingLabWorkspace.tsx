import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ExternalLink, RotateCcw } from "lucide-react"
import { TRACK_SET_OPTIONS } from "../../data"
import { handleLinkClick, navigate, workspaceHref } from "../../workshop/routing"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    Segmented,
    SelectField,
    SplitLayout,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import { STRESS_LABELS, isFrameMessage, postToFrame } from "./bridge"
import type { FrameStatus, SessionStatus, StressAction, StressResult } from "./bridge"
import {
    CONTEXTS,
    MAIN_FACE_LABELS,
    MATRIX_WIDTHS,
    PLUGIN_LABELS,
    SCENARIO_LABELS,
    SCENARIO_PRESETS,
    VIEWPORTS,
    frameSrc,
    normalizeLabConfig,
    parseLabConfig,
    serializeLabConfig,
} from "./labConfig"
import type { ContextId, LabConfig, LabPluginId, Scenario, ViewportId } from "./labConfig"

/* The Mix & Match Lab. Every preview is a real page in an <iframe>, so a 375px
   preview is a 375px viewport: phone layouts, pinned bars, and the controller
   sheet behave as they would on the device. The lab's whole state lives in the
   URL, and each preview reports overflow, engines, and errors from inside. */

interface FrameSpec {
    fid: string
    width: number | null
    height: number
    label: string
}

interface ManualCheck {
    id: string
    text: string
}

const SCENARIO_CHECKS: Record<Scenario, readonly ManualCheck[]> = {
    free: [
        {
            id: "mix",
            text: "Place faces, switch the viewport, and combine features freely. The automatic readouts stay live.",
        },
    ],
    mobile: [
        {
            id: "overflow",
            text: "No horizontal overflow at 320, 375, 390, and 430 (see the automatic readout, or use Matrix).",
        },
        {
            id: "sheet",
            text: "Open a face's “…” controller: the sheet covers the viewport cleanly and never clips.",
        },
        {
            id: "truncate",
            text: "Long titles truncate with an ellipsis instead of pushing controls off-screen.",
        },
        { id: "targets", text: "Tap targets feel comfortable (about 44px) and nothing overlaps." },
        { id: "nav", text: "Below 768px the sidebar hides and the bottom navigation appears." },
        {
            id: "safe",
            text: "On a real phone, the bottom bar clears the home indicator (open the preview on its own).",
        },
    ],
    errors: [
        {
            id: "broken",
            text: "Broken URL: red error banner with Retry; play disabled; progress empty.",
        },
        {
            id: "empty",
            text: "Empty source: “Audio file missing” warning; scrub, mute, and skip disabled.",
        },
        {
            id: "mixed",
            text: "Mixed playlist: switching tracks resets time; only “Signal Lost” shows the error.",
        },
        {
            id: "fallback",
            text: "Fallback recovery: the broken primary falls through and the sample plays.",
        },
        {
            id: "skip",
            text: "Skip policy: play the dead track and the session advances on its own.",
        },
    ],
    stress: [
        {
            id: "toggle",
            text: "Play / pause: tap quickly 10+ times; the icon never desyncs from the audio (or run Play/pause ×20).",
        },
        {
            id: "scrub",
            text: "Scrub: drag across the bar, then click both ends; time updates on release.",
        },
        {
            id: "skip",
            text: "Skip ±10 s: mash both; time stays in bounds and never shows NaN (or run Seek ×30).",
        },
        {
            id: "volume",
            text: "Volume / mute: slide to 0, mute, unmute, drag back up; the level restores (or run the sweep).",
        },
        {
            id: "keys",
            text: "Keyboard: focus a player and press Space, J, K, L, N, P; nothing fires while a button has focus.",
        },
        {
            id: "share",
            text: "Controller / share: open “…”, toggle lyrics, tap Share; the “copied” badge clears after 2 s.",
        },
    ],
    playback: [
        { id: "idle", text: "Initial load: no spinner on the play button while idle." },
        {
            id: "spinner",
            text: "Tap play/pause repeatedly: a spinner appears only during a real load while playing.",
        },
        { id: "end", text: "Let a track end: the spinner clears and the next track starts." },
        { id: "paused-skip", text: "Next / previous while paused: no fake spinner." },
        { id: "repeat", text: "Seek forward and back; repeat all wraps to the first track." },
        {
            id: "automix",
            text: "Automix on: near the end, exactly one advance and volume restored after the crossfade.",
        },
        { id: "backend", text: "Switch the backend: identical controls on HTML5 and Web Audio." },
    ],
}

/* ----------------------------- URL state ----------------------------- */

function subscribe(onChange: () => void) {
    window.addEventListener("popstate", onChange)
    window.addEventListener("sap-workshop:navigate", onChange)
    return () => {
        window.removeEventListener("popstate", onChange)
        window.removeEventListener("sap-workshop:navigate", onChange)
    }
}

function useLabConfig(): [LabConfig, (next: LabConfig) => void] {
    const search = useSyncExternalStore(
        subscribe,
        () => window.location.search,
        () => ""
    )
    const config = useMemo(() => parseLabConfig(new URLSearchParams(search)), [search])
    const setConfig = useCallback((next: LabConfig) => {
        const params = serializeLabConfig(normalizeLabConfig(next))
        const query = params.toString()
        navigate(`?workspace=testing-lab${query ? `&${query}` : ""}`, { replace: true })
    }, [])
    return [config, setConfig]
}

/* ----------------------------- Device frames ----------------------------- */

function framesFor(config: LabConfig): FrameSpec[] {
    if (config.viewport === "matrix") {
        return MATRIX_WIDTHS.map((width) => ({
            fid: `w${width}`,
            width,
            height: 667,
            label: `${width} × 667`,
        }))
    }
    const preset = VIEWPORTS.find((v) => v.id === config.viewport) ?? VIEWPORTS[0]
    return [
        {
            fid: "main",
            width: preset.width,
            height: preset.height,
            label: preset.width ? `${preset.width} × ${preset.height}` : `Fill × ${preset.height}`,
        },
    ]
}

function useContainerWidth() {
    const ref = useRef<HTMLDivElement | null>(null)
    const [width, setWidth] = useState(0)
    useEffect(() => {
        const element = ref.current
        if (!element) return
        setWidth(element.clientWidth)
        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => setWidth(element.clientWidth))
        observer.observe(element)
        return () => observer.disconnect()
    }, [])
    return { ref, width }
}

function DeviceFrame({
    spec,
    src,
    scale,
    fillWidth,
    status,
    register,
}: {
    spec: FrameSpec
    src: string
    scale: number
    fillWidth: number
    status?: FrameStatus
    register: (fid: string, element: HTMLIFrameElement | null) => void
}) {
    const width = spec.width ?? Math.max(320, fillWidth)
    const overflow = status ? status.overflowPx : null
    return (
        <figure className="wk-device">
            <figcaption className="wk-device__label">
                <span>{spec.width ? spec.label : `${Math.round(width)} × ${spec.height}`}</span>
                {overflow !== null && (
                    <span
                        className={`wk-device__flag wk-device__flag--${overflow === 0 ? "ok" : "bad"}`}
                    >
                        {overflow === 0 ? "No overflow" : `Overflow ${overflow}px`}
                    </span>
                )}
            </figcaption>
            <div
                className="wk-device__viewport"
                style={{ width: width * scale, height: spec.height * scale }}
            >
                <iframe
                    ref={(element) => register(spec.fid, element)}
                    title={`Testing Lab preview ${spec.label}`}
                    src={src}
                    allow="autoplay; clipboard-write"
                    style={{
                        width,
                        height: spec.height,
                        transform: scale === 1 ? undefined : `scale(${scale})`,
                        transformOrigin: "0 0",
                    }}
                />
            </div>
        </figure>
    )
}

/* ----------------------------- Readouts ----------------------------- */

function AutoChecks({
    frames,
    statuses,
    sessions,
    scenario,
}: {
    frames: FrameSpec[]
    statuses: Record<string, FrameStatus>
    sessions: Record<string, SessionStatus | null>
    scenario: Scenario
}) {
    const totalPlaying = frames.reduce((sum, frame) => sum + (statuses[frame.fid]?.playing ?? 0), 0)
    return (
        <div className="wk-table-wrap">
            <table className="wk-table">
                <thead>
                    <tr>
                        <th scope="col">Preview</th>
                        <th scope="col">Overflow</th>
                        <th scope="col">Engines</th>
                        <th scope="col">Errors shown</th>
                        <th scope="col">Session</th>
                    </tr>
                </thead>
                <tbody>
                    {frames.map((frame) => {
                        const status = statuses[frame.fid]
                        const session = sessions[frame.fid]
                        if (!status) {
                            return (
                                <tr key={frame.fid}>
                                    <td>{frame.label}</td>
                                    <td colSpan={4}>Loading…</td>
                                </tr>
                            )
                        }
                        return (
                            <tr key={frame.fid}>
                                <td>
                                    {status.width} × {status.height}
                                </td>
                                <td>
                                    <span
                                        className={`wk-dot wk-dot--${status.overflowPx === 0 ? "ok" : "error"}`}
                                        aria-hidden="true"
                                    />
                                    {status.overflowPx === 0
                                        ? "None"
                                        : `${status.overflowPx}px · ${status.overflowTarget}`}
                                </td>
                                <td>
                                    <span
                                        className={`wk-dot wk-dot--${status.playing <= 1 ? "ok" : "error"}`}
                                        aria-hidden="true"
                                    />
                                    {status.engines} on page · {status.playing} playing
                                </td>
                                <td>
                                    <span
                                        className={`wk-dot wk-dot--${
                                            scenario === "errors"
                                                ? status.errors > 0
                                                    ? "ok"
                                                    : "warn"
                                                : status.errors === 0
                                                  ? "ok"
                                                  : "warn"
                                        }`}
                                        aria-hidden="true"
                                    />
                                    {status.errors}
                                </td>
                                <td>
                                    {session
                                        ? `${session.state} · ${session.title ?? "—"} · ${session.position} · ${session.queue} · ${session.backend}`
                                        : "No shared session"}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {frames.length > 1 && (
                <p className="wk-panel__hint">
                    <span
                        className={`wk-dot wk-dot--${totalPlaying <= 1 ? "ok" : "error"}`}
                        aria-hidden="true"
                    />
                    Across all previews: {totalPlaying} playing (the lab pauses the others when one
                    starts).
                </p>
            )}
        </div>
    )
}

function StressResults({ results }: { results: StressResult[] }) {
    if (!results.length) return <p className="wk-panel__hint">No stress runs yet.</p>
    return (
        <ul className="wk-inline-list">
            {results.map((result, index) => (
                <li
                    key={`${result.action}-${index}`}
                    className="wk-inline-list__row wk-stress-result"
                >
                    <span className="wk-inline-list__main">
                        <span className="wk-inline-list__title">
                            <span
                                className={`wk-dot wk-dot--${result.passed ? "ok" : "error"}`}
                                aria-hidden="true"
                            />
                            {STRESS_LABELS[result.action]} ·{" "}
                            {result.passed ? "consistent" : "problem found"} ·{" "}
                            {(result.durationMs / 1000).toFixed(1)} s
                        </span>
                        {result.checks.map((line) => (
                            <span key={line} className="wk-inline-list__sub">
                                {line}
                            </span>
                        ))}
                    </span>
                </li>
            ))}
        </ul>
    )
}

/** Where the placed New Face came from, and the way back to keep editing it. */
function NewFaceNote({ config }: { config: LabConfig }) {
    const href = workspaceHref({
        workspace: "new-face",
        params: {
            ...(config.face ? { face: config.face } : {}),
            ...(config.tracks !== "no-luck" ? { tracks: config.tracks } : {}),
        },
    })
    return (
        <Note>
            {config.face
                ? "Showing your composition from Players › New Face. "
                : "There is no composition here yet. Build one in Players › New Face, then place it. "}
            <a
                className="wk-note__link"
                href={href}
                onClick={(event) => handleLinkClick(event, href)}
            >
                {config.face ? "Keep editing in New Face" : "Open New Face"}
            </a>
        </Note>
    )
}

/* ----------------------------- Workspace ----------------------------- */

/** Gap between matrix previews, in px (matches .wk-lab-frames--matrix). */
const MATRIX_GAP = 16

const VIEWPORT_OPTIONS = VIEWPORTS.map((v) => ({ value: v.id, label: v.label }))
const CONTEXT_OPTIONS = (Object.keys(CONTEXTS) as ContextId[]).map((id) => ({
    value: id,
    label: CONTEXTS[id].label,
}))

export function TestingLabWorkspace() {
    const [config, setConfig] = useLabConfig()
    const [fit, setFit] = useState(true)
    const [reloadToken, setReloadToken] = useState(0)
    const [statuses, setStatuses] = useState<Record<string, FrameStatus>>({})
    const [sessions, setSessions] = useState<Record<string, SessionStatus | null>>({})
    const [results, setResults] = useState<StressResult[]>([])
    const [checked, setChecked] = useState<Record<string, boolean>>({})
    const { lines, append, clear } = useEventLog(80)
    const framesRef = useRef(new Map<string, HTMLIFrameElement>())
    const { ref: stageRef, width: stageWidth } = useContainerWidth()

    const frames = framesFor(config)
    const context = CONTEXTS[config.context]
    const update = (patch: Partial<LabConfig>) => setConfig({ ...config, ...patch })

    const register = useCallback((fid: string, element: HTMLIFrameElement | null) => {
        if (element) framesRef.current.set(fid, element)
        else framesRef.current.delete(fid)
    }, [])

    // Frame-specific state resets whenever the previews reload.
    const previewKey = frameSrc(config, "key", reloadToken)
    useEffect(() => {
        setStatuses({})
        setSessions({})
    }, [previewKey])

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || !isFrameMessage(event.data)) return
            const frame = framesRef.current.get(event.data.fid)
            if (!frame || event.source !== frame.contentWindow) return
            const message = event.data
            switch (message.type) {
                case "status":
                    setStatuses((prev) => ({ ...prev, [message.fid]: message.status }))
                    break
                case "session":
                    setSessions((prev) => ({ ...prev, [message.fid]: message.session }))
                    break
                case "playing": {
                    let paused = 0
                    framesRef.current.forEach((other, fid) => {
                        if (fid === message.fid) return
                        postToFrame(other, { type: "pause-all" })
                        paused += 1
                    })
                    if (paused) append(`Preview ${message.fid} started; paused the other ${paused}`)
                    break
                }
                case "log":
                    append(message.text, message.tone)
                    break
                case "stress-result":
                    setResults((prev) => [message.result, ...prev].slice(0, 8))
                    append(
                        `${STRESS_LABELS[message.result.action]}: ${message.result.passed ? "consistent" : "problem found"}`,
                        message.result.passed ? "ok" : "error"
                    )
                    break
            }
        }
        window.addEventListener("message", onMessage)
        return () => window.removeEventListener("message", onMessage)
    }, [append])

    const runStress = (action: StressAction) => {
        const target = framesRef.current.get(frames[0].fid) ?? null
        postToFrame(target, { type: "stress", action })
    }

    // Gaps between matrix previews are not scaled, so fit only the frames.
    const gaps = config.viewport === "matrix" ? MATRIX_GAP * (MATRIX_WIDTHS.length - 1) : 0
    const framesWidth =
        config.viewport === "matrix"
            ? MATRIX_WIDTHS.reduce((sum, w) => sum + w, 0)
            : (frames[0].width ?? stageWidth)
    const available = stageWidth - gaps
    const scale = fit && available > 0 && framesWidth > available ? available / framesWidth : 1
    const soloHref = frameSrc(config, "solo")

    return (
        <SplitLayout
            stageLabel="Device previews"
            stage={
                <>
                    <div className="wk-lab-stage" ref={stageRef}>
                        <div className="wk-lab-stage__head">
                            <p className="wk-stage-card__title">
                                {context.label}
                                {context.mains.length ? ` · ${MAIN_FACE_LABELS[config.main]}` : ""}
                                {scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}
                            </p>
                            <div className="wk-btn-row">
                                <Button
                                    onClick={() => setReloadToken((t) => t + 1)}
                                    label="Reload the preview"
                                >
                                    <RotateCcw size={14} /> Reload
                                </Button>
                                <a
                                    className="wk-btn"
                                    href={soloHref}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink size={14} /> Open on its own
                                </a>
                            </div>
                        </div>
                        <div
                            className={`wk-lab-frames${frames.length > 1 ? " wk-lab-frames--matrix" : ""}`}
                        >
                            {frames.map((spec) => (
                                <DeviceFrame
                                    key={`${spec.fid}:${previewKey}`}
                                    spec={spec}
                                    src={frameSrc(config, spec.fid, reloadToken)}
                                    scale={scale}
                                    fillWidth={stageWidth}
                                    status={statuses[spec.fid]}
                                    register={register}
                                />
                            ))}
                        </div>
                    </div>
                    <Panel
                        title="Automatic checks"
                        hint="Measured inside each preview, every second."
                    >
                        <AutoChecks
                            frames={frames}
                            statuses={statuses}
                            sessions={sessions}
                            scenario={config.scenario}
                        />
                    </Panel>
                    <Panel
                        title={`${SCENARIO_LABELS[config.scenario]} checklist`}
                        hint="Manual checks. Ticks are for this visit only."
                    >
                        <ul className="wk-inline-list">
                            {SCENARIO_CHECKS[config.scenario].map((item) => {
                                const key = `${config.scenario}:${item.id}`
                                return (
                                    <li key={key} className="wk-inline-list__row">
                                        <label className="wk-check">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(checked[key])}
                                                onChange={(event) =>
                                                    setChecked((prev) => ({
                                                        ...prev,
                                                        [key]: event.target.checked,
                                                    }))
                                                }
                                            />
                                            <span>{item.text}</span>
                                        </label>
                                    </li>
                                )
                            })}
                        </ul>
                    </Panel>
                    <Panel
                        title="Stress runs"
                        hint="Hammer the preview's shared session, let it settle, then verify it still agrees with itself and its audio element."
                    >
                        {config.context === "states" ? (
                            <Note>
                                The error board has no shared session to stress. Pick another
                                context.
                            </Note>
                        ) : (
                            <ButtonRow>
                                {(Object.keys(STRESS_LABELS) as StressAction[]).map((action) => (
                                    <Button key={action} onClick={() => runStress(action)}>
                                        {STRESS_LABELS[action]}
                                    </Button>
                                ))}
                            </ButtonRow>
                        )}
                        <StressResults results={results} />
                    </Panel>
                    <Panel
                        title="Lab log"
                        actions={
                            <Button variant="ghost" onClick={clear}>
                                Clear
                            </Button>
                        }
                    >
                        <EventLog
                            lines={lines}
                            empty="Plugin events, stress runs, and playback hand-offs appear here."
                        />
                    </Panel>
                </>
            }
            controls={
                <>
                    <Panel
                        title="Scenario"
                        hint="A starting point. Every setting below can still be changed."
                    >
                        <Segmented
                            label="Scenario"
                            value={config.scenario}
                            options={(Object.keys(SCENARIO_LABELS) as Scenario[]).map((id) => ({
                                value: id,
                                label: SCENARIO_LABELS[id],
                            }))}
                            onChange={(scenario) => setConfig(SCENARIO_PRESETS[scenario])}
                        />
                    </Panel>
                    <Panel title="Viewport" hint="Real viewports: each preview is its own page.">
                        <Segmented
                            label="Device width"
                            value={config.viewport}
                            options={VIEWPORT_OPTIONS}
                            onChange={(viewport: ViewportId) => update({ viewport })}
                        />
                        <Switch
                            label="Fit to the stage"
                            hint="Scale wide devices down to fit"
                            checked={fit}
                            onChange={setFit}
                        />
                    </Panel>
                    <Panel title="Context">
                        <SelectField
                            label="Where the players live"
                            value={config.context}
                            options={CONTEXT_OPTIONS}
                            onChange={(value) => update({ context: value })}
                        />
                        <Note>{context.description}</Note>
                    </Panel>
                    {config.context !== "states" && (
                        <Panel title="Players">
                            {context.mains.length > 0 && (
                                <SelectField
                                    label="Main area"
                                    value={config.main}
                                    options={context.mains.map((face) => ({
                                        value: face,
                                        label: MAIN_FACE_LABELS[face],
                                    }))}
                                    onChange={(value) => update({ main: value })}
                                />
                            )}
                            {config.main === "custom" && <NewFaceNote config={config} />}
                            {context.sidebar && (
                                <Switch
                                    label="MiniSidebarPlayer in the sidebar"
                                    hint="The sidebar shows from 768px wide"
                                    checked={config.sidebar}
                                    onChange={(sidebar) => update({ sidebar })}
                                />
                            )}
                            {context.bar && (
                                <Switch
                                    label="StickyBottomPlayer bar"
                                    checked={config.bar}
                                    onChange={(bar) => update({ bar })}
                                />
                            )}
                            <SelectField
                                label="Tracks"
                                value={config.tracks}
                                options={TRACK_SET_OPTIONS}
                                onChange={(tracks) => update({ tracks })}
                            />
                        </Panel>
                    )}
                    {config.context !== "states" && (
                        <Panel
                            title="Features"
                            hint="Plugins run on the shared session and on the portable player."
                        >
                            {(Object.keys(PLUGIN_LABELS) as LabPluginId[]).map((id) => (
                                <Switch
                                    key={id}
                                    label={PLUGIN_LABELS[id]}
                                    checked={config.plugins.includes(id)}
                                    onChange={(on) =>
                                        update({
                                            plugins: on
                                                ? [...config.plugins, id]
                                                : config.plugins.filter((plugin) => plugin !== id),
                                        })
                                    }
                                />
                            ))}
                            <Switch
                                label="Waveform scrubber"
                                hint="Portable player's showWaveform"
                                checked={config.waveform}
                                onChange={(waveform) => update({ waveform })}
                            />
                            <Switch
                                label="Automix Lite"
                                checked={config.automix}
                                onChange={(automix) => update({ automix })}
                            />
                            <Switch
                                label="Shuffle"
                                checked={config.shuffle}
                                onChange={(shuffle) => update({ shuffle })}
                            />
                            <Segmented
                                label="Repeat"
                                value={config.repeat}
                                options={[
                                    { value: "off", label: "Off" },
                                    { value: "all", label: "All" },
                                    { value: "one", label: "One" },
                                ]}
                                onChange={(repeat) => update({ repeat })}
                            />
                            <Segmented
                                label="Backend"
                                value={config.backend}
                                options={[
                                    { value: "html5", label: "HTML5" },
                                    { value: "webaudio", label: "Web Audio" },
                                ]}
                                onChange={(backend) => update({ backend })}
                            />
                            <Segmented
                                label="When a track fails"
                                value={config.policy}
                                options={[
                                    { value: "stop", label: "Stop" },
                                    { value: "skip", label: "Skip" },
                                ]}
                                onChange={(policy) => update({ policy })}
                            />
                        </Panel>
                    )}
                    <Panel title="Theme">
                        <Segmented
                            label="Theme"
                            value={config.theme}
                            options={[
                                { value: "purple", label: "SEI Purple" },
                                { value: "green", label: "Neon Green" },
                                { value: "glass", label: "OG Glass" },
                                { value: "red", label: "Error Red" },
                            ]}
                            onChange={(theme) => update({ theme })}
                        />
                    </Panel>
                    <Note>
                        Changing a setting reloads the preview, which stops whatever it was playing.
                        Changing only the viewport keeps playback going.
                    </Note>
                </>
            }
        />
    )
}
