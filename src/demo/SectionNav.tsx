import { useEffect, useState, useCallback } from "react"
import { Compass, Layers, X, ChevronRight } from "lucide-react"

export interface SectionNavItem {
    id: string
    label: string
    number: string
    category?: string
}

export interface SectionNavProps {
    sections: readonly SectionNavItem[] | SectionNavItem[]
    defaultSectionId?: string
    ariaLabel?: string
    enableKeyboardShortcuts?: boolean
}

export function SectionNav({
    sections,
    defaultSectionId,
    ariaLabel = "Page quick navigation",
    enableKeyboardShortcuts = true,
}: SectionNavProps) {
    const initialId = defaultSectionId || (sections.length > 0 ? sections[0].id : "")
    const [activeSection, setActiveSection] = useState<string>(initialId)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false)

    const scrollToSection = useCallback((sectionId: string) => {
        setActiveSection(sectionId)
        setIsMobileMenuOpen(false)
        const el = document.getElementById(sectionId)
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }, [])

    useEffect(() => {
        if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries.filter((e) => e.isIntersecting)
                if (visibleEntries.length > 0) {
                    visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio)
                    setActiveSection(visibleEntries[0].target.id)
                }
            },
            {
                rootMargin: "-90px 0px -50% 0px",
                threshold: [0.1, 0.3, 0.6],
            }
        )

        for (const sec of sections) {
            const el = document.getElementById(sec.id)
            if (el) observer.observe(el)
        }

        return () => {
            observer.disconnect()
        }
    }, [sections])

    useEffect(() => {
        if (!enableKeyboardShortcuts || typeof window === "undefined") {
            return
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore key events when user is typing in form inputs, textareas, contenteditable elements, etc.
            const target = e.target as HTMLElement | null
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable)
            ) {
                return
            }

            // Ignore when modifier keys like Ctrl or Meta are pressed (avoid interfering with browser shortcuts)
            if (e.metaKey || e.ctrlKey || e.altKey) {
                return
            }

            // Match numeric keys 1-9 and 0 (for 10th item)
            let targetIdx = -1
            if (e.key === "0" && sections.length >= 10) {
                targetIdx = 9
            } else {
                const keyNum = parseInt(e.key, 10)
                if (!Number.isNaN(keyNum) && keyNum >= 1 && keyNum <= sections.length) {
                    targetIdx = keyNum - 1
                }
            }

            if (targetIdx >= 0 && targetIdx < sections.length) {
                e.preventDefault()
                const targetSection = sections[targetIdx]
                if (targetSection) {
                    scrollToSection(targetSection.id)
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [enableKeyboardShortcuts, sections, scrollToSection])

    const currentSectionInfo = sections.find((s) => s.id === activeSection) || sections[0]

    if (!currentSectionInfo || sections.length === 0) {
        return null
    }

    const hintText =
        sections.length >= 10
            ? "Keys 1–9, 0"
            : `Keys 1–${Math.min(sections.length, 9)}`

    return (
        <div
            className={`showcase-subnav-wrap showcase-vnav-container ${isMobileMenuOpen ? "is-menu-open" : ""}`}
            aria-label={ariaLabel}
        >
            {/* Mobile floating trigger pill */}
            <button
                type="button"
                className="showcase-vnav-trigger"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-label="Toggle vertical section menu"
            >
                <Compass size={14} className="showcase-vnav-trigger__icon" />
                <span className="showcase-vnav-trigger__current">{currentSectionInfo.label}</span>
                <span className="showcase-vnav-trigger__badge">{currentSectionInfo.number}</span>
            </button>

            {/* Vertical menu drawer/dock */}
            <div className="showcase-subnav showcase-vnav" role="navigation" aria-label="Page sections">
                <div className="showcase-vnav__header">
                    <div className="showcase-vnav__header-left">
                        <Layers size={13} className="showcase-vnav__header-icon" />
                        <span className="showcase-subnav__label showcase-vnav__label">Index</span>
                    </div>
                    <span className="showcase-vnav__header-hint" title="Press number keys on keyboard to jump">
                        {hintText}
                    </span>
                    {isMobileMenuOpen && (
                        <button
                            type="button"
                            className="showcase-vnav__close"
                            onClick={() => setIsMobileMenuOpen(false)}
                            aria-label="Close menu"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="showcase-subnav__pills showcase-vnav__pills">
                    {sections.map((sec, idx) => {
                        const isActive = activeSection === sec.id
                        const shortcutKey = idx === 9 ? "0" : idx < 9 ? String(idx + 1) : undefined
                        return (
                            <button
                                key={sec.id}
                                type="button"
                                aria-label={sec.label}
                                aria-keyshortcuts={shortcutKey}
                                className={`showcase-subnav__pill showcase-vnav__item${
                                    isActive
                                        ? " showcase-subnav__pill--active showcase-vnav__item--active"
                                        : ""
                                }`}
                                onClick={() => scrollToSection(sec.id)}
                                aria-current={isActive ? "true" : undefined}
                            >
                                <span className="showcase-vnav__number">{sec.number}</span>
                                <span className="showcase-vnav__name">{sec.label}</span>
                                {shortcutKey && (
                                    <kbd className="showcase-vnav__kbd" aria-hidden="true">
                                        {shortcutKey}
                                    </kbd>
                                )}
                                <ChevronRight size={12} className="showcase-vnav__arrow" />
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
