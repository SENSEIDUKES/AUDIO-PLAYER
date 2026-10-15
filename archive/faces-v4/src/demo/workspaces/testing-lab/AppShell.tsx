import { Children, forwardRef, isValidElement } from "react"
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react"
import "./app-shell.css"

/* App shell surface for the Testing Lab, brought over from the UI repo.

   Source: SENSEIDUKES/UI · packages/seihouse-ui/src/layout/sei-app-shell.tsx
   (SEIAppShell, UI main @ bce4c74, read 2026-09-27), plus the header and
   bottom-navigation patterns from sei-app-header.tsx and
   sei-bottom-navigation.tsx.

   @seihouse/ui itself needs React 19, Tailwind 4, and several UI libraries this
   repo does not use, so this is a dependency-free port: the same props, slots,
   landmarks, and layout rules (sticky glass header, sidebar that appears at a
   breakpoint, independently scrolling main area, full-width footer), expressed
   in plain CSS with the matching `--sh-*` tokens. It lives in the demo only —
   the published audio player never imports it. Keeping the prop names means the
   real SEIAppShell can replace it later without touching the contexts. */

/** Mirrors the UI package's `hasRenderableContent`: nothing, false, and "" render nothing. */
function hasRenderableContent(node: ReactNode): boolean {
    if (node === null || node === undefined || node === false || node === true) return false
    if (typeof node === "string") return node.length > 0
    if (Array.isArray(node)) return node.some(hasRenderableContent)
    if (isValidElement(node)) return true
    return Children.count(node) > 0
}

export interface AppShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    /** Top app bar — rendered sticky at the top of the shell. */
    header?: ReactNode
    /** Optional navigation rail — scrolls on its own and is hidden below sidebarBreakpoint. */
    sidebar?: ReactNode
    /** Width at which the sidebar and its grid column appear (default "md" = 768px). */
    sidebarBreakpoint?: "md" | "lg" | "xl"
    /** Optional footer rendered below the main content. */
    footer?: ReactNode
    /** Main scrollable content region. */
    children?: ReactNode
    /** Class for the footer landmark. */
    footerClassName?: string
    /** Width of the sidebar column at sidebarBreakpoint and up (default "16rem"). */
    sidebarWidth?: string
    /** Label for the sidebar landmark (default "Primary"). */
    sidebarLabel?: string
    /** Optional id for the <main> landmark, useful for skip links. */
    mainId?: string
    /** Class for the <main> landmark. */
    mainClassName?: string
    /** Accessible label for the <main> landmark. */
    mainAriaLabel?: string
    /** Ref to the scrollable <main> region. The forwarded ref stays on the shell root. */
    mainRef?: Ref<HTMLElement>
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
    {
        header,
        sidebar,
        sidebarBreakpoint = "md",
        footer,
        footerClassName,
        children,
        sidebarWidth = "16rem",
        sidebarLabel = "Primary",
        mainId,
        mainClassName,
        mainAriaLabel,
        mainRef,
        className,
        style,
        ...props
    },
    ref
) {
    const breakpoint =
        sidebarBreakpoint === "lg" || sidebarBreakpoint === "xl" ? sidebarBreakpoint : "md"
    const hasHeader = hasRenderableContent(header)
    const hasSidebar = hasRenderableContent(sidebar)
    const hasFooter = hasRenderableContent(footer)
    const rows = `${hasHeader ? "h" : ""}m${hasFooter ? "f" : ""}`

    const classes = [
        "sh-app-shell",
        `sh-app-shell--rows-${rows}`,
        hasSidebar ? `sh-app-shell--sidebar-${breakpoint}` : null,
        className,
    ]
        .filter(Boolean)
        .join(" ")

    return (
        <div
            ref={ref}
            data-slot="app-shell"
            className={classes}
            style={{ ["--sh-shell-sidebar" as string]: sidebarWidth, ...style } as CSSProperties}
            {...props}
        >
            {hasHeader ? (
                <header data-slot="app-shell-header" className="sh-app-shell__header">
                    {header}
                </header>
            ) : null}

            {hasSidebar ? (
                <aside
                    data-slot="app-shell-sidebar"
                    aria-label={sidebarLabel}
                    className="sh-app-shell__sidebar"
                >
                    {sidebar}
                </aside>
            ) : null}

            <main
                ref={mainRef}
                id={mainId}
                data-slot="app-shell-main"
                aria-label={mainAriaLabel}
                tabIndex={mainId ? -1 : undefined}
                className={["sh-app-shell__main", mainClassName].filter(Boolean).join(" ")}
            >
                {children}
            </main>

            {hasFooter ? (
                <footer
                    data-slot="app-shell-footer"
                    className={["sh-app-shell__footer", footerClassName].filter(Boolean).join(" ")}
                >
                    {footer}
                </footer>
            ) : null}
        </div>
    )
})

/* ------------------------ App header (lite port) ------------------------ */

/**
 * The bar inside the shell's header slot: identity (branding + app name), the
 * current context label (visible from 640px up), actions, and the account
 * slot. Deliberately no heading element — the page owns its <h1>, as in the
 * UI package's SEIAppHeader. Renders a <div> because the shell already provides
 * the <header> landmark (SEIAppHeader's `landmark="none"`).
 */
export function AppHeaderBar({
    appName,
    branding,
    contextLabel,
    actions,
    profile,
}: {
    appName: ReactNode
    branding?: ReactNode
    contextLabel?: ReactNode
    actions?: ReactNode
    profile?: ReactNode
}) {
    return (
        <div className="sh-app-header" data-slot="app-header">
            <span className="sh-app-header__identity">
                {branding ? <span className="sh-app-header__branding">{branding}</span> : null}
                <span className="sh-app-header__name">{appName}</span>
                {contextLabel ? (
                    <span className="sh-app-header__context">
                        <span aria-hidden="true">/</span> {contextLabel}
                    </span>
                ) : null}
            </span>
            {actions ? <span className="sh-app-header__actions">{actions}</span> : null}
            {profile ? <span className="sh-app-header__profile">{profile}</span> : null}
        </div>
    )
}

/* --------------------- Bottom navigation (lite port) --------------------- */

export interface BottomNavItem {
    id: string
    label: string
    icon: ReactNode
    active?: boolean
}

/**
 * Phone navigation for the shell's footer: glass bar, icon + label tabs,
 * `aria-current` on the active destination, and a pad for the home indicator.
 * Hidden at the shell's sidebar breakpoint, where the sidebar takes over.
 */
export function BottomNavigation({
    items,
    onSelect,
    label,
    hideFrom = "md",
}: {
    items: readonly BottomNavItem[]
    onSelect: (id: string) => void
    label: string
    hideFrom?: "md" | "lg" | "xl"
}) {
    return (
        <nav className={`sh-bottom-nav sh-bottom-nav--hide-${hideFrom}`} aria-label={label}>
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    className="sh-bottom-nav__item"
                    aria-current={item.active ? "page" : undefined}
                    data-selected={item.active ? "true" : undefined}
                    onClick={() => onSelect(item.id)}
                >
                    <span aria-hidden="true" className="sh-bottom-nav__icon">
                        {item.icon}
                    </span>
                    <span className="sh-bottom-nav__label">{item.label}</span>
                </button>
            ))}
        </nav>
    )
}
