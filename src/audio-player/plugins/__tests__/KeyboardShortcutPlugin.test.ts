/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createKeyboardShortcutPlugin } from "../KeyboardShortcutPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"

describe("KeyboardShortcutPlugin", () => {
    let mockContext: PluginPlayerContext
    let mockEngine: any
    let rootElement: HTMLElement

    beforeEach(() => {
        rootElement = document.createElement("div")
        document.body.appendChild(rootElement)

        mockEngine = {
            toggle: vi.fn(),
            seekBy: vi.fn(),
        }

        mockContext = {
            getEngine: vi.fn().mockReturnValue(mockEngine),
            getRootElement: vi.fn().mockReturnValue(rootElement),
            next: vi.fn(),
            previous: vi.fn(),
        } as unknown as PluginPlayerContext
    })

    afterEach(() => {
        document.body.removeChild(rootElement)
        vi.restoreAllMocks()
    })

    const triggerKeydown = (target: EventTarget, key: string, options: Partial<KeyboardEventInit> = {}) => {
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options })
        target.dispatchEvent(event)
        return event
    }

    describe("Key bindings & playback controls", () => {
        it("toggles playback on Space", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, " ")
            expect(mockEngine.toggle).toHaveBeenCalledTimes(1)
            
            triggerKeydown(rootElement, "Spacebar")
            expect(mockEngine.toggle).toHaveBeenCalledTimes(2)
        })

        it("seeks backward on ArrowLeft", () => {
            const plugin = createKeyboardShortcutPlugin({ seekSeconds: 5 })
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, "ArrowLeft")
            expect(mockEngine.seekBy).toHaveBeenCalledWith(-5)
        })

        it("seeks forward on ArrowRight", () => {
            const plugin = createKeyboardShortcutPlugin({ seekSeconds: 10 })
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, "ArrowRight")
            expect(mockEngine.seekBy).toHaveBeenCalledWith(10)
        })
    })

    describe("Optional key bindings (JKL & Playlist)", () => {
        it("handles JKL keys when enabled", () => {
            const plugin = createKeyboardShortcutPlugin({ enableJKL: true, seekSeconds: 5 })
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, "k")
            expect(mockEngine.toggle).toHaveBeenCalledTimes(1)
            
            triggerKeydown(rootElement, "j")
            expect(mockEngine.seekBy).toHaveBeenCalledWith(-5)
            
            triggerKeydown(rootElement, "l")
            expect(mockEngine.seekBy).toHaveBeenCalledWith(5)
        })

        it("ignores JKL keys when disabled", () => {
            const plugin = createKeyboardShortcutPlugin({ enableJKL: false })
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, "k")
            expect(mockEngine.toggle).not.toHaveBeenCalled()
        })

        it("handles playlist keys when enabled", () => {
            const plugin = createKeyboardShortcutPlugin({ enablePlaylistKeys: true })
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, "n")
            expect(mockContext.next).toHaveBeenCalledTimes(1)
            
            triggerKeydown(rootElement, "p")
            expect(mockContext.previous).toHaveBeenCalledTimes(1)
        })
        
        it("ignores playlist keys when disabled", () => {
            const plugin = createKeyboardShortcutPlugin({ enablePlaylistKeys: false })
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, "n")
            expect(mockContext.next).not.toHaveBeenCalled()
        })
    })

    describe("Scope behavior", () => {
        it("attaches to root element by default", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            triggerKeydown(document.body, " ")
            expect(mockEngine.toggle).not.toHaveBeenCalled() // Bubbles to body, but listener is on rootElement which is a child, so if dispatched on body it doesn't reach root. Wait, dispatching on body doesn't trigger rootElement listener.
            
            triggerKeydown(rootElement, " ")
            expect(mockEngine.toggle).toHaveBeenCalledTimes(1)
        })

        it("attaches to document when scope is 'document'", () => {
            const plugin = createKeyboardShortcutPlugin({ scope: "document" })
            plugin.init(mockContext)
            
            triggerKeydown(document.body, " ") // Dispatching on body bubbles to document
            expect(mockEngine.toggle).toHaveBeenCalledTimes(1)
            
            triggerKeydown(rootElement, " ") // Bubbles to document
            expect(mockEngine.toggle).toHaveBeenCalledTimes(2)
        })
        
        it("removes event listener on destroy", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            plugin.destroy()
            
            triggerKeydown(rootElement, " ")
            expect(mockEngine.toggle).not.toHaveBeenCalled()
        })
    })

    describe("Conflicts and interactive elements", () => {
        it("ignores events with modifier keys (meta, ctrl, alt)", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            triggerKeydown(rootElement, " ", { metaKey: true })
            triggerKeydown(rootElement, " ", { ctrlKey: true })
            triggerKeydown(rootElement, " ", { altKey: true })
            
            expect(mockEngine.toggle).not.toHaveBeenCalled()
        })

        it("ignores events originating from interactive elements", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            const input = document.createElement("input")
            rootElement.appendChild(input)
            
            const textarea = document.createElement("textarea")
            rootElement.appendChild(textarea)
            
            const button = document.createElement("button")
            rootElement.appendChild(button)
            
            triggerKeydown(input, " ")
            triggerKeydown(textarea, " ")
            triggerKeydown(button, " ")
            
            expect(mockEngine.toggle).not.toHaveBeenCalled()
        })

        it("ignores events if default has been prevented", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
            event.preventDefault() // prevent default beforehand
            rootElement.dispatchEvent(event)
            
            expect(mockEngine.toggle).not.toHaveBeenCalled()
        })
        
        it("prevents default browser behavior for handled shortcuts", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            const event = triggerKeydown(rootElement, " ")
            expect(event.defaultPrevented).toBe(true)
        })
        
        it("does not prevent default for unhandled keys", () => {
            const plugin = createKeyboardShortcutPlugin()
            plugin.init(mockContext)
            
            const event = triggerKeydown(rootElement, "x")
            expect(event.defaultPrevented).toBe(false)
        })
    })
})
