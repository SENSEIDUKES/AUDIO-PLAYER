import { useState, useEffect, useRef } from "react"
import { useAudioSession } from "../../session/AudioSessionContext"
import type { Track } from "../../types"
import { SpinnerIcon, ErrorIcon, AgentIcon } from "../../skins/icons"
import { ensureProTrackAnalysis } from "../../automix/trackAnalysis"
import {
    toAgentScoutAudioEvidence,
    type AgentScoutMessage,
    type AgentScoutRequest,
    type AgentScoutResponse,
    type AgentScoutVariant,
} from "./agentScoutContract"

/* The agent workspaces the Vault arc's Agent branch routes into. Each variant is
   a real SAP Controller destination (the arc never routes anywhere else), sharing
   one surface parameterized by agent. Audio is decoded and measured locally;
   only bounded evidence and track text go through the same-origin server API. */

export type { AgentScoutVariant } from "./agentScoutContract"

const AGENT_COPY: Record<AgentScoutVariant, { lead: string; sub: string; actionLabel: string }> = {
    "demo-scout": {
        lead: "Demo Scout",
        sub: "Measures the decoded demo audio, waveform, rhythm, metadata, and lyrics to help prioritize what to finish.",
        actionLabel: "Analyze Demo Audio",
    },
    "studio-scout": {
        lead: "Studio Scout",
        sub: "Reviews decoded level, dynamics, stereo, waveform, and rhythm measurements. Requires the Studio entitlement.",
        actionLabel: "Analyze Studio Audio",
    },
    memoir: {
        lead: "Memoir",
        sub: "Builds an evidence-grounded portrait from the track audio, lyrics, metadata, and available vault context.",
        actionLabel: "Analyze Track Story",
    },
}

const safeSessionStorage = {
    getItem(key: string): string | null {
        try {
            return sessionStorage.getItem(key)
        } catch {
            return null
        }
    },
    setItem(key: string, value: string): void {
        try {
            sessionStorage.setItem(key, value)
        } catch (err) {
            console.warn("sessionStorage setItem failed:", err)
        }
    },
    removeItem(key: string): void {
        try {
            sessionStorage.removeItem(key)
        } catch {
            // Storage is optional (private mode and embedded hosts can deny it).
        }
    },
}

type LoadingPhase = "analyzing" | "consulting"

function trackForAudioAnalysis(track: Track, currentSource: string): Track {
    if (!currentSource.trim()) return track
    // Omit the source track's id so the actual resolved URL participates in the
    // analysis cache key. A fallback or refreshed signed URL must not reuse
    // measurements from a different audio object.
    return {
        title: track.title,
        artist: track.artist,
        audioFile: currentSource,
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Agent Scout could not complete the request."
}

function readStoredMessages(storageKey: string): AgentScoutMessage[] {
    const saved = safeSessionStorage.getItem(storageKey)
    if (!saved) return []
    try {
        const parsed: unknown = JSON.parse(saved)
        if (
            Array.isArray(parsed) &&
            parsed.every(
                (message) =>
                    message &&
                    typeof message === "object" &&
                    (message.role === "user" || message.role === "assistant") &&
                    typeof message.content === "string"
            )
        ) {
            return parsed as AgentScoutMessage[]
        }
    } catch {
        // Ignore corrupt or stale chat state.
    }
    return []
}

function renderTextWithInlineStyles(text: string) {
    // Parse bold (**text**) safely without using dangerouslySetInnerHTML.
    // We split by the bold markers and alternate between text and <strong>.
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return part
    })
}

function formatMessageContent(text: string) {
    const blocks = text.split(/\n\n+/)

    return blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        if (trimmed.startsWith("###")) {
            return <h3 key={i}>{trimmed.replace(/^###\s*/, "")}</h3>
        }
        if (trimmed.startsWith("##")) {
            return <h2 key={i}>{trimmed.replace(/^##\s*/, "")}</h2>
        }
        if (trimmed.startsWith("#")) {
            return <h1 key={i}>{trimmed.replace(/^#\s*/, "")}</h1>
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const items = trimmed.split(/\n[-*]\s+/)
            return (
                <ul key={i}>
                    {items.map((item, j) => (
                        <li key={j}>{renderTextWithInlineStyles(item.replace(/^[-*]\s+/, ""))}</li>
                    ))}
                </ul>
            )
        }

        return <p key={i}>{renderTextWithInlineStyles(trimmed)}</p>
    })
}

export function AgentScoutWorkspace({ variant }: { variant: AgentScoutVariant }) {
    const copy = AGENT_COPY[variant]
    const session = useAudioSession()
    const { currentTrack, queue } = session

    const trackId = currentTrack?.id || currentTrack?.title || "none"
    const storageKey = `sap-agent-chat:${variant}:${trackId}`

    const [messages, setMessages] = useState<AgentScoutMessage[]>(() =>
        readStoredMessages(storageKey)
    )

    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [loadingPhase, setLoadingPhase] = useState<LoadingPhase | null>(null)
    const [error, setError] = useState<string | null>(null)

    const chatEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const requestGenerationRef = useRef(0)

    useEffect(() => {
        return () => {
            requestGenerationRef.current = Number.MAX_SAFE_INTEGER
            abortControllerRef.current?.abort()
        }
    }, [])

    useEffect(() => {
        requestGenerationRef.current++
        abortControllerRef.current?.abort()
        setLoading(false)
        setLoadingPhase(null)
        setInput("")
        setError(null)
        setMessages(readStoredMessages(storageKey))
    }, [storageKey])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, loading])

    if (!copy) return null

    const handleSendMessage = async (textToSend: string) => {
        const trimmedMessage = textToSend.trim()
        const track = currentTrack
        if (!trimmedMessage || loading || !track) return

        const requestGeneration = ++requestGenerationRef.current
        setInput("")
        setLoading(true)
        setLoadingPhase("analyzing")
        setError(null)

        abortControllerRef.current?.abort()
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        try {
            const analysis = await ensureProTrackAnalysis(
                trackForAudioAnalysis(track, session.currentSrc ?? "")
            )
            if (requestGeneration !== requestGenerationRef.current) return

            const audio = toAgentScoutAudioEvidence(analysis)
            if (!audio) {
                throw new Error(
                    "Scout couldn't decode and measure this audio track. Check that its source allows browser access and is within the 30 MB / 15 minute analysis limits."
                )
            }

            const newMessages: AgentScoutMessage[] = [
                ...messages,
                { role: "user", content: trimmedMessage },
            ]
            setMessages(newMessages)
            safeSessionStorage.setItem(storageKey, JSON.stringify(newMessages))
            setLoadingPhase("consulting")

            const requestBody: AgentScoutRequest = {
                variant,
                track: {
                    title: track.title,
                    artist: track.artist,
                    ...(track.albumTitle ? { albumTitle: track.albumTitle } : {}),
                    ...(track.vaultCategory ? { vaultCategory: String(track.vaultCategory) } : {}),
                    ...(track.lyrics ? { lyrics: track.lyrics } : {}),
                },
                queue: queue.slice(0, 20).map((queuedTrack) => ({
                    title: queuedTrack.title,
                    artist: queuedTrack.artist,
                })),
                audio,
                messages: newMessages.slice(-12),
            }

            const response = await fetch("/api/agent-scout", {
                method: "POST",
                signal: abortController.signal,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as {
                    error?: unknown
                }
                throw new Error(
                    typeof errorData.error === "string"
                        ? errorData.error
                        : `Agent Scout request failed (HTTP ${response.status}).`
                )
            }

            const data = (await response.json()) as Partial<AgentScoutResponse>
            const assistantContent = data.content

            if (typeof assistantContent !== "string" || !assistantContent.trim()) {
                throw new Error("Agent Scout returned an empty response.")
            }

            if (requestGeneration !== requestGenerationRef.current) return
            const updatedMessages: AgentScoutMessage[] = [
                ...newMessages,
                { role: "assistant", content: assistantContent.trim() },
            ]
            setMessages(updatedMessages)
            safeSessionStorage.setItem(storageKey, JSON.stringify(updatedMessages))
        } catch (caught) {
            if (
                (caught instanceof DOMException && caught.name === "AbortError") ||
                (caught instanceof Error && caught.name === "AbortError")
            ) {
                return
            }
            if (requestGeneration !== requestGenerationRef.current) return
            console.error("Agent Scout request failed:", caught)
            setError(errorMessage(caught))
        } finally {
            if (requestGeneration === requestGenerationRef.current) {
                setLoading(false)
                setLoadingPhase(null)
            }
        }
    }

    const startInitialAnalysis = () => {
        const initialPrompt =
            variant === "demo-scout"
                ? "Use the decoded audio measurements and track context to assess whether this demo is worth finishing next."
                : variant === "studio-scout"
                  ? "Review the decoded level, dynamics, stereo, waveform, and rhythm measurements for this track."
                  : "Create an evidence-grounded portrait of this track without inventing unavailable history."
        void handleSendMessage(initialPrompt)
    }

    const clearChat = () => {
        if (
            typeof window !== "undefined" &&
            window.confirm("Are you sure you want to reset the chat?")
        ) {
            setMessages([])
            safeSessionStorage.removeItem(storageKey)
            setError(null)
        }
    }

    return (
        <div className="sap-ctl__agent-workspace" data-agent={variant}>
            {currentTrack && (
                <div className="sap-ctl__agent-track-badge">
                    <span className="sap-ctl__agent-track-title">{currentTrack.title}</span>
                    <span className="sap-ctl__agent-track-artist">by {currentTrack.artist}</span>
                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={clearChat}
                            className="sap-ctl__value ap-tap"
                            style={{
                                marginLeft: "auto",
                                background: "none",
                                border: "none",
                                color: "inherit",
                                cursor: "pointer",
                                opacity: 0.5,
                                fontSize: "11px",
                            }}
                        >
                            Reset Chat
                        </button>
                    )}
                </div>
            )}

            {messages.length === 0 ? (
                <div className="sap-ctl__agent-intro">
                    <div className="sap-ctl__agent-intro-icon">
                        <AgentIcon />
                    </div>
                    <div>
                        <p className="sap-ctl__workspace-lead">{copy.lead}</p>
                        <p className="sap-ctl__workspace-sub">{copy.sub}</p>
                    </div>
                    <button
                        type="button"
                        onClick={startInitialAnalysis}
                        disabled={!currentTrack || loading}
                        className="sap-ctl__agent-btn-primary ap-tap"
                    >
                        {loadingPhase === "analyzing"
                            ? "Analyzing audio..."
                            : loadingPhase === "consulting"
                              ? "Reviewing measurements..."
                              : copy.actionLabel}
                    </button>
                    <p className="sap-ctl__workspace-sub">
                        Scout downloads and decodes the active audio in this browser, then sends a
                        compact measurement report—not the audio file—to the server-side agent.
                    </p>
                    {error && (
                        <p
                            role="alert"
                            style={{
                                color: "#ef4444",
                                fontSize: "12px",
                                marginTop: "12px",
                                opacity: 0.8,
                            }}
                        >
                            {error}
                        </p>
                    )}
                </div>
            ) : (
                <div className="sap-ctl__agent-chat">
                    <div className="sap-ctl__agent-history">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`sap-ctl__agent-msg sap-ctl__agent-msg--${msg.role}`}
                            >
                                <div className="sap-ctl__agent-msg-content">
                                    {formatMessageContent(msg.content)}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="sap-ctl__agent-loading-container">
                                <div className="sap-ctl__agent-loading-wave" aria-hidden="true">
                                    <span className="sap-ctl__agent-loading-bar" />
                                    <span className="sap-ctl__agent-loading-bar" />
                                    <span className="sap-ctl__agent-loading-bar" />
                                    <span className="sap-ctl__agent-loading-bar" />
                                </div>
                                <span>
                                    {loadingPhase === "analyzing"
                                        ? "Analyzing decoded audio..."
                                        : "Reviewing measured evidence..."}
                                </span>
                            </div>
                        )}

                        {error && (
                            <div
                                className="sap-ctl__agent-loading-container"
                                style={{ color: "#ef4444" }}
                            >
                                <ErrorIcon />
                                <span>{error}</span>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            void handleSendMessage(input)
                        }}
                        className="sap-ctl__agent-input-form"
                    >
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (
                                    e.key === "Enter" &&
                                    !e.shiftKey &&
                                    !e.nativeEvent.isComposing
                                ) {
                                    e.preventDefault()
                                    void handleSendMessage(input)
                                }
                            }}
                            placeholder="Ask follow-up questions..."
                            aria-label="Ask follow-up questions"
                            className="sap-ctl__agent-input"
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="sap-ctl__agent-send-btn ap-tap"
                            aria-label={loading ? "Sending message" : "Send message"}
                        >
                            {loading ? <SpinnerIcon /> : "Send"}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}

export default AgentScoutWorkspace
