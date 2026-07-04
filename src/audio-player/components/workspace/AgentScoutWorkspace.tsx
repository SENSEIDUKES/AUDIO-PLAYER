import { useState, useEffect, useRef } from "react"
import { useAudioSession } from "../../session/AudioSessionContext"
import type { Track } from "../../types"
import { SpinnerIcon, ErrorIcon, AgentIcon } from "../../skins/icons"

/* The agent workspaces the Vault arc's Agent branch routes into. Each variant is
   a real SAP Controller destination (the arc never routes anywhere else), sharing
   one surface parameterized by agent. We now connect this surface to OpenRouter
   using custom presets and API keys. */

export type AgentScoutVariant = "demo-scout" | "studio-scout" | "memoir"

const AGENT_COPY: Record<AgentScoutVariant, { lead: string; sub: string; actionLabel: string }> = {
    "demo-scout": {
        lead: "Demo Scout",
        sub: "Scans your demos and surfaces the ones worth finishing next.",
        actionLabel: "Analyze Demo Track",
    },
    "studio-scout": {
        lead: "Studio Scout",
        sub: "Pro session analysis for studio-ready tracks. Requires the Studio entitlement.",
        actionLabel: "Analyze Studio Session",
    },
    memoir: {
        lead: "Memoir",
        sub: "Builds a narrated history of a track from its vault versions.",
        actionLabel: "Generate Song Memoir",
    },
}

interface Message {
    role: "user" | "assistant"
    content: string
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
        } catch {}
    }
}

const KEY_NAME = "VITE_OPENROUTER_API_KEY";

const getApiKey = (): string => {
    return (
        (typeof window !== "undefined" && (window as any)[KEY_NAME]) ||
        (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.[KEY_NAME]) ||
        ""
    );
};

const PRESET_KEYS = {
    "demo-scout": "VITE_PRESET_DEMO_SCOUT",
    "studio-scout": "VITE_PRESET_STUDIO_SCOUT",
    "memoir": "VITE_PRESET_MEMOIR",
};

const getPresetValue = (v: AgentScoutVariant): string => {
    const key = PRESET_KEYS[v];
    const fallback =
        v === "demo-scout"
            ? "@preset/sea-demo-scout-dev"
            : v === "studio-scout"
            ? "@preset/sea-studio-scout-dev"
            : "@preset/sea-demo-memoir-dev";
    return (
        (typeof window !== "undefined" && (window as any)[key]) ||
        (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.[key]) ||
        fallback
    );
};

const getSystemPrompt = (variant: AgentScoutVariant, track: Track | null, queue: Track[]) => {
    const trackDetails = track
        ? `Title: ${track.title}
Artist: ${track.artist}
Album: ${track.albumTitle || "N/A"}
Category/Status: ${track.vaultCategory || "N/A"}
Lyrics: ${track.lyrics || "No lyrics available for this track."}`
        : "No active track selected."

    if (variant === "demo-scout") {
        return `You are Demo Scout, the custom audio-analysis agent for SEIHouse. Your persona is a discerning, creative, and professional music producer and A&R scout. Your goal is to scan user's demo tracks and surface creative ideas, arrangement thoughts, and a recommendation on whether a demo is worth finishing.

Current Track Context:
${trackDetails}

Guidelines:
1. Be encouraging but honest and precise in your technical and creative feedback.
2. Structure your response with clear sections:
   - **Vibe & Concept Assessment**: Discuss the emotional core and potential of the demo.
   - **Structure & Arrangement**: Highlight what works and what feels clunky.
   - **Production Recommendations**: Offer 3 actionable changes (e.g., sound selection, transition fx, vocals).
   - **Finishing Score**: Provide a completion score (1-10) and brief rationale on whether it's worth finishing next.
Keep responses concise, premium, and focused on music production.`
    } else if (variant === "studio-scout") {
        return `You are Studio Scout, the professional mixing and mastering session agent for SEIHouse. Your persona is a senior mixing/mastering engineer with decades of studio experience. Your goal is to review studio-ready tracks and provide pro technical session advice.

Current Track Context:
${trackDetails}

Guidelines:
1. Provide highly technical and actionable mixing, arrangement, and mastering feedback.
2. Structure your response with clear sections:
   - **Technical Mix Assessment**: Frequency balance, dynamic range, and vocal/instrument leveling.
   - **Transition & Impact Review**: Pacing, drops, automation, and spatial imaging.
   - **Commercial/Streaming Readiness**: Loudness, stereo width, and overall sonic competitiveness.
   - **Action Checklist**: A checklist of 3 immediate studio adjustments to perform.
Keep responses technical, precise, and professional.`
    } else {
        const queueContext = queue.map((t) => `- ${t.title} by ${t.artist}`).join("\n")
        return `You are Memoir, the archival/evolution agent for SEIHouse. Your goal is to build a narrated history of a track from its vault versions, synthesizing an engaging narrative about its creative journey.

Current Track Context:
${trackDetails}

Other tracks in the Vault queue for context:
${queueContext}

Guidelines:
1. Write a beautiful, narrated story of the track's evolution. Treat it like a documentary or liner notes of a legendary release.
2. Structure your response with clear sections:
   - **The Origin / Spark**: Fictionalized or metadata-driven origin of the song's concept.
   - **Evolutionary Arc**: How it progressed from draft to the active master/vault version.
   - **Lyrical & Sonic Growth**: Interpretation of the song's message and how the audio supports it.
   - **Archival Significance**: Where this track fits in the artist's legacy.
Keep the style poetic, storytelling-focused, and highly artistic.`
    }
}

function parseInlineStyles(text: string): string {
    // Parse bold (**text**) safely
    return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
}

function formatMessageContent(text: string) {
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    const blocks = escaped.split(/\n\n+/)

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
                        <li key={j} dangerouslySetInnerHTML={{ __html: parseInlineStyles(item.replace(/^[-*]\s+/, "")) }} />
                    ))}
                </ul>
            )
        }

        return <p key={i} dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed) }} />
    })
}

export function AgentScoutWorkspace({ variant }: { variant: AgentScoutVariant }) {
    const copy = AGENT_COPY[variant]
    const session = useAudioSession()
    const { currentTrack, queue } = session

    const trackId = currentTrack?.id || currentTrack?.title || "none"
    const storageKey = `sap-agent-chat:${variant}:${trackId}`

    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = safeSessionStorage.getItem(storageKey)
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {}
        }
        return []
    })

    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const chatEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort()
        }
    }, [])

    useEffect(() => {
        const saved = safeSessionStorage.getItem(storageKey)
        if (saved) {
            try {
                setMessages(JSON.parse(saved))
                setError(null)
                return
            } catch {}
        }
        setMessages([])
    }, [storageKey])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, loading])

    if (!copy) return null

    const handleSendMessage = async (textToSend: string) => {
        if (!textToSend.trim() || loading) return

        const apiKey = getApiKey()
        if (!apiKey) {
            setError("OpenRouter API key is missing. Please configure VITE_OPENROUTER_API_KEY in your .env.local file.")
            return
        }

        const newMessages = [...messages, { role: "user" as const, content: textToSend }]
        setMessages(newMessages)
        safeSessionStorage.setItem(storageKey, JSON.stringify(newMessages))
        setInput("")
        setLoading(true)
        setError(null)

        abortControllerRef.current?.abort()
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        try {
            const presetModel = getPresetValue(variant)
            const systemPrompt = getSystemPrompt(variant, currentTrack, queue)

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                signal: abortController.signal,
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://sap.seaportal.world",
                    "X-Title": "SEIHouse Audio Player",
                },
                body: JSON.stringify({
                    model: presetModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...newMessages,
                    ],
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData?.error?.message || `HTTP ${response.status} from OpenRouter`)
            }

            const data = await response.json()
            const assistantContent = data?.choices?.[0]?.message?.content

            if (!assistantContent) {
                throw new Error("No response content received from agent.")
            }

            const updatedMessages = [...newMessages, { role: "assistant" as const, content: assistantContent }]
            setMessages(updatedMessages)
            safeSessionStorage.setItem(storageKey, JSON.stringify(updatedMessages))
        } catch (err: any) {
            if (err.name === "AbortError") return
            console.error("Agent Connection Error:", err)
            setError(err?.message || "Failed to communicate with OpenRouter. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const startInitialAnalysis = () => {
        const initialPrompt =
            variant === "demo-scout"
                ? "Please scan this demo and tell me if it's worth finishing."
                : variant === "studio-scout"
                ? "Please perform a studio session mix analysis on this track."
                : "Please write the historical memoir of this track's evolution."
        void handleSendMessage(initialPrompt)
    }

    const clearChat = () => {
        setMessages([])
        safeSessionStorage.removeItem(storageKey)
        setError(null)
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
                        disabled={!currentTrack || loading || !getApiKey()}
                        className="sap-ctl__agent-btn-primary ap-tap"
                    >
                        {loading ? "Initializing..." : copy.actionLabel}
                    </button>
                    {!getApiKey() && (
                        <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "12px", opacity: 0.8 }}>
                            API Key missing. Please set VITE_OPENROUTER_API_KEY in your .env.local file.
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
                                <span>Agent thinking...</span>
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
                                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault()
                                    void handleSendMessage(input)
                                }
                            }}
                            placeholder="Ask follow-up questions..."
                            className="sap-ctl__agent-input"
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="sap-ctl__agent-send-btn ap-tap"
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

