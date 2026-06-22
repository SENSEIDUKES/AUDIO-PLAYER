(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require("react"), require("react-dom")) : typeof define === "function" && define.amd ? define([
		"exports",
		"react",
		"react-dom"
	], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.SEIHouseAudioPlayer = {}, global.React, global.ReactDOM));
})(this, function(exports, react, react_dom) {
	var __vite_style__ = document.createElement("style");
	__vite_style__.textContent = "/* SEI Canvas Action Menu — the bottom-anchored half-circle command wheel.\n   Rendered through a portal on document.body; the player's --ap-* tokens are\n   copied onto the .sac root inline by the component. Sits at the same overlay\n   layer as the SAP Controller (z 120). */\n\n.sac {\n    position: fixed;\n    inset: 0;\n    z-index: 120;\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n\n/* Dim + light blur, fades in. Mirrors the SAP Controller backdrop. */\n.sac__backdrop {\n    position: absolute;\n    inset: 0;\n    background: rgba(0, 0, 0, 0.55);\n    backdrop-filter: blur(6px);\n    -webkit-backdrop-filter: blur(6px);\n    opacity: 0;\n    transition: opacity 0.2s ease;\n}\n.sac__backdrop[data-entered=\"true\"] {\n    opacity: 1;\n}\n\n/* Anchors the arc to the bottom-center within the safe area. */\n.sac__stage {\n    position: absolute;\n    inset: 0;\n    display: flex;\n    align-items: flex-end;\n    justify-content: center;\n    padding-bottom: max(3rem, calc(env(safe-area-inset-bottom) + 2rem));\n    pointer-events: none;\n}\n\n/* Zero-size pivot: all nodes + the center button are positioned relative to this\n   point (the bottom-center of the half-circle). */\n.sac__arc {\n    position: relative;\n    width: 0;\n    height: 0;\n    pointer-events: none;\n    /* Default fallback; the component overrides this per viewport via inline\n       style so the breadcrumb and depth indicator track the live radius. */\n    --arc-radius: 128px;\n}\n\n/* Submenu depth indicator — a faint radial glow centered on the pivot that\n   fades in with the arc, hinting at the wheel's focus area. */\n.sac__arc::before {\n    content: \"\";\n    position: absolute;\n    left: 50%;\n    top: 50%;\n    width: calc(2 * var(--arc-radius, 128px));\n    height: calc(2 * var(--arc-radius, 128px));\n    transform: translate(-50%, -50%);\n    background: radial-gradient(\n        circle at center,\n        color-mix(in srgb, var(--ap-text, #fff) 4%, transparent) 0%,\n        transparent 70%\n    );\n    border-radius: 50%;\n    pointer-events: none;\n    opacity: 0;\n    transition: opacity 0.2s ease;\n}\n.sac__arc[data-open=\"true\"]::before {\n    opacity: 1;\n}\n\n/* Center button: Close at root depth, Back inside a submenu. */\n.sac__center {\n    position: absolute;\n    left: 0;\n    top: 0;\n    width: 64px;\n    height: 64px;\n    transform: translate(-50%, -50%) scale(0.6);\n    opacity: 0;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    border-radius: 50%;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 22%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 12%, transparent);\n    backdrop-filter: blur(12px);\n    -webkit-backdrop-filter: blur(12px);\n    color: var(--ap-text, #fff);\n    cursor: pointer;\n    pointer-events: auto;\n    touch-action: manipulation;\n    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),\n        opacity 0.2s ease-out, background-color 0.2s ease;\n}\n.sac__arc[data-open=\"true\"] .sac__center {\n    transform: translate(-50%, -50%) scale(1);\n    opacity: 1;\n}\n.sac__center:hover {\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 18%, transparent);\n}\n\n/* Breadcrumb pill, floats above the top of the arc. */\n.sac__crumb {\n    position: absolute;\n    left: 0;\n    top: 0;\n    transform: translate(-50%, calc(-50% - var(--arc-radius, 128px) - 56px));\n    white-space: nowrap;\n    padding: 5px 12px;\n    border-radius: 999px;\n    font-size: 12px;\n    font-weight: 600;\n    letter-spacing: 0.01em;\n    color: var(--ap-text, #fff);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 10%, transparent);\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 16%, transparent);\n    backdrop-filter: blur(8px);\n    -webkit-backdrop-filter: blur(8px);\n    pointer-events: none;\n}\n\n/* A node: an icon disc with a label beneath it. Animates from the pivot out to\n   its polar offset (--sac-x / --sac-y), staggered via inline transition-delay. */\n.sac__node {\n    position: absolute;\n    left: 0;\n    top: 0;\n    width: 72px;\n    min-width: 48px; /* WCAG 2.1 AA touch-target minimum */\n    min-height: 48px;\n    display: inline-flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 6px;\n    padding: 8px; /* enlarges the effective tap area around the disc */\n    border: none;\n    background: transparent;\n    color: var(--ap-text, #fff);\n    cursor: pointer;\n    pointer-events: auto;\n    /* Snappy taps: no 300ms delay, no double-tap zoom, no text selection. */\n    touch-action: manipulation;\n    -webkit-user-select: none;\n    user-select: none;\n    transform: translate(-50%, -50%) scale(0.4);\n    opacity: 0;\n    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),\n        opacity 0.2s ease-out;\n}\n.sac__arc[data-open=\"true\"] .sac__node {\n    transform: translate(-50%, -50%) translate(var(--sac-x), var(--sac-y)) scale(1);\n    opacity: 1;\n}\n\n/* Desktop hover: lift and lightly fill the disc. */\n.sac__node:hover .sac__node-icon {\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 15%, transparent);\n    transform: scale(1.05);\n}\n\n/* Keyboard focus ring on the node + a halo on the disc. */\n.sac__node:focus-visible {\n    outline: 2px solid var(--ap-accent, #fff);\n    outline-offset: 4px;\n}\n.sac__node:focus-visible .sac__node-icon {\n    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ap-accent, #fff) 30%, transparent);\n}\n\n/* Press feedback. */\n.sac__node:active .sac__node-icon {\n    transform: scale(0.95);\n}\n\n.sac__node-icon {\n    position: relative;\n    width: 56px; /* trimmed from 60px to breathe inside the 72px node */\n    height: 56px;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    border-radius: 50%;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 16%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 8%, transparent);\n    backdrop-filter: blur(12px);\n    -webkit-backdrop-filter: blur(12px);\n    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ap-text, #fff) 14%, transparent);\n    transition: background-color 0.2s ease, border-color 0.2s ease,\n        box-shadow 0.2s ease, color 0.2s ease, transform 0.2s ease;\n}\n.sac__node-label {\n    font-size: 11px;\n    font-weight: 500;\n    line-height: 1.2;\n    text-align: center;\n    max-width: 80px;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);\n}\n\n/* \"soon\" badge for coming-soon nodes. */\n.sac__badge {\n    position: absolute;\n    top: -4px;\n    right: 2px;\n    padding: 1px 6px;\n    border-radius: 999px;\n    font-size: 9px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.04em;\n    color: var(--ap-bg, #14141c);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 70%, transparent);\n}\n\n/* ------------------------------- States ------------------------------- */\n.sac__node--active .sac__node-icon {\n    background-color: color-mix(in srgb, var(--ap-accent, #fff) 22%, transparent);\n    border-color: var(--ap-accent, #fff);\n    color: var(--ap-accent, #fff);\n    box-shadow: 0 0 0 1px var(--ap-accent, #fff),\n        0 0 18px color-mix(in srgb, var(--ap-accent, #fff) 45%, transparent);\n}\n.sac__node--inactive .sac__node-icon {\n    opacity: 0.7;\n    filter: grayscale(0.3);\n}\n.sac__node--disabled .sac__node-icon {\n    opacity: 0.4;\n    filter: grayscale(0.8);\n}\n.sac__node--locked .sac__node-icon {\n    opacity: 0.5;\n    border-style: dashed; /* distinct entitlement-gated look */\n}\n.sac__node--coming-soon .sac__node-icon {\n    opacity: 0.5;\n    filter: saturate(0.5);\n}\n.sac__node--disabled,\n.sac__node--coming-soon,\n.sac__node--locked {\n    pointer-events: none;\n    cursor: default;\n}\n\n/* ------------------------------- Motion ------------------------------- */\n@media (prefers-reduced-motion: reduce) {\n    .sac__backdrop,\n    .sac__center,\n    .sac__node,\n    .sac__node-icon,\n    .sac__arc::before {\n        transition: none;\n    }\n}\n/* Scoped under .sap-visual-sample-skin by import-skin CLI. */\n\n\n.sap-visual-sample-skin {\n    --sample-fg: #ffffff;\n    --sample-bg: #1a1a2e;\n}\n\n.sap-visual-sample-skin {\n    margin: 0;\n    padding: 0;\n    background: var(--sample-bg);\n}\n\n.sap-visual-sample-skin .container {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    min-height: 160px;\n    gap: 16px;\n}\n\n.sap-visual-sample-skin .title {\n    font-size: 22px;\n    font-weight: 700;\n    letter-spacing: 0.02em;\n}\n\n.sap-visual-sample-skin .ring {\n    width: 64px;\n    height: 64px;\n    border: 3px solid var(--sample-fg);\n    border-radius: 50%;\n    animation: sap-sample-skin-spin 2s linear infinite;\n}\n\n@keyframes sap-sample-skin-spin {\n    from { transform: rotate(0deg); }\n    to { transform: rotate(360deg); }\n}\n\n@media (max-width: 480px) {\n.sap-visual-sample-skin .title {\n        font-size: 16px;\n    }\n}\n/* Visual-slot styles. Every selector is scoped under a `.sap-visual-*` class so\n   ported Workshop-Light components never leak global `body`, `*`, or unscoped\n   rules into the player. New components should follow the same prefix. */\n\n/* ------------------------------- Empty state ------------------------------ */\n.sap-visual-empty {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 6px;\n    min-height: 160px;\n    padding: 24px;\n    border-radius: 14px;\n    border: 1px dashed color-mix(in srgb, var(--ap-text, #fff) 18%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 4%, transparent);\n    color: var(--ap-text, #fff);\n    text-align: center;\n}\n.sap-visual-empty__title {\n    font-size: 14px;\n    font-weight: 600;\n}\n.sap-visual-empty__hint {\n    font-size: 12px;\n    opacity: 0.6;\n}\n\n/* ------------------------------ Lyric display ----------------------------- */\n.sap-visual-lyric {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    width: 100%;\n    min-height: 160px;\n    max-height: 320px;\n    overflow-y: auto;\n    padding: 16px 12px;\n    color: var(--ap-text, #fff);\n    text-align: center;\n}\n.sap-visual-lyric--empty {\n    align-items: center;\n    justify-content: center;\n    gap: 6px;\n}\n.sap-visual-lyric__empty-title {\n    margin: 0;\n    font-size: 14px;\n    font-weight: 600;\n}\n.sap-visual-lyric__empty-hint {\n    margin: 0;\n    font-size: 12px;\n    opacity: 0.6;\n}\n.sap-visual-lyric__line {\n    margin: 0;\n    opacity: 0.45;\n    transition: opacity 0.25s ease, color 0.25s ease, transform 0.25s ease;\n}\n.sap-visual-lyric__line[data-active=\"true\"] {\n    opacity: 1;\n}\n/* Animation modes (data-animation on the container). `none` disables motion. */\n.sap-visual-lyric[data-animation=\"none\"] .sap-visual-lyric__line {\n    transition: none;\n}\n.sap-visual-lyric[data-animation=\"slide\"] .sap-visual-lyric__line[data-active=\"true\"] {\n    transform: scale(1.04);\n}\n\n/* ------------------------------ Settings panel ---------------------------- */\n.sap-visual-settings {\n    display: flex;\n    flex-direction: column;\n    gap: 14px;\n    padding: 4px 0;\n}\n.sap-visual-field {\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n}\n.sap-visual-field__label {\n    font-size: 12px;\n    font-weight: 600;\n    opacity: 0.8;\n    color: var(--ap-text, #fff);\n}\n.sap-visual-input {\n    width: 100%;\n    accent-color: var(--ap-accent, #7cc4ff);\n    color: var(--ap-text, #fff);\n}\n.sap-visual-input--color {\n    width: 48px;\n    height: 28px;\n    padding: 0;\n    border: none;\n    background: none;\n    cursor: pointer;\n}\nselect.sap-visual-input {\n    padding: 6px 8px;\n    border-radius: 8px;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 20%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 6%, transparent);\n}\n\n/* ─────────────────────── Visual slot picker / switcher ──────────────────── */\n.sap-visual-switcher {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    padding: 0 0 16px;\n}\n.sap-visual-switcher__label {\n    font-size: 11px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.06em;\n    opacity: 0.55;\n    color: var(--ap-text, #fff);\n}\n.sap-visual-switcher__list {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n}\n.sap-visual-switcher__btn {\n    appearance: none;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 18%, transparent);\n    border-radius: 20px;\n    padding: 6px 16px;\n    font-size: 13px;\n    font-weight: 500;\n    color: var(--ap-text, #fff);\n    background: color-mix(in srgb, var(--ap-text, #fff) 6%, transparent);\n    cursor: pointer;\n    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease,\n        transform 0.12s ease;\n    user-select: none;\n}\n.sap-visual-switcher__btn:hover {\n    background: color-mix(in srgb, var(--ap-text, #fff) 14%, transparent);\n    border-color: color-mix(in srgb, var(--ap-text, #fff) 30%, transparent);\n}\n.sap-visual-switcher__btn:active {\n    transform: scale(0.96);\n}\n.sap-visual-switcher__btn--active {\n    background: var(--ap-accent, #7cc4ff);\n    color: #000;\n    border-color: var(--ap-accent, #7cc4ff);\n    font-weight: 600;\n}\n.sap-visual-switcher__btn--active:hover {\n    background: color-mix(in srgb, var(--ap-accent, #7cc4ff) 85%, #fff);\n    border-color: color-mix(in srgb, var(--ap-accent, #7cc4ff) 85%, #fff);\n}\n\n/* Activity Log Panel — diagnostic event viewer for the SAP Controller sheet.\n   Matches the sheet's dark, glass-forward aesthetic. */\n\n.al {\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    max-height: 440px;\n    min-height: 200px;\n}\n\n/* ── Toolbar ── */\n\n.al__toolbar {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n    padding: 0 4px;\n}\n\n.al__filters {\n    display: flex;\n    gap: 6px;\n    flex-wrap: wrap;\n}\n\n.al__select,\n.al__search {\n    font-family: inherit;\n    font-size: 12px;\n    font-weight: 500;\n    padding: 6px 10px;\n    border-radius: 8px;\n    border: 1px solid rgba(255, 255, 255, 0.14);\n    background: rgba(255, 255, 255, 0.06);\n    color: inherit;\n    outline: none;\n    min-width: 0;\n}\n\n.al__select {\n    flex: 0 0 auto;\n    cursor: pointer;\n    appearance: auto;\n    -webkit-appearance: auto;\n}\n\n.al__search {\n    flex: 1;\n    min-width: 120px;\n}\n\n.al__search::placeholder {\n    opacity: 0.45;\n}\n\n.al__select:focus,\n.al__search:focus {\n    border-color: var(--ap-accent, #ffffff);\n    box-shadow: 0 0 0 1px var(--ap-accent, rgba(255, 255, 255, 0.3));\n}\n\n/* ── Action buttons ── */\n\n.al__actions {\n    display: flex;\n    gap: 6px;\n    flex-wrap: wrap;\n}\n\n.al__btn {\n    display: inline-flex;\n    align-items: center;\n    gap: 5px;\n    font-family: inherit;\n    font-size: 11px;\n    font-weight: 600;\n    padding: 5px 12px;\n    border-radius: 8px;\n    border: 1px solid rgba(255, 255, 255, 0.14);\n    background: rgba(255, 255, 255, 0.06);\n    color: inherit;\n    cursor: pointer;\n    white-space: nowrap;\n    text-transform: uppercase;\n    letter-spacing: 0.04em;\n    transition: background 0.12s ease, border-color 0.12s ease;\n}\n\n.al__btn:hover {\n    background: rgba(255, 255, 255, 0.12);\n    border-color: rgba(255, 255, 255, 0.28);\n}\n\n.al__btn:focus-visible {\n    outline: 2px solid var(--ap-accent, #ffffff);\n    outline-offset: 1px;\n}\n\n.al__btn--clear {\n    margin-left: auto;\n}\n\n.al__btn--clear:hover {\n    border-color: rgba(255, 80, 80, 0.5);\n    color: #ff6b6b;\n}\n\n.al__btn--copy svg {\n    width: 14px;\n    height: 14px;\n}\n\n.al__icon-copy {\n    display: inline-block;\n    width: 14px;\n    height: 14px;\n    background: currentColor;\n    mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E\")\n        center / contain no-repeat;\n    -webkit-mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E\")\n        center / contain no-repeat;\n}\n\n/* ── Badge / event count ── */\n\n.al__badge {\n    font-size: 10.5px;\n    font-weight: 600;\n    text-transform: uppercase;\n    letter-spacing: 0.06em;\n    opacity: 0.5;\n    padding: 2px 8px 4px;\n}\n\n/* ── Event list (scrollable) ── */\n\n.al__list {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    overflow-y: auto;\n    max-height: 360px;\n    overscroll-behavior: contain;\n    padding: 0 2px;\n}\n\n.al__empty {\n    text-align: center;\n    padding: 32px 16px;\n    font-size: 13px;\n    opacity: 0.5;\n}\n\n/* ── Single event row ── */\n\n.al-event {\n    border-radius: 8px;\n    transition: background 0.1s ease;\n}\n\n.al-event:hover {\n    background: rgba(255, 255, 255, 0.04);\n}\n\n.al-event--expanded {\n    background: rgba(255, 255, 255, 0.06);\n}\n\n/* Summary row (always visible) */\n\n.al-event__summary {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    width: 100%;\n    min-height: 34px;\n    padding: 6px 10px;\n    border: none;\n    background: transparent;\n    color: inherit;\n    font-family: inherit;\n    font-size: 12px;\n    text-align: left;\n    cursor: pointer;\n    border-radius: 8px;\n}\n\n.al-event__summary:focus-visible {\n    outline: 2px solid var(--ap-accent, #ffffff);\n    outline-offset: -2px;\n}\n\n.al-event__time {\n    flex-shrink: 0;\n    font-size: 10px;\n    font-weight: 600;\n    font-variant-numeric: tabular-nums;\n    opacity: 0.45;\n    min-width: 52px;\n}\n\n.al-event__status {\n    flex-shrink: 0;\n    font-size: 9.5px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.04em;\n    padding: 2px 7px;\n    border-radius: 5px;\n    min-width: 38px;\n    text-align: center;\n}\n\n.al-event__status--info {\n    background: rgba(100, 180, 255, 0.18);\n    color: #6cb4ff;\n}\n.al-event__status--warn {\n    background: rgba(255, 190, 60, 0.2);\n    color: #ffc145;\n}\n.al-event__status--error {\n    background: rgba(255, 80, 80, 0.2);\n    color: #ff6b6b;\n}\n.al-event__status--success {\n    background: rgba(60, 210, 120, 0.18);\n    color: #48d97a;\n}\n\n.al-event__area {\n    flex-shrink: 0;\n    font-size: 10.5px;\n    font-weight: 600;\n    opacity: 0.7;\n    min-width: 50px;\n}\n\n.al-event__msg {\n    flex: 1;\n    min-width: 0;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    font-weight: 500;\n    line-height: 1.4;\n}\n\n.al-event__chevron {\n    flex-shrink: 0;\n    font-size: 10px;\n    opacity: 0.4;\n    margin-left: auto;\n    transition: transform 0.15s ease;\n}\n\n.al-event--expanded .al-event__chevron {\n    opacity: 0.7;\n}\n\n/* Expanded details panel */\n\n.al-event__details {\n    display: flex;\n    flex-direction: column;\n    gap: 5px;\n    padding: 2px 12px 10px 12px;\n    border-top: 1px solid rgba(255, 255, 255, 0.06);\n    margin-top: 2px;\n}\n\n.al-event__detail-row {\n    display: flex;\n    align-items: flex-start;\n    gap: 8px;\n    font-size: 11.5px;\n    line-height: 1.5;\n}\n\n.al-event__detail-label {\n    flex-shrink: 0;\n    font-weight: 600;\n    opacity: 0.5;\n    min-width: 46px;\n    text-transform: uppercase;\n    font-size: 9.5px;\n    letter-spacing: 0.04em;\n    padding-top: 2px;\n}\n\n.al-event__detail-val {\n    flex: 1;\n    min-width: 0;\n    font-family: \"SF Mono\", \"Cascadia Code\", \"Fira Code\", \"Consolas\", monospace;\n    font-size: 11px;\n    line-height: 1.55;\n    white-space: pre-wrap;\n    word-break: break-word;\n    background: rgba(0, 0, 0, 0.2);\n    padding: 4px 8px;\n    border-radius: 6px;\n    color: rgba(255, 255, 255, 0.85);\n}\n\n.al-event__detail-val--error {\n    color: #ff6b6b;\n}/* SAP Controller — the shared screen-level command sheet opened from a\n   face's \"…\" button. Bottom sheet on phones, centered dialog on desktop.\n   Lives above the queue drawer (z 100) and the sticky bar (z 50). */\n\n.sap-ctl {\n    position: fixed;\n    inset: 0;\n    z-index: 120;\n    display: flex;\n    align-items: flex-end;\n    justify-content: center;\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n.sap-ctl__backdrop {\n    position: absolute;\n    inset: 0;\n    background: rgba(0, 0, 0, 0.55);\n    backdrop-filter: blur(6px);\n    -webkit-backdrop-filter: blur(6px);\n}\n.sap-ctl__sheet {\n    position: relative;\n    width: min(480px, 100%);\n    /* vh fallback for browsers without dvh support. */\n    max-height: min(80vh, 640px);\n    max-height: min(80dvh, 640px);\n    overflow-y: auto;\n    -webkit-overflow-scrolling: touch;\n    background: rgba(20, 20, 24, 0.97);\n    color: var(--ap-text, #ffffff);\n    border: 1px solid rgba(255, 255, 255, 0.12);\n    border-bottom: none;\n    border-radius: 16px 16px 0 0;\n    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.5);\n    /* Plain fallback for browsers without env() support. */\n    padding: 8px 16px 16px;\n    padding: 8px 16px calc(16px + env(safe-area-inset-bottom));\n    animation: sap-sheet-in 0.22s ease;\n}\n/* Desktop: centered dialog instead of a bottom sheet. */\n@media (min-width: 640px) {\n    .sap-ctl {\n        align-items: center;\n        padding: 24px;\n    }\n    .sap-ctl__sheet {\n        border-radius: 16px;\n        border-bottom: 1px solid rgba(255, 255, 255, 0.12);\n        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);\n    }\n}\n\n.sap-ctl__grab {\n    width: 40px;\n    height: 4px;\n    border-radius: 999px;\n    background: rgba(255, 255, 255, 0.25);\n    margin: 4px auto 8px;\n}\n@media (min-width: 640px) {\n    .sap-ctl__grab {\n        display: none;\n    }\n}\n\n.sap-ctl__header {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    padding: 2px 4px 6px;\n}\n.sap-ctl__title {\n    margin: 0;\n    font-size: 16px;\n    font-weight: 700;\n    letter-spacing: -0.01em;\n}\n.sap-ctl__close {\n    width: 36px;\n    height: 36px;\n    flex-shrink: 0;\n    border-radius: 50%;\n    border: 1px solid rgba(255, 255, 255, 0.18);\n    background: rgba(255, 255, 255, 0.06);\n    color: inherit;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    cursor: pointer;\n    padding: 0;\n}\n.sap-ctl__close:hover {\n    background: rgba(255, 255, 255, 0.12);\n}\n\n.sap-ctl__section {\n    padding-bottom: 4px;\n}\n.sap-ctl__heading {\n    margin: 12px 4px 4px;\n    font-size: 11px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.08em;\n    opacity: 0.5;\n}\n\n/* Large touch rows (≥48px) — the whole row is the control. */\n.sap-ctl__row {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    width: 100%;\n    min-height: 48px;\n    padding: 10px 12px;\n    border: none;\n    background: transparent;\n    color: inherit;\n    border-radius: 10px;\n    font-size: 15px;\n    font-weight: 500;\n    text-align: left;\n    cursor: pointer;\n}\n.sap-ctl__row:hover {\n    background: rgba(255, 255, 255, 0.08);\n}\n.sap-ctl__row:focus-visible {\n    outline: 2px solid var(--ap-accent, #ffffff);\n    outline-offset: -2px;\n}\n.sap-ctl__label {\n    display: inline-flex;\n    align-items: center;\n    gap: 12px;\n    min-width: 0;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.sap-ctl__label svg {\n    color: var(--ap-accent, #ffffff);\n    flex-shrink: 0;\n}\n.sap-ctl__value {\n    flex-shrink: 0;\n    font-size: 13px;\n    font-weight: 600;\n    opacity: 0.65;\n    text-transform: capitalize;\n}\n\n/* Switch — the .ap-menu__switch pattern, sized up for touch. */\n.sap-ctl__switch {\n    position: relative;\n    width: 40px;\n    height: 22px;\n    border-radius: 999px;\n    background-color: rgba(255, 255, 255, 0.18);\n    flex-shrink: 0;\n    transition: background-color 0.15s ease;\n}\n.sap-ctl__knob {\n    position: absolute;\n    top: 2px;\n    left: 2px;\n    width: 18px;\n    height: 18px;\n    border-radius: 50%;\n    background-color: #ffffff;\n    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);\n    transition: transform 0.15s ease;\n}\n.sap-ctl__switch--on {\n    background-color: var(--ap-accent, #ffffff);\n}\n.sap-ctl__switch--on .sap-ctl__knob {\n    transform: translateX(18px);\n    background-color: var(--ap-play-icon, #000000);\n}\n\n/* Read-only metadata block in the Info section. */\n.sap-ctl__meta {\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    padding: 8px 12px;\n}\n.sap-ctl__meta-row {\n    display: flex;\n    align-items: baseline;\n    justify-content: space-between;\n    gap: 16px;\n    font-size: 13.5px;\n}\n.sap-ctl__meta-key {\n    flex-shrink: 0;\n    opacity: 0.5;\n    font-weight: 600;\n    text-transform: uppercase;\n    font-size: 10.5px;\n    letter-spacing: 0.06em;\n}\n.sap-ctl__meta-val {\n    min-width: 0;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    text-align: right;\n    font-weight: 500;\n}\n\n/* Lyrics disclosure body — scrolls inside the sheet. */\n.sap-ctl__lyrics {\n    margin: 4px 4px 8px;\n    padding: 12px 14px;\n    border-radius: 10px;\n    background-color: rgba(0, 0, 0, 0.25);\n    border: 1px solid rgba(255, 255, 255, 0.1);\n    font-size: 13.5px;\n    line-height: 1.7;\n    white-space: pre-wrap;\n    max-height: 220px;\n    overflow-y: auto;\n    scroll-behavior: smooth;\n}\n\n.sap-ctl__lyric-line {\n    transition: opacity 0.3s var(--ap-spring), transform 0.3s var(--ap-spring), font-weight 0.3s var(--ap-spring);\n    opacity: 0.4;\n    transform: scale(0.98);\n    transform-origin: left center;\n}\n\n.sap-ctl__lyric-line--active {\n    opacity: 1;\n    font-weight: 700;\n    transform: scale(1);\n    color: var(--ap-text);\n}\n\n/* Plugins list (read-only for V1). */\n.sap-ctl__plugins {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n    display: flex;\n    flex-direction: column;\n}\n.sap-ctl__plugin {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    min-height: 44px;\n    padding: 8px 12px;\n    font-size: 14px;\n    font-weight: 500;\n}\n\n/* Focused-workspace body (non-\"options\" routes). Shares the sheet chrome; the\n   content slot holds the route-specific placeholder surface for now. */\n.sap-ctl__workspace {\n    padding: 4px 0 8px;\n}\n.sap-ctl__workspace-empty {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n    padding: 24px 14px 28px;\n    text-align: center;\n}\n.sap-ctl__workspace-lead {\n    margin: 0;\n    font-size: 15px;\n    font-weight: 700;\n}\n.sap-ctl__workspace-sub {\n    margin: 0;\n    font-size: 13.5px;\n    line-height: 1.5;\n    opacity: 0.6;\n}\n\n@keyframes sap-sheet-in {\n    from {\n        transform: translateY(24px);\n        opacity: 0;\n    }\n    to {\n        transform: none;\n        opacity: 1;\n    }\n}\n@media (prefers-reduced-motion: reduce) {\n    .sap-ctl__sheet {\n        animation: none;\n    }\n    .sap-ctl__switch,\n    .sap-ctl__knob {\n        transition: none;\n    }\n}\n/* Measured marquee. The container clips; the inner span either truncates with\n   an ellipsis (static) or scrolls its overflow (when data-scroll=\"true\"). The\n   component only flips data-scroll on when the text actually overflows and\n   motion is allowed, so these rules never animate text that fits. */\n\n.ap-marquee {\n    min-width: 0;\n    max-width: 100%;\n    overflow: hidden;\n    white-space: nowrap;\n}\n\n.ap-marquee__inner {\n    display: inline-block;\n    max-width: 100%;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    vertical-align: bottom;\n}\n\n/* Scrolling state: let the text exceed the box and travel its overflow, easing\n   to a pause at each end (alternate), GPU-composited via translate3d. */\n.ap-marquee[data-scroll=\"true\"] .ap-marquee__inner {\n    max-width: none;\n    overflow: visible;\n    text-overflow: clip;\n    will-change: transform;\n    animation: ap-marquee-shift var(--ap-marquee-duration, 10s) ease-in-out\n        infinite alternate;\n}\n\n@keyframes ap-marquee-shift {\n    0%,\n    12% {\n        transform: translate3d(0, 0, 0);\n    }\n    88%,\n    100% {\n        transform: translate3d(calc(-1 * var(--ap-marquee-distance, 0px)), 0, 0);\n    }\n}\n\n/* Let people read it: pause while hovered or focused within. */\n.ap-marquee:hover .ap-marquee__inner,\n.ap-marquee:focus-within .ap-marquee__inner {\n    animation-play-state: paused;\n}\n\n@media (prefers-reduced-motion: reduce) {\n    .ap-marquee__inner {\n        animation: none !important;\n        max-width: 100%;\n        overflow: hidden;\n        text-overflow: ellipsis;\n    }\n}\n/* Shared metadata typography. Faces that render <TrackMetadata> inherit a\n   consistent hierarchy; the explicit badge / album / featured classes are also\n   reused inline by the compact faces that keep their own title/artist spans. */\n\n.ap-meta {\n    display: flex;\n    flex-direction: column;\n    min-width: 0;\n}\n\n.ap-meta__primary,\n.ap-meta__secondary,\n.ap-meta__tertiary {\n    min-width: 0;\n}\n\n.ap-meta__title {\n    display: block;\n    font-weight: var(--ap-title-weight, 600);\n    letter-spacing: var(--ap-title-tracking, -0.01em);\n    line-height: var(--ap-title-lh, 1.2);\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n\n.ap-meta__secondary {\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    opacity: 0.66;\n    font-weight: var(--ap-artist-weight, 500);\n    line-height: var(--ap-artist-lh, 1.3);\n}\n\n.ap-meta__featured {\n    opacity: 0.85;\n}\n.ap-meta__album {\n    opacity: 0.85;\n}\n\n.ap-meta__tertiary {\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    opacity: 0.5;\n    font-size: 0.85em;\n    margin-top: 2px;\n}\n\n/* Density presets. Faces can still override via their own scoped rules. */\n.ap-meta--hero .ap-meta__title {\n    font-size: var(--ap-title-size-lg, 24px);\n    letter-spacing: var(--ap-title-tracking, -0.02em);\n}\n.ap-meta--hero .ap-meta__secondary {\n    font-size: var(--ap-artist-size-lg, 15px);\n}\n.ap-meta--compact .ap-meta__title,\n.ap-meta--bar .ap-meta__title {\n    font-size: var(--ap-title-size-md, 15px);\n}\n.ap-meta--compact .ap-meta__secondary,\n.ap-meta--bar .ap-meta__secondary {\n    font-size: var(--ap-artist-size-md, 13px);\n}\n.ap-meta--row .ap-meta__title {\n    font-size: var(--ap-title-size-sm, 14px);\n}\n.ap-meta--row .ap-meta__secondary {\n    font-size: var(--ap-artist-size-sm, 12px);\n}\n\n/* Explicit-content badge. Shared by TrackMetadata and the in-place faces. */\n.ap-explicit-badge {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    flex-shrink: 0;\n    min-width: 14px;\n    height: 14px;\n    padding: 0 3px;\n    margin-left: 6px;\n    border-radius: 3px;\n    font-size: 9px;\n    font-weight: 700;\n    line-height: 1;\n    letter-spacing: 0.04em;\n    vertical-align: middle;\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 20%, transparent);\n    color: var(--ap-text, #fff);\n}\n/* SEIHouse Audio Player — zero-dependency styles.\n   Theming is driven by CSS custom properties set on .ap-root from props. */\n\n.ap-root {\n    --ap-accent: #ffffff;\n    --ap-play-icon: #000000;\n    --ap-text: #ffffff;\n    --ap-progress: #ffffff;\n    --ap-track: rgba(204, 204, 204, 0.35);\n    --ap-bg: rgba(255, 255, 255, 0);\n    --ap-blur: 20px;\n    /* Ambient glow color, transparent by default so it is invisible until a\n       feature (e.g. the Auto Theme plugin) sets it from the artwork. */\n    --ap-glow: transparent;\n    /* Unitless multiplier on the glow's size (1 = default) and a delta\n       applied to every shared button's fill translucency (0% = default\n       fill). Both are user-tunable via the property registry; their\n       fallbacks below reproduce the original hardcoded look exactly. */\n    --ap-glow-intensity: 1;\n    --ap-btn-opacity-delta: 0%;\n    --ap-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);\n\n    position: relative;\n    width: 100%;\n    height: 100%;\n    box-sizing: border-box;\n    padding: 24px;\n    border-radius: 16px;\n    overflow: hidden;\n    background-color: var(--ap-bg);\n    -webkit-backdrop-filter: blur(var(--ap-blur));\n    backdrop-filter: blur(var(--ap-blur));\n    box-shadow: inset 0 0.5px 0.5px rgba(255, 255, 255, 0.1),\n        0 1px 4px rgba(0, 0, 0, 0.08),\n        0 0 calc(60px * var(--ap-glow-intensity, 1))\n            calc(-10px * var(--ap-glow-intensity, 1)) var(--ap-glow);\n    transition: box-shadow 0.4s ease, background-color 0.4s ease, color 0.4s ease;\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n    /* Lets the player adapt to the width of whatever surface embeds it\n       (cards, sidebars, phone frames), not just the viewport. */\n    container: ap-player / inline-size;\n}\n\n.ap-root *,\n.ap-root *::before,\n.ap-root *::after {\n    box-sizing: border-box;\n}\n\n/* ----------------------------- Premium material system -----------------------------\n   Shared \"glass\" surface so bright/saturated user colors stay premium AND keep\n   their personality. The chosen --ap-bg hue is the star: a saturation boost\n   keeps it vivid, a directional top sheen reads as light catching glass, and\n   only a whisper of neutral scrim adds depth at the base. Readability is solved\n   locally — text shadows and the buttons' own material separation — NOT by\n   darkening the whole surface, so bright yellow/green/cyan never go olive/muddy.\n   Any face opts in with `.ap-glass-surface`; compact faces (less area for the\n   blur to do contrast work) add the `--compact` modifier for a touch more\n   depth. Faces may override the --ap-mat-* tokens inline to retint. */\n.ap-glass-surface {\n    /* A faint, mostly-bottom scrim for depth — kept low so it darkens without\n       desaturating the hue. The saturate() boost more than compensates. */\n    --ap-mat-scrim: rgba(12, 14, 22, 0.12);\n    /* Directional glass highlight along the top edge (fades out by ~halfway,\n       so the majority of the surface shows the pure, vivid color). */\n    --ap-mat-sheen: rgba(255, 255, 255, 0.22);\n    --ap-mat-border: rgba(255, 255, 255, 0.18);\n    --ap-mat-saturate: 185%;\n    background-color: var(--ap-bg);\n    background-image:\n        linear-gradient(165deg, var(--ap-mat-sheen), transparent 48%),\n        linear-gradient(0deg, var(--ap-mat-scrim), transparent 70%);\n    border: 1px solid var(--ap-mat-border);\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.22),\n        inset 0 0 0 1px rgba(255, 255, 255, 0.05),\n        0 10px 30px -10px rgba(0, 0, 0, 0.35);\n    -webkit-backdrop-filter: blur(var(--ap-blur, 20px)) saturate(var(--ap-mat-saturate));\n    backdrop-filter: blur(var(--ap-blur, 20px)) saturate(var(--ap-mat-saturate));\n}\n.ap-glass-surface--compact {\n    --ap-mat-scrim: rgba(12, 14, 22, 0.16);\n    --ap-mat-saturate: 178%;\n}\n/* Browsers without backdrop-filter lose the blur + saturation boost, so lean\n   harder on the scrim to keep content readable over a bright surface color. */\n@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n    .ap-glass-surface {\n        --ap-mat-scrim: rgba(12, 14, 22, 0.42);\n    }\n    .ap-glass-surface--compact {\n        --ap-mat-scrim: rgba(12, 14, 22, 0.48);\n    }\n}\n\n.ap-sr-only {\n    position: absolute;\n    left: -10000px;\n    width: 1px;\n    height: 1px;\n    overflow: hidden;\n}\n\n.ap-bg-image {\n    position: absolute;\n    inset: 0;\n    background-size: cover;\n    background-position: center;\n    filter: blur(var(--ap-blur));\n    z-index: 0;\n    border-radius: 16px;\n}\n.ap-bg-video {\n    position: absolute;\n    inset: 0;\n    width: 100%;\n    height: 100%;\n    object-fit: cover;\n    object-position: center;\n    filter: blur(var(--ap-blur));\n    z-index: 0;\n    border-radius: 16px;\n    pointer-events: none;\n}\n.ap-bg-darken {\n    position: absolute;\n    inset: 0;\n    z-index: 0;\n    border-radius: 16px;\n}\n\n.ap-content {\n    position: relative;\n    z-index: 1;\n    display: flex;\n    flex-direction: column;\n    gap: 16px;\n    width: 100%;\n}\n\n.ap-content > audio {\n    display: none;\n}\n\n/* ----------------------------- Banners ----------------------------- */\n\n.ap-banner {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    padding: 16px;\n    border-radius: 8px;\n    font-size: 14px;\n    font-weight: 500;\n}\n.ap-banner--col {\n    flex-direction: column;\n}\n.ap-banner__row {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n.ap-banner--error {\n    background-color: rgba(255, 59, 48, 0.15);\n    border: 1px solid rgba(255, 59, 48, 0.3);\n}\n.ap-banner--error svg {\n    color: #ff3b30;\n}\n.ap-retry-btn {\n    padding: 8px 16px;\n    border: none;\n    border-radius: 6px;\n    background-color: var(--ap-accent);\n    color: var(--ap-play-icon);\n    font-size: 13px;\n    font-weight: 600;\n    cursor: pointer;\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);\n}\n\n/* ----------------------------- Top actions (menu) ----------------------------- */\n\n.ap-top-actions {\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    z-index: 10;\n}\n\n.ap-menu {\n    position: relative;\n}\n.ap-menu__btn {\n    width: 36px;\n    height: 36px;\n    border-radius: 50%;\n    border: 1px solid color-mix(in srgb, var(--ap-accent) 50%, transparent);\n    background-color: color-mix(in srgb, var(--ap-accent) calc(18% + var(--ap-btn-opacity-delta, 0%)), var(--ap-bg));\n    color: var(--ap-accent);\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    cursor: pointer;\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.3),\n        inset 0 -1.5px 2px rgba(0, 0, 0, 0.12),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 2px 7px rgba(0, 0, 0, 0.2);\n    -webkit-backdrop-filter: blur(10px) saturate(140%);\n    backdrop-filter: blur(10px) saturate(140%);\n    padding: 0;\n    transition: transform 0.12s var(--ap-spring), box-shadow 0.18s var(--ap-spring), background-color 0.18s var(--ap-spring),\n        border-color 0.18s var(--ap-spring);\n}\n.ap-menu__btn:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(28% + var(--ap-btn-opacity-delta, 0%)), var(--ap-bg));\n    border-color: color-mix(in srgb, var(--ap-accent) 70%, transparent);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.38),\n        inset 0 -1.5px 2px rgba(0, 0, 0, 0.12),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 4px 11px rgba(0, 0, 0, 0.26);\n}\n.ap-menu__btn:active:not(:disabled) {\n    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);\n}\n.ap-menu__btn[aria-expanded=\"true\"] {\n    background-color: var(--ap-accent);\n    color: var(--ap-play-icon);\n}\n\n/* ----------------------------- Track info ----------------------------- */\n\n.ap-track-counter {\n    text-align: center;\n    font-size: 12px;\n    opacity: 0.5;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-track-info {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    min-width: 0;\n}\n.ap-track-info__title {\n    font-size: 24px;\n    font-weight: 600;\n    letter-spacing: -0.02em;\n    line-height: 1.2;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-track-info__artist {\n    font-size: 15px;\n    font-weight: 500;\n    opacity: 0.7;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n\n/* ----------------------------- Progress bar ----------------------------- */\n\n.ap-progress-group {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n.ap-progress {\n    position: relative;\n    height: 24px;\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    touch-action: pan-y;\n    outline: none;\n}\n.ap-progress--seeking {\n    touch-action: none;\n    cursor: grabbing;\n}\n.ap-progress__track,\n.ap-progress__buffered,\n.ap-progress__fill {\n    position: absolute;\n    left: 0;\n    height: 8px;\n    border-radius: 4px;\n    pointer-events: none;\n}\n.ap-progress__track {\n    width: 100%;\n    background-color: var(--ap-track);\n    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);\n}\n.ap-progress__buffered {\n    /* `background` (not `background-color`) so --ap-progress may be a gradient. */\n    background: var(--ap-progress);\n    opacity: 0.3;\n}\n.ap-progress__fill {\n    background: var(--ap-progress);\n}\n.ap-progress__thumb {\n    position: absolute;\n    top: 50%;\n    width: 16px;\n    height: 16px;\n    border-radius: 50%;\n    background-color: var(--ap-accent);\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);\n    transform: translate(-50%, -50%);\n    pointer-events: none;\n    transition: transform 0.15s var(--ap-spring);\n}\n.ap-progress:hover .ap-progress__thumb,\n.ap-progress--seeking .ap-progress__thumb {\n    transform: translate(-50%, -50%) scale(1.15);\n}\n.ap-progress:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n    border-radius: 6px;\n}\n.ap-progress[aria-disabled=\"true\"] {\n    opacity: 0.5;\n    cursor: not-allowed;\n}\n\n.ap-times {\n    display: flex;\n    justify-content: space-between;\n    font-size: 12px;\n    opacity: 0.7;\n}\n\n/* ----------------------------- Waveform scrubber ----------------------------- */\n\n.ap-waveform {\n    position: relative;\n}\n.ap-waveform__surface {\n    position: absolute;\n    inset: 0;\n    cursor: pointer;\n    outline: none;\n}\n.ap-waveform--seeking .ap-waveform__surface {\n    cursor: grabbing;\n}\n.ap-waveform__canvas {\n    position: absolute;\n    inset: 0;\n}\n.ap-waveform__buffered {\n    position: absolute;\n    left: 0;\n    bottom: 0;\n    height: 2px;\n    border-radius: 1px;\n    background-color: var(--ap-progress);\n    opacity: 0.3;\n    pointer-events: none;\n    transition: width 0.2s linear;\n}\n.ap-waveform__surface:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n    border-radius: 6px;\n}\n/* ProgressBar fallback while peaks load (or when they can't be produced):\n   vertically centered in the same fixed-height slot so layout never shifts. */\n.ap-waveform__fallback {\n    position: absolute;\n    inset: 0;\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-waveform__buffered {\n        transition: none;\n    }\n}\n\n/* ----------------------------- Transport ----------------------------- */\n\n.ap-transport {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    gap: 12px;\n}\n.ap-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    border-radius: 50%;\n    cursor: pointer;\n    flex-shrink: 0;\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);\n    transition: transform 0.12s var(--ap-spring), box-shadow 0.18s var(--ap-spring),\n        background-color 0.18s var(--ap-spring), border-color 0.18s var(--ap-spring);\n}\n.ap-btn svg {\n    animation: ap-pop-in 0.35s var(--ap-spring);\n}\n.ap-btn:disabled {\n    cursor: not-allowed;\n    opacity: 0.5;\n}\n/* Premium glass treatment: a raised, dimensional control instead of a flat\n   icon printed on the surface color. A tinted glass fill (not transparent)\n   plus an inner highlight + soft outer shadow read as a physical button on\n   any surface color, bright or dark. */\n.ap-btn--ghost {\n    width: 40px;\n    height: 40px;\n    border: 1.5px solid color-mix(in srgb, var(--ap-accent) 50%, transparent);\n    background-color: color-mix(in srgb, var(--ap-accent) calc(18% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    color: var(--ap-accent);\n    /* Top highlight + bottom inner shadow = a bevel; the hairline outer ring\n       separates the control from a same-color surface; the soft drop lifts it. */\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.35),\n        inset 0 -2px 3px rgba(0, 0, 0, 0.14),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 3px 8px -2px rgba(0, 0, 0, 0.22);\n    /* Saturate keeps the accent tint vivid through the frosted fill. */\n    -webkit-backdrop-filter: blur(10px) saturate(140%);\n    backdrop-filter: blur(10px) saturate(140%);\n}\n.ap-btn--ghost:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(28% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    border-color: color-mix(in srgb, var(--ap-accent) 72%, transparent);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.42),\n        inset 0 -2px 3px rgba(0, 0, 0, 0.14),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 5px 13px -3px rgba(0, 0, 0, 0.3);\n}\n.ap-btn--ghost:active:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(22% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    box-shadow:\n        inset 0 2px 4px rgba(0, 0, 0, 0.28),\n        0 1px 2px rgba(0, 0, 0, 0.12);\n}\n.ap-btn--sm {\n    /* Anchor for the coarse-pointer hit-area pseudo-element. Kept off\n       .ap-btn itself because skins reposition some buttons absolutely. */\n    position: relative;\n    width: 28px;\n    height: 28px;\n    opacity: 0.6;\n}\n.ap-btn--play {\n    width: 60px;\n    height: 60px;\n    /* See-through glass body like the other transport controls — the accent\n       reads through a frosted tint rather than a solid fill, and an accent\n       glow (below) does the work of marking it as the primary control. */\n    border: 1px solid color-mix(in srgb, var(--ap-accent) 60%, transparent);\n    background-color: color-mix(in srgb, var(--ap-accent) calc(24% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    background-image: linear-gradient(165deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.04) 52%, transparent 74%);\n    /* Accent icon (not --ap-play-icon): a dark icon can't be read on a\n       translucent body, and this matches the accent icons of the other\n       transport buttons. */\n    color: var(--ap-accent);\n    -webkit-backdrop-filter: blur(10px) saturate(170%);\n    backdrop-filter: blur(10px) saturate(170%);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.4),\n        inset 0 -2px 4px rgba(0, 0, 0, 0.12),\n        0 0 0 1px color-mix(in srgb, var(--ap-accent) 28%, transparent),\n        0 0 calc(20px * var(--ap-glow-intensity, 1)) -2px color-mix(in srgb, var(--ap-accent) 60%, transparent),\n        0 6px 16px -6px rgba(0, 0, 0, 0.4);\n}\n.ap-btn--play:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(32% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    border-color: color-mix(in srgb, var(--ap-accent) 78%, transparent);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.48),\n        inset 0 -2px 4px rgba(0, 0, 0, 0.12),\n        0 0 0 1px color-mix(in srgb, var(--ap-accent) 36%, transparent),\n        0 0 calc(30px * var(--ap-glow-intensity, 1)) 0 color-mix(in srgb, var(--ap-accent) 72%, transparent),\n        0 9px 22px -6px rgba(0, 0, 0, 0.45);\n}\n.ap-btn--play:active:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(28% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    box-shadow:\n        inset 0 2px 5px rgba(0, 0, 0, 0.22),\n        0 0 calc(16px * var(--ap-glow-intensity, 1)) -2px color-mix(in srgb, var(--ap-accent) 55%, transparent),\n        0 2px 6px -2px rgba(0, 0, 0, 0.3);\n}\n.ap-btn--play-active {\n    animation: ap-pulse 3s ease-in-out infinite;\n}\n\n/* ----------------------------- Volume ----------------------------- */\n\n.ap-volume {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n}\n.ap-icon-btn {\n    position: relative;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 32px;\n    height: 32px;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 18%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) calc(10% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    color: var(--ap-accent);\n    cursor: pointer;\n    border-radius: 9px;\n    /* Frosted glass chip: top highlight + bottom inner shade for a soft bevel,\n       a light drop so it sits above the surface rather than printed on it. */\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.2),\n        inset 0 -1px 1px rgba(0, 0, 0, 0.1),\n        0 1px 4px rgba(0, 0, 0, 0.16);\n    -webkit-backdrop-filter: blur(8px) saturate(130%);\n    backdrop-filter: blur(8px) saturate(130%);\n    transition: transform 0.12s var(--ap-spring), box-shadow 0.18s var(--ap-spring), background-color 0.18s var(--ap-spring),\n        border-color 0.18s var(--ap-spring);\n}\n.ap-icon-btn svg {\n    animation: ap-pop-in 0.35s var(--ap-spring);\n}\n.ap-icon-btn:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-text, #fff) calc(18% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    border-color: color-mix(in srgb, var(--ap-text, #fff) 26%, transparent);\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.24),\n        inset 0 -1px 1px rgba(0, 0, 0, 0.1),\n        0 2px 7px rgba(0, 0, 0, 0.2);\n}\n.ap-icon-btn:active:not(:disabled) {\n    box-shadow: inset 0 1.5px 3px rgba(0, 0, 0, 0.22);\n}\n.ap-icon-btn:disabled {\n    opacity: 0.5;\n    cursor: not-allowed;\n}\n.ap-volume__slider {\n    position: relative;\n    flex: 1;\n    max-width: 140px;\n    height: 20px;\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    touch-action: none;\n    outline: none;\n}\n.ap-volume__track,\n.ap-volume__fill {\n    position: absolute;\n    left: 0;\n    height: 6px;\n    border-radius: 3px;\n    pointer-events: none;\n}\n.ap-volume__track {\n    width: 100%;\n    background-color: var(--ap-track);\n}\n.ap-volume__fill {\n    background-color: var(--ap-progress);\n}\n.ap-volume__thumb {\n    position: absolute;\n    top: 50%;\n    width: 12px;\n    height: 12px;\n    border-radius: 50%;\n    background-color: var(--ap-accent);\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);\n    transform: translate(-50%, -50%);\n    pointer-events: none;\n}\n.ap-volume__slider:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n    border-radius: 6px;\n}\n\n/* ----------------------------- Wide buttons ----------------------------- */\n\n.ap-wide-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    padding: 12px 24px;\n    border-radius: 8px;\n    font-size: 14px;\n    font-weight: 600;\n    cursor: pointer;\n    text-decoration: none;\n    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15),\n        inset 0 1px 0 rgba(255, 255, 255, 0.2);\n}\n.ap-wide-btn--ghost {\n    background-color: transparent;\n    border: 1px solid var(--ap-accent);\n    color: var(--ap-accent);\n}\n.ap-wide-btn--solid {\n    background-color: var(--ap-accent);\n    color: var(--ap-play-icon);\n    border: none;\n}\n\n/* ----------------------------- Lyrics ----------------------------- */\n\n.ap-lyrics {\n    padding: 16px;\n    border-radius: 8px;\n    background-color: rgba(0, 0, 0, 0.2);\n    border: 1px solid var(--ap-accent);\n    font-size: 14px;\n    line-height: 1.6;\n    white-space: pre-wrap;\n    max-height: 200px;\n    overflow-y: auto;\n}\n\n/* ----------------------------- Tracklist ----------------------------- */\n\n.ap-tracklist {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    margin-top: 8px;\n    padding: 12px;\n    border-radius: 8px;\n    background-color: rgba(0, 0, 0, 0.2);\n    border: 1px solid var(--ap-accent);\n    max-height: 300px;\n    overflow-y: auto;\n}\n.ap-tracklist__item {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 10px 12px;\n    border-radius: 6px;\n    background-color: transparent;\n    border: 1px solid transparent;\n    color: var(--ap-text);\n    cursor: pointer;\n    text-align: left;\n    transition: background-color 0.2s ease;\n}\n.ap-tracklist__item:hover {\n    background-color: rgba(255, 255, 255, 0.08);\n}\n.ap-tracklist__item--active {\n    background-color: rgba(255, 255, 255, 0.15);\n    border-color: var(--ap-accent);\n}\n.ap-tracklist__num {\n    min-width: 24px;\n    font-size: 14px;\n    font-weight: 500;\n    opacity: 0.6;\n}\n.ap-tracklist__item--active .ap-tracklist__num {\n    opacity: 1;\n    font-weight: 700;\n}\n.ap-tracklist__meta {\n    flex: 1;\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    overflow: hidden;\n}\n.ap-tracklist__title {\n    font-size: 14px;\n    font-weight: 500;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-tracklist__artist {\n    font-size: 12px;\n    opacity: 0.6;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n\n/* Equalizer bars on the active, playing track. */\n.ap-eq {\n    display: flex;\n    align-items: center;\n    gap: 2px;\n}\n.ap-eq i {\n    width: 3px;\n    height: 12px;\n    border-radius: 2px;\n    background-color: var(--ap-accent);\n    animation: ap-eq 1s ease-in-out infinite;\n}\n.ap-eq i:nth-child(2) {\n    height: 16px;\n    animation-delay: 0.2s;\n}\n.ap-eq i:nth-child(3) {\n    animation-delay: 0.4s;\n}\n\n/* ----------------------------- Animations ----------------------------- */\n\n.ap-tap {\n    transition: transform 0.1s var(--ap-spring);\n}\n.ap-tap:active:not(:disabled) {\n    transform: scale(0.92);\n}\n\n.ap-spin {\n    animation: ap-spin 1s linear infinite;\n    transform-origin: center;\n}\n\n.ap-anim-in {\n    animation: ap-fade-in 0.25s ease;\n}\n\n.ap-root :focus-visible {\n    outline: none;\n}\n.ap-btn:focus-visible,\n.ap-icon-btn:focus-visible,\n.ap-wide-btn:focus-visible,\n.ap-tracklist__item:focus-visible,\n.ap-retry-btn:focus-visible,\n.ap-menu__btn:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n}\n\n@keyframes ap-pulse {\n    0%,\n    100% {\n        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15),\n            inset 0 1px 0 rgba(255, 255, 255, 0.2),\n            0 0 0 0 transparent;\n    }\n    50% {\n        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15),\n            inset 0 1px 0 rgba(255, 255, 255, 0.2),\n            0 0 16px 4px var(--ap-accent);\n    }\n}\n@keyframes ap-spin {\n    to {\n        transform: rotate(360deg);\n    }\n}\n@keyframes ap-fade-in {\n    from {\n        opacity: 0;\n        transform: translateY(-6px);\n    }\n    to {\n        opacity: 1;\n        transform: translateY(0);\n    }\n}\n@keyframes ap-eq {\n    0%,\n    100% {\n        opacity: 0.5;\n        transform: scaleY(0.7);\n    }\n    50% {\n        opacity: 1;\n        transform: scaleY(1);\n    }\n}\n@keyframes ap-pop-in {\n    0% {\n        transform: scale(0.6) rotate(-10deg);\n        opacity: 0;\n    }\n    100% {\n        transform: scale(1) rotate(0deg);\n        opacity: 1;\n    }\n}\n\n/* Real mobile viewports (full-bleed player on a phone). */\n@media (max-width: 480px) {\n    .ap-root {\n        padding: 16px;\n    }\n    .ap-content {\n        gap: 12px;\n    }\n    .ap-track-info__title {\n        font-size: clamp(17px, 5.5vw, 22px);\n    }\n    .ap-track-info__artist {\n        font-size: 13px;\n    }\n    .ap-progress__thumb {\n        width: 18px;\n        height: 18px;\n    }\n    .ap-transport {\n        gap: 8px;\n    }\n    .ap-btn--play {\n        width: 56px;\n        height: 56px;\n    }\n    .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 38px;\n        height: 38px;\n    }\n}\n\n/* Narrow embeds (marketplace cards, sidebars, phone frames) where the\n   viewport is wide but the player itself is cramped. Mirrors the mobile\n   media query above, sized against the player's own width. */\n@container ap-player (max-width: 420px) {\n    .ap-content {\n        gap: 12px;\n    }\n    .ap-track-info__title {\n        font-size: clamp(17px, 6.5cqw, 22px);\n    }\n    .ap-track-info__artist {\n        font-size: 13px;\n    }\n    .ap-track-counter {\n        font-size: 11px;\n    }\n    .ap-transport {\n        gap: 8px;\n    }\n    .ap-btn--play {\n        width: 56px;\n        height: 56px;\n    }\n    .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 38px;\n        height: 38px;\n    }\n}\n\n/* Ultra-narrow embeds (deeply nested cards at 320px viewports): shrink the\n   transport one more step so the five-button row never clips. Budget:\n   26 + 34 + 48 + 34 + 26 + 4×6 gaps = 192px. */\n@container ap-player (max-width: 300px) {\n    .ap-transport {\n        gap: 6px;\n    }\n    .ap-btn--play {\n        width: 48px;\n        height: 48px;\n    }\n    .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 34px;\n        height: 34px;\n    }\n    .ap-btn--sm {\n        width: 26px;\n        height: 26px;\n    }\n}\n\n/* Touch devices: grow the hit area to at least 44×44px without changing\n   the visual size. All interactive elements must ensure their total touch\n   target (visual size + pseudo-element expansion) meets 44×44px minimum.\n\n   Approach: expand via an absolutely-positioned ::after pseudo-element.\n   The parent must have position: relative for inset to resolve correctly.\n   Elements already ≥44px (e.g. .ap-btn--play at 60px) don't need expansion. */\n@media (pointer: coarse) {\n    /* Ensure all interactive elements have position context for ::after. */\n    .ap-btn,\n    .ap-btn--sm,\n    .ap-icon-btn,\n    .ap-menu__btn,\n    .ap-q-header__close,\n    .ap-q-row__play-btn,\n    .ap-q-row__remove,\n    .ap-wide-btn,\n    .ap-retry-btn {\n        position: relative;\n    }\n\n    /* Ghost buttons (40×40) need 2px extra per side → 44×44. */\n    .ap-btn--ghost::after {\n        content: \"\";\n        position: absolute;\n        inset: -2px;\n    }\n\n    /* Small ghost buttons (28×28) need 8px per side → 44×44. */\n    .ap-btn--sm::after,\n    /* Icon buttons (32×32) need 6px per side → 44×44. */\n    .ap-icon-btn::after,\n    /* Menu toggle (36×36) needs 4px per side → 44×44. */\n    .ap-menu__btn::after,\n    /* Queue header close (36×36) needs 4px per side → 44×44. */\n    .ap-q-header__close::after,\n    /* Queue row play (28×28) needs 8px per side → 44×44. */\n    .ap-q-row__play-btn::after {\n        content: \"\";\n        position: absolute;\n        inset: -8px;\n    }\n\n    /* Queue row remove (24×24) needs 10px per side → 44×44. */\n    .ap-q-row__remove::after {\n        content: \"\";\n        position: absolute;\n        inset: -10px;\n    }\n    /* Retry button — content-sized, 8px per side is a generous cushion. */\n    .ap-retry-btn::after,\n    /* Wide button — content-sized, 4px per side works. */\n    .ap-wide-btn::after {\n        content: \"\";\n        position: absolute;\n        inset: -8px;\n    }\n\n    /* Progress bar thumb: the visual thumb is ~16px, but the touch target\n       must be 44px. Set the element size to 44px and scale its visual\n       appearance down so it still looks like a 16px dot. */\n    .ap-progress__thumb {\n        width: 44px;\n        height: 44px;\n        transform: translate(-50%, -50%) scale(0.36);\n        transform-origin: center center;\n    }\n    .ap-progress:hover .ap-progress__thumb,\n    .ap-progress--seeking .ap-progress__thumb {\n        transform: translate(-50%, -50%) scale(0.42);\n    }\n\n    /* Volume slider thumb: same approach — 44px touch target, scaled\n       visual to match the original ~12px appearance. */\n    .ap-volume__thumb {\n        width: 44px;\n        height: 44px;\n        transform: translate(-50%, -50%) scale(0.27);\n        transform-origin: center center;\n    }\n}\n\n@media (prefers-reduced-motion: reduce) {\n    .ap-btn--play-active,\n    .ap-spin,\n    .ap-anim-in,\n    .ap-eq i,\n    .ap-tap,\n    .ap-btn,\n    .ap-icon-btn,\n    .ap-menu__btn,\n    .ap-surface-btn {\n        animation: none !important;\n        transition: none !important;\n    }\n}\n\n/* ----------------------------- Upgrades ----------------------------- */\n\n/* Soft informational banner used for non-error states (e.g. autoplay\n   blocked) so it reads as guidance instead of a failure. */\n.ap-banner--info {\n    background-color: rgba(255, 255, 255, 0.08);\n    border: 1px solid rgba(255, 255, 255, 0.18);\n}\n.ap-banner--info svg {\n    color: var(--ap-accent);\n}\n\n/* The error boundary renders an inline fallback when a child crashes. */\n.ap-error-boundary {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    padding: 16px;\n    border-radius: 8px;\n    background-color: rgba(255, 59, 48, 0.15);\n    border: 1px solid rgba(255, 59, 48, 0.3);\n    color: var(--ap-text);\n    font-size: 13px;\n    text-align: center;\n}\n.ap-error-boundary__title {\n    margin: 0;\n    font-weight: 600;\n}\n.ap-error-boundary__message {\n    margin: 0;\n    opacity: 0.8;\n    word-break: break-word;\n}\n\n/* iOS / unsupported-volume hint badge. */\n.ap-volume__hint {\n    font-size: 10px;\n    font-weight: 700;\n    letter-spacing: 0.05em;\n    padding: 2px 6px;\n    border-radius: 4px;\n    background-color: rgba(255, 255, 255, 0.15);\n    color: var(--ap-text);\n    text-transform: uppercase;\n    user-select: none;\n}\n\n/* Prevent text selection on long-press drag for the slider tracks so\n   iOS Safari does not highlight them while scrubbing. */\n.ap-progress,\n.ap-volume__slider {\n    user-select: none;\n    -webkit-user-select: none;\n}\n\n/* While the tab is hidden we suspend the equalizer animation so backgrounded\n   tabs do not waste battery / GPU. */\n.ap-root--hidden .ap-eq i,\n.ap-root--hidden .ap-btn--play-active {\n    animation-play-state: paused;\n}\n\n.sap-sleep-timer {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    align-self: flex-start;\n    margin-top: 8px;\n    color: var(--ap-text);\n    font-size: 12px;\n}\n\n.sap-sleep-timer__label {\n    opacity: 0.72;\n}\n\n.sap-sleep-timer__select {\n    min-width: 128px;\n    height: 30px;\n    border: 1px solid rgba(255, 255, 255, 0.2);\n    border-radius: 6px;\n    background-color: rgba(0, 0, 0, 0.24);\n    color: var(--ap-text);\n    font: inherit;\n    padding: 0 8px;\n}\n\n.sap-sleep-timer__select:focus-visible {\n    outline: 2px solid var(--ap-accent);\n    outline-offset: 2px;\n}\n\n/* ----------------------------- Queue Drawer (Up Next) ----------------------------- */\n\n.ap-q-overlay {\n    position: fixed;\n    inset: 0;\n    z-index: 100;\n    display: flex;\n    justify-content: flex-end;\n    align-items: stretch;\n}\n\n.ap-q-backdrop {\n    position: absolute;\n    inset: 0;\n    background-color: rgba(0, 0, 0, 0.5);\n    cursor: pointer;\n}\n\n.ap-q-drawer {\n    position: relative;\n    width: min(400px, 100vw);\n    max-width: 100vw;\n    height: 100%;\n    background-color: rgba(20, 20, 24, 0.97);\n    backdrop-filter: blur(20px);\n    -webkit-backdrop-filter: blur(20px);\n    border-left: 1px solid rgba(255, 255, 255, 0.1);\n    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);\n    display: flex;\n    flex-direction: column;\n    color: var(--ap-text, #ffffff);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n\n.ap-q-header {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 20px 20px 12px;\n    border-bottom: 1px solid rgba(255, 255, 255, 0.08);\n    flex-shrink: 0;\n}\n\n.ap-q-header__title {\n    margin: 0;\n    font-size: 18px;\n    font-weight: 700;\n    flex: 1;\n}\n\n.ap-q-header__count {\n    font-size: 13px;\n    opacity: 0.5;\n    font-weight: 500;\n}\n\n.ap-q-header__close {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 36px;\n    height: 36px;\n    border: none;\n    background: transparent;\n    color: var(--ap-text, #ffffff);\n    cursor: pointer;\n    border-radius: 50%;\n    flex-shrink: 0;\n}\n\n.ap-q-header__close:hover {\n    background-color: rgba(255, 255, 255, 0.08);\n}\n\n.ap-q-header__close svg {\n    width: 20px;\n    height: 20px;\n}\n\n/* Queue list */\n.ap-q-list {\n    flex: 1;\n    overflow-y: auto;\n    padding: 8px 0;\n    -webkit-overflow-scrolling: touch;\n}\n\n/* Queue row */\n.ap-q-row {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 8px 20px;\n    user-select: none;\n    -webkit-user-select: none;\n    cursor: default;\n    transition: background-color 0.15s ease, transform 0.05s ease;\n    touch-action: none;\n    position: relative;\n    z-index: 1;\n}\n\n.ap-q-row:hover {\n    background-color: rgba(255, 255, 255, 0.04);\n}\n\n.ap-q-row--active {\n    background-color: rgba(255, 255, 255, 0.08);\n}\n\n.ap-q-row--active:hover {\n    background-color: rgba(255, 255, 255, 0.10);\n}\n\n.ap-q-row--dragging {\n    z-index: 10;\n    opacity: 0.9;\n    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n    background-color: rgba(255, 255, 255, 0.10);\n}\n\n.ap-q-row__drag {\n    display: flex;\n    align-items: center;\n    cursor: grab;\n    color: var(--ap-text, #ffffff);\n    opacity: 0.3;\n    flex-shrink: 0;\n    padding: 4px;\n    border-radius: 4px;\n    touch-action: none;\n}\n\n.ap-q-row__drag:hover {\n    opacity: 0.6;\n}\n\n.ap-q-row__drag:active {\n    cursor: grabbing;\n}\n\n.ap-q-row__num {\n    min-width: 24px;\n    font-size: 13px;\n    font-weight: 600;\n    opacity: 0.5;\n    text-align: center;\n    flex-shrink: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n}\n\n.ap-q-row--active .ap-q-row__num {\n    opacity: 1;\n}\n\n.ap-q-row__meta {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n}\n\n.ap-q-row__title {\n    font-size: 14px;\n    font-weight: 500;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n\n.ap-q-row--active .ap-q-row__title {\n    font-weight: 600;\n}\n\n.ap-q-row__artist {\n    font-size: 12px;\n    opacity: 0.5;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n\n.ap-q-row__badge {\n    font-size: 10px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.05em;\n    padding: 3px 8px;\n    border-radius: 999px;\n    background-color: var(--ap-accent, #ffffff);\n    color: var(--ap-play-icon, #000000);\n    flex-shrink: 0;\n    white-space: nowrap;\n}\n\n.ap-q-row__play-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 28px;\n    height: 28px;\n    border: none;\n    background: transparent;\n    color: var(--ap-accent, #ffffff);\n    cursor: pointer;\n    border-radius: 50%;\n    flex-shrink: 0;\n    opacity: 0;\n    transition: opacity 0.15s ease;\n}\n\n.ap-q-row:hover .ap-q-row__play-btn {\n    opacity: 1;\n}\n\n.ap-q-row__play-btn:hover {\n    background-color: rgba(255, 255, 255, 0.12);\n}\n\n.ap-q-row__remove {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 24px;\n    height: 24px;\n    border: none;\n    background: transparent;\n    color: var(--ap-text, #ffffff);\n    cursor: pointer;\n    border-radius: 50%;\n    flex-shrink: 0;\n    opacity: 0.2;\n    transition: opacity 0.15s ease, color 0.15s ease;\n}\n\n.ap-q-row:hover .ap-q-row__remove {\n    opacity: 0.5;\n}\n\n.ap-q-row__remove:hover {\n    opacity: 1 !important;\n    color: #ff5a55;\n}\n\n/* Empty state */\n.ap-q-empty {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: 40px 20px;\n    text-align: center;\n    opacity: 0.5;\n    font-size: 14px;\n}\n\n/* Responsive: full-screen drawer on small screens. */\n@media (max-width: 480px) {\n    .ap-q-drawer {\n        width: 100vw;\n        border-left: none;\n    }\n}\n/* Consolidated seek/track controls. Tap seeks 10s; intentional hold skips track. */\n.ap-sr-only {\n    position: absolute;\n    width: 1px;\n    height: 1px;\n    padding: 0;\n    margin: -1px;\n    overflow: hidden;\n    clip: rect(0, 0, 0, 0);\n    white-space: nowrap;\n    border: 0;\n}\n.ap-hold-skip {\n    position: relative;\n    overflow: visible;\n    touch-action: manipulation;\n    user-select: none;\n    -webkit-user-select: none;\n}\n.ap-hold-skip__icon {\n    position: relative;\n    z-index: 1;\n    display: inline-flex;\n}\n.ap-hold-skip__progress {\n    position: absolute;\n    inset: 3px;\n    border-radius: inherit;\n    background: conic-gradient(var(--ap-accent) 0deg, transparent 0deg);\n    opacity: 0;\n    pointer-events: none;\n}\n.ap-hold-skip__progress::after {\n    content: \"\";\n    position: absolute;\n    inset: 3px;\n    border-radius: inherit;\n    background: var(--ap-bg, rgba(20, 20, 24, 0.96));\n}\n.ap-hold-skip--holding:not(:disabled) .ap-hold-skip__progress {\n    opacity: 0.72;\n    animation: ap-hold-skip-progress var(--ap-hold-ms, 1200ms) linear forwards;\n}\n.ap-hold-skip--holding:not(:disabled)::before {\n    content: attr(data-hold-label);\n    position: absolute;\n    left: 50%;\n    bottom: -18px;\n    transform: translateX(-50%);\n    font-size: 9px;\n    font-weight: 700;\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n    color: var(--ap-accent);\n    opacity: 0.85;\n}\n@keyframes ap-hold-skip-progress {\n    from { background: conic-gradient(var(--ap-accent) 0deg, transparent 0deg); }\n    to { background: conic-gradient(var(--ap-accent) 360deg, transparent 360deg); }\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-hold-skip--holding:not(:disabled) .ap-hold-skip__progress {\n        animation: none;\n        background: conic-gradient(var(--ap-accent) 270deg, transparent 270deg);\n    }\n}\n/* Session-driven skins. Shared control styling (ap-btn, ap-icon-btn,\n   ap-progress, ap-volume, ap-eq, ap-banner, ap-tap, ...) comes from the base\n   stylesheet; we import it so a page that uses only skins still gets it.\n   Each skin sets the same --ap-* theme tokens on its root (see themeVars.ts),\n   so the reused ProgressBar / VolumeControl inherit the right colors. */\n/* SEIHouse Audio Player — zero-dependency styles.\n   Theming is driven by CSS custom properties set on .ap-root from props. */\n.ap-root {\n    --ap-accent: #ffffff;\n    --ap-play-icon: #000000;\n    --ap-text: #ffffff;\n    --ap-progress: #ffffff;\n    --ap-track: rgba(204, 204, 204, 0.35);\n    --ap-bg: rgba(255, 255, 255, 0);\n    --ap-blur: 20px;\n    /* Ambient glow color, transparent by default so it is invisible until a\n       feature (e.g. the Auto Theme plugin) sets it from the artwork. */\n    --ap-glow: transparent;\n    /* Unitless multiplier on the glow's size (1 = default) and a delta\n       applied to every shared button's fill translucency (0% = default\n       fill). Both are user-tunable via the property registry; their\n       fallbacks below reproduce the original hardcoded look exactly. */\n    --ap-glow-intensity: 1;\n    --ap-btn-opacity-delta: 0%;\n    --ap-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);\n\n    position: relative;\n    width: 100%;\n    height: 100%;\n    box-sizing: border-box;\n    padding: 24px;\n    border-radius: 16px;\n    overflow: hidden;\n    background-color: var(--ap-bg);\n    -webkit-backdrop-filter: blur(var(--ap-blur));\n    backdrop-filter: blur(var(--ap-blur));\n    box-shadow: inset 0 0.5px 0.5px rgba(255, 255, 255, 0.1),\n        0 1px 4px rgba(0, 0, 0, 0.08),\n        0 0 calc(60px * var(--ap-glow-intensity, 1))\n            calc(-10px * var(--ap-glow-intensity, 1)) var(--ap-glow);\n    transition: box-shadow 0.4s ease, background-color 0.4s ease, color 0.4s ease;\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n    /* Lets the player adapt to the width of whatever surface embeds it\n       (cards, sidebars, phone frames), not just the viewport. */\n    container: ap-player / inline-size;\n}\n.ap-root *,\n.ap-root *::before,\n.ap-root *::after {\n    box-sizing: border-box;\n}\n/* ----------------------------- Premium material system -----------------------------\n   Shared \"glass\" surface so bright/saturated user colors stay premium AND keep\n   their personality. The chosen --ap-bg hue is the star: a saturation boost\n   keeps it vivid, a directional top sheen reads as light catching glass, and\n   only a whisper of neutral scrim adds depth at the base. Readability is solved\n   locally — text shadows and the buttons' own material separation — NOT by\n   darkening the whole surface, so bright yellow/green/cyan never go olive/muddy.\n   Any face opts in with `.ap-glass-surface`; compact faces (less area for the\n   blur to do contrast work) add the `--compact` modifier for a touch more\n   depth. Faces may override the --ap-mat-* tokens inline to retint. */\n.ap-glass-surface {\n    /* A faint, mostly-bottom scrim for depth — kept low so it darkens without\n       desaturating the hue. The saturate() boost more than compensates. */\n    --ap-mat-scrim: rgba(12, 14, 22, 0.12);\n    /* Directional glass highlight along the top edge (fades out by ~halfway,\n       so the majority of the surface shows the pure, vivid color). */\n    --ap-mat-sheen: rgba(255, 255, 255, 0.22);\n    --ap-mat-border: rgba(255, 255, 255, 0.18);\n    --ap-mat-saturate: 185%;\n    background-color: var(--ap-bg);\n    background-image:\n        linear-gradient(165deg, var(--ap-mat-sheen), transparent 48%),\n        linear-gradient(0deg, var(--ap-mat-scrim), transparent 70%);\n    border: 1px solid var(--ap-mat-border);\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.22),\n        inset 0 0 0 1px rgba(255, 255, 255, 0.05),\n        0 10px 30px -10px rgba(0, 0, 0, 0.35);\n    -webkit-backdrop-filter: blur(var(--ap-blur, 20px)) saturate(var(--ap-mat-saturate));\n    backdrop-filter: blur(var(--ap-blur, 20px)) saturate(var(--ap-mat-saturate));\n}\n.ap-glass-surface--compact {\n    --ap-mat-scrim: rgba(12, 14, 22, 0.16);\n    --ap-mat-saturate: 178%;\n}\n/* Browsers without backdrop-filter lose the blur + saturation boost, so lean\n   harder on the scrim to keep content readable over a bright surface color. */\n@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n    .ap-glass-surface {\n        --ap-mat-scrim: rgba(12, 14, 22, 0.42);\n    }\n    .ap-glass-surface--compact {\n        --ap-mat-scrim: rgba(12, 14, 22, 0.48);\n    }\n}\n.ap-sr-only {\n    position: absolute;\n    left: -10000px;\n    width: 1px;\n    height: 1px;\n    overflow: hidden;\n}\n.ap-bg-image {\n    position: absolute;\n    inset: 0;\n    background-size: cover;\n    background-position: center;\n    filter: blur(var(--ap-blur));\n    z-index: 0;\n    border-radius: 16px;\n}\n.ap-bg-video {\n    position: absolute;\n    inset: 0;\n    width: 100%;\n    height: 100%;\n    object-fit: cover;\n    object-position: center;\n    filter: blur(var(--ap-blur));\n    z-index: 0;\n    border-radius: 16px;\n    pointer-events: none;\n}\n.ap-bg-darken {\n    position: absolute;\n    inset: 0;\n    z-index: 0;\n    border-radius: 16px;\n}\n.ap-content {\n    position: relative;\n    z-index: 1;\n    display: flex;\n    flex-direction: column;\n    gap: 16px;\n    width: 100%;\n}\n.ap-content > audio {\n    display: none;\n}\n/* ----------------------------- Banners ----------------------------- */\n.ap-banner {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    padding: 16px;\n    border-radius: 8px;\n    font-size: 14px;\n    font-weight: 500;\n}\n.ap-banner--col {\n    flex-direction: column;\n}\n.ap-banner__row {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n.ap-banner--error {\n    background-color: rgba(255, 59, 48, 0.15);\n    border: 1px solid rgba(255, 59, 48, 0.3);\n}\n.ap-banner--error svg {\n    color: #ff3b30;\n}\n.ap-retry-btn {\n    padding: 8px 16px;\n    border: none;\n    border-radius: 6px;\n    background-color: var(--ap-accent);\n    color: var(--ap-play-icon);\n    font-size: 13px;\n    font-weight: 600;\n    cursor: pointer;\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);\n}\n/* ----------------------------- Top actions (menu) ----------------------------- */\n.ap-top-actions {\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    z-index: 10;\n}\n.ap-menu {\n    position: relative;\n}\n.ap-menu__btn {\n    width: 36px;\n    height: 36px;\n    border-radius: 50%;\n    border: 1px solid color-mix(in srgb, var(--ap-accent) 50%, transparent);\n    background-color: color-mix(in srgb, var(--ap-accent) calc(18% + var(--ap-btn-opacity-delta, 0%)), var(--ap-bg));\n    color: var(--ap-accent);\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    cursor: pointer;\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.3),\n        inset 0 -1.5px 2px rgba(0, 0, 0, 0.12),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 2px 7px rgba(0, 0, 0, 0.2);\n    -webkit-backdrop-filter: blur(10px) saturate(140%);\n    backdrop-filter: blur(10px) saturate(140%);\n    padding: 0;\n    transition: transform 0.12s var(--ap-spring), box-shadow 0.18s var(--ap-spring), background-color 0.18s var(--ap-spring),\n        border-color 0.18s var(--ap-spring);\n}\n.ap-menu__btn:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(28% + var(--ap-btn-opacity-delta, 0%)), var(--ap-bg));\n    border-color: color-mix(in srgb, var(--ap-accent) 70%, transparent);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.38),\n        inset 0 -1.5px 2px rgba(0, 0, 0, 0.12),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 4px 11px rgba(0, 0, 0, 0.26);\n}\n.ap-menu__btn:active:not(:disabled) {\n    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);\n}\n.ap-menu__btn[aria-expanded=\"true\"] {\n    background-color: var(--ap-accent);\n    color: var(--ap-play-icon);\n}\n/* ----------------------------- Track info ----------------------------- */\n.ap-track-counter {\n    text-align: center;\n    font-size: 12px;\n    opacity: 0.5;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-track-info {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    min-width: 0;\n}\n.ap-track-info__title {\n    font-size: 24px;\n    font-weight: 600;\n    letter-spacing: -0.02em;\n    line-height: 1.2;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-track-info__artist {\n    font-size: 15px;\n    font-weight: 500;\n    opacity: 0.7;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n/* ----------------------------- Progress bar ----------------------------- */\n.ap-progress-group {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n.ap-progress {\n    position: relative;\n    height: 24px;\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    touch-action: pan-y;\n    outline: none;\n}\n.ap-progress--seeking {\n    touch-action: none;\n    cursor: grabbing;\n}\n.ap-progress__track,\n.ap-progress__buffered,\n.ap-progress__fill {\n    position: absolute;\n    left: 0;\n    height: 8px;\n    border-radius: 4px;\n    pointer-events: none;\n}\n.ap-progress__track {\n    width: 100%;\n    background-color: var(--ap-track);\n    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);\n}\n.ap-progress__buffered {\n    /* `background` (not `background-color`) so --ap-progress may be a gradient. */\n    background: var(--ap-progress);\n    opacity: 0.3;\n}\n.ap-progress__fill {\n    background: var(--ap-progress);\n}\n.ap-progress__thumb {\n    position: absolute;\n    top: 50%;\n    width: 16px;\n    height: 16px;\n    border-radius: 50%;\n    background-color: var(--ap-accent);\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);\n    transform: translate(-50%, -50%);\n    pointer-events: none;\n    transition: transform 0.15s var(--ap-spring);\n}\n.ap-progress:hover .ap-progress__thumb,\n.ap-progress--seeking .ap-progress__thumb {\n    transform: translate(-50%, -50%) scale(1.15);\n}\n.ap-progress:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n    border-radius: 6px;\n}\n.ap-progress[aria-disabled=\"true\"] {\n    opacity: 0.5;\n    cursor: not-allowed;\n}\n.ap-times {\n    display: flex;\n    justify-content: space-between;\n    font-size: 12px;\n    opacity: 0.7;\n}\n/* ----------------------------- Waveform scrubber ----------------------------- */\n.ap-waveform {\n    position: relative;\n}\n.ap-waveform__surface {\n    position: absolute;\n    inset: 0;\n    cursor: pointer;\n    outline: none;\n}\n.ap-waveform--seeking .ap-waveform__surface {\n    cursor: grabbing;\n}\n.ap-waveform__canvas {\n    position: absolute;\n    inset: 0;\n}\n.ap-waveform__buffered {\n    position: absolute;\n    left: 0;\n    bottom: 0;\n    height: 2px;\n    border-radius: 1px;\n    background-color: var(--ap-progress);\n    opacity: 0.3;\n    pointer-events: none;\n    transition: width 0.2s linear;\n}\n.ap-waveform__surface:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n    border-radius: 6px;\n}\n/* ProgressBar fallback while peaks load (or when they can't be produced):\n   vertically centered in the same fixed-height slot so layout never shifts. */\n.ap-waveform__fallback {\n    position: absolute;\n    inset: 0;\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-waveform__buffered {\n        transition: none;\n    }\n}\n/* ----------------------------- Transport ----------------------------- */\n.ap-transport {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    gap: 12px;\n}\n.ap-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    border-radius: 50%;\n    cursor: pointer;\n    flex-shrink: 0;\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);\n    transition: transform 0.12s var(--ap-spring), box-shadow 0.18s var(--ap-spring),\n        background-color 0.18s var(--ap-spring), border-color 0.18s var(--ap-spring);\n}\n.ap-btn svg {\n    animation: ap-pop-in 0.35s var(--ap-spring);\n}\n.ap-btn:disabled {\n    cursor: not-allowed;\n    opacity: 0.5;\n}\n/* Premium glass treatment: a raised, dimensional control instead of a flat\n   icon printed on the surface color. A tinted glass fill (not transparent)\n   plus an inner highlight + soft outer shadow read as a physical button on\n   any surface color, bright or dark. */\n.ap-btn--ghost {\n    width: 40px;\n    height: 40px;\n    border: 1.5px solid color-mix(in srgb, var(--ap-accent) 50%, transparent);\n    background-color: color-mix(in srgb, var(--ap-accent) calc(18% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    color: var(--ap-accent);\n    /* Top highlight + bottom inner shadow = a bevel; the hairline outer ring\n       separates the control from a same-color surface; the soft drop lifts it. */\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.35),\n        inset 0 -2px 3px rgba(0, 0, 0, 0.14),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 3px 8px -2px rgba(0, 0, 0, 0.22);\n    /* Saturate keeps the accent tint vivid through the frosted fill. */\n    -webkit-backdrop-filter: blur(10px) saturate(140%);\n    backdrop-filter: blur(10px) saturate(140%);\n}\n.ap-btn--ghost:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(28% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    border-color: color-mix(in srgb, var(--ap-accent) 72%, transparent);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.42),\n        inset 0 -2px 3px rgba(0, 0, 0, 0.14),\n        0 0 0 0.5px rgba(0, 0, 0, 0.05),\n        0 5px 13px -3px rgba(0, 0, 0, 0.3);\n}\n.ap-btn--ghost:active:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(22% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    box-shadow:\n        inset 0 2px 4px rgba(0, 0, 0, 0.28),\n        0 1px 2px rgba(0, 0, 0, 0.12);\n}\n.ap-btn--sm {\n    /* Anchor for the coarse-pointer hit-area pseudo-element. Kept off\n       .ap-btn itself because skins reposition some buttons absolutely. */\n    position: relative;\n    width: 28px;\n    height: 28px;\n    opacity: 0.6;\n}\n.ap-btn--play {\n    width: 60px;\n    height: 60px;\n    /* See-through glass body like the other transport controls — the accent\n       reads through a frosted tint rather than a solid fill, and an accent\n       glow (below) does the work of marking it as the primary control. */\n    border: 1px solid color-mix(in srgb, var(--ap-accent) 60%, transparent);\n    background-color: color-mix(in srgb, var(--ap-accent) calc(24% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    background-image: linear-gradient(165deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.04) 52%, transparent 74%);\n    /* Accent icon (not --ap-play-icon): a dark icon can't be read on a\n       translucent body, and this matches the accent icons of the other\n       transport buttons. */\n    color: var(--ap-accent);\n    -webkit-backdrop-filter: blur(10px) saturate(170%);\n    backdrop-filter: blur(10px) saturate(170%);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.4),\n        inset 0 -2px 4px rgba(0, 0, 0, 0.12),\n        0 0 0 1px color-mix(in srgb, var(--ap-accent) 28%, transparent),\n        0 0 calc(20px * var(--ap-glow-intensity, 1)) -2px color-mix(in srgb, var(--ap-accent) 60%, transparent),\n        0 6px 16px -6px rgba(0, 0, 0, 0.4);\n}\n.ap-btn--play:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(32% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    border-color: color-mix(in srgb, var(--ap-accent) 78%, transparent);\n    box-shadow:\n        inset 0 1px 0.5px rgba(255, 255, 255, 0.48),\n        inset 0 -2px 4px rgba(0, 0, 0, 0.12),\n        0 0 0 1px color-mix(in srgb, var(--ap-accent) 36%, transparent),\n        0 0 calc(30px * var(--ap-glow-intensity, 1)) 0 color-mix(in srgb, var(--ap-accent) 72%, transparent),\n        0 9px 22px -6px rgba(0, 0, 0, 0.45);\n}\n.ap-btn--play:active:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-accent) calc(28% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    box-shadow:\n        inset 0 2px 5px rgba(0, 0, 0, 0.22),\n        0 0 calc(16px * var(--ap-glow-intensity, 1)) -2px color-mix(in srgb, var(--ap-accent) 55%, transparent),\n        0 2px 6px -2px rgba(0, 0, 0, 0.3);\n}\n.ap-btn--play-active {\n    animation: ap-pulse 3s ease-in-out infinite;\n}\n/* ----------------------------- Volume ----------------------------- */\n.ap-volume {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n}\n.ap-icon-btn {\n    position: relative;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 32px;\n    height: 32px;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 18%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) calc(10% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    color: var(--ap-accent);\n    cursor: pointer;\n    border-radius: 9px;\n    /* Frosted glass chip: top highlight + bottom inner shade for a soft bevel,\n       a light drop so it sits above the surface rather than printed on it. */\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.2),\n        inset 0 -1px 1px rgba(0, 0, 0, 0.1),\n        0 1px 4px rgba(0, 0, 0, 0.16);\n    -webkit-backdrop-filter: blur(8px) saturate(130%);\n    backdrop-filter: blur(8px) saturate(130%);\n    transition: transform 0.12s var(--ap-spring), box-shadow 0.18s var(--ap-spring), background-color 0.18s var(--ap-spring),\n        border-color 0.18s var(--ap-spring);\n}\n.ap-icon-btn svg {\n    animation: ap-pop-in 0.35s var(--ap-spring);\n}\n.ap-icon-btn:hover:not(:disabled) {\n    background-color: color-mix(in srgb, var(--ap-text, #fff) calc(18% + var(--ap-btn-opacity-delta, 0%)), transparent);\n    border-color: color-mix(in srgb, var(--ap-text, #fff) 26%, transparent);\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.24),\n        inset 0 -1px 1px rgba(0, 0, 0, 0.1),\n        0 2px 7px rgba(0, 0, 0, 0.2);\n}\n.ap-icon-btn:active:not(:disabled) {\n    box-shadow: inset 0 1.5px 3px rgba(0, 0, 0, 0.22);\n}\n.ap-icon-btn:disabled {\n    opacity: 0.5;\n    cursor: not-allowed;\n}\n.ap-volume__slider {\n    position: relative;\n    flex: 1;\n    max-width: 140px;\n    height: 20px;\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    touch-action: none;\n    outline: none;\n}\n.ap-volume__track,\n.ap-volume__fill {\n    position: absolute;\n    left: 0;\n    height: 6px;\n    border-radius: 3px;\n    pointer-events: none;\n}\n.ap-volume__track {\n    width: 100%;\n    background-color: var(--ap-track);\n}\n.ap-volume__fill {\n    background-color: var(--ap-progress);\n}\n.ap-volume__thumb {\n    position: absolute;\n    top: 50%;\n    width: 12px;\n    height: 12px;\n    border-radius: 50%;\n    background-color: var(--ap-accent);\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);\n    transform: translate(-50%, -50%);\n    pointer-events: none;\n}\n.ap-volume__slider:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n    border-radius: 6px;\n}\n/* ----------------------------- Wide buttons ----------------------------- */\n.ap-wide-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    padding: 12px 24px;\n    border-radius: 8px;\n    font-size: 14px;\n    font-weight: 600;\n    cursor: pointer;\n    text-decoration: none;\n    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15),\n        inset 0 1px 0 rgba(255, 255, 255, 0.2);\n}\n.ap-wide-btn--ghost {\n    background-color: transparent;\n    border: 1px solid var(--ap-accent);\n    color: var(--ap-accent);\n}\n.ap-wide-btn--solid {\n    background-color: var(--ap-accent);\n    color: var(--ap-play-icon);\n    border: none;\n}\n/* ----------------------------- Lyrics ----------------------------- */\n.ap-lyrics {\n    padding: 16px;\n    border-radius: 8px;\n    background-color: rgba(0, 0, 0, 0.2);\n    border: 1px solid var(--ap-accent);\n    font-size: 14px;\n    line-height: 1.6;\n    white-space: pre-wrap;\n    max-height: 200px;\n    overflow-y: auto;\n}\n/* ----------------------------- Tracklist ----------------------------- */\n.ap-tracklist {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    margin-top: 8px;\n    padding: 12px;\n    border-radius: 8px;\n    background-color: rgba(0, 0, 0, 0.2);\n    border: 1px solid var(--ap-accent);\n    max-height: 300px;\n    overflow-y: auto;\n}\n.ap-tracklist__item {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 10px 12px;\n    border-radius: 6px;\n    background-color: transparent;\n    border: 1px solid transparent;\n    color: var(--ap-text);\n    cursor: pointer;\n    text-align: left;\n    transition: background-color 0.2s ease;\n}\n.ap-tracklist__item:hover {\n    background-color: rgba(255, 255, 255, 0.08);\n}\n.ap-tracklist__item--active {\n    background-color: rgba(255, 255, 255, 0.15);\n    border-color: var(--ap-accent);\n}\n.ap-tracklist__num {\n    min-width: 24px;\n    font-size: 14px;\n    font-weight: 500;\n    opacity: 0.6;\n}\n.ap-tracklist__item--active .ap-tracklist__num {\n    opacity: 1;\n    font-weight: 700;\n}\n.ap-tracklist__meta {\n    flex: 1;\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    overflow: hidden;\n}\n.ap-tracklist__title {\n    font-size: 14px;\n    font-weight: 500;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-tracklist__artist {\n    font-size: 12px;\n    opacity: 0.6;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n/* Equalizer bars on the active, playing track. */\n.ap-eq {\n    display: flex;\n    align-items: center;\n    gap: 2px;\n}\n.ap-eq i {\n    width: 3px;\n    height: 12px;\n    border-radius: 2px;\n    background-color: var(--ap-accent);\n    animation: ap-eq 1s ease-in-out infinite;\n}\n.ap-eq i:nth-child(2) {\n    height: 16px;\n    animation-delay: 0.2s;\n}\n.ap-eq i:nth-child(3) {\n    animation-delay: 0.4s;\n}\n/* ----------------------------- Animations ----------------------------- */\n.ap-tap {\n    transition: transform 0.1s var(--ap-spring);\n}\n.ap-tap:active:not(:disabled) {\n    transform: scale(0.92);\n}\n.ap-spin {\n    animation: ap-spin 1s linear infinite;\n    transform-origin: center;\n}\n.ap-anim-in {\n    animation: ap-fade-in 0.25s ease;\n}\n.ap-root :focus-visible {\n    outline: none;\n}\n.ap-btn:focus-visible,\n.ap-icon-btn:focus-visible,\n.ap-wide-btn:focus-visible,\n.ap-tracklist__item:focus-visible,\n.ap-retry-btn:focus-visible,\n.ap-menu__btn:focus-visible {\n    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);\n}\n@keyframes ap-pulse {\n    0%,\n    100% {\n        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15),\n            inset 0 1px 0 rgba(255, 255, 255, 0.2),\n            0 0 0 0 transparent;\n    }\n    50% {\n        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15),\n            inset 0 1px 0 rgba(255, 255, 255, 0.2),\n            0 0 16px 4px var(--ap-accent);\n    }\n}\n@keyframes ap-spin {\n    to {\n        transform: rotate(360deg);\n    }\n}\n@keyframes ap-fade-in {\n    from {\n        opacity: 0;\n        transform: translateY(-6px);\n    }\n    to {\n        opacity: 1;\n        transform: translateY(0);\n    }\n}\n@keyframes ap-eq {\n    0%,\n    100% {\n        opacity: 0.5;\n        transform: scaleY(0.7);\n    }\n    50% {\n        opacity: 1;\n        transform: scaleY(1);\n    }\n}\n@keyframes ap-pop-in {\n    0% {\n        transform: scale(0.6) rotate(-10deg);\n        opacity: 0;\n    }\n    100% {\n        transform: scale(1) rotate(0deg);\n        opacity: 1;\n    }\n}\n/* Real mobile viewports (full-bleed player on a phone). */\n@media (max-width: 480px) {\n    .ap-root {\n        padding: 16px;\n    }\n    .ap-content {\n        gap: 12px;\n    }\n    .ap-track-info__title {\n        font-size: clamp(17px, 5.5vw, 22px);\n    }\n    .ap-track-info__artist {\n        font-size: 13px;\n    }\n    .ap-progress__thumb {\n        width: 18px;\n        height: 18px;\n    }\n    .ap-transport {\n        gap: 8px;\n    }\n    .ap-btn--play {\n        width: 56px;\n        height: 56px;\n    }\n    .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 38px;\n        height: 38px;\n    }\n}\n/* Narrow embeds (marketplace cards, sidebars, phone frames) where the\n   viewport is wide but the player itself is cramped. Mirrors the mobile\n   media query above, sized against the player's own width. */\n@container ap-player (max-width: 420px) {\n    .ap-content {\n        gap: 12px;\n    }\n    .ap-track-info__title {\n        font-size: clamp(17px, 6.5cqw, 22px);\n    }\n    .ap-track-info__artist {\n        font-size: 13px;\n    }\n    .ap-track-counter {\n        font-size: 11px;\n    }\n    .ap-transport {\n        gap: 8px;\n    }\n    .ap-btn--play {\n        width: 56px;\n        height: 56px;\n    }\n    .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 38px;\n        height: 38px;\n    }\n}\n/* Ultra-narrow embeds (deeply nested cards at 320px viewports): shrink the\n   transport one more step so the five-button row never clips. Budget:\n   26 + 34 + 48 + 34 + 26 + 4×6 gaps = 192px. */\n@container ap-player (max-width: 300px) {\n    .ap-transport {\n        gap: 6px;\n    }\n    .ap-btn--play {\n        width: 48px;\n        height: 48px;\n    }\n    .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 34px;\n        height: 34px;\n    }\n    .ap-btn--sm {\n        width: 26px;\n        height: 26px;\n    }\n}\n/* Touch devices: grow the hit area to at least 44×44px without changing\n   the visual size. All interactive elements must ensure their total touch\n   target (visual size + pseudo-element expansion) meets 44×44px minimum.\n\n   Approach: expand via an absolutely-positioned ::after pseudo-element.\n   The parent must have position: relative for inset to resolve correctly.\n   Elements already ≥44px (e.g. .ap-btn--play at 60px) don't need expansion. */\n@media (pointer: coarse) {\n    /* Ensure all interactive elements have position context for ::after. */\n    .ap-btn,\n    .ap-btn--sm,\n    .ap-icon-btn,\n    .ap-menu__btn,\n    .ap-q-header__close,\n    .ap-q-row__play-btn,\n    .ap-q-row__remove,\n    .ap-wide-btn,\n    .ap-retry-btn {\n        position: relative;\n    }\n\n    /* Ghost buttons (40×40) need 2px extra per side → 44×44. */\n    .ap-btn--ghost::after {\n        content: \"\";\n        position: absolute;\n        inset: -2px;\n    }\n\n    /* Small ghost buttons (28×28) need 8px per side → 44×44. */\n    .ap-btn--sm::after,\n    /* Icon buttons (32×32) need 6px per side → 44×44. */\n    .ap-icon-btn::after,\n    /* Menu toggle (36×36) needs 4px per side → 44×44. */\n    .ap-menu__btn::after,\n    /* Queue header close (36×36) needs 4px per side → 44×44. */\n    .ap-q-header__close::after,\n    /* Queue row play (28×28) needs 8px per side → 44×44. */\n    .ap-q-row__play-btn::after {\n        content: \"\";\n        position: absolute;\n        inset: -8px;\n    }\n\n    /* Queue row remove (24×24) needs 10px per side → 44×44. */\n    .ap-q-row__remove::after {\n        content: \"\";\n        position: absolute;\n        inset: -10px;\n    }\n    /* Retry button — content-sized, 8px per side is a generous cushion. */\n    .ap-retry-btn::after,\n    /* Wide button — content-sized, 4px per side works. */\n    .ap-wide-btn::after {\n        content: \"\";\n        position: absolute;\n        inset: -8px;\n    }\n\n    /* Progress bar thumb: the visual thumb is ~16px, but the touch target\n       must be 44px. Set the element size to 44px and scale its visual\n       appearance down so it still looks like a 16px dot. */\n    .ap-progress__thumb {\n        width: 44px;\n        height: 44px;\n        transform: translate(-50%, -50%) scale(0.36);\n        transform-origin: center center;\n    }\n    .ap-progress:hover .ap-progress__thumb,\n    .ap-progress--seeking .ap-progress__thumb {\n        transform: translate(-50%, -50%) scale(0.42);\n    }\n\n    /* Volume slider thumb: same approach — 44px touch target, scaled\n       visual to match the original ~12px appearance. */\n    .ap-volume__thumb {\n        width: 44px;\n        height: 44px;\n        transform: translate(-50%, -50%) scale(0.27);\n        transform-origin: center center;\n    }\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-btn--play-active,\n    .ap-spin,\n    .ap-anim-in,\n    .ap-eq i,\n    .ap-tap,\n    .ap-btn,\n    .ap-icon-btn,\n    .ap-menu__btn,\n    .ap-surface-btn {\n        animation: none !important;\n        transition: none !important;\n    }\n}\n/* ----------------------------- Upgrades ----------------------------- */\n/* Soft informational banner used for non-error states (e.g. autoplay\n   blocked) so it reads as guidance instead of a failure. */\n.ap-banner--info {\n    background-color: rgba(255, 255, 255, 0.08);\n    border: 1px solid rgba(255, 255, 255, 0.18);\n}\n.ap-banner--info svg {\n    color: var(--ap-accent);\n}\n/* The error boundary renders an inline fallback when a child crashes. */\n.ap-error-boundary {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n    padding: 16px;\n    border-radius: 8px;\n    background-color: rgba(255, 59, 48, 0.15);\n    border: 1px solid rgba(255, 59, 48, 0.3);\n    color: var(--ap-text);\n    font-size: 13px;\n    text-align: center;\n}\n.ap-error-boundary__title {\n    margin: 0;\n    font-weight: 600;\n}\n.ap-error-boundary__message {\n    margin: 0;\n    opacity: 0.8;\n    word-break: break-word;\n}\n/* iOS / unsupported-volume hint badge. */\n.ap-volume__hint {\n    font-size: 10px;\n    font-weight: 700;\n    letter-spacing: 0.05em;\n    padding: 2px 6px;\n    border-radius: 4px;\n    background-color: rgba(255, 255, 255, 0.15);\n    color: var(--ap-text);\n    text-transform: uppercase;\n    user-select: none;\n}\n/* Prevent text selection on long-press drag for the slider tracks so\n   iOS Safari does not highlight them while scrubbing. */\n.ap-progress,\n.ap-volume__slider {\n    user-select: none;\n    -webkit-user-select: none;\n}\n/* While the tab is hidden we suspend the equalizer animation so backgrounded\n   tabs do not waste battery / GPU. */\n.ap-root--hidden .ap-eq i,\n.ap-root--hidden .ap-btn--play-active {\n    animation-play-state: paused;\n}\n.sap-sleep-timer {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    align-self: flex-start;\n    margin-top: 8px;\n    color: var(--ap-text);\n    font-size: 12px;\n}\n.sap-sleep-timer__label {\n    opacity: 0.72;\n}\n.sap-sleep-timer__select {\n    min-width: 128px;\n    height: 30px;\n    border: 1px solid rgba(255, 255, 255, 0.2);\n    border-radius: 6px;\n    background-color: rgba(0, 0, 0, 0.24);\n    color: var(--ap-text);\n    font: inherit;\n    padding: 0 8px;\n}\n.sap-sleep-timer__select:focus-visible {\n    outline: 2px solid var(--ap-accent);\n    outline-offset: 2px;\n}\n/* ----------------------------- Queue Drawer (Up Next) ----------------------------- */\n.ap-q-overlay {\n    position: fixed;\n    inset: 0;\n    z-index: 100;\n    display: flex;\n    justify-content: flex-end;\n    align-items: stretch;\n}\n.ap-q-backdrop {\n    position: absolute;\n    inset: 0;\n    background-color: rgba(0, 0, 0, 0.5);\n    cursor: pointer;\n}\n.ap-q-drawer {\n    position: relative;\n    width: min(400px, 100vw);\n    max-width: 100vw;\n    height: 100%;\n    background-color: rgba(20, 20, 24, 0.97);\n    backdrop-filter: blur(20px);\n    -webkit-backdrop-filter: blur(20px);\n    border-left: 1px solid rgba(255, 255, 255, 0.1);\n    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);\n    display: flex;\n    flex-direction: column;\n    color: var(--ap-text, #ffffff);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n.ap-q-header {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 20px 20px 12px;\n    border-bottom: 1px solid rgba(255, 255, 255, 0.08);\n    flex-shrink: 0;\n}\n.ap-q-header__title {\n    margin: 0;\n    font-size: 18px;\n    font-weight: 700;\n    flex: 1;\n}\n.ap-q-header__count {\n    font-size: 13px;\n    opacity: 0.5;\n    font-weight: 500;\n}\n.ap-q-header__close {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 36px;\n    height: 36px;\n    border: none;\n    background: transparent;\n    color: var(--ap-text, #ffffff);\n    cursor: pointer;\n    border-radius: 50%;\n    flex-shrink: 0;\n}\n.ap-q-header__close:hover {\n    background-color: rgba(255, 255, 255, 0.08);\n}\n.ap-q-header__close svg {\n    width: 20px;\n    height: 20px;\n}\n/* Queue list */\n.ap-q-list {\n    flex: 1;\n    overflow-y: auto;\n    padding: 8px 0;\n    -webkit-overflow-scrolling: touch;\n}\n/* Queue row */\n.ap-q-row {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 8px 20px;\n    user-select: none;\n    -webkit-user-select: none;\n    cursor: default;\n    transition: background-color 0.15s ease, transform 0.05s ease;\n    touch-action: none;\n    position: relative;\n    z-index: 1;\n}\n.ap-q-row:hover {\n    background-color: rgba(255, 255, 255, 0.04);\n}\n.ap-q-row--active {\n    background-color: rgba(255, 255, 255, 0.08);\n}\n.ap-q-row--active:hover {\n    background-color: rgba(255, 255, 255, 0.10);\n}\n.ap-q-row--dragging {\n    z-index: 10;\n    opacity: 0.9;\n    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n    background-color: rgba(255, 255, 255, 0.10);\n}\n.ap-q-row__drag {\n    display: flex;\n    align-items: center;\n    cursor: grab;\n    color: var(--ap-text, #ffffff);\n    opacity: 0.3;\n    flex-shrink: 0;\n    padding: 4px;\n    border-radius: 4px;\n    touch-action: none;\n}\n.ap-q-row__drag:hover {\n    opacity: 0.6;\n}\n.ap-q-row__drag:active {\n    cursor: grabbing;\n}\n.ap-q-row__num {\n    min-width: 24px;\n    font-size: 13px;\n    font-weight: 600;\n    opacity: 0.5;\n    text-align: center;\n    flex-shrink: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n}\n.ap-q-row--active .ap-q-row__num {\n    opacity: 1;\n}\n.ap-q-row__meta {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n}\n.ap-q-row__title {\n    font-size: 14px;\n    font-weight: 500;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-q-row--active .ap-q-row__title {\n    font-weight: 600;\n}\n.ap-q-row__artist {\n    font-size: 12px;\n    opacity: 0.5;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-q-row__badge {\n    font-size: 10px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.05em;\n    padding: 3px 8px;\n    border-radius: 999px;\n    background-color: var(--ap-accent, #ffffff);\n    color: var(--ap-play-icon, #000000);\n    flex-shrink: 0;\n    white-space: nowrap;\n}\n.ap-q-row__play-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 28px;\n    height: 28px;\n    border: none;\n    background: transparent;\n    color: var(--ap-accent, #ffffff);\n    cursor: pointer;\n    border-radius: 50%;\n    flex-shrink: 0;\n    opacity: 0;\n    transition: opacity 0.15s ease;\n}\n.ap-q-row:hover .ap-q-row__play-btn {\n    opacity: 1;\n}\n.ap-q-row__play-btn:hover {\n    background-color: rgba(255, 255, 255, 0.12);\n}\n.ap-q-row__remove {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 24px;\n    height: 24px;\n    border: none;\n    background: transparent;\n    color: var(--ap-text, #ffffff);\n    cursor: pointer;\n    border-radius: 50%;\n    flex-shrink: 0;\n    opacity: 0.2;\n    transition: opacity 0.15s ease, color 0.15s ease;\n}\n.ap-q-row:hover .ap-q-row__remove {\n    opacity: 0.5;\n}\n.ap-q-row__remove:hover {\n    opacity: 1 !important;\n    color: #ff5a55;\n}\n/* Empty state */\n.ap-q-empty {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: 40px 20px;\n    text-align: center;\n    opacity: 0.5;\n    font-size: 14px;\n}\n/* Responsive: full-screen drawer on small screens. */\n@media (max-width: 480px) {\n    .ap-q-drawer {\n        width: 100vw;\n        border-left: none;\n    }\n}\n/* Consolidated seek/track controls. Tap seeks 10s; intentional hold skips track. */\n.ap-sr-only {\n    position: absolute;\n    width: 1px;\n    height: 1px;\n    padding: 0;\n    margin: -1px;\n    overflow: hidden;\n    clip: rect(0, 0, 0, 0);\n    white-space: nowrap;\n    border: 0;\n}\n.ap-hold-skip {\n    position: relative;\n    overflow: visible;\n    touch-action: manipulation;\n    user-select: none;\n    -webkit-user-select: none;\n}\n.ap-hold-skip__icon {\n    position: relative;\n    z-index: 1;\n    display: inline-flex;\n}\n.ap-hold-skip__progress {\n    position: absolute;\n    inset: 3px;\n    border-radius: inherit;\n    background: conic-gradient(var(--ap-accent) 0deg, transparent 0deg);\n    opacity: 0;\n    pointer-events: none;\n}\n.ap-hold-skip__progress::after {\n    content: \"\";\n    position: absolute;\n    inset: 3px;\n    border-radius: inherit;\n    background: var(--ap-bg, rgba(20, 20, 24, 0.96));\n}\n.ap-hold-skip--holding:not(:disabled) .ap-hold-skip__progress {\n    opacity: 0.72;\n    animation: ap-hold-skip-progress var(--ap-hold-ms, 1200ms) linear forwards;\n}\n.ap-hold-skip--holding:not(:disabled)::before {\n    content: attr(data-hold-label);\n    position: absolute;\n    left: 50%;\n    bottom: -18px;\n    transform: translateX(-50%);\n    font-size: 9px;\n    font-weight: 700;\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n    color: var(--ap-accent);\n    opacity: 0.85;\n}\n@keyframes ap-hold-skip-progress {\n    from { background: conic-gradient(var(--ap-accent) 0deg, transparent 0deg); }\n    to { background: conic-gradient(var(--ap-accent) 360deg, transparent 360deg); }\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-hold-skip--holding:not(:disabled) .ap-hold-skip__progress {\n        animation: none;\n        background: conic-gradient(var(--ap-accent) 270deg, transparent 270deg);\n    }\n}\n/* Phase 1 surface infrastructure — render zones, surface buttons, hero collapse.\n   Tokens (--ap-accent, --ap-text, ...) come from the face root via themeVars. */\n/* ----------------------------- Surface buttons ----------------------------- */\n/* One shared shell for the left (canvas) and right (queue) toggles, so both are\n   visually and behaviorally identical. */\n.ap-surface-actions {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    gap: 12px;\n}\n.ap-surface-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    width: 40px;\n    height: 40px;\n    flex-shrink: 0;\n    border-radius: 12px;\n    border: 1px solid color-mix(in srgb, var(--ap-text, #fff) 20%, transparent);\n    /* A neutral dark base keeps the chip darker than a bright surface (so its\n       icon stays visible on yellow/green), while the --ap-text tint keeps it\n       feeling glassy on dark surfaces. Edge is defined by a dark outer ring +\n       drop shadow that show up regardless of how light the surface color is. */\n    background-color: color-mix(in srgb, var(--ap-text, #fff) calc(12% + var(--ap-btn-opacity-delta, 0%)), rgba(8, 10, 16, 0.16));\n    color: var(--ap-text, #fff);\n    cursor: pointer;\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.2),\n        inset 0 -1px 1px rgba(0, 0, 0, 0.1),\n        0 0 0 1px rgba(0, 0, 0, 0.1),\n        0 2px 6px rgba(0, 0, 0, 0.2);\n    -webkit-backdrop-filter: blur(8px) saturate(130%);\n    backdrop-filter: blur(8px) saturate(130%);\n    transition: background-color 0.2s ease, border-color 0.2s ease,\n        color 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;\n}\n.ap-surface-btn:hover:not(:disabled):not(.ap-surface-btn--active) {\n    background-color: color-mix(in srgb, var(--ap-text, #fff) calc(20% + var(--ap-btn-opacity-delta, 0%)), rgba(8, 10, 16, 0.16));\n    border-color: color-mix(in srgb, var(--ap-text, #fff) 30%, transparent);\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.24),\n        inset 0 -1px 1px rgba(0, 0, 0, 0.1),\n        0 0 0 1px rgba(0, 0, 0, 0.1),\n        0 3px 9px rgba(0, 0, 0, 0.24);\n}\n.ap-surface-btn:active:not(:disabled) {\n    box-shadow: inset 0 1.5px 3px rgba(0, 0, 0, 0.22);\n}\n.ap-surface-btn:disabled {\n    opacity: 0.5;\n    cursor: not-allowed;\n}\n.ap-surface-btn--active {\n    background-color: color-mix(in srgb, var(--ap-accent) 22%, transparent);\n    border-color: var(--ap-accent);\n    color: var(--ap-accent);\n    box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, 0.25),\n        0 2px 8px -2px color-mix(in srgb, var(--ap-accent) 50%, transparent);\n}\n/* ----------------------------- SEICanvas host ----------------------------- */\n/* The main visual region. Collapsed by default; animates open via data-open. */\n.ap-sei-canvas-host {\n    overflow: hidden;\n    max-height: 0;\n    opacity: 0;\n    /* `visibility: hidden` also pulls focusable children out of the tab order\n       while closed; transitioning it keeps the open/close animation smooth. */\n    visibility: hidden;\n    transition: max-height 0.28s ease, opacity 0.2s ease, visibility 0.28s;\n}\n.ap-sei-canvas-host[data-open=\"true\"] {\n    max-height: 360px;\n    opacity: 1;\n    visibility: visible;\n}\n.ap-sei-canvas-host__inner {\n    padding: 4px 0;\n}\n.ap-sei-canvas-placeholder {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 6px;\n    min-height: 160px;\n    padding: 24px;\n    border-radius: 14px;\n    border: 1px dashed color-mix(in srgb, var(--ap-text, #fff) 24%, transparent);\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 5%, transparent);\n    color: var(--ap-text, #fff);\n    text-align: center;\n}\n.ap-sei-canvas-placeholder__title {\n    font-size: 14px;\n    font-weight: 600;\n}\n.ap-sei-canvas-placeholder__hint {\n    font-size: 12px;\n    opacity: 0.6;\n}\n/* ----------------------------- Scrubber host ----------------------------- */\n.ap-scrubber-host {\n    display: flex;\n    width: 100%;\n    transition: padding 0.2s ease;\n}\n.ap-scrubber-host > * {\n    flex: 1;\n    min-width: 0;\n}\n.ap-scrubber-host[data-density=\"compact\"] {\n    padding: 2px 0;\n}\n.ap-scrubber-host[data-density=\"standard\"] {\n    padding: 4px 0;\n}\n.ap-scrubber-host[data-density=\"expanded\"] {\n    padding: 10px 0;\n}\n/* ----------------------------- Hero collapse ----------------------------- */\n.ap-hero {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    min-width: 0;\n    text-align: center;\n    transition: gap 0.25s ease;\n}\n.ap-hero__title {\n    font-size: 24px;\n    font-weight: 600;\n    letter-spacing: -0.02em;\n    line-height: 1.2;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    transition: font-size 0.25s ease;\n}\n.ap-hero__artist {\n    font-size: 15px;\n    font-weight: 500;\n    opacity: 0.7;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    transition: font-size 0.25s ease;\n}\n/* Tertiary release line under the artist (expanded hero only). */\n.ap-hero__release {\n    font-size: 12.5px;\n    font-weight: 500;\n    opacity: 0.45;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    margin-top: 1px;\n}\n/* The title marquee lives inside .ap-hero__title and inherits its type; it just\n   provides the clip + scroll, so it must fill the line and not re-truncate. */\n.ap-hero__marquee {\n    max-width: 100%;\n}\n/* Compact identity header: smaller type, art + text in a row, left-aligned. */\n.ap-hero[data-collapsed=\"true\"] {\n    flex-direction: row;\n    align-items: center;\n    gap: 10px;\n    text-align: left;\n}\n.ap-hero[data-collapsed=\"true\"] .ap-hero__title {\n    font-size: 15px;\n}\n.ap-hero[data-collapsed=\"true\"] .ap-hero__artist {\n    font-size: 12px;\n}\n.ap-hero__art {\n    flex-shrink: 0;\n    width: 36px;\n    height: 36px;\n    border-radius: 8px;\n    overflow: hidden;\n}\n.ap-hero__text {\n    min-width: 0;\n}\n/* ----------------------------- In-region queue ----------------------------- */\n.ap-queue-surface {\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    max-height: 320px;\n    overflow-y: auto;\n    -webkit-overflow-scrolling: touch;\n    text-align: left;\n}\n.ap-queue-surface__head {\n    font-size: 12px;\n    font-weight: 700;\n    text-transform: uppercase;\n    letter-spacing: 0.04em;\n    opacity: 0.6;\n    padding: 2px 4px;\n}\n.ap-queue-surface__empty {\n    font-size: 13px;\n    opacity: 0.6;\n    padding: 12px 4px;\n}\n.ap-queue-surface__list {\n    list-style: none;\n    margin: 0;\n    padding: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n}\n.ap-queue-surface__row {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    width: 100%;\n    padding: 8px 10px;\n    border: none;\n    border-radius: 10px;\n    background-color: transparent;\n    color: var(--ap-text, #fff);\n    text-align: left;\n    cursor: pointer;\n    transition: background-color 0.15s ease, transform 0.05s ease;\n}\n.ap-queue-surface__row:hover {\n    background-color: color-mix(in srgb, var(--ap-text, #fff) 6%, transparent);\n}\n.ap-queue-surface__row--current {\n    background-color: color-mix(in srgb, var(--ap-accent) 16%, transparent);\n}\n.ap-queue-surface__title {\n    font-size: 14px;\n    font-weight: 600;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-queue-surface__artist {\n    font-size: 12px;\n    opacity: 0.65;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n/* ----------------------------- Mini surface region ----------------------------- */\n/* Column shell so the compact scrubber and queue surface stack under the\n   existing single-row mini player without altering that row. */\n.ap-ms-shell {\n    box-sizing: border-box;\n    width: 100%;\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n/* Mini has no canvas; its right queue button reveals this small region. */\n.ap-ms__surface {\n    overflow: hidden;\n    max-height: 0;\n    opacity: 0;\n    /* See .ap-sei-canvas-host: keep closed children out of the tab order. */\n    visibility: hidden;\n    transition: max-height 0.25s ease, opacity 0.18s ease, visibility 0.25s;\n}\n.ap-ms__surface[data-open=\"true\"] {\n    max-height: 260px;\n    opacity: 1;\n    visibility: visible;\n}\n/* ----------------------------- Narrow / motion ----------------------------- */\n@container ap-fc (max-width: 360px) {\n    .ap-sei-canvas-host[data-open=\"true\"] {\n        max-height: 300px;\n    }\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-surface-btn,\n    .ap-sei-canvas-host,\n    .ap-scrubber-host,\n    .ap-hero,\n    .ap-hero__title,\n    .ap-hero__artist,\n    .ap-queue-surface__row,\n    .ap-ms__surface {\n        transition: none;\n    }\n}\n/* Make a reused ProgressBar fill whatever flex container a skin puts it in\n   (its inner track is absolutely positioned, so the host must supply width).\n   The compact vault row and mini sidebar no longer mount a scrubber — seeking\n   lives on the shared StickyBottom master — so only the bar/sea faces remain. */\n.ap-sb__scrub,\n.ap-sea__progress {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n}\n.ap-sb__scrub .ap-progress,\n.ap-sea__progress .ap-progress {\n    flex: 1;\n}\n/* When a ScrubberCanvasHost wraps a skin's bespoke ProgressBar, the host becomes\n   the flex child that must grow; it then flexes its own child (the ProgressBar\n   via `.ap-scrubber-host > *`), so seek width stays identical. */\n.ap-sb__scrub > .ap-scrubber-host,\n.ap-sea__progress > .ap-scrubber-host {\n    flex: 1;\n    min-width: 0;\n}\n/* ----------------------------- Art / hero sizing -----------------------------\n   Reusable sizing contract for album / hero artwork. Square by default,\n   cover-cropped and centered, and it behaves the same whether the art is a\n   CSS background (gradient or url) or a child <img>. Surfaces override\n   --ap-art-ratio / --ap-art-fit / --ap-art-pos, or use the modifiers. */\n.ap-art {\n    aspect-ratio: var(--ap-art-ratio, 1 / 1);\n    width: 100%;\n    overflow: hidden;\n    background-size: var(--ap-art-fit, cover);\n    background-position: var(--ap-art-pos, center);\n    background-repeat: no-repeat;\n}\n.ap-art > img {\n    width: 100%;\n    height: 100%;\n    object-fit: var(--ap-art-fit, cover);\n    object-position: var(--ap-art-pos, center);\n    display: block;\n}\n.ap-art--contain {\n    --ap-art-fit: contain;\n}\n.ap-art--wide {\n    --ap-art-ratio: 16 / 9;\n}\n/* Hero thumbnail framed inside a larger layout: scales with the player\n   container on mobile instead of overflowing it. */\n.ap-art--frame {\n    width: clamp(96px, 38cqw, 320px);\n}\n/* ----------------------------- Full card ----------------------------- */\n.ap-fc {\n    position: relative;\n    box-sizing: border-box;\n    width: 100%;\n    container: ap-fc / inline-size;\n    padding: 24px;\n    border-radius: 16px;\n    /* Surface visuals (fill, blur, border, shadow) come from `.ap-glass-surface`\n       on this same element — see audio-player.css. */\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n    display: flex;\n    flex-direction: column;\n    gap: 16px;\n}\n.ap-fc *,\n.ap-fc *::before,\n.ap-fc *::after {\n    box-sizing: border-box;\n}\n/* Optional full-bleed backdrop (image/video). The layers sit at z-index 0 with\n   the card's radius; the visible card content is lifted above them. We lift only\n   the known content blocks — not QueueDrawer/SAPController, which are their own\n   positioned overlays. */\n.ap-fc__bg {\n    border-radius: 16px;\n}\n.ap-fc__counter,\n.ap-fc__stage,\n.ap-fc__control-dock,\n.ap-fc > .ap-banner {\n    position: relative;\n    z-index: 1;\n}\n/* Collapsed-hero artwork fills the 36px hero art box. */\n.ap-fc__hero-art {\n    width: 100%;\n    height: 100%;\n    object-fit: cover;\n    background-size: cover;\n    background-position: center;\n    background-repeat: no-repeat;\n}\n/* \"…\" trigger pinned to the card's top-right corner; the counter and title\n   below pad around it so text never slides underneath. */\n.ap-fc__menu {\n    position: absolute;\n    top: 12px;\n    right: 12px;\n    z-index: 10;\n}\n.ap-fc__counter {\n    text-align: center;\n    font-size: 12px;\n    opacity: 0.5;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    padding-inline: 44px;\n}\n.ap-fc__stage {\n    display: flex;\n    flex-direction: column;\n    gap: 12px;\n    height: clamp(190px, 44cqw, 320px);\n    min-height: 0;\n    overflow: hidden;\n}\n.ap-fc__stage[data-surface-open=\"false\"] {\n    justify-content: center;\n}\n.ap-fc__stage[data-surface-open=\"true\"] {\n    justify-content: flex-start;\n}\n.ap-fc__stage .ap-hero {\n    flex-shrink: 0;\n}\n.ap-fc__stage .ap-sei-canvas-host {\n    min-height: 0;\n}\n.ap-fc__stage .ap-sei-canvas-host[data-open=\"true\"] {\n    flex: 1 1 auto;\n    max-height: none;\n    min-height: 0;\n}\n.ap-fc__stage .ap-sei-canvas-host__inner {\n    height: 100%;\n    min-height: 0;\n    overflow-y: auto;\n    overscroll-behavior: contain;\n    padding: 4px 0 calc(16px + env(safe-area-inset-bottom, 0px));\n}\n.ap-fc__stage .ap-sei-canvas-placeholder {\n    min-height: 100%;\n}\n.ap-fc__stage .ap-queue-surface {\n    max-height: none;\n    min-height: 100%;\n    overflow-y: auto;\n    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));\n}\n.ap-fc__control-dock {\n    display: flex;\n    flex: 0 0 auto;\n    flex-direction: column;\n    gap: 12px;\n    min-height: 0;\n}\n.ap-fc__info {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    min-width: 0;\n    text-align: center;\n}\n.ap-fc__title {\n    font-size: 24px;\n    font-weight: 600;\n    letter-spacing: -0.02em;\n    line-height: 1.2;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-fc__artist {\n    font-size: 15px;\n    font-weight: 500;\n    opacity: 0.7;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n/* Narrow embeds (sidebars, 320px phones): tighten type and transport so the\n   five-button row fits without clipping. */\n@container ap-fc (max-width: 360px) {\n    .ap-fc__stage {\n        height: clamp(170px, 52cqw, 260px);\n        gap: 10px;\n    }\n    .ap-fc__control-dock {\n        gap: 10px;\n    }\n    .ap-fc__title {\n        font-size: clamp(17px, 6.5cqw, 22px);\n    }\n    .ap-fc__artist {\n        font-size: 13px;\n    }\n    .ap-fc .ap-transport {\n        gap: 8px;\n    }\n    .ap-fc .ap-btn--play {\n        width: 56px;\n        height: 56px;\n    }\n    .ap-fc .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 38px;\n        height: 38px;\n    }\n}\n/* Ultra-narrow embeds: one more shrink step, mirroring the base player. */\n@container ap-fc (max-width: 300px) {\n    .ap-fc__stage {\n        height: 160px;\n    }\n    .ap-fc .ap-transport {\n        gap: 6px;\n    }\n    .ap-fc .ap-btn--play {\n        width: 48px;\n        height: 48px;\n    }\n    .ap-fc .ap-btn--ghost:not(.ap-btn--sm) {\n        width: 34px;\n        height: 34px;\n    }\n    .ap-fc .ap-btn--sm {\n        width: 26px;\n        height: 26px;\n    }\n}\n/* ----------------------------- Vault row ----------------------------- */\n/* Classification color drives the WHOLE row (not just a dot): a solid left rail,\n   a tinted border, hover/active fills, the category chip, and the arc action\n   highlight all derive from `--ap-vault-accent` (set from `Track.vaultCategory`),\n   falling back to the theme `--ap-accent` for uncategorized rows. Tints use\n   `color-mix` so the hue stays subtle and content stays dominant. */\n.ap-vr {\n    box-sizing: border-box;\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    width: 100%;\n    padding: 8px 12px;\n    border-radius: 10px;\n    background-color: var(--ap-bg);\n    color: var(--ap-text);\n    border: 1px solid color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 24%, transparent);\n    /* Solid classification rail down the leading edge — the primary scan cue. */\n    border-left: 3px solid var(--ap-vault-accent, var(--ap-accent));\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n    transition: background-color 0.2s ease, border-color 0.2s ease;\n    /* Make the row a query container so its layout adapts to the row's own\n       width (mobile, narrow sidebars), independent of the viewport. */\n    container-type: inline-size;\n}\n.ap-vr *,\n.ap-vr *::before,\n.ap-vr *::after {\n    box-sizing: border-box;\n}\n.ap-vr:hover {\n    background-color: color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 8%, var(--ap-bg));\n}\n.ap-vr--active {\n    border-color: color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 55%, transparent);\n    background-color: color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 14%, var(--ap-bg));\n}\n.ap-vr__num {\n    min-width: 20px;\n    text-align: center;\n    font-size: 13px;\n    font-weight: 600;\n    opacity: 0.5;\n}\n.ap-vr__play {\n    /* Anchor for the coarse-pointer hit-area pseudo-element. */\n    position: relative;\n    width: 38px;\n    height: 38px;\n    flex-shrink: 0;\n}\n.ap-vr__meta {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 3px;\n}\n.ap-vr__title {\n    font-size: 14px;\n    font-weight: 600;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-vr__artist {\n    display: flex;\n    align-items: center;\n    gap: 6px;\n    min-width: 0;\n    font-size: 12px;\n}\n.ap-vr__artist-text {\n    min-width: 0;\n    opacity: 0.6;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-vr__time {\n    font-size: 12px;\n    opacity: 0.7;\n    font-variant-numeric: tabular-nums;\n    flex-shrink: 0;\n}\n/* Vault category identity: a labeled pill in the classification color, derived\n   from `Track.vaultCategory` (via `--ap-vault-accent`). Replaces the old subtle\n   dot so the row type is readable at a glance while scrolling. */\n.ap-vr__chip {\n    flex-shrink: 0;\n    padding: 2px 8px;\n    border-radius: 999px;\n    font-size: 11px;\n    font-weight: 600;\n    line-height: 1.4;\n    white-space: nowrap;\n    color: var(--ap-vault-accent, var(--ap-accent));\n    background-color: color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 16%, transparent);\n    border: 1px solid color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 40%, transparent);\n}\n/* Two placements for the same chip: a leading pill on wide rows (desktop) and a\n   compact inline chip on the artist line for narrow rows (mobile), so the title\n   never has to share its line with the chip. Exactly one shows at a time. */\n.ap-vr__chip--inline {\n    display: none;\n    font-size: 10px;\n    padding: 1px 6px;\n}\n.ap-vr__action {\n    flex-shrink: 0;\n}\n/* Mobile / narrow rows: give the title + artist the room they need. The leading\n   chip and the row number step aside (the colored rail still signals category,\n   and the chip reappears inline on the artist line); the inline time is dropped\n   since seeking lives on the shared StickyBottom scrubber. */\n@container (max-width: 380px) {\n    .ap-vr {\n        gap: 8px;\n        padding: 8px 10px;\n    }\n    .ap-vr__chip--lead {\n        display: none;\n    }\n    .ap-vr__chip--inline {\n        display: inline-flex;\n    }\n    .ap-vr__num,\n    .ap-vr__time {\n        display: none;\n    }\n}\n/* The arc trigger adopts the row's classification color when open/active. */\n.ap-vr__action.ap-surface-btn--active {\n    border-color: var(--ap-vault-accent, var(--ap-accent));\n    background-color: color-mix(in srgb, var(--ap-vault-accent, var(--ap-accent)) 22%, transparent);\n}\n/* ----------------------------- Sticky bottom bar ----------------------------- */\n/* The bar is a container; layout lives on __inner (a container can't style\n   itself with its own container query). */\n.ap-sb {\n    box-sizing: border-box;\n    width: 100%;\n    container: ap-sb / inline-size;\n    background-color: rgba(18, 18, 24, 0.92);\n    -webkit-backdrop-filter: blur(16px);\n    backdrop-filter: blur(16px);\n    border-top: 1px solid rgba(255, 255, 255, 0.1);\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n.ap-sb *,\n.ap-sb *::before,\n.ap-sb *::after {\n    box-sizing: border-box;\n}\n.ap-sb--fixed {\n    position: fixed;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    z-index: 50;\n}\n.ap-sb__inner {\n    display: flex;\n    align-items: center;\n    gap: 16px;\n    padding: 12px 20px;\n}\n.ap-sb__meta {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    min-width: 0;\n    flex: 0 1 clamp(120px, 20cqw, 220px);\n}\n.ap-sb__title {\n    font-size: 14px;\n    font-weight: 600;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-sb__artist {\n    font-size: 12px;\n    opacity: 0.6;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-sb__center {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    align-items: center;\n}\n.ap-sb__controls {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    min-width: 0;\n}\n.ap-sb__play {\n    width: 40px;\n    height: 40px;\n}\n.ap-sb__scrub {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    width: 100%;\n}\n.ap-sb__t {\n    font-size: 11px;\n    opacity: 0.7;\n    font-variant-numeric: tabular-nums;\n    flex-shrink: 0;\n    min-width: 34px;\n    text-align: center;\n}\n.ap-sb__volume {\n    width: 160px;\n    flex-shrink: 0;\n    display: flex;\n    justify-content: flex-end;\n}\n/* ----------------------------- Mini sidebar widget ----------------------------- */\n.ap-ms {\n    box-sizing: border-box;\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    width: 100%;\n    padding: 10px 12px;\n    border-radius: 12px;\n    /* Surface visuals (fill, blur, border, shadow) come from `.ap-glass-surface`\n       on the root element — bright/saturated --ap-bg colors stay legible\n       through a frosted scrim instead of being painted on flat. */\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n.ap-ms *,\n.ap-ms *::before,\n.ap-ms *::after {\n    box-sizing: border-box;\n}\n.ap-ms__art {\n    position: relative;\n    overflow: hidden;\n    width: 44px;\n    height: 44px;\n    border-radius: 8px;\n    flex-shrink: 0;\n    background-size: cover;\n    background-position: center;\n    background-repeat: no-repeat;\n    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);\n}\n/* Video artwork layers fill the square art blocks (mini + sea). */\n.ap-ms__bg,\n.ap-sea__bg {\n    border-radius: inherit;\n}\n.ap-ms__art--playing {\n    animation: ap-pulse 3s ease-in-out infinite;\n}\n.ap-ms__meta {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    /* Local frosted \"now playing\" label: anchors light text so it stays\n       readable over very bright surface colors (white-on-yellow, etc.) without\n       dampening the whole widget. On dark surfaces it reads as a faint chip and\n       stays out of the way. Vertical padding is small enough that the 44px art\n       block still sets the row height — no layout shift. */\n    padding: 3px 10px;\n    border-radius: 9px;\n    background-color: rgba(10, 12, 18, 0.26);\n    -webkit-backdrop-filter: blur(6px);\n    backdrop-filter: blur(6px);\n}\n.ap-ms__title {\n    font-size: 14px;\n    font-weight: 600;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    /* Soft dual halo (tight + diffuse) keeps the title crisp over very bright\n       surface colors, independent of the chosen --ap-text value — readability\n       comes from here, not from darkening the whole widget. */\n    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.32), 0 1px 5px rgba(0, 0, 0, 0.22);\n}\n.ap-ms__artist {\n    font-size: 12px;\n    opacity: 0.68;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.28), 0 1px 4px rgba(0, 0, 0, 0.2);\n}\n.ap-ms__play {\n    /* Anchor for the coarse-pointer hit-area pseudo-element. */\n    position: relative;\n    width: 38px;\n    height: 38px;\n    flex-shrink: 0;\n}\n/* ----------------------------- SEA embed card ----------------------------- */\n.ap-sea {\n    box-sizing: border-box;\n    width: 100%;\n    border-radius: 14px;\n    overflow: hidden;\n    background-color: var(--ap-bg);\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);\n}\n.ap-sea *,\n.ap-sea *::before,\n.ap-sea *::after {\n    box-sizing: border-box;\n}\n.ap-sea--active {\n    box-shadow: 0 0 0 2px var(--ap-accent);\n}\n.ap-sea__art {\n    position: relative;\n    width: 100%;\n    aspect-ratio: 1 / 1;\n    background-size: cover;\n    background-position: center;\n}\n.ap-sea__play {\n    position: absolute;\n    left: 50%;\n    top: 50%;\n    transform: translate(-50%, -50%);\n    width: 52px;\n    height: 52px;\n}\n.ap-sea__play.ap-tap:active:not(:disabled) {\n    transform: translate(-50%, -50%) scale(0.92);\n}\n.ap-sea__tag {\n    position: absolute;\n    top: 8px;\n    right: 8px;\n    padding: 3px 8px;\n    border-radius: 999px;\n    font-size: 11px;\n    font-weight: 700;\n    background-color: rgba(0, 0, 0, 0.5);\n    color: #fff;\n}\n.ap-sea__body {\n    padding: 12px 14px 14px;\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n}\n/* Title/artist row with the Arc action trigger on the right. The text column\n   flexes + truncates (min-width:0 lets ellipsis kick in inside flex); the\n   trigger keeps its fixed footprint and never overlaps the metadata. */\n.ap-sea__head {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n}\n.ap-sea__meta {\n    flex: 1 1 auto;\n    min-width: 0;\n}\n.ap-sea__title {\n    font-size: 15px;\n    font-weight: 600;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-sea__artist {\n    font-size: 13px;\n    opacity: 0.65;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.ap-sea__progress {\n    margin-top: 6px;\n}\n/* Phase 4: waveform overlay trigger (top-left of the art) + overlay body. */\n.ap-sea__wave-btn {\n    position: absolute;\n    top: 8px;\n    left: 8px;\n    width: 30px;\n    height: 30px;\n    border-radius: 999px;\n    background-color: rgba(0, 0, 0, 0.5);\n    color: #fff;\n}\n.ap-sea__wave-btn[aria-expanded=\"true\"] {\n    background-color: var(--ap-accent, rgba(0, 0, 0, 0.65));\n    color: var(--ap-play-icon, #000);\n}\n/* Arc action trigger: right side of the title/artist row (not overlaid on the\n   artwork). Round + sized to sit comfortably beside two lines of metadata;\n   flex-shrink:0 keeps it from being squeezed by long titles. */\n.ap-sea__action {\n    flex: 0 0 auto;\n    width: 36px;\n    height: 36px;\n    border-radius: 999px;\n}\n.ap-sea__action.ap-surface-btn--active {\n    background-color: var(--ap-accent, rgba(0, 0, 0, 0.65));\n    border-color: var(--ap-accent);\n    color: var(--ap-play-icon, #000);\n}\n.ap-sea__overlay {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    padding: 4px 14px 12px;\n}\n/* Sticky bar responsive behavior (container-based so it also works inside\n   sidebars and demo frames, not just full-bleed at the viewport bottom). */\n@container ap-sb (max-width: 860px) {\n    .ap-sb__volume {\n        display: none;\n    }\n}\n/* Phone widths: meta stacks above the controls + scrubber so nothing\n   competes for one row. Budget at 320px: 296px of content vs ~224px of\n   controls (5 transport buttons + the \"…\" trigger at 8px gaps). */\n@container ap-sb (max-width: 560px) {\n    .ap-sb__inner {\n        flex-wrap: wrap;\n        gap: 6px 10px;\n        padding: 10px 12px;\n    }\n    .ap-sb__meta {\n        flex: 1 1 100%;\n        text-align: center;\n    }\n    .ap-sb__center {\n        flex: 1 1 100%;\n    }\n    .ap-sb__controls {\n        gap: 8px;\n    }\n}\n/* Ultra-narrow embeds (the bar inside a padded card at 320px viewports):\n   tighten gaps and time stamps one more step. */\n@container ap-sb (max-width: 380px) {\n    .ap-sb__controls {\n        gap: 6px;\n    }\n    .ap-sb__scrub {\n        gap: 6px;\n    }\n    .ap-sb__t {\n        min-width: 30px;\n    }\n}\n/* Give the small faces' main play buttons the same coarse-pointer hit-area\n   expansion the base buttons get. */\n@media (pointer: coarse) {\n    .ap-ms__play::after,\n    .ap-vr__play::after,\n    .ap-sea__play::after {\n        content: \"\";\n        position: absolute;\n        inset: -8px;\n    }\n}\n/* =====================================================================\n   NarrativeFace (narrative family) — a faceless story/reader surface.\n   Minimal by design: a soundscape indicator, play/pause, mute + voice\n   level, ambience level, and an optional expand control. No artwork,\n   scrubber, or music chrome. Themed via the shared --ap-* vars.\n   ===================================================================== */\n.ap-nf {\n    box-sizing: border-box;\n    width: 100%;\n    display: flex;\n    align-items: center;\n    gap: 14px;\n    padding: 8px 14px;\n    border-radius: 12px;\n    background-color: var(--ap-bg);\n    -webkit-backdrop-filter: blur(14px);\n    backdrop-filter: blur(14px);\n    border: 1px solid rgba(255, 255, 255, 0.08);\n    color: var(--ap-text);\n    font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n}\n.ap-nf *,\n.ap-nf *::before,\n.ap-nf *::after {\n    box-sizing: border-box;\n}\n.ap-nf--embedded {\n    position: fixed;\n    left: 50%;\n    bottom: 16px;\n    transform: translateX(-50%);\n    width: min(560px, calc(100% - 24px));\n    z-index: 50;\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);\n}\n/* Soundscape indicator — a quiet pulse dot + mood label. */\n.ap-nf__scape {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    min-width: 0;\n    flex: 0 1 auto;\n}\n.ap-nf__dot {\n    width: 9px;\n    height: 9px;\n    border-radius: 50%;\n    background: var(--ap-accent);\n    opacity: 0.35;\n    flex: none;\n}\n.ap-nf--ambient .ap-nf__dot {\n    opacity: 0.7;\n}\n.ap-nf--narrating .ap-nf__dot {\n    opacity: 1;\n    animation: ap-nf-pulse 1.8s ease-in-out infinite;\n}\n@keyframes ap-nf-pulse {\n    0%, 100% { transform: scale(1); opacity: 0.55; }\n    50% { transform: scale(1.35); opacity: 1; }\n}\n@media (prefers-reduced-motion: reduce) {\n    .ap-nf--narrating .ap-nf__dot { animation: none; }\n}\n.ap-nf__mood {\n    font-size: 12px;\n    font-weight: 600;\n    letter-spacing: 0.01em;\n    text-transform: capitalize;\n    opacity: 0.85;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    max-width: 120px;\n}\n.ap-nf__play {\n    flex: none;\n}\n/* Volume blocks — a small label sitting above the reused control/slider. */\n.ap-nf__vol {\n    display: flex;\n    align-items: center;\n    gap: 6px;\n    min-width: 0;\n}\n.ap-nf__vol--narration {\n    flex: 1 1 auto;\n}\n.ap-nf__vol--ambience {\n    flex: 1 1 auto;\n}\n.ap-nf__vol-label {\n    font-size: 10px;\n    font-weight: 600;\n    letter-spacing: 0.04em;\n    text-transform: uppercase;\n    opacity: 0.55;\n    flex: none;\n}\n.ap-nf__range {\n    width: 100%;\n    min-width: 60px;\n    accent-color: var(--ap-accent);\n    cursor: pointer;\n}\n.ap-nf__range:disabled {\n    opacity: 0.4;\n    cursor: default;\n}\n.ap-nf__expand {\n    flex: none;\n}\n/* Stack the two level controls on narrow embeds. */\n@media (max-width: 460px) {\n    .ap-nf {\n        flex-wrap: wrap;\n        gap: 8px 12px;\n    }\n    .ap-nf__vol--narration,\n    .ap-nf__vol--ambience {\n        flex: 1 1 100%;\n    }\n}\n/*$vite$:1*/";
	document.head.appendChild(__vite_style__);
	Object.defineProperties(exports, {
		__esModule: { value: true },
		[Symbol.toStringTag]: { value: "Module" }
	});
	//#region \0rolldown/runtime.js
	var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
	//#endregion
	//#region src/audio-player/core/audio/audioCaches.ts
	/** Shared decoded-buffer LRU cache for Web Audio playback. */
	var LRUAudioCache = class {
		maxSize;
		cache = /* @__PURE__ */ new Map();
		order = [];
		constructor(maxSize = 12) {
			this.maxSize = maxSize;
		}
		getStats() {
			let size = 0;
			for (const buffer of this.cache.values()) size += buffer.length * buffer.numberOfChannels * 4;
			return {
				decodedBufferCount: this.cache.size,
				decodedBufferBytes: size,
				lruOrder: [...this.order]
			};
		}
		setMaxSize(size) {
			this.maxSize = size;
			this.enforceSize();
		}
		prune(keepKeys, keepRecent = 0) {
			const toKeep = new Set(keepKeys);
			let recentKept = 0;
			for (let i = this.order.length - 1; i >= 0; i--) {
				const key = this.order[i];
				if (toKeep.has(key)) continue;
				if (recentKept < keepRecent) {
					recentKept++;
					continue;
				}
				this.cache.delete(key);
				this.order.splice(i, 1);
			}
		}
		enforceSize() {
			while (this.cache.size > this.maxSize && this.order.length > 0) {
				const oldestKey = this.order.shift();
				this.cache.delete(oldestKey);
			}
		}
		get(url) {
			const buffer = this.cache.get(url);
			if (!buffer) return null;
			const index = this.order.indexOf(url);
			if (index > -1) this.order.splice(index, 1);
			this.order.push(url);
			return buffer;
		}
		set(url, buffer) {
			if (this.cache.has(url)) {
				this.cache.delete(url);
				const index = this.order.indexOf(url);
				if (index > -1) this.order.splice(index, 1);
			}
			this.order.push(url);
			this.cache.set(url, buffer);
			this.enforceSize();
		}
		has(url) {
			return this.cache.has(url);
		}
		delete(url) {
			this.cache.delete(url);
			const index = this.order.indexOf(url);
			if (index > -1) this.order.splice(index, 1);
		}
		clear() {
			this.cache.clear();
			this.order = [];
		}
	};
	function getMimeType(url) {
		const pathname = url.split("?")[0]?.toLowerCase() ?? "";
		if (pathname.endsWith(".wav")) return "audio/wav";
		if (pathname.endsWith(".ogg") || pathname.endsWith(".oga")) return "audio/ogg";
		if (pathname.endsWith(".m4a") || pathname.endsWith(".mp4")) return "audio/mp4";
		if (pathname.endsWith(".aac")) return "audio/aac";
		if (pathname.endsWith(".flac")) return "audio/flac";
		if (pathname.endsWith(".webm")) return "audio/webm";
		return "audio/mpeg";
	}
	/** Persistent raw audio cache backed by the browser Cache API. */
	var PersistentAudioCache = class {
		cacheName = "seihouse-audio-vault-v1";
		get isAvailable() {
			return typeof caches !== "undefined" && typeof Response !== "undefined";
		}
		async getArrayBuffer(url) {
			if (!this.isAvailable) return null;
			try {
				const response = await (await caches.open(this.cacheName)).match(url);
				return response ? await response.arrayBuffer() : null;
			} catch {
				return null;
			}
		}
		async putArrayBuffer(url, buffer) {
			if (!this.isAvailable) return;
			try {
				const cache = await caches.open(this.cacheName);
				const response = new Response(buffer.slice(0), { headers: {
					"Content-Type": getMimeType(url),
					"Content-Length": buffer.byteLength.toString()
				} });
				await cache.put(url, response);
			} catch (error) {
				console.warn("Persistent cache full or unavailable, skipping disk write.", error);
			}
		}
	};
	/** Pool of detached HTMLAudioElements for passive preload / streaming fallbacks. */
	var HTML5AudioPool = class {
		maxSize;
		pool = [];
		constructor(maxSize = 5) {
			this.maxSize = maxSize;
		}
		getStats() {
			return { preloadElementCount: this.pool.length };
		}
		acquire() {
			let audio = this.pool.find((candidate) => candidate.paused && !candidate.ended);
			if (!audio && this.pool.length < this.maxSize) {
				audio = new Audio();
				audio.preload = "auto";
				this.pool.push(audio);
			} else if (!audio) {
				audio = this.pool[0];
				audio.pause();
			}
			return audio;
		}
		release(audio) {
			audio.pause();
			audio.removeAttribute("src");
			audio.src = "";
			audio.load();
		}
		releaseAll() {
			for (const audio of this.pool) this.release(audio);
		}
	};
	var sharedAudioBufferCache = new LRUAudioCache();
	var sharedAudioStorageCache = new PersistentAudioCache();
	var sharedHTML5AudioPool = new HTML5AudioPool();
	//#endregion
	//#region src/audio-player/core/audio/HTML5AudioBackend.ts
	var HTML5_CAPABILITIES = {
		streaming: true,
		preciseTiming: false,
		reliableVolume: false,
		decodeAhead: false,
		requiresCors: false,
		progressiveBuffered: true
	};
	/**
	* Thin pass-through over the host-rendered `<audio>` element. Every call reads
	* `audioRef.current` at invocation time and forwards 1:1, so behavior is
	* identical to the hook touching the element directly. When the ref has not
	* mounted, methods no-op / return the same defaults the hook's old
	* `if (!audio) return` guards produced.
	*/
	var HTML5AudioBackend = class {
		kind = "html5";
		audioRef;
		preloadAudio = null;
		info;
		constructor(audioRef, info) {
			this.audioRef = audioRef;
			this.info = info ?? {
				requested: "html5",
				active: "html5",
				didFallback: false,
				capabilities: HTML5_CAPABILITIES
			};
		}
		get audio() {
			return this.audioRef.current;
		}
		isAttached() {
			return this.audio !== null;
		}
		setSource(_src) {}
		load() {
			this.audio?.load();
		}
		clearSource() {
			const audio = this.audio;
			if (!audio) return;
			audio.removeAttribute("src");
			audio.load();
		}
		play() {
			const audio = this.audio;
			if (!audio) {
				const error = /* @__PURE__ */ new Error("Audio element is not mounted.");
				error.name = "NotSupportedError";
				return Promise.reject(error);
			}
			return audio.play();
		}
		pause() {
			this.audio?.pause();
		}
		getCurrentTime() {
			return this.audio?.currentTime ?? 0;
		}
		setCurrentTime(seconds) {
			const audio = this.audio;
			if (audio) audio.currentTime = seconds;
		}
		getDuration() {
			return this.audio?.duration ?? 0;
		}
		isPaused() {
			return this.audio?.paused ?? true;
		}
		isEnded() {
			return this.audio?.ended ?? false;
		}
		hasMetadata() {
			return (this.audio?.readyState ?? 0) >= 1;
		}
		setVolume(value) {
			const audio = this.audio;
			if (audio) audio.volume = value;
		}
		getVolume() {
			return this.audio?.volume ?? 1;
		}
		isMuted() {
			return this.audio?.muted ?? false;
		}
		setMuted(muted) {
			const audio = this.audio;
			if (audio) audio.muted = muted;
		}
		setLoop(loop) {
			const audio = this.audio;
			if (audio) audio.loop = loop;
		}
		getBufferedRanges() {
			const audio = this.audio;
			if (!audio) return [];
			const ranges = [];
			const length = audio.buffered.length;
			for (let i = 0; i < length; i++) ranges.push({
				start: audio.buffered.start(i),
				end: audio.buffered.end(i)
			});
			return ranges;
		}
		getError() {
			const error = this.audio?.error;
			if (!error) return null;
			switch (error.code) {
				case error.MEDIA_ERR_ABORTED: return "aborted";
				case error.MEDIA_ERR_NETWORK: return "network";
				case error.MEDIA_ERR_DECODE: return "decode";
				case error.MEDIA_ERR_SRC_NOT_SUPPORTED: return "src-not-supported";
				default: return "unknown";
			}
		}
		getDecodedData() {
			return null;
		}
		addEventListener(event, handler) {
			this.audio?.addEventListener(event, handler);
		}
		removeEventListener(event, handler) {
			this.audio?.removeEventListener(event, handler);
		}
		preload(url) {
			let el = this.preloadAudio;
			if (!el) {
				el = sharedHTML5AudioPool.acquire();
				el.preload = "auto";
				this.preloadAudio = el;
			}
			if (el.src !== url) {
				el.src = url;
				el.load();
			}
		}
		releasePreload() {
			if (this.preloadAudio) {
				sharedHTML5AudioPool.release(this.preloadAudio);
				this.preloadAudio = null;
			}
		}
		getMediaElement() {
			return this.audio;
		}
		getInfo() {
			return this.info;
		}
		destroy() {
			this.releasePreload();
		}
		supportsSpatial() {
			return false;
		}
		setStereo(_pan) {
			console.warn("[HTML5AudioBackend] setStereo() called but spatial audio is not supported. Use webaudio backend for spatial features.");
		}
		getStereo() {
			return 0;
		}
		setPos(_x, _y, _z) {
			console.warn("[HTML5AudioBackend] setPos() called but spatial audio is not supported. Use webaudio backend for spatial features.");
		}
		getPos() {
			return [
				0,
				0,
				0
			];
		}
		setOrientation(_x, _y, _z) {
			console.warn("[HTML5AudioBackend] setOrientation() called but spatial audio is not supported.");
		}
		getOrientation() {
			return [
				1,
				0,
				0
			];
		}
		setRate(_rate) {
			console.warn("[HTML5AudioBackend] setRate() called but rate control is not supported. Use webaudio backend for rate control.");
		}
		getRate() {
			return 1;
		}
		setDistanceModel(_model) {
			console.warn("[HTML5AudioBackend] setDistanceModel() called but spatial audio is not supported.");
		}
		getDistanceModel() {
			return "inverse";
		}
		setRefDistance(_distance) {
			console.warn("[HTML5AudioBackend] setRefDistance() called but spatial audio is not supported.");
		}
		getRefDistance() {
			return 1;
		}
		setMaxDistance(_distance) {
			console.warn("[HTML5AudioBackend] setMaxDistance() called but spatial audio is not supported.");
		}
		getMaxDistance() {
			return 1e4;
		}
		setRolloffFactor(_factor) {
			console.warn("[HTML5AudioBackend] setRolloffFactor() called but spatial audio is not supported.");
		}
		getRolloffFactor() {
			return 1;
		}
		setConeInnerAngle(_angle) {
			console.warn("[HTML5AudioBackend] setConeInnerAngle() called but spatial audio is not supported.");
		}
		getConeInnerAngle() {
			return 360;
		}
		setConeOuterAngle(_angle) {
			console.warn("[HTML5AudioBackend] setConeOuterAngle() called but spatial audio is not supported.");
		}
		getConeOuterAngle() {
			return 360;
		}
		setConeOuterGain(_gain) {
			console.warn("[HTML5AudioBackend] setConeOuterGain() called but spatial audio is not supported.");
		}
		getConeOuterGain() {
			return 0;
		}
		setLiteMode(_enabled) {}
		isLiteMode() {
			return true;
		}
	};
	//#endregion
	//#region src/audio-player/core/audio/WebAudioBackend.ts
	var WEBAUDIO_CAPABILITIES = {
		streaming: false,
		preciseTiming: true,
		reliableVolume: true,
		decodeAhead: true,
		requiresCors: true,
		progressiveBuffered: false
	};
	/** Default spatial audio values matching Howler.js conventions. */
	var DEFAULT_SPATIAL = {
		stereo: 0,
		pos: [
			0,
			0,
			0
		],
		orientation: [
			1,
			0,
			0
		],
		rate: 1,
		distanceModel: "inverse",
		refDistance: 1,
		maxDistance: 1e4,
		rolloffFactor: 1,
		coneInnerAngle: 360,
		coneOuterAngle: 360,
		coneOuterGain: 0,
		liteMode: false
	};
	function namedError(name, message) {
		const error = new Error(message);
		error.name = name;
		return error;
	}
	function getAudioContextCtor$1() {
		if (typeof window === "undefined") return void 0;
		return window.AudioContext ?? window.webkitAudioContext;
	}
	/**
	* One AudioContext shared by every WebAudioBackend instance on the page.
	* Browsers cap (and charge resources for) concurrent contexts, so each
	* backend gets its own GainNode into the shared context instead. Reference
	* counted: closed when the last backend releases it, recreated on demand.
	*/
	var sharedContext = null;
	var sharedContextUsers = 0;
	function retainSharedContext() {
		if (!sharedContext || sharedContext.state === "closed") {
			const Ctor = getAudioContextCtor$1();
			if (!Ctor) throw namedError("NotSupportedError", "Web Audio API unavailable.");
			sharedContext = new Ctor();
			sharedContextUsers = 0;
		}
		sharedContextUsers += 1;
		return sharedContext;
	}
	function releaseSharedContext(ctx) {
		if (ctx !== sharedContext) return;
		sharedContextUsers = Math.max(0, sharedContextUsers - 1);
		if (sharedContextUsers === 0) {
			if (sharedContext.state !== "closed") sharedContext.close().catch(() => {});
			sharedContext = null;
		}
	}
	/**
	* Web Audio playback backend: fetch + decodeAudioData into an AudioBuffer,
	* played through AudioBufferSourceNode → [PannerNode] → StereoPannerNode → GainNode → destination.
	*
	* Spatial audio features (Howler.js-style API):
	* - Stereo panning via StereoPannerNode (-1 left to 1 right)
	* - 3D positioning via PannerNode with HRTF (default) or equalpower (lite mode)
	* - Source orientation for directional audio
	* - Distance modeling (inverse/linear/exponential) with refDistance, maxDistance, rolloffFactor
	* - Cone settings for directional audio (coneInnerAngle, coneOuterAngle, coneOuterGain)
	* - Playback rate control (0.5 to 4.0)
	* - Lite mode: skips 3D PannerNode, uses only StereoPannerNode for mobile/low-power
	*
	* Synthesizes the media-element events the engine hook expects, so the hook's
	* state machine is identical to the html5 path. Key semantic mappings:
	* - pause = stop the source node and remember the offset (not ctx.suspend(),
	*   which is context-global and would ambiguate the autoplay check).
	* - seek while playing = silently swap in a new source node at the offset.
	* - native loop = `source.loop`, which (like the html5 `loop` attribute)
	*   suppresses the `ended` event — repeat-one relies on that.
	* - volume = GainNode, so programmatic volume works on iOS Safari.
	*
	* A monotonic `generation` invalidates every in-flight fetch/decode/play when
	* the source changes — the backend-level mirror of the hook's playbackToken.
	*/
	var WebAudioBackend = class {
		kind = "webaudio";
		info;
		ctx = null;
		gain = null;
		panner = null;
		stereoPanner = null;
		source = null;
		buffer = null;
		srcUrl = null;
		state = "idle";
		/** Playback position while not playing; start offset while playing. */
		offset = 0;
		startedAtCtxTime = 0;
		volume = 1;
		muted = false;
		loopFlag = false;
		lastError = null;
		generation = 0;
		/** Invalidates `source.onended` from nodes we stopped on purpose. */
		sourceToken = 0;
		loadPromise = null;
		fetchAbort = null;
		preloadAborts = /* @__PURE__ */ new Map();
		/** In-flight preload decodes, so load() can adopt them instead of re-fetching. */
		preloadPromises = /* @__PURE__ */ new Map();
		listeners = /* @__PURE__ */ new Map();
		stereoPan = DEFAULT_SPATIAL.stereo;
		position = [...DEFAULT_SPATIAL.pos];
		orientation = [...DEFAULT_SPATIAL.orientation];
		rate = DEFAULT_SPATIAL.rate;
		distanceModel = DEFAULT_SPATIAL.distanceModel;
		refDistance = DEFAULT_SPATIAL.refDistance;
		maxDistance = DEFAULT_SPATIAL.maxDistance;
		rolloffFactor = DEFAULT_SPATIAL.rolloffFactor;
		coneInnerAngle = DEFAULT_SPATIAL.coneInnerAngle;
		coneOuterAngle = DEFAULT_SPATIAL.coneOuterAngle;
		coneOuterGain = DEFAULT_SPATIAL.coneOuterGain;
		liteMode = DEFAULT_SPATIAL.liteMode;
		constructor(info) {
			this.info = info;
		}
		emit(event) {
			const handlers = this.listeners.get(event);
			if (!handlers) return;
			for (const handler of Array.from(handlers)) handler();
		}
		ensureContext() {
			if (this.ctx && this.ctx.state !== "closed") return this.ctx;
			this.ctx = retainSharedContext();
			this.panner = this.ctx.createPanner();
			this.panner.panningModel = this.liteMode ? "equalpower" : "HRTF";
			this.panner.distanceModel = this.distanceModel;
			this.panner.refDistance = this.refDistance;
			this.panner.maxDistance = this.maxDistance;
			this.panner.rolloffFactor = this.rolloffFactor;
			this.panner.coneInnerAngle = this.coneInnerAngle;
			this.panner.coneOuterAngle = this.coneOuterAngle;
			this.panner.coneOuterGain = this.coneOuterGain;
			this.panner.positionX.value = this.position[0];
			this.panner.positionY.value = this.position[1];
			this.panner.positionZ.value = this.position[2];
			this.panner.orientationX.value = this.orientation[0];
			this.panner.orientationY.value = this.orientation[1];
			this.panner.orientationZ.value = this.orientation[2];
			this.gain = this.ctx.createGain();
			this.gain.gain.value = this.muted ? 0 : this.volume;
			if (typeof this.ctx.createStereoPanner === "function") {
				this.stereoPanner = this.ctx.createStereoPanner();
				this.stereoPanner.pan.value = this.stereoPan;
				this.panner.connect(this.stereoPanner);
				this.stereoPanner.connect(this.gain);
			} else this.panner.connect(this.gain);
			this.gain.connect(this.ctx.destination);
			return this.ctx;
		}
		cachePut(url, buffer) {
			sharedAudioBufferCache.set(url, buffer);
		}
		cacheTouch(url) {
			return sharedAudioBufferCache.get(url);
		}
		/** Stop the current source node without emitting any events. */
		stopSourceNode() {
			this.sourceToken += 1;
			const source = this.source;
			if (!source) return;
			this.source = null;
			source.onended = null;
			try {
				source.stop();
			} catch {}
			try {
				source.disconnect();
			} catch {}
		}
		abortFetch() {
			if (this.fetchAbort) {
				this.fetchAbort.abort();
				this.fetchAbort = null;
			}
		}
		failLoad(code, url) {
			this.buffer = null;
			this.lastError = code;
			this.state = "error";
			sharedAudioBufferCache.delete(url);
			this.emit("error");
		}
		async decodeArrayBuffer(data, url, gen, reportErrors = true) {
			try {
				const buffer = await this.ensureContext().decodeAudioData(data.slice(0));
				if (gen !== this.generation) return null;
				this.cachePut(url, buffer);
				return buffer;
			} catch {
				if (gen !== this.generation) return null;
				if (reportErrors) this.failLoad("decode", url);
				return null;
			}
		}
		async fetchNetworkArrayBuffer(url, gen, reportErrors = true, signal) {
			const abort = signal ? null : new AbortController();
			const fetchSignal = signal ?? abort?.signal;
			if (abort) this.fetchAbort = abort;
			try {
				const response = await fetch(url, {
					mode: "cors",
					signal: fetchSignal
				});
				if (gen !== this.generation || fetchSignal?.aborted) return null;
				if (!response.ok) {
					if (reportErrors) this.failLoad("src-not-supported", url);
					return null;
				}
				const data = await response.arrayBuffer();
				if (gen !== this.generation || fetchSignal?.aborted) return null;
				return data;
			} catch (error) {
				if (gen !== this.generation) return null;
				if (error instanceof Error && error.name === "AbortError") return null;
				if (reportErrors) this.failLoad("network", url);
				return null;
			} finally {
				if (abort && this.fetchAbort === abort) this.fetchAbort = null;
			}
		}
		async loadBufferWaterfall(url, gen, reportErrors = true, signal) {
			const memoryHit = this.cacheTouch(url);
			if (memoryHit) return memoryHit;
			const diskHit = await sharedAudioStorageCache.getArrayBuffer(url);
			if (gen !== this.generation || signal?.aborted) return null;
			if (diskHit) return this.decodeArrayBuffer(diskHit, url, gen, reportErrors);
			const networkData = await this.fetchNetworkArrayBuffer(url, gen, reportErrors, signal);
			if (!networkData || gen !== this.generation || signal?.aborted) return null;
			const buffer = await this.decodeArrayBuffer(networkData, url, gen, reportErrors);
			if (buffer) sharedAudioStorageCache.putArrayBuffer(url, networkData);
			return buffer;
		}
		async fetchAndDecode(url, gen) {
			const buffer = await this.loadBufferWaterfall(url, gen);
			if (buffer && gen === this.generation) this.completeLoad(url, buffer);
		}
		/** Adopt a decoded buffer as the active source and announce readiness. */
		completeLoad(url, buffer) {
			this.buffer = buffer;
			this.cachePut(url, buffer);
			this.state = "ready";
			this.emit("loadedmetadata");
			this.emit("progress");
			this.emit("canplay");
			this.emit("canplaythrough");
		}
		/**
		* Wait for an in-flight preload of the same URL instead of starting a
		* second fetch+decode. Falls back to a real load when the preload failed
		* or was aborted, so errors surface through the normal path.
		*/
		async adoptPreload(url, pending, gen) {
			const buffer = await pending;
			if (gen !== this.generation) return;
			if (buffer) {
				this.completeLoad(url, buffer);
				return;
			}
			await this.fetchAndDecode(url, gen);
		}
		/** Start (or restart) playback of the decoded buffer at `offset` seconds. */
		startSource(offset) {
			const ctx = this.ensureContext();
			const buffer = this.buffer;
			if (!buffer || !this.gain) return;
			this.stopSourceNode();
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.loop = this.loopFlag;
			source.connect(this.panner);
			const token = this.sourceToken += 1;
			source.onended = () => {
				if (token !== this.sourceToken) return;
				this.source = null;
				this.offset = buffer.duration;
				this.state = "ended";
				this.emit("ended");
			};
			const clamped = Math.max(0, Math.min(offset, buffer.duration));
			source.start(0, clamped);
			this.source = source;
			this.offset = clamped;
			this.startedAtCtxTime = ctx.currentTime;
			this.state = "playing";
		}
		async playInternal() {
			if (!this.srcUrl) throw namedError("NotSupportedError", "No audio source set.");
			const ctx = this.ensureContext();
			if (!this.buffer && this.state !== "loading") this.load();
			const gen = this.generation;
			let resumed = false;
			try {
				await ctx.resume();
				resumed = true;
			} catch {
				resumed = false;
			}
			if (!resumed || ctx.state !== "running") throw namedError("NotAllowedError", "AudioContext requires a user gesture to start.");
			if (gen !== this.generation) throw namedError("AbortError", "Source changed during play().");
			if (!this.buffer) {
				this.emit("waiting");
				await this.loadPromise;
				if (gen !== this.generation) throw namedError("AbortError", "Source changed during play().");
				if (!this.buffer) throw namedError("NotSupportedError", "Audio failed to load or decode.");
			}
			if (this.state === "playing") return;
			const duration = this.buffer.duration;
			const startAt = this.state === "ended" || this.offset >= duration ? 0 : this.offset;
			this.startSource(startAt);
			this.emit("play");
			this.emit("playing");
		}
		isAttached() {
			return true;
		}
		setSource(src) {
			const next = src && src.trim().length > 0 ? src.trim() : null;
			this.generation += 1;
			this.abortFetch();
			this.stopSourceNode();
			this.srcUrl = next;
			this.buffer = null;
			this.offset = 0;
			this.lastError = null;
			this.loadPromise = null;
			this.state = "idle";
		}
		load() {
			this.generation += 1;
			const gen = this.generation;
			this.abortFetch();
			this.stopSourceNode();
			this.buffer = null;
			this.offset = 0;
			this.lastError = null;
			this.emit("loadstart");
			const url = this.srcUrl;
			if (!url) {
				this.state = "idle";
				this.loadPromise = null;
				return;
			}
			const cached = this.cacheTouch(url);
			if (cached) {
				this.completeLoad(url, cached);
				this.loadPromise = Promise.resolve();
				return;
			}
			this.state = "loading";
			const pending = this.preloadPromises.get(url);
			this.loadPromise = pending ? this.adoptPreload(url, pending, gen) : this.fetchAndDecode(url, gen);
		}
		clearSource() {
			this.setSource(null);
		}
		play() {
			return this.playInternal();
		}
		pause() {
			if (this.state !== "playing") return;
			this.offset = this.getCurrentTime();
			this.stopSourceNode();
			this.state = "paused";
			this.emit("pause");
		}
		getCurrentTime() {
			const duration = this.buffer?.duration ?? 0;
			if (this.state === "playing" && this.ctx) {
				const elapsed = this.ctx.currentTime - this.startedAtCtxTime;
				const position = this.offset + elapsed;
				if (this.loopFlag && duration > 0) return position % duration;
				return Math.min(position, duration);
			}
			return this.offset;
		}
		setCurrentTime(seconds) {
			const duration = this.buffer?.duration ?? 0;
			if (duration <= 0) {
				this.offset = Math.max(0, seconds);
				return;
			}
			const clamped = Math.max(0, Math.min(duration, seconds));
			if (this.state === "playing") {
				this.startSource(clamped);
				return;
			}
			this.offset = clamped;
			if (this.state === "ended" && clamped < duration) this.state = "paused";
			this.emit("timeupdate");
		}
		getDuration() {
			return this.buffer?.duration ?? 0;
		}
		isPaused() {
			return this.state !== "playing";
		}
		isEnded() {
			return this.state === "ended";
		}
		hasMetadata() {
			return this.buffer !== null;
		}
		setVolume(value) {
			this.volume = Math.max(0, Math.min(1, value));
			if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
		}
		getVolume() {
			return this.volume;
		}
		isMuted() {
			return this.muted;
		}
		setMuted(muted) {
			this.muted = muted;
			if (this.gain) this.gain.gain.value = muted ? 0 : this.volume;
		}
		setLoop(loop) {
			if (loop === this.loopFlag) return;
			if (this.state === "playing" && this.ctx) {
				this.offset = this.getCurrentTime();
				this.startedAtCtxTime = this.ctx.currentTime;
			}
			this.loopFlag = loop;
			if (this.source) this.source.loop = loop;
		}
		getBufferedRanges() {
			const duration = this.buffer?.duration ?? 0;
			if (duration <= 0) return [];
			return [{
				start: 0,
				end: duration
			}];
		}
		getError() {
			return this.lastError;
		}
		getDecodedData() {
			return this.buffer;
		}
		addEventListener(event, handler) {
			let handlers = this.listeners.get(event);
			if (!handlers) {
				handlers = /* @__PURE__ */ new Set();
				this.listeners.set(event, handlers);
			}
			handlers.add(handler);
		}
		removeEventListener(event, handler) {
			this.listeners.get(event)?.delete(handler);
		}
		preload(url) {
			const trimmed = url.trim();
			if (!trimmed) return;
			if (sharedAudioBufferCache.has(trimmed) || this.preloadPromises.has(trimmed)) return;
			const abort = new AbortController();
			this.preloadAborts.set(trimmed, abort);
			const run = async () => {
				try {
					const buffer = await this.loadBufferWaterfall(trimmed, this.generation, false, abort.signal);
					if (abort.signal.aborted) return null;
					return buffer;
				} catch {
					return null;
				} finally {
					if (this.preloadAborts.get(trimmed) === abort) this.preloadAborts.delete(trimmed);
					this.preloadPromises.delete(trimmed);
				}
			};
			this.preloadPromises.set(trimmed, run());
		}
		releasePreload() {
			for (const abort of this.preloadAborts.values()) abort.abort();
			this.preloadAborts.clear();
			this.preloadPromises.clear();
		}
		getMediaElement() {
			return null;
		}
		getInfo() {
			return this.info;
		}
		destroy() {
			this.generation += 1;
			this.abortFetch();
			this.stopSourceNode();
			this.releasePreload();
			sharedAudioBufferCache.clear();
			this.buffer = null;
			this.offset = 0;
			this.lastError = null;
			this.loadPromise = null;
			this.state = "idle";
			if (this.panner) {
				try {
					this.panner.disconnect();
				} catch {}
				this.panner = null;
			}
			if (this.stereoPanner) {
				try {
					this.stereoPanner.disconnect();
				} catch {}
				this.stereoPanner = null;
			}
			if (this.gain) {
				try {
					this.gain.disconnect();
				} catch {}
				this.gain = null;
			}
			if (this.ctx) releaseSharedContext(this.ctx);
			this.ctx = null;
		}
		supportsSpatial() {
			return true;
		}
		setStereo(pan) {
			this.stereoPan = Math.max(-1, Math.min(1, pan));
			if (this.stereoPanner) this.stereoPanner.pan.value = this.stereoPan;
		}
		getStereo() {
			return this.stereoPan;
		}
		setPos(x, y, z) {
			this.position = [
				x,
				y,
				z
			];
			if (this.panner) {
				this.panner.positionX.value = x;
				this.panner.positionY.value = y;
				this.panner.positionZ.value = z;
			}
		}
		getPos() {
			return this.position;
		}
		setOrientation(x, y, z) {
			this.orientation = [
				x,
				y,
				z
			];
			if (this.panner) {
				this.panner.orientationX.value = x;
				this.panner.orientationY.value = y;
				this.panner.orientationZ.value = z;
			}
		}
		getOrientation() {
			return this.orientation;
		}
		setRate(rate) {
			const clamped = Math.max(.5, Math.min(4, rate));
			this.rate = clamped;
			if (this.source) this.source.playbackRate.value = clamped;
		}
		getRate() {
			return this.rate;
		}
		setDistanceModel(model) {
			this.distanceModel = model;
			if (this.panner) this.panner.distanceModel = model;
		}
		getDistanceModel() {
			return this.distanceModel;
		}
		setRefDistance(distance) {
			this.refDistance = Math.max(0, distance);
			if (this.panner) this.panner.refDistance = this.refDistance;
		}
		getRefDistance() {
			return this.refDistance;
		}
		setMaxDistance(distance) {
			this.maxDistance = Math.max(0, distance);
			if (this.panner) this.panner.maxDistance = this.maxDistance;
		}
		getMaxDistance() {
			return this.maxDistance;
		}
		setRolloffFactor(factor) {
			this.rolloffFactor = Math.max(0, factor);
			if (this.panner) this.panner.rolloffFactor = this.rolloffFactor;
		}
		getRolloffFactor() {
			return this.rolloffFactor;
		}
		setConeInnerAngle(angle) {
			this.coneInnerAngle = Math.max(0, Math.min(360, angle));
			if (this.panner) this.panner.coneInnerAngle = this.coneInnerAngle;
		}
		getConeInnerAngle() {
			return this.coneInnerAngle;
		}
		setConeOuterAngle(angle) {
			this.coneOuterAngle = Math.max(0, Math.min(360, angle));
			if (this.panner) this.panner.coneOuterAngle = this.coneOuterAngle;
		}
		getConeOuterAngle() {
			return this.coneOuterAngle;
		}
		setConeOuterGain(gain) {
			this.coneOuterGain = Math.max(0, Math.min(1, gain));
			if (this.panner) this.panner.coneOuterGain = this.coneOuterGain;
		}
		getConeOuterGain() {
			return this.coneOuterGain;
		}
		setLiteMode(enabled) {
			if (enabled === this.liteMode) return;
			this.liteMode = enabled;
			if (this.panner && this.ctx) {
				const oldPanner = this.panner;
				const newPanner = this.ctx.createPanner();
				newPanner.panningModel = enabled ? "equalpower" : "HRTF";
				newPanner.distanceModel = this.distanceModel;
				newPanner.refDistance = this.refDistance;
				newPanner.maxDistance = this.maxDistance;
				newPanner.rolloffFactor = this.rolloffFactor;
				newPanner.coneInnerAngle = this.coneInnerAngle;
				newPanner.coneOuterAngle = this.coneOuterAngle;
				newPanner.coneOuterGain = this.coneOuterGain;
				newPanner.positionX.value = this.position[0];
				newPanner.positionY.value = this.position[1];
				newPanner.positionZ.value = this.position[2];
				newPanner.orientationX.value = this.orientation[0];
				newPanner.orientationY.value = this.orientation[1];
				newPanner.orientationZ.value = this.orientation[2];
				if (this.source) {
					try {
						this.source.disconnect(oldPanner);
					} catch {}
					this.source.connect(newPanner);
				}
				try {
					oldPanner.disconnect(this.stereoPanner);
				} catch {}
				newPanner.connect(this.stereoPanner);
				this.panner = newPanner;
			}
		}
		isLiteMode() {
			return this.liteMode;
		}
		/**
		* Get the shared AudioContext for global listener control.
		* Returns null if the context hasn't been created yet.
		* Use this to control the global listener position/orientation.
		*/
		getAudioContext() {
			return this.ctx;
		}
	};
	//#endregion
	//#region src/audio-player/core/audio/AudioBackendFactory.ts
	/**
	* Returns why the Web Audio backend cannot run in this environment, or null
	* when it is supported.
	*/
	function webAudioUnsupportedReason() {
		if (typeof window === "undefined") return "no window (non-browser environment)";
		if (!(window.AudioContext ?? window.webkitAudioContext)) return "AudioContext is not available";
		if (typeof fetch !== "function") return "fetch is not available";
		return null;
	}
	/**
	* Instantiate the requested playback backend, falling back to HTML5 Audio
	* (with a console warning) when Web Audio is unavailable.
	*/
	function createAudioBackend(requested, deps) {
		if (requested === "webaudio") {
			const reason = webAudioUnsupportedReason();
			if (!reason) return new WebAudioBackend({
				requested: "webaudio",
				active: "webaudio",
				didFallback: false,
				capabilities: WEBAUDIO_CAPABILITIES
			});
			console.warn(`[AudioPlayer] Web Audio API not available (${reason}); falling back to HTML5 audio backend.`);
			return new HTML5AudioBackend(deps.audioRef, {
				requested: "webaudio",
				active: "html5",
				didFallback: true,
				fallbackReason: reason,
				capabilities: HTML5_CAPABILITIES
			});
		}
		return new HTML5AudioBackend(deps.audioRef, {
			requested: "html5",
			active: "html5",
			didFallback: false,
			capabilities: HTML5_CAPABILITIES
		});
	}
	/**
	* Whether a `waiting`/`stalled` event should be treated as real buffering.
	*
	* True only when playback is actually active or a play attempt is pending;
	* passive preload while paused must not show a spinner.
	*/
	function shouldEnterBuffering({ isPlaying, isPaused, hasPendingPlay }) {
		return isPlaying || hasPendingPlay || !isPaused;
	}
	/**
	* Build a debouncer for the buffering spinner. Kept pure (injectable timers) so
	* the schedule/cancel/don't-restart contract is unit-testable without a DOM,
	* while the engine wires it to the real media events.
	*/
	function createBufferingDebounce(delayMs = 300, scheduler = {
		setTimer: setTimeout,
		clearTimer: clearTimeout
	}) {
		let handle = null;
		return {
			schedule(show) {
				if (handle !== null) return;
				handle = scheduler.setTimer(() => {
					handle = null;
					show();
				}, delayMs);
			},
			cancel() {
				if (handle !== null) {
					scheduler.clearTimer(handle);
					handle = null;
				}
			}
		};
	}
	//#endregion
	//#region src/audio-player/utils/sources.ts
	function getUrlBase() {
		if (typeof globalThis !== "undefined") {
			const location = globalThis.location;
			if (location?.href) return location.href;
		}
		return "http://localhost/";
	}
	/**
	* Normalize a source URL once at the source-resolution boundary so playback,
	* waveform, automix, cache keys, and fallback comparisons all speak the same
	* URL language. Relative URLs become absolute in browser environments, matching
	* what HTMLMediaElement.currentSrc reports after the browser resolves `src`.
	*/
	function normalizeSourceUrl(url) {
		const trimmed = url.trim();
		if (!trimmed) return "";
		try {
			return new URL(trimmed, getUrlBase()).href;
		} catch {
			return trimmed;
		}
	}
	function normalizeSource$1(source) {
		const url = normalizeSourceUrl(source.url ?? "");
		if (!url) return null;
		const type = source.type?.trim();
		return type ? {
			url,
			type
		} : { url };
	}
	function dedupeSources$1(sources) {
		const seen = /* @__PURE__ */ new Set();
		const next = [];
		for (const source of sources) {
			const normalized = normalizeSource$1(source);
			if (!normalized || seen.has(normalized.url)) continue;
			seen.add(normalized.url);
			next.push(normalized);
		}
		return next;
	}
	/**
	* Resolve the ordered source list for a track.
	*
	* `track.sources` is authoritative when present and non-empty. Otherwise the
	* legacy `audioFile` remains the primary URL and `fallbackSources` are appended.
	*/
	function getTrackSources(track) {
		if (!track) return [];
		const declaredSources = dedupeSources$1(track.sources ?? []);
		if (declaredSources.length > 0) return declaredSources;
		return dedupeSources$1([{ url: track.audioFile ?? "" }, ...(track.fallbackSources ?? []).map((url) => ({ url }))]);
	}
	/** First playable URL for a track after source normalization. */
	function getPrimaryTrackSource(track) {
		return getTrackSources(track)[0]?.url ?? "";
	}
	/** Stable signature used to detect source-list changes without storing objects. */
	function trackSourcesSignature(track) {
		return JSON.stringify(getTrackSources(track).map((source) => [source.url, source.type ?? ""]));
	}
	//#endregion
	//#region src/audio-player/useAudioPlayer.ts
	function normalizeSource(source) {
		const url = source.url?.trim() ?? "";
		if (!url) return null;
		const type = source.type?.trim();
		return type ? {
			url,
			type
		} : { url };
	}
	function dedupeSources(sourceList) {
		const seen = /* @__PURE__ */ new Set();
		const next = [];
		for (const source of sourceList) {
			const normalized = normalizeSource(source);
			if (!normalized || seen.has(normalized.url)) continue;
			seen.add(normalized.url);
			next.push(normalized);
		}
		return next;
	}
	function resolveEngineSources(src, sources, fallbackSources) {
		const declaredSources = dedupeSources(sources ?? []);
		if (declaredSources.length > 0) return declaredSources;
		return dedupeSources([{ url: src }, ...(fallbackSources ?? []).map((url) => ({ url }))]);
	}
	function sourceListSignature(sources) {
		return JSON.stringify(sources.map((source) => [source.url, source.type ?? ""]));
	}
	/**
	* Headless audio engine. Owns a playback backend (HTML5 `<audio>` element by
	* default, Web Audio API on request) and is the sole source of truth for
	* playback state. UI components read state and call actions; they never touch
	* the backend directly.
	*
	* Notable behavior:
	* - `currentTime` is driven by a single rAF loop while playing, and set
	*   explicitly on seek / pause / metadata. There is no second update path.
	* - When `src` changes, playback continues automatically if it was playing
	*   (track-change UX). The very first load only plays when `autoPlay` is set.
	* - Browsers block audible autoplay without a user gesture; `autoPlay` is a
	*   best-effort attempt, not a guarantee. When blocked, the engine exposes an
	*   `autoplayBlocked` flag so the UI can prompt the user for a tap.
	* - A monotonic `playbackToken` is bumped on every source / play-attempt
	*   boundary. Async callbacks captured before the swap check the token and
	*   no-op if it has changed, which removes the rapid-track-skip race.
	* - The backend is fixed at mount; remount (e.g. via `key`) to switch.
	*/
	function useAudioPlayer(options) {
		const { src, fallbackSources, sources, sourceKey = src, autoPlay = false, loop = false, onEnded, onFallbackSource, audioBackend = "html5" } = options;
		const resolvedSources = (0, react.useMemo)(() => resolveEngineSources(src, sources, fallbackSources), [
			fallbackSources,
			sources,
			src
		]);
		const sourcesSignature = (0, react.useMemo)(() => sourceListSignature(resolvedSources), [resolvedSources]);
		const [activeSourceState, setActiveSourceState] = (0, react.useState)(() => ({
			sourceKey,
			signature: sourcesSignature,
			index: 0
		}));
		const currentSourceIndex = activeSourceState.sourceKey === sourceKey && activeSourceState.signature === sourcesSignature ? Math.max(0, Math.min(activeSourceState.index, resolvedSources.length - 1)) : 0;
		const currentSrc = (resolvedSources[currentSourceIndex] ?? null)?.url ?? "";
		const audioRef = (0, react.useRef)(null);
		const backendRef = (0, react.useRef)(null);
		if (backendRef.current === null) backendRef.current = createAudioBackend(audioBackend, { audioRef });
		const backendChangeWarnedRef = (0, react.useRef)(false);
		if (backendRef.current.getInfo().requested !== audioBackend && !backendChangeWarnedRef.current) {
			backendChangeWarnedRef.current = true;
			console.warn("[AudioPlayer] audioBackend changed after mount; the backend is fixed at mount. Remount the player (e.g. with a key) to switch.");
		}
		const currentTimeRef = (0, react.useRef)(0);
		const isSeekingRef = (0, react.useRef)(false);
		const isPlayingRef = (0, react.useRef)(false);
		const playPromiseRef = (0, react.useRef)(null);
		const animationFrameRef = (0, react.useRef)(null);
		const fadeFrameRef = (0, react.useRef)(null);
		const bufferingDebounceRef = (0, react.useRef)(null);
		if (bufferingDebounceRef.current === null) bufferingDebounceRef.current = createBufferingDebounce();
		const isFirstLoadRef = (0, react.useRef)(true);
		const previousVolumeRef = (0, react.useRef)(1);
		const pendingSeekRef = (0, react.useRef)(null);
		const onEndedRef = (0, react.useRef)(onEnded);
		onEndedRef.current = onEnded;
		const onFallbackSourceRef = (0, react.useRef)(onFallbackSource);
		onFallbackSourceRef.current = onFallbackSource;
		const sourceListRef = (0, react.useRef)(resolvedSources);
		const sourceKeyRef = (0, react.useRef)(sourceKey);
		const sourcesSignatureRef = (0, react.useRef)(sourcesSignature);
		const currentSourceIndexRef = (0, react.useRef)(currentSourceIndex);
		const currentSrcRef = (0, react.useRef)(currentSrc);
		const fallbackShouldPlayRef = (0, react.useRef)(null);
		sourceListRef.current = resolvedSources;
		sourceKeyRef.current = sourceKey;
		sourcesSignatureRef.current = sourcesSignature;
		currentSourceIndexRef.current = currentSourceIndex;
		currentSrcRef.current = currentSrc;
		/**
		* Bumped on any operation that should invalidate in-flight async audio
		* callbacks (src change, retry, loadAndPlay). Comparing the captured token
		* to the latest token is how we keep stale `play().then/.catch` from
		* clobbering state after a fast track skip.
		*/
		const playbackTokenRef = (0, react.useRef)(0);
		/**
		* Stores the last token for which we already raised the autoplay-blocked
		* affordance, so we don't spam a state update for every rejected promise.
		*/
		const lastAutoplayBlockedTokenRef = (0, react.useRef)(-1);
		const [isPlaying, setIsPlaying] = (0, react.useState)(false);
		const [currentTime, setCurrentTime] = (0, react.useState)(0);
		const [duration, setDuration] = (0, react.useState)(0);
		const [buffered, setBuffered] = (0, react.useState)(0);
		const [bufferedRanges, setBufferedRanges] = (0, react.useState)([]);
		const [volume, setVolumeState] = (0, react.useState)(1);
		const [isMuted, setIsMuted] = (0, react.useState)(false);
		const [isSeeking, setIsSeekingState] = (0, react.useState)(false);
		const [isBuffering, setIsBuffering] = (0, react.useState)(false);
		const [hasError, setHasError] = (0, react.useState)(false);
		const [errorMessage, setErrorMessage] = (0, react.useState)("");
		const [autoplayBlocked, setAutoplayBlocked] = (0, react.useState)(false);
		const volumeUnsupportedRef = (0, react.useRef)(false);
		const [volumeUnsupported, setVolumeUnsupported] = (0, react.useState)(false);
		const hasAudio = currentSrc.trim().length > 0;
		const bumpToken = (0, react.useCallback)(() => {
			playbackTokenRef.current += 1;
			return playbackTokenRef.current;
		}, []);
		const clearPendingPlay = (0, react.useCallback)(() => {
			if (playPromiseRef.current) {
				playPromiseRef.current.catch(() => {});
				playPromiseRef.current = null;
			}
		}, []);
		const stopLoop = (0, react.useCallback)(() => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		}, []);
		const clearBufferingTimer = (0, react.useCallback)(() => {
			bufferingDebounceRef.current?.cancel();
		}, []);
		const tryFallbackSource = (0, react.useCallback)((failedSource, error, shouldPlayAfterSwitch) => {
			const sourceList = sourceListRef.current;
			const failedUrl = failedSource.trim();
			const previousActiveSource = currentSrcRef.current;
			const activeIndex = currentSourceIndexRef.current;
			const failedIndex = failedUrl ? sourceList.findIndex((source) => source.url === failedUrl) : -1;
			const nextIndex = (failedIndex >= 0 ? failedIndex : activeIndex) + 1;
			if (nextIndex <= activeIndex) return true;
			if (nextIndex >= sourceList.length) return false;
			const nextSource = sourceList[nextIndex];
			if (!nextSource?.url) return false;
			bumpToken();
			clearPendingPlay();
			stopLoop();
			backendRef.current?.pause();
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			fallbackShouldPlayRef.current = shouldPlayAfterSwitch;
			currentSourceIndexRef.current = nextIndex;
			currentSrcRef.current = nextSource.url;
			setHasError(false);
			setErrorMessage("");
			setAutoplayBlocked(false);
			clearBufferingTimer();
			setIsBuffering(shouldPlayAfterSwitch);
			setActiveSourceState({
				sourceKey: sourceKeyRef.current,
				signature: sourcesSignatureRef.current,
				index: nextIndex
			});
			onFallbackSourceRef.current?.({
				failedSource: failedUrl || previousActiveSource,
				nextSource: nextSource.url,
				nextSourceType: nextSource.type,
				sourceIndex: nextIndex,
				sourceCount: sourceList.length,
				error: error ?? null
			});
			return true;
		}, [
			bumpToken,
			clearPendingPlay,
			stopLoop,
			clearBufferingTimer
		]);
		const setSeeking = (0, react.useCallback)((active) => {
			isSeekingRef.current = active;
			setIsSeekingState(active);
		}, []);
		const play = (0, react.useCallback)((reportError = true) => {
			const backend = backendRef.current;
			if (!backend.isAttached() || !hasAudio) return;
			const token = bumpToken();
			clearPendingPlay();
			setHasError(false);
			setErrorMessage("");
			let playPromise;
			try {
				playPromise = backend.play();
			} catch (error) {
				if (playbackTokenRef.current !== token) return;
				const name = error instanceof Error ? error.name : "";
				if (tryFallbackSource(currentSrcRef.current, name || "unknown", true)) return;
				if (reportError) {
					setHasError(true);
					setErrorMessage("Playback failed. Please try again.");
				}
				return;
			}
			playPromiseRef.current = playPromise;
			playPromise.then(() => {
				if (playbackTokenRef.current !== token) return;
				if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
			}).catch((error) => {
				if (playbackTokenRef.current !== token) return;
				if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
				const name = error instanceof Error ? error.name : "";
				if (name === "AbortError") return;
				if (name === "NotAllowedError") {
					if (lastAutoplayBlockedTokenRef.current !== token) {
						lastAutoplayBlockedTokenRef.current = token;
						setAutoplayBlocked(true);
					}
					setIsPlaying(false);
					clearBufferingTimer();
					setIsBuffering(false);
					return;
				}
				if (tryFallbackSource(backend.getMediaElement()?.currentSrc || currentSrcRef.current, name || backend.getError() || "unknown", true)) return;
				setIsPlaying(false);
				clearBufferingTimer();
				setIsBuffering(false);
				if (reportError) {
					setHasError(true);
					setErrorMessage(name === "NotSupportedError" ? "Audio file not found or format not supported." : "Playback failed. Please try again.");
				}
			});
		}, [
			bumpToken,
			clearPendingPlay,
			hasAudio,
			tryFallbackSource,
			clearBufferingTimer
		]);
		const pause = (0, react.useCallback)(() => {
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			const pending = playPromiseRef.current;
			if (pending) {
				bumpToken();
				pending.catch(() => {}).finally(() => {
					if (playPromiseRef.current === pending) playPromiseRef.current = null;
					backend.pause();
				});
				return;
			}
			backend.pause();
		}, [bumpToken]);
		const toggle = (0, react.useCallback)(() => {
			if (!hasAudio) return;
			if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") try {
				navigator.vibrate(10);
			} catch (err) {}
			if (isPlayingRef.current) pause();
			else play(true);
		}, [
			hasAudio,
			pause,
			play
		]);
		const seek = (0, react.useCallback)((time) => {
			const backend = backendRef.current;
			if (!backend.isAttached() || !hasAudio) return;
			if (duration <= 0) {
				pendingSeekRef.current = time;
				return;
			}
			pendingSeekRef.current = null;
			const next = Math.max(0, Math.min(duration, time));
			backend.setCurrentTime(next);
			currentTimeRef.current = next;
			setCurrentTime(next);
		}, [duration, hasAudio]);
		const seekBy = (0, react.useCallback)((delta) => {
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			seek(backend.getCurrentTime() + delta);
		}, [seek]);
		const setVolume = (0, react.useCallback)((value) => {
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			const backend = backendRef.current;
			const next = Math.max(0, Math.min(1, value));
			previousVolumeRef.current = next > 0 ? next : previousVolumeRef.current;
			setVolumeState(next);
			if (backend.isAttached()) {
				if (!volumeUnsupportedRef.current && next !== 0) {
					backend.setVolume(next);
					if (Math.abs(backend.getVolume() - next) > .001) {
						volumeUnsupportedRef.current = true;
						setVolumeUnsupported(true);
					}
				} else backend.setVolume(next);
				if (next > 0 && backend.isMuted()) {
					backend.setMuted(false);
					setIsMuted(false);
				}
			}
		}, []);
		const toggleMute = (0, react.useCallback)(() => {
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			const nextMuted = !backend.isMuted();
			backend.setMuted(nextMuted);
			setIsMuted(nextMuted);
			if (!nextMuted && backend.getVolume() === 0) {
				const restored = previousVolumeRef.current || 1;
				backend.setVolume(restored);
				setVolumeState(restored);
			}
		}, []);
		const retry = (0, react.useCallback)(() => {
			const backend = backendRef.current;
			if (!backend.isAttached() || !hasAudio) return;
			bumpToken();
			clearPendingPlay();
			setHasError(false);
			setErrorMessage("");
			setAutoplayBlocked(false);
			clearBufferingTimer();
			setIsBuffering(true);
			backend.load();
			play(true);
		}, [
			bumpToken,
			clearPendingPlay,
			clearBufferingTimer,
			hasAudio,
			play
		]);
		const loadAndPlay = (0, react.useCallback)(() => {
			const backend = backendRef.current;
			if (!backend.isAttached() || !hasAudio) return;
			bumpToken();
			backend.load();
			play(true);
		}, [
			bumpToken,
			hasAudio,
			play
		]);
		const dismissAutoplayBlocked = (0, react.useCallback)(() => {
			setAutoplayBlocked(false);
		}, []);
		const preload = (0, react.useCallback)((track) => {
			for (const source of getTrackSources(track)) backendRef.current.preload(source.url);
		}, []);
		const unload = (0, react.useCallback)(() => {
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			bumpToken();
			clearPendingPlay();
			stopLoop();
			backend.pause();
			backend.clearSource();
			currentTimeRef.current = 0;
			setCurrentTime(0);
			setDuration(0);
			setBuffered(0);
			setBufferedRanges([]);
			setIsPlaying(false);
			isPlayingRef.current = false;
			setHasError(false);
			setErrorMessage("");
			clearBufferingTimer();
			setIsBuffering(false);
			setAutoplayBlocked(false);
			pendingSeekRef.current = null;
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			backend.releasePreload();
		}, [
			bumpToken,
			clearPendingPlay,
			stopLoop,
			clearBufferingTimer
		]);
		const fade = (0, react.useCallback)((to, durationMs) => {
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			const target = Math.max(0, Math.min(1, to));
			if (durationMs <= 0) {
				if (fadeFrameRef.current !== null) {
					cancelAnimationFrame(fadeFrameRef.current);
					fadeFrameRef.current = null;
				}
				backend.setVolume(target);
				setVolumeState(target);
				return;
			}
			const startVolume = backend.getVolume();
			const startTime = performance.now();
			if (fadeFrameRef.current !== null) cancelAnimationFrame(fadeFrameRef.current);
			const step = (now) => {
				const elapsed = now - startTime;
				const progress = Math.min(1, elapsed / durationMs);
				const next = startVolume + (target - startVolume) * progress;
				const clamped = Math.max(0, Math.min(1, next));
				backend.setVolume(clamped);
				setVolumeState(clamped);
				if (progress < 1) fadeFrameRef.current = requestAnimationFrame(step);
				else fadeFrameRef.current = null;
			};
			fadeFrameRef.current = requestAnimationFrame(step);
		}, []);
		(0, react.useEffect)(() => {
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			let lastUpdate = 0;
			const readBuffered = () => {
				try {
					const ranges = backend.getBufferedRanges();
					if (ranges.length > 0) {
						let furthest = 0;
						for (const range of ranges) if (range.end > furthest) furthest = range.end;
						setBufferedRanges(ranges);
						setBuffered(furthest);
					} else {
						setBufferedRanges([]);
						setBuffered(0);
					}
				} catch {}
			};
			const loop = (timestamp) => {
				if (!isSeekingRef.current) {
					currentTimeRef.current = backend.getCurrentTime();
					if (timestamp - lastUpdate >= 16) {
						setCurrentTime(backend.getCurrentTime());
						lastUpdate = timestamp;
					}
				}
				if (!backend.isPaused() && !backend.isEnded()) animationFrameRef.current = requestAnimationFrame(loop);
				else animationFrameRef.current = null;
			};
			const handlePlay = () => {
				isPlayingRef.current = true;
				setIsPlaying(true);
				clearBufferingTimer();
				setIsBuffering(false);
				setAutoplayBlocked(false);
				if (animationFrameRef.current === null) animationFrameRef.current = requestAnimationFrame(loop);
			};
			const handlePause = () => {
				isPlayingRef.current = false;
				setIsPlaying(false);
				clearBufferingTimer();
				setIsBuffering(false);
				stopLoop();
				currentTimeRef.current = backend.getCurrentTime();
				setCurrentTime(backend.getCurrentTime());
			};
			const handleEnded = () => {
				isPlayingRef.current = false;
				setIsPlaying(false);
				clearBufferingTimer();
				setIsBuffering(false);
				stopLoop();
				setCurrentTime(backend.getDuration() || backend.getCurrentTime());
				onEndedRef.current?.();
			};
			const handleLoadedMetadata = () => {
				const rawDuration = backend.getDuration();
				const loadedDuration = Number.isFinite(rawDuration) ? rawDuration : 0;
				setDuration(loadedDuration);
				const pending = pendingSeekRef.current;
				if (pending !== null && loadedDuration > 0) {
					pendingSeekRef.current = null;
					const clamped = Math.max(0, Math.min(loadedDuration, pending));
					backend.setCurrentTime(clamped);
					currentTimeRef.current = clamped;
					setCurrentTime(clamped);
				}
			};
			const handleWaiting = () => {
				if (!shouldEnterBuffering({
					isPlaying: isPlayingRef.current,
					isPaused: backend.isPaused(),
					hasPendingPlay: playPromiseRef.current !== null
				})) return;
				bufferingDebounceRef.current?.schedule(() => setIsBuffering(true));
			};
			const clearBuffering = () => {
				clearBufferingTimer();
				setIsBuffering(false);
			};
			const handleError = () => {
				const error = backend.getError();
				const failedSource = currentSrcRef.current;
				if (tryFallbackSource(failedSource, error, isPlayingRef.current || playPromiseRef.current !== null)) return;
				clearBufferingTimer();
				setIsBuffering(false);
				isPlayingRef.current = false;
				setIsPlaying(false);
				setHasError(true);
				switch (error) {
					case "aborted":
						setErrorMessage("Playback was aborted. Please try again.");
						break;
					case "network":
						setErrorMessage("Network error. Check your connection and try again.");
						break;
					case "decode":
						setErrorMessage("Audio file is corrupted or unsupported.");
						break;
					case "src-not-supported":
						setErrorMessage("Audio file not found or format not supported.");
						break;
					default: setErrorMessage("Failed to load audio. Please try again.");
				}
			};
			const handleLoadStart = () => {
				setHasError(false);
				setErrorMessage("");
			};
			backend.addEventListener("play", handlePlay);
			backend.addEventListener("pause", handlePause);
			backend.addEventListener("ended", handleEnded);
			backend.addEventListener("loadedmetadata", handleLoadedMetadata);
			backend.addEventListener("waiting", handleWaiting);
			backend.addEventListener("stalled", handleWaiting);
			backend.addEventListener("canplay", clearBuffering);
			backend.addEventListener("canplaythrough", clearBuffering);
			backend.addEventListener("playing", clearBuffering);
			backend.addEventListener("progress", readBuffered);
			backend.addEventListener("timeupdate", readBuffered);
			backend.addEventListener("error", handleError);
			backend.addEventListener("loadstart", handleLoadStart);
			if (backend.hasMetadata()) {
				handleLoadedMetadata();
				readBuffered();
			}
			return () => {
				stopLoop();
				clearBufferingTimer();
				if (fadeFrameRef.current !== null) {
					cancelAnimationFrame(fadeFrameRef.current);
					fadeFrameRef.current = null;
				}
				backend.removeEventListener("play", handlePlay);
				backend.removeEventListener("pause", handlePause);
				backend.removeEventListener("ended", handleEnded);
				backend.removeEventListener("loadedmetadata", handleLoadedMetadata);
				backend.removeEventListener("waiting", handleWaiting);
				backend.removeEventListener("stalled", handleWaiting);
				backend.removeEventListener("canplay", clearBuffering);
				backend.removeEventListener("canplaythrough", clearBuffering);
				backend.removeEventListener("playing", clearBuffering);
				backend.removeEventListener("progress", readBuffered);
				backend.removeEventListener("timeupdate", readBuffered);
				backend.removeEventListener("error", handleError);
				backend.removeEventListener("loadstart", handleLoadStart);
			};
		}, [
			stopLoop,
			tryFallbackSource,
			clearBufferingTimer
		]);
		(0, react.useEffect)(() => {
			const backend = backendRef.current;
			if (!backend.isAttached()) return;
			const isFallbackSwitch = fallbackShouldPlayRef.current !== null;
			const isFirstLoad = isFirstLoadRef.current;
			isFirstLoadRef.current = false;
			const wasPlaying = isPlayingRef.current;
			const shouldPlay = isFallbackSwitch ? fallbackShouldPlayRef.current === true : isFirstLoad ? autoPlay : wasPlaying;
			fallbackShouldPlayRef.current = null;
			const token = bumpToken();
			clearPendingPlay();
			stopLoop();
			backend.pause();
			if (fadeFrameRef.current !== null) {
				cancelAnimationFrame(fadeFrameRef.current);
				fadeFrameRef.current = null;
			}
			if (!isFirstLoad) {
				backend.setCurrentTime(0);
				currentTimeRef.current = 0;
				setSeeking(false);
				setCurrentTime(0);
				setDuration(0);
				setBuffered(0);
				setBufferedRanges([]);
				setIsPlaying(false);
				setHasError(false);
				setErrorMessage("");
				clearBufferingTimer();
				setIsBuffering(false);
				setAutoplayBlocked(false);
				pendingSeekRef.current = null;
			}
			if (!hasAudio) {
				backend.clearSource();
				return;
			}
			backend.setSource(currentSrc);
			if (!isFirstLoad) backend.load();
			if (shouldPlay) if (isFirstLoad) {
				let playPromise;
				try {
					playPromise = backend.play();
				} catch {
					return;
				}
				if (playPromise) {
					playPromiseRef.current = playPromise;
					playPromise.then(() => {
						if (playbackTokenRef.current !== token) return;
						if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
					}).catch((error) => {
						if (playbackTokenRef.current !== token) return;
						if (playPromiseRef.current === playPromise) playPromiseRef.current = null;
						const name = error instanceof Error ? error.name : "";
						if (name === "AbortError") return;
						if (name === "NotAllowedError") {
							if (lastAutoplayBlockedTokenRef.current !== token) {
								lastAutoplayBlockedTokenRef.current = token;
								setAutoplayBlocked(true);
							}
							setIsPlaying(false);
							clearBufferingTimer();
							setIsBuffering(false);
							return;
						}
						setHasError(true);
						setErrorMessage(name === "NotSupportedError" ? "Audio file not found or format not supported." : "Playback failed. Please try again.");
					});
				}
			} else play(!isFirstLoad);
		}, [
			currentSrc,
			sourceKey,
			sourcesSignature
		]);
		(0, react.useEffect)(() => {
			const backend = backendRef.current;
			if (backend.isAttached()) backend.setVolume(volume);
		}, [volume]);
		(0, react.useEffect)(() => {
			const backend = backendRef.current;
			if (backend.isAttached()) backend.setLoop(loop);
		}, [loop]);
		(0, react.useEffect)(() => {
			return () => {
				backendRef.current?.destroy();
			};
		}, []);
		const getBackendInfo = (0, react.useCallback)(() => backendRef.current.getInfo(), []);
		const getDecodedData = (0, react.useCallback)(() => backendRef.current.getDecodedData(), []);
		return {
			audioRef,
			isPlaying,
			currentTime,
			duration,
			buffered,
			bufferedRanges,
			volume,
			isMuted,
			isBuffering,
			isSeeking,
			hasError,
			errorMessage,
			hasAudio,
			currentSrc,
			currentSourceIndex,
			sourceCount: resolvedSources.length,
			volumeUnsupported,
			autoplayBlocked,
			play,
			pause,
			toggle,
			seek,
			seekBy,
			setSeeking,
			setVolume,
			toggleMute,
			retry,
			loadAndPlay,
			dismissAutoplayBlocked,
			preload,
			unload,
			fade,
			getBackendInfo,
			getDecodedData
		};
	}
	//#endregion
	//#region src/audio-player/utils/trackKey.ts
	/**
	* Returns a stable string that uniquely identifies a track.
	*
	* Prefers `track.id` when set — the cheapest, most reliable key.
	* Falls back to a composite of title + artist + source list for tracks that
	* were created before `id` was introduced. The fallback is good enough for
	* small playlists but can collide at Vault scale (duplicate titles, shared
	* CDN URLs after normalisation, stems/mixes with similar names), which is
	* why setting `id` is strongly recommended for production use.
	*/
	function trackKey(track) {
		if (!track) return "";
		if (track.id) return `id:${track.id}`;
		return `t:${JSON.stringify([
			track.title ?? "",
			track.artist ?? "",
			trackSourcesSignature(track)
		])}`;
	}
	//#endregion
	//#region src/audio-player/automix/decodeTrack.ts
	/**
	* Shared fetch + decode pipeline for automix track analysis.
	*
	* Extracted from the Automix Lite silence analysis so the Pro analysis can
	* reuse one download/decode per track. Every failure mode (no Web Audio,
	* CORS-blocked fetch, decode error, file too large, timeout) resolves to
	* `null`; callers treat that as "no analysis available".
	*/
	/** Skip analysis for files larger than this (decode memory + bandwidth). */
	var MAX_FILE_BYTES = 30 * 1024 * 1024;
	/** Skip analysis for tracks longer than this. */
	var MAX_DURATION_S = 900;
	var FETCH_TIMEOUT_MS = 1e4;
	function getDecodeContext() {
		if (typeof window === "undefined") return null;
		try {
			const Ctor = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
			if (!Ctor) return null;
			return new Ctor(1, 1, 44100);
		} catch {
			return null;
		}
	}
	/** decodeAudioData with support for callback-only (older WebKit) signatures. */
	function decode$1(ctx, data) {
		return new Promise((resolve, reject) => {
			try {
				const maybePromise = ctx.decodeAudioData(data, resolve, reject);
				if (maybePromise && typeof maybePromise.then === "function") maybePromise.then(resolve, reject);
			} catch (error) {
				reject(error);
			}
		});
	}
	/**
	* Download and decode a track within the conservative size/duration limits.
	* Resolves to `null` on any failure.
	*/
	async function fetchAndDecodeTrack(url) {
		if (typeof window === "undefined" || typeof fetch !== "function") return null;
		const ctx = getDecodeContext();
		if (!ctx) return null;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) return null;
			if (Number(response.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) return null;
			const data = await response.arrayBuffer();
			if (data.byteLength === 0 || data.byteLength > MAX_FILE_BYTES) return null;
			const buffer = await decode$1(ctx, data);
			if (buffer.duration > MAX_DURATION_S) return null;
			return buffer;
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	}
	//#endregion
	//#region src/audio-player/automix/silenceAnalysis.ts
	/**
	* Conservative silence trimming for Automix Lite.
	*
	* Downloads a track, decodes it, and RMS-scans the first/last seconds for
	* near-silence so crossfades don't run through dead air. This is deliberately
	* simple amplitude analysis — no BPM, beat grids, or song-structure detection.
	*
	* Every failure mode (no Web Audio, CORS-blocked fetch, decode error, file too
	* large, timeout) resolves to `null`, which callers treat as "no trims": the
	* track plays from its natural start to its natural end exactly as it would
	* with Automix off.
	*/
	/** RMS scan window. */
	var WINDOW_MS = 50;
	/** Amplitude floor treated as silence (~ -40 dBFS). */
	var RMS_THRESHOLD = .01;
	/** Never trim more than this from the head of a track. */
	var MAX_TRIM_START_MS = 12e3;
	/** Never trim more than this from the tail of a track. */
	var MAX_TRIM_END_MS = 2e4;
	/** If trims would leave less audio than this, distrust them entirely. */
	var MIN_REMAINING_S = 10;
	var NO_TRIMS = {
		trimStartMs: 0,
		trimEndMs: 0
	};
	/** In-flight + settled analysis per trackKey, so a track is analyzed once. */
	var pending$1 = /* @__PURE__ */ new Map();
	/** Settled results for synchronous reads from the playback hot path. */
	var settled$1 = /* @__PURE__ */ new Map();
	/** Serializes analyses so at most one decode is in memory at a time. */
	var lastJob$1 = Promise.resolve();
	/**
	* RMS-scan the first/last seconds of a decoded buffer for near-silence.
	* Pure: also used by the Automix Pro analysis on its shared decode.
	*/
	function scanSilenceEdges(buffer) {
		const win = Math.max(1, Math.round(WINDOW_MS / 1e3 * buffer.sampleRate));
		const length = buffer.length;
		const channels = [];
		for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) channels.push(buffer.getChannelData(c));
		if (channels.length === 0 || length < win) return NO_TRIMS;
		const windowRms = (start) => {
			const end = Math.min(length, start + win);
			let loudest = 0;
			for (const data of channels) {
				let sum = 0;
				for (let i = start; i < end; i++) {
					const v = data[i];
					sum += v * v;
				}
				const rms = Math.sqrt(sum / (end - start));
				if (rms > loudest) loudest = rms;
			}
			return loudest;
		};
		const totalWindows = Math.floor(length / win);
		let trimStartMs = 0;
		const headWindows = Math.min(totalWindows, Math.ceil(MAX_TRIM_START_MS / WINDOW_MS));
		for (let w = 0; w < headWindows; w++) {
			if (windowRms(w * win) >= RMS_THRESHOLD) {
				trimStartMs = w * WINDOW_MS;
				break;
			}
			trimStartMs = (w + 1) * WINDOW_MS;
		}
		trimStartMs = Math.min(trimStartMs, MAX_TRIM_START_MS);
		let trimEndMs = 0;
		const tailWindows = Math.min(totalWindows, Math.ceil(MAX_TRIM_END_MS / WINDOW_MS));
		for (let w = 0; w < tailWindows; w++) {
			const start = length - (w + 1) * win;
			if (start < 0) break;
			if (windowRms(start) >= RMS_THRESHOLD) {
				trimEndMs = w * WINDOW_MS;
				break;
			}
			trimEndMs = (w + 1) * WINDOW_MS;
		}
		trimEndMs = Math.min(trimEndMs, MAX_TRIM_END_MS);
		if (buffer.duration * 1e3 - trimStartMs - trimEndMs < MIN_REMAINING_S * 1e3) return NO_TRIMS;
		return {
			trimStartMs,
			trimEndMs
		};
	}
	async function analyze$1(url) {
		const buffer = await fetchAndDecodeTrack(url);
		if (!buffer) return null;
		return scanSilenceEdges(buffer);
	}
	/**
	* Kick off (or join) silence analysis for a track. Results are cached for the
	* lifetime of the page; analyses run one at a time. Resolves to `null` when
	* analysis is unavailable or unreliable — callers must fall back to the
	* track's natural start/end.
	*/
	function ensureTrackAnalysis(track) {
		const key = trackKey(track);
		const url = getPrimaryTrackSource(track);
		if (!key || !url) return Promise.resolve(null);
		const existing = pending$1.get(key);
		if (existing) return existing;
		const job = lastJob$1.catch(() => {}).then(() => analyze$1(url)).then((trims) => {
			settled$1.set(key, trims);
			return trims;
		}, () => {
			settled$1.set(key, null);
			return null;
		});
		lastJob$1 = job;
		pending$1.set(key, job);
		return job;
	}
	/**
	* Synchronous read of a finished analysis. Returns `null` while analysis is
	* pending, failed, or was never requested.
	*/
	function getTrackTrims(track) {
		if (!track) return null;
		return settled$1.get(trackKey(track)) ?? null;
	}
	/**
	* Seed the trims cache from another analysis pipeline. The Automix Pro
	* orchestrator shares this module's decode and silence scan; seeding lets
	* `getTrackTrims()` serve trims as soon as the scan finishes, long before the
	* slower rhythm extraction settles, without a second download. Existing
	* entries are never overwritten.
	*/
	function seedTrackTrims(key, trims) {
		if (!key || settled$1.has(key)) return;
		settled$1.set(key, trims);
	}
	//#endregion
	//#region src/audio-player/automix/rhythmClient.ts
	/**
	* Main-thread client for the essentia rhythm worker.
	*
	* The worker (and with it the multi-megabyte essentia WASM chunk) is created
	* lazily on the first analysis request. Any failure — construction, WASM
	* init timeout, a hung job — latches `rhythmUnavailable` for the rest of the
	* page so callers degrade to trims-only analysis instead of retrying forever.
	*/
	var INIT_TIMEOUT_MS = 2e4;
	var JOB_TIMEOUT_MS = 3e4;
	var worker = null;
	var ready = null;
	var unavailable = false;
	var nextId = 1;
	var inflight = /* @__PURE__ */ new Map();
	function failEverything() {
		unavailable = true;
		for (const pending of inflight.values()) {
			clearTimeout(pending.timer);
			pending.resolve(null);
		}
		inflight.clear();
		try {
			worker?.terminate();
		} catch {}
		worker = null;
		ready = null;
	}
	function handleMessage(event) {
		const data = event.data;
		if (!data || typeof data !== "object" || !("id" in data)) return;
		const pending = inflight.get(data.id);
		if (!pending) return;
		inflight.delete(data.id);
		clearTimeout(pending.timer);
		if (data.ok) pending.resolve({
			bpm: data.bpm,
			ticksMs: data.ticksMs,
			confidenceRaw: data.confidence
		});
		else pending.resolve(null);
	}
	function ensureWorker() {
		if (unavailable) return Promise.resolve(false);
		if (ready) return ready;
		if (typeof Worker === "undefined") {
			unavailable = true;
			return Promise.resolve(false);
		}
		ready = new Promise((resolve) => {
			let instance;
			try {
				instance = new Worker(new URL(
					/* @vite-ignore */
					"/assets/rhythmWorker-CzRLqX0w.js",
					"" + {}.url
				), { type: "module" });
			} catch {
				unavailable = true;
				resolve(false);
				return;
			}
			const initTimer = setTimeout(() => {
				failEverything();
				resolve(false);
			}, INIT_TIMEOUT_MS);
			instance.addEventListener("message", (event) => {
				if (event.data && typeof event.data === "object" && "type" in event.data) {
					if (event.data.type === "ready") {
						clearTimeout(initTimer);
						resolve(true);
					}
					return;
				}
				handleMessage(event);
			});
			instance.addEventListener("error", () => {
				clearTimeout(initTimer);
				failEverything();
				resolve(false);
			});
			worker = instance;
		});
		return ready;
	}
	/**
	* Run beat/BPM extraction on a mono 44.1kHz segment. `samples` is transferred
	* to the worker and must not be reused afterwards. Resolves to `null` when
	* rhythm analysis is unavailable or fails.
	*/
	async function analyzeRhythm(samples, sampleRate, offsetMs) {
		const ok = await ensureWorker();
		const target = worker;
		if (!ok || !target) return null;
		const id = nextId++;
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				inflight.delete(id);
				failEverything();
				resolve(null);
			}, JOB_TIMEOUT_MS);
			inflight.set(id, {
				resolve,
				timer
			});
			const request = {
				id,
				samples,
				sampleRate,
				offsetMs
			};
			try {
				target.postMessage(request, [samples.buffer]);
			} catch {
				clearTimeout(timer);
				inflight.delete(id);
				failEverything();
				resolve(null);
			}
		});
	}
	//#endregion
	//#region src/audio-player/automix/analysisStore.ts
	/**
	* Best-effort IndexedDB persistence for Automix Pro analyses. Rhythm
	* extraction costs a download, a decode, and seconds of WASM CPU while the
	* result is ~1KB of JSON, so caching across page loads is a large win.
	*
	* Every operation swallows its errors and degrades to a miss/no-op: private
	* browsing modes, quota pressure, or a missing IndexedDB simply behave like
	* the in-memory-only world.
	*/
	var DB_NAME = "sap-automix";
	var STORE_NAME = "analysis";
	var dbPromise = null;
	function openDb() {
		if (dbPromise) return dbPromise;
		dbPromise = new Promise((resolve) => {
			if (typeof indexedDB === "undefined") return resolve(null);
			try {
				const request = indexedDB.open(DB_NAME, 1);
				request.onupgradeneeded = () => {
					try {
						request.result.createObjectStore(STORE_NAME);
					} catch {}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = (event) => {
					event.preventDefault();
					resolve(null);
				};
				request.onblocked = () => resolve(null);
			} catch {
				resolve(null);
			}
		});
		return dbPromise;
	}
	function storageKey(trackKey) {
		return `1:${trackKey}`;
	}
	async function readStoredAnalysis(trackKey) {
		const db = await openDb();
		if (!db) return null;
		return new Promise((resolve) => {
			try {
				const transaction = db.transaction(STORE_NAME, "readonly");
				transaction.onerror = (event) => event.preventDefault();
				const request = transaction.objectStore(STORE_NAME).get(storageKey(trackKey));
				request.onsuccess = () => {
					const value = request.result;
					resolve(value && typeof value === "object" ? value : null);
				};
				request.onerror = (event) => {
					event.preventDefault();
					resolve(null);
				};
			} catch {
				resolve(null);
			}
		});
	}
	async function writeStoredAnalysis(trackKey, analysis) {
		const db = await openDb();
		if (!db) return;
		try {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			transaction.onerror = (event) => event.preventDefault();
			transaction.objectStore(STORE_NAME).put(analysis, storageKey(trackKey));
		} catch {}
	}
	//#endregion
	//#region src/audio-player/automix/transitionPlanner.ts
	/**
	* Pure transition math for Automix Pro. No DOM, no Web Audio — everything
	* here is deterministic and unit-tested. The orchestrator uses
	* `computeTransitionPoints` to bake default transition points into a
	* `TrackAnalysis`; `AutomixPlugin` calls `planTransition` at preload time to
	* pick the actual fade length and timing for a specific track pair.
	*/
	/** RhythmExtractor2013 ("multifeature") reports confidence on a 0–5.32 scale. */
	var RAW_CONFIDENCE_MAX = 5.32;
	/** Below this normalized confidence a track's rhythm data is not trusted. */
	var PRO_CONFIDENCE_MIN = .55;
	/** BPM compatibility at/above this allows an extended beat-aware blend. */
	var COMPAT_BLEND_MIN = .5;
	/** Mean pair energy at/above this stretches the blend toward the maximum. */
	var HIGH_ENERGY_MIN = .5;
	/** Hard bounds for any Pro fade. */
	var FADE_MIN_MS = 2500;
	var FADE_MAX_MS = 12e3;
	/** Extended blend range used for BPM-compatible, high-energy pairs. */
	var LONG_BLEND_MIN_MS = 9e3;
	/** Never start a fade closer than this to the trimmed end of the track. */
	var FADE_END_SAFETY_MS = 2e3;
	/** How far past the trim start an incoming track may wait for its first beat. */
	var ENTRY_BEAT_WINDOW_MS = 2e3;
	/** Beat interval assumed when a track has beats but no usable BPM. */
	var DEFAULT_BEAT_INTERVAL_MS = 500;
	/** Map RhythmExtractor2013's raw confidence (0–5.32) to 0..1. */
	function normalizeRhythmConfidence(raw) {
		if (!Number.isFinite(raw) || raw <= 0) return 0;
		return Math.min(1, raw / RAW_CONFIDENCE_MAX);
	}
	/**
	* Score how mixable two tempos are, 0..1. Considers half- and double-time
	* relationships (85 vs 170 BPM scores 1). Score falls linearly from 1 at a
	* perfect match to 0 at `tolerancePct` relative error.
	*/
	function bpmCompatibility(a, b, tolerancePct = 8) {
		if (!a || !b || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 0;
		const tolerance = tolerancePct / 100;
		let best = 0;
		for (const multiplier of [
			1,
			2,
			.5
		]) {
			const relativeError = Math.abs(a * multiplier - b) / b;
			const score = Math.max(0, 1 - relativeError / tolerance);
			if (score > best) best = score;
		}
		return best;
	}
	/**
	* Return the beat nearest `targetMs`, or `targetMs` itself when no beat is
	* within `maxDriftMs`.
	*/
	function snapToBeat(targetMs, beatsMs, maxDriftMs) {
		let best = targetMs;
		let bestDrift = Infinity;
		for (const beat of beatsMs) {
			const drift = Math.abs(beat - targetMs);
			if (drift < bestDrift) {
				bestDrift = drift;
				best = beat;
			}
		}
		return bestDrift <= maxDriftMs ? best : targetMs;
	}
	function beatIntervalMs(bpm) {
		if (!bpm || !Number.isFinite(bpm) || bpm <= 0) return DEFAULT_BEAT_INTERVAL_MS;
		return 6e4 / bpm;
	}
	/**
	* Compute beat-snapped transition points for one track.
	*
	* `transitionOutMs` is where a crossfade of `fadeMs` should start so it ends
	* at the trimmed end: snapped to the nearest beat (within one beat interval),
	* but never later than `trimmedEnd − FADE_END_SAFETY_MS`. `transitionInMs` is
	* the first beat shortly after the trim start, where an incoming deck lands
	* on the grid instead of mid-beat.
	*/
	function computeTransitionPoints(analysis, trims, durationMs, fadeMs) {
		const beats = analysis.beats ?? [];
		const interval = beatIntervalMs(analysis.bpm);
		const trimmedEndMs = Math.max(0, durationMs - trims.trimEndMs);
		const latestStart = trimmedEndMs - FADE_END_SAFETY_MS;
		let transitionOutMs = snapToBeat(trimmedEndMs - fadeMs, beats, interval);
		transitionOutMs = Math.min(transitionOutMs, latestStart);
		transitionOutMs = Math.max(transitionOutMs, trims.trimStartMs);
		let transitionInMs = trims.trimStartMs;
		let firstBeatIn = Infinity;
		for (const beat of beats) if (beat >= trims.trimStartMs && beat < firstBeatIn) firstBeatIn = beat;
		if (firstBeatIn - trims.trimStartMs <= ENTRY_BEAT_WINDOW_MS) transitionInMs = firstBeatIn;
		return {
			transitionInMs,
			transitionOutMs
		};
	}
	function trimsOf(analysis) {
		return {
			trimStartMs: analysis?.trimStartMs ?? 0,
			trimEndMs: analysis?.trimEndMs ?? 0
		};
	}
	/**
	* Decide fade length and timing for an outgoing/incoming pair.
	*
	* Policy: when both tracks carry trusted rhythm data, BPM-compatible
	* high-energy pairs get a long beat-snapped blend (9–12s, scaled by energy),
	* compatible low-energy pairs keep the base fade, and BPM-incompatible pairs
	* get a short fade (2.5–3.5s) so the tempo clash stays brief. When either
	* side's confidence is below `confidenceMin` the plan reproduces Automix
	* Lite: base fade ending at the trimmed end, deck parked at the trim start.
	*/
	function planTransition(outgoing, incoming, durationAMs, baseFadeMs, confidenceMin = PRO_CONFIDENCE_MIN) {
		const trimsA = trimsOf(outgoing);
		const trimsB = trimsOf(incoming);
		const trimmedEndAMs = Math.max(0, durationAMs - trimsA.trimEndMs);
		const litePlan = {
			fadeMs: baseFadeMs,
			fadeStartMsInA: Math.max(trimmedEndAMs - baseFadeMs, 0),
			deckStartMsInB: trimsB.trimStartMs,
			usedPro: false
		};
		const confidenceA = outgoing?.confidence ?? 0;
		const confidenceB = incoming?.confidence ?? 0;
		if (!outgoing || !incoming || confidenceA < confidenceMin || confidenceB < confidenceMin) return litePlan;
		const compatibility = bpmCompatibility(outgoing.bpm, incoming.bpm);
		const meanEnergy = ((outgoing.energy ?? .5) + (incoming.energy ?? .5)) / 2;
		let fadeMs;
		if (compatibility >= COMPAT_BLEND_MIN) if (meanEnergy >= HIGH_ENERGY_MIN) {
			const lift = Math.min(1, (meanEnergy - HIGH_ENERGY_MIN) / (1 - HIGH_ENERGY_MIN));
			fadeMs = Math.round(LONG_BLEND_MIN_MS + (FADE_MAX_MS - LONG_BLEND_MIN_MS) * lift);
		} else fadeMs = baseFadeMs;
		else fadeMs = Math.round(FADE_MIN_MS + 1e3 * (compatibility / COMPAT_BLEND_MIN));
		const availableMs = trimmedEndAMs - trimsA.trimStartMs;
		const maxFadeMs = Math.max(FADE_MIN_MS, Math.min(FADE_MAX_MS, availableMs - FADE_END_SAFETY_MS));
		fadeMs = Math.min(maxFadeMs, Math.max(FADE_MIN_MS, fadeMs));
		const pointsA = computeTransitionPoints(outgoing, trimsA, durationAMs, fadeMs);
		const deckStartMsInB = incoming.transitionInMs ?? trimsB.trimStartMs;
		return {
			fadeMs,
			fadeStartMsInA: pointsA.transitionOutMs,
			deckStartMsInB,
			usedPro: true
		};
	}
	//#endregion
	//#region src/audio-player/automix/trackAnalysis.ts
	/**
	* Automix Pro track analysis orchestrator.
	*
	* One download + decode per track feeds everything: silence trims (same scan
	* as Automix Lite), an energy estimate, and beat/BPM extraction in the
	* essentia worker. Results are cached in memory for the page (same
	* pending/settled/serializer pattern as the Lite analysis) and persisted to
	* IndexedDB when the rhythm data is trustworthy.
	*
	* Rhythm is only extracted from two windows — the first ~60s after the trim
	* start and the last ~120s before the trimmed end — because transitions only
	* need beats near the edges, and a full-length track would be a multi-hundred
	* megabyte Float32 transfer on long files.
	*/
	/** Target sample rate for rhythm extraction; RhythmExtractor2013 assumes it. */
	var RHYTHM_SAMPLE_RATE = 44100;
	var HEAD_SEGMENT_MS = 6e4;
	var TAIL_SEGMENT_MS = 12e4;
	/** Tracks whose trimmed length fits in this analyze as a single segment. */
	var SINGLE_SEGMENT_MAX_MS = 18e4;
	/** RMS window for the energy estimate, matching the silence scan. */
	var ENERGY_WINDOW_MS = 50;
	/** Window RMS treated as "full" energy when mapping to 0..1. */
	var ENERGY_FULL_SCALE_RMS = .35;
	/** Penalty applied when head and tail disagree about the tempo. */
	var SEGMENT_DISAGREEMENT_PENALTY = .7;
	/** Fade length used to bake default transition points into the analysis. */
	var DEFAULT_FADE_MS = 5500;
	var rhythmFn = analyzeRhythm;
	var decodeFn = fetchAndDecodeTrack;
	var persist = true;
	var pending = /* @__PURE__ */ new Map();
	var settled = /* @__PURE__ */ new Map();
	var lastJob = Promise.resolve();
	/**
	* Downmix a region of the decoded buffer to mono and linearly resample it to
	* 44.1kHz. Plain JS instead of OfflineAudioContext rendering so the result is
	* deterministic and testable; linear interpolation is plenty for beat
	* tracking.
	*/
	function extractMonoSegment(buffer, startMs, endMs) {
		const sourceRate = buffer.sampleRate;
		const start = Math.max(0, Math.floor(startMs / 1e3 * sourceRate));
		const end = Math.min(buffer.length, Math.ceil(endMs / 1e3 * sourceRate));
		if (end - start < sourceRate) return null;
		const channels = [];
		for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
		if (channels.length === 0) return null;
		const ratio = sourceRate / RHYTHM_SAMPLE_RATE;
		const outLength = Math.floor((end - start) / ratio);
		const out = new Float32Array(outLength);
		for (let i = 0; i < outLength; i++) {
			const sourcePos = start + i * ratio;
			const i0 = Math.min(end - 1, Math.floor(sourcePos));
			const i1 = Math.min(end - 1, i0 + 1);
			const frac = sourcePos - i0;
			let sum = 0;
			for (const data of channels) sum += data[i0] + (data[i1] - data[i0]) * frac;
			out[i] = sum / channels.length;
		}
		return out;
	}
	/** Mean windowed RMS over the trimmed region, mapped to 0..1. */
	function computeEnergy(buffer, trims) {
		const win = Math.max(1, Math.round(ENERGY_WINDOW_MS / 1e3 * buffer.sampleRate));
		const start = Math.floor(trims.trimStartMs / 1e3 * buffer.sampleRate);
		const end = buffer.length - Math.floor(trims.trimEndMs / 1e3 * buffer.sampleRate);
		const channels = [];
		for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) channels.push(buffer.getChannelData(c));
		if (channels.length === 0 || end - start < win) return 0;
		let total = 0;
		let windows = 0;
		for (let pos = start; pos + win <= end; pos += win) {
			let loudest = 0;
			for (const data of channels) {
				let sum = 0;
				for (let i = pos; i < pos + win; i++) {
					const v = data[i];
					sum += v * v;
				}
				const rms = Math.sqrt(sum / win);
				if (rms > loudest) loudest = rms;
			}
			total += loudest;
			windows++;
		}
		if (windows === 0) return 0;
		return Math.min(1, total / windows / ENERGY_FULL_SCALE_RMS);
	}
	function mergeSegments(head, tail) {
		if (!head && !tail) return { confidence: 0 };
		if (!head || !tail) {
			const only = head ?? tail;
			return {
				bpm: only.bpm,
				beats: only.ticksMs,
				confidence: normalizeRhythmConfidence(only.confidenceRaw) * SEGMENT_DISAGREEMENT_PENALTY
			};
		}
		const beats = [...head.ticksMs, ...tail.ticksMs].sort((a, b) => a - b);
		const agreement = bpmCompatibility(head.bpm, tail.bpm);
		const confidence = Math.min(normalizeRhythmConfidence(head.confidenceRaw), normalizeRhythmConfidence(tail.confidenceRaw));
		if (agreement >= .5) return {
			bpm: Math.abs(head.bpm - tail.bpm) / tail.bpm <= .08 ? (head.bpm + tail.bpm) / 2 : tail.bpm,
			beats,
			confidence
		};
		return {
			bpm: tail.bpm,
			beats,
			confidence: confidence * SEGMENT_DISAGREEMENT_PENALTY
		};
	}
	async function analyze(key, url) {
		if (persist) {
			const stored = await readStoredAnalysis(key);
			if (stored) {
				seedTrackTrims(key, {
					trimStartMs: stored.trimStartMs ?? 0,
					trimEndMs: stored.trimEndMs ?? 0
				});
				return stored;
			}
		}
		const buffer = await decodeFn(url);
		if (!buffer) return null;
		const trims = scanSilenceEdges(buffer);
		seedTrackTrims(key, trims);
		const energy = computeEnergy(buffer, trims);
		const durationMs = buffer.duration * 1e3;
		const trimmedEndMs = durationMs - trims.trimEndMs;
		const trimmedLengthMs = trimmedEndMs - trims.trimStartMs;
		let rhythm;
		if (trimmedLengthMs <= SINGLE_SEGMENT_MAX_MS) {
			const samples = extractMonoSegment(buffer, trims.trimStartMs, trimmedEndMs);
			const result = samples ? await rhythmFn(samples, RHYTHM_SAMPLE_RATE, trims.trimStartMs) : null;
			rhythm = result ? {
				bpm: result.bpm,
				beats: result.ticksMs,
				confidence: normalizeRhythmConfidence(result.confidenceRaw)
			} : { confidence: 0 };
		} else {
			const headEndMs = trims.trimStartMs + HEAD_SEGMENT_MS;
			const tailStartMs = trimmedEndMs - TAIL_SEGMENT_MS;
			const headSamples = extractMonoSegment(buffer, trims.trimStartMs, headEndMs);
			const tailSamples = extractMonoSegment(buffer, tailStartMs, trimmedEndMs);
			const [head, tail] = await Promise.all([headSamples ? rhythmFn(headSamples, RHYTHM_SAMPLE_RATE, trims.trimStartMs) : null, tailSamples ? rhythmFn(tailSamples, RHYTHM_SAMPLE_RATE, tailStartMs) : null]);
			rhythm = mergeSegments(head, tail);
		}
		const analysis = {
			trimStartMs: trims.trimStartMs,
			trimEndMs: trims.trimEndMs,
			energy,
			confidence: rhythm.confidence
		};
		if (rhythm.bpm !== void 0 && rhythm.confidence > 0) {
			analysis.bpm = rhythm.bpm;
			analysis.beats = rhythm.beats;
			const points = computeTransitionPoints(analysis, trims, durationMs, DEFAULT_FADE_MS);
			analysis.transitionInMs = points.transitionInMs;
			analysis.transitionOutMs = points.transitionOutMs;
		} else {
			analysis.transitionInMs = trims.trimStartMs;
			analysis.transitionOutMs = Math.max(trims.trimStartMs, trimmedEndMs - DEFAULT_FADE_MS);
		}
		if (persist && rhythm.confidence > 0) writeStoredAnalysis(key, analysis);
		return analysis;
	}
	/**
	* Kick off (or join) Automix Pro analysis for a track. Results are cached for
	* the lifetime of the page and persisted to IndexedDB when rhythm extraction
	* succeeded; analyses run one at a time. Resolves to `null` when analysis is
	* entirely unavailable — callers fall back to Automix Lite behavior.
	*/
	function ensureProTrackAnalysis(track) {
		const key = trackKey(track);
		const url = getPrimaryTrackSource(track);
		if (!key || !url) return Promise.resolve(null);
		const existing = pending.get(key);
		if (existing) return existing;
		const job = lastJob.catch(() => {}).then(() => analyze(key, url)).then((analysis) => {
			settled.set(key, analysis);
			return analysis;
		}, () => {
			settled.set(key, null);
			return null;
		});
		lastJob = job;
		pending.set(key, job);
		return job;
	}
	/**
	* Synchronous read of a finished Pro analysis. Returns `null` while analysis
	* is pending, failed, or was never requested.
	*/
	function getTrackAnalysis(track) {
		if (!track) return null;
		return settled.get(trackKey(track)) ?? null;
	}
	//#endregion
	//#region node_modules/zod/v4/core/core.js
	var _a$1;
	function $constructor(name, initializer, params) {
		function init(inst, def) {
			if (!inst._zod) Object.defineProperty(inst, "_zod", {
				value: {
					def,
					constr: _,
					traits: /* @__PURE__ */ new Set()
				},
				enumerable: false
			});
			if (inst._zod.traits.has(name)) return;
			inst._zod.traits.add(name);
			initializer(inst, def);
			const proto = _.prototype;
			const keys = Object.keys(proto);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				if (!(k in inst)) inst[k] = proto[k].bind(inst);
			}
		}
		const Parent = params?.Parent ?? Object;
		class Definition extends Parent {}
		Object.defineProperty(Definition, "name", { value: name });
		function _(def) {
			var _a;
			const inst = params?.Parent ? new Definition() : this;
			init(inst, def);
			(_a = inst._zod).deferred ?? (_a.deferred = []);
			for (const fn of inst._zod.deferred) fn();
			return inst;
		}
		Object.defineProperty(_, "init", { value: init });
		Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
			if (params?.Parent && inst instanceof params.Parent) return true;
			return inst?._zod?.traits?.has(name);
		} });
		Object.defineProperty(_, "name", { value: name });
		return _;
	}
	var $ZodAsyncError = class extends Error {
		constructor() {
			super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
		}
	};
	var $ZodEncodeError = class extends Error {
		constructor(name) {
			super(`Encountered unidirectional transform during encode: ${name}`);
			this.name = "ZodEncodeError";
		}
	};
	(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
	var globalConfig = globalThis.__zod_globalConfig;
	function config(newConfig) {
		if (newConfig) Object.assign(globalConfig, newConfig);
		return globalConfig;
	}
	//#endregion
	//#region node_modules/zod/v4/core/util.js
	function getEnumValues(entries) {
		const numericValues = Object.values(entries).filter((v) => typeof v === "number");
		return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
	}
	function jsonStringifyReplacer(_, value) {
		if (typeof value === "bigint") return value.toString();
		return value;
	}
	function cached(getter) {
		return { get value() {
			{
				const value = getter();
				Object.defineProperty(this, "value", { value });
				return value;
			}
			throw new Error("cached value already set");
		} };
	}
	function nullish(input) {
		return input === null || input === void 0;
	}
	function cleanRegex(source) {
		const start = source.startsWith("^") ? 1 : 0;
		const end = source.endsWith("$") ? source.length - 1 : source.length;
		return source.slice(start, end);
	}
	function floatSafeRemainder(val, step) {
		const ratio = val / step;
		const roundedRatio = Math.round(ratio);
		const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
		if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
		return ratio - roundedRatio;
	}
	var EVALUATING = /* @__PURE__*/ Symbol("evaluating");
	function defineLazy(object, key, getter) {
		let value = void 0;
		Object.defineProperty(object, key, {
			get() {
				if (value === EVALUATING) return;
				if (value === void 0) {
					value = EVALUATING;
					value = getter();
				}
				return value;
			},
			set(v) {
				Object.defineProperty(object, key, { value: v });
			},
			configurable: true
		});
	}
	function assignProp(target, prop, value) {
		Object.defineProperty(target, prop, {
			value,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	function mergeDefs(...defs) {
		const mergedDescriptors = {};
		for (const def of defs) Object.assign(mergedDescriptors, Object.getOwnPropertyDescriptors(def));
		return Object.defineProperties({}, mergedDescriptors);
	}
	function esc(str) {
		return JSON.stringify(str);
	}
	function slugify(input) {
		return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
	}
	var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
	function isObject(data) {
		return typeof data === "object" && data !== null && !Array.isArray(data);
	}
	var allowsEval = /* @__PURE__*/ cached(() => {
		if (globalConfig.jitless) return false;
		if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
		try {
			new Function("");
			return true;
		} catch (_) {
			return false;
		}
	});
	function isPlainObject(o) {
		if (isObject(o) === false) return false;
		const ctor = o.constructor;
		if (ctor === void 0) return true;
		if (typeof ctor !== "function") return true;
		const prot = ctor.prototype;
		if (isObject(prot) === false) return false;
		if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
		return true;
	}
	function shallowClone(o) {
		if (isPlainObject(o)) return { ...o };
		if (Array.isArray(o)) return [...o];
		if (o instanceof Map) return new Map(o);
		if (o instanceof Set) return new Set(o);
		return o;
	}
	var propertyKeyTypes = /* @__PURE__*/ new Set([
		"string",
		"number",
		"symbol"
	]);
	function escapeRegex(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	function clone(inst, def, params) {
		const cl = new inst._zod.constr(def ?? inst._zod.def);
		if (!def || params?.parent) cl._zod.parent = inst;
		return cl;
	}
	function normalizeParams(_params) {
		const params = _params;
		if (!params) return {};
		if (typeof params === "string") return { error: () => params };
		if (params?.message !== void 0) {
			if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
			params.error = params.message;
		}
		delete params.message;
		if (typeof params.error === "string") return {
			...params,
			error: () => params.error
		};
		return params;
	}
	function optionalKeys(shape) {
		return Object.keys(shape).filter((k) => {
			return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
		});
	}
	var NUMBER_FORMAT_RANGES = {
		safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
		int32: [-2147483648, 2147483647],
		uint32: [0, 4294967295],
		float32: [-34028234663852886e22, 34028234663852886e22],
		float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
	};
	function pick(schema, mask) {
		const currDef = schema._zod.def;
		const checks = currDef.checks;
		if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
		return clone(schema, mergeDefs(schema._zod.def, {
			get shape() {
				const newShape = {};
				for (const key in mask) {
					if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					newShape[key] = currDef.shape[key];
				}
				assignProp(this, "shape", newShape);
				return newShape;
			},
			checks: []
		}));
	}
	function omit(schema, mask) {
		const currDef = schema._zod.def;
		const checks = currDef.checks;
		if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
		return clone(schema, mergeDefs(schema._zod.def, {
			get shape() {
				const newShape = { ...schema._zod.def.shape };
				for (const key in mask) {
					if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					delete newShape[key];
				}
				assignProp(this, "shape", newShape);
				return newShape;
			},
			checks: []
		}));
	}
	function extend(schema, shape) {
		if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
		const checks = schema._zod.def.checks;
		if (checks && checks.length > 0) {
			const existingShape = schema._zod.def.shape;
			for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
		}
		return clone(schema, mergeDefs(schema._zod.def, { get shape() {
			const _shape = {
				...schema._zod.def.shape,
				...shape
			};
			assignProp(this, "shape", _shape);
			return _shape;
		} }));
	}
	function safeExtend(schema, shape) {
		if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
		return clone(schema, mergeDefs(schema._zod.def, { get shape() {
			const _shape = {
				...schema._zod.def.shape,
				...shape
			};
			assignProp(this, "shape", _shape);
			return _shape;
		} }));
	}
	function merge(a, b) {
		if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
		return clone(a, mergeDefs(a._zod.def, {
			get shape() {
				const _shape = {
					...a._zod.def.shape,
					...b._zod.def.shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			},
			get catchall() {
				return b._zod.def.catchall;
			},
			checks: b._zod.def.checks ?? []
		}));
	}
	function partial(Class, schema, mask) {
		const checks = schema._zod.def.checks;
		if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
		return clone(schema, mergeDefs(schema._zod.def, {
			get shape() {
				const oldShape = schema._zod.def.shape;
				const shape = { ...oldShape };
				if (mask) for (const key in mask) {
					if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					shape[key] = Class ? new Class({
						type: "optional",
						innerType: oldShape[key]
					}) : oldShape[key];
				}
				else for (const key in oldShape) shape[key] = Class ? new Class({
					type: "optional",
					innerType: oldShape[key]
				}) : oldShape[key];
				assignProp(this, "shape", shape);
				return shape;
			},
			checks: []
		}));
	}
	function required(Class, schema, mask) {
		return clone(schema, mergeDefs(schema._zod.def, { get shape() {
			const oldShape = schema._zod.def.shape;
			const shape = { ...oldShape };
			if (mask) for (const key in mask) {
				if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				shape[key] = new Class({
					type: "nonoptional",
					innerType: oldShape[key]
				});
			}
			else for (const key in oldShape) shape[key] = new Class({
				type: "nonoptional",
				innerType: oldShape[key]
			});
			assignProp(this, "shape", shape);
			return shape;
		} }));
	}
	function aborted(x, startIndex = 0) {
		if (x.aborted === true) return true;
		for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
		return false;
	}
	function explicitlyAborted(x, startIndex = 0) {
		if (x.aborted === true) return true;
		for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
		return false;
	}
	function prefixIssues(path, issues) {
		return issues.map((iss) => {
			var _a;
			(_a = iss).path ?? (_a.path = []);
			iss.path.unshift(path);
			return iss;
		});
	}
	function unwrapMessage(message) {
		return typeof message === "string" ? message : message?.message;
	}
	function finalizeIssue(iss, ctx, config) {
		const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
		const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
		rest.path ?? (rest.path = []);
		rest.message = message;
		if (ctx?.reportInput) rest.input = _input;
		return rest;
	}
	function getLengthableOrigin(input) {
		if (Array.isArray(input)) return "array";
		if (typeof input === "string") return "string";
		return "unknown";
	}
	function issue(...args) {
		const [iss, input, inst] = args;
		if (typeof iss === "string") return {
			message: iss,
			code: "custom",
			input,
			inst
		};
		return { ...iss };
	}
	//#endregion
	//#region node_modules/zod/v4/core/errors.js
	var initializer$1 = (inst, def) => {
		inst.name = "$ZodError";
		Object.defineProperty(inst, "_zod", {
			value: inst._zod,
			enumerable: false
		});
		Object.defineProperty(inst, "issues", {
			value: def,
			enumerable: false
		});
		inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
		Object.defineProperty(inst, "toString", {
			value: () => inst.message,
			enumerable: false
		});
	};
	var $ZodError = $constructor("$ZodError", initializer$1);
	var $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
	function flattenError(error, mapper = (issue) => issue.message) {
		const fieldErrors = {};
		const formErrors = [];
		for (const sub of error.issues) if (sub.path.length > 0) {
			fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
			fieldErrors[sub.path[0]].push(mapper(sub));
		} else formErrors.push(mapper(sub));
		return {
			formErrors,
			fieldErrors
		};
	}
	function formatError(error, mapper = (issue) => issue.message) {
		const fieldErrors = { _errors: [] };
		const processError = (error, path = []) => {
			for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
			else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
			else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
			else {
				const fullpath = [...path, ...issue.path];
				if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
				else {
					let curr = fieldErrors;
					let i = 0;
					while (i < fullpath.length) {
						const el = fullpath[i];
						if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
						else {
							curr[el] = curr[el] || { _errors: [] };
							curr[el]._errors.push(mapper(issue));
						}
						curr = curr[el];
						i++;
					}
				}
			}
		};
		processError(error);
		return fieldErrors;
	}
	//#endregion
	//#region node_modules/zod/v4/core/parse.js
	var _parse = (_Err) => (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		if (result.issues.length) {
			const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, _params?.callee);
			throw e;
		}
		return result.value;
	};
	var _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		if (result.issues.length) {
			const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, params?.callee);
			throw e;
		}
		return result.value;
	};
	var _safeParse = (_Err) => (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		return result.issues.length ? {
			success: false,
			error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
		} : {
			success: true,
			data: result.value
		};
	};
	var safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
	var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		return result.issues.length ? {
			success: false,
			error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
		} : {
			success: true,
			data: result.value
		};
	};
	var safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
	var _encode = (_Err) => (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return _parse(_Err)(schema, value, ctx);
	};
	var _decode = (_Err) => (schema, value, _ctx) => {
		return _parse(_Err)(schema, value, _ctx);
	};
	var _encodeAsync = (_Err) => async (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return _parseAsync(_Err)(schema, value, ctx);
	};
	var _decodeAsync = (_Err) => async (schema, value, _ctx) => {
		return _parseAsync(_Err)(schema, value, _ctx);
	};
	var _safeEncode = (_Err) => (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return _safeParse(_Err)(schema, value, ctx);
	};
	var _safeDecode = (_Err) => (schema, value, _ctx) => {
		return _safeParse(_Err)(schema, value, _ctx);
	};
	var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return _safeParseAsync(_Err)(schema, value, ctx);
	};
	var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
		return _safeParseAsync(_Err)(schema, value, _ctx);
	};
	//#endregion
	//#region node_modules/zod/v4/core/regexes.js
	/**
	* @deprecated CUID v1 is deprecated by its authors due to information leakage
	* (timestamps embedded in the id). Use {@link cuid2} instead.
	* See https://github.com/paralleldrive/cuid.
	*/
	var cuid = /^[cC][0-9a-z]{6,}$/;
	var cuid2 = /^[0-9a-z]+$/;
	var ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
	var xid = /^[0-9a-vA-V]{20}$/;
	var ksuid = /^[A-Za-z0-9]{27}$/;
	var nanoid = /^[a-zA-Z0-9_-]{21}$/;
	/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
	var duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
	/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
	var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
	/** Returns a regex for validating an RFC 9562/4122 UUID.
	*
	* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
	var uuid = (version) => {
		if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
		return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
	};
	/** Practical email validation */
	var email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
	var _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
	function emoji() {
		return new RegExp(_emoji$1, "u");
	}
	var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
	var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
	var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
	var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
	var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
	var base64url = /^[A-Za-z0-9_-]*$/;
	var httpProtocol = /^https?$/;
	var e164 = /^\+[1-9]\d{6,14}$/;
	var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
	var date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
	function timeSource(args) {
		const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
		return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
	}
	function time$1(args) {
		return new RegExp(`^${timeSource(args)}$`);
	}
	function datetime$1(args) {
		const time = timeSource({ precision: args.precision });
		const opts = ["Z"];
		if (args.local) opts.push("");
		if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
		const timeRegex = `${time}(?:${opts.join("|")})`;
		return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
	}
	var string$1 = (params) => {
		const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
		return new RegExp(`^${regex}$`);
	};
	var integer = /^-?\d+$/;
	var number$1 = /^-?\d+(?:\.\d+)?$/;
	var boolean$1 = /^(?:true|false)$/i;
	var lowercase = /^[^A-Z]*$/;
	var uppercase = /^[^a-z]*$/;
	//#endregion
	//#region node_modules/zod/v4/core/checks.js
	var $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
		var _a;
		inst._zod ?? (inst._zod = {});
		inst._zod.def = def;
		(_a = inst._zod).onattach ?? (_a.onattach = []);
	});
	var numericOriginMap = {
		number: "number",
		bigint: "bigint",
		object: "date"
	};
	var $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
		$ZodCheck.init(inst, def);
		const origin = numericOriginMap[typeof def.value];
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
			if (def.value < curr) if (def.inclusive) bag.maximum = def.value;
			else bag.exclusiveMaximum = def.value;
		});
		inst._zod.check = (payload) => {
			if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
			payload.issues.push({
				origin,
				code: "too_big",
				maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
				input: payload.value,
				inclusive: def.inclusive,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
		$ZodCheck.init(inst, def);
		const origin = numericOriginMap[typeof def.value];
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
			if (def.value > curr) if (def.inclusive) bag.minimum = def.value;
			else bag.exclusiveMinimum = def.value;
		});
		inst._zod.check = (payload) => {
			if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
			payload.issues.push({
				origin,
				code: "too_small",
				minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
				input: payload.value,
				inclusive: def.inclusive,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
		$ZodCheck.init(inst, def);
		inst._zod.onattach.push((inst) => {
			var _a;
			(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
		});
		inst._zod.check = (payload) => {
			if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
			if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
			payload.issues.push({
				origin: typeof payload.value,
				code: "not_multiple_of",
				divisor: def.value,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
		$ZodCheck.init(inst, def);
		def.format = def.format || "float64";
		const isInt = def.format?.includes("int");
		const origin = isInt ? "int" : "number";
		const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			bag.format = def.format;
			bag.minimum = minimum;
			bag.maximum = maximum;
			if (isInt) bag.pattern = integer;
		});
		inst._zod.check = (payload) => {
			const input = payload.value;
			if (isInt) {
				if (!Number.isInteger(input)) {
					payload.issues.push({
						expected: origin,
						format: def.format,
						code: "invalid_type",
						continue: false,
						input,
						inst
					});
					return;
				}
				if (!Number.isSafeInteger(input)) {
					if (input > 0) payload.issues.push({
						input,
						code: "too_big",
						maximum: Number.MAX_SAFE_INTEGER,
						note: "Integers must be within the safe integer range.",
						inst,
						origin,
						inclusive: true,
						continue: !def.abort
					});
					else payload.issues.push({
						input,
						code: "too_small",
						minimum: Number.MIN_SAFE_INTEGER,
						note: "Integers must be within the safe integer range.",
						inst,
						origin,
						inclusive: true,
						continue: !def.abort
					});
					return;
				}
			}
			if (input < minimum) payload.issues.push({
				origin: "number",
				input,
				code: "too_small",
				minimum,
				inclusive: true,
				inst,
				continue: !def.abort
			});
			if (input > maximum) payload.issues.push({
				origin: "number",
				input,
				code: "too_big",
				maximum,
				inclusive: true,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
		var _a;
		$ZodCheck.init(inst, def);
		(_a = inst._zod.def).when ?? (_a.when = (payload) => {
			const val = payload.value;
			return !nullish(val) && val.length !== void 0;
		});
		inst._zod.onattach.push((inst) => {
			const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
			if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
		});
		inst._zod.check = (payload) => {
			const input = payload.value;
			if (input.length <= def.maximum) return;
			const origin = getLengthableOrigin(input);
			payload.issues.push({
				origin,
				code: "too_big",
				maximum: def.maximum,
				inclusive: true,
				input,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
		var _a;
		$ZodCheck.init(inst, def);
		(_a = inst._zod.def).when ?? (_a.when = (payload) => {
			const val = payload.value;
			return !nullish(val) && val.length !== void 0;
		});
		inst._zod.onattach.push((inst) => {
			const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
			if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
		});
		inst._zod.check = (payload) => {
			const input = payload.value;
			if (input.length >= def.minimum) return;
			const origin = getLengthableOrigin(input);
			payload.issues.push({
				origin,
				code: "too_small",
				minimum: def.minimum,
				inclusive: true,
				input,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
		var _a;
		$ZodCheck.init(inst, def);
		(_a = inst._zod.def).when ?? (_a.when = (payload) => {
			const val = payload.value;
			return !nullish(val) && val.length !== void 0;
		});
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			bag.minimum = def.length;
			bag.maximum = def.length;
			bag.length = def.length;
		});
		inst._zod.check = (payload) => {
			const input = payload.value;
			const length = input.length;
			if (length === def.length) return;
			const origin = getLengthableOrigin(input);
			const tooBig = length > def.length;
			payload.issues.push({
				origin,
				...tooBig ? {
					code: "too_big",
					maximum: def.length
				} : {
					code: "too_small",
					minimum: def.length
				},
				inclusive: true,
				exact: true,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
		var _a, _b;
		$ZodCheck.init(inst, def);
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			bag.format = def.format;
			if (def.pattern) {
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(def.pattern);
			}
		});
		if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
			def.pattern.lastIndex = 0;
			if (def.pattern.test(payload.value)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: def.format,
				input: payload.value,
				...def.pattern ? { pattern: def.pattern.toString() } : {},
				inst,
				continue: !def.abort
			});
		});
		else (_b = inst._zod).check ?? (_b.check = () => {});
	});
	var $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
		$ZodCheckStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			def.pattern.lastIndex = 0;
			if (def.pattern.test(payload.value)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "regex",
				input: payload.value,
				pattern: def.pattern.toString(),
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
		def.pattern ?? (def.pattern = lowercase);
		$ZodCheckStringFormat.init(inst, def);
	});
	var $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
		def.pattern ?? (def.pattern = uppercase);
		$ZodCheckStringFormat.init(inst, def);
	});
	var $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
		$ZodCheck.init(inst, def);
		const escapedRegex = escapeRegex(def.includes);
		const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
		def.pattern = pattern;
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(pattern);
		});
		inst._zod.check = (payload) => {
			if (payload.value.includes(def.includes, def.position)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "includes",
				includes: def.includes,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
		$ZodCheck.init(inst, def);
		const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
		def.pattern ?? (def.pattern = pattern);
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(pattern);
		});
		inst._zod.check = (payload) => {
			if (payload.value.startsWith(def.prefix)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "starts_with",
				prefix: def.prefix,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
		$ZodCheck.init(inst, def);
		const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
		def.pattern ?? (def.pattern = pattern);
		inst._zod.onattach.push((inst) => {
			const bag = inst._zod.bag;
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(pattern);
		});
		inst._zod.check = (payload) => {
			if (payload.value.endsWith(def.suffix)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "ends_with",
				suffix: def.suffix,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
		$ZodCheck.init(inst, def);
		inst._zod.check = (payload) => {
			payload.value = def.tx(payload.value);
		};
	});
	//#endregion
	//#region node_modules/zod/v4/core/doc.js
	var Doc = class {
		constructor(args = []) {
			this.content = [];
			this.indent = 0;
			if (this) this.args = args;
		}
		indented(fn) {
			this.indent += 1;
			fn(this);
			this.indent -= 1;
		}
		write(arg) {
			if (typeof arg === "function") {
				arg(this, { execution: "sync" });
				arg(this, { execution: "async" });
				return;
			}
			const lines = arg.split("\n").filter((x) => x);
			const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
			const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
			for (const line of dedented) this.content.push(line);
		}
		compile() {
			const F = Function;
			const args = this?.args;
			const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
			return new F(...args, lines.join("\n"));
		}
	};
	//#endregion
	//#region node_modules/zod/v4/core/versions.js
	var version = {
		major: 4,
		minor: 4,
		patch: 3
	};
	//#endregion
	//#region node_modules/zod/v4/core/schemas.js
	var $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
		var _a;
		inst ?? (inst = {});
		inst._zod.def = def;
		inst._zod.bag = inst._zod.bag || {};
		inst._zod.version = version;
		const checks = [...inst._zod.def.checks ?? []];
		if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
		for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
		if (checks.length === 0) {
			(_a = inst._zod).deferred ?? (_a.deferred = []);
			inst._zod.deferred?.push(() => {
				inst._zod.run = inst._zod.parse;
			});
		} else {
			const runChecks = (payload, checks, ctx) => {
				let isAborted = aborted(payload);
				let asyncResult;
				for (const ch of checks) {
					if (ch._zod.def.when) {
						if (explicitlyAborted(payload)) continue;
						if (!ch._zod.def.when(payload)) continue;
					} else if (isAborted) continue;
					const currLen = payload.issues.length;
					const _ = ch._zod.check(payload);
					if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
					if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
						await _;
						if (payload.issues.length === currLen) return;
						if (!isAborted) isAborted = aborted(payload, currLen);
					});
					else {
						if (payload.issues.length === currLen) continue;
						if (!isAborted) isAborted = aborted(payload, currLen);
					}
				}
				if (asyncResult) return asyncResult.then(() => {
					return payload;
				});
				return payload;
			};
			const handleCanaryResult = (canary, payload, ctx) => {
				if (aborted(canary)) {
					canary.aborted = true;
					return canary;
				}
				const checkResult = runChecks(payload, checks, ctx);
				if (checkResult instanceof Promise) {
					if (ctx.async === false) throw new $ZodAsyncError();
					return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
				}
				return inst._zod.parse(checkResult, ctx);
			};
			inst._zod.run = (payload, ctx) => {
				if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
				if (ctx.direction === "backward") {
					const canary = inst._zod.parse({
						value: payload.value,
						issues: []
					}, {
						...ctx,
						skipChecks: true
					});
					if (canary instanceof Promise) return canary.then((canary) => {
						return handleCanaryResult(canary, payload, ctx);
					});
					return handleCanaryResult(canary, payload, ctx);
				}
				const result = inst._zod.parse(payload, ctx);
				if (result instanceof Promise) {
					if (ctx.async === false) throw new $ZodAsyncError();
					return result.then((result) => runChecks(result, checks, ctx));
				}
				return runChecks(result, checks, ctx);
			};
		}
		defineLazy(inst, "~standard", () => ({
			validate: (value) => {
				try {
					const r = safeParse$1(inst, value);
					return r.success ? { value: r.data } : { issues: r.error?.issues };
				} catch (_) {
					return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
				}
			},
			vendor: "zod",
			version: 1
		}));
	});
	var $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
		inst._zod.parse = (payload, _) => {
			if (def.coerce) try {
				payload.value = String(payload.value);
			} catch (_) {}
			if (typeof payload.value === "string") return payload;
			payload.issues.push({
				expected: "string",
				code: "invalid_type",
				input: payload.value,
				inst
			});
			return payload;
		};
	});
	var $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
		$ZodCheckStringFormat.init(inst, def);
		$ZodString.init(inst, def);
	});
	var $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
		def.pattern ?? (def.pattern = guid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
		if (def.version) {
			const v = {
				v1: 1,
				v2: 2,
				v3: 3,
				v4: 4,
				v5: 5,
				v6: 6,
				v7: 7,
				v8: 8
			}[def.version];
			if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
			def.pattern ?? (def.pattern = uuid(v));
		} else def.pattern ?? (def.pattern = uuid());
		$ZodStringFormat.init(inst, def);
	});
	var $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
		def.pattern ?? (def.pattern = email);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			try {
				const trimmed = payload.value.trim();
				if (!def.normalize && def.protocol?.source === httpProtocol.source) {
					if (!/^https?:\/\//i.test(trimmed)) {
						payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid URL format",
							input: payload.value,
							inst,
							continue: !def.abort
						});
						return;
					}
				}
				const url = new URL(trimmed);
				if (def.hostname) {
					def.hostname.lastIndex = 0;
					if (!def.hostname.test(url.hostname)) payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid hostname",
						pattern: def.hostname.source,
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
				if (def.protocol) {
					def.protocol.lastIndex = 0;
					if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid protocol",
						pattern: def.protocol.source,
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
				if (def.normalize) payload.value = url.href;
				else payload.value = trimmed;
				return;
			} catch (_) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
		};
	});
	var $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
		def.pattern ?? (def.pattern = emoji());
		$ZodStringFormat.init(inst, def);
	});
	var $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
		def.pattern ?? (def.pattern = nanoid);
		$ZodStringFormat.init(inst, def);
	});
	/**
	* @deprecated CUID v1 is deprecated by its authors due to information leakage
	* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
	* See https://github.com/paralleldrive/cuid.
	*/
	var $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
		def.pattern ?? (def.pattern = cuid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
		def.pattern ?? (def.pattern = cuid2);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
		def.pattern ?? (def.pattern = ulid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
		def.pattern ?? (def.pattern = xid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
		def.pattern ?? (def.pattern = ksuid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
		def.pattern ?? (def.pattern = datetime$1(def));
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
		def.pattern ?? (def.pattern = date$1);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
		def.pattern ?? (def.pattern = time$1(def));
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
		def.pattern ?? (def.pattern = duration$1);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
		def.pattern ?? (def.pattern = ipv4);
		$ZodStringFormat.init(inst, def);
		inst._zod.bag.format = `ipv4`;
	});
	var $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
		def.pattern ?? (def.pattern = ipv6);
		$ZodStringFormat.init(inst, def);
		inst._zod.bag.format = `ipv6`;
		inst._zod.check = (payload) => {
			try {
				new URL(`http://[${payload.value}]`);
			} catch {
				payload.issues.push({
					code: "invalid_format",
					format: "ipv6",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
		};
	});
	var $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
		def.pattern ?? (def.pattern = cidrv4);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
		def.pattern ?? (def.pattern = cidrv6);
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			const parts = payload.value.split("/");
			try {
				if (parts.length !== 2) throw new Error();
				const [address, prefix] = parts;
				if (!prefix) throw new Error();
				const prefixNum = Number(prefix);
				if (`${prefixNum}` !== prefix) throw new Error();
				if (prefixNum < 0 || prefixNum > 128) throw new Error();
				new URL(`http://[${address}]`);
			} catch {
				payload.issues.push({
					code: "invalid_format",
					format: "cidrv6",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
		};
	});
	function isValidBase64(data) {
		if (data === "") return true;
		if (/\s/.test(data)) return false;
		if (data.length % 4 !== 0) return false;
		try {
			atob(data);
			return true;
		} catch {
			return false;
		}
	}
	var $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
		def.pattern ?? (def.pattern = base64);
		$ZodStringFormat.init(inst, def);
		inst._zod.bag.contentEncoding = "base64";
		inst._zod.check = (payload) => {
			if (isValidBase64(payload.value)) return;
			payload.issues.push({
				code: "invalid_format",
				format: "base64",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	function isValidBase64URL(data) {
		if (!base64url.test(data)) return false;
		const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
		return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
	}
	var $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
		def.pattern ?? (def.pattern = base64url);
		$ZodStringFormat.init(inst, def);
		inst._zod.bag.contentEncoding = "base64url";
		inst._zod.check = (payload) => {
			if (isValidBase64URL(payload.value)) return;
			payload.issues.push({
				code: "invalid_format",
				format: "base64url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
		def.pattern ?? (def.pattern = e164);
		$ZodStringFormat.init(inst, def);
	});
	function isValidJWT(token, algorithm = null) {
		try {
			const tokensParts = token.split(".");
			if (tokensParts.length !== 3) return false;
			const [header] = tokensParts;
			if (!header) return false;
			const parsedHeader = JSON.parse(atob(header));
			if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
			if (!parsedHeader.alg) return false;
			if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
			return true;
		} catch {
			return false;
		}
	}
	var $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			if (isValidJWT(payload.value, def.alg)) return;
			payload.issues.push({
				code: "invalid_format",
				format: "jwt",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
		inst._zod.parse = (payload, _ctx) => {
			if (def.coerce) try {
				payload.value = Number(payload.value);
			} catch (_) {}
			const input = payload.value;
			if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
			const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
			payload.issues.push({
				expected: "number",
				code: "invalid_type",
				input,
				inst,
				...received ? { received } : {}
			});
			return payload;
		};
	});
	var $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
		$ZodCheckNumberFormat.init(inst, def);
		$ZodNumber.init(inst, def);
	});
	var $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.pattern = boolean$1;
		inst._zod.parse = (payload, _ctx) => {
			if (def.coerce) try {
				payload.value = Boolean(payload.value);
			} catch (_) {}
			const input = payload.value;
			if (typeof input === "boolean") return payload;
			payload.issues.push({
				expected: "boolean",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		};
	});
	var $ZodAny = /*@__PURE__*/ $constructor("$ZodAny", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload) => payload;
	});
	var $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload) => payload;
	});
	var $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, _ctx) => {
			payload.issues.push({
				expected: "never",
				code: "invalid_type",
				input: payload.value,
				inst
			});
			return payload;
		};
	});
	function handleArrayResult(result, final, index) {
		if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
		final.value[index] = result.value;
	}
	var $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, ctx) => {
			const input = payload.value;
			if (!Array.isArray(input)) {
				payload.issues.push({
					expected: "array",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			payload.value = Array(input.length);
			const proms = [];
			for (let i = 0; i < input.length; i++) {
				const item = input[i];
				const result = def.element._zod.run({
					value: item,
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
				else handleArrayResult(result, payload, i);
			}
			if (proms.length) return Promise.all(proms).then(() => payload);
			return payload;
		};
	});
	function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
		const isPresent = key in input;
		if (result.issues.length) {
			if (isOptionalIn && isOptionalOut && !isPresent) return;
			final.issues.push(...prefixIssues(key, result.issues));
		}
		if (!isPresent && !isOptionalIn) {
			if (!result.issues.length) final.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: void 0,
				path: [key]
			});
			return;
		}
		if (result.value === void 0) {
			if (isPresent) final.value[key] = void 0;
		} else final.value[key] = result.value;
	}
	function normalizeDef(def) {
		const keys = Object.keys(def.shape);
		for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
		const okeys = optionalKeys(def.shape);
		return {
			...def,
			keys,
			keySet: new Set(keys),
			numKeys: keys.length,
			optionalKeys: new Set(okeys)
		};
	}
	function handleCatchall(proms, input, payload, ctx, def, inst) {
		const unrecognized = [];
		const keySet = def.keySet;
		const _catchall = def.catchall._zod;
		const t = _catchall.def.type;
		const isOptionalIn = _catchall.optin === "optional";
		const isOptionalOut = _catchall.optout === "optional";
		for (const key in input) {
			if (key === "__proto__") continue;
			if (keySet.has(key)) continue;
			if (t === "never") {
				unrecognized.push(key);
				continue;
			}
			const r = _catchall.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
			else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
		}
		if (unrecognized.length) payload.issues.push({
			code: "unrecognized_keys",
			keys: unrecognized,
			input,
			inst
		});
		if (!proms.length) return payload;
		return Promise.all(proms).then(() => {
			return payload;
		});
	}
	var $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
		$ZodType.init(inst, def);
		if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
			const sh = def.shape;
			Object.defineProperty(def, "shape", { get: () => {
				const newSh = { ...sh };
				Object.defineProperty(def, "shape", { value: newSh });
				return newSh;
			} });
		}
		const _normalized = cached(() => normalizeDef(def));
		defineLazy(inst._zod, "propValues", () => {
			const shape = def.shape;
			const propValues = {};
			for (const key in shape) {
				const field = shape[key]._zod;
				if (field.values) {
					propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
					for (const v of field.values) propValues[key].add(v);
				}
			}
			return propValues;
		});
		const isObject$1 = isObject;
		const catchall = def.catchall;
		let value;
		inst._zod.parse = (payload, ctx) => {
			value ?? (value = _normalized.value);
			const input = payload.value;
			if (!isObject$1(input)) {
				payload.issues.push({
					expected: "object",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			payload.value = {};
			const proms = [];
			const shape = value.shape;
			for (const key of value.keys) {
				const el = shape[key];
				const isOptionalIn = el._zod.optin === "optional";
				const isOptionalOut = el._zod.optout === "optional";
				const r = el._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
				else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
			}
			if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
			return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
		};
	});
	var $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
		$ZodObject.init(inst, def);
		const superParse = inst._zod.parse;
		const _normalized = cached(() => normalizeDef(def));
		const generateFastpass = (shape) => {
			const doc = new Doc([
				"shape",
				"payload",
				"ctx"
			]);
			const normalized = _normalized.value;
			const parseStr = (key) => {
				const k = esc(key);
				return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
			};
			doc.write(`const input = payload.value;`);
			const ids = Object.create(null);
			let counter = 0;
			for (const key of normalized.keys) ids[key] = `key_${counter++}`;
			doc.write(`const newResult = {};`);
			for (const key of normalized.keys) {
				const id = ids[key];
				const k = esc(key);
				const schema = shape[key];
				const isOptionalIn = schema?._zod?.optin === "optional";
				const isOptionalOut = schema?._zod?.optout === "optional";
				doc.write(`const ${id} = ${parseStr(key)};`);
				if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
				else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
				else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
			}
			doc.write(`payload.value = newResult;`);
			doc.write(`return payload;`);
			const fn = doc.compile();
			return (payload, ctx) => fn(shape, payload, ctx);
		};
		let fastpass;
		const isObject$2 = isObject;
		const jit = !globalConfig.jitless;
		const fastEnabled = jit && allowsEval.value;
		const catchall = def.catchall;
		let value;
		inst._zod.parse = (payload, ctx) => {
			value ?? (value = _normalized.value);
			const input = payload.value;
			if (!isObject$2(input)) {
				payload.issues.push({
					expected: "object",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
				if (!fastpass) fastpass = generateFastpass(def.shape);
				payload = fastpass(payload, ctx);
				if (!catchall) return payload;
				return handleCatchall([], input, payload, ctx, value, inst);
			}
			return superParse(payload, ctx);
		};
	});
	function handleUnionResults(results, final, inst, ctx) {
		for (const result of results) if (result.issues.length === 0) {
			final.value = result.value;
			return final;
		}
		const nonaborted = results.filter((r) => !aborted(r));
		if (nonaborted.length === 1) {
			final.value = nonaborted[0].value;
			return nonaborted[0];
		}
		final.issues.push({
			code: "invalid_union",
			input: final.value,
			inst,
			errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
		});
		return final;
	}
	var $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
		defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
		defineLazy(inst._zod, "values", () => {
			if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
		});
		defineLazy(inst._zod, "pattern", () => {
			if (def.options.every((o) => o._zod.pattern)) {
				const patterns = def.options.map((o) => o._zod.pattern);
				return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
			}
		});
		const first = def.options.length === 1 ? def.options[0]._zod.run : null;
		inst._zod.parse = (payload, ctx) => {
			if (first) return first(payload, ctx);
			let async = false;
			const results = [];
			for (const option of def.options) {
				const result = option._zod.run({
					value: payload.value,
					issues: []
				}, ctx);
				if (result instanceof Promise) {
					results.push(result);
					async = true;
				} else {
					if (result.issues.length === 0) return result;
					results.push(result);
				}
			}
			if (!async) return handleUnionResults(results, payload, inst, ctx);
			return Promise.all(results).then((results) => {
				return handleUnionResults(results, payload, inst, ctx);
			});
		};
	});
	var $ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
		def.inclusive = false;
		$ZodUnion.init(inst, def);
		const _super = inst._zod.parse;
		defineLazy(inst._zod, "propValues", () => {
			const propValues = {};
			for (const option of def.options) {
				const pv = option._zod.propValues;
				if (!pv || Object.keys(pv).length === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
				for (const [k, v] of Object.entries(pv)) {
					if (!propValues[k]) propValues[k] = /* @__PURE__ */ new Set();
					for (const val of v) propValues[k].add(val);
				}
			}
			return propValues;
		});
		const disc = cached(() => {
			const opts = def.options;
			const map = /* @__PURE__ */ new Map();
			for (const o of opts) {
				const values = o._zod.propValues?.[def.discriminator];
				if (!values || values.size === 0) throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
				for (const v of values) {
					if (map.has(v)) throw new Error(`Duplicate discriminator value "${String(v)}"`);
					map.set(v, o);
				}
			}
			return map;
		});
		inst._zod.parse = (payload, ctx) => {
			const input = payload.value;
			if (!isObject(input)) {
				payload.issues.push({
					code: "invalid_type",
					expected: "object",
					input,
					inst
				});
				return payload;
			}
			const opt = disc.value.get(input?.[def.discriminator]);
			if (opt) return opt._zod.run(payload, ctx);
			if (def.unionFallback || ctx.direction === "backward") return _super(payload, ctx);
			payload.issues.push({
				code: "invalid_union",
				errors: [],
				note: "No matching discriminator",
				discriminator: def.discriminator,
				options: Array.from(disc.value.keys()),
				input,
				path: [def.discriminator],
				inst
			});
			return payload;
		};
	});
	var $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, ctx) => {
			const input = payload.value;
			const left = def.left._zod.run({
				value: input,
				issues: []
			}, ctx);
			const right = def.right._zod.run({
				value: input,
				issues: []
			}, ctx);
			if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
				return handleIntersectionResults(payload, left, right);
			});
			return handleIntersectionResults(payload, left, right);
		};
	});
	function mergeValues(a, b) {
		if (a === b) return {
			valid: true,
			data: a
		};
		if (a instanceof Date && b instanceof Date && +a === +b) return {
			valid: true,
			data: a
		};
		if (isPlainObject(a) && isPlainObject(b)) {
			const bKeys = Object.keys(b);
			const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
			const newObj = {
				...a,
				...b
			};
			for (const key of sharedKeys) {
				const sharedValue = mergeValues(a[key], b[key]);
				if (!sharedValue.valid) return {
					valid: false,
					mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
				};
				newObj[key] = sharedValue.data;
			}
			return {
				valid: true,
				data: newObj
			};
		}
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return {
				valid: false,
				mergeErrorPath: []
			};
			const newArray = [];
			for (let index = 0; index < a.length; index++) {
				const itemA = a[index];
				const itemB = b[index];
				const sharedValue = mergeValues(itemA, itemB);
				if (!sharedValue.valid) return {
					valid: false,
					mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
				};
				newArray.push(sharedValue.data);
			}
			return {
				valid: true,
				data: newArray
			};
		}
		return {
			valid: false,
			mergeErrorPath: []
		};
	}
	function handleIntersectionResults(result, left, right) {
		const unrecKeys = /* @__PURE__ */ new Map();
		let unrecIssue;
		for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
			unrecIssue ?? (unrecIssue = iss);
			for (const k of iss.keys) {
				if (!unrecKeys.has(k)) unrecKeys.set(k, {});
				unrecKeys.get(k).l = true;
			}
		} else result.issues.push(iss);
		for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k).r = true;
		}
		else result.issues.push(iss);
		const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
		if (bothKeys.length && unrecIssue) result.issues.push({
			...unrecIssue,
			keys: bothKeys
		});
		if (aborted(result)) return result;
		const merged = mergeValues(left.value, right.value);
		if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
		result.value = merged.data;
		return result;
	}
	var $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, ctx) => {
			const input = payload.value;
			if (!isPlainObject(input)) {
				payload.issues.push({
					expected: "record",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			const proms = [];
			const values = def.keyType._zod.values;
			if (values) {
				payload.value = {};
				const recordKeys = /* @__PURE__ */ new Set();
				for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
					recordKeys.add(typeof key === "number" ? key.toString() : key);
					const keyResult = def.keyType._zod.run({
						value: key,
						issues: []
					}, ctx);
					if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (keyResult.issues.length) {
						payload.issues.push({
							code: "invalid_key",
							origin: "record",
							issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
							input: key,
							path: [key],
							inst
						});
						continue;
					}
					const outKey = keyResult.value;
					const result = def.valueType._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => {
						if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
						payload.value[outKey] = result.value;
					}));
					else {
						if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
						payload.value[outKey] = result.value;
					}
				}
				let unrecognized;
				for (const key in input) if (!recordKeys.has(key)) {
					unrecognized = unrecognized ?? [];
					unrecognized.push(key);
				}
				if (unrecognized && unrecognized.length > 0) payload.issues.push({
					code: "unrecognized_keys",
					input,
					inst,
					keys: unrecognized
				});
			} else {
				payload.value = {};
				for (const key of Reflect.ownKeys(input)) {
					if (key === "__proto__") continue;
					if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
					let keyResult = def.keyType._zod.run({
						value: key,
						issues: []
					}, ctx);
					if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
						const retryResult = def.keyType._zod.run({
							value: Number(key),
							issues: []
						}, ctx);
						if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
						if (retryResult.issues.length === 0) keyResult = retryResult;
					}
					if (keyResult.issues.length) {
						if (def.mode === "loose") payload.value[key] = input[key];
						else payload.issues.push({
							code: "invalid_key",
							origin: "record",
							issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
							input: key,
							path: [key],
							inst
						});
						continue;
					}
					const result = def.valueType._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => {
						if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
						payload.value[keyResult.value] = result.value;
					}));
					else {
						if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
						payload.value[keyResult.value] = result.value;
					}
				}
			}
			if (proms.length) return Promise.all(proms).then(() => payload);
			return payload;
		};
	});
	var $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
		$ZodType.init(inst, def);
		const values = getEnumValues(def.entries);
		const valuesSet = new Set(values);
		inst._zod.values = valuesSet;
		inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
		inst._zod.parse = (payload, _ctx) => {
			const input = payload.value;
			if (valuesSet.has(input)) return payload;
			payload.issues.push({
				code: "invalid_value",
				values,
				input,
				inst
			});
			return payload;
		};
	});
	var $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
		$ZodType.init(inst, def);
		if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
		const values = new Set(def.values);
		inst._zod.values = values;
		inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
		inst._zod.parse = (payload, _ctx) => {
			const input = payload.value;
			if (values.has(input)) return payload;
			payload.issues.push({
				code: "invalid_value",
				values: def.values,
				input,
				inst
			});
			return payload;
		};
	});
	var $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "optional";
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
			const _out = def.transform(payload.value, payload);
			if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
				payload.value = output;
				payload.fallback = true;
				return payload;
			});
			if (_out instanceof Promise) throw new $ZodAsyncError();
			payload.value = _out;
			payload.fallback = true;
			return payload;
		};
	});
	function handleOptionalResult(result, input) {
		if (input === void 0 && (result.issues.length || result.fallback)) return {
			issues: [],
			value: void 0
		};
		return result;
	}
	var $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "optional";
		inst._zod.optout = "optional";
		defineLazy(inst._zod, "values", () => {
			return def.innerType._zod.values ? new Set([...def.innerType._zod.values, void 0]) : void 0;
		});
		defineLazy(inst._zod, "pattern", () => {
			const pattern = def.innerType._zod.pattern;
			return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
		});
		inst._zod.parse = (payload, ctx) => {
			if (def.innerType._zod.optin === "optional") {
				const input = payload.value;
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
				return handleOptionalResult(result, input);
			}
			if (payload.value === void 0) return payload;
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
		$ZodOptional.init(inst, def);
		defineLazy(inst._zod, "values", () => def.innerType._zod.values);
		defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
		inst._zod.parse = (payload, ctx) => {
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
		defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
		defineLazy(inst._zod, "pattern", () => {
			const pattern = def.innerType._zod.pattern;
			return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
		});
		defineLazy(inst._zod, "values", () => {
			return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : void 0;
		});
		inst._zod.parse = (payload, ctx) => {
			if (payload.value === null) return payload;
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "optional";
		defineLazy(inst._zod, "values", () => def.innerType._zod.values);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			if (payload.value === void 0) {
				payload.value = def.defaultValue;
				/**
				* $ZodDefault returns the default value immediately in forward direction.
				* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
				return payload;
			}
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
			return handleDefaultResult(result, def);
		};
	});
	function handleDefaultResult(payload, def) {
		if (payload.value === void 0) payload.value = def.defaultValue;
		return payload;
	}
	var $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "optional";
		defineLazy(inst._zod, "values", () => def.innerType._zod.values);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			if (payload.value === void 0) payload.value = def.defaultValue;
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazy(inst._zod, "values", () => {
			const v = def.innerType._zod.values;
			return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
		});
		inst._zod.parse = (payload, ctx) => {
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
			return handleNonOptionalResult(result, inst);
		};
	});
	function handleNonOptionalResult(payload, inst) {
		if (!payload.issues.length && payload.value === void 0) payload.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: payload.value,
			inst
		});
		return payload;
	}
	var $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "optional";
		defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
		defineLazy(inst._zod, "values", () => def.innerType._zod.values);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((result) => {
				payload.value = result.value;
				if (result.issues.length) {
					payload.value = def.catchValue({
						...payload,
						error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
						input: payload.value
					});
					payload.issues = [];
					payload.fallback = true;
				}
				return payload;
			});
			payload.value = result.value;
			if (result.issues.length) {
				payload.value = def.catchValue({
					...payload,
					error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
					input: payload.value
				});
				payload.issues = [];
				payload.fallback = true;
			}
			return payload;
		};
	});
	var $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazy(inst._zod, "values", () => def.in._zod.values);
		defineLazy(inst._zod, "optin", () => def.in._zod.optin);
		defineLazy(inst._zod, "optout", () => def.out._zod.optout);
		defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") {
				const right = def.out._zod.run(payload, ctx);
				if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
				return handlePipeResult(right, def.in, ctx);
			}
			const left = def.in._zod.run(payload, ctx);
			if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
			return handlePipeResult(left, def.out, ctx);
		};
	});
	function handlePipeResult(left, next, ctx) {
		if (left.issues.length) {
			left.aborted = true;
			return left;
		}
		return next._zod.run({
			value: left.value,
			issues: left.issues,
			fallback: left.fallback
		}, ctx);
	}
	var $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
		defineLazy(inst._zod, "values", () => def.innerType._zod.values);
		defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
		defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then(handleReadonlyResult);
			return handleReadonlyResult(result);
		};
	});
	function handleReadonlyResult(payload) {
		payload.value = Object.freeze(payload.value);
		return payload;
	}
	var $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
		$ZodCheck.init(inst, def);
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, _) => {
			return payload;
		};
		inst._zod.check = (payload) => {
			const input = payload.value;
			const r = def.fn(input);
			if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
			handleRefineResult(r, payload, input, inst);
		};
	});
	function handleRefineResult(result, payload, input, inst) {
		if (!result) {
			const _iss = {
				code: "custom",
				input,
				inst,
				path: [...inst._zod.def.path ?? []],
				continue: !inst._zod.def.abort
			};
			if (inst._zod.def.params) _iss.params = inst._zod.def.params;
			payload.issues.push(issue(_iss));
		}
	}
	//#endregion
	//#region node_modules/zod/v4/core/registries.js
	var _a;
	var $ZodRegistry = class {
		constructor() {
			this._map = /* @__PURE__ */ new WeakMap();
			this._idmap = /* @__PURE__ */ new Map();
		}
		add(schema, ..._meta) {
			const meta = _meta[0];
			this._map.set(schema, meta);
			if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
			return this;
		}
		clear() {
			this._map = /* @__PURE__ */ new WeakMap();
			this._idmap = /* @__PURE__ */ new Map();
			return this;
		}
		remove(schema) {
			const meta = this._map.get(schema);
			if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
			this._map.delete(schema);
			return this;
		}
		get(schema) {
			const p = schema._zod.parent;
			if (p) {
				const pm = { ...this.get(p) ?? {} };
				delete pm.id;
				const f = {
					...pm,
					...this._map.get(schema)
				};
				return Object.keys(f).length ? f : void 0;
			}
			return this._map.get(schema);
		}
		has(schema) {
			return this._map.has(schema);
		}
	};
	function registry() {
		return new $ZodRegistry();
	}
	(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
	var globalRegistry = globalThis.__zod_globalRegistry;
	//#endregion
	//#region node_modules/zod/v4/core/api.js
	// @__NO_SIDE_EFFECTS__
	function _string(Class, params) {
		return new Class({
			type: "string",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _email(Class, params) {
		return new Class({
			type: "string",
			format: "email",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _guid(Class, params) {
		return new Class({
			type: "string",
			format: "guid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _uuid(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _uuidv4(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			version: "v4",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _uuidv6(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			version: "v6",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _uuidv7(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			version: "v7",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _url(Class, params) {
		return new Class({
			type: "string",
			format: "url",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _emoji(Class, params) {
		return new Class({
			type: "string",
			format: "emoji",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _nanoid(Class, params) {
		return new Class({
			type: "string",
			format: "nanoid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	/**
	* @deprecated CUID v1 is deprecated by its authors due to information leakage
	* (timestamps embedded in the id). Use {@link _cuid2} instead.
	* See https://github.com/paralleldrive/cuid.
	*/
	// @__NO_SIDE_EFFECTS__
	function _cuid(Class, params) {
		return new Class({
			type: "string",
			format: "cuid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _cuid2(Class, params) {
		return new Class({
			type: "string",
			format: "cuid2",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _ulid(Class, params) {
		return new Class({
			type: "string",
			format: "ulid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _xid(Class, params) {
		return new Class({
			type: "string",
			format: "xid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _ksuid(Class, params) {
		return new Class({
			type: "string",
			format: "ksuid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _ipv4(Class, params) {
		return new Class({
			type: "string",
			format: "ipv4",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _ipv6(Class, params) {
		return new Class({
			type: "string",
			format: "ipv6",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _cidrv4(Class, params) {
		return new Class({
			type: "string",
			format: "cidrv4",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _cidrv6(Class, params) {
		return new Class({
			type: "string",
			format: "cidrv6",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _base64(Class, params) {
		return new Class({
			type: "string",
			format: "base64",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _base64url(Class, params) {
		return new Class({
			type: "string",
			format: "base64url",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _e164(Class, params) {
		return new Class({
			type: "string",
			format: "e164",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _jwt(Class, params) {
		return new Class({
			type: "string",
			format: "jwt",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _isoDateTime(Class, params) {
		return new Class({
			type: "string",
			format: "datetime",
			check: "string_format",
			offset: false,
			local: false,
			precision: null,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _isoDate(Class, params) {
		return new Class({
			type: "string",
			format: "date",
			check: "string_format",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _isoTime(Class, params) {
		return new Class({
			type: "string",
			format: "time",
			check: "string_format",
			precision: null,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _isoDuration(Class, params) {
		return new Class({
			type: "string",
			format: "duration",
			check: "string_format",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _number(Class, params) {
		return new Class({
			type: "number",
			checks: [],
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _int(Class, params) {
		return new Class({
			type: "number",
			check: "number_format",
			abort: false,
			format: "safeint",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _boolean(Class, params) {
		return new Class({
			type: "boolean",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _any(Class) {
		return new Class({ type: "any" });
	}
	// @__NO_SIDE_EFFECTS__
	function _unknown(Class) {
		return new Class({ type: "unknown" });
	}
	// @__NO_SIDE_EFFECTS__
	function _never(Class, params) {
		return new Class({
			type: "never",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _lt(value, params) {
		return new $ZodCheckLessThan({
			check: "less_than",
			...normalizeParams(params),
			value,
			inclusive: false
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _lte(value, params) {
		return new $ZodCheckLessThan({
			check: "less_than",
			...normalizeParams(params),
			value,
			inclusive: true
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _gt(value, params) {
		return new $ZodCheckGreaterThan({
			check: "greater_than",
			...normalizeParams(params),
			value,
			inclusive: false
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _gte(value, params) {
		return new $ZodCheckGreaterThan({
			check: "greater_than",
			...normalizeParams(params),
			value,
			inclusive: true
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _multipleOf(value, params) {
		return new $ZodCheckMultipleOf({
			check: "multiple_of",
			...normalizeParams(params),
			value
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _maxLength(maximum, params) {
		return new $ZodCheckMaxLength({
			check: "max_length",
			...normalizeParams(params),
			maximum
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _minLength(minimum, params) {
		return new $ZodCheckMinLength({
			check: "min_length",
			...normalizeParams(params),
			minimum
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _length(length, params) {
		return new $ZodCheckLengthEquals({
			check: "length_equals",
			...normalizeParams(params),
			length
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _regex(pattern, params) {
		return new $ZodCheckRegex({
			check: "string_format",
			format: "regex",
			...normalizeParams(params),
			pattern
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _lowercase(params) {
		return new $ZodCheckLowerCase({
			check: "string_format",
			format: "lowercase",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _uppercase(params) {
		return new $ZodCheckUpperCase({
			check: "string_format",
			format: "uppercase",
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _includes(includes, params) {
		return new $ZodCheckIncludes({
			check: "string_format",
			format: "includes",
			...normalizeParams(params),
			includes
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _startsWith(prefix, params) {
		return new $ZodCheckStartsWith({
			check: "string_format",
			format: "starts_with",
			...normalizeParams(params),
			prefix
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _endsWith(suffix, params) {
		return new $ZodCheckEndsWith({
			check: "string_format",
			format: "ends_with",
			...normalizeParams(params),
			suffix
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _overwrite(tx) {
		return new $ZodCheckOverwrite({
			check: "overwrite",
			tx
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _normalize(form) {
		return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
	}
	// @__NO_SIDE_EFFECTS__
	function _trim() {
		return /* @__PURE__ */ _overwrite((input) => input.trim());
	}
	// @__NO_SIDE_EFFECTS__
	function _toLowerCase() {
		return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
	}
	// @__NO_SIDE_EFFECTS__
	function _toUpperCase() {
		return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
	}
	// @__NO_SIDE_EFFECTS__
	function _slugify() {
		return /* @__PURE__ */ _overwrite((input) => slugify(input));
	}
	// @__NO_SIDE_EFFECTS__
	function _array(Class, element, params) {
		return new Class({
			type: "array",
			element,
			...normalizeParams(params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _custom(Class, fn, _params) {
		const norm = normalizeParams(_params);
		norm.abort ?? (norm.abort = true);
		return new Class({
			type: "custom",
			check: "custom",
			fn,
			...norm
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _refine(Class, fn, _params) {
		return new Class({
			type: "custom",
			check: "custom",
			fn,
			...normalizeParams(_params)
		});
	}
	// @__NO_SIDE_EFFECTS__
	function _superRefine(fn, params) {
		const ch = /* @__PURE__ */ _check((payload) => {
			payload.addIssue = (issue$2) => {
				if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
				else {
					const _issue = issue$2;
					if (_issue.fatal) _issue.continue = false;
					_issue.code ?? (_issue.code = "custom");
					_issue.input ?? (_issue.input = payload.value);
					_issue.inst ?? (_issue.inst = ch);
					_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
					payload.issues.push(issue(_issue));
				}
			};
			return fn(payload.value, payload);
		}, params);
		return ch;
	}
	// @__NO_SIDE_EFFECTS__
	function _check(fn, params) {
		const ch = new $ZodCheck({
			check: "custom",
			...normalizeParams(params)
		});
		ch._zod.check = fn;
		return ch;
	}
	//#endregion
	//#region node_modules/zod/v4/core/to-json-schema.js
	function initializeContext(params) {
		let target = params?.target ?? "draft-2020-12";
		if (target === "draft-4") target = "draft-04";
		if (target === "draft-7") target = "draft-07";
		return {
			processors: params.processors ?? {},
			metadataRegistry: params?.metadata ?? globalRegistry,
			target,
			unrepresentable: params?.unrepresentable ?? "throw",
			override: params?.override ?? (() => {}),
			io: params?.io ?? "output",
			counter: 0,
			seen: /* @__PURE__ */ new Map(),
			cycles: params?.cycles ?? "ref",
			reused: params?.reused ?? "inline",
			external: params?.external ?? void 0
		};
	}
	function process$1(schema, ctx, _params = {
		path: [],
		schemaPath: []
	}) {
		var _a;
		const def = schema._zod.def;
		const seen = ctx.seen.get(schema);
		if (seen) {
			seen.count++;
			if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
			return seen.schema;
		}
		const result = {
			schema: {},
			count: 1,
			cycle: void 0,
			path: _params.path
		};
		ctx.seen.set(schema, result);
		const overrideSchema = schema._zod.toJSONSchema?.();
		if (overrideSchema) result.schema = overrideSchema;
		else {
			const params = {
				..._params,
				schemaPath: [..._params.schemaPath, schema],
				path: _params.path
			};
			if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
			else {
				const _json = result.schema;
				const processor = ctx.processors[def.type];
				if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
				processor(schema, ctx, _json, params);
			}
			const parent = schema._zod.parent;
			if (parent) {
				if (!result.ref) result.ref = parent;
				process$1(parent, ctx, params);
				ctx.seen.get(parent).isParent = true;
			}
		}
		const meta = ctx.metadataRegistry.get(schema);
		if (meta) Object.assign(result.schema, meta);
		if (ctx.io === "input" && isTransforming(schema)) {
			delete result.schema.examples;
			delete result.schema.default;
		}
		if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
		delete result.schema._prefault;
		return ctx.seen.get(schema).schema;
	}
	function extractDefs(ctx, schema) {
		const root = ctx.seen.get(schema);
		if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
		const idToSchema = /* @__PURE__ */ new Map();
		for (const entry of ctx.seen.entries()) {
			const id = ctx.metadataRegistry.get(entry[0])?.id;
			if (id) {
				const existing = idToSchema.get(id);
				if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
				idToSchema.set(id, entry[0]);
			}
		}
		const makeURI = (entry) => {
			const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
			if (ctx.external) {
				const externalId = ctx.external.registry.get(entry[0])?.id;
				const uriGenerator = ctx.external.uri ?? ((id) => id);
				if (externalId) return { ref: uriGenerator(externalId) };
				const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
				entry[1].defId = id;
				return {
					defId: id,
					ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
				};
			}
			if (entry[1] === root) return { ref: "#" };
			const defUriPrefix = `#/${defsSegment}/`;
			const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
			return {
				defId,
				ref: defUriPrefix + defId
			};
		};
		const extractToDef = (entry) => {
			if (entry[1].schema.$ref) return;
			const seen = entry[1];
			const { ref, defId } = makeURI(entry);
			seen.def = { ...seen.schema };
			if (defId) seen.defId = defId;
			const schema = seen.schema;
			for (const key in schema) delete schema[key];
			schema.$ref = ref;
		};
		if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
			const seen = entry[1];
			if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
		}
		for (const entry of ctx.seen.entries()) {
			const seen = entry[1];
			if (schema === entry[0]) {
				extractToDef(entry);
				continue;
			}
			if (ctx.external) {
				const ext = ctx.external.registry.get(entry[0])?.id;
				if (schema !== entry[0] && ext) {
					extractToDef(entry);
					continue;
				}
			}
			if (ctx.metadataRegistry.get(entry[0])?.id) {
				extractToDef(entry);
				continue;
			}
			if (seen.cycle) {
				extractToDef(entry);
				continue;
			}
			if (seen.count > 1) {
				if (ctx.reused === "ref") {
					extractToDef(entry);
					continue;
				}
			}
		}
	}
	function finalize(ctx, schema) {
		const root = ctx.seen.get(schema);
		if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
		const flattenRef = (zodSchema) => {
			const seen = ctx.seen.get(zodSchema);
			if (seen.ref === null) return;
			const schema = seen.def ?? seen.schema;
			const _cached = { ...schema };
			const ref = seen.ref;
			seen.ref = null;
			if (ref) {
				flattenRef(ref);
				const refSeen = ctx.seen.get(ref);
				const refSchema = refSeen.schema;
				if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
					schema.allOf = schema.allOf ?? [];
					schema.allOf.push(refSchema);
				} else Object.assign(schema, refSchema);
				Object.assign(schema, _cached);
				if (zodSchema._zod.parent === ref) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (!(key in _cached)) delete schema[key];
				}
				if (refSchema.$ref && refSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
				}
			}
			const parent = zodSchema._zod.parent;
			if (parent && parent !== ref) {
				flattenRef(parent);
				const parentSeen = ctx.seen.get(parent);
				if (parentSeen?.schema.$ref) {
					schema.$ref = parentSeen.schema.$ref;
					if (parentSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
					}
				}
			}
			ctx.override({
				zodSchema,
				jsonSchema: schema,
				path: seen.path ?? []
			});
		};
		for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
		const result = {};
		if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
		else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
		else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
		else if (ctx.target === "openapi-3.0") {}
		if (ctx.external?.uri) {
			const id = ctx.external.registry.get(schema)?.id;
			if (!id) throw new Error("Schema is missing an `id` property");
			result.$id = ctx.external.uri(id);
		}
		Object.assign(result, root.def ?? root.schema);
		const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
		if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
		const defs = ctx.external?.defs ?? {};
		for (const entry of ctx.seen.entries()) {
			const seen = entry[1];
			if (seen.def && seen.defId) {
				if (seen.def.id === seen.defId) delete seen.def.id;
				defs[seen.defId] = seen.def;
			}
		}
		if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
		else result.definitions = defs;
		try {
			const finalized = JSON.parse(JSON.stringify(result));
			Object.defineProperty(finalized, "~standard", {
				value: {
					...schema["~standard"],
					jsonSchema: {
						input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
						output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
					}
				},
				enumerable: false,
				writable: false
			});
			return finalized;
		} catch (_err) {
			throw new Error("Error converting schema to JSON.");
		}
	}
	function isTransforming(_schema, _ctx) {
		const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
		if (ctx.seen.has(_schema)) return false;
		ctx.seen.add(_schema);
		const def = _schema._zod.def;
		if (def.type === "transform") return true;
		if (def.type === "array") return isTransforming(def.element, ctx);
		if (def.type === "set") return isTransforming(def.valueType, ctx);
		if (def.type === "lazy") return isTransforming(def.getter(), ctx);
		if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
		if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
		if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
		if (def.type === "pipe") {
			if (_schema._zod.traits.has("$ZodCodec")) return true;
			return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
		}
		if (def.type === "object") {
			for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
			return false;
		}
		if (def.type === "union") {
			for (const option of def.options) if (isTransforming(option, ctx)) return true;
			return false;
		}
		if (def.type === "tuple") {
			for (const item of def.items) if (isTransforming(item, ctx)) return true;
			if (def.rest && isTransforming(def.rest, ctx)) return true;
			return false;
		}
		return false;
	}
	/**
	* Creates a toJSONSchema method for a schema instance.
	* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
	*/
	var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
		const ctx = initializeContext({
			...params,
			processors
		});
		process$1(schema, ctx);
		extractDefs(ctx, schema);
		return finalize(ctx, schema);
	};
	var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
		const { libraryOptions, target } = params ?? {};
		const ctx = initializeContext({
			...libraryOptions ?? {},
			target,
			io,
			processors
		});
		process$1(schema, ctx);
		extractDefs(ctx, schema);
		return finalize(ctx, schema);
	};
	//#endregion
	//#region node_modules/zod/v4/core/json-schema-processors.js
	var formatMap = {
		guid: "uuid",
		url: "uri",
		datetime: "date-time",
		json_string: "json-string",
		regex: ""
	};
	var stringProcessor = (schema, ctx, _json, _params) => {
		const json = _json;
		json.type = "string";
		const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
		if (typeof minimum === "number") json.minLength = minimum;
		if (typeof maximum === "number") json.maxLength = maximum;
		if (format) {
			json.format = formatMap[format] ?? format;
			if (json.format === "") delete json.format;
			if (format === "time") delete json.format;
		}
		if (contentEncoding) json.contentEncoding = contentEncoding;
		if (patterns && patterns.size > 0) {
			const regexes = [...patterns];
			if (regexes.length === 1) json.pattern = regexes[0].source;
			else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
				...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
				pattern: regex.source
			}))];
		}
	};
	var numberProcessor = (schema, ctx, _json, _params) => {
		const json = _json;
		const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
		if (typeof format === "string" && format.includes("int")) json.type = "integer";
		else json.type = "number";
		const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
		const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
		const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
		if (exMin) if (legacy) {
			json.minimum = exclusiveMinimum;
			json.exclusiveMinimum = true;
		} else json.exclusiveMinimum = exclusiveMinimum;
		else if (typeof minimum === "number") json.minimum = minimum;
		if (exMax) if (legacy) {
			json.maximum = exclusiveMaximum;
			json.exclusiveMaximum = true;
		} else json.exclusiveMaximum = exclusiveMaximum;
		else if (typeof maximum === "number") json.maximum = maximum;
		if (typeof multipleOf === "number") json.multipleOf = multipleOf;
	};
	var booleanProcessor = (_schema, _ctx, json, _params) => {
		json.type = "boolean";
	};
	var neverProcessor = (_schema, _ctx, json, _params) => {
		json.not = {};
	};
	var enumProcessor = (schema, _ctx, json, _params) => {
		const def = schema._zod.def;
		const values = getEnumValues(def.entries);
		if (values.every((v) => typeof v === "number")) json.type = "number";
		if (values.every((v) => typeof v === "string")) json.type = "string";
		json.enum = values;
	};
	var literalProcessor = (schema, ctx, json, _params) => {
		const def = schema._zod.def;
		const vals = [];
		for (const val of def.values) if (val === void 0) {
			if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
		} else if (typeof val === "bigint") if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
		else vals.push(Number(val));
		else vals.push(val);
		if (vals.length === 0) {} else if (vals.length === 1) {
			const val = vals[0];
			json.type = val === null ? "null" : typeof val;
			if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
			else json.const = val;
		} else {
			if (vals.every((v) => typeof v === "number")) json.type = "number";
			if (vals.every((v) => typeof v === "string")) json.type = "string";
			if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
			if (vals.every((v) => v === null)) json.type = "null";
			json.enum = vals;
		}
	};
	var customProcessor = (_schema, ctx, _json, _params) => {
		if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
	};
	var transformProcessor = (_schema, ctx, _json, _params) => {
		if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
	};
	var arrayProcessor = (schema, ctx, _json, params) => {
		const json = _json;
		const def = schema._zod.def;
		const { minimum, maximum } = schema._zod.bag;
		if (typeof minimum === "number") json.minItems = minimum;
		if (typeof maximum === "number") json.maxItems = maximum;
		json.type = "array";
		json.items = process$1(def.element, ctx, {
			...params,
			path: [...params.path, "items"]
		});
	};
	var objectProcessor = (schema, ctx, _json, params) => {
		const json = _json;
		const def = schema._zod.def;
		json.type = "object";
		json.properties = {};
		const shape = def.shape;
		for (const key in shape) json.properties[key] = process$1(shape[key], ctx, {
			...params,
			path: [
				...params.path,
				"properties",
				key
			]
		});
		const allKeys = new Set(Object.keys(shape));
		const requiredKeys = new Set([...allKeys].filter((key) => {
			const v = def.shape[key]._zod;
			if (ctx.io === "input") return v.optin === void 0;
			else return v.optout === void 0;
		}));
		if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
		if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
		else if (!def.catchall) {
			if (ctx.io === "output") json.additionalProperties = false;
		} else if (def.catchall) json.additionalProperties = process$1(def.catchall, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	};
	var unionProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		const isExclusive = def.inclusive === false;
		const options = def.options.map((x, i) => process$1(x, ctx, {
			...params,
			path: [
				...params.path,
				isExclusive ? "oneOf" : "anyOf",
				i
			]
		}));
		if (isExclusive) json.oneOf = options;
		else json.anyOf = options;
	};
	var intersectionProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		const a = process$1(def.left, ctx, {
			...params,
			path: [
				...params.path,
				"allOf",
				0
			]
		});
		const b = process$1(def.right, ctx, {
			...params,
			path: [
				...params.path,
				"allOf",
				1
			]
		});
		const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
		json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
	};
	var recordProcessor = (schema, ctx, _json, params) => {
		const json = _json;
		const def = schema._zod.def;
		json.type = "object";
		const keyType = def.keyType;
		const patterns = keyType._zod.bag?.patterns;
		if (def.mode === "loose" && patterns && patterns.size > 0) {
			const valueSchema = process$1(def.valueType, ctx, {
				...params,
				path: [
					...params.path,
					"patternProperties",
					"*"
				]
			});
			json.patternProperties = {};
			for (const pattern of patterns) json.patternProperties[pattern.source] = valueSchema;
		} else {
			if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") json.propertyNames = process$1(def.keyType, ctx, {
				...params,
				path: [...params.path, "propertyNames"]
			});
			json.additionalProperties = process$1(def.valueType, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		}
		const keyValues = keyType._zod.values;
		if (keyValues) {
			const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
			if (validKeyValues.length > 0) json.required = validKeyValues;
		}
	};
	var nullableProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		const inner = process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		if (ctx.target === "openapi-3.0") {
			seen.ref = def.innerType;
			json.nullable = true;
		} else json.anyOf = [inner, { type: "null" }];
	};
	var nonoptionalProcessor = (schema, ctx, _json, params) => {
		const def = schema._zod.def;
		process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
	};
	var defaultProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		json.default = JSON.parse(JSON.stringify(def.defaultValue));
	};
	var prefaultProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
	};
	var catchProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		let catchValue;
		try {
			catchValue = def.catchValue(void 0);
		} catch {
			throw new Error("Dynamic catch values are not supported in JSON Schema");
		}
		json.default = catchValue;
	};
	var pipeProcessor = (schema, ctx, _json, params) => {
		const def = schema._zod.def;
		const inIsTransform = def.in._zod.traits.has("$ZodTransform");
		const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
		process$1(innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = innerType;
	};
	var readonlyProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		json.readOnly = true;
	};
	var optionalProcessor = (schema, ctx, _json, params) => {
		const def = schema._zod.def;
		process$1(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
	};
	//#endregion
	//#region node_modules/zod/v4/classic/iso.js
	var ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
		$ZodISODateTime.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	function datetime(params) {
		return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
	}
	var ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
		$ZodISODate.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	function date(params) {
		return /* @__PURE__ */ _isoDate(ZodISODate, params);
	}
	var ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
		$ZodISOTime.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	function time(params) {
		return /* @__PURE__ */ _isoTime(ZodISOTime, params);
	}
	var ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
		$ZodISODuration.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	function duration(params) {
		return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
	}
	//#endregion
	//#region node_modules/zod/v4/classic/errors.js
	var initializer = (inst, issues) => {
		$ZodError.init(inst, issues);
		inst.name = "ZodError";
		Object.defineProperties(inst, {
			format: { value: (mapper) => formatError(inst, mapper) },
			flatten: { value: (mapper) => flattenError(inst, mapper) },
			addIssue: { value: (issue) => {
				inst.issues.push(issue);
				inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
			} },
			addIssues: { value: (issues) => {
				inst.issues.push(...issues);
				inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
			} },
			isEmpty: { get() {
				return inst.issues.length === 0;
			} }
		});
	};
	var ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
	//#endregion
	//#region node_modules/zod/v4/classic/parse.js
	var parse = /* @__PURE__ */ _parse(ZodRealError);
	var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
	var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
	var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
	var encode = /* @__PURE__ */ _encode(ZodRealError);
	var decode = /* @__PURE__ */ _decode(ZodRealError);
	var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
	var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
	var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
	var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
	var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
	var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
	//#endregion
	//#region node_modules/zod/v4/classic/schemas.js
	var _installedGroups = /* @__PURE__ */ new WeakMap();
	function _installLazyMethods(inst, group, methods) {
		const proto = Object.getPrototypeOf(inst);
		let installed = _installedGroups.get(proto);
		if (!installed) {
			installed = /* @__PURE__ */ new Set();
			_installedGroups.set(proto, installed);
		}
		if (installed.has(group)) return;
		installed.add(group);
		for (const key in methods) {
			const fn = methods[key];
			Object.defineProperty(proto, key, {
				configurable: true,
				enumerable: false,
				get() {
					const bound = fn.bind(this);
					Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						enumerable: true,
						value: bound
					});
					return bound;
				},
				set(v) {
					Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						enumerable: true,
						value: v
					});
				}
			});
		}
	}
	var ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
		$ZodType.init(inst, def);
		Object.assign(inst["~standard"], { jsonSchema: {
			input: createStandardJSONSchemaMethod(inst, "input"),
			output: createStandardJSONSchemaMethod(inst, "output")
		} });
		inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
		inst.def = def;
		inst.type = def.type;
		Object.defineProperty(inst, "_def", { value: def });
		inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
		inst.safeParse = (data, params) => safeParse(inst, data, params);
		inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
		inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
		inst.spa = inst.safeParseAsync;
		inst.encode = (data, params) => encode(inst, data, params);
		inst.decode = (data, params) => decode(inst, data, params);
		inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
		inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
		inst.safeEncode = (data, params) => safeEncode(inst, data, params);
		inst.safeDecode = (data, params) => safeDecode(inst, data, params);
		inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
		inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
		_installLazyMethods(inst, "ZodType", {
			check(...chks) {
				const def = this.def;
				return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
					check: ch,
					def: { check: "custom" },
					onattach: []
				} } : ch)] }), { parent: true });
			},
			with(...chks) {
				return this.check(...chks);
			},
			clone(def, params) {
				return clone(this, def, params);
			},
			brand() {
				return this;
			},
			register(reg, meta) {
				reg.add(this, meta);
				return this;
			},
			refine(check, params) {
				return this.check(refine(check, params));
			},
			superRefine(refinement, params) {
				return this.check(superRefine(refinement, params));
			},
			overwrite(fn) {
				return this.check(/* @__PURE__ */ _overwrite(fn));
			},
			optional() {
				return optional(this);
			},
			exactOptional() {
				return exactOptional(this);
			},
			nullable() {
				return nullable(this);
			},
			nullish() {
				return optional(nullable(this));
			},
			nonoptional(params) {
				return nonoptional(this, params);
			},
			array() {
				return array(this);
			},
			or(arg) {
				return union([this, arg]);
			},
			and(arg) {
				return intersection(this, arg);
			},
			transform(tx) {
				return pipe(this, transform(tx));
			},
			default(d) {
				return _default(this, d);
			},
			prefault(d) {
				return prefault(this, d);
			},
			catch(params) {
				return _catch(this, params);
			},
			pipe(target) {
				return pipe(this, target);
			},
			readonly() {
				return readonly(this);
			},
			describe(description) {
				const cl = this.clone();
				globalRegistry.add(cl, { description });
				return cl;
			},
			meta(...args) {
				if (args.length === 0) return globalRegistry.get(this);
				const cl = this.clone();
				globalRegistry.add(cl, args[0]);
				return cl;
			},
			isOptional() {
				return this.safeParse(void 0).success;
			},
			isNullable() {
				return this.safeParse(null).success;
			},
			apply(fn) {
				return fn(this);
			}
		});
		Object.defineProperty(inst, "description", {
			get() {
				return globalRegistry.get(inst)?.description;
			},
			configurable: true
		});
		return inst;
	});
	/** @internal */
	var _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
		$ZodString.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
		const bag = inst._zod.bag;
		inst.format = bag.format ?? null;
		inst.minLength = bag.minimum ?? null;
		inst.maxLength = bag.maximum ?? null;
		_installLazyMethods(inst, "_ZodString", {
			regex(...args) {
				return this.check(/* @__PURE__ */ _regex(...args));
			},
			includes(...args) {
				return this.check(/* @__PURE__ */ _includes(...args));
			},
			startsWith(...args) {
				return this.check(/* @__PURE__ */ _startsWith(...args));
			},
			endsWith(...args) {
				return this.check(/* @__PURE__ */ _endsWith(...args));
			},
			min(...args) {
				return this.check(/* @__PURE__ */ _minLength(...args));
			},
			max(...args) {
				return this.check(/* @__PURE__ */ _maxLength(...args));
			},
			length(...args) {
				return this.check(/* @__PURE__ */ _length(...args));
			},
			nonempty(...args) {
				return this.check(/* @__PURE__ */ _minLength(1, ...args));
			},
			lowercase(params) {
				return this.check(/* @__PURE__ */ _lowercase(params));
			},
			uppercase(params) {
				return this.check(/* @__PURE__ */ _uppercase(params));
			},
			trim() {
				return this.check(/* @__PURE__ */ _trim());
			},
			normalize(...args) {
				return this.check(/* @__PURE__ */ _normalize(...args));
			},
			toLowerCase() {
				return this.check(/* @__PURE__ */ _toLowerCase());
			},
			toUpperCase() {
				return this.check(/* @__PURE__ */ _toUpperCase());
			},
			slugify() {
				return this.check(/* @__PURE__ */ _slugify());
			}
		});
	});
	var ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
		$ZodString.init(inst, def);
		_ZodString.init(inst, def);
		inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
		inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
		inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
		inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
		inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
		inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
		inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
		inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
		inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
		inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
		inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
		inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
		inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
		inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
		inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
		inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
		inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
		inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
		inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
		inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
		inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
		inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
		inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
		inst.datetime = (params) => inst.check(datetime(params));
		inst.date = (params) => inst.check(date(params));
		inst.time = (params) => inst.check(time(params));
		inst.duration = (params) => inst.check(duration(params));
	});
	function string(params) {
		return /* @__PURE__ */ _string(ZodString, params);
	}
	var ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
		$ZodStringFormat.init(inst, def);
		_ZodString.init(inst, def);
	});
	var ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
		$ZodEmail.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
		$ZodGUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
		$ZodUUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
		$ZodURL.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
		$ZodEmoji.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
		$ZodNanoID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	/**
	* @deprecated CUID v1 is deprecated by its authors due to information leakage
	* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
	* See https://github.com/paralleldrive/cuid.
	*/
	var ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
		$ZodCUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
		$ZodCUID2.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
		$ZodULID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
		$ZodXID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
		$ZodKSUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
		$ZodIPv4.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
		$ZodIPv6.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
		$ZodCIDRv4.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
		$ZodCIDRv6.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
		$ZodBase64.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
		$ZodBase64URL.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
		$ZodE164.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
		$ZodJWT.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
		$ZodNumber.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
		_installLazyMethods(inst, "ZodNumber", {
			gt(value, params) {
				return this.check(/* @__PURE__ */ _gt(value, params));
			},
			gte(value, params) {
				return this.check(/* @__PURE__ */ _gte(value, params));
			},
			min(value, params) {
				return this.check(/* @__PURE__ */ _gte(value, params));
			},
			lt(value, params) {
				return this.check(/* @__PURE__ */ _lt(value, params));
			},
			lte(value, params) {
				return this.check(/* @__PURE__ */ _lte(value, params));
			},
			max(value, params) {
				return this.check(/* @__PURE__ */ _lte(value, params));
			},
			int(params) {
				return this.check(int(params));
			},
			safe(params) {
				return this.check(int(params));
			},
			positive(params) {
				return this.check(/* @__PURE__ */ _gt(0, params));
			},
			nonnegative(params) {
				return this.check(/* @__PURE__ */ _gte(0, params));
			},
			negative(params) {
				return this.check(/* @__PURE__ */ _lt(0, params));
			},
			nonpositive(params) {
				return this.check(/* @__PURE__ */ _lte(0, params));
			},
			multipleOf(value, params) {
				return this.check(/* @__PURE__ */ _multipleOf(value, params));
			},
			step(value, params) {
				return this.check(/* @__PURE__ */ _multipleOf(value, params));
			},
			finite() {
				return this;
			}
		});
		const bag = inst._zod.bag;
		inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
		inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
		inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
		inst.isFinite = true;
		inst.format = bag.format ?? null;
	});
	function number(params) {
		return /* @__PURE__ */ _number(ZodNumber, params);
	}
	var ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
		$ZodNumberFormat.init(inst, def);
		ZodNumber.init(inst, def);
	});
	function int(params) {
		return /* @__PURE__ */ _int(ZodNumberFormat, params);
	}
	var ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
		$ZodBoolean.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
	});
	function boolean(params) {
		return /* @__PURE__ */ _boolean(ZodBoolean, params);
	}
	var ZodAny = /*@__PURE__*/ $constructor("ZodAny", (inst, def) => {
		$ZodAny.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => void 0;
	});
	function any() {
		return /* @__PURE__ */ _any(ZodAny);
	}
	var ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
		$ZodUnknown.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => void 0;
	});
	function unknown() {
		return /* @__PURE__ */ _unknown(ZodUnknown);
	}
	var ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
		$ZodNever.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
	});
	function never(params) {
		return /* @__PURE__ */ _never(ZodNever, params);
	}
	var ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
		$ZodArray.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
		inst.element = def.element;
		_installLazyMethods(inst, "ZodArray", {
			min(n, params) {
				return this.check(/* @__PURE__ */ _minLength(n, params));
			},
			nonempty(params) {
				return this.check(/* @__PURE__ */ _minLength(1, params));
			},
			max(n, params) {
				return this.check(/* @__PURE__ */ _maxLength(n, params));
			},
			length(n, params) {
				return this.check(/* @__PURE__ */ _length(n, params));
			},
			unwrap() {
				return this.element;
			}
		});
	});
	function array(element, params) {
		return /* @__PURE__ */ _array(ZodArray, element, params);
	}
	var ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
		$ZodObjectJIT.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
		defineLazy(inst, "shape", () => {
			return def.shape;
		});
		_installLazyMethods(inst, "ZodObject", {
			keyof() {
				return _enum(Object.keys(this._zod.def.shape));
			},
			catchall(catchall) {
				return this.clone({
					...this._zod.def,
					catchall
				});
			},
			passthrough() {
				return this.clone({
					...this._zod.def,
					catchall: unknown()
				});
			},
			loose() {
				return this.clone({
					...this._zod.def,
					catchall: unknown()
				});
			},
			strict() {
				return this.clone({
					...this._zod.def,
					catchall: never()
				});
			},
			strip() {
				return this.clone({
					...this._zod.def,
					catchall: void 0
				});
			},
			extend(incoming) {
				return extend(this, incoming);
			},
			safeExtend(incoming) {
				return safeExtend(this, incoming);
			},
			merge(other) {
				return merge(this, other);
			},
			pick(mask) {
				return pick(this, mask);
			},
			omit(mask) {
				return omit(this, mask);
			},
			partial(...args) {
				return partial(ZodOptional, this, args[0]);
			},
			required(...args) {
				return required(ZodNonOptional, this, args[0]);
			}
		});
	});
	function object(shape, params) {
		return new ZodObject({
			type: "object",
			shape: shape ?? {},
			...normalizeParams(params)
		});
	}
	var ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
		$ZodUnion.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
		inst.options = def.options;
	});
	function union(options, params) {
		return new ZodUnion({
			type: "union",
			options,
			...normalizeParams(params)
		});
	}
	var ZodDiscriminatedUnion = /*@__PURE__*/ $constructor("ZodDiscriminatedUnion", (inst, def) => {
		ZodUnion.init(inst, def);
		$ZodDiscriminatedUnion.init(inst, def);
	});
	function discriminatedUnion(discriminator, options, params) {
		return new ZodDiscriminatedUnion({
			type: "union",
			options,
			discriminator,
			...normalizeParams(params)
		});
	}
	var ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
		$ZodIntersection.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
	});
	function intersection(left, right) {
		return new ZodIntersection({
			type: "intersection",
			left,
			right
		});
	}
	var ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
		$ZodRecord.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
		inst.keyType = def.keyType;
		inst.valueType = def.valueType;
	});
	function record(keyType, valueType, params) {
		if (!valueType || !valueType._zod) return new ZodRecord({
			type: "record",
			keyType: string(),
			valueType: keyType,
			...normalizeParams(valueType)
		});
		return new ZodRecord({
			type: "record",
			keyType,
			valueType,
			...normalizeParams(params)
		});
	}
	var ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
		$ZodEnum.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
		inst.enum = def.entries;
		inst.options = Object.values(def.entries);
		const keys = new Set(Object.keys(def.entries));
		inst.extract = (values, params) => {
			const newEntries = {};
			for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
			else throw new Error(`Key ${value} not found in enum`);
			return new ZodEnum({
				...def,
				checks: [],
				...normalizeParams(params),
				entries: newEntries
			});
		};
		inst.exclude = (values, params) => {
			const newEntries = { ...def.entries };
			for (const value of values) if (keys.has(value)) delete newEntries[value];
			else throw new Error(`Key ${value} not found in enum`);
			return new ZodEnum({
				...def,
				checks: [],
				...normalizeParams(params),
				entries: newEntries
			});
		};
	});
	function _enum(values, params) {
		return new ZodEnum({
			type: "enum",
			entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
			...normalizeParams(params)
		});
	}
	var ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
		$ZodLiteral.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
		inst.values = new Set(def.values);
		Object.defineProperty(inst, "value", { get() {
			if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
			return def.values[0];
		} });
	});
	function literal(value, params) {
		return new ZodLiteral({
			type: "literal",
			values: Array.isArray(value) ? value : [value],
			...normalizeParams(params)
		});
	}
	var ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
		$ZodTransform.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
		inst._zod.parse = (payload, _ctx) => {
			if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
			payload.addIssue = (issue$1) => {
				if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
				else {
					const _issue = issue$1;
					if (_issue.fatal) _issue.continue = false;
					_issue.code ?? (_issue.code = "custom");
					_issue.input ?? (_issue.input = payload.value);
					_issue.inst ?? (_issue.inst = inst);
					payload.issues.push(issue(_issue));
				}
			};
			const output = def.transform(payload.value, payload);
			if (output instanceof Promise) return output.then((output) => {
				payload.value = output;
				payload.fallback = true;
				return payload;
			});
			payload.value = output;
			payload.fallback = true;
			return payload;
		};
	});
	function transform(fn) {
		return new ZodTransform({
			type: "transform",
			transform: fn
		});
	}
	var ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
		$ZodOptional.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function optional(innerType) {
		return new ZodOptional({
			type: "optional",
			innerType
		});
	}
	var ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
		$ZodExactOptional.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function exactOptional(innerType) {
		return new ZodExactOptional({
			type: "optional",
			innerType
		});
	}
	var ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
		$ZodNullable.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function nullable(innerType) {
		return new ZodNullable({
			type: "nullable",
			innerType
		});
	}
	var ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
		$ZodDefault.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
		inst.removeDefault = inst.unwrap;
	});
	function _default(innerType, defaultValue) {
		return new ZodDefault({
			type: "default",
			innerType,
			get defaultValue() {
				return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
			}
		});
	}
	var ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
		$ZodPrefault.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function prefault(innerType, defaultValue) {
		return new ZodPrefault({
			type: "prefault",
			innerType,
			get defaultValue() {
				return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
			}
		});
	}
	var ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
		$ZodNonOptional.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function nonoptional(innerType, params) {
		return new ZodNonOptional({
			type: "nonoptional",
			innerType,
			...normalizeParams(params)
		});
	}
	var ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
		$ZodCatch.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
		inst.removeCatch = inst.unwrap;
	});
	function _catch(innerType, catchValue) {
		return new ZodCatch({
			type: "catch",
			innerType,
			catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
		});
	}
	var ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
		$ZodPipe.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
		inst.in = def.in;
		inst.out = def.out;
	});
	function pipe(in_, out) {
		return new ZodPipe({
			type: "pipe",
			in: in_,
			out
		});
	}
	var ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
		$ZodReadonly.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function readonly(innerType) {
		return new ZodReadonly({
			type: "readonly",
			innerType
		});
	}
	var ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
		$ZodCustom.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
	});
	function custom(fn, _params) {
		return /* @__PURE__ */ _custom(ZodCustom, fn ?? (() => true), _params);
	}
	function refine(fn, _params = {}) {
		return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
	}
	function superRefine(fn, params) {
		return /* @__PURE__ */ _superRefine(fn, params);
	}
	//#endregion
	//#region src/audio-player/plugins/configValidators.ts
	function validateConfig(schema, config, pluginName) {
		const result = schema.safeParse(config);
		if (result.success) return result.data;
		console.warn(`[Plugin:${pluginName}] Configuration validation failed, falling back to safe defaults.`, result.error);
		const fallbackResult = schema.safeParse({});
		if (fallbackResult.success) return fallbackResult.data;
		return {};
	}
	var WaveformPluginConfigSchema = object({
		name: string().optional().default("waveform"),
		prewarmPeaks: boolean().optional().default(true)
	});
	var SleepTimerPluginConfigSchema = object({
		name: string().optional().default("sleep-timer"),
		label: string().optional().default("Sleep"),
		renderUi: boolean().optional().default(true),
		target: custom().optional(),
		now: custom((val) => typeof val === "function").optional()
	});
	var LyricsPluginConfigSchema = object({
		name: string().optional().default("lyrics"),
		lyrics: string().optional(),
		lines: array(object({
			time: number(),
			text: string()
		})).optional(),
		onLineChange: custom((val) => typeof val === "function").optional(),
		target: custom().optional()
	});
	var KeyboardShortcutPluginConfigSchema = object({
		name: string().optional().default("keyboard-shortcuts"),
		scope: _enum(["root", "document"]).optional().default("root"),
		seekSeconds: number().positive().optional().default(10),
		enableJKL: boolean().optional().default(true),
		enablePlaylistKeys: boolean().optional().default(true)
	});
	var AutoThemePluginConfigSchema = object({
		name: string().optional().default("auto-theme"),
		applyGlow: boolean().optional().default(true),
		applyGradient: boolean().optional().default(true),
		sampleSize: number().positive().optional(),
		quantStep: number().positive().optional(),
		onPaletteChange: custom((val) => typeof val === "function").optional()
	});
	var AutomixPluginConfigSchema = object({
		name: string().optional().default("automix"),
		enabled: boolean().optional().default(true),
		confidenceMin: number().min(0).max(1).optional().default(.1),
		onTransitionChange: custom((val) => typeof val === "function").optional()
	});
	var AnalyticsPluginConfigSchema = object({
		name: string().optional().default("analytics"),
		endpoint: union([string().url(), string().startsWith("/")]).optional(),
		send: custom((val) => typeof val === "function").optional(),
		includeTimeUpdates: boolean().optional().default(false),
		timeUpdateIntervalSeconds: number().positive().optional().default(15)
	});
	//#endregion
	//#region src/audio-player/plugins/AutomixPlugin.ts
	/** Crossfade duration. Conservative fixed value for V1. */
	var AUTOMIX_FADE_MS$1 = 5500;
	/** How far before the (trimmed) end of A deck B starts preloading. */
	var PRELOAD_LEAD_S$1 = 15;
	/** Tracks shorter than this never automix. */
	var MIN_TRACK_S$1 = 25;
	/** Backward currentTime jump beyond this cancels an active fade. */
	var SEEK_BACK_TOLERANCE_S$1 = .75;
	/** Give up on a handoff if the main element never reaches 'playing'. */
	var HANDOFF_TIMEOUT_MS$1 = 6e3;
	/** Re-sync the main element at flip time if it drifted past this. */
	var MAX_FLIP_DRIFT_S$1 = .35;
	/**
	* Page-wide latch: once a browser proves it ignores programmatic element
	* volume (iOS Safari), crossfading is impossible. Automix then leaves
	* playback entirely to the normal end-of-track behavior.
	*/
	var fadeUnsupported$1 = false;
	/**
	* Automix as a lifecycle plugin.
	*
	* One plugin, automatic fallback: it always attempts rich, beat/BPM-aware
	* transitions (the "pro" path) and degrades per track-pair to light-mode
	* silence-trim crossfades whenever rhythm analysis is unavailable, the browser
	* locks element volume, or confidence is below `confidenceMin`.
	*
	* The implementation intentionally mirrors the legacy `useAutomix` hook: the
	* main engine audio element remains deck A/source-of-truth, while this plugin
	* owns one detached deck B only around a transition.
	*/
	var AutomixPlugin = class {
		name;
		context = null;
		enabled;
		onTransitionChange;
		phase = "idle";
		deck = null;
		deckAbort = null;
		preloadedKey = null;
		fadeInterval = null;
		fadeT0 = 0;
		fadeAnchor = 0;
		pendingHandoff = null;
		handoffAbort = null;
		handoffTimer = null;
		failedPair = null;
		prevSourceKey = null;
		transitioning = false;
		confidenceMin;
		plan = null;
		activeFadeMs = AUTOMIX_FADE_MS$1;
		constructor(config = {}) {
			const valid = validateConfig(AutomixPluginConfigSchema, config, "automix");
			this.name = valid.name;
			this.enabled = valid.enabled;
			this.confidenceMin = valid.confidenceMin;
			this.onTransitionChange = valid.onTransitionChange;
		}
		get isTransitioning() {
			return this.transitioning;
		}
		init(playerInstance) {
			this.context = playerInstance;
			this.prevSourceKey = playerInstance.getSourceKey();
			this.analyzeCurrentTrack();
		}
		destroy() {
			this.cancel();
			this.context = null;
			this.prevSourceKey = null;
		}
		updateConfig(config) {
			const nextEnabled = config.enabled ?? this.enabled;
			if (this.enabled && !nextEnabled) this.cancel();
			this.enabled = nextEnabled;
			this.analyzeCurrentTrack();
		}
		onTrackLoad = (track) => {
			const context = this.context;
			if (!context) return;
			const sourceKey = context.getSourceKey();
			if (this.prevSourceKey === null) this.prevSourceKey = sourceKey;
			if (this.prevSourceKey !== sourceKey) {
				this.prevSourceKey = sourceKey;
				const expected = this.pendingHandoff;
				if (expected !== null && this.phase === "handoff" && track && trackKey(track) === expected) this.attachHandoff();
				else if (this.phase !== "idle") this.cancel();
			}
			if (this.enabled && track) this.ensureAnalysis(track);
			if (this.enabled && this.usePro()) {
				const next = context.getNextTrack();
				if (next) this.ensureAnalysis(next);
			}
			this.supervise();
		};
		onPlay = () => {
			this.supervise();
		};
		onPause = () => {
			this.supervise();
		};
		onSeek = (_position) => {
			if (this.phase === "fading") this.cancel();
			else this.supervise();
		};
		onTimeUpdate = (_position) => {
			this.supervise();
		};
		onTrackEnded = () => this.handleTrackEnded();
		/** Legacy controller bridge used by `useAutomix`. */
		handleTrackEnded() {
			if (this.phase === "fading") {
				this.finalizeFade(false);
				return false;
			}
			return this.phase === "handoff";
		}
		analyzeCurrentTrack() {
			if (!this.enabled || !this.context) return;
			const track = this.context.getCurrentTrack();
			if (track) this.ensureAnalysis(track);
			if (this.usePro()) {
				const next = this.context.getNextTrack();
				if (next) this.ensureAnalysis(next);
			}
		}
		/**
		* Whether to attempt rich (beat/BPM-aware) analysis. Always on, except
		* where fades can't run at all (volume-locked browsers), since beat-aware
		* timing is pointless without crossfades. Per-pair confidence still decides
		* whether a given transition uses the rich plan or the light fallback.
		*/
		usePro() {
			return !fadeUnsupported$1;
		}
		ensureAnalysis(track) {
			return this.usePro() ? ensureProTrackAnalysis(track) : ensureTrackAnalysis(track);
		}
		/** Trims from the Pro analysis when available, else the Lite silence scan. */
		effectiveTrims(track) {
			if (this.usePro()) {
				const analysis = getTrackAnalysis(track);
				if (analysis) return {
					trimStartMs: analysis.trimStartMs ?? 0,
					trimEndMs: analysis.trimEndMs ?? 0
				};
			}
			return getTrackTrims(track);
		}
		/**
		* Where deck B should be parked before the fade, in milliseconds. The
		* beat-aligned entry point applies only while a confident pair plan is
		* active; any fallback parks at the silence trim start exactly like Lite,
		* so low-confidence beat guesses never skip the next track's intro.
		*/
		deckStartMs(next) {
			if (this.usePro()) {
				if (this.plan) return this.plan.deckStartMsInB;
				const analysis = getTrackAnalysis(next);
				if (analysis) return analysis.trimStartMs ?? 0;
			}
			return getTrackTrims(next)?.trimStartMs ?? 0;
		}
		setTransitioning(next) {
			if (this.transitioning === next) return;
			this.transitioning = next;
			this.onTransitionChange?.(next);
		}
		stopRamp() {
			if (this.fadeInterval !== null) {
				clearInterval(this.fadeInterval);
				this.fadeInterval = null;
			}
		}
		releaseDeck() {
			this.deckAbort?.abort();
			this.deckAbort = null;
			this.preloadedKey = null;
			this.plan = null;
			this.activeFadeMs = AUTOMIX_FADE_MS$1;
			const deck = this.deck;
			this.deck = null;
			if (deck) try {
				deck.pause();
				deck.removeAttribute("src");
				deck.load();
			} catch {}
		}
		clearHandoff() {
			this.pendingHandoff = null;
			this.handoffAbort?.abort();
			this.handoffAbort = null;
			if (this.handoffTimer !== null) {
				clearTimeout(this.handoffTimer);
				this.handoffTimer = null;
			}
		}
		/** Abort any in-flight transition and restore normal playback audio. */
		cancel = () => {
			const wasAudible = this.phase === "fading" || this.phase === "handoff";
			this.stopRamp();
			this.clearHandoff();
			this.releaseDeck();
			this.phase = "idle";
			this.setTransitioning(false);
			if (wasAudible && this.context) {
				const main = this.context.getAudioElement();
				const volume = this.context.getEngine().volume;
				if (main) try {
					main.volume = volume;
				} catch {}
			}
		};
		/**
		* The fade is over (ramp completed, or A reached its natural end first).
		* Mark the upcoming source change as ours; optionally trigger it.
		*/
		finalizeFade(advance) {
			this.stopRamp();
			this.pendingHandoff = this.preloadedKey;
			this.phase = "handoff";
			if (advance) this.context?.requestAdvance?.();
		}
		/** Wire deck B for the resolved next track and park it at its trim start. */
		startPreload(next) {
			if (typeof Audio === "undefined" || !this.context) return;
			const src = getPrimaryTrackSource(next);
			if (!src) return;
			const key = trackKey(next);
			const deck = new Audio();
			deck.preload = "auto";
			try {
				deck.volume = 0;
			} catch {}
			deck.src = src;
			const ac = new AbortController();
			const applyTrimStart = () => {
				const startMs = this.deckStartMs(next);
				if (startMs <= 0) return;
				if (deck.paused && deck.readyState >= 1) try {
					deck.currentTime = startMs / 1e3;
				} catch {}
			};
			deck.addEventListener("loadedmetadata", applyTrimStart, { signal: ac.signal });
			deck.addEventListener("error", () => {
				this.failedPair = `${this.context?.getSourceKey() ?? ""}->${key}`;
				if (this.phase === "fading" || this.phase === "handoff") this.cancel();
				else if (this.phase === "preloading") {
					this.releaseDeck();
					this.phase = "idle";
				}
			}, { signal: ac.signal });
			try {
				deck.load();
			} catch {
				return;
			}
			this.deckAbort = ac;
			this.deck = deck;
			this.preloadedKey = key;
			this.phase = "preloading";
			this.ensureAnalysis(next).then(applyTrimStart);
		}
		/**
		* Equal-power ramp driven by wall-clock setInterval (keeps progressing in
		* throttled background tabs, unlike rAF). Re-reads the user volume every
		* tick so a mid-fade volume change re-targets instead of fighting.
		*/
		runRamp() {
			const tick = () => {
				if (this.phase !== "fading") {
					this.stopRamp();
					return;
				}
				const context = this.context;
				const main = context?.getAudioElement();
				const deck = this.deck;
				if (!context || !main || !deck) {
					this.cancel();
					return;
				}
				const t = Math.min(1, (performance.now() - this.fadeT0) / this.activeFadeMs);
				const vol = context.getEngine().volume;
				const mainTarget = Math.cos(t * Math.PI / 2) * vol;
				const deckTarget = Math.sin(t * Math.PI / 2) * vol;
				try {
					main.volume = mainTarget;
					deck.volume = deckTarget;
				} catch {
					fadeUnsupported$1 = true;
					this.cancel();
					return;
				}
				if (vol > .1 && Math.abs(main.volume - mainTarget) > .05) {
					fadeUnsupported$1 = true;
					this.cancel();
					return;
				}
				if (t >= 1) {
					this.stopRamp();
					this.finalizeFade(true);
				}
			};
			this.stopRamp();
			this.fadeInterval = setInterval(tick, 33);
		}
		startFade() {
			const context = this.context;
			const main = context?.getAudioElement();
			const deck = this.deck;
			if (!context || !main || !deck) return;
			if (fadeUnsupported$1 || context.getEngine().volumeUnsupported) return;
			if (deck.readyState < 2) return;
			try {
				deck.volume = 0;
				if (deck.volume > .001) {
					fadeUnsupported$1 = true;
					return;
				}
				deck.muted = main.muted;
			} catch {
				fadeUnsupported$1 = true;
				return;
			}
			let playPromise;
			try {
				playPromise = deck.play();
			} catch {
				this.failedPair = `${context.getSourceKey()}->${this.preloadedKey}`;
				this.releaseDeck();
				this.phase = "idle";
				return;
			}
			this.phase = "fading";
			this.setTransitioning(true);
			this.activeFadeMs = this.plan?.fadeMs ?? 5500;
			this.fadeT0 = performance.now();
			this.fadeAnchor = context.getEngine().currentTime;
			playPromise.then(() => {
				if (this.phase === "fading") this.runRamp();
			}).catch(() => {
				if (this.phase === "fading") {
					this.failedPair = `${this.context?.getSourceKey() ?? ""}->${this.preloadedKey}`;
					this.cancel();
				}
			});
		}
		/**
		* After requestAdvance, the host swaps sources and the engine reloads the
		* main element with B's URL. Sync it to deck B's position and flip the
		* audible output back to the main element on its first 'playing'.
		*/
		attachHandoff() {
			this.pendingHandoff = null;
			const main = this.context?.getAudioElement();
			const deck = this.deck;
			if (!main || !deck) {
				this.cancel();
				return;
			}
			const ac = new AbortController();
			this.handoffAbort = ac;
			const syncTime = () => {
				try {
					main.currentTime = deck.currentTime;
				} catch {}
			};
			if (main.readyState >= 1) syncTime();
			else main.addEventListener("loadedmetadata", syncTime, {
				signal: ac.signal,
				once: true
			});
			main.addEventListener("playing", () => {
				try {
					if (Math.abs(deck.currentTime - main.currentTime) > MAX_FLIP_DRIFT_S$1) syncTime();
					main.volume = this.context?.getEngine().volume ?? main.volume;
				} catch {}
				this.clearHandoff();
				this.releaseDeck();
				this.phase = "idle";
				this.setTransitioning(false);
			}, {
				signal: ac.signal,
				once: true
			});
			main.addEventListener("error", this.cancel, {
				signal: ac.signal,
				once: true
			});
			this.handoffTimer = setTimeout(this.cancel, HANDOFF_TIMEOUT_MS$1);
		}
		supervise() {
			if (!this.enabled || !this.context) return;
			const context = this.context;
			const engine = context.getEngine();
			const phase = this.phase;
			const currentTrack = context.getCurrentTrack();
			const nextTrack = context.getNextTrack();
			const sourceKey = context.getSourceKey();
			if (phase === "fading") {
				if (!engine.isPlaying || engine.isSeeking || engine.hasError) {
					this.cancel();
					return;
				}
				if (engine.currentTime < this.fadeAnchor - SEEK_BACK_TOLERANCE_S$1) {
					this.cancel();
					return;
				}
				if (!nextTrack || trackKey(nextTrack) !== this.preloadedKey) this.cancel();
				return;
			}
			if (phase === "handoff") return;
			if (!currentTrack || !nextTrack) {
				if (phase === "preloading") {
					this.releaseDeck();
					this.phase = "idle";
				}
				return;
			}
			if (!engine.isPlaying || engine.isSeeking || engine.hasError) return;
			if (engine.duration < MIN_TRACK_S$1) return;
			if (!context.getAudioElement()) return;
			const nextKey = trackKey(nextTrack);
			if (this.failedPair === `${sourceKey}->${nextKey}`) return;
			const trims = this.effectiveTrims(currentTrack);
			const effectiveEnd = engine.duration - (trims ? trims.trimEndMs / 1e3 : 0);
			let plan = null;
			if (this.usePro()) {
				this.ensureAnalysis(nextTrack);
				const outgoing = getTrackAnalysis(currentTrack);
				const incoming = getTrackAnalysis(nextTrack);
				if (outgoing && incoming) {
					const candidate = planTransition(outgoing, incoming, engine.duration * 1e3, AUTOMIX_FADE_MS$1, this.confidenceMin);
					if (candidate.usedPro) plan = candidate;
				}
			}
			this.plan = plan;
			const fadeMs = plan?.fadeMs ?? 5500;
			const fadeStartAt = Math.max(plan ? plan.fadeStartMsInA / 1e3 : effectiveEnd - fadeMs / 1e3, engine.duration * .5);
			if (phase === "idle") {
				const leadS = Math.max(PRELOAD_LEAD_S$1, fadeMs / 1e3 + 5);
				if (engine.currentTime >= effectiveEnd - leadS) this.startPreload(nextTrack);
				return;
			}
			if (this.preloadedKey !== nextKey) {
				this.releaseDeck();
				this.phase = "idle";
				return;
			}
			if (engine.currentTime >= fadeStartAt) this.startFade();
		}
	};
	/**
	* Create the Automix plugin. BPM/beat/energy analysis steers fade timing and
	* length when available; any pair without trustworthy analysis falls back to
	* light-mode silence-trim crossfades automatically.
	*/
	function createAutomixPlugin(config) {
		return new AutomixPlugin(config);
	}
	//#endregion
	//#region src/audio-player/plugins/automixIntegration.ts
	/**
	* Canonical plugin name for Automix. The internal controller and the public
	* `createAutomixPlugin()` both use this, so the player can detect an externally
	* supplied Automix plugin and avoid running a second one beside it.
	*/
	var AUTOMIX_PLUGIN_NAME = "automix";
	/**
	* Whether a plugin list already contains an Automix controller.
	*
	* Detect by type first so any `AutomixPlugin` instance counts regardless of its
	* `name` — the built-in plugin registry, for example, registers Automix as
	* `"registry-automix"`. The canonical-name check is a defensive fallback for
	* automix-equivalent plugins that aren't `AutomixPlugin` instances.
	*/
	function hasAutomixPlugin(plugins) {
		return plugins.some((plugin) => plugin instanceof AutomixPlugin || plugin.name === "automix");
	}
	/**
	* Merge the player's internal Automix plugin into the consumer's plugin list,
	* but only when the consumer hasn't already supplied their own Automix plugin.
	*
	* This is what guarantees a *single* Automix controller: the `automix` prop/menu
	* drives the internal plugin, and an explicitly passed external Automix plugin
	* takes precedence (the internal one is omitted) so the two transition systems
	* can never both run and double-advance the queue.
	*/
	function withInternalAutomix(externalPlugins, internal) {
		return hasAutomixPlugin(externalPlugins) ? externalPlugins : [...externalPlugins, internal];
	}
	//#endregion
	//#region src/audio-player/core/plugins/PluginErrorBoundary.ts
	/**
	* Plugin Error Boundary Pattern
	* 
	* Provides structured error handling for plugins with:
	* - Custom error classes with plugin context
	* - Error handler interface for host applications
	* - Graceful degradation strategies
	* - Recovery mechanisms
	*/
	var PluginError = class PluginError extends Error {
		pluginName;
		operation;
		cause;
		recoverable;
		timestamp;
		stack;
		constructor(pluginName, operation, cause, recoverable) {
			const message = `Plugin "${pluginName}" failed during ${operation}`;
			super(message);
			this.pluginName = pluginName;
			this.operation = operation;
			this.cause = cause;
			this.recoverable = recoverable;
			this.name = "PluginError";
			this.timestamp = /* @__PURE__ */ new Date();
			Object.setPrototypeOf(this, PluginError.prototype);
		}
		/**
		* Create a PluginError from a caught error
		*/
		static fromError(pluginName, operation, error, recoverable = true) {
			if (error instanceof PluginError) return new PluginError(pluginName, operation, error.cause, recoverable);
			return new PluginError(pluginName, operation, error, recoverable);
		}
		/**
		* Create a non-recoverable PluginError
		*/
		static fatal(pluginName, operation, cause) {
			return new PluginError(pluginName, operation, cause, false);
		}
		/**
		* Create a recoverable PluginError (warning-level)
		*/
		static warning(pluginName, operation, cause) {
			return new PluginError(pluginName, operation, cause, true);
		}
		/**
		* Get a sanitized error object for logging/serialization
		*/
		toJSON() {
			return {
				name: this.name,
				message: this.message,
				pluginName: this.pluginName,
				operation: this.operation,
				recoverable: this.recoverable,
				timestamp: this.timestamp.toISOString(),
				cause: this.cause instanceof PluginError ? this.cause.toJSON() : this.cause instanceof Error ? {
					name: this.cause.name,
					message: this.cause.message,
					stack: this.cause.stack
				} : this.cause,
				stack: this.stack
			};
		}
	};
	/**
	* Default error handler implementation - logs to console
	*/
	var DefaultPluginErrorHandler = class {
		failureCounts = /* @__PURE__ */ new Map();
		maxFailuresBeforeDisable;
		logger;
		constructor(maxFailuresBeforeDisable = 3, logger = console) {
			this.maxFailuresBeforeDisable = maxFailuresBeforeDisable;
			this.logger = logger;
		}
		onError(info) {
			const { error, severity, context } = info;
			const { pluginName, operation, recoverable, cause } = error;
			const count = (this.failureCounts.get(pluginName) || 0) + 1;
			this.failureCounts.set(pluginName, count);
			const logData = {
				plugin: pluginName,
				operation,
				severity,
				recoverable,
				failureCount: count,
				cause: cause instanceof Error ? {
					name: cause.name,
					message: cause.message,
					stack: cause.stack
				} : cause,
				context,
				timestamp: error.timestamp.toISOString()
			};
			if (severity === "error") this.logger.error("[PluginError]", JSON.stringify(logData, null, 2));
			else if (severity === "warning") this.logger.warn("[PluginWarning]", JSON.stringify(logData, null, 2));
			else this.logger.info("[PluginInfo]", JSON.stringify(logData, null, 2));
			if (!recoverable || count >= this.maxFailuresBeforeDisable) return {
				action: "disable_plugin",
				suppressLogging: false,
				userMessage: `Plugin "${pluginName}" has been disabled due to repeated failures.`
			};
			if (operation.startsWith("hook:")) return {
				action: "skip_hook",
				suppressLogging: false
			};
			if (operation.startsWith("init:")) return {
				action: "disable_plugin",
				suppressLogging: false,
				userMessage: `Plugin "${pluginName}" failed to initialize and has been disabled.`
			};
			return {
				action: "fallback",
				suppressLogging: false
			};
		}
		onWarning(pluginName, message, context) {
			this.logger.warn(`[PluginWarning] ${pluginName}: ${message}`, context ?? "");
		}
		onPluginDisabled(pluginName, failureCount) {
			this.logger.error(`[PluginError] Plugin "${pluginName}" disabled after ${failureCount} failures`);
		}
		onPluginRecovered(pluginName, previousAction) {
			this.logger.info(`[PluginRecovery] Plugin "${pluginName}" recovered after ${previousAction}`);
			this.failureCounts.delete(pluginName);
		}
		/**
		* Get the failure count for a plugin
		*/
		getFailureCount(pluginName) {
			return this.failureCounts.get(pluginName) || 0;
		}
		/**
		* Reset the failure count for a plugin
		*/
		resetFailureCount(pluginName) {
			this.failureCounts.delete(pluginName);
		}
	};
	/**
	* Error boundary that wraps plugin operations with structured error handling
	*/
	var PluginErrorBoundary = class {
		handler;
		pluginName;
		isDisabled = false;
		constructor(pluginName, handler) {
			this.pluginName = pluginName;
			this.handler = handler;
		}
		getHandler() {
			return this.handler;
		}
		getPluginName() {
			return this.pluginName;
		}
		isPluginDisabled() {
			return this.isDisabled;
		}
		async execute(operation, fn, options = {}) {
			if (this.isDisabled) throw new PluginError(this.pluginName, operation, /* @__PURE__ */ new Error("Plugin is disabled"), false);
			const { recoverable = true, severity = "error", context, fallback } = options;
			try {
				return await fn();
			} catch (error) {
				const pluginError = PluginError.fromError(this.pluginName, operation, error, recoverable);
				const info = {
					error: pluginError,
					severity,
					context
				};
				const result = await this.handler.onError(info);
				switch (result.action) {
					case "disable_plugin":
						this.isDisabled = true;
						await this.handler.onPluginDisabled(this.pluginName, this.getFailureCount());
						if (fallback !== void 0) return fallback;
						throw pluginError;
					case "skip_hook": return fallback;
					case "fallback":
						if (fallback !== void 0) return fallback;
						throw pluginError;
					case "retry_operation": {
						const delay = result.retryDelayMs ?? 1e3;
						await new Promise((resolve) => setTimeout(resolve, delay));
						return this.execute(operation, fn, options);
					}
					case "reset_plugin": throw pluginError;
					default: throw pluginError;
				}
			}
		}
		executeSync(operation, fn, options = {}) {
			if (this.isDisabled) throw new PluginError(this.pluginName, operation, /* @__PURE__ */ new Error("Plugin is disabled"), false);
			const { recoverable = true, severity = "error", context, fallback } = options;
			try {
				return fn();
			} catch (error) {
				const pluginError = PluginError.fromError(this.pluginName, operation, error, recoverable);
				const info = {
					error: pluginError,
					severity,
					context
				};
				const handlerResult = this.handler.onError(info);
				if (handlerResult instanceof Promise) {
					handlerResult.then((result) => {
						if (result.action === "disable_plugin") {
							this.isDisabled = true;
							Promise.resolve(this.handler.onPluginDisabled(this.pluginName, this.getFailureCount())).catch(() => {});
						}
					}).catch(() => {});
					if (!recoverable) throw pluginError;
					if (fallback !== void 0) return fallback;
					throw pluginError;
				}
				switch (handlerResult.action) {
					case "disable_plugin":
						this.isDisabled = true;
						Promise.resolve(this.handler.onPluginDisabled(this.pluginName, this.getFailureCount())).catch(() => {});
						if (fallback !== void 0) return fallback;
						throw pluginError;
					case "skip_hook": return fallback;
					case "fallback":
						if (fallback !== void 0) return fallback;
						throw pluginError;
					default: throw pluginError;
				}
			}
		}
		warn(message, context) {
			this.handler.onWarning(this.pluginName, message, context);
		}
		enable() {
			this.isDisabled = false;
		}
		disable() {
			this.isDisabled = true;
		}
		reset() {
			this.isDisabled = false;
			if (this.handler instanceof DefaultPluginErrorHandler) this.handler.resetFailureCount(this.pluginName);
			else if (typeof this.handler.resetFailureCount === "function") this.handler.resetFailureCount(this.pluginName);
		}
		/**
		* Get failure count for this plugin from the handler (if supported)
		*/
		getFailureCount() {
			if (this.handler instanceof DefaultPluginErrorHandler) return this.handler.getFailureCount(this.pluginName);
			if (typeof this.handler.getFailureCount === "function") return this.handler.getFailureCount(this.pluginName);
			return 0;
		}
	};
	/**
	* Factory for creating plugin error boundaries with a shared handler
	*/
	var PluginErrorBoundaryFactory = class {
		handler;
		constructor(handler) {
			this.handler = handler ?? new DefaultPluginErrorHandler();
		}
		createBoundary(pluginName) {
			return new PluginErrorBoundary(pluginName, this.handler);
		}
		getHandler() {
			return this.handler;
		}
	};
	/**
	* Global error boundary factory instance (can be replaced by host app)
	*/
	var globalErrorBoundaryFactory = new PluginErrorBoundaryFactory();
	/**
	* Set a custom error handler for all plugins
	* Call this before initializing any plugins
	*/
	function setGlobalErrorHandler(handler) {
		globalErrorBoundaryFactory = new PluginErrorBoundaryFactory(handler);
	}
	/**
	* Get the current global error boundary factory
	*/
	function getGlobalErrorBoundaryFactory() {
		return globalErrorBoundaryFactory;
	}
	/**
	* Create an error boundary for a specific plugin using the global handler
	*/
	function createPluginErrorBoundary(pluginName) {
		return globalErrorBoundaryFactory.createBoundary(pluginName);
	}
	/**
	* Graceful degradation strategies for common plugin operations
	*/
	var GracefulDegradation = {
		forInit: (defaultValue) => defaultValue,
		forHook: (defaultValue) => defaultValue,
		forTrackLoad: (track) => track,
		forPlay: () => void 0,
		forPause: () => void 0,
		forSeek: (position) => position,
		forTimeUpdate: (position) => position,
		forTrackEnded: () => false,
		forDestroy: () => void 0
	};
	/**
	* Helper to wrap a plugin with error boundary protection.
	* Proxies method calls through the error boundary for structured error handling.
	*/
	function withErrorBoundary(plugin, boundary) {
		const wrapped = { ...plugin };
		wrapped._errorBoundary = boundary;
		return new Proxy(wrapped, { get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value !== "function" || prop === "_errorBoundary" || prop === "constructor") return value;
			return function(...args) {
				const fn = value.bind(target);
				const operation = `method:${String(prop)}`;
				try {
					const result = fn(...args);
					if (result instanceof Promise || result && typeof result.then === "function") return boundary.execute(operation, () => result);
					return result;
				} catch (error) {
					return boundary.executeSync(operation, () => {
						throw error;
					});
				}
			};
		} });
	}
	/**
	* Type guard to check if an error is a PluginError
	*/
	function isPluginError(error) {
		return error instanceof PluginError;
	}
	//#endregion
	//#region src/audio-player/core/plugins/PluginDebugger.ts
	var PluginDebugger = class {
		debugMode = false;
		hooks = /* @__PURE__ */ new Map();
		constructor() {
			if (typeof window !== "undefined") {
				if (window.AUDIO_PLAYER_DEBUG === "1" || window.AUDIO_PLAYER_DEBUG === 1 || false) this.debugMode = true;
			}
		}
		measure(plugin, hook, fn) {
			if (!this.debugMode) return fn();
			const start = performance.now();
			try {
				return fn();
			} finally {
				const duration = performance.now() - start;
				this.hooks.set(`${plugin}:${hook}`, duration);
				console.log(`[Plugin:${plugin}] ${hook} took ${duration.toFixed(2)}ms`);
			}
		}
		async measureAsync(plugin, hook, fn) {
			if (!this.debugMode) return fn();
			const start = performance.now();
			try {
				return await fn();
			} finally {
				const duration = performance.now() - start;
				this.hooks.set(`${plugin}:${hook}`, duration);
				console.log(`[Plugin:${plugin}] ${hook} took ${duration.toFixed(2)}ms`);
			}
		}
		getMemoryUsage() {
			if (typeof performance !== "undefined" && "memory" in performance) return performance.memory.usedJSHeapSize;
		}
	};
	//#endregion
	//#region src/audio-player/core/plugins/PluginManager.ts
	/** Register plugins and safely dispatch player lifecycle hooks. */
	var PluginManager = class {
		plugins = /* @__PURE__ */ new Map();
		context;
		errorBoundaryFactory;
		defaultOptions;
		debugger;
		constructor(context, options = {}) {
			this.context = context;
			this.defaultOptions = {
				errorHandler: options.errorHandler ?? new DefaultPluginErrorHandler(options.maxFailuresBeforeDisable),
				maxFailuresBeforeDisable: options.maxFailuresBeforeDisable ?? 3
			};
			this.errorBoundaryFactory = new PluginErrorBoundaryFactory(this.defaultOptions.errorHandler);
			this.debugger = new PluginDebugger();
		}
		setContext(context) {
			this.context = context;
		}
		/**
		* Set a custom error handler for future plugin registrations
		* Note: Already registered plugins keep their original error boundaries
		*/
		setErrorHandler(handler) {
			this.defaultOptions.errorHandler = handler;
			this.errorBoundaryFactory = new PluginErrorBoundaryFactory(handler);
		}
		register(plugin) {
			if (!plugin?.name) {
				this.handleError("register", /* @__PURE__ */ new Error("Plugin is missing a name"), "error");
				return;
			}
			const existing = this.plugins.get(plugin.name);
			if (existing?.plugin === plugin) return;
			if (existing) this.unregister(plugin.name);
			const errorBoundary = this.errorBoundaryFactory.createBoundary(plugin.name);
			let cleanup;
			try {
				const result = errorBoundary.executeSync("init", () => plugin.init(this.context), {
					recoverable: false,
					severity: "error",
					context: { pluginName: plugin.name }
				});
				if (typeof result === "function") cleanup = result;
				this.plugins.set(plugin.name, {
					plugin,
					cleanup,
					errorBoundary
				});
			} catch (error) {
				try {
					errorBoundary.executeSync("destroy", () => plugin.destroy(), {
						recoverable: false,
						severity: "error",
						context: { pluginName: plugin.name }
					});
				} catch {}
			}
		}
		unregister(name) {
			const registered = this.plugins.get(name);
			if (!registered) return;
			this.plugins.delete(name);
			try {
				registered.cleanup?.();
			} catch (error) {
				this.handleError(`cleanup:${name}`, error, "warning", { pluginName: name });
			}
			try {
				registered.plugin.destroy();
			} catch (error) {
				this.handleError(`destroy:${name}`, error, "warning", { pluginName: name });
			}
		}
		replace(nextPlugins) {
			const nextNames = new Set(nextPlugins.map((plugin) => plugin.name));
			for (const name of this.plugins.keys()) if (!nextNames.has(name)) this.unregister(name);
			for (const plugin of nextPlugins) this.register(plugin);
		}
		clear() {
			for (const name of [...this.plugins.keys()]) this.unregister(name);
		}
		has(name) {
			return this.plugins.has(name);
		}
		list() {
			return [...this.plugins.values()].map(({ plugin }) => plugin);
		}
		/**
		* Get health and debug status for all plugins
		*/
		getDebugStatus() {
			return [...this.plugins.values()].map(({ plugin, errorBoundary }) => ({
				name: plugin.name,
				initialized: true,
				lastHookCalled: null,
				lastHookTime: null,
				errorCount: errorBoundary.getFailureCount(),
				memoryUsage: this.debugger.getMemoryUsage()
			}));
		}
		/**
		* Get the error boundary for a specific plugin
		*/
		getErrorBoundary(pluginName) {
			return this.plugins.get(pluginName)?.errorBoundary;
		}
		/**
		* Check if a plugin is disabled due to errors
		*/
		isPluginDisabled(pluginName) {
			return this.plugins.get(pluginName)?.errorBoundary.isPluginDisabled() ?? false;
		}
		/**
		* Manually re-enable a disabled plugin
		*/
		enablePlugin(pluginName) {
			const boundary = this.plugins.get(pluginName)?.errorBoundary;
			if (boundary) {
				boundary.enable();
				return true;
			}
			return false;
		}
		trigger(hook, ...args) {
			const results = [];
			for (const { plugin, errorBoundary } of this.plugins.values()) {
				const hookFn = plugin[hook];
				if (typeof hookFn !== "function") continue;
				try {
					const result = errorBoundary.executeSync(`hook:${hook}`, () => this.debugger.measure(plugin.name, hook, () => hookFn.call(plugin, ...args)), {
						recoverable: true,
						severity: "warning",
						fallback: void 0,
						context: {
							hook,
							pluginName: plugin.name
						}
					});
					if (result !== void 0) results.push(result);
				} catch {
					continue;
				}
			}
			return results;
		}
		triggerUntilHandled(hook, ...args) {
			for (const { plugin, errorBoundary } of this.plugins.values()) {
				const hookFn = plugin[hook];
				if (typeof hookFn !== "function") continue;
				try {
					if (errorBoundary.executeSync(`hook:${hook}`, () => this.debugger.measure(plugin.name, hook, () => hookFn.call(plugin, ...args) === true), {
						recoverable: true,
						severity: "warning",
						fallback: false,
						context: {
							hook,
							pluginName: plugin.name
						}
					})) return true;
				} catch {
					continue;
				}
			}
			return false;
		}
		/**
		* Handle plugin errors with structured error handling
		*/
		handleError(scope, error, severity = "error", context) {
			const pluginName = context?.pluginName ?? scope.split(":")[1] ?? "unknown";
			const pluginError = isPluginError(error) ? error : PluginError.fromError(pluginName, scope, error, severity !== "error");
			const boundary = this.plugins.get(pluginName)?.errorBoundary;
			const handler = boundary ? this.getBoundaryHandler(boundary) : this.defaultOptions.errorHandler;
			const info = {
				error: pluginError,
				severity,
				context
			};
			Promise.resolve(handler.onError(info)).then((result) => {
				if (result.action === "disable_plugin" && boundary) {
					boundary.disable();
					const failureCount = boundary.getFailureCount();
					Promise.resolve(handler.onPluginDisabled(pluginName, failureCount)).catch(() => {});
				}
			}).catch(() => {
				if (severity === "error") console.error("[PluginManager] Error handler threw:", pluginError.message);
			});
		}
		getBoundaryHandler(boundary) {
			return boundary.getHandler();
		}
	};
	//#endregion
	//#region src/audio-player/core/plugins/usePluginManager.ts
	/** React bridge that keeps a PluginManager stable while plugin arrays change. */
	function usePluginManager(plugins, context, options) {
		const managerRef = (0, react.useRef)(null);
		const memoizedOptions = (0, react.useMemo)(() => options, [options?.errorHandler, options?.maxFailuresBeforeDisable]);
		if (managerRef.current === null) managerRef.current = new PluginManager(context, memoizedOptions);
		else managerRef.current.setContext(context);
		const manager = managerRef.current;
		const prevPluginsRef = (0, react.useRef)(null);
		const churnWarnedRef = (0, react.useRef)(false);
		const prev = prevPluginsRef.current;
		if (prev !== null && prev !== plugins && !churnWarnedRef.current && typeof console !== "undefined" && sameNameSet(prev, plugins)) {
			churnWarnedRef.current = true;
			console.warn("[AudioPlayer] The `plugins` array changed identity but contains the same plugin names. Pass a stable reference (e.g. wrap it in useMemo) so plugins are not destroyed and recreated on every render.");
		}
		prevPluginsRef.current = plugins;
		(0, react.useEffect)(() => {
			manager.replace(plugins);
		}, [manager, plugins]);
		(0, react.useEffect)(() => () => manager.clear(), [manager]);
		return manager;
	}
	/** Whether two plugin arrays contain exactly the same multiset of plugin names. */
	function sameNameSet(a, b) {
		if (a.length !== b.length) return false;
		const namesA = a.map((plugin) => plugin.name).sort();
		const namesB = b.map((plugin) => plugin.name).sort();
		return namesA.every((name, i) => name === namesB[i]);
	}
	//#endregion
	//#region src/audio-player/core/audio/AudioSpriteEngine.ts
	function getAudioContextCtor() {
		if (typeof window === "undefined") return void 0;
		return window.AudioContext ?? window.webkitAudioContext;
	}
	function clamp01$1(value) {
		if (!Number.isFinite(value)) return 1;
		return Math.max(0, Math.min(1, value));
	}
	function positiveSeconds(value) {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, value);
	}
	var nextInstanceId = 0;
	function createInstanceId() {
		nextInstanceId += 1;
		return `sap-sprite-${nextInstanceId}`;
	}
	/**
	* SAP-native audio sprite engine for short Vault Radio / plugin-layer sounds.
	*
	* This intentionally does not replace the player's track playback backend. It
	* decodes one declared pack and lets trusted SAP plugin surfaces trigger named
	* slices through Web Audio (`AudioBufferSourceNode.start(when, offset, duration)`).
	*/
	var AudioSpriteEngine = class {
		ctx = null;
		output = null;
		manifest = null;
		buffer = null;
		loadAbort = null;
		loadPromise = null;
		instances = /* @__PURE__ */ new Map();
		generation = 0;
		/**
		* Desired master gain for the whole sprite layer (the "ambience volume"
		* control points here). Stored so it survives context recreation, since
		* `ensureContext` builds a fresh `output` GainNode at unity otherwise.
		*/
		masterVolume = 1;
		ensureContext() {
			if (this.ctx && this.ctx.state !== "closed") return this.ctx;
			const Ctor = getAudioContextCtor();
			if (!Ctor) throw new Error("Web Audio API unavailable for SAP sprites.");
			this.ctx = new Ctor();
			this.output = this.ctx.createGain();
			this.output.gain.value = this.masterVolume;
			this.output.connect(this.ctx.destination);
			return this.ctx;
		}
		/**
		* Set the master output level (0..1) for the whole sprite layer. Persisted
		* across context recreation so a later (re)load doesn't silently reset it.
		*/
		setMasterVolume(value) {
			this.masterVolume = clamp01$1(value);
			if (this.output && this.ctx) this.output.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
		}
		getMasterVolume() {
			return this.masterVolume;
		}
		async load(manifest) {
			const src = manifest.src.trim();
			if (!src) throw new Error("Audio sprite manifest requires a src URL.");
			this.generation += 1;
			const generation = this.generation;
			this.loadAbort?.abort();
			this.stopAll();
			this.manifest = {
				...manifest,
				src
			};
			this.buffer = null;
			const abort = new AbortController();
			this.loadAbort = abort;
			const work = (async () => {
				const response = await fetch(src, { signal: abort.signal });
				if (!response.ok) throw new Error(`Audio sprite pack failed to load: ${response.status}`);
				const data = await response.arrayBuffer();
				const decoded = await this.ensureContext().decodeAudioData(data);
				if (generation !== this.generation) return;
				this.buffer = decoded;
			})();
			this.loadPromise = work.then(() => {}, () => {});
			try {
				await work;
			} finally {
				if (this.loadAbort === abort) this.loadAbort = null;
			}
		}
		async ready() {
			let pending = this.loadPromise;
			while (pending) {
				await pending;
				if (pending === this.loadPromise) break;
				pending = this.loadPromise;
			}
		}
		play(clipName, options = {}) {
			const manifest = this.manifest;
			const buffer = this.buffer;
			if (!manifest || !buffer) return null;
			const clip = manifest.clips[clipName];
			if (!clip) return null;
			const ctx = this.ensureContext();
			ctx.resume().catch(() => {});
			const output = this.output;
			if (!output) return null;
			const offset = Math.min(positiveSeconds(clip.offset), buffer.duration);
			const duration = Math.min(positiveSeconds(clip.duration), Math.max(0, buffer.duration - offset));
			if (duration <= 0) return null;
			const loop = options.loop ?? clip.loop ?? false;
			const volume = clamp01$1(options.volume ?? clip.volume ?? 1);
			const id = createInstanceId();
			const source = ctx.createBufferSource();
			const gain = ctx.createGain();
			source.buffer = buffer;
			source.loop = loop;
			if (loop) {
				source.loopStart = offset;
				source.loopEnd = offset + duration;
			}
			gain.gain.setValueAtTime(volume, ctx.currentTime);
			source.connect(gain);
			gain.connect(output);
			const instance = {
				id,
				clipName,
				loop,
				volume,
				source,
				gain
			};
			this.instances.set(id, instance);
			source.onended = () => {
				if (this.instances.get(id) === instance) this.removeInstance(id);
			};
			source.start(0, offset, loop ? void 0 : duration);
			return id;
		}
		stop(id) {
			const instance = this.instances.get(id);
			if (!instance) return;
			instance.source.onended = null;
			try {
				instance.source.stop();
			} catch {}
			this.removeInstance(id);
		}
		fade(id, toVolume, durationMs) {
			const instance = this.instances.get(id);
			if (!instance || !this.ctx) return;
			this.clearFadeStop(instance);
			const gain = instance.gain.gain;
			const now = this.ctx.currentTime;
			const duration = Math.max(0, durationMs) / 1e3;
			const target = clamp01$1(toVolume);
			gain.cancelScheduledValues(now);
			gain.setValueAtTime(gain.value, now);
			gain.linearRampToValueAtTime(target, now + duration);
			instance.volume = target;
		}
		/**
		* Ramp an instance to silence and then stop it. Unlike `fade(id, 0, ms)`,
		* this releases the underlying source when the ramp completes — essential
		* for looping clips, which otherwise keep running silently forever (a leak
		* that accumulates one node per ambience/mood crossfade).
		*/
		fadeOut(id, durationMs) {
			const instance = this.instances.get(id);
			if (!instance) return;
			this.fade(id, 0, durationMs);
			instance.fadeStopTimer = setTimeout(() => {
				if (this.instances.get(id) === instance) this.stop(id);
			}, Math.max(0, durationMs));
		}
		clearFadeStop(instance) {
			if (instance.fadeStopTimer !== void 0) {
				clearTimeout(instance.fadeStopTimer);
				instance.fadeStopTimer = void 0;
			}
		}
		stopAll() {
			for (const id of [...this.instances.keys()]) this.stop(id);
		}
		getActiveInstances() {
			return [...this.instances.values()].map(({ id, clipName, loop, volume }) => ({
				id,
				clipName,
				loop,
				volume
			}));
		}
		dispose() {
			this.generation += 1;
			this.loadAbort?.abort();
			this.loadAbort = null;
			this.loadPromise = null;
			this.stopAll();
			this.output?.disconnect();
			this.output = null;
			this.buffer = null;
			this.manifest = null;
			if (this.ctx && this.ctx.state !== "closed") this.ctx.close().catch(() => {});
			this.ctx = null;
		}
		removeInstance(id) {
			const instance = this.instances.get(id);
			if (!instance) return;
			this.clearFadeStop(instance);
			this.instances.delete(id);
			try {
				instance.source.disconnect();
			} catch {}
			try {
				instance.gain.disconnect();
			} catch {}
		}
	};
	function createAudioSpriteEngine() {
		return new AudioSpriteEngine();
	}
	//#endregion
	//#region src/audio-player/core/audio/usePluginSoundLayer.ts
	/**
	* Creates the restricted sprite facade passed to plugins. One engine is shared
	* by the player/session so plugin-layer sounds never touch primary playback.
	*/
	function usePluginSoundLayer() {
		const engineRef = (0, react.useRef)(null);
		if (engineRef.current === null) engineRef.current = new AudioSpriteEngine();
		(0, react.useEffect)(() => () => {
			engineRef.current?.dispose();
			engineRef.current = null;
		}, []);
		return (0, react.useMemo)(() => ({
			loadSpritePack: (manifest) => engineRef.current.load(manifest),
			playSprite: (clipName, options) => engineRef.current.play(clipName, options),
			stopSprite: (id) => engineRef.current.stop(id),
			fadeSprite: (id, toVolume, durationMs) => engineRef.current.fade(id, toVolume, durationMs),
			stopAllSprites: () => engineRef.current.stopAll()
		}), []);
	}
	//#endregion
	//#region node_modules/react/cjs/react-jsx-runtime.production.min.js
	/**
	* @license React
	* react-jsx-runtime.production.min.js
	*
	* Copyright (c) Facebook, Inc. and its affiliates.
	*
	* This source code is licensed under the MIT license found in the
	* LICENSE file in the root directory of this source tree.
	*/
	var require_react_jsx_runtime_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
		var f = require("react"), k$1 = Symbol.for("react.element"), l = Symbol.for("react.fragment"), m$1 = Object.prototype.hasOwnProperty, n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p = {
			key: !0,
			ref: !0,
			__self: !0,
			__source: !0
		};
		function q(c, a, g) {
			var b, d = {}, e = null, h = null;
			void 0 !== g && (e = "" + g);
			void 0 !== a.key && (e = "" + a.key);
			void 0 !== a.ref && (h = a.ref);
			for (b in a) m$1.call(a, b) && !p.hasOwnProperty(b) && (d[b] = a[b]);
			if (c && c.defaultProps) for (b in a = c.defaultProps, a) void 0 === d[b] && (d[b] = a[b]);
			return {
				$$typeof: k$1,
				type: c,
				key: e,
				ref: h,
				props: d,
				_owner: n.current
			};
		}
		exports.Fragment = l;
		exports.jsx = q;
		exports.jsxs = q;
	}));
	//#endregion
	//#region node_modules/react/cjs/react-jsx-runtime.development.js
	/**
	* @license React
	* react-jsx-runtime.development.js
	*
	* Copyright (c) Facebook, Inc. and its affiliates.
	*
	* This source code is licensed under the MIT license found in the
	* LICENSE file in the root directory of this source tree.
	*/
	var require_react_jsx_runtime_development = /* @__PURE__ */ __commonJSMin(((exports) => {
		if (process.env.NODE_ENV !== "production") (function() {
			"use strict";
			var React = require("react");
			var REACT_ELEMENT_TYPE = Symbol.for("react.element");
			var REACT_PORTAL_TYPE = Symbol.for("react.portal");
			var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
			var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
			var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
			var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
			var REACT_CONTEXT_TYPE = Symbol.for("react.context");
			var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
			var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
			var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
			var REACT_MEMO_TYPE = Symbol.for("react.memo");
			var REACT_LAZY_TYPE = Symbol.for("react.lazy");
			var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
			var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
			var FAUX_ITERATOR_SYMBOL = "@@iterator";
			function getIteratorFn(maybeIterable) {
				if (maybeIterable === null || typeof maybeIterable !== "object") return null;
				var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
				if (typeof maybeIterator === "function") return maybeIterator;
				return null;
			}
			var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
			function error(format) {
				for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
				printWarning("error", format, args);
			}
			function printWarning(level, format, args) {
				var stack = ReactSharedInternals.ReactDebugCurrentFrame.getStackAddendum();
				if (stack !== "") {
					format += "%s";
					args = args.concat([stack]);
				}
				var argsWithFormat = args.map(function(item) {
					return String(item);
				});
				argsWithFormat.unshift("Warning: " + format);
				Function.prototype.apply.call(console[level], console, argsWithFormat);
			}
			var enableScopeAPI = false;
			var enableCacheElement = false;
			var enableTransitionTracing = false;
			var enableLegacyHidden = false;
			var enableDebugTracing = false;
			var REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
			function isValidElementType(type) {
				if (typeof type === "string" || typeof type === "function") return true;
				if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) return true;
				if (typeof type === "object" && type !== null) {
					if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) return true;
				}
				return false;
			}
			function getWrappedName(outerType, innerType, wrapperName) {
				var displayName = outerType.displayName;
				if (displayName) return displayName;
				var functionName = innerType.displayName || innerType.name || "";
				return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
			}
			function getContextName(type) {
				return type.displayName || "Context";
			}
			function getComponentNameFromType(type) {
				if (type == null) return null;
				if (typeof type.tag === "number") error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
				if (typeof type === "function") return type.displayName || type.name || null;
				if (typeof type === "string") return type;
				switch (type) {
					case REACT_FRAGMENT_TYPE: return "Fragment";
					case REACT_PORTAL_TYPE: return "Portal";
					case REACT_PROFILER_TYPE: return "Profiler";
					case REACT_STRICT_MODE_TYPE: return "StrictMode";
					case REACT_SUSPENSE_TYPE: return "Suspense";
					case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				}
				if (typeof type === "object") switch (type.$$typeof) {
					case REACT_CONTEXT_TYPE: return getContextName(type) + ".Consumer";
					case REACT_PROVIDER_TYPE: return getContextName(type._context) + ".Provider";
					case REACT_FORWARD_REF_TYPE: return getWrappedName(type, type.render, "ForwardRef");
					case REACT_MEMO_TYPE:
						var outerName = type.displayName || null;
						if (outerName !== null) return outerName;
						return getComponentNameFromType(type.type) || "Memo";
					case REACT_LAZY_TYPE:
						var lazyComponent = type;
						var payload = lazyComponent._payload;
						var init = lazyComponent._init;
						try {
							return getComponentNameFromType(init(payload));
						} catch (x) {
							return null;
						}
				}
				return null;
			}
			var assign = Object.assign;
			var disabledDepth = 0;
			var prevLog;
			var prevInfo;
			var prevWarn;
			var prevError;
			var prevGroup;
			var prevGroupCollapsed;
			var prevGroupEnd;
			function disabledLog() {}
			disabledLog.__reactDisabledLog = true;
			function disableLogs() {
				if (disabledDepth === 0) {
					prevLog = console.log;
					prevInfo = console.info;
					prevWarn = console.warn;
					prevError = console.error;
					prevGroup = console.group;
					prevGroupCollapsed = console.groupCollapsed;
					prevGroupEnd = console.groupEnd;
					var props = {
						configurable: true,
						enumerable: true,
						value: disabledLog,
						writable: true
					};
					Object.defineProperties(console, {
						info: props,
						log: props,
						warn: props,
						error: props,
						group: props,
						groupCollapsed: props,
						groupEnd: props
					});
				}
				disabledDepth++;
			}
			function reenableLogs() {
				disabledDepth--;
				if (disabledDepth === 0) {
					var props = {
						configurable: true,
						enumerable: true,
						writable: true
					};
					Object.defineProperties(console, {
						log: assign({}, props, { value: prevLog }),
						info: assign({}, props, { value: prevInfo }),
						warn: assign({}, props, { value: prevWarn }),
						error: assign({}, props, { value: prevError }),
						group: assign({}, props, { value: prevGroup }),
						groupCollapsed: assign({}, props, { value: prevGroupCollapsed }),
						groupEnd: assign({}, props, { value: prevGroupEnd })
					});
				}
				if (disabledDepth < 0) error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
			}
			var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
			var prefix;
			function describeBuiltInComponentFrame(name, source, ownerFn) {
				if (prefix === void 0) try {
					throw Error();
				} catch (x) {
					var match = x.stack.trim().match(/\n( *(at )?)/);
					prefix = match && match[1] || "";
				}
				return "\n" + prefix + name;
			}
			var reentry = false;
			var componentFrameCache = new (typeof WeakMap === "function" ? WeakMap : Map)();
			function describeNativeComponentFrame(fn, construct) {
				if (!fn || reentry) return "";
				var frame = componentFrameCache.get(fn);
				if (frame !== void 0) return frame;
				var control;
				reentry = true;
				var previousPrepareStackTrace = Error.prepareStackTrace;
				Error.prepareStackTrace = void 0;
				var previousDispatcher = ReactCurrentDispatcher.current;
				ReactCurrentDispatcher.current = null;
				disableLogs();
				try {
					if (construct) {
						var Fake = function() {
							throw Error();
						};
						Object.defineProperty(Fake.prototype, "props", { set: function() {
							throw Error();
						} });
						if (typeof Reflect === "object" && Reflect.construct) {
							try {
								Reflect.construct(Fake, []);
							} catch (x) {
								control = x;
							}
							Reflect.construct(fn, [], Fake);
						} else {
							try {
								Fake.call();
							} catch (x) {
								control = x;
							}
							fn.call(Fake.prototype);
						}
					} else {
						try {
							throw Error();
						} catch (x) {
							control = x;
						}
						fn();
					}
				} catch (sample) {
					if (sample && control && typeof sample.stack === "string") {
						var sampleLines = sample.stack.split("\n");
						var controlLines = control.stack.split("\n");
						var s = sampleLines.length - 1;
						var c = controlLines.length - 1;
						while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) c--;
						for (; s >= 1 && c >= 0; s--, c--) if (sampleLines[s] !== controlLines[c]) {
							if (s !== 1 || c !== 1) do {
								s--;
								c--;
								if (c < 0 || sampleLines[s] !== controlLines[c]) {
									var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
									if (fn.displayName && _frame.includes("<anonymous>")) _frame = _frame.replace("<anonymous>", fn.displayName);
									if (typeof fn === "function") componentFrameCache.set(fn, _frame);
									return _frame;
								}
							} while (s >= 1 && c >= 0);
							break;
						}
					}
				} finally {
					reentry = false;
					ReactCurrentDispatcher.current = previousDispatcher;
					reenableLogs();
					Error.prepareStackTrace = previousPrepareStackTrace;
				}
				var name = fn ? fn.displayName || fn.name : "";
				var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
				if (typeof fn === "function") componentFrameCache.set(fn, syntheticFrame);
				return syntheticFrame;
			}
			function describeFunctionComponentFrame(fn, source, ownerFn) {
				return describeNativeComponentFrame(fn, false);
			}
			function shouldConstruct(Component) {
				var prototype = Component.prototype;
				return !!(prototype && prototype.isReactComponent);
			}
			function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
				if (type == null) return "";
				if (typeof type === "function") return describeNativeComponentFrame(type, shouldConstruct(type));
				if (typeof type === "string") return describeBuiltInComponentFrame(type);
				switch (type) {
					case REACT_SUSPENSE_TYPE: return describeBuiltInComponentFrame("Suspense");
					case REACT_SUSPENSE_LIST_TYPE: return describeBuiltInComponentFrame("SuspenseList");
				}
				if (typeof type === "object") switch (type.$$typeof) {
					case REACT_FORWARD_REF_TYPE: return describeFunctionComponentFrame(type.render);
					case REACT_MEMO_TYPE: return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
					case REACT_LAZY_TYPE:
						var lazyComponent = type;
						var payload = lazyComponent._payload;
						var init = lazyComponent._init;
						try {
							return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
						} catch (x) {}
				}
				return "";
			}
			var hasOwnProperty = Object.prototype.hasOwnProperty;
			var loggedTypeFailures = {};
			var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
			function setCurrentlyValidatingElement(element) {
				if (element) {
					var owner = element._owner;
					var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
					ReactDebugCurrentFrame.setExtraStackFrame(stack);
				} else ReactDebugCurrentFrame.setExtraStackFrame(null);
			}
			function checkPropTypes(typeSpecs, values, location, componentName, element) {
				var has = Function.call.bind(hasOwnProperty);
				for (var typeSpecName in typeSpecs) if (has(typeSpecs, typeSpecName)) {
					var error$1 = void 0;
					try {
						if (typeof typeSpecs[typeSpecName] !== "function") {
							var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
							err.name = "Invariant Violation";
							throw err;
						}
						error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
					} catch (ex) {
						error$1 = ex;
					}
					if (error$1 && !(error$1 instanceof Error)) {
						setCurrentlyValidatingElement(element);
						error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
						setCurrentlyValidatingElement(null);
					}
					if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
						loggedTypeFailures[error$1.message] = true;
						setCurrentlyValidatingElement(element);
						error("Failed %s type: %s", location, error$1.message);
						setCurrentlyValidatingElement(null);
					}
				}
			}
			var isArrayImpl = Array.isArray;
			function isArray(a) {
				return isArrayImpl(a);
			}
			function typeName(value) {
				return typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
			}
			function willCoercionThrow(value) {
				try {
					testStringCoercion(value);
					return false;
				} catch (e) {
					return true;
				}
			}
			function testStringCoercion(value) {
				return "" + value;
			}
			function checkKeyStringCoercion(value) {
				if (willCoercionThrow(value)) {
					error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
					return testStringCoercion(value);
				}
			}
			var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
			var RESERVED_PROPS = {
				key: true,
				ref: true,
				__self: true,
				__source: true
			};
			var specialPropKeyWarningShown;
			var specialPropRefWarningShown;
			var didWarnAboutStringRefs = {};
			function hasValidRef(config) {
				if (hasOwnProperty.call(config, "ref")) {
					var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
					if (getter && getter.isReactWarning) return false;
				}
				return config.ref !== void 0;
			}
			function hasValidKey(config) {
				if (hasOwnProperty.call(config, "key")) {
					var getter = Object.getOwnPropertyDescriptor(config, "key").get;
					if (getter && getter.isReactWarning) return false;
				}
				return config.key !== void 0;
			}
			function warnIfStringRefCannotBeAutoConverted(config, self) {
				if (typeof config.ref === "string" && ReactCurrentOwner.current && self && ReactCurrentOwner.current.stateNode !== self) {
					var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
					if (!didWarnAboutStringRefs[componentName]) {
						error("Component \"%s\" contains the string ref \"%s\". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref", getComponentNameFromType(ReactCurrentOwner.current.type), config.ref);
						didWarnAboutStringRefs[componentName] = true;
					}
				}
			}
			function defineKeyPropWarningGetter(props, displayName) {
				var warnAboutAccessingKey = function() {
					if (!specialPropKeyWarningShown) {
						specialPropKeyWarningShown = true;
						error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
					}
				};
				warnAboutAccessingKey.isReactWarning = true;
				Object.defineProperty(props, "key", {
					get: warnAboutAccessingKey,
					configurable: true
				});
			}
			function defineRefPropWarningGetter(props, displayName) {
				var warnAboutAccessingRef = function() {
					if (!specialPropRefWarningShown) {
						specialPropRefWarningShown = true;
						error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
					}
				};
				warnAboutAccessingRef.isReactWarning = true;
				Object.defineProperty(props, "ref", {
					get: warnAboutAccessingRef,
					configurable: true
				});
			}
			/**
			* Factory method to create a new React element. This no longer adheres to
			* the class pattern, so do not use new to call it. Also, instanceof check
			* will not work. Instead test $$typeof field against Symbol.for('react.element') to check
			* if something is a React Element.
			*
			* @param {*} type
			* @param {*} props
			* @param {*} key
			* @param {string|object} ref
			* @param {*} owner
			* @param {*} self A *temporary* helper to detect places where `this` is
			* different from the `owner` when React.createElement is called, so that we
			* can warn. We want to get rid of owner and replace string `ref`s with arrow
			* functions, and as long as `this` and owner are the same, there will be no
			* change in behavior.
			* @param {*} source An annotation object (added by a transpiler or otherwise)
			* indicating filename, line number, and/or other information.
			* @internal
			*/
			var ReactElement = function(type, key, ref, self, source, owner, props) {
				var element = {
					$$typeof: REACT_ELEMENT_TYPE,
					type,
					key,
					ref,
					props,
					_owner: owner
				};
				element._store = {};
				Object.defineProperty(element._store, "validated", {
					configurable: false,
					enumerable: false,
					writable: true,
					value: false
				});
				Object.defineProperty(element, "_self", {
					configurable: false,
					enumerable: false,
					writable: false,
					value: self
				});
				Object.defineProperty(element, "_source", {
					configurable: false,
					enumerable: false,
					writable: false,
					value: source
				});
				if (Object.freeze) {
					Object.freeze(element.props);
					Object.freeze(element);
				}
				return element;
			};
			/**
			* https://github.com/reactjs/rfcs/pull/107
			* @param {*} type
			* @param {object} props
			* @param {string} key
			*/
			function jsxDEV(type, config, maybeKey, source, self) {
				var propName;
				var props = {};
				var key = null;
				var ref = null;
				if (maybeKey !== void 0) {
					checkKeyStringCoercion(maybeKey);
					key = "" + maybeKey;
				}
				if (hasValidKey(config)) {
					checkKeyStringCoercion(config.key);
					key = "" + config.key;
				}
				if (hasValidRef(config)) {
					ref = config.ref;
					warnIfStringRefCannotBeAutoConverted(config, self);
				}
				for (propName in config) if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) props[propName] = config[propName];
				if (type && type.defaultProps) {
					var defaultProps = type.defaultProps;
					for (propName in defaultProps) if (props[propName] === void 0) props[propName] = defaultProps[propName];
				}
				if (key || ref) {
					var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
					if (key) defineKeyPropWarningGetter(props, displayName);
					if (ref) defineRefPropWarningGetter(props, displayName);
				}
				return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
			}
			var ReactCurrentOwner$1 = ReactSharedInternals.ReactCurrentOwner;
			var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
			function setCurrentlyValidatingElement$1(element) {
				if (element) {
					var owner = element._owner;
					var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
					ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
				} else ReactDebugCurrentFrame$1.setExtraStackFrame(null);
			}
			var propTypesMisspellWarningShown = false;
			/**
			* Verifies the object is a ReactElement.
			* See https://reactjs.org/docs/react-api.html#isvalidelement
			* @param {?object} object
			* @return {boolean} True if `object` is a ReactElement.
			* @final
			*/
			function isValidElement(object) {
				return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
			}
			function getDeclarationErrorAddendum() {
				if (ReactCurrentOwner$1.current) {
					var name = getComponentNameFromType(ReactCurrentOwner$1.current.type);
					if (name) return "\n\nCheck the render method of `" + name + "`.";
				}
				return "";
			}
			function getSourceInfoErrorAddendum(source) {
				if (source !== void 0) {
					var fileName = source.fileName.replace(/^.*[\\\/]/, "");
					var lineNumber = source.lineNumber;
					return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
				}
				return "";
			}
			/**
			* Warn if there's no key explicitly set on dynamic arrays of children or
			* object keys are not valid. This allows us to keep track of children between
			* updates.
			*/
			var ownerHasKeyUseWarning = {};
			function getCurrentComponentErrorInfo(parentType) {
				var info = getDeclarationErrorAddendum();
				if (!info) {
					var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
					if (parentName) info = "\n\nCheck the top-level render call using <" + parentName + ">.";
				}
				return info;
			}
			/**
			* Warn if the element doesn't have an explicit key assigned to it.
			* This element is in an array. The array could grow and shrink or be
			* reordered. All children that haven't already been validated are required to
			* have a "key" property assigned to it. Error statuses are cached so a warning
			* will only be shown once.
			*
			* @internal
			* @param {ReactElement} element Element that requires a key.
			* @param {*} parentType element's parent's type.
			*/
			function validateExplicitKey(element, parentType) {
				if (!element._store || element._store.validated || element.key != null) return;
				element._store.validated = true;
				var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
				if (ownerHasKeyUseWarning[currentComponentErrorInfo]) return;
				ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
				var childOwner = "";
				if (element && element._owner && element._owner !== ReactCurrentOwner$1.current) childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
				setCurrentlyValidatingElement$1(element);
				error("Each child in a list should have a unique \"key\" prop.%s%s See https://reactjs.org/link/warning-keys for more information.", currentComponentErrorInfo, childOwner);
				setCurrentlyValidatingElement$1(null);
			}
			/**
			* Ensure that every element either is passed in a static location, in an
			* array with an explicit keys property defined, or in an object literal
			* with valid key property.
			*
			* @internal
			* @param {ReactNode} node Statically passed child of any type.
			* @param {*} parentType node's parent's type.
			*/
			function validateChildKeys(node, parentType) {
				if (typeof node !== "object") return;
				if (isArray(node)) for (var i = 0; i < node.length; i++) {
					var child = node[i];
					if (isValidElement(child)) validateExplicitKey(child, parentType);
				}
				else if (isValidElement(node)) {
					if (node._store) node._store.validated = true;
				} else if (node) {
					var iteratorFn = getIteratorFn(node);
					if (typeof iteratorFn === "function") {
						if (iteratorFn !== node.entries) {
							var iterator = iteratorFn.call(node);
							var step;
							while (!(step = iterator.next()).done) if (isValidElement(step.value)) validateExplicitKey(step.value, parentType);
						}
					}
				}
			}
			/**
			* Given an element, validate that its props follow the propTypes definition,
			* provided by the type.
			*
			* @param {ReactElement} element
			*/
			function validatePropTypes(element) {
				var type = element.type;
				if (type === null || type === void 0 || typeof type === "string") return;
				var propTypes;
				if (typeof type === "function") propTypes = type.propTypes;
				else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_MEMO_TYPE)) propTypes = type.propTypes;
				else return;
				if (propTypes) {
					var name = getComponentNameFromType(type);
					checkPropTypes(propTypes, element.props, "prop", name, element);
				} else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
					propTypesMisspellWarningShown = true;
					error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", getComponentNameFromType(type) || "Unknown");
				}
				if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
			}
			/**
			* Given a fragment, validate that it can only be provided with fragment props
			* @param {ReactElement} fragment
			*/
			function validateFragmentProps(fragment) {
				var keys = Object.keys(fragment.props);
				for (var i = 0; i < keys.length; i++) {
					var key = keys[i];
					if (key !== "children" && key !== "key") {
						setCurrentlyValidatingElement$1(fragment);
						error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
						setCurrentlyValidatingElement$1(null);
						break;
					}
				}
				if (fragment.ref !== null) {
					setCurrentlyValidatingElement$1(fragment);
					error("Invalid attribute `ref` supplied to `React.Fragment`.");
					setCurrentlyValidatingElement$1(null);
				}
			}
			var didWarnAboutKeySpread = {};
			function jsxWithValidation(type, props, key, isStaticChildren, source, self) {
				var validType = isValidElementType(type);
				if (!validType) {
					var info = "";
					if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
					var sourceInfo = getSourceInfoErrorAddendum(source);
					if (sourceInfo) info += sourceInfo;
					else info += getDeclarationErrorAddendum();
					var typeString;
					if (type === null) typeString = "null";
					else if (isArray(type)) typeString = "array";
					else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
						typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
						info = " Did you accidentally export a JSX literal instead of a component?";
					} else typeString = typeof type;
					error("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
				}
				var element = jsxDEV(type, props, key, source, self);
				if (element == null) return element;
				if (validType) {
					var children = props.children;
					if (children !== void 0) if (isStaticChildren) if (isArray(children)) {
						for (var i = 0; i < children.length; i++) validateChildKeys(children[i], type);
						if (Object.freeze) Object.freeze(children);
					} else error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
					else validateChildKeys(children, type);
				}
				if (hasOwnProperty.call(props, "key")) {
					var componentName = getComponentNameFromType(type);
					var keys = Object.keys(props).filter(function(k) {
						return k !== "key";
					});
					var beforeExample = keys.length > 0 ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
					if (!didWarnAboutKeySpread[componentName + beforeExample]) {
						error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", beforeExample, componentName, keys.length > 0 ? "{" + keys.join(": ..., ") + ": ...}" : "{}", componentName);
						didWarnAboutKeySpread[componentName + beforeExample] = true;
					}
				}
				if (type === REACT_FRAGMENT_TYPE) validateFragmentProps(element);
				else validatePropTypes(element);
				return element;
			}
			function jsxWithValidationStatic(type, props, key) {
				return jsxWithValidation(type, props, key, true);
			}
			function jsxWithValidationDynamic(type, props, key) {
				return jsxWithValidation(type, props, key, false);
			}
			var jsx = jsxWithValidationDynamic;
			var jsxs = jsxWithValidationStatic;
			exports.Fragment = REACT_FRAGMENT_TYPE;
			exports.jsx = jsx;
			exports.jsxs = jsxs;
		})();
	}));
	//#endregion
	//#region src/audio-player/session/AudioSessionContext.tsx
	var import_jsx_runtime = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
		if (process.env.NODE_ENV === "production") module.exports = require_react_jsx_runtime_production_min();
		else module.exports = require_react_jsx_runtime_development();
	})))();
	var AudioSessionContext = (0, react.createContext)(null);
	var EMPTY_PLUGINS$1 = [];
	/**
	* Build a playback order (a list of queue indices). When shuffle is off this is
	* the natural order. When on it is a Fisher–Yates shuffle with `startIndex`
	* pulled to the front so the current track keeps playing and the rest are
	* randomized — giving shuffle a definite end (so "repeat off" can stop).
	*/
	function buildOrder(length, startIndex, shuffle) {
		const indices = Array.from({ length }, (_, i) => i);
		if (!shuffle || length <= 1) return indices;
		for (let i = indices.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}
		const at = indices.indexOf(startIndex);
		if (at > 0) [indices[0], indices[at]] = [indices[at], indices[0]];
		return indices;
	}
	/**
	* Owns the one and only `<audio>` element for the app plus the shared queue.
	* Internally reuses `useAudioPlayer` (the proven per-source engine) and drives
	* its `src` from the queue index. Every UI skin reads this via `useAudioSession`
	* and controls the same playback — so interacting with any skin updates all of
	* them, because there is a single audio element behind them.
	*/
	function AudioSessionProvider({ children, initialQueue = [], initialIndex = 0, autoPlay = false, repeatMode: initialRepeat = "off", shuffle: initialShuffle = false, automix: initialAutomix = false, plugins: externalPlugins = EMPTY_PLUGINS$1, audioBackend = "html5", onFallbackSource, preloadConfig }) {
		const [queue, setQueueState] = (0, react.useState)(initialQueue);
		const [currentIndex, setCurrentIndex] = (0, react.useState)(initialQueue.length > 0 ? Math.min(Math.max(initialIndex, 0), initialQueue.length - 1) : -1);
		const [shuffle, setShuffle] = (0, react.useState)(initialShuffle);
		const [repeatMode, setRepeatMode] = (0, react.useState)(initialRepeat);
		const [automix, setAutomix] = (0, react.useState)(initialAutomix);
		const order = (0, react.useMemo)(() => buildOrder(queue.length, currentIndex < 0 ? 0 : currentIndex, shuffle), [queue, shuffle]);
		const pendingPlayRef = (0, react.useRef)(false);
		const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
		const currentTrackSources = (0, react.useMemo)(() => getTrackSources(currentTrack), [currentTrack]);
		const src = currentTrackSources[0]?.url ?? "";
		const sourceKey = currentTrack ? `${currentIndex}:${trackKey(currentTrack)}:${trackSourcesSignature(currentTrack)}` : "empty";
		const subscribersRef = (0, react.useRef)(/* @__PURE__ */ new Map());
		const subscribe = (0, react.useCallback)((eventType, handler) => {
			let set = subscribersRef.current.get(eventType);
			if (!set) {
				set = /* @__PURE__ */ new Set();
				subscribersRef.current.set(eventType, set);
			}
			set.add(handler);
			return () => {
				set?.delete(handler);
			};
		}, []);
		const emit = (0, react.useCallback)((eventType, payload) => {
			const set = subscribersRef.current.get(eventType);
			if (set) for (const handler of Array.from(set)) handler(payload);
		}, []);
		const handleFallbackSource = (0, react.useCallback)((event) => {
			onFallbackSource?.(event);
			emit("fallback-source", event);
		}, [onFallbackSource, emit]);
		const advanceRef = (0, react.useRef)(() => {});
		const engine = useAudioPlayer({
			src,
			sources: currentTrackSources,
			sourceKey,
			autoPlay,
			loop: repeatMode === "one",
			onEnded: () => advanceRef.current(),
			onFallbackSource: handleFallbackSource,
			audioBackend
		});
		(0, react.useEffect)(() => {
			if (queue.length === 0 && currentIndex !== -1) setCurrentIndex(-1);
			else if (currentIndex >= queue.length) setCurrentIndex(queue.length - 1);
		}, [queue.length, currentIndex]);
		const prevIndexRef = (0, react.useRef)(currentIndex);
		(0, react.useEffect)(() => {
			if (currentIndex !== prevIndexRef.current) {
				emit("track-change", {
					track: currentTrack,
					previousIndex: prevIndexRef.current
				});
				prevIndexRef.current = currentIndex;
			}
		}, [
			currentIndex,
			currentTrack,
			emit
		]);
		const stepIndex = (0, react.useCallback)((from, dir) => {
			if (order.length === 0) return null;
			const pos = order.indexOf(from);
			if (pos === -1) return dir === 1 ? order[0] : null;
			let nextPos = pos + dir;
			if (nextPos >= order.length) if (repeatMode === "all") nextPos = 0;
			else return null;
			else if (nextPos < 0) nextPos = repeatMode === "all" ? order.length - 1 : 0;
			return order[nextPos];
		}, [order, repeatMode]);
		const goTo = (0, react.useCallback)((index, wantPlay) => {
			if (index < 0 || index >= queue.length) return;
			if (index === currentIndex) {
				if (wantPlay && !engine.isPlaying) engine.play(true);
				return;
			}
			if (wantPlay && !engine.isPlaying) pendingPlayRef.current = true;
			setCurrentIndex(index);
		}, [
			queue.length,
			currentIndex,
			engine
		]);
		const advanceToNextRef = (0, react.useRef)(() => {});
		advanceToNextRef.current = () => {
			const next = stepIndex(currentIndex, 1);
			if (next === null) {
				emit("queue-end", { reason: repeatMode === "off" ? "repeat-off" : "normal" });
				return;
			}
			if (next === currentIndex) {
				engine.seek(0);
				engine.play(true);
				return;
			}
			pendingPlayRef.current = true;
			setCurrentIndex(next);
		};
		const requestAdvance = (0, react.useCallback)(() => advanceToNextRef.current(), []);
		const pluginNextIndex = repeatMode !== "one" ? stepIndex(currentIndex, 1) : null;
		const pluginNextTrack = pluginNextIndex !== null && pluginNextIndex !== currentIndex ? queue[pluginNextIndex] ?? null : null;
		const automixPluginRef = (0, react.useRef)(null);
		if (automixPluginRef.current === null) automixPluginRef.current = createAutomixPlugin({
			name: AUTOMIX_PLUGIN_NAME,
			enabled: false
		});
		const hasExternalAutomix = hasAutomixPlugin(externalPlugins);
		const automixEnabled = automix && !hasExternalAutomix;
		(0, react.useEffect)(() => {
			automixPluginRef.current?.updateConfig({ enabled: automixEnabled });
		}, [automixEnabled]);
		const allPlugins = (0, react.useMemo)(() => withInternalAutomix(externalPlugins, automixPluginRef.current), [externalPlugins]);
		const pluginSoundLayer = usePluginSoundLayer();
		const pluginContextStateRef = (0, react.useRef)({
			engine,
			currentTrack,
			nextTrack: pluginNextTrack,
			sourceKey,
			queue,
			currentIndex,
			repeatMode,
			shuffle,
			requestAdvance,
			next: () => {},
			previous: () => {}
		});
		const pluginManager = usePluginManager(allPlugins, (0, react.useMemo)(() => ({
			getEngine: () => pluginContextStateRef.current.engine,
			getRootElement: () => null,
			getAudioElement: () => pluginContextStateRef.current.engine.audioRef.current,
			getCurrentTrack: () => pluginContextStateRef.current.currentTrack,
			getNextTrack: () => pluginContextStateRef.current.nextTrack,
			getSourceKey: () => pluginContextStateRef.current.sourceKey,
			requestAdvance: () => pluginContextStateRef.current.requestAdvance(),
			next: () => pluginContextStateRef.current.next(),
			previous: () => pluginContextStateRef.current.previous(),
			getQueue: () => pluginContextStateRef.current.queue,
			getCurrentIndex: () => pluginContextStateRef.current.currentIndex,
			getRepeatMode: () => pluginContextStateRef.current.repeatMode,
			getShuffle: () => pluginContextStateRef.current.shuffle,
			sounds: pluginSoundLayer
		}), [pluginSoundLayer]));
		const seekWithPlugins = (0, react.useCallback)((time) => {
			const nextPosition = engine.duration > 0 ? Math.max(0, Math.min(engine.duration, time)) : time;
			engine.seek(time);
			pluginManager.trigger("onSeek", nextPosition);
		}, [engine, pluginManager]);
		const seekByWithPlugins = (0, react.useCallback)((delta) => {
			seekWithPlugins((engine.audioRef.current?.currentTime ?? engine.currentTime) + delta);
		}, [
			engine.audioRef,
			engine.currentTime,
			seekWithPlugins
		]);
		const pluginAwareEngine = (0, react.useMemo)(() => ({
			...engine,
			seek: seekWithPlugins,
			seekBy: seekByWithPlugins
		}), [
			engine,
			seekByWithPlugins,
			seekWithPlugins
		]);
		pluginContextStateRef.current = {
			engine: pluginAwareEngine,
			currentTrack,
			nextTrack: pluginNextTrack,
			sourceKey,
			queue,
			currentIndex,
			repeatMode,
			shuffle,
			requestAdvance,
			next: () => {},
			previous: () => {}
		};
		advanceRef.current = () => {
			if (pluginManager.triggerUntilHandled("onTrackEnded", currentTrack)) return;
			advanceToNextRef.current();
		};
		(0, react.useEffect)(() => {
			pluginManager.trigger("onTrackLoad", currentTrack);
		}, [
			pluginManager,
			sourceKey,
			currentTrack
		]);
		const preloadConfigProp = preloadConfig || { strategy: "next" };
		(0, react.useEffect)(() => {
			if (!engine.isPlaying || repeatMode === "one") return;
			const strategy = preloadConfigProp.strategy || "next";
			if (strategy === "none") return;
			if (preloadConfigProp.skipOnCellular && "connection" in navigator) {
				const conn = navigator.connection;
				if (conn.effectiveType === "cellular" || conn.type === "cellular") return;
			}
			if (strategy === "next" && pluginNextTrack) engine.preload(pluginNextTrack);
			else if (strategy === "aggressive") {
				const max = preloadConfigProp.maxConcurrent || 2;
				let current = currentIndex;
				for (let i = 0; i < max; i++) {
					const nextIdx = stepIndex(current, 1);
					if (nextIdx === null || nextIdx === currentIndex) break;
					engine.preload(queue[nextIdx]);
					current = nextIdx;
				}
			}
		}, [
			engine,
			engine.isPlaying,
			pluginNextTrack,
			repeatMode,
			sourceKey,
			preloadConfigProp,
			currentIndex,
			queue,
			stepIndex
		]);
		const previousPluginPlayingRef = (0, react.useRef)(engine.isPlaying);
		(0, react.useEffect)(() => {
			if (previousPluginPlayingRef.current === engine.isPlaying) return;
			previousPluginPlayingRef.current = engine.isPlaying;
			pluginManager.trigger(engine.isPlaying ? "onPlay" : "onPause");
			if (engine.isPlaying) emit("play", {
				track: currentTrack,
				currentTime: engine.currentTime
			});
			else emit("pause", {
				track: currentTrack,
				currentTime: engine.currentTime
			});
		}, [
			pluginManager,
			engine.isPlaying,
			engine.currentTime,
			currentTrack,
			emit
		]);
		(0, react.useEffect)(() => {
			pluginManager.trigger("onTimeUpdate", engine.currentTime);
		}, [pluginManager, engine.currentTime]);
		const prevErrorRef = (0, react.useRef)(engine.hasError);
		(0, react.useEffect)(() => {
			if (engine.hasError && !prevErrorRef.current) emit("error", {
				error: engine.errorMessage,
				track: currentTrack
			});
			prevErrorRef.current = engine.hasError;
		}, [
			engine.hasError,
			engine.errorMessage,
			currentTrack,
			emit
		]);
		(0, react.useEffect)(() => {
			if (!engine.hasAudio || queue.length === 0) pluginManager.trigger("onStop");
		}, [
			pluginManager,
			engine.hasAudio,
			queue.length
		]);
		(0, react.useEffect)(() => () => {
			pluginManager.trigger("onStop");
		}, [pluginManager]);
		(0, react.useEffect)(() => {
			if (pendingPlayRef.current) {
				pendingPlayRef.current = false;
				if (engine.currentSrc) engine.play(true);
			}
		}, [sourceKey, engine.currentSrc]);
		const setQueue = (0, react.useCallback)((tracks, startIndex = 0, autoPlayNext = false) => {
			const idx = tracks.length > 0 ? Math.min(Math.max(startIndex, 0), tracks.length - 1) : -1;
			if (autoPlayNext && idx >= 0 && !engine.isPlaying) pendingPlayRef.current = true;
			setQueueState(tracks);
			setCurrentIndex(idx);
		}, [engine.isPlaying]);
		const playTrack = (0, react.useCallback)((index) => goTo(index, true), [goTo]);
		const enqueue = (0, react.useCallback)((track) => {
			setQueueState((q) => [...q, track]);
		}, []);
		const playNow = (0, react.useCallback)((track) => {
			const key = trackKey(track);
			const existing = queue.findIndex((t) => trackKey(t) === key);
			if (existing !== -1) {
				if (queue[existing] !== track) {
					setQueueState((q) => q.map((t, i) => i === existing ? track : t));
					if (existing === currentIndex) {
						const sourceChanged = getPrimaryTrackSource(track) !== src;
						if (!engine.isPlaying) if (sourceChanged) pendingPlayRef.current = true;
						else engine.play(true);
						return;
					}
				}
				goTo(existing, true);
				return;
			}
			const nextIndex = queue.length;
			if (!engine.isPlaying) pendingPlayRef.current = true;
			setQueueState((q) => [...q, track]);
			setCurrentIndex(nextIndex);
		}, [
			queue,
			goTo,
			engine,
			currentIndex,
			src
		]);
		const next = (0, react.useCallback)(() => {
			const target = stepIndex(currentIndex, 1);
			if (target !== null) goTo(target, engine.isPlaying);
		}, [
			stepIndex,
			currentIndex,
			goTo,
			engine.isPlaying
		]);
		const previous = (0, react.useCallback)(() => {
			if (engine.currentTime > 3) {
				seekWithPlugins(0);
				return;
			}
			const target = stepIndex(currentIndex, -1);
			if (target !== null) goTo(target, engine.isPlaying);
		}, [
			stepIndex,
			currentIndex,
			goTo,
			engine.currentTime,
			engine.isPlaying,
			seekWithPlugins
		]);
		const moveQueueItem = (0, react.useCallback)((fromIndex, toIndex) => {
			if (fromIndex === toIndex) return;
			if (fromIndex < 0 || fromIndex >= queue.length) return;
			if (toIndex < 0 || toIndex >= queue.length) return;
			setQueueState((q) => {
				const next = [...q];
				const [moved] = next.splice(fromIndex, 1);
				next.splice(toIndex, 0, moved);
				if (fromIndex === currentIndex) {} else {
					let adjusted = currentIndex;
					if (fromIndex < currentIndex && toIndex >= currentIndex) adjusted = currentIndex - 1;
					else if (fromIndex > currentIndex && toIndex <= currentIndex) adjusted = currentIndex + 1;
					if (adjusted !== currentIndex) queueMicrotask(() => setCurrentIndex(adjusted));
				}
				return next;
			});
			if (fromIndex === currentIndex) queueMicrotask(() => setCurrentIndex(toIndex));
		}, [queue.length, currentIndex]);
		const removeFromQueue = (0, react.useCallback)((index) => {
			if (index < 0 || index >= queue.length) return;
			if (index === currentIndex) return;
			setQueueState((q) => {
				const next = [...q];
				next.splice(index, 1);
				return next;
			});
			if (index < currentIndex) setCurrentIndex((ci) => ci - 1);
		}, [queue.length, currentIndex]);
		pluginContextStateRef.current = {
			engine: pluginAwareEngine,
			currentTrack,
			nextTrack: pluginNextTrack,
			sourceKey,
			queue,
			currentIndex,
			repeatMode,
			shuffle,
			requestAdvance,
			next,
			previous
		};
		const clearQueue = (0, react.useCallback)(() => {
			engine.pause();
			setQueueState([]);
			setCurrentIndex(-1);
		}, [engine]);
		const toggleShuffle = (0, react.useCallback)(() => setShuffle((s) => !s), []);
		const cycleRepeat = (0, react.useCallback)(() => {
			setRepeatMode((r) => r === "off" ? "all" : r === "all" ? "one" : "off");
		}, []);
		const toggleAutomix = (0, react.useCallback)(() => setAutomix((v) => !v), []);
		const canNext = stepIndex(currentIndex, 1) !== null;
		const canPrevious = queue.length > 1 || engine.currentTime > 3;
		const getCacheStats = (0, react.useCallback)(() => {
			const stats = sharedAudioBufferCache.getStats();
			const html5Stats = sharedHTML5AudioPool.getStats();
			return {
				...stats,
				preloadElementCount: html5Stats.preloadElementCount
			};
		}, []);
		const pruneAudioCache = (0, react.useCallback)((keepRecent = 0) => {
			const keepKeys = queue.map((t, i) => `${i}:${trackKey(t)}:${trackSourcesSignature(t)}`);
			sharedAudioBufferCache.prune(keepKeys, keepRecent);
		}, [queue]);
		const setCacheLimit = (0, react.useCallback)((maxBuffers) => {
			sharedAudioBufferCache.setMaxSize(maxBuffers);
		}, []);
		const value = (0, react.useMemo)(() => ({
			...pluginAwareEngine,
			queue,
			currentIndex,
			currentTrack,
			shuffle,
			repeatMode,
			automix,
			canNext,
			canPrevious,
			setQueue,
			playTrack,
			enqueue,
			playNow,
			next,
			previous,
			clearQueue,
			moveQueueItem,
			removeFromQueue,
			toggleShuffle,
			cycleRepeat,
			toggleAutomix,
			subscribe,
			getCacheStats,
			pruneAudioCache,
			setCacheLimit
		}), [
			pluginAwareEngine,
			queue,
			currentIndex,
			currentTrack,
			shuffle,
			repeatMode,
			automix,
			canNext,
			canPrevious,
			setQueue,
			playTrack,
			enqueue,
			playNow,
			next,
			previous,
			clearQueue,
			moveQueueItem,
			removeFromQueue,
			toggleShuffle,
			cycleRepeat,
			toggleAutomix,
			subscribe,
			getCacheStats,
			pruneAudioCache,
			setCacheLimit
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AudioSessionContext.Provider, {
			value,
			children: [engine.getBackendInfo().active === "html5" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
				ref: engine.audioRef,
				src: engine.currentSrc || void 0
			}), children]
		});
	}
	/** Read the global audio session. Throws if used outside an AudioSessionProvider. */
	function useAudioSession() {
		const ctx = (0, react.useContext)(AudioSessionContext);
		if (!ctx) throw new Error("useAudioSession must be used within an <AudioSessionProvider>");
		return ctx;
	}
	//#endregion
	//#region src/audio-player/headless/useMediaSessionObserver.ts
	/**
	* Build a Media Session artwork array with multiple sizes from a single URL.
	* The OS picks the best size for its display (e.g. iOS lock screen).
	*/
	function buildMediaSessionArtwork(src) {
		const type = /\.png$/i.test(src) ? "image/png" : "image/jpeg";
		return [{
			src,
			sizes: "512x512",
			type
		}, {
			src,
			sizes: "1024x1024",
			type
		}];
	}
	/** Pull a bare URL out of a CSS `url("…")` value, if it is one. */
	function extractUrlFromCss(css) {
		const m = css.match(/url\(["']?([^"')]+)["']?\)/);
		return m ? m[1] : null;
	}
	/**
	* Resolve an artwork candidate (a track/background source) to a bare image URL
	* usable as Media Session artwork, or `undefined` when it isn't a real image.
	*
	* Callers may pass a plain URL or a raw CSS value. A `url("…")` wrapper is
	* unwrapped; a gradient (or any other CSS function) is rejected so a non-image
	* background never yields a malformed `MediaImage` the OS can't render.
	*/
	function resolveArtworkSrc(value) {
		if (typeof value !== "string") return void 0;
		const trimmed = value.trim();
		if (!trimmed) return void 0;
		const fromCss = extractUrlFromCss(trimmed);
		if (fromCss) return fromCss;
		if (/^[a-z-]+\(/i.test(trimmed)) return void 0;
		return trimmed;
	}
	/**
	* Media Session API integration (progressive enhancement) as a reusable hook,
	* so any skin — the built-in `AudioPlayer` or a custom headless one — gets
	* lock-screen metadata and OS media controls from the same engine.
	*
	* Does nothing (silently) when the browser has no `navigator.mediaSession`.
	*
	* IMPORTANT: metadata is *not* cleared on dependency changes — doing so
	* causes iOS to briefly lose artwork on track transitions. The new metadata
	* overwrites the previous entry directly.
	*/
	function useMediaSessionObserver(engine, options) {
		const latest = (0, react.useRef)({
			engine,
			options
		});
		latest.current = {
			engine,
			options
		};
		(0, react.useEffect)(() => {
			if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
			const ms = navigator.mediaSession;
			ms.metadata = new MediaMetadata({
				title: options.title,
				artist: options.artist ?? "",
				album: options.album ?? "",
				artwork: options.artwork ?? []
			});
		}, [
			options.title,
			options.artist,
			options.album,
			options.artwork
		]);
		(0, react.useEffect)(() => {
			if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
			const ms = navigator.mediaSession;
			const actions = [
				"play",
				"pause",
				"previoustrack",
				"nexttrack",
				"seekbackward",
				"seekforward",
				"stop"
			];
			const handlers = {
				play: () => latest.current.engine.play(true),
				pause: () => latest.current.engine.pause(),
				previoustrack: () => latest.current.options.onPrevious?.(),
				nexttrack: () => latest.current.options.onNext?.(),
				seekbackward: () => {
					const step = latest.current.options.seekStep ?? 10;
					latest.current.engine.seekBy(-step);
				},
				seekforward: () => {
					const step = latest.current.options.seekStep ?? 10;
					latest.current.engine.seekBy(step);
				},
				stop: () => latest.current.engine.pause()
			};
			for (const action of actions) try {
				ms.setActionHandler(action, handlers[action]);
			} catch {}
			return () => {
				for (const action of actions) try {
					ms.setActionHandler(action, null);
				} catch {}
			};
		}, []);
		(0, react.useEffect)(() => {
			if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
			navigator.mediaSession.playbackState = engine.isPlaying ? "playing" : "paused";
		}, [engine.isPlaying]);
	}
	//#endregion
	//#region src/audio-player/utils/formatTime.ts
	/** Format a number of seconds as `m:ss`. Returns `0:00` for invalid input. */
	function formatTime(time) {
		if (!Number.isFinite(time) || time < 0) return "0:00";
		return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, "0")}`;
	}
	//#endregion
	//#region src/audio-player/components/ProgressBar.tsx
	/**
	* Fully custom, div-based scrubber. A single Pointer Events pipeline handles
	* mouse, touch, and pen identically (no separate touch path), which removes the
	* dual-system jank of a native <input type="range">. Keyboard accessibility is
	* re-implemented here since we no longer get it from the native control.
	*
	* During a drag, the thumb/fill update locally at full frame rate without
	* touching the <audio> element. The final seek is applied once on pointer up,
	* preventing repeated seeks at 60-120Hz from causing audio stutter or decode lag.
	*
	* Unmount safety: pointer capture is tracked in a ref and released in a
	* `useEffect` cleanup so a drag that ends in an unmount cannot leak a captured
	* pointer back to the document.
	*/
	function ProgressBar({ currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd }) {
		const trackRef = (0, react.useRef)(null);
		const dragTimeRef = (0, react.useRef)(null);
		/**
		* Captured pointer bookkeeping. `captureId` is the pointer id we asked the
		* browser to capture; `captureTarget` is the element that owns the
		* capture. The unmount effect calls `releasePointerCapture` on the stored
		* target so a mid-drag unmount never leaves the browser with a dangling
		* capture pointing at a detached node.
		*/
		const captureIdRef = (0, react.useRef)(null);
		const captureTargetRef = (0, react.useRef)(null);
		const [dragTime, setDragTime] = (0, react.useState)(null);
		const ratioFromEvent = (0, react.useCallback)((clientX) => {
			const el = trackRef.current;
			if (!el) return 0;
			const rect = el.getBoundingClientRect();
			if (rect.width <= 0) return 0;
			return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		}, []);
		const releaseCapture = (0, react.useCallback)(() => {
			const target = captureTargetRef.current;
			const id = captureIdRef.current;
			if (target !== null && id !== null) try {
				if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
			} catch {}
			captureTargetRef.current = null;
			captureIdRef.current = null;
		}, []);
		const handlePointerDown = (0, react.useCallback)((event) => {
			if (disabled || duration <= 0 || event.button !== 0) return;
			const target = event.currentTarget;
			try {
				target.setPointerCapture(event.pointerId);
			} catch {}
			captureTargetRef.current = target;
			captureIdRef.current = event.pointerId;
			const time = ratioFromEvent(event.clientX) * duration;
			dragTimeRef.current = time;
			setDragTime(time);
			onSeekStart();
			onSeek(time);
		}, [
			disabled,
			duration,
			onSeek,
			onSeekStart,
			ratioFromEvent
		]);
		const handlePointerMove = (0, react.useCallback)((event) => {
			if (disabled || duration <= 0) return;
			if (captureIdRef.current === null || event.pointerId !== captureIdRef.current) return;
			const time = ratioFromEvent(event.clientX) * duration;
			dragTimeRef.current = time;
			setDragTime(time);
		}, [
			disabled,
			duration,
			ratioFromEvent
		]);
		const handlePointerUp = (0, react.useCallback)((event) => {
			const id = captureIdRef.current;
			if (id === null || event.pointerId !== id) return;
			if (dragTimeRef.current !== null) onSeek(dragTimeRef.current);
			releaseCapture();
			dragTimeRef.current = null;
			setDragTime(null);
			onSeekEnd();
		}, [
			onSeek,
			onSeekEnd,
			releaseCapture
		]);
		const handleKeyDown = (0, react.useCallback)((event) => {
			if (disabled || duration <= 0) return;
			let next = null;
			const step = event.shiftKey ? 30 : 5;
			switch (event.key) {
				case "ArrowRight":
				case "ArrowUp":
					next = currentTime + step;
					break;
				case "ArrowLeft":
				case "ArrowDown":
					next = currentTime - step;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = duration;
					break;
				case "PageUp":
					next = currentTime + 10;
					break;
				case "PageDown":
					next = currentTime - 10;
					break;
				default: return;
			}
			event.preventDefault();
			onSeek(next);
		}, [
			currentTime,
			disabled,
			duration,
			onSeek
		]);
		(0, react.useEffect)(() => {
			return () => {
				releaseCapture();
			};
		}, [releaseCapture]);
		const displayTime = dragTime !== null ? dragTime : currentTime;
		const rawProgressPct = duration > 0 ? displayTime / duration * 100 : 0;
		const rawBufferedPct = duration > 0 ? buffered / duration * 100 : 0;
		const clampPct = (v) => Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
		const progressPct = clampPct(rawProgressPct);
		const bufferedPct = clampPct(rawBufferedPct);
		const ariaValueNow = Number.isFinite(displayTime) && displayTime > 0 ? Math.round(displayTime * 10) / 10 : 0;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: trackRef,
			className: `ap-progress${isSeeking ? " ap-progress--seeking" : ""}`,
			role: "slider",
			tabIndex: disabled ? -1 : 0,
			"aria-label": disabled ? "Seek unavailable. Audio file missing" : "Seek",
			"aria-valuemin": 0,
			"aria-valuemax": Math.floor(duration),
			"aria-valuenow": ariaValueNow,
			"aria-valuetext": `${formatTime(displayTime)} of ${formatTime(duration)}`,
			"aria-disabled": disabled,
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onPointerCancel: handlePointerUp,
			onKeyDown: handleKeyDown,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ap-progress__track" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-progress__buffered",
					style: { width: `${bufferedPct}%` }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-progress__fill",
					style: { width: `${progressPct}%` }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-progress__thumb",
					style: { left: `${progressPct}%` }
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/core/waveform/peaks.ts
	/**
	* Waveform peak extraction. Produces the `peaks` arrays wavesurfer.js accepts
	* (per-channel 0–1 amplitudes) from decoded PCM, plus a fetch+decode fallback
	* for backends that stream and never hold decoded data.
	*/
	/** Fixed bucket count: render cost stays constant regardless of track length. */
	var DEFAULT_BUCKETS = 1024;
	/**
	* Reduce an AudioBuffer to a single merged-mono peaks channel: the abs-max
	* sample per bucket across up to two channels. wavesurfer renders a single
	* channel as a symmetric waveform, and `normalize: true` handles scaling.
	*/
	function extractPeaks(buffer, buckets = DEFAULT_BUCKETS) {
		const length = buffer.length;
		if (length === 0 || buckets <= 0) return [[]];
		const bucketCount = Math.min(buckets, length);
		const step = length / bucketCount;
		const channels = [];
		for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) channels.push(buffer.getChannelData(c));
		const merged = new Array(bucketCount);
		for (let i = 0; i < bucketCount; i++) {
			const start = Math.floor(i * step);
			const end = Math.min(length, Math.floor((i + 1) * step) || start + 1);
			let max = 0;
			for (const data of channels) for (let j = start; j < end; j++) {
				const value = Math.abs(data[j]);
				if (value > max) max = value;
			}
			merged[i] = max;
		}
		return [merged];
	}
	/**
	* Decoded-peaks LRU keyed by URL so StrictMode remounts, track revisits, and
	* retries never re-download or re-decode. Stores only the reduced peaks
	* (~8KB each), not the PCM.
	*/
	var peaksCache = /* @__PURE__ */ new Map();
	var PEAKS_CACHE_LIMIT = 10;
	var inFlight = /* @__PURE__ */ new Map();
	function cachePut(url, value) {
		peaksCache.delete(url);
		peaksCache.set(url, value);
		while (peaksCache.size > PEAKS_CACHE_LIMIT) {
			const oldest = peaksCache.keys().next().value;
			if (oldest === void 0) break;
			peaksCache.delete(oldest);
		}
	}
	/**
	* Fetch and decode an audio URL into waveform peaks. Used as the fallback for
	* the html5 backend, where no decoded data exists — note this downloads the
	* file a second time and requires CORS on remote sources.
	*
	* Decodes through a throwaway OfflineAudioContext so it never consumes the
	* shared playback AudioContext.
	*/
	async function computePeaksFromUrl(url, signal) {
		const cached = peaksCache.get(url);
		if (cached) {
			cachePut(url, cached);
			return cached;
		}
		const pending = inFlight.get(url);
		if (pending) return pending;
		const run = (async () => {
			try {
				const response = await fetch(url, { signal });
				if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
				const data = await response.arrayBuffer();
				const buffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
				const result = {
					peaks: extractPeaks(buffer),
					duration: buffer.duration
				};
				cachePut(url, result);
				return result;
			} finally {
				inFlight.delete(url);
			}
		})();
		inFlight.set(url, run);
		return run;
	}
	//#endregion
	//#region src/audio-player/components/WaveformProgress.tsx
	/** Resolve a color prop, falling back to a CSS custom property on the wrapper
	* (canvas fillStyle cannot evaluate `var()` strings). Explicit `var(--x)`
	* values are resolved against the wrapper's computed style too. */
	function resolveColor(el, explicit, cssVar, fallback) {
		if (explicit) {
			if (!explicit.includes("var(")) return explicit;
			const match = explicit.match(/var\(\s*([^,)]+)/);
			if (match?.[1]) {
				const resolved = getComputedStyle(el).getPropertyValue(match[1].trim()).trim();
				if (resolved) return resolved;
			}
		}
		return getComputedStyle(el).getPropertyValue(cssVar).trim() || fallback;
	}
	/**
	* Waveform scrubber rendered by wavesurfer.js. The engine remains the only
	* playback owner: wavesurfer is created with pre-resolved `peaks` + `duration`
	* only (never a URL or media element), progress is pushed in via `setTime`,
	* and click/drag interactions are forwarded out through the same
	* onSeek/onSeekStart/onSeekEnd contract as ProgressBar.
	*
	* While peaks are loading — or when they cannot be produced at all — the
	* regular ProgressBar renders in the same fixed-height slot, so scrubbing
	* always works and the layout never shifts.
	*/
	function WaveformProgress({ currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, peaks, peaksDuration, getDecodedData, url, sourceKey, height = 48, waveColor, progressColor, cursorColor }) {
		const wrapperRef = (0, react.useRef)(null);
		const containerRef = (0, react.useRef)(null);
		const wsRef = (0, react.useRef)(null);
		const draggingRef = (0, react.useRef)(false);
		const lastDragEndRef = (0, react.useRef)(0);
		const [status, setStatus] = (0, react.useState)("pending");
		const onSeekRef = (0, react.useRef)(onSeek);
		onSeekRef.current = onSeek;
		const onSeekStartRef = (0, react.useRef)(onSeekStart);
		onSeekStartRef.current = onSeekStart;
		const onSeekEndRef = (0, react.useRef)(onSeekEnd);
		onSeekEndRef.current = onSeekEnd;
		const durationRef = (0, react.useRef)(duration);
		durationRef.current = duration;
		const currentTimeRef = (0, react.useRef)(currentTime);
		currentTimeRef.current = currentTime;
		(0, react.useEffect)(() => {
			let cancelled = false;
			setStatus("pending");
			const resolvePeaks = async () => {
				if (peaks && peaks.length > 0 && (peaks[0]?.length ?? 0) > 0) {
					const d = peaksDuration ?? durationRef.current;
					if (d > 0) return {
						peaks,
						duration: d
					};
				}
				const decoded = getDecodedData?.();
				if (decoded) return {
					peaks: extractPeaks(decoded),
					duration: decoded.duration
				};
				if (url && url.trim().length > 0) return await computePeaksFromUrl(url);
				return null;
			};
			const run = async () => {
				try {
					const resolved = await resolvePeaks();
					if (cancelled) return;
					if (!resolved) return;
					const WaveSurferCtor = (await import("wavesurfer.js")).default;
					if (cancelled) return;
					const container = containerRef.current;
					const wrapper = wrapperRef.current;
					if (!container || !wrapper) return;
					wsRef.current?.destroy();
					container.innerHTML = "";
					const ws = WaveSurferCtor.create({
						container,
						peaks: resolved.peaks,
						duration: resolved.duration,
						height,
						normalize: true,
						interact: true,
						dragToSeek: false,
						barWidth: 2,
						barGap: 1,
						barRadius: 2,
						cursorWidth: 2,
						waveColor: resolveColor(wrapper, waveColor, "--ap-track", "rgba(204, 204, 204, 0.35)"),
						progressColor: resolveColor(wrapper, progressColor, "--ap-progress", "#FFFFFF"),
						cursorColor: resolveColor(wrapper, cursorColor, "--ap-accent", "#FFFFFF")
					});
					ws.on("dragstart", () => {
						draggingRef.current = true;
						onSeekStartRef.current();
					});
					ws.on("dragend", (relativeX) => {
						draggingRef.current = false;
						lastDragEndRef.current = performance.now();
						onSeekRef.current(relativeX * durationRef.current);
						onSeekEndRef.current();
					});
					ws.on("click", (relativeX) => {
						if (performance.now() - lastDragEndRef.current < 80) return;
						onSeekStartRef.current();
						onSeekRef.current(relativeX * durationRef.current);
						onSeekEndRef.current();
					});
					wsRef.current = ws;
					ws.setTime(currentTimeRef.current);
					setStatus("ready");
				} catch {
					if (!cancelled) setStatus("failed");
				}
			};
			run();
			return () => {
				cancelled = true;
				draggingRef.current = false;
				wsRef.current?.destroy();
				wsRef.current = null;
			};
		}, [
			sourceKey ?? url ?? "",
			duration > 0,
			peaks,
			peaksDuration,
			url,
			getDecodedData
		]);
		const rafIdRef = (0, react.useRef)(0);
		const lastPushedRef = (0, react.useRef)(-1);
		(0, react.useEffect)(() => {
			if (!wsRef.current || status !== "ready" || draggingRef.current) return;
			if (Math.abs(currentTime - lastPushedRef.current) < .01) return;
			if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = requestAnimationFrame(() => {
				rafIdRef.current = 0;
				const wsCurrent = wsRef.current;
				if (!wsCurrent || draggingRef.current) return;
				lastPushedRef.current = currentTime;
				wsCurrent.setTime(currentTime);
			});
			return () => {
				if (rafIdRef.current) {
					cancelAnimationFrame(rafIdRef.current);
					rafIdRef.current = 0;
				}
			};
		}, [currentTime, status]);
		(0, react.useEffect)(() => {
			const ws = wsRef.current;
			const wrapper = wrapperRef.current;
			if (!ws || !wrapper || status !== "ready") return;
			ws.setOptions({
				height,
				waveColor: resolveColor(wrapper, waveColor, "--ap-track", "rgba(204, 204, 204, 0.35)"),
				progressColor: resolveColor(wrapper, progressColor, "--ap-progress", "#FFFFFF"),
				cursorColor: resolveColor(wrapper, cursorColor, "--ap-accent", "#FFFFFF")
			});
		}, [
			height,
			waveColor,
			progressColor,
			cursorColor,
			status
		]);
		const handleKeyDown = (event) => {
			if (disabled || duration <= 0) return;
			let next = null;
			const step = event.shiftKey ? 30 : 5;
			switch (event.key) {
				case "ArrowRight":
				case "ArrowUp":
					next = currentTime + step;
					break;
				case "ArrowLeft":
				case "ArrowDown":
					next = currentTime - step;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = duration;
					break;
				case "PageUp":
					next = currentTime + 10;
					break;
				case "PageDown":
					next = currentTime - 10;
					break;
				default: return;
			}
			event.preventDefault();
			onSeek(next);
		};
		const showWave = status === "ready" && !disabled && duration > 0;
		const ariaValueNow = Number.isFinite(currentTime) && currentTime > 0 ? Math.round(currentTime * 10) / 10 : 0;
		const clampPct = (v) => Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
		const bufferedPct = clampPct(duration > 0 ? buffered / duration * 100 : 0);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: wrapperRef,
			className: `ap-waveform${isSeeking ? " ap-waveform--seeking" : ""}`,
			style: { height: `${height}px` },
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ap-waveform__surface",
				role: "slider",
				tabIndex: showWave ? 0 : -1,
				"aria-label": "Seek",
				"aria-valuemin": 0,
				"aria-valuemax": Math.floor(duration),
				"aria-valuenow": ariaValueNow,
				"aria-valuetext": `${formatTime(currentTime)} of ${formatTime(duration)}`,
				"aria-disabled": disabled,
				onKeyDown: handleKeyDown,
				style: { visibility: showWave ? "visible" : "hidden" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: containerRef,
					className: "ap-waveform__canvas"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-waveform__buffered",
					style: { width: `${bufferedPct}%` }
				})]
			}), !showWave && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-waveform__fallback",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
					currentTime,
					duration,
					buffered,
					disabled,
					isSeeking,
					onSeek,
					onSeekStart,
					onSeekEnd
				})
			})]
		});
	}
	//#endregion
	//#region src/audio-player/surfaces/faceCapabilities.ts
	/**
	* Family-level capability defaults. A face declares its `family` and overrides
	* only the handful of fields where it diverges, so the contract lives in one
	* place per family instead of being re-spelled per face.
	*/
	var FAMILY_DEFAULTS = {
		primary: {
			supportsSEICanvas: true,
			supportsAction: true,
			supportsScrubberCanvas: true,
			supportsWaveform: true,
			supportsContextualActions: true,
			supportsHeroCollapse: true,
			preferredCanvasPlacement: "main",
			scrubberDensity: "standard"
		},
		compact: {
			supportsSEICanvas: false,
			supportsAction: true,
			supportsScrubberCanvas: false,
			supportsWaveform: false,
			supportsContextualActions: false,
			supportsHeroCollapse: false,
			preferredCanvasPlacement: "none",
			scrubberDensity: "compact"
		},
		narrative: {
			supportsSEICanvas: false,
			supportsAction: false,
			supportsScrubberCanvas: false,
			supportsWaveform: false,
			supportsContextualActions: false,
			supportsHeroCollapse: false,
			preferredCanvasPlacement: "none",
			scrubberDensity: "compact"
		}
	};
	var PLAYER_FACE_CAPABILITIES = Object.fromEntries(Object.entries({
		fullCard: { family: "primary" },
		portable: {
			family: "primary",
			scrubberDensity: "expanded"
		},
		seaCard: {
			family: "primary",
			supportsContextualActions: false,
			preferredCanvasPlacement: "overlay"
		},
		miniSidebar: {
			family: "compact",
			supportsContextualActions: true
		},
		stickyBottom: {
			family: "compact",
			supportsScrubberCanvas: true
		},
		vaultRow: { family: "compact" },
		narrative: { family: "narrative" }
	}).map(([face, def]) => {
		const { family, ...overrides } = def;
		return [face, {
			family,
			...FAMILY_DEFAULTS[family],
			...overrides
		}];
	}));
	function getFaceCapability(face) {
		return PLAYER_FACE_CAPABILITIES[face];
	}
	/** The family a face belongs to (primary | compact). */
	function getFaceFamily(face) {
		return getFaceCapability(face).family;
	}
	/** Whether a face renders its own action button (the per-face action entry). */
	function faceSupportsAction(face) {
		return getFaceCapability(face).supportsAction;
	}
	function faceSupportsSEICanvas(face) {
		return getFaceCapability(face).supportsSEICanvas;
	}
	function faceSupportsScrubberCanvas(face) {
		return getFaceCapability(face).supportsScrubberCanvas;
	}
	function faceSupportsContextualActions(face) {
		return getFaceCapability(face).supportsContextualActions;
	}
	function faceSupportsWaveform(face) {
		return getFaceCapability(face).supportsWaveform;
	}
	/**
	* Pixel height for the waveform canvas at a given scrubber density. Compact
	* faces draw a shorter wave; the standalone/expanded faces get the full height.
	* Callers may still override with an explicit `height` prop.
	*/
	function getScrubberHeight(density) {
		switch (density) {
			case "compact": return 28;
			case "expanded": return 64;
			default: return 48;
		}
	}
	function faceSupportsHeroCollapse(face) {
		return getFaceCapability(face).supportsHeroCollapse ?? false;
	}
	function getScrubberDensity(face) {
		return getFaceCapability(face).scrubberDensity ?? "standard";
	}
	function getPreferredCanvasPlacement(face) {
		return getFaceCapability(face).preferredCanvasPlacement ?? "none";
	}
	//#endregion
	//#region src/audio-player/components/WaveformAdapter.tsx
	/**
	* The single, session-agnostic bridge between a scrubber zone and its content.
	* It chooses the waveform (`WaveformProgress`) or the plain `ProgressBar` from
	* the face capability (overridable via `waveform`), so every face — session-based
	* or the standalone player — renders the same scrubber through one component.
	*
	* It owns no playback state: all seeking flows out through the same
	* onSeek/onSeekStart/onSeekEnd contract as `ProgressBar`. `WaveformProgress`
	* already falls back to a `ProgressBar` internally while peaks load or when none
	* can be produced, so the timeline always works and never shifts layout.
	*/
	function WaveformAdapter({ face, density, currentTime, duration, buffered, disabled, isSeeking, onSeek, onSeekStart, onSeekEnd, peaks, peaksDuration, getDecodedData, url, sourceKey, height, waveColor, progressColor, cursorColor, waveform }) {
		if (!(waveform ?? faceSupportsWaveform(face))) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
			currentTime,
			duration,
			buffered,
			disabled,
			isSeeking,
			onSeek,
			onSeekStart,
			onSeekEnd
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformProgress, {
			currentTime,
			duration,
			buffered,
			disabled,
			isSeeking,
			onSeek,
			onSeekStart,
			onSeekEnd,
			peaks,
			peaksDuration,
			getDecodedData,
			url,
			sourceKey,
			height: height ?? getScrubberHeight(density),
			waveColor,
			progressColor,
			cursorColor
		});
	}
	//#endregion
	//#region src/audio-player/components/BackgroundMedia.tsx
	/** Map the new media prop and the legacy props onto a single normalized shape. */
	function resolveMedia(input) {
		const { media, legacyImage, legacyCss } = input;
		if (media && media.src) {
			if (media.kind === "video") return {
				media,
				cssBackground: null
			};
			return {
				media: null,
				cssBackground: `url("${media.src}")`
			};
		}
		if (legacyImage?.src) return {
			media: null,
			cssBackground: `url("${legacyImage.src}")`
		};
		if (legacyCss && legacyCss.trim()) return {
			media: null,
			cssBackground: legacyCss
		};
		return {
			media: null,
			cssBackground: null
		};
	}
	/**
	* Force the `muted` DOM property on a `<video>`. React's `muted` prop is applied
	* as a property and is unreliable on first paint, which can block autoplay; a ref
	* that sets `el.muted = true` guarantees it before the browser evaluates autoplay.
	*/
	function ensureMuted(el) {
		if (el) el.muted = true;
	}
	/**
	* The shared background/artwork media renderer used across faces. Renders a
	* muted, looping `<video>` for video media (visual-only — the engine `<audio>`
	* stays the sole audio owner) or the existing `.ap-bg-image` div for an image /
	* gradient, plus the optional darken overlay. Blur is inherited from the
	* `--ap-blur` CSS variable the face root sets, so callers don't pass it here.
	* Returns `null` when there is nothing to render.
	*/
	function BackgroundMedia({ media, cssBackground, darkenAmount = 0, className }) {
		const darken = darkenAmount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ap-bg-darken",
			style: { backgroundColor: `rgba(0,0,0,${darkenAmount / 100})` },
			"aria-hidden": "true"
		}) : null;
		if (media && media.kind === "video") {
			const style = media.fit === "contain" ? { objectFit: "contain" } : void 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				className: `ap-bg-video${className ? ` ${className}` : ""}`,
				src: media.src,
				poster: media.poster,
				ref: ensureMuted,
				muted: true,
				autoPlay: media.autoPlay ?? true,
				loop: media.loop ?? true,
				playsInline: true,
				preload: "metadata",
				"aria-hidden": "true",
				style
			}), darken] });
		}
		if (cssBackground) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `ap-bg-image${className ? ` ${className}` : ""}`,
			style: { backgroundImage: cssBackground },
			"aria-hidden": "true"
		}), darken] });
		return null;
	}
	//#endregion
	//#region src/audio-player/surfaces/ScrubberCanvasHost.tsx
	/**
	* The timeline render zone (ScrubberCanvas). Available on every face; density
	* adapts the layout. It owns only chrome/layout — seeking flows straight through
	* `onSeek`. The default fallback is the existing ProgressBar.
	*
	* The stable `[data-scrubber-host]` container is the future plugin mount point.
	*/
	function ScrubberCanvasHost({ face, density, currentTime, duration, progress, onSeek, activeSurfaceId, children }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ap-scrubber-host",
			"data-scrubber-host": "",
			"data-density": density,
			"data-face": face,
			"data-surface-id": activeSurfaceId,
			"data-progress": Math.round(progress * 100),
			children: children ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FallbackScrubber, {
				currentTime,
				duration,
				onSeek
			})
		});
	}
	/**
	* Internal default used when a face has no bespoke scrubber to pass in (e.g. the
	* mini sidebar, which had no progress bar before). Manages its own seeking state
	* so the mission's host prop signature stays minimal.
	*/
	function FallbackScrubber({ currentTime, duration, onSeek }) {
		const [isSeeking, setIsSeeking] = (0, react.useState)(false);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
			currentTime,
			duration,
			buffered: 0,
			disabled: duration <= 0,
			isSeeking,
			onSeek,
			onSeekStart: () => setIsSeeking(true),
			onSeekEnd: () => setIsSeeking(false)
		});
	}
	//#endregion
	//#region src/audio-player/surfaces/surfaceReducer.ts
	var INITIAL_SURFACE_STATE = { mode: "default" };
	/** Canvas mode is only legal on faces that DECLARE SEICanvas support. */
	function canEnterCanvas(face) {
		return faceSupportsSEICanvas(face);
	}
	/**
	* Pure surface transition. `face` is passed in so capability is enforced in one
	* place: a request to enter canvas on an unsupported face is a no-op.
	*/
	function surfaceReducer(state, action, face) {
		switch (action.type) {
			case "toggleCanvas":
				if (!canEnterCanvas(face)) return state;
				return { mode: state.mode === "canvas" ? "default" : "canvas" };
			case "toggleQueue": return { mode: state.mode === "queue" ? "default" : "queue" };
			case "open":
				if (action.mode === "canvas" && !canEnterCanvas(face)) return state;
				if (state.mode === action.mode) return state;
				return { mode: action.mode };
			case "close":
				if (state.mode === "default") return state;
				return INITIAL_SURFACE_STATE;
			default: return state;
		}
	}
	/**
	* Whether the hero should render collapsed. True only when the canvas surface is
	* open AND the face declares hero-collapse support — derived, never stored, so
	* it can't drift from `mode`.
	*/
	function deriveHeroCollapsed(mode, face) {
		return mode === "canvas" && faceSupportsHeroCollapse(face);
	}
	//#endregion
	//#region src/audio-player/surfaces/usePlayerSurface.ts
	/**
	* React layer over the pure {@link surfaceReducer}. No effects or subscriptions,
	* so it is StrictMode-safe and the reducer stays the single source of truth.
	*/
	function usePlayerSurface(face) {
		const [state, dispatch] = (0, react.useReducer)((s, action) => surfaceReducer(s, action, face), INITIAL_SURFACE_STATE);
		const toggleCanvas = (0, react.useCallback)(() => dispatch({ type: "toggleCanvas" }), []);
		const toggleQueue = (0, react.useCallback)(() => dispatch({ type: "toggleQueue" }), []);
		const closeSurface = (0, react.useCallback)(() => dispatch({ type: "close" }), []);
		return (0, react.useMemo)(() => ({
			mode: state.mode,
			isCanvasOpen: state.mode === "canvas",
			isQueueOpen: state.mode === "queue",
			isHeroCollapsed: deriveHeroCollapsed(state.mode, face),
			canvasSupported: faceSupportsSEICanvas(face),
			contextualSupported: faceSupportsContextualActions(face),
			toggleCanvas,
			toggleQueue,
			closeSurface
		}), [
			state.mode,
			face,
			toggleCanvas,
			toggleQueue,
			closeSurface
		]);
	}
	//#endregion
	//#region src/audio-player/skins/icons.tsx
	var PlayIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5v14l12-7z" })
	});
	var PauseIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "6",
			y: "4",
			width: "4",
			height: "16"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "14",
			y: "4",
			width: "4",
			height: "16"
		})]
	});
	var SpinnerIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: "ap-spin",
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "12",
			cy: "12",
			r: "10",
			opacity: "0.25"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M12 2a10 10 0 0 1 10 10",
			strokeLinecap: "round"
		})]
	});
	var PrevIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "5",
			y: "4",
			width: "2.5",
			height: "16",
			rx: "0.5"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 5v14L9 12z" })]
	});
	var NextIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 5v14l11-7z" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "16.5",
			y: "4",
			width: "2.5",
			height: "16",
			rx: "0.5"
		})]
	});
	var ShuffleIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "16 3 21 3 21 8" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "4",
				y1: "20",
				x2: "21",
				y2: "3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "21 16 21 21 16 21" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "15",
				y1: "15",
				x2: "21",
				y2: "21"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "4",
				y1: "4",
				x2: "9",
				y2: "9"
			})
		]
	});
	var RepeatIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "17 1 21 5 17 9" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "7 23 3 19 7 15" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 13v2a4 4 0 0 1-4 4H3" })
		]
	});
	var RepeatOneIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "17 1 21 5 17 9" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "7 23 3 19 7 15" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: "12",
				y: "15",
				textAnchor: "middle",
				fontSize: "8",
				fontWeight: "700",
				fill: "currentColor",
				stroke: "none",
				fontFamily: "system-ui, sans-serif",
				children: "1"
			})
		]
	});
	var AutomixIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 7c6 0 6 10 12 10h6" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 17c6 0 6-10 12-10h6" })]
	});
	var ErrorIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "10"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "8",
				x2: "12",
				y2: "12"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "16",
				x2: "12.01",
				y2: "16"
			})
		]
	});
	var DotsIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "5",
				cy: "12",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "19",
				cy: "12",
				r: "1.8"
			})
		]
	});
	var QueueIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "8",
				y1: "6",
				x2: "21",
				y2: "6"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "8",
				y1: "12",
				x2: "21",
				y2: "12"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "8",
				y1: "18",
				x2: "21",
				y2: "18"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "3",
				y1: "6",
				x2: "3.01",
				y2: "6"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "3",
				y1: "12",
				x2: "3.01",
				y2: "12"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "3",
				y1: "18",
				x2: "3.01",
				y2: "18"
			})
		]
	});
	var CanvasIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "3",
				y: "4",
				width: "18",
				height: "14",
				rx: "2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "8.5",
				cy: "9",
				r: "1.6"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 15l-5-4-7 6" })
		]
	});
	var WaveIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 12v0M8 8v8M12 4v16M16 8v8M20 12v0" })
	});
	var ShareIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "18",
				cy: "5",
				r: "3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "6",
				cy: "12",
				r: "3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "18",
				cy: "19",
				r: "3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "8.59",
				y1: "13.51",
				x2: "15.42",
				y2: "17.49"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "15.41",
				y1: "6.51",
				x2: "8.59",
				y2: "10.49"
			})
		]
	});
	var CheckIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "20 6 9 17 4 12" })
	});
	var LyricsIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 18V5l12-2v13" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "6",
				cy: "18",
				r: "3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "18",
				cy: "16",
				r: "3"
			})
		]
	});
	var AutoPlayIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
			points: "6 4 20 12 6 20 6 4",
			fill: "currentColor",
			stroke: "none"
		})
	});
	var PluginIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 2v6" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 8h8v4a4 4 0 0 1-8 0z" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 2v4M15 2v4" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 16v6" })
		]
	});
	var ChevronLeftIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "15 18 9 12 15 6" })
	});
	var CloseIcon$2 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "6",
			y1: "6",
			x2: "18",
			y2: "18"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "18",
			y1: "6",
			x2: "6",
			y2: "18"
		})]
	});
	var PlaybackIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "12",
			cy: "12",
			r: "9"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M10 9l5 3-5 3z",
			fill: "currentColor",
			stroke: "none"
		})]
	});
	var VisualIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "12",
			cy: "12",
			r: "3"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" })]
	});
	var AnalyticsIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "6",
				y1: "20",
				x2: "6",
				y2: "12"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "20",
				x2: "12",
				y2: "4"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "18",
				y1: "20",
				x2: "18",
				y2: "9"
			})
		]
	});
	var AgentIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "5",
				y: "8",
				width: "14",
				height: "11",
				rx: "2.5"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 4v4" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "3",
				r: "1.4",
				fill: "currentColor",
				stroke: "none"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "9.5",
				cy: "13",
				r: "1.2",
				fill: "currentColor",
				stroke: "none"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "14.5",
				cy: "13",
				r: "1.2",
				fill: "currentColor",
				stroke: "none"
			})
		]
	});
	var CommentsIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.8L3 21l1.3-4a8.5 8.5 0 0 1-1-4A8.38 8.38 0 0 1 11.5 4 8.38 8.38 0 0 1 21 11.5z" })
	});
	var LockIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "5",
			y: "11",
			width: "14",
			height: "9",
			rx: "2"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 11V8a4 4 0 0 1 8 0v3" })]
	});
	//#endregion
	//#region src/audio-player/surfaces/SurfaceButton.tsx
	/**
	* The single shared surface-toggle button shell (Apple-Music style). Both the
	* canvas (left) and queue (right) buttons render through this one component, so
	* their size, shape, padding, press animation, and active styling are identical
	* by construction. Active state is exposed via `aria-pressed` + a modifier class.
	*/
	function SurfaceButton({ active, children, onClick, label, disabled = false, className }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: `ap-surface-btn ap-tap${active ? " ap-surface-btn--active" : ""}${className ? ` ${className}` : ""}`,
			onClick,
			disabled,
			"aria-pressed": active,
			"aria-label": label,
			children
		});
	}
	//#endregion
	//#region src/audio-player/menu/menuData.ts
	/**
	* The V1 hardcoded menu tree. A builder (not a constant) so per-face capability
	* and live surface state can adjust node states without the arc knowing about
	* the player. Replaceable later by a plugin-registry-driven tree of the same shape.
	*/
	function buildMenuTree({ canvasSupported, isCanvasActive, includeTransport = false, canPrevious = false, canNext = false }) {
		return [
			{
				id: "plugin",
				label: "Plugin",
				icon: PluginIcon,
				children: [
					{
						id: "visual",
						label: "Visual",
						icon: VisualIcon,
						children: [
							{
								id: "lyrics",
								label: "Lyrics",
								icon: LyricsIcon,
								state: "inactive",
								actionId: "select-lyrics",
								workspaceRoute: "plugin-settings:lyrics"
							},
							{
								id: "canvas",
								label: "Canvas",
								icon: CanvasIcon,
								state: !canvasSupported ? "disabled" : isCanvasActive ? "active" : "available",
								actionId: "activate-canvas"
							},
							{
								id: "comments",
								label: "Comments",
								icon: CommentsIcon,
								state: "coming-soon"
							}
						]
					},
					{
						id: "plugin-playback",
						label: "Playback",
						icon: PlaybackIcon,
						state: "coming-soon"
					},
					{
						id: "analytics",
						label: "Analytics",
						icon: AnalyticsIcon,
						state: "coming-soon"
					}
				]
			},
			{
				id: "playback",
				label: "Playback",
				icon: PlaybackIcon,
				children: [
					...includeTransport ? [{
						id: "previous-track",
						label: "Previous",
						icon: PrevIcon$1,
						state: canPrevious ? "available" : "disabled",
						actionId: "previous-track"
					}, {
						id: "next-track",
						label: "Next",
						icon: NextIcon$1,
						state: canNext ? "available" : "disabled",
						actionId: "next-track"
					}] : [],
					{
						id: "up-next",
						label: "Up Next",
						icon: QueueIcon,
						actionId: "open-queue",
						workspaceRoute: "library:queue"
					},
					{
						id: "automix",
						label: "Automix",
						icon: AutomixIcon,
						state: "coming-soon",
						workspaceRoute: "playback:automix"
					},
					{
						id: "repeat",
						label: "Repeat",
						icon: RepeatIcon,
						state: "coming-soon"
					}
				]
			},
			{
				id: "agent",
				label: "Agent",
				icon: AgentIcon,
				state: "coming-soon",
				workspaceRoute: "agent:queue-director"
			},
			{
				id: "activity-log",
				label: "Activity Log",
				icon: AnalyticsIcon,
				state: "available",
				workspaceRoute: "diagnostics:activity-log"
			}
		];
	}
	/** Whether a node can be interacted with (entered or actioned). */
	function isNodeInteractive(node) {
		const state = node.state ?? "available";
		return state !== "disabled" && state !== "locked" && state !== "coming-soon";
	}
	//#endregion
	//#region src/audio-player/surfaces/SEICanvasActionMenu.tsx
	/** Radius of the half-circle the nodes fan out on, in px. */
	var ARC_RADIUS = 128;
	/**
	* The `--ap-*` tokens the trigger inherits from the player root. Copied onto the
	* portal container so the menu stays themed even though it renders on
	* `document.body`, outside the player's token scope. Keeping this a plain list
	* (rather than importing the theme builder) lets the arc stay decoupled.
	*/
	var THEME_VARS = [
		"--ap-accent",
		"--ap-text",
		"--ap-play-icon",
		"--ap-bg",
		"--ap-vault-accent"
	];
	/**
	* Polar fan geometry: `n` points spread across a half-circle that opens upward
	* (angles 180°→0°), centered on the pivot. `y` is negative (up). A single item
	* sits straight above the pivot.
	*/
	function arcOffsets(n, radius = 128) {
		if (n <= 0) return [];
		if (n === 1) return [{
			x: 0,
			y: -radius
		}];
		return Array.from({ length: n }, (_, i) => {
			const rad = (180 - i / (n - 1) * 180) * Math.PI / 180;
			return {
				x: radius * Math.cos(rad),
				y: -radius * Math.sin(rad)
			};
		});
	}
	/** Walk `items` by the id `path` to the current submenu level + breadcrumb. */
	function resolveLevel(items, path) {
		let level = items;
		const trail = [];
		for (const id of path) {
			const node = level.find((n) => n.id === id);
			if (!node || !node.children) break;
			trail.push(node.label);
			level = node.children;
		}
		return {
			level,
			trail
		};
	}
	/** Default trigger glyph — a small command-wheel mark. */
	var TriggerIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "2.2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "4.5",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "18.5",
				cy: "15.5",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "5.5",
				cy: "15.5",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 6.7v3M13.8 13.1l2.8 1.6M10.2 13.1l-2.8 1.6" })
		]
	});
	/**
	* The SEI Canvas Action Menu: a bottom-anchored half-circle command wheel. The
	* closed state is a single round trigger that drops into the queue surface slot.
	* Tapping it opens a dimmed, blurred portal overlay that fans the menu items on
	* an arc, with submenu navigation, a depth-aware Close/Back center button, and a
	* breadcrumb. The arc's open + navigation state is entirely local here — it is an
	* overlay, never a player surface. Kept free of engine/session imports so it can
	* later be promoted into the seihouse-ui design system.
	*/
	function SEICanvasActionMenu({ items, onOpenQueue, onActivateCanvas, onSelect, onOpenWorkspace, ariaLabel = "Canvas actions", className }) {
		const triggerRef = (0, react.useRef)(null);
		const centerRef = (0, react.useRef)(null);
		const [open, setOpen] = (0, react.useState)(false);
		const [entered, setEntered] = (0, react.useState)(false);
		const [path, setPath] = (0, react.useState)([]);
		const [themeStyle, setThemeStyle] = (0, react.useState)({});
		const [arcRadius, setArcRadius] = (0, react.useState)(128);
		const close = (0, react.useCallback)(() => {
			setOpen(false);
			setEntered(false);
			setPath([]);
		}, []);
		const openMenu = (0, react.useCallback)(() => {
			const el = triggerRef.current;
			if (el) {
				const cs = getComputedStyle(el);
				const vars = {};
				for (const name of THEME_VARS) {
					const value = cs.getPropertyValue(name).trim();
					if (value) vars[name] = value;
				}
				setThemeStyle(vars);
			}
			setOpen(true);
		}, []);
		(0, react.useEffect)(() => {
			if (!open) return;
			const raf = requestAnimationFrame(() => setEntered(true));
			return () => cancelAnimationFrame(raf);
		}, [open]);
		(0, react.useEffect)(() => {
			if (!open || typeof window === "undefined") return;
			const updateRadius = () => {
				const vw = window.innerWidth;
				if (vw < 400) setArcRadius(96);
				else if (vw < 600) setArcRadius(112);
				else setArcRadius(128);
			};
			updateRadius();
			window.addEventListener("resize", updateRadius);
			return () => window.removeEventListener("resize", updateRadius);
		}, [open]);
		(0, react.useEffect)(() => {
			if (!open) return;
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			const raf = requestAnimationFrame(() => centerRef.current?.focus());
			const handleKey = (e) => {
				if (e.key === "Escape") close();
			};
			document.addEventListener("keydown", handleKey);
			return () => {
				document.body.style.overflow = prevOverflow;
				cancelAnimationFrame(raf);
				document.removeEventListener("keydown", handleKey);
				const trigger = triggerRef.current;
				if (trigger?.isConnected) trigger.focus();
			};
		}, [open, close]);
		const { level, trail } = resolveLevel(items, path);
		const offsets = arcOffsets(level.length, arcRadius);
		const handleNode = (0, react.useCallback)((node) => {
			if (!isNodeInteractive(node)) return;
			if (node.children && node.children.length > 0) {
				setPath((p) => [...p, node.id]);
				return;
			}
			if (node.workspaceRoute && onOpenWorkspace) {
				onOpenWorkspace(node.workspaceRoute);
				close();
				return;
			}
			switch (node.actionId) {
				case "open-queue":
					onOpenQueue?.();
					break;
				case "activate-canvas":
					onActivateCanvas?.();
					break;
				default: onSelect?.(node);
			}
			close();
		}, [
			close,
			onActivateCanvas,
			onOpenQueue,
			onOpenWorkspace,
			onSelect
		]);
		const handleCenter = (0, react.useCallback)(() => {
			if (path.length > 0) setPath((p) => p.slice(0, -1));
			else close();
		}, [close, path.length]);
		const inSubmenu = path.length > 0;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			ref: triggerRef,
			type: "button",
			className: `ap-surface-btn ap-tap${open ? " ap-surface-btn--active" : ""}${className ? ` ${className}` : ""}`,
			onClick: openMenu,
			"aria-haspopup": "menu",
			"aria-expanded": open,
			"aria-label": ariaLabel,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriggerIcon, {})
		}), open && typeof document !== "undefined" && (0, react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sac",
			style: themeStyle,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sac__backdrop",
				onPointerDown: (e) => {
					if (e.button === 0) close();
				},
				"aria-hidden": "true",
				"data-entered": entered
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sac__stage",
				role: "menu",
				"aria-label": ariaLabel,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sac__arc",
					"data-open": entered,
					style: { "--arc-radius": `${arcRadius}px` },
					children: [
						inSubmenu && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "sac__crumb",
							"aria-hidden": "true",
							children: trail.join(" › ")
						}),
						level.map((node, i) => {
							const state = node.state ?? "available";
							const interactive = isNodeInteractive(node);
							const offset = offsets[i];
							const Icon = node.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								className: `sac__node sac__node--${state}`,
								style: {
									"--sac-x": `${offset.x}px`,
									"--sac-y": `${offset.y}px`,
									transitionDelay: `${i * 8}ms`
								},
								onClick: () => handleNode(node),
								"aria-disabled": !interactive,
								"aria-haspopup": node.children ? "menu" : void 0,
								tabIndex: interactive ? 0 : -1,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sac__node-icon",
										children: state === "locked" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sac__node-label",
										children: node.label
									}),
									state === "coming-soon" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sac__badge",
										children: "soon"
									})
								]
							}, node.id);
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							ref: centerRef,
							type: "button",
							className: "sac__center ap-tap",
							onClick: handleCenter,
							"aria-label": inSubmenu ? "Back" : "Close menu",
							children: inSubmenu ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeftIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon$2, {})
						})
					]
				})
			})]
		}), document.body)] });
	}
	//#endregion
	//#region src/audio-player/surfaces/PlayerSurfaceButtons.tsx
	/**
	* The shared left/right surface controls. LEFT reveals the SEICanvas (only on
	* faces that support it). RIGHT is the SEI Canvas Action Menu — a bottom-arc
	* command wheel that replaces the old flat "Up Next" toggle. Queue lives inside
	* it under Playback › Up Next; the canvas under Plugin › Visual › Canvas.
	*/
	function PlayerSurfaceButtons({ surface, showCanvasButton = surface.canvasSupported, showQueueButton = surface.contextualSupported, onOpenQueue, showTransport = false, canPrevious = false, canNext = false, onPrevious, onNext, onOpenFocusedController, className }) {
		const menuItems = (0, react.useMemo)(() => showQueueButton ? buildMenuTree({
			canvasSupported: surface.canvasSupported,
			isCanvasActive: surface.isCanvasOpen,
			includeTransport: showTransport,
			canPrevious,
			canNext
		}) : [], [
			showQueueButton,
			surface.canvasSupported,
			surface.isCanvasOpen,
			showTransport,
			canPrevious,
			canNext
		]);
		const handleSelect = (0, react.useCallback)((node) => {
			if (node.actionId === "previous-track") onPrevious?.();
			else if (node.actionId === "next-track") onNext?.();
		}, [onNext, onPrevious]);
		const handleOpenWorkspace = (0, react.useCallback)((route) => {
			onOpenFocusedController?.(route);
		}, [onOpenFocusedController]);
		if (!showCanvasButton && !showQueueButton) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-surface-actions${className ? ` ${className}` : ""}`,
			role: "group",
			"aria-label": "Player surfaces",
			children: [showCanvasButton && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SurfaceButton, {
				active: surface.isCanvasOpen,
				onClick: surface.toggleCanvas,
				label: "SEI Canvas",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CanvasIcon, {})
			}), showQueueButton && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasActionMenu, {
				items: menuItems,
				onActivateCanvas: surface.toggleCanvas,
				onOpenQueue: onOpenQueue ?? surface.toggleQueue,
				onOpenWorkspace: handleOpenWorkspace,
				onSelect: handleSelect
			})]
		});
	}
	//#endregion
	//#region src/audio-player/surfaces/SEICanvasHost.tsx
	/**
	* The main visual surface region (SEICanvas). Phase 1 renders placeholder/demo
	* content only — no waveform, artwork, lyrics, or visualizers.
	*
	* - Returns `null` when the face doesn't support a canvas, so compact/mini faces
	*   never render this zone (capability-driven, not a layout check).
	* - When supported, it always renders a stable container (even while closed) so
	*   a future plugin can mount into `[data-sei-canvas-host]` reliably. Open/close
	*   is animated via the `data-open` attribute in CSS.
	*/
	function SEICanvasHost({ open, face, supported, activeSurfaceId, children }) {
		if (!supported) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ap-sei-canvas-host",
			"data-sei-canvas-host": "",
			"data-open": open ? "true" : "false",
			"data-face": face,
			"data-surface-id": activeSurfaceId,
			"aria-hidden": open ? void 0 : true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-sei-canvas-host__inner",
				children
			})
		});
	}
	//#endregion
	//#region src/audio-player/surfaces/QueueSurface.tsx
	/**
	* In-region "Up Next" surface (Apple-Music style), rendered inside the shared
	* surface region by the right surface button. Reads the shared session queue;
	* tap a row to jump to that track. This is intentionally lightweight — the full
	* drag-to-reorder/remove experience stays in the existing QueueDrawer overlay.
	*/
	function QueueSurface({ maxItems, className }) {
		const s = useAudioSession();
		const { queue, currentIndex } = s;
		const upcoming = queue.map((track, index) => ({
			track,
			index
		})).filter(({ index }) => index >= currentIndex);
		const items = typeof maxItems === "number" ? upcoming.slice(0, maxItems) : upcoming;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-queue-surface${className ? ` ${className}` : ""}`,
			role: "group",
			"aria-label": "Up next",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-queue-surface__head",
				children: "Up next"
			}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-queue-surface__empty",
				children: "Queue is empty"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "ap-queue-surface__list",
				children: items.map(({ track, index }) => {
					const isCurrent = index === currentIndex;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `ap-queue-surface__row ap-tap${isCurrent ? " ap-queue-surface__row--current" : ""}`,
						onClick: () => s.playTrack(index),
						"aria-current": isCurrent ? "true" : void 0,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-queue-surface__title",
							title: track.title,
							children: track.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-queue-surface__artist",
							title: track.artist,
							children: track.artist
						})]
					}) }, track.id ?? `${track.title}-${index}`);
				})
			})]
		});
	}
	//#endregion
	//#region src/audio-player/visual-slots/components/LyricDisplay.tsx
	var LYRIC_DISPLAY_ID = "lyric-display";
	var lyricDefaultSettings = {
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
		fontWeight: 600,
		fontSize: 18,
		lineHeight: 1.6,
		highlightColor: "#7cc4ff",
		animationMode: "fade"
	};
	var FONT_FAMILY_OPTIONS = [
		{
			label: "System Sans",
			value: lyricDefaultSettings.fontFamily
		},
		{
			label: "Serif",
			value: "Georgia, 'Times New Roman', serif"
		},
		{
			label: "Mono",
			value: "'SF Mono', 'Roboto Mono', Menlo, monospace"
		},
		{
			label: "Rounded",
			value: "'Nunito', 'Segoe UI', system-ui, sans-serif"
		}
	];
	var ANIMATION_OPTIONS = [
		{
			label: "None",
			value: "none"
		},
		{
			label: "Fade",
			value: "fade"
		},
		{
			label: "Slide",
			value: "slide"
		}
	];
	/** Split a raw lyrics blob into non-empty display lines. */
	function toLines(lyrics) {
		if (!lyrics) return [];
		return lyrics.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
	}
	/**
	* The mounted SEI Canvas visual. Playback context (lyrics, position, duration)
	* arrives via props from the host renderer rather than the global audio session,
	* so the component works in every player — including the portable one that has no
	* `AudioSessionProvider`. With no timed-lyric metadata available, the "active"
	* line is estimated from playback progress so the highlight still moves with the
	* track — a real, settings-driven visual rather than a placeholder.
	*/
	function LyricDisplay({ settings, playback }) {
		const currentTime = playback?.currentTime ?? 0;
		const duration = playback?.duration ?? 0;
		const lines = (0, react.useMemo)(() => toLines(playback?.lyrics), [playback?.lyrics]);
		const containerRef = (0, react.useRef)(null);
		const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
		const activeIndex = lines.length > 0 ? Math.min(lines.length - 1, Math.floor(ratio * lines.length)) : -1;
		(0, react.useEffect)(() => {
			(containerRef.current?.querySelector("[data-active=\"true\"]"))?.scrollIntoView({
				behavior: settings.animationMode === "none" ? "auto" : "smooth",
				block: "center",
				inline: "nearest"
			});
		}, [activeIndex, settings.animationMode]);
		if (lines.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-visual-lyric sap-visual-lyric--empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-visual-lyric__empty-title",
				children: "No lyrics"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-visual-lyric__empty-hint",
				children: "This track has no lyrics to display."
			})]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sap-visual-lyric",
			ref: containerRef,
			"data-animation": settings.animationMode,
			style: {
				fontFamily: settings.fontFamily,
				fontWeight: settings.fontWeight,
				fontSize: `${settings.fontSize}px`,
				lineHeight: settings.lineHeight
			},
			children: lines.map((line, i) => {
				const isActive = i === activeIndex;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "sap-visual-lyric__line",
					"data-active": isActive ? "true" : "false",
					style: isActive ? { color: settings.highlightColor } : void 0,
					children: line
				}, `${i}-${line}`);
			})
		});
	}
	/** A labeled field row used by the settings panel. */
	function Field({ label, children }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "sap-visual-field",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sap-visual-field__label",
				children: label
			}), children]
		});
	}
	/**
	* Controlled settings editor for the lyric display. Rendered through the lyrics
	* workspace route via {@link ControllerPanelRenderer}; edits flow back through
	* `onChange` and update the live SEI Canvas visual.
	*/
	function LyricSettingsPanel({ settings, onChange }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-visual-settings",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Font family",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						className: "sap-visual-input",
						value: settings.fontFamily,
						onChange: (e) => onChange({ fontFamily: e.target.value }),
						children: FONT_FAMILY_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: opt.value,
							children: opt.label
						}, opt.label))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: `Font weight (${settings.fontWeight})`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sap-visual-input",
						type: "range",
						min: 100,
						max: 900,
						step: 100,
						value: settings.fontWeight,
						onChange: (e) => onChange({ fontWeight: Number(e.target.value) })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: `Font size (${settings.fontSize}px)`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sap-visual-input",
						type: "range",
						min: 12,
						max: 48,
						step: 1,
						value: settings.fontSize,
						onChange: (e) => onChange({ fontSize: Number(e.target.value) })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: `Line height (${settings.lineHeight.toFixed(1)})`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sap-visual-input",
						type: "range",
						min: 1,
						max: 3,
						step: .1,
						value: settings.lineHeight,
						onChange: (e) => onChange({ lineHeight: Number(e.target.value) })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Highlight color",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sap-visual-input sap-visual-input--color",
						type: "color",
						value: settings.highlightColor,
						onChange: (e) => onChange({ highlightColor: e.target.value })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Animation mode",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						className: "sap-visual-input",
						value: settings.animationMode,
						onChange: (e) => onChange({ animationMode: e.target.value }),
						children: ANIMATION_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: opt.value,
							children: opt.label
						}, opt.value))
					})
				})
			]
		});
	}
	/** The registrable definition wiring the display + panel into the seiCanvas slot. */
	var lyricDisplayDefinition = {
		id: LYRIC_DISPLAY_ID,
		name: "Lyric Display",
		slot: "seiCanvas",
		Component: LyricDisplay,
		SettingsPanel: LyricSettingsPanel,
		defaultSettings: lyricDefaultSettings
	};
	//#endregion
	//#region src/audio-player/visual-slots/components/imported/sample-skin/raw.tsx
	/**
	* Sample visual component for testing the skin import CLI.
	* This is a minimal Sea-Workshop-Light format #2 (structured React) export.
	*/
	function SampleVisual({ primaryColor = "#7cc4ff", label = "Hello Skin" }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "container",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "title",
				style: { color: primaryColor },
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ring" })]
		});
	}
	//#endregion
	//#region src/audio-player/visual-slots/components/imported/sample-skin/SampleSkin.tsx
	/** Default settings for this skin. Edit to match your component's API. */
	var sampleSkinDefaultSettings = {};
	function SampleSkin({ settings, playback }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sap-visual-sample-skin",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SampleVisual, {})
		});
	}
	function SampleSkinSettingsPanel({ settings, onChange }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sap-visual-settings",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				style: {
					opacity: .6,
					fontSize: 12
				},
				children: [
					"No settings configured yet. Edit this panel in ",
					SampleSkin.name,
					".tsx."
				]
			})
		});
	}
	//#endregion
	//#region src/audio-player/visual-slots/builtins.ts
	/**
	* The built-in visual components SAP ships with. Registered by
	* {@link VisualSlotsProvider} on first mount. Order matters: the first entry for
	* a slot becomes that slot's default (see `getDefaultComponentForSlot`), so the
	* lyric display is the default `seiCanvas` visual and canvas mode shows it
	* immediately instead of a placeholder.
	*
	* To add the next Workshop-Light component: build it under `components/`, scope
	* its CSS, declare a definition, and append it here (or register it from a host
	* app via `registerVisualComponent`). No player-core edits required.
	*
	* Imported skins (from `npm run skin:import`) are spread after the built-ins so
	* LyricDisplay keeps its default position.
	*/
	var BUILTIN_VISUAL_COMPONENTS = [lyricDisplayDefinition, ...[{
		id: "sample-skin",
		name: "Sample Skin",
		slot: "seiCanvas",
		Component: SampleSkin,
		SettingsPanel: SampleSkinSettingsPanel,
		defaultSettings: sampleSkinDefaultSettings
	}]];
	//#endregion
	//#region src/audio-player/visual-slots/visualRegistry.ts
	/**
	* The visual component registry. A plain module-level map keyed by component id.
	* Registration is idempotent (re-registering the same id replaces it), so a host
	* app can override a built-in by registering its own definition under that id.
	*
	* This is deliberately tiny: it is an *intake* layer, not a plugin framework. It
	* holds no state about which component is active or what its settings are — that
	* lives per-player in {@link VisualSlotsProvider}.
	*/
	var REGISTRY = /* @__PURE__ */ new Map();
	/** Register (or replace) a visual component definition. */
	function registerVisualComponent(definition) {
		REGISTRY.set(definition.id, definition);
	}
	/** Look up a component by id, or `undefined` if not registered. */
	function getVisualComponent(id) {
		if (!id) return void 0;
		return REGISTRY.get(id);
	}
	/** All registered components targeting a given slot, in registration order. */
	function getVisualComponentsForSlot(slot) {
		const out = [];
		for (const def of REGISTRY.values()) if (def.slot === slot) out.push(def);
		return out;
	}
	/**
	* The default component for a slot: the first one registered into it. The lyric
	* display is registered first for `seiCanvas`, so canvas mode shows it on open.
	*/
	function getDefaultComponentForSlot(slot) {
		for (const def of REGISTRY.values()) if (def.slot === slot) return def;
	}
	/** All registered components (any slot). Used to seed the settings store. */
	function getAllVisualComponents() {
		return Array.from(REGISTRY.values());
	}
	//#endregion
	//#region src/audio-player/visual-slots/VisualSlotsContext.tsx
	for (const def of BUILTIN_VISUAL_COMPONENTS) registerVisualComponent(def);
	var EMPTY_OBJECT = {};
	/** Seed `activeBySlot` from the registry default for each slot. */
	function seedActive() {
		const slots = [
			"seiCanvas",
			"scrubberCanvas",
			"controllerPanel"
		];
		const out = {};
		for (const slot of slots) out[slot] = getDefaultComponentForSlot(slot)?.id ?? null;
		return out;
	}
	/** Seed `settingsById` from every registered component's defaultSettings. */
	function seedSettings() {
		const out = {};
		for (const def of getAllVisualComponents()) out[def.id] = { ...def.defaultSettings };
		return out;
	}
	var VisualSlotsContext = (0, react.createContext)(null);
	/**
	* Holds the active component per slot and the live settings per component for a
	* single player instance. Mounted inside each skin so the state reaches both the
	* SEI Canvas (player stage) and the settings panel (rendered through the
	* SAPController portal) — React context flows through portals.
	*/
	function VisualSlotsProvider({ children }) {
		const [activeBySlot, setActiveBySlot] = (0, react.useState)(seedActive);
		const [settingsById, setSettingsById] = (0, react.useState)(seedSettings);
		const getActive = (0, react.useCallback)((slot) => activeBySlot[slot] ?? null, [activeBySlot]);
		const setActive = (0, react.useCallback)((slot, id) => {
			setActiveBySlot((prev) => ({
				...prev,
				[slot]: id
			}));
		}, []);
		const getSettings = (0, react.useCallback)((id) => settingsById[id] ?? getDefaultsFor(id) ?? EMPTY_OBJECT, [settingsById]);
		const updateSettings = (0, react.useCallback)((id, partial) => {
			setSettingsById((prev) => {
				const base = prev[id] ?? getDefaultsFor(id) ?? {};
				return {
					...prev,
					[id]: {
						...base,
						...partial
					}
				};
			});
		}, []);
		const value = (0, react.useMemo)(() => ({
			getActive,
			setActive,
			getSettings,
			updateSettings
		}), [
			getActive,
			setActive,
			getSettings,
			updateSettings
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualSlotsContext.Provider, {
			value,
			children
		});
	}
	var defaultsCache = /* @__PURE__ */ new Map();
	/** Defaults lookup that tolerates components registered after seeding. */
	function getDefaultsFor(id) {
		const cached = defaultsCache.get(id);
		if (cached) return cached;
		for (const def of getAllVisualComponents()) if (def.id === id) {
			const defaults = { ...def.defaultSettings };
			defaultsCache.set(id, defaults);
			return defaults;
		}
	}
	/**
	* A read-only fallback used when no {@link VisualSlotsProvider} is mounted, so
	* the renderers still show registry defaults (and settings edits become no-ops)
	* rather than crashing. The skins always provide a real context.
	*/
	var FALLBACK = {
		getActive: (slot) => getDefaultComponentForSlot(slot)?.id ?? null,
		setActive: () => {},
		getSettings: (id) => getDefaultsFor(id) ?? EMPTY_OBJECT,
		updateSettings: () => {}
	};
	/** Access the per-player visual-slot store (or the read-only fallback). */
	function useVisualSlots() {
		return (0, react.useContext)(VisualSlotsContext) ?? FALLBACK;
	}
	//#endregion
	//#region src/audio-player/visual-slots/SEICanvasRenderer.tsx
	/**
	* Mounts the active `seiCanvas` visual component into the SEI Canvas region with
	* its live settings. Replaces the old placeholder/demo content. When no seiCanvas
	* component is active it renders a clean empty state — not "plugins mount here".
	*
	* Playback context is passed in via props (sourced from the session in
	* session-based skins, or the portable player's own engine) and forwarded to the
	* component, so visual components stay decoupled from the global audio session.
	*/
	function SEICanvasRenderer({ currentTime = 0, duration = 0, lyrics } = {}) {
		const slots = useVisualSlots();
		const def = getVisualComponent(slots.getActive("seiCanvas"));
		if (!def) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-visual-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sap-visual-empty__title",
				children: "SEI Canvas"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sap-visual-empty__hint",
				children: "No visual selected."
			})]
		});
		const { Component } = def;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Component, {
			settings: slots.getSettings(def.id),
			playback: {
				currentTime,
				duration,
				lyrics
			}
		});
	}
	//#endregion
	//#region src/audio-player/visual-slots/ScrubberCanvasRenderer.tsx
	/**
	* Intake point for `scrubberCanvas` visuals. If a component is active for the
	* slot it is mounted with live timeline props + its settings; otherwise the
	* provided `children` (the existing waveform/progress) render unchanged. No
	* scrubberCanvas component ships in V1, so the default path is the fallback.
	*/
	function ScrubberCanvasRenderer({ currentTime, duration, onSeek, children }) {
		const slots = useVisualSlots();
		const def = getVisualComponent(slots.getActive("scrubberCanvas"));
		if (!def) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
		const { Component } = def;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Component, { settings: {
			...slots.getSettings(def.id),
			currentTime,
			duration,
			onSeek
		} });
	}
	//#endregion
	//#region src/audio-player/components/VolumeControl.tsx
	/**
	* Mute toggle + a custom vertical-agnostic horizontal slider, built on the same
	* Pointer Events pattern as the scrubber for consistent behavior. Note: iOS
	* Safari ignores programmatic volume, so the mute button is the reliable control
	* there; the slider is effectively desktop-only. We surface a small hint to
	* users when we detect that the browser is not honoring the slider.
	*/
	function VolumeControl({ volume, isMuted, disabled, volumeUnsupported = false, onVolumeChange, onToggleMute }) {
		const trackRef = (0, react.useRef)(null);
		const captureIdRef = (0, react.useRef)(null);
		const captureTargetRef = (0, react.useRef)(null);
		const ratioFromEvent = (0, react.useCallback)((clientX) => {
			const el = trackRef.current;
			if (!el) return 0;
			const rect = el.getBoundingClientRect();
			if (rect.width <= 0) return 0;
			return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		}, []);
		const releaseCapture = (0, react.useCallback)(() => {
			const target = captureTargetRef.current;
			const id = captureIdRef.current;
			if (target !== null && id !== null) try {
				if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
			} catch {}
			captureTargetRef.current = null;
			captureIdRef.current = null;
		}, []);
		const handlePointerDown = (0, react.useCallback)((event) => {
			if (disabled || event.button !== 0) return;
			const target = event.currentTarget;
			try {
				target.setPointerCapture(event.pointerId);
			} catch {}
			captureTargetRef.current = target;
			captureIdRef.current = event.pointerId;
			onVolumeChange(ratioFromEvent(event.clientX));
		}, [
			disabled,
			onVolumeChange,
			ratioFromEvent
		]);
		const handlePointerMove = (0, react.useCallback)((event) => {
			if (disabled) return;
			if (captureIdRef.current === null || event.pointerId !== captureIdRef.current) return;
			onVolumeChange(ratioFromEvent(event.clientX));
		}, [
			disabled,
			onVolumeChange,
			ratioFromEvent
		]);
		const handlePointerUp = (0, react.useCallback)((event) => {
			const id = captureIdRef.current;
			if (id === null || event.pointerId !== id) return;
			releaseCapture();
		}, [releaseCapture]);
		const handleKeyDown = (0, react.useCallback)((event) => {
			if (disabled) return;
			let next = null;
			switch (event.key) {
				case "ArrowRight":
				case "ArrowUp":
					next = volume + .05;
					break;
				case "ArrowLeft":
				case "ArrowDown":
					next = volume - .05;
					break;
				case "PageUp":
					next = volume + .1;
					break;
				case "PageDown":
					next = volume - .1;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = 1;
					break;
				default: return;
			}
			event.preventDefault();
			onVolumeChange(Math.max(0, Math.min(1, next)));
		}, [
			disabled,
			onVolumeChange,
			volume
		]);
		(0, react.useEffect)(() => {
			return () => {
				releaseCapture();
			};
		}, [releaseCapture]);
		const effective = isMuted ? 0 : volume;
		const rawPct = effective * 100;
		const pct = Number.isFinite(rawPct) ? Math.max(0, Math.min(100, rawPct)) : 0;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ap-volume",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ap-icon-btn ap-volume__mute",
					onClick: onToggleMute,
					disabled,
					"aria-label": isMuted ? "Unmute" : "Mute",
					"aria-pressed": isMuted,
					children: isMuted || effective === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						width: "18",
						height: "18",
						viewBox: "0 0 24 24",
						fill: "currentColor",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" })
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						width: "18",
						height: "18",
						viewBox: "0 0 24 24",
						fill: "currentColor",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: trackRef,
					className: "ap-volume__slider",
					role: "slider",
					tabIndex: disabled ? -1 : 0,
					"aria-label": "Volume",
					"aria-valuemin": 0,
					"aria-valuemax": 100,
					"aria-valuenow": Math.round(pct),
					"aria-valuetext": `${Math.round(pct)}% volume`,
					"aria-disabled": disabled,
					onPointerDown: handlePointerDown,
					onPointerMove: handlePointerMove,
					onPointerUp: handlePointerUp,
					onPointerCancel: handlePointerUp,
					onKeyDown: handleKeyDown,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ap-volume__track" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ap-volume__fill",
							style: { width: `${pct}%` }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ap-volume__thumb",
							style: { left: `${pct}%` }
						})
					]
				}),
				volumeUnsupported && !disabled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-volume__hint",
					role: "note",
					"aria-label": "Use the mute button to silence audio; this browser does not support volume control",
					children: "iOS"
				})
			]
		});
	}
	//#endregion
	//#region node_modules/@babel/runtime/helpers/esm/extends.js
	function _extends() {
		return _extends = Object.assign ? Object.assign.bind() : function(n) {
			for (var e = 1; e < arguments.length; e++) {
				var t = arguments[e];
				for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
			}
			return n;
		}, _extends.apply(null, arguments);
	}
	//#endregion
	//#region node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
	function _assertThisInitialized(e) {
		if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
		return e;
	}
	//#endregion
	//#region node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
	function _setPrototypeOf(t, e) {
		return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t, e) {
			return t.__proto__ = e, t;
		}, _setPrototypeOf(t, e);
	}
	//#endregion
	//#region node_modules/@babel/runtime/helpers/esm/inheritsLoose.js
	function _inheritsLoose(t, o) {
		t.prototype = Object.create(o.prototype), t.prototype.constructor = t, _setPrototypeOf(t, o);
	}
	//#endregion
	//#region node_modules/memoize-one/dist/memoize-one.esm.js
	var safeIsNaN = Number.isNaN || function ponyfill(value) {
		return typeof value === "number" && value !== value;
	};
	function isEqual(first, second) {
		if (first === second) return true;
		if (safeIsNaN(first) && safeIsNaN(second)) return true;
		return false;
	}
	function areInputsEqual(newInputs, lastInputs) {
		if (newInputs.length !== lastInputs.length) return false;
		for (var i = 0; i < newInputs.length; i++) if (!isEqual(newInputs[i], lastInputs[i])) return false;
		return true;
	}
	function memoizeOne(resultFn, isEqual) {
		if (isEqual === void 0) isEqual = areInputsEqual;
		var lastThis;
		var lastArgs = [];
		var lastResult;
		var calledOnce = false;
		function memoized() {
			var newArgs = [];
			for (var _i = 0; _i < arguments.length; _i++) newArgs[_i] = arguments[_i];
			if (calledOnce && lastThis === this && isEqual(newArgs, lastArgs)) return lastResult;
			lastResult = resultFn.apply(this, newArgs);
			calledOnce = true;
			lastThis = this;
			lastArgs = newArgs;
			return lastResult;
		}
		return memoized;
	}
	//#endregion
	//#region node_modules/react-window/dist/index.esm.js
	var now = typeof performance === "object" && typeof performance.now === "function" ? function() {
		return performance.now();
	} : function() {
		return Date.now();
	};
	function cancelTimeout(timeoutID) {
		cancelAnimationFrame(timeoutID.id);
	}
	function requestTimeout(callback, delay) {
		var start = now();
		function tick() {
			if (now() - start >= delay) callback.call(null);
			else timeoutID.id = requestAnimationFrame(tick);
		}
		var timeoutID = { id: requestAnimationFrame(tick) };
		return timeoutID;
	}
	var size = -1;
	function getScrollbarSize(recalculate) {
		if (recalculate === void 0) recalculate = false;
		if (size === -1 || recalculate) {
			var div = document.createElement("div");
			var style = div.style;
			style.width = "50px";
			style.height = "50px";
			style.overflow = "scroll";
			document.body.appendChild(div);
			size = div.offsetWidth - div.clientWidth;
			document.body.removeChild(div);
		}
		return size;
	}
	var cachedRTLResult = null;
	function getRTLOffsetType(recalculate) {
		if (recalculate === void 0) recalculate = false;
		if (cachedRTLResult === null || recalculate) {
			var outerDiv = document.createElement("div");
			var outerStyle = outerDiv.style;
			outerStyle.width = "50px";
			outerStyle.height = "50px";
			outerStyle.overflow = "scroll";
			outerStyle.direction = "rtl";
			var innerDiv = document.createElement("div");
			var innerStyle = innerDiv.style;
			innerStyle.width = "100px";
			innerStyle.height = "100px";
			outerDiv.appendChild(innerDiv);
			document.body.appendChild(outerDiv);
			if (outerDiv.scrollLeft > 0) cachedRTLResult = "positive-descending";
			else {
				outerDiv.scrollLeft = 1;
				if (outerDiv.scrollLeft === 0) cachedRTLResult = "negative";
				else cachedRTLResult = "positive-ascending";
			}
			document.body.removeChild(outerDiv);
			return cachedRTLResult;
		}
		return cachedRTLResult;
	}
	if (process.env.NODE_ENV !== "production") {
		if (typeof window !== "undefined" && typeof window.WeakSet !== "undefined") {}
	}
	var IS_SCROLLING_DEBOUNCE_INTERVAL$1 = 150;
	var defaultItemKey$1 = function defaultItemKey(index, data) {
		return index;
	};
	var devWarningsDirection = null;
	var devWarningsTagName$1 = null;
	if (process.env.NODE_ENV !== "production") {
		if (typeof window !== "undefined" && typeof window.WeakSet !== "undefined") {
			devWarningsDirection = /*#__PURE__*/ new WeakSet();
			devWarningsTagName$1 = /*#__PURE__*/ new WeakSet();
		}
	}
	function createListComponent(_ref) {
		var _class;
		var getItemOffset = _ref.getItemOffset, getEstimatedTotalSize = _ref.getEstimatedTotalSize, getItemSize = _ref.getItemSize, getOffsetForIndexAndAlignment = _ref.getOffsetForIndexAndAlignment, getStartIndexForOffset = _ref.getStartIndexForOffset, getStopIndexForStartIndex = _ref.getStopIndexForStartIndex, initInstanceProps = _ref.initInstanceProps, shouldResetStyleCacheOnItemSizeChange = _ref.shouldResetStyleCacheOnItemSizeChange, validateProps = _ref.validateProps;
		return _class = /*#__PURE__*/ function(_PureComponent) {
			_inheritsLoose(List, _PureComponent);
			function List(props) {
				var _this = _PureComponent.call(this, props) || this;
				_this._instanceProps = initInstanceProps(_this.props, _assertThisInitialized(_this));
				_this._outerRef = void 0;
				_this._resetIsScrollingTimeoutId = null;
				_this.state = {
					instance: _assertThisInitialized(_this),
					isScrolling: false,
					scrollDirection: "forward",
					scrollOffset: typeof _this.props.initialScrollOffset === "number" ? _this.props.initialScrollOffset : 0,
					scrollUpdateWasRequested: false
				};
				_this._callOnItemsRendered = void 0;
				_this._callOnItemsRendered = memoizeOne(function(overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex) {
					return _this.props.onItemsRendered({
						overscanStartIndex,
						overscanStopIndex,
						visibleStartIndex,
						visibleStopIndex
					});
				});
				_this._callOnScroll = void 0;
				_this._callOnScroll = memoizeOne(function(scrollDirection, scrollOffset, scrollUpdateWasRequested) {
					return _this.props.onScroll({
						scrollDirection,
						scrollOffset,
						scrollUpdateWasRequested
					});
				});
				_this._getItemStyle = void 0;
				_this._getItemStyle = function(index) {
					var _this$props = _this.props, direction = _this$props.direction, itemSize = _this$props.itemSize, layout = _this$props.layout;
					var itemStyleCache = _this._getItemStyleCache(shouldResetStyleCacheOnItemSizeChange && itemSize, shouldResetStyleCacheOnItemSizeChange && layout, shouldResetStyleCacheOnItemSizeChange && direction);
					var style;
					if (itemStyleCache.hasOwnProperty(index)) style = itemStyleCache[index];
					else {
						var _offset = getItemOffset(_this.props, index, _this._instanceProps);
						var size = getItemSize(_this.props, index, _this._instanceProps);
						var isHorizontal = direction === "horizontal" || layout === "horizontal";
						var isRtl = direction === "rtl";
						var offsetHorizontal = isHorizontal ? _offset : 0;
						itemStyleCache[index] = style = {
							position: "absolute",
							left: isRtl ? void 0 : offsetHorizontal,
							right: isRtl ? offsetHorizontal : void 0,
							top: !isHorizontal ? _offset : 0,
							height: !isHorizontal ? size : "100%",
							width: isHorizontal ? size : "100%"
						};
					}
					return style;
				};
				_this._getItemStyleCache = void 0;
				_this._getItemStyleCache = memoizeOne(function(_, __, ___) {
					return {};
				});
				_this._onScrollHorizontal = function(event) {
					var _event$currentTarget = event.currentTarget, clientWidth = _event$currentTarget.clientWidth, scrollLeft = _event$currentTarget.scrollLeft, scrollWidth = _event$currentTarget.scrollWidth;
					_this.setState(function(prevState) {
						if (prevState.scrollOffset === scrollLeft) return null;
						var direction = _this.props.direction;
						var scrollOffset = scrollLeft;
						if (direction === "rtl") switch (getRTLOffsetType()) {
							case "negative":
								scrollOffset = -scrollLeft;
								break;
							case "positive-descending":
								scrollOffset = scrollWidth - clientWidth - scrollLeft;
								break;
						}
						scrollOffset = Math.max(0, Math.min(scrollOffset, scrollWidth - clientWidth));
						return {
							isScrolling: true,
							scrollDirection: prevState.scrollOffset < scrollOffset ? "forward" : "backward",
							scrollOffset,
							scrollUpdateWasRequested: false
						};
					}, _this._resetIsScrollingDebounced);
				};
				_this._onScrollVertical = function(event) {
					var _event$currentTarget2 = event.currentTarget, clientHeight = _event$currentTarget2.clientHeight, scrollHeight = _event$currentTarget2.scrollHeight, scrollTop = _event$currentTarget2.scrollTop;
					_this.setState(function(prevState) {
						if (prevState.scrollOffset === scrollTop) return null;
						var scrollOffset = Math.max(0, Math.min(scrollTop, scrollHeight - clientHeight));
						return {
							isScrolling: true,
							scrollDirection: prevState.scrollOffset < scrollOffset ? "forward" : "backward",
							scrollOffset,
							scrollUpdateWasRequested: false
						};
					}, _this._resetIsScrollingDebounced);
				};
				_this._outerRefSetter = function(ref) {
					var outerRef = _this.props.outerRef;
					_this._outerRef = ref;
					if (typeof outerRef === "function") outerRef(ref);
					else if (outerRef != null && typeof outerRef === "object" && outerRef.hasOwnProperty("current")) outerRef.current = ref;
				};
				_this._resetIsScrollingDebounced = function() {
					if (_this._resetIsScrollingTimeoutId !== null) cancelTimeout(_this._resetIsScrollingTimeoutId);
					_this._resetIsScrollingTimeoutId = requestTimeout(_this._resetIsScrolling, IS_SCROLLING_DEBOUNCE_INTERVAL$1);
				};
				_this._resetIsScrolling = function() {
					_this._resetIsScrollingTimeoutId = null;
					_this.setState({ isScrolling: false }, function() {
						_this._getItemStyleCache(-1, null);
					});
				};
				return _this;
			}
			List.getDerivedStateFromProps = function getDerivedStateFromProps(nextProps, prevState) {
				validateSharedProps$1(nextProps, prevState);
				validateProps(nextProps);
				return null;
			};
			var _proto = List.prototype;
			_proto.scrollTo = function scrollTo(scrollOffset) {
				scrollOffset = Math.max(0, scrollOffset);
				this.setState(function(prevState) {
					if (prevState.scrollOffset === scrollOffset) return null;
					return {
						scrollDirection: prevState.scrollOffset < scrollOffset ? "forward" : "backward",
						scrollOffset,
						scrollUpdateWasRequested: true
					};
				}, this._resetIsScrollingDebounced);
			};
			_proto.scrollToItem = function scrollToItem(index, align) {
				if (align === void 0) align = "auto";
				var _this$props2 = this.props, itemCount = _this$props2.itemCount, layout = _this$props2.layout;
				var scrollOffset = this.state.scrollOffset;
				index = Math.max(0, Math.min(index, itemCount - 1));
				var scrollbarSize = 0;
				if (this._outerRef) {
					var outerRef = this._outerRef;
					if (layout === "vertical") scrollbarSize = outerRef.scrollWidth > outerRef.clientWidth ? getScrollbarSize() : 0;
					else scrollbarSize = outerRef.scrollHeight > outerRef.clientHeight ? getScrollbarSize() : 0;
				}
				this.scrollTo(getOffsetForIndexAndAlignment(this.props, index, align, scrollOffset, this._instanceProps, scrollbarSize));
			};
			_proto.componentDidMount = function componentDidMount() {
				var _this$props3 = this.props, direction = _this$props3.direction, initialScrollOffset = _this$props3.initialScrollOffset, layout = _this$props3.layout;
				if (typeof initialScrollOffset === "number" && this._outerRef != null) {
					var outerRef = this._outerRef;
					if (direction === "horizontal" || layout === "horizontal") outerRef.scrollLeft = initialScrollOffset;
					else outerRef.scrollTop = initialScrollOffset;
				}
				this._callPropsCallbacks();
			};
			_proto.componentDidUpdate = function componentDidUpdate() {
				var _this$props4 = this.props, direction = _this$props4.direction, layout = _this$props4.layout;
				var _this$state = this.state, scrollOffset = _this$state.scrollOffset;
				if (_this$state.scrollUpdateWasRequested && this._outerRef != null) {
					var outerRef = this._outerRef;
					if (direction === "horizontal" || layout === "horizontal") if (direction === "rtl") switch (getRTLOffsetType()) {
						case "negative":
							outerRef.scrollLeft = -scrollOffset;
							break;
						case "positive-ascending":
							outerRef.scrollLeft = scrollOffset;
							break;
						default:
							var clientWidth = outerRef.clientWidth;
							outerRef.scrollLeft = outerRef.scrollWidth - clientWidth - scrollOffset;
							break;
					}
					else outerRef.scrollLeft = scrollOffset;
					else outerRef.scrollTop = scrollOffset;
				}
				this._callPropsCallbacks();
			};
			_proto.componentWillUnmount = function componentWillUnmount() {
				if (this._resetIsScrollingTimeoutId !== null) cancelTimeout(this._resetIsScrollingTimeoutId);
			};
			_proto.render = function render() {
				var _this$props5 = this.props, children = _this$props5.children, className = _this$props5.className, direction = _this$props5.direction, height = _this$props5.height, innerRef = _this$props5.innerRef, innerElementType = _this$props5.innerElementType, innerTagName = _this$props5.innerTagName, itemCount = _this$props5.itemCount, itemData = _this$props5.itemData, _this$props5$itemKey = _this$props5.itemKey, itemKey = _this$props5$itemKey === void 0 ? defaultItemKey$1 : _this$props5$itemKey, layout = _this$props5.layout, outerElementType = _this$props5.outerElementType, outerTagName = _this$props5.outerTagName, style = _this$props5.style, useIsScrolling = _this$props5.useIsScrolling, width = _this$props5.width;
				var isScrolling = this.state.isScrolling;
				var isHorizontal = direction === "horizontal" || layout === "horizontal";
				var onScroll = isHorizontal ? this._onScrollHorizontal : this._onScrollVertical;
				var _this$_getRangeToRend = this._getRangeToRender(), startIndex = _this$_getRangeToRend[0], stopIndex = _this$_getRangeToRend[1];
				var items = [];
				if (itemCount > 0) for (var _index = startIndex; _index <= stopIndex; _index++) items.push((0, react.createElement)(children, {
					data: itemData,
					key: itemKey(_index, itemData),
					index: _index,
					isScrolling: useIsScrolling ? isScrolling : void 0,
					style: this._getItemStyle(_index)
				}));
				var estimatedTotalSize = getEstimatedTotalSize(this.props, this._instanceProps);
				return (0, react.createElement)(outerElementType || outerTagName || "div", {
					className,
					onScroll,
					ref: this._outerRefSetter,
					style: _extends({
						position: "relative",
						height,
						width,
						overflow: "auto",
						WebkitOverflowScrolling: "touch",
						willChange: "transform",
						direction
					}, style)
				}, (0, react.createElement)(innerElementType || innerTagName || "div", {
					children: items,
					ref: innerRef,
					style: {
						height: isHorizontal ? "100%" : estimatedTotalSize,
						pointerEvents: isScrolling ? "none" : void 0,
						width: isHorizontal ? estimatedTotalSize : "100%"
					}
				}));
			};
			_proto._callPropsCallbacks = function _callPropsCallbacks() {
				if (typeof this.props.onItemsRendered === "function") {
					if (this.props.itemCount > 0) {
						var _this$_getRangeToRend2 = this._getRangeToRender(), _overscanStartIndex = _this$_getRangeToRend2[0], _overscanStopIndex = _this$_getRangeToRend2[1], _visibleStartIndex = _this$_getRangeToRend2[2], _visibleStopIndex = _this$_getRangeToRend2[3];
						this._callOnItemsRendered(_overscanStartIndex, _overscanStopIndex, _visibleStartIndex, _visibleStopIndex);
					}
				}
				if (typeof this.props.onScroll === "function") {
					var _this$state2 = this.state, _scrollDirection = _this$state2.scrollDirection, _scrollOffset = _this$state2.scrollOffset, _scrollUpdateWasRequested = _this$state2.scrollUpdateWasRequested;
					this._callOnScroll(_scrollDirection, _scrollOffset, _scrollUpdateWasRequested);
				}
			};
			_proto._getRangeToRender = function _getRangeToRender() {
				var _this$props6 = this.props, itemCount = _this$props6.itemCount, overscanCount = _this$props6.overscanCount;
				var _this$state3 = this.state, isScrolling = _this$state3.isScrolling, scrollDirection = _this$state3.scrollDirection, scrollOffset = _this$state3.scrollOffset;
				if (itemCount === 0) return [
					0,
					0,
					0,
					0
				];
				var startIndex = getStartIndexForOffset(this.props, scrollOffset, this._instanceProps);
				var stopIndex = getStopIndexForStartIndex(this.props, startIndex, scrollOffset, this._instanceProps);
				var overscanBackward = !isScrolling || scrollDirection === "backward" ? Math.max(1, overscanCount) : 1;
				var overscanForward = !isScrolling || scrollDirection === "forward" ? Math.max(1, overscanCount) : 1;
				return [
					Math.max(0, startIndex - overscanBackward),
					Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)),
					startIndex,
					stopIndex
				];
			};
			return List;
		}(react.PureComponent), _class.defaultProps = {
			direction: "ltr",
			itemData: void 0,
			layout: "vertical",
			overscanCount: 2,
			useIsScrolling: false
		}, _class;
	}
	var validateSharedProps$1 = function validateSharedProps(_ref2, _ref3) {
		var children = _ref2.children, direction = _ref2.direction, height = _ref2.height, layout = _ref2.layout, innerTagName = _ref2.innerTagName, outerTagName = _ref2.outerTagName, width = _ref2.width;
		var instance = _ref3.instance;
		if (process.env.NODE_ENV !== "production") {
			if (innerTagName != null || outerTagName != null) {
				if (devWarningsTagName$1 && !devWarningsTagName$1.has(instance)) {
					devWarningsTagName$1.add(instance);
					console.warn("The innerTagName and outerTagName props have been deprecated. Please use the innerElementType and outerElementType props instead.");
				}
			}
			var isHorizontal = direction === "horizontal" || layout === "horizontal";
			switch (direction) {
				case "horizontal":
				case "vertical":
					if (devWarningsDirection && !devWarningsDirection.has(instance)) {
						devWarningsDirection.add(instance);
						console.warn("The direction prop should be either \"ltr\" (default) or \"rtl\". Please use the layout prop to specify \"vertical\" (default) or \"horizontal\" orientation.");
					}
					break;
				case "ltr":
				case "rtl": break;
				default: throw Error("An invalid \"direction\" prop has been specified. Value should be either \"ltr\" or \"rtl\". " + ("\"" + direction + "\" was specified."));
			}
			switch (layout) {
				case "horizontal":
				case "vertical": break;
				default: throw Error("An invalid \"layout\" prop has been specified. Value should be either \"horizontal\" or \"vertical\". " + ("\"" + layout + "\" was specified."));
			}
			if (children == null) throw Error("An invalid \"children\" prop has been specified. Value should be a React component. " + ("\"" + (children === null ? "null" : typeof children) + "\" was specified."));
			if (isHorizontal && typeof width !== "number") throw Error("An invalid \"width\" prop has been specified. Horizontal lists must specify a number for width. " + ("\"" + (width === null ? "null" : typeof width) + "\" was specified."));
			else if (!isHorizontal && typeof height !== "number") throw Error("An invalid \"height\" prop has been specified. Vertical lists must specify a number for height. " + ("\"" + (height === null ? "null" : typeof height) + "\" was specified."));
		}
	};
	var FixedSizeList = /*#__PURE__*/ createListComponent({
		getItemOffset: function getItemOffset(_ref, index) {
			return index * _ref.itemSize;
		},
		getItemSize: function getItemSize(_ref2, index) {
			return _ref2.itemSize;
		},
		getEstimatedTotalSize: function getEstimatedTotalSize(_ref3) {
			var itemCount = _ref3.itemCount;
			return _ref3.itemSize * itemCount;
		},
		getOffsetForIndexAndAlignment: function getOffsetForIndexAndAlignment(_ref4, index, align, scrollOffset, instanceProps, scrollbarSize) {
			var direction = _ref4.direction, height = _ref4.height, itemCount = _ref4.itemCount, itemSize = _ref4.itemSize, layout = _ref4.layout, width = _ref4.width;
			var size = direction === "horizontal" || layout === "horizontal" ? width : height;
			var lastItemOffset = Math.max(0, itemCount * itemSize - size);
			var maxOffset = Math.min(lastItemOffset, index * itemSize);
			var minOffset = Math.max(0, index * itemSize - size + itemSize + scrollbarSize);
			if (align === "smart") if (scrollOffset >= minOffset - size && scrollOffset <= maxOffset + size) align = "auto";
			else align = "center";
			switch (align) {
				case "start": return maxOffset;
				case "end": return minOffset;
				case "center":
					var middleOffset = Math.round(minOffset + (maxOffset - minOffset) / 2);
					if (middleOffset < Math.ceil(size / 2)) return 0;
					else if (middleOffset > lastItemOffset + Math.floor(size / 2)) return lastItemOffset;
					else return middleOffset;
				default: if (scrollOffset >= minOffset && scrollOffset <= maxOffset) return scrollOffset;
				else if (scrollOffset < minOffset) return minOffset;
				else return maxOffset;
			}
		},
		getStartIndexForOffset: function getStartIndexForOffset(_ref5, offset) {
			var itemCount = _ref5.itemCount, itemSize = _ref5.itemSize;
			return Math.max(0, Math.min(itemCount - 1, Math.floor(offset / itemSize)));
		},
		getStopIndexForStartIndex: function getStopIndexForStartIndex(_ref6, startIndex, scrollOffset) {
			var direction = _ref6.direction, height = _ref6.height, itemCount = _ref6.itemCount, itemSize = _ref6.itemSize, layout = _ref6.layout, width = _ref6.width;
			var isHorizontal = direction === "horizontal" || layout === "horizontal";
			var offset = startIndex * itemSize;
			var numVisibleItems = Math.ceil(((isHorizontal ? width : height) + scrollOffset - offset) / itemSize);
			return Math.max(0, Math.min(itemCount - 1, startIndex + numVisibleItems - 1));
		},
		initInstanceProps: function initInstanceProps(props) {},
		shouldResetStyleCacheOnItemSizeChange: true,
		validateProps: function validateProps(_ref7) {
			var itemSize = _ref7.itemSize;
			if (process.env.NODE_ENV !== "production") {
				if (typeof itemSize !== "number") throw Error("An invalid \"itemSize\" prop has been specified. Value should be a number. " + ("\"" + (itemSize === null ? "null" : typeof itemSize) + "\" was specified."));
			}
		}
	});
	//#endregion
	//#region node_modules/react-virtualized-auto-sizer/dist/react-virtualized-auto-sizer.js
	var m;
	typeof window < "u" ? m = window : typeof self < "u" ? m = self : m = global;
	var R = null, E = null;
	var N = 20, y = m.clearTimeout, S = m.setTimeout, F = m.cancelAnimationFrame || m.mozCancelAnimationFrame || m.webkitCancelAnimationFrame, W = m.requestAnimationFrame || m.mozRequestAnimationFrame || m.webkitRequestAnimationFrame;
	F == null || W == null ? (R = y, E = function(l) {
		return S(l, N);
	}) : (R = function([l, _]) {
		F(l), y(_);
	}, E = function(l) {
		const _ = W(function() {
			y(f), l();
		}), f = S(function() {
			F(_), l();
		}, N);
		return [_, f];
	});
	function D(z) {
		let l, _, f, u, T, r, a;
		const c = typeof document < "u" && document.attachEvent;
		if (!c) {
			r = function(t) {
				const i = t.__resizeTriggers__, h = i.firstElementChild, b = i.lastElementChild, L = h.firstElementChild;
				b.scrollLeft = b.scrollWidth, b.scrollTop = b.scrollHeight, L.style.width = h.offsetWidth + 1 + "px", L.style.height = h.offsetHeight + 1 + "px", h.scrollLeft = h.scrollWidth, h.scrollTop = h.scrollHeight;
			}, T = function(t) {
				return t.offsetWidth !== t.__resizeLast__.width || t.offsetHeight !== t.__resizeLast__.height;
			}, a = function(t) {
				if (t.target.className && typeof t.target.className.indexOf == "function" && t.target.className.indexOf("contract-trigger") < 0 && t.target.className.indexOf("expand-trigger") < 0) return;
				const i = this;
				r(this), this.__resizeRAF__ && R(this.__resizeRAF__), this.__resizeRAF__ = E(function() {
					T(i) && (i.__resizeLast__.width = i.offsetWidth, i.__resizeLast__.height = i.offsetHeight, i.__resizeListeners__.forEach(function(L) {
						L.call(i, t);
					}));
				});
			};
			let e = !1, s = "";
			f = "animationstart";
			const d = "Webkit Moz O ms".split(" ");
			let o = "webkitAnimationStart animationstart oAnimationStart MSAnimationStart".split(" "), p = "";
			{
				const t = document.createElement("fakeelement");
				if (t.style.animationName !== void 0 && (e = !0), e === !1) {
					for (let i = 0; i < d.length; i++) if (t.style[d[i] + "AnimationName"] !== void 0) {
						p = d[i], s = "-" + p.toLowerCase() + "-", f = o[i], e = !0;
						break;
					}
				}
			}
			_ = "resizeanim", l = "@" + s + "keyframes " + _ + " { from { opacity: 0; } to { opacity: 0; } } ", u = s + "animation: 1ms " + _ + "; ";
		}
		const n = function(e) {
			if (!e.getElementById("detectElementResize")) {
				const s = (l || "") + ".resize-triggers { " + (u || "") + "visibility: hidden; opacity: 0; } .resize-triggers, .resize-triggers > div, .contract-trigger:before { content: \" \"; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; z-index: -1; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }", d = e.head || e.getElementsByTagName("head")[0], o = e.createElement("style");
				o.id = "detectElementResize", o.type = "text/css", z != null && o.setAttribute("nonce", z), o.styleSheet ? o.styleSheet.cssText = s : o.appendChild(e.createTextNode(s)), d.appendChild(o);
			}
		};
		return {
			addResizeListener: function(e, s) {
				if (c) e.attachEvent("onresize", s);
				else {
					if (!e.__resizeTriggers__) {
						const d = e.ownerDocument, o = m.getComputedStyle(e);
						o && o.position === "static" && (e.style.position = "relative"), n(d), e.__resizeLast__ = {}, e.__resizeListeners__ = [], (e.__resizeTriggers__ = d.createElement("div")).className = "resize-triggers";
						const p = d.createElement("div");
						p.className = "expand-trigger", p.appendChild(d.createElement("div"));
						const t = d.createElement("div");
						t.className = "contract-trigger", e.__resizeTriggers__.appendChild(p), e.__resizeTriggers__.appendChild(t), e.appendChild(e.__resizeTriggers__), r(e), e.addEventListener("scroll", a, !0), f && (e.__resizeTriggers__.__animationListener__ = function(h) {
							h.animationName === _ && r(e);
						}, e.__resizeTriggers__.addEventListener(f, e.__resizeTriggers__.__animationListener__));
					}
					e.__resizeListeners__.push(s);
				}
			},
			removeResizeListener: function(e, s) {
				if (c) e.detachEvent("onresize", s);
				else if (e.__resizeListeners__.splice(e.__resizeListeners__.indexOf(s), 1), !e.__resizeListeners__.length) {
					e.removeEventListener("scroll", a, !0), e.__resizeTriggers__.__animationListener__ && (e.__resizeTriggers__.removeEventListener(f, e.__resizeTriggers__.__animationListener__), e.__resizeTriggers__.__animationListener__ = null);
					try {
						e.__resizeTriggers__ = !e.removeChild(e.__resizeTriggers__);
					} catch {}
				}
			}
		};
	}
	function B({ box: z, nonce: l, onResize: _, rootElement: f }) {
		const u = (0, react.useRef)({
			onResize: _,
			parentNode: null,
			prevSize: {
				height: void 0,
				width: void 0
			}
		});
		(0, react.useLayoutEffect)(() => {
			u.current.onResize = _;
		});
		const T = (0, react.useRef)(() => {
			const { onResize: r, parentNode: a, prevSize: c } = u.current;
			if (a === null) return;
			let n, g;
			switch (z) {
				case "border-box": {
					const v = a.getBoundingClientRect();
					n = v.height, g = v.width;
					break;
				}
				case "content-box": {
					const v = a.getBoundingClientRect(), e = window.getComputedStyle(a) || {}, s = parseFloat(e.borderBottomWidth || "0"), d = parseFloat(e.borderLeftWidth || "0"), o = parseFloat(e.borderRightWidth || "0"), p = parseFloat(e.borderTopWidth || "0"), t = parseFloat(e.paddingLeft || "0"), i = parseFloat(e.paddingRight || "0"), h = parseFloat(e.paddingTop || "0"), b = parseFloat(e.paddingBottom || "0");
					n = v.height - h - b - p - s, g = v.width - t - i - d - o;
					break;
				}
				case "device-pixel-content-box":
					n = a.offsetHeight, g = a.offsetWidth;
					break;
			}
			(c.height !== n || c.width !== g) && (u.current.prevSize = {
				height: n,
				width: g
			}, r({
				height: n,
				width: g
			}));
		});
		(0, react.useLayoutEffect)(() => {
			if (f === null) return;
			const r = f.parentNode;
			if (r === null || r.ownerDocument === null || r.ownerDocument.defaultView === null || !(r instanceof r.ownerDocument.defaultView.HTMLElement)) return;
			u.current.parentNode = r;
			const a = T.current, c = r.ownerDocument.defaultView.ResizeObserver;
			if (c != null) {
				let n;
				const g = new c(() => {
					n = setTimeout(a, 0);
				});
				return g.observe(r), () => {
					n && clearTimeout(n), g.disconnect();
				};
			} else {
				const n = D(l);
				return n.addResizeListener(r, a), () => {
					n.removeResizeListener(r, a);
				};
			}
		}, [l, f]);
	}
	function q({ box: z = "content-box", className: l, "data-testid": _, id: f, nonce: u, onResize: T, style: r, tagName: a = "div", ...c }) {
		let n, g;
		"Child" in c ? n = c.Child : "ChildComponent" in c ? n = c.ChildComponent : "renderProp" in c && (g = c.renderProp);
		const [v, e] = (0, react.useState)(null), [s, d] = (0, react.useState)(), [o, p] = (0, react.useState)();
		B({
			box: z,
			nonce: u,
			onResize: (i) => {
				d(i.height), p(i.width), typeof T < "u" && T(i);
			},
			rootElement: v
		});
		const t = (0, react.useMemo)(() => n ? (0, react.memo)(n) : void 0, [n]);
		return (0, react.createElement)(a, {
			className: l,
			"data-auto-sizer": "",
			"data-testid": _,
			id: f,
			ref: e,
			style: r
		}, t ? (0, react.createElement)(t, {
			height: s,
			width: o
		}) : void 0, g ? g({
			height: s,
			width: o
		}) : void 0);
	}
	//#endregion
	//#region src/audio-player/components/QueueDrawer.tsx
	var AutoSizer = q;
	var QueueRowWrapper = ({ index, style, data }) => {
		const { visibleQueue, upcomingStart, currentIndex, drag, onPlayTrack, onRemove, isPlaying } = data;
		const actualIndex = upcomingStart + index;
		const track = visibleQueue[index];
		if (!track) return null;
		const isActive = actualIndex === currentIndex;
		const isDragging = drag.drag !== null && drag.drag.index === actualIndex;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueRow, {
			style,
			track,
			index: actualIndex,
			isActive,
			isDragging,
			dragOffset: isDragging && drag.drag ? drag.drag.y : 0,
			dragHandlers: drag.getRowHandlers(actualIndex),
			onPlay: () => onPlayTrack(actualIndex),
			onRemove: () => onRemove(actualIndex),
			isPlaying
		});
	};
	/**
	* Pure pointer-event drag-and-drop for a vertical list. Returns the drag state
	* plus the handlers to attach to each row and the list container. Uses pointer
	* capture to survive pointer leaving the element.
	*/
	function useQueueDrag(itemCount, onReorder, rowHeight = 56, startIndexOffset = 0) {
		const [drag, setDrag] = (0, react.useState)(null);
		const dragRef = (0, react.useRef)(null);
		const containerRef = (0, react.useRef)(null);
		const initialPointerRef = (0, react.useRef)(0);
		const computeTarget = (0, react.useCallback)((pointerY, startIndex) => {
			if (!containerRef.current) return startIndex;
			const offset = pointerY - containerRef.current.getBoundingClientRect().top + containerRef.current.scrollTop;
			const target = Math.round(offset / rowHeight) + startIndexOffset;
			return Math.max(startIndexOffset, Math.min(itemCount - 1, target));
		}, [
			itemCount,
			rowHeight,
			startIndexOffset
		]);
		const handlePointerDown = (0, react.useCallback)((index, event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.currentTarget.setPointerCapture(event.pointerId);
			initialPointerRef.current = event.clientY;
			const state = {
				index,
				y: 0,
				targetIndex: index
			};
			dragRef.current = state;
			setDrag(state);
		}, []);
		const handlePointerMove = (0, react.useCallback)((event) => {
			const s = dragRef.current;
			if (!s) return;
			event.preventDefault();
			const dy = event.clientY - initialPointerRef.current;
			const target = computeTarget(event.clientY, s.index);
			const next = {
				...s,
				y: dy,
				targetIndex: target === s.index ? s.targetIndex : target
			};
			dragRef.current = next;
			setDrag(next);
		}, [computeTarget]);
		const handlePointerUp = (0, react.useCallback)((event) => {
			const s = dragRef.current;
			if (!s) return;
			event.preventDefault();
			const el = event.currentTarget;
			try {
				el.releasePointerCapture(event.pointerId);
			} catch {}
			const target = computeTarget(event.clientY, s.index);
			if (target !== s.index) onReorder(s.index, target);
			dragRef.current = null;
			setDrag(null);
		}, [computeTarget, onReorder]);
		return {
			drag,
			setContainerRef: containerRef,
			getRowHandlers: (index) => ({
				onPointerDown: (e) => handlePointerDown(index, e),
				onPointerMove: handlePointerMove,
				onPointerUp: handlePointerUp
			})
		};
	}
	var DragHandleIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 16 16",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "5",
				cy: "4",
				r: "1.3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "11",
				cy: "4",
				r: "1.3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "5",
				cy: "8",
				r: "1.3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "11",
				cy: "8",
				r: "1.3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "5",
				cy: "12",
				r: "1.3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "11",
				cy: "12",
				r: "1.3"
			})
		]
	});
	var CloseIcon$1 = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "18",
			y1: "6",
			x2: "6",
			y2: "18"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "6",
			y1: "6",
			x2: "18",
			y2: "18"
		})]
	});
	var RemoveIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "18",
			y1: "6",
			x2: "6",
			y2: "18"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "6",
			y1: "6",
			x2: "18",
			y2: "18"
		})]
	});
	function QueueRow({ track, index, isActive, isDragging, dragOffset, dragHandlers, onPlay, onRemove, isPlaying, style }) {
		const rowRef = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			if (isActive && rowRef.current) rowRef.current.focus();
		}, [isActive]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: rowRef,
			className: `ap-q-row${isActive ? " ap-q-row--active" : ""}${isDragging ? " ap-q-row--dragging" : ""}`,
			role: "listitem",
			tabIndex: -1,
			"aria-label": `${track.title} by ${track.artist}${isActive ? " (now playing)" : ""}`,
			style: {
				...style,
				...isDragging && dragOffset !== 0 ? { transform: `translateY(${dragOffset}px)` } : {}
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-q-row__drag",
					"aria-hidden": "true",
					style: { touchAction: "none" },
					onPointerDown: dragHandlers.onPointerDown,
					onPointerMove: dragHandlers.onPointerMove,
					onPointerUp: dragHandlers.onPointerUp,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DragHandleIcon, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-q-row__num",
					children: isActive && isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ap-eq",
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
						]
					}) : index + 1
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-q-row__meta",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-q-row__title",
						children: track.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-q-row__artist",
						children: track.artist
					})]
				}),
				isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-q-row__badge",
					children: "Now Playing"
				}),
				!isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ap-q-row__play-btn ap-tap",
					onClick: onPlay,
					"aria-label": `Play ${track.title}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 24 24",
						fill: "currentColor",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5v14l12-7z" })
					})
				}),
				!isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ap-q-row__remove ap-tap",
					onClick: onRemove,
					"aria-label": `Remove ${track.title} from queue`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoveIcon, {})
				})
			]
		});
	}
	/**
	* An overlay drawer that shows the "Now Playing" track and "Up Next" tracks.
	* Supports:
	* - Drag-and-drop reorder of upcoming tracks
	* - Remove tracks from the queue (not the active track)
	* - Click-to-play any upcoming track
	* - Accessibility via ARIA roles and live announcements
	*
	* Designed to work with both the standalone AudioPlayer's local queue and the
	* global session's queue (via useAudioSession).
	*/
	function QueueDrawer({ queue, currentIndex, isPlaying = false, open, onClose, onPlayTrack, onReorder, onRemove }) {
		const [announcement, setAnnouncement] = (0, react.useState)("");
		const prevQueueRef = (0, react.useRef)(queue);
		const upcomingStart = currentIndex;
		const visibleQueue = queue.slice(upcomingStart);
		const drag = useQueueDrag(queue.length, onReorder, 56, upcomingStart);
		(0, react.useEffect)(() => {
			if (!open) return;
			const prev = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = prev;
			};
		}, [open]);
		(0, react.useEffect)(() => {
			if (queue.length === prevQueueRef.current.length) return;
			if (prevQueueRef.current.length > queue.length) {
				const removedCount = prevQueueRef.current.length - queue.length;
				setAnnouncement(`${removedCount} track${removedCount > 1 ? "s" : ""} removed from queue`);
			}
			prevQueueRef.current = queue;
		}, [queue]);
		(0, react.useEffect)(() => {
			if (!open) return;
			const handleKey = (e) => {
				if (e.key === "Escape") onClose();
			};
			document.addEventListener("keydown", handleKey);
			return () => document.removeEventListener("keydown", handleKey);
		}, [open, onClose]);
		if (!open) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ap-q-overlay",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "Up next queue",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-q-backdrop",
				onClick: onClose,
				"aria-hidden": "true"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ap-q-drawer ap-anim-in",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ap-q-header",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "ap-q-header__title",
								children: "Up Next"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "ap-q-header__count",
								children: [
									queue.length,
									" track",
									queue.length !== 1 ? "s" : ""
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ap-q-header__close ap-tap",
								onClick: onClose,
								"aria-label": "Close queue drawer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon$1, {})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-sr-only",
						role: "status",
						"aria-live": "polite",
						"aria-atomic": "true",
						children: announcement
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-q-list",
						role: "list",
						"aria-label": "Queue tracks",
						style: { touchAction: "pan-y" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoSizer, { children: ({ height, width }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FixedSizeList, {
							outerRef: drag.setContainerRef,
							height,
							width,
							itemCount: visibleQueue.length,
							itemSize: 56,
							itemData: {
								visibleQueue,
								upcomingStart,
								currentIndex,
								drag,
								onPlayTrack,
								onRemove,
								isPlaying
							},
							itemKey: (index, data) => {
								const actualIndex = data.upcomingStart + index;
								const track = data.visibleQueue[index];
								return actualIndex + ":" + trackKey(track);
							},
							children: QueueRowWrapper
						}) })
					}),
					queue.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-q-empty",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Queue is empty" })
					}),
					queue.length > 0 && upcomingStart >= queue.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-q-empty",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No more tracks — the queue ends after this one." })
					})
				]
			})]
		});
	}
	//#endregion
	//#region src/audio-player/skins/themeVars.ts
	/**
	* Build the `--ap-*` CSS custom properties a skin sets on its root, so the
	* reused `ProgressBar` / `VolumeControl` (which read `var(--ap-progress)`
	* etc.) pick up the right colors — exactly as `.ap-root` does in AudioPlayer.
	* Defaults match the player's dark-glass look.
	*/
	function buildThemeVars(theme = {}) {
		const { accentColor = "#FFFFFF", playIconColor = "#000000", textColor = "#FFFFFF", progressColor = "#FFFFFF", trackColor = "rgba(204, 204, 204, 0.35)", backgroundColor = "rgba(20, 20, 28, 0.6)", glowColor = "transparent", glowIntensity = 100, buttonOpacity = 0 } = theme;
		return {
			"--ap-accent": accentColor,
			"--ap-play-icon": playIconColor,
			"--ap-text": textColor,
			"--ap-progress": progressColor,
			"--ap-track": trackColor,
			"--ap-bg": backgroundColor,
			"--ap-glow": glowColor,
			"--ap-glow-intensity": glowIntensity / 100,
			"--ap-btn-opacity-delta": `${buttonOpacity}%`
		};
	}
	//#endregion
	//#region src/audio-player/components/workspace/workspaceRoutes.ts
	/**
	* Workspace routing model for the SAP Controller shell.
	*
	* The SAP Controller started life as a single "…" options sheet. It is now a
	* reusable workspace *shell*: the same portal, focus trap, escape handling and
	* body-scroll lock host either the legacy options surface (`"options"`) or a
	* focused configuration workspace selected from the radial action menu
	* (e.g. `"plugin-settings:lyrics"`).
	*
	* A route is a `category:target` string (the bare `"options"` route has no
	* target). Categories group routes by which workspace surface renders them.
	* Deliberately free of any engine/session/React imports so the routing model
	* can later be promoted into the seihouse-ui design system alongside the menu
	* data model.
	*/
	/** Every workspace route the shell knows how to render. */
	var WORKSPACE_ROUTES = [
		"options",
		"library:playlists",
		"library:queue",
		"plugin-settings:lyrics",
		"plugin-settings:waveform",
		"playback:automix",
		"agent:queue-director",
		"visual:canvas",
		"visual:lyrics",
		"diagnostics:activity-log"
	];
	var ROUTE_SET = new Set(WORKSPACE_ROUTES);
	/** Whether an arbitrary string is a known workspace route. */
	function isWorkspaceRoute(value) {
		return ROUTE_SET.has(value);
	}
	/**
	* Validate and categorize a route string. Returns `null` for any value that is
	* not a known route, so callers can fall back to `"options"` (or ignore an
	* unrecognized node) rather than render an empty shell.
	*/
	function parseWorkspaceRoute(value) {
		if (!value || !isWorkspaceRoute(value)) return null;
		if (value === "options") return {
			route: value,
			category: "options",
			target: null
		};
		const sep = value.indexOf(":");
		return {
			route: value,
			category: value.slice(0, sep),
			target: value.slice(sep + 1)
		};
	}
	//#endregion
	//#region src/audio-player/components/workspace/LibraryPlaylistsWorkspace.tsx
	function LibraryPlaylistsWorkspace() {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: "Playlists coming soon"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "Browse, build and reorder playlists from here."
			})]
		});
	}
	//#endregion
	//#region src/audio-player/components/workspace/LibraryQueueWorkspace.tsx
	function LibraryQueueWorkspace() {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: "Up Next"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "An in-workspace view of the play queue is on the way. Use the queue drawer for now."
			})]
		});
	}
	//#endregion
	//#region src/audio-player/components/workspace/PluginSettingsWorkspace.tsx
	function PluginSettingsWorkspace({ pluginId }) {
		const label = pluginId ? pluginId.charAt(0).toUpperCase() + pluginId.slice(1) : "Plugin";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "sap-ctl__workspace-lead",
				children: [label, " settings"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "sap-ctl__workspace-sub",
				children: [
					"Configuration for the ",
					label,
					" plugin will appear here."
				]
			})]
		});
	}
	//#endregion
	//#region src/audio-player/components/workspace/PlaybackAutomixWorkspace.tsx
	function PlaybackAutomixWorkspace() {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: "Automix settings coming soon"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "Crossfade length, beat snapping and transition tuning will live here."
			})]
		});
	}
	//#endregion
	//#region src/audio-player/components/workspace/AgentQueueDirectorWorkspace.tsx
	function AgentQueueDirectorWorkspace() {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: "AI queue director coming soon"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "Let an agent curate and reorder what plays next."
			})]
		});
	}
	//#endregion
	//#region src/audio-player/diagnostics/useActivityLog.ts
	/**
	* useActivityLog — React hook for consuming the Activity Log context.
	*
	* Provides the full ActivityLogApi (record, events, clear, exportJson,
	* exportText) to any component in the tree. Throws with a clear error
	* message when used outside an ActivityLogProvider.
	*/
	var ActivityLogContext = (0, react.createContext)(null);
	/**
	* Read the Activity Log from context. Throws if used outside an
	* ActivityLogProvider.
	*/
	function useOptionalActivityLog() {
		return (0, react.useContext)(ActivityLogContext);
	}
	function useActivityLog() {
		const ctx = useOptionalActivityLog();
		if (!ctx) throw new Error("useActivityLog must be used within an <ActivityLogProvider>");
		return ctx;
	}
	//#endregion
	//#region src/audio-player/diagnostics/activityTypes.ts
	var DEFAULT_ACTIVITY_LOG_CONFIG = { maxEntries: 200 };
	//#endregion
	//#region src/audio-player/diagnostics/activityLogStore.ts
	/** Create a standalone activity log store. Callers can create multiple stores
	*  (e.g. one for a session, one for a plugin) or share a single global one. */
	function createActivityLogStore(config) {
		const { maxEntries } = {
			...DEFAULT_ACTIVITY_LOG_CONFIG,
			...config
		};
		const buffer = [];
		let nextId = 1;
		/** Non-blocking record. Wraps the entire operation in a try-catch so no
		*  caller ever has to worry about a bad entry crashing playback. */
		function record(entry) {
			try {
				const safeEntry = normalizeEntry(entry);
				const event = {
					id: nextId++,
					timestamp: Date.now(),
					area: safeEntry.area,
					status: safeEntry.status,
					message: safeEntry.message
				};
				if (safeEntry.details != null) event.details = safeEntry.details;
				if (safeEntry.error != null) event.error = safeEntry.error;
				buffer.push(event);
				if (buffer.length > maxEntries) buffer.splice(0, buffer.length - maxEntries);
			} catch {}
		}
		/** Clear all stored events. */
		function clear() {
			buffer.length = 0;
			nextId = 1;
		}
		/** Export as JSON — newest first. */
		function exportJson() {
			try {
				return JSON.stringify([...buffer].reverse(), null, 2);
			} catch {
				return "[]";
			}
		}
		/** Export as plain text — one line per event, newest first. */
		function exportText() {
			try {
				return [...buffer].reverse().map(formatLine).join("\n");
			} catch {
				return "";
			}
		}
		return {
			record,
			get events() {
				return buffer;
			},
			clear,
			exportJson,
			exportText,
			maxEntries,
			get count() {
				return buffer.length;
			}
		};
	}
	function pad2$1(n) {
		return n < 10 ? "0" + n : String(n);
	}
	function formatTimestamp(ts) {
		const d = new Date(ts);
		return pad2$1(d.getHours()) + ":" + pad2$1(d.getMinutes()) + ":" + pad2$1(d.getSeconds()) + "." + String(d.getMilliseconds()).padStart(3, "0");
	}
	var VALID_AREAS$1 = new Set([
		"plugin",
		"player",
		"canvas",
		"agent",
		"playback",
		"session",
		"system"
	]);
	var VALID_STATUSES$1 = new Set([
		"info",
		"warn",
		"error",
		"success"
	]);
	function normalizeEntry(entry) {
		const candidate = entry != null && typeof entry === "object" ? entry : {};
		return {
			area: VALID_AREAS$1.has(candidate.area) ? candidate.area : "system",
			status: VALID_STATUSES$1.has(candidate.status) ? candidate.status : "warn",
			message: String(candidate.message ?? "Malformed activity event"),
			details: candidate.details,
			error: candidate.error == null ? void 0 : String(candidate.error)
		};
	}
	var STATUS_PAD = 5;
	var AREA_PAD = 8;
	function formatLine(event) {
		let line = `[${formatTimestamp(event.timestamp)}] ${event.status.padEnd(STATUS_PAD)} ${event.area.padEnd(AREA_PAD)} ${event.message}`;
		if (event.error) line += ` | error: ${event.error}`;
		if (event.details) try {
			const detailStr = JSON.stringify(event.details);
			if (detailStr.length > 200) line += ` | ${detailStr.slice(0, 200)}…`;
			else line += ` | ${detailStr}`;
		} catch {}
		return line;
	}
	//#endregion
	//#region src/audio-player/diagnostics/ActivityLogPanel.tsx
	/**
	* ActivityLogPanel — the settings-panel UI for viewing, filtering, copying,
	* clearing, and exporting the current session's activity log.
	*
	* Renders inside the SAP Controller workspace shell. Uses VirtualList-style
	* rendering via a simple scroll-to-top-on-filter-change pattern. All actions
	* (clear, copy, export) are self-contained in this component.
	*/
	var AREA_LABELS = {
		plugin: "Plugin",
		player: "Player",
		canvas: "Canvas",
		agent: "Agent",
		playback: "Playback",
		session: "Session",
		system: "System"
	};
	var STATUS_CLASS = {
		info: "al-event--info",
		warn: "al-event--warn",
		error: "al-event--error",
		success: "al-event--success"
	};
	var VALID_AREAS = new Set(Object.keys(AREA_LABELS));
	var VALID_STATUSES = new Set(Object.keys(STATUS_CLASS));
	function ActivityLogPanel() {
		const contextLog = useOptionalActivityLog();
		const fallbackLogRef = (0, react.useRef)(null);
		if (!fallbackLogRef.current) fallbackLogRef.current = createActivityLogStore();
		const log = contextLog ?? fallbackLogRef.current;
		const listRef = (0, react.useRef)(null);
		const [filters, setFilters] = (0, react.useState)({
			status: "all",
			area: "all",
			search: ""
		});
		const [copied, setCopied] = (0, react.useState)(false);
		(0, react.useEffect)(() => {
			listRef.current?.scrollTo({ top: 0 });
		}, [filters]);
		const filtered = (0, react.useMemo)(() => {
			let result = getSafeEvents(log.events);
			if (filters.status !== "all") result = result.filter((e) => e.status === filters.status);
			if (filters.area !== "all") result = result.filter((e) => e.area === filters.area);
			if (filters.search.trim()) {
				const q = filters.search.toLowerCase();
				result = result.filter((e) => e.message.toLowerCase().includes(q) || e.error && e.error.toLowerCase().includes(q));
			}
			return result;
		}, [log.events, filters]);
		const handleStatusChange = (0, react.useCallback)((e) => {
			setFilters((f) => ({
				...f,
				status: e.target.value
			}));
		}, []);
		const handleAreaChange = (0, react.useCallback)((e) => {
			setFilters((f) => ({
				...f,
				area: e.target.value
			}));
		}, []);
		const handleSearchChange = (0, react.useCallback)((e) => {
			setFilters((f) => ({
				...f,
				search: e.target.value
			}));
		}, []);
		const handleClear = (0, react.useCallback)(() => {
			log.clear();
		}, [log]);
		const handleCopy = (0, react.useCallback)(() => {
			try {
				navigator.clipboard.writeText(log.exportText()).then(() => {
					setCopied(true);
					setTimeout(() => setCopied(false), 2e3);
				}, () => {});
			} catch {}
		}, [log]);
		const handleExportJson = (0, react.useCallback)(() => {
			downloadLog(log.exportJson(), `activity-log-${Date.now()}.json`, "application/json");
		}, [log]);
		const handleExportText = (0, react.useCallback)(() => {
			downloadLog(log.exportText(), `activity-log-${Date.now()}.txt`, "text/plain");
		}, [log]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "al",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "al__toolbar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "al__filters",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "al__select",
								value: filters.status,
								onChange: handleStatusChange,
								"aria-label": "Filter by status",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "all",
										children: "All status"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "info",
										children: "Info"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "warn",
										children: "Warn"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "error",
										children: "Error"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "success",
										children: "Success"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "al__select",
								value: filters.area,
								onChange: handleAreaChange,
								"aria-label": "Filter by area",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "all",
									children: "All areas"
								}), Object.keys(AREA_LABELS).map((area) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: area,
									children: AREA_LABELS[area]
								}, area))]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "al__search",
								type: "search",
								placeholder: "Search messages…",
								value: filters.search,
								onChange: handleSearchChange,
								"aria-label": "Search activity log"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "al__actions",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "al__btn al__btn--copy",
								onClick: handleCopy,
								"aria-label": copied ? "Copied" : "Copy log",
								title: copied ? "Copied!" : "Copy to clipboard",
								children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "al__icon-copy" }), copied ? "Copied" : "Copy"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "al__btn al__btn--export",
								onClick: handleExportText,
								"aria-label": "Export as text",
								title: "Export as .txt",
								children: "TXT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "al__btn al__btn--export",
								onClick: handleExportJson,
								"aria-label": "Export as JSON",
								title: "Export as .json",
								children: "JSON"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "al__btn al__btn--clear",
								onClick: handleClear,
								"aria-label": "Clear log",
								title: "Clear all events",
								children: "Clear"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "al__badge",
					children: [
						filtered.length,
						" / ",
						log.count,
						" event",
						log.count !== 1 ? "s" : "",
						filters.status !== "all" || filters.area !== "all" || filters.search.trim() ? " (filtered)" : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "al__list",
					ref: listRef,
					children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "al__empty",
						children: log.count === 0 ? "No events recorded yet." : "No events match the current filters."
					}) : filtered.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityEventRow, { event }, event.id))
				})
			]
		});
	}
	function ActivityEventRow({ event }) {
		const [expanded, setExpanded] = (0, react.useState)(false);
		const time = formatEventTime(event.timestamp);
		const statusClass = STATUS_CLASS[event.status];
		const hasDetails = event.details != null || event.error != null || event.message.length > 120;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `al-event ${statusClass}${expanded ? " al-event--expanded" : ""}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "al-event__summary",
				onClick: () => setExpanded((v) => !v),
				"aria-expanded": expanded,
				"aria-label": expanded ? "Collapse event details" : "Expand event details",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "al-event__time",
						children: time
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `al-event__status al-event__status--${event.status}`,
						children: event.status
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "al-event__area",
						children: AREA_LABELS[event.area]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "al-event__msg",
						children: event.message
					}),
					hasDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "al-event__chevron",
						"aria-hidden": "true",
						children: expanded ? "▾" : "▸"
					})
				]
			}), expanded && hasDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "al-event__details",
				children: [
					event.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "al-event__detail-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "al-event__detail-label",
							children: "Error"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "al-event__detail-val al-event__detail-val--error",
							children: event.error
						})]
					}),
					event.details && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "al-event__detail-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "al-event__detail-label",
							children: "Details"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "al-event__detail-val",
							children: formatDetails(event.details)
						})]
					}),
					event.message.length > 120 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "al-event__detail-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "al-event__detail-label",
							children: "Message"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "al-event__detail-val",
							children: event.message
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "al-event__detail-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "al-event__detail-label",
							children: "ID"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
							className: "al-event__detail-val",
							children: ["#", event.id]
						})]
					})
				]
			})]
		});
	}
	function getSafeEvents(events) {
		if (!Array.isArray(events)) return [];
		return events.map(toSafeEvent).filter((event) => event != null);
	}
	function toSafeEvent(event) {
		if (event == null || typeof event !== "object") return null;
		const candidate = event;
		const area = VALID_AREAS.has(candidate.area) ? candidate.area : "system";
		const status = VALID_STATUSES.has(candidate.status) ? candidate.status : "warn";
		const message = String(candidate.message ?? "Malformed activity event");
		const timestamp = typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp) ? candidate.timestamp : Date.now();
		const id = typeof candidate.id === "number" && Number.isFinite(candidate.id) ? candidate.id : timestamp;
		return {
			...candidate,
			id,
			timestamp,
			area,
			status,
			message,
			error: candidate.error == null ? void 0 : String(candidate.error)
		};
	}
	function formatEventTime(ts) {
		const d = new Date(ts);
		return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
	}
	function pad2(n) {
		return n < 10 ? "0" + n : String(n);
	}
	function formatDetails(details) {
		try {
			return JSON.stringify(details, null, 2);
		} catch {
			return String(details);
		}
	}
	function downloadLog(content, filename, mime) {
		try {
			const blob = new Blob([content], { type: mime });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.rel = "noopener";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {}
	}
	//#endregion
	//#region src/audio-player/diagnostics/ActivityLogWorkspace.tsx
	/**
	* ActivityLogWorkspace — the workspace surface that wraps the ActivityLogPanel
	* for the SAP Controller shell.
	*
	* This is the route destination for "diagnostics:activity-log". It provides
	* a scroll-ready container and the panel itself.
	*/
	function ActivityLogWorkspace() {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityLogPanel, {});
	}
	//#endregion
	//#region src/audio-player/visual-slots/ControllerPanelRenderer.tsx
	/**
	* Renders a registered component's `SettingsPanel` inside the SAPController
	* workspace sheet, wired to the per-player settings store. Used by the lyrics
	* workspace route to edit the lyric display's settings; edits flow straight back
	* to the live SEI Canvas visual through context.
	*/
	function ControllerPanelRenderer({ componentId, lyrics }) {
		const slots = useVisualSlots();
		const def = getVisualComponent(componentId);
		if (!def || !def.SettingsPanel) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: def?.name ?? "Settings"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "This visual has no configurable settings."
			})]
		});
		const { SettingsPanel } = def;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsPanel, {
			settings: slots.getSettings(def.id),
			onChange: (partial) => slots.updateSettings(def.id, partial),
			lyrics
		});
	}
	//#endregion
	//#region src/audio-player/visual-slots/VisualSlotPicker.tsx
	/**
	* Segmented-control picker that lists every visual component registered for a
	* slot, plus a "None" option. Selecting an entry calls `setActive` on the
	* per-player visual-slot store; the corresponding renderer picks it up
	* immediately through context.
	*
	* Mounted inside the `visual:canvas` workspace route so the Canvas page becomes
	* "choose a visual + tune it".
	*/
	function VisualSlotPicker({ slot = "seiCanvas" }) {
		const { getActive, setActive } = useVisualSlots();
		const components = getVisualComponentsForSlot(slot);
		const activeId = getActive(slot);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-visual-switcher",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sap-visual-switcher__label",
				children: "Choose Visual"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sap-visual-switcher__list",
				children: [components.map((def) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `sap-visual-switcher__btn${activeId === def.id ? " sap-visual-switcher__btn--active" : ""}`,
					onClick: () => setActive(slot, def.id),
					"aria-pressed": activeId === def.id,
					children: def.name
				}, def.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `sap-visual-switcher__btn${activeId === null ? " sap-visual-switcher__btn--active" : ""}`,
					onClick: () => setActive(slot, null),
					"aria-pressed": activeId === null,
					children: "None"
				}, "__none__")]
			})]
		});
	}
	//#endregion
	//#region src/audio-player/components/workspace/WorkspaceShell.tsx
	/** Human title for the sheet header, keyed by route. */
	function titleForRoute(route) {
		switch (route) {
			case "library:playlists": return "Playlists";
			case "library:queue": return "Up Next";
			case "plugin-settings:lyrics":
			case "visual:lyrics": return "Lyrics";
			case "plugin-settings:waveform": return "Waveform";
			case "playback:automix": return "Automix";
			case "agent:queue-director": return "Queue Director";
			case "diagnostics:activity-log": return "Activity Log";
			case "visual:canvas": return "Canvas";
			default: return "Workspace";
		}
	}
	/**
	* The visual:canvas workspace content: a slot picker at the top and the active
	* visual's settings panel below it. Extracted as its own component because it
	* needs hooks (useVisualSlots) and `contentForRoute` is a plain function.
	*/
	function VisualCanvasWorkspace({ lyrics }) {
		const { getActive } = useVisualSlots();
		const activeId = getActive("seiCanvas");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualSlotPicker, { slot: "seiCanvas" }), activeId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControllerPanelRenderer, {
			componentId: activeId,
			lyrics
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: "No Visual"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "Select a visual above to configure it."
			})]
		})] });
	}
	/**
	* Pick the placeholder workspace surface for a route. Switches on the full route
	* string for known routes (parity with `titleForRoute`) so a future `library:*`
	* or `playback:*` route can't silently fall through to the wrong surface; the
	* `default` only parses for the genuinely dynamic `plugin-settings:<id>` case.
	*/
	function contentForRoute(route, lyrics) {
		switch (route) {
			case "library:playlists": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryPlaylistsWorkspace, {});
			case "library:queue": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryQueueWorkspace, {});
			case "plugin-settings:lyrics":
			case "visual:lyrics": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControllerPanelRenderer, {
				componentId: LYRIC_DISPLAY_ID,
				lyrics
			});
			case "playback:automix": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaybackAutomixWorkspace, {});
			case "agent:queue-director": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentQueueDirectorWorkspace, {});
			case "diagnostics:activity-log": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityLogWorkspace, {});
			case "visual:canvas": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualCanvasWorkspace, { lyrics });
			default: {
				const parsed = parseWorkspaceRoute(route);
				if (parsed?.category === "plugin-settings" && parsed.target) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginSettingsWorkspace, { pluginId: parsed.target });
				return null;
			}
		}
	}
	function WorkspaceShell({ route, onClose, lyrics }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "sap-ctl__header",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "sap-ctl__title",
				children: titleForRoute(route)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "sap-ctl__close ap-tap",
				onClick: onClose,
				"aria-label": "Close workspace",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon$2, {})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sap-ctl__workspace",
			"data-route": route,
			children: contentForRoute(route, lyrics)
		})] });
	}
	//#endregion
	//#region src/audio-player/components/SAPController.tsx
	function Section({ title, children }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "sap-ctl__section",
			"aria-label": title,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "sap-ctl__heading",
				children: title
			}), children]
		});
	}
	function SwitchRow({ icon, label, on, onToggle }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "sap-ctl__row ap-tap",
			role: "switch",
			"aria-checked": on,
			onClick: onToggle,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "sap-ctl__label",
				children: [icon, label]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `sap-ctl__switch${on ? " sap-ctl__switch--on" : ""}`,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sap-ctl__knob" })
			})]
		});
	}
	var CloseIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "6",
			y1: "6",
			x2: "18",
			y2: "18"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
			x1: "18",
			y1: "6",
			x2: "6",
			y2: "18"
		})]
	});
	function KaraokeLyrics({ lyrics }) {
		const { currentTime } = useAudioSession();
		const parsed = (0, react.useMemo)(() => {
			const lines = lyrics.split("\n");
			const result = [];
			for (const line of lines) {
				const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/);
				if (match) {
					const m = parseInt(match[1], 10);
					const s = parseFloat(match[2]);
					result.push({
						time: m * 60 + s,
						text: match[3].trim()
					});
				} else result.push({
					time: -1,
					text: line
				});
			}
			return result;
		}, [lyrics]);
		const containerRef = (0, react.useRef)(null);
		if (!parsed.some((l) => l.time >= 0)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sap-ctl__lyrics",
			children: lyrics
		});
		let activeIndex = -1;
		for (let i = 0; i < parsed.length; i++) if (parsed[i].time >= 0 && currentTime >= parsed[i].time) activeIndex = i;
		(0, react.useEffect)(() => {
			if (activeIndex >= 0 && containerRef.current) {
				const container = containerRef.current;
				const el = container.children[activeIndex];
				if (el) {
					const containerRect = container.getBoundingClientRect();
					const elRect = el.getBoundingClientRect();
					const relativeTop = elRect.top - containerRect.top + container.scrollTop;
					container.scrollTo({
						top: relativeTop - containerRect.height / 2 + elRect.height / 2,
						behavior: "smooth"
					});
				}
			}
		}, [activeIndex]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "sap-ctl__lyrics sap-ctl__lyrics--karaoke",
			ref: containerRef,
			children: parsed.map((line, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `sap-ctl__lyric-line ${idx === activeIndex ? "sap-ctl__lyric-line--active" : ""}`,
				children: line.text || "\xA0"
			}, idx))
		});
	}
	function SAPController({ open, onClose, route = "options", playback, queue, info, share, pluginNames, waveform, accentColor, playIconColor, textColor, progressColor, trackColor, backgroundColor }) {
		const sheetRef = (0, react.useRef)(null);
		const closeRef = (0, react.useRef)(null);
		const [lyricsOpen, setLyricsOpen] = (0, react.useState)(false);
		const onCloseRef = (0, react.useRef)(onClose);
		onCloseRef.current = onClose;
		(0, react.useEffect)(() => {
			if (!open) return;
			const prev = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = prev;
			};
		}, [open]);
		(0, react.useEffect)(() => {
			if (!open) return;
			const opener = document.activeElement;
			const raf = requestAnimationFrame(() => {
				if (closeRef.current) closeRef.current.focus();
				else sheetRef.current?.querySelector("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")?.focus();
			});
			const handleKey = (e) => {
				if (e.key === "Escape") onCloseRef.current();
			};
			document.addEventListener("keydown", handleKey);
			return () => {
				cancelAnimationFrame(raf);
				document.removeEventListener("keydown", handleKey);
				if (opener?.isConnected) opener.focus();
			};
		}, [open]);
		(0, react.useEffect)(() => {
			if (!open) setLyricsOpen(false);
		}, [open]);
		const handleTrapKeyDown = (event) => {
			if (event.key !== "Tab" || !sheetRef.current) return;
			const focusables = Array.from(sheetRef.current.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			if (!active || !sheetRef.current.contains(active)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			} else if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};
		if (!open || typeof document === "undefined") return null;
		const themeVars = buildThemeVars({
			accentColor,
			playIconColor,
			textColor,
			progressColor,
			trackColor,
			backgroundColor
		});
		const isOptions = route === "options";
		return (0, react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl",
			style: themeVars,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sap-ctl__backdrop",
				onClick: onClose,
				"aria-hidden": "true"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: sheetRef,
				className: "sap-ctl__sheet",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": isOptions ? "Player options" : "Player workspace",
				onKeyDown: handleTrapKeyDown,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sap-ctl__grab",
						"aria-hidden": "true"
					}),
					!isOptions && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShell, {
						route,
						onClose,
						lyrics: info?.lyrics
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sap-ctl__divider",
						role: "separator",
						"aria-hidden": "true"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "sap-ctl__header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "sap-ctl__title",
							children: isOptions ? "Options" : "Options"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							ref: closeRef,
							type: "button",
							className: "sap-ctl__close ap-tap",
							onClick: onClose,
							"aria-label": isOptions ? "Close player options" : "Close workspace",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloseIcon, {})
						})]
					}),
					playback && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
						title: "Playback",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShuffleIcon, {}),
								label: "Shuffle",
								on: playback.shuffle,
								onToggle: playback.onToggleShuffle
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "sap-ctl__row ap-tap",
								onClick: playback.onCycleRepeat,
								"aria-label": `Repeat: ${playback.repeatMode}. Activate to change.`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "sap-ctl__label",
									children: [playback.repeatMode === "one" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepeatOneIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepeatIcon, {}), "Repeat"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sap-ctl__value",
									children: playback.repeatMode
								})]
							}),
							playback.onToggleAutomix && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomixIcon, {}),
								label: "Automix",
								on: playback.automix ?? false,
								onToggle: playback.onToggleAutomix
							}),
							playback.onToggleAutoPlay && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoPlayIcon, {}),
								label: "Auto Play",
								on: playback.autoPlay ?? false,
								onToggle: playback.onToggleAutoPlay
							})
						]
					}),
					queue && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
						title: "Queue",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "sap-ctl__row ap-tap",
							onClick: () => {
								onClose();
								queue.onOpenQueue();
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "sap-ctl__label",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueIcon, {}), "Up Next"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "sap-ctl__value",
								children: [
									queue.count,
									" track",
									queue.count !== 1 ? "s" : ""
								]
							})]
						})
					}),
					info && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
						title: "Info",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sap-ctl__meta",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sap-ctl__meta-row",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sap-ctl__meta-key",
										children: "Track"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sap-ctl__meta-val",
										children: info.title
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sap-ctl__meta-row",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sap-ctl__meta-key",
										children: "Artist"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sap-ctl__meta-val",
										children: info.artist
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "sap-ctl__meta-row",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sap-ctl__meta-key",
										children: "Length"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sap-ctl__meta-val",
										children: Number.isFinite(info.duration) && info.duration > 0 ? formatTime(info.duration) : "–:––"
									})]
								})
							]
						}), info.lyrics && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "sap-ctl__row ap-tap",
							onClick: () => setLyricsOpen((v) => !v),
							"aria-expanded": lyricsOpen,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "sap-ctl__label",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LyricsIcon, {}), "Lyrics"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sap-ctl__value",
								children: lyricsOpen ? "hide" : "show"
							})]
						}), lyricsOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KaraokeLyrics, { lyrics: info.lyrics })] })]
					}),
					share && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
						title: "Share",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "sap-ctl__row ap-tap",
							onClick: share.onShare,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "sap-ctl__label",
								children: [share.copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShareIcon, {}), "Share"]
							}), share.copied && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sap-ctl__value",
								children: "copied"
							})]
						})
					}),
					waveform && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
						title: "Visual",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchRow, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveIcon, {}),
							label: "Show Waveform",
							on: waveform.enabled,
							onToggle: waveform.onToggle
						})
					}),
					pluginNames && pluginNames.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
						title: "Plugins",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "sap-ctl__plugins",
							children: pluginNames.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "sap-ctl__plugin",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "sap-ctl__label",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginIcon, {}), name]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sap-ctl__value",
									children: "active"
								})]
							}, name))
						})
					})
				]
			})]
		}), document.body);
	}
	//#endregion
	//#region src/audio-player/components/HoldSkipButton.tsx
	var DEFAULT_HOLD_MS = 1200;
	/**
	* Consolidated transport button: a short press seeks, an intentional hold skips
	* tracks. Pointer and keyboard paths share the same timer so mobile, desktop,
	* and assistive keyboard users get equivalent behavior.
	*/
	function HoldSkipButton({ direction, disabled = false, skipDisabled = false, seekLabel, skipLabel, onSeek, onSkip, children, className = "", holdMs = DEFAULT_HOLD_MS }) {
		const hintId = (0, react.useId)();
		const timerRef = (0, react.useRef)(null);
		const heldRef = (0, react.useRef)(false);
		const pressingRef = (0, react.useRef)(false);
		const [isHolding, setIsHolding] = (0, react.useState)(false);
		const clearHoldTimer = (0, react.useCallback)(() => {
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		}, []);
		const resetHold = (0, react.useCallback)(() => {
			clearHoldTimer();
			pressingRef.current = false;
			heldRef.current = false;
			setIsHolding(false);
		}, [clearHoldTimer]);
		const startHold = (0, react.useCallback)(() => {
			if (disabled || pressingRef.current) return;
			pressingRef.current = true;
			heldRef.current = false;
			setIsHolding(!skipDisabled);
			if (skipDisabled) return;
			timerRef.current = window.setTimeout(() => {
				heldRef.current = true;
				pressingRef.current = false;
				setIsHolding(false);
				onSkip();
			}, holdMs);
		}, [
			disabled,
			holdMs,
			onSkip,
			skipDisabled
		]);
		const finishPress = (0, react.useCallback)(() => {
			if (disabled || !pressingRef.current) {
				resetHold();
				return;
			}
			const completedHold = heldRef.current;
			resetHold();
			if (!completedHold) onSeek();
		}, [
			disabled,
			onSeek,
			resetHold
		]);
		const cancelPress = (0, react.useCallback)(() => {
			resetHold();
		}, [resetHold]);
		(0, react.useEffect)(() => {
			resetHold();
		}, [
			resetHold,
			disabled,
			skipDisabled
		]);
		const handlePointerDown = (event) => {
			if (event.button !== 0) return;
			startHold();
		};
		const handlePointerEnd = (_event) => {
			finishPress();
		};
		const handleKeyDown = (event) => {
			if (event.key !== " " && event.key !== "Enter") return;
			if (event.repeat) return;
			event.preventDefault();
			startHold();
		};
		const handleKeyUp = (event) => {
			if (event.key !== " " && event.key !== "Enter") return;
			event.preventDefault();
			finishPress();
		};
		const label = `${seekLabel}; hold for ${skipLabel.toLowerCase()}`;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: `${className} ap-hold-skip ap-hold-skip--${direction}${isHolding ? " ap-hold-skip--holding" : ""}`.trim(),
			style: { "--ap-hold-ms": `${holdMs}ms` },
			disabled,
			"aria-label": label,
			"aria-describedby": hintId,
			"data-hold-label": skipDisabled ? "Unavailable" : "Hold",
			onPointerDown: handlePointerDown,
			onPointerUp: handlePointerEnd,
			onPointerCancel: cancelPress,
			onPointerLeave: cancelPress,
			onKeyDown: handleKeyDown,
			onKeyUp: handleKeyUp,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-hold-skip__icon",
					"aria-hidden": "true",
					children
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-hold-skip__progress",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					id: hintId,
					className: "ap-sr-only",
					children: [
						"Tap to ",
						seekLabel.toLowerCase(),
						". Hold for about one second for ",
						skipLabel.toLowerCase(),
						"."
					]
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/components/useShareTrack.ts
	function useShareTrack(title, artist) {
		const [copied, setCopied] = (0, react.useState)(false);
		const timeoutRef = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			return () => {
				if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
			};
		}, []);
		return {
			share: (0, react.useCallback)(() => {
				if (typeof window === "undefined") return;
				const url = window.location.href;
				const text = `${title} by ${artist}`;
				if (navigator.share) navigator.share({
					title: text,
					url
				}).catch(() => {});
				else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => {
					if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
					setCopied(true);
					timeoutRef.current = setTimeout(() => setCopied(false), 2e3);
				}).catch(() => {});
			}, [title, artist]),
			copied,
			nativeShare: typeof navigator !== "undefined" && typeof navigator.share === "function"
		};
	}
	//#endregion
	//#region src/audio-player/components/useReducedMotion.ts
	var QUERY = "(prefers-reduced-motion: reduce)";
	/**
	* Tracks the user's `prefers-reduced-motion` setting and updates if it changes
	* mid-session. SSR-safe: with no `window`/`matchMedia` it reports `false`, the
	* motion-on default, matching the server render.
	*/
	function useReducedMotion() {
		const [reduced, setReduced] = (0, react.useState)(() => typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY).matches : false);
		(0, react.useEffect)(() => {
			if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
			const mq = window.matchMedia(QUERY);
			const onChange = () => setReduced(mq.matches);
			onChange();
			mq.addEventListener?.("change", onChange);
			return () => mq.removeEventListener?.("change", onChange);
		}, []);
		return reduced;
	}
	//#endregion
	//#region src/audio-player/utils/formatMetadata.ts
	/** Title for display, falling back to a labeled placeholder when empty. */
	function getDisplayTitle(track, fallback = "Unknown Track") {
		return track?.title?.trim() || fallback;
	}
	/** Artist for display, falling back to a labeled placeholder when empty. */
	function getDisplayArtist(track, fallback = "Unknown Artist") {
		return track?.artist?.trim() || fallback;
	}
	/** Append a version qualifier in parentheses, e.g. `Title (Radio Edit)`. */
	function formatVersionedTitle(title, versionLabel) {
		const version = versionLabel?.trim();
		return version ? `${title} (${version})` : title;
	}
	/**
	* Compose the "feat. …" suffix from a list of featured artists, dropping blanks.
	* One name → `feat. A`; many → `feat. A, B & C`. Empty list → `""`.
	*/
	function formatFeatured(featuredArtists) {
		const names = (featuredArtists ?? []).map((n) => n?.trim()).filter((n) => Boolean(n));
		if (names.length === 0) return "";
		if (names.length === 1) return `feat. ${names[0]}`;
		const last = names[names.length - 1];
		return `feat. ${names.slice(0, -1).join(", ")} & ${last}`;
	}
	/**
	* The secondary line: `Artist [feat. …] [· Album]`. Album wins the trailing
	* slot; when there's neither album nor featured artists, an optional `subtitle`
	* fills it instead.
	*/
	function formatSecondaryLine(track, artistFallback = "Unknown Artist") {
		const artist = getDisplayArtist(track, artistFallback);
		const featured = formatFeatured(track?.featuredArtists);
		const lead = featured ? `${artist} ${featured}` : artist;
		const album = track?.albumTitle?.trim();
		const subtitle = !featured ? track?.subtitle?.trim() : "";
		const trailing = album || subtitle || "";
		return trailing ? `${lead} · ${trailing}` : lead;
	}
	/**
	* Decide whether a marquee should scroll: only when the text actually overflows
	* its container, motion is allowed, and the container is wide enough to be worth
	* it. A 1px slack avoids sub-pixel false positives.
	*/
	function shouldEnableMarquee({ contentWidth, containerWidth, reducedMotion, minWidth = 200 }) {
		if (reducedMotion) return false;
		if (containerWidth < minWidth) return false;
		return contentWidth - containerWidth > 1;
	}
	//#endregion
	//#region src/audio-player/components/TextMarquee.tsx
	/**
	* Scrolls long text horizontally, but only when it genuinely overflows its
	* container. Overflow is measured with a ResizeObserver (RAF-debounced, never in
	* a render loop), and the scroll is a single GPU-composited transform driven by
	* CSS. When the text fits, or the user prefers reduced motion, it falls back to
	* static ellipsis truncation. The full text stays in one DOM node, so screen
	* readers read it once. Pauses on hover/focus (handled in CSS).
	*/
	function TextMarquee({ children, className, title, disabled = false, minWidth = 200, secondsPer100px = 3 }) {
		const containerRef = (0, react.useRef)(null);
		const innerRef = (0, react.useRef)(null);
		const reducedMotion = useReducedMotion();
		const [distance, setDistance] = (0, react.useState)(0);
		(0, react.useEffect)(() => {
			const container = containerRef.current;
			const inner = innerRef.current;
			if (!container || !inner) return;
			if (disabled || reducedMotion || typeof ResizeObserver === "undefined") {
				setDistance(0);
				return;
			}
			let rafId = 0;
			const measure = () => {
				const containerWidth = container.clientWidth;
				const contentWidth = inner.scrollWidth;
				setDistance(shouldEnableMarquee({
					contentWidth,
					containerWidth,
					reducedMotion,
					minWidth
				}) ? contentWidth - containerWidth : 0);
			};
			const schedule = () => {
				cancelAnimationFrame(rafId);
				rafId = requestAnimationFrame(measure);
			};
			const observer = new ResizeObserver(schedule);
			observer.observe(container);
			observer.observe(inner);
			schedule();
			return () => {
				cancelAnimationFrame(rafId);
				observer.disconnect();
			};
		}, [
			children,
			disabled,
			reducedMotion,
			minWidth
		]);
		const scrolling = distance > 0;
		const travel = distance + 8;
		const style = scrolling ? {
			"--ap-marquee-distance": `${travel}px`,
			"--ap-marquee-duration": `${Math.max(6, travel / 100 * secondsPer100px)}s`
		} : void 0;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: containerRef,
			className: `ap-marquee${className ? ` ${className}` : ""}`,
			"data-scroll": scrolling ? "true" : "false",
			title,
			style,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				ref: innerRef,
				className: "ap-marquee__inner",
				children
			})
		});
	}
	//#endregion
	//#region src/audio-player/components/TrackMetadata.tsx
	/** Small "E" badge marking explicit content. Decorative glyph, real label. */
	function ExplicitBadge({ className }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `ap-explicit-badge${className ? ` ${className}` : ""}`,
			"aria-label": "Explicit content",
			title: "Explicit content",
			children: "E"
		});
	}
	/**
	* The shared title / artist / album hierarchy. A single, accessible building
	* block so every face presents metadata identically: primary line (title +
	* version + explicit badge), secondary line (artist + featured + album), and an
	* optional tertiary release line. Display-only — it reads a few optional Track
	* fields and nothing else.
	*/
	function TrackMetadata({ track, variant = "compact", enableMarquee = false, showTertiary = false, titleFallback = "Unknown Track", artistFallback = "Unknown Artist", className }) {
		const title = formatVersionedTitle(getDisplayTitle(track, titleFallback), track?.versionLabel);
		const artist = getDisplayArtist(track, artistFallback);
		const featured = formatFeatured(track?.featuredArtists);
		const album = track?.albumTitle?.trim();
		const subtitle = !featured ? track?.subtitle?.trim() : "";
		const trailing = album || subtitle || "";
		const release = track?.releaseTitle?.trim();
		const secondaryText = [
			artist,
			featured,
			trailing
		].filter(Boolean).join(" ");
		const primary = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [title, track?.explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})] });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-meta ap-meta--${variant}${className ? ` ${className}` : ""}`,
			"data-variant": variant,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-meta__primary",
					dir: "auto",
					children: enableMarquee ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextMarquee, {
						className: "ap-meta__title",
						title,
						children: primary
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-meta__title",
						title,
						children: primary
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-meta__secondary",
					title: secondaryText,
					dir: "auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-meta__artist",
							children: artist
						}),
						featured && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "ap-meta__featured",
							"aria-label": `featuring ${track?.featuredArtists?.join(", ") ?? ""}`,
							children: [" ", featured]
						}),
						trailing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "ap-meta__album",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ap-meta__sep",
								"aria-hidden": "true",
								children: " · "
							}), trailing]
						})
					]
				}),
				showTertiary && release && release !== album && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-meta__tertiary",
					title: release,
					children: release
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/utils/useArtworkColor.ts
	/**
	* Extracts the average RGB color from an image URL using a hidden canvas.
	* Falls back to null if the image fails to load or CORS prevents extraction.
	*/
	function useArtworkColor(src) {
		const [color, setColor] = (0, react.useState)(null);
		(0, react.useEffect)(() => {
			if (!src) {
				setColor(null);
				return;
			}
			let isMounted = true;
			const img = new Image();
			img.crossOrigin = "Anonymous";
			img.onload = () => {
				if (!isMounted) return;
				try {
					const canvas = document.createElement("canvas");
					const ctx = canvas.getContext("2d");
					if (!ctx) return;
					canvas.width = 64;
					canvas.height = 64;
					ctx.drawImage(img, 0, 0, 64, 64);
					const imageData = ctx.getImageData(0, 0, 64, 64).data;
					let r = 0, g = 0, b = 0, totalAlpha = 0;
					for (let i = 0; i < imageData.length; i += 4) {
						const a = imageData[i + 3];
						r += imageData[i] * a;
						g += imageData[i + 1] * a;
						b += imageData[i + 2] * a;
						totalAlpha += a;
					}
					if (totalAlpha === 0) setColor(null);
					else setColor(`rgb(${Math.round(r / totalAlpha)}, ${Math.round(g / totalAlpha)}, ${Math.round(b / totalAlpha)})`);
				} catch (err) {
					if (isMounted) setColor(null);
				}
			};
			img.onerror = () => {
				if (isMounted) setColor(null);
			};
			img.src = src;
			return () => {
				isMounted = false;
				img.onload = null;
				img.onerror = null;
			};
		}, [src]);
		return color;
	}
	//#endregion
	//#region src/audio-player/utils/device.ts
	/**
	* Lightweight client device detection, used to decide UI defaults that depend
	* on platform capability rather than viewport size.
	*
	* Why this exists: iOS Safari (and several other mobile browsers) ignore
	* programmatic `volume` changes on HTML5 audio — only the `muted` attribute is
	* honored. Rendering a volume slider there implies a control that does nothing,
	* so skins hide the slider by default on mobile and surface the mute button
	* instead. The `useAudioPlayer` engine still detects the unsupported case at
	* runtime (`volumeUnsupported`); this is the *default-visibility* heuristic so
	* the slider never appears in the first place on touch devices.
	*
	* All checks are SSR-safe: with no `window`/`navigator` they report "not
	* mobile", which keeps the desktop default (volume shown) on the server.
	*/
	/**
	* iOS / iPadOS detection. Covers classic iPhone/iPod/iPad user agents plus
	* iPadOS 13+, which masquerades as desktop Safari ("MacIntel") but exposes a
	* touch screen via `maxTouchPoints`.
	*/
	function isIOS() {
		if (typeof navigator === "undefined") return false;
		const ua = navigator.userAgent || "";
		if (/iPad|iPhone|iPod/.test(ua)) return true;
		return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
	}
	/**
	* Best-effort "is this a phone/tablet touch browser" check. Combines a
	* user-agent signal with a feature-detection fallback (coarse pointer + touch
	* capability) so it still resolves correctly on UAs the regex doesn't list.
	*/
	function isMobileDevice() {
		if (typeof window === "undefined" || typeof navigator === "undefined") return false;
		if (isIOS()) return true;
		const ua = navigator.userAgent || "";
		if (/Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
		const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
		const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
		return hasTouch && coarsePointer;
	}
	/**
	* The default visibility for volume *sliders* in skins. Desktop keeps the
	* slider; mobile hides it (mute remains the reliable control). Skins still
	* accept an explicit `showVolume` prop, which always wins over this default.
	*/
	function defaultShowVolume() {
		return !isMobileDevice();
	}
	//#endregion
	//#region src/audio-player/utils/trackList.ts
	var EMPTY_TRACKS = [];
	function resolveTrackList(tracks) {
		return tracks ?? EMPTY_TRACKS;
	}
	//#endregion
	//#region src/audio-player/AudioPlayer.tsx
	var TrackRow = (0, react.memo)(({ index, style, data }) => {
		const { queue, currentIndex, onPlay, isPlaying } = data;
		const track = queue[index];
		if (!track) return null;
		const active = index === currentIndex;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			style,
			role: "listitem",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "ap-tracklist__item" + (active ? " ap-tracklist__item--active" : ""),
				onClick: () => onPlay(index),
				"aria-current": active ? "true" : void 0,
				style: {
					height: "calc(100% - 4px)",
					width: "100%",
					boxSizing: "border-box"
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-tracklist__num",
						children: index + 1
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ap-tracklist__meta",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-tracklist__title",
							children: track.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-tracklist__artist",
							children: track.artist
						})]
					}),
					active && isPlaying && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ap-eq",
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
						]
					})
				]
			})
		});
	});
	var DEFAULT_AUDIO = "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3";
	var EMPTY_PLUGINS = [];
	function trackPeaksSignature(peaks) {
		if (!peaks) return "";
		return peaks.map((channel) => {
			const last = channel.length > 0 ? channel[channel.length - 1] : "";
			return `${channel.length}:${channel[0] ?? ""}:${last}`;
		}).join(",");
	}
	function trackListSignature(tracks) {
		return JSON.stringify(tracks.map((track) => [
			trackKey(track),
			track.title ?? "",
			track.artist ?? "",
			track.audioFile ?? "",
			trackSourcesSignature(track),
			track.purchaseUrl ?? "",
			track.lyrics ?? "",
			track.waveformDuration ?? null,
			trackPeaksSignature(track.peaks)
		]));
	}
	/**
	* React error boundary wrapping the player body. Keeps an unexpected render
	* error in a child component (slider, menu, etc.) from crashing the entire
	* host app. The fallback surfaces a minimal message and a way to retry the
	* render attempt.
	*/
	var AudioPlayerErrorBoundary = class extends react.Component {
		state = { error: null };
		static getDerivedStateFromError(error) {
			return { error };
		}
		componentDidCatch(error) {
			console.error("[AudioPlayer] render error:", error);
		}
		handleReset = () => {
			this.setState({ error: null });
		};
		render() {
			if (this.state.error) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ap-error-boundary",
				role: "alert",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "ap-error-boundary__title",
						children: this.props.fallbackTitle
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "ap-error-boundary__message",
						children: this.state.error.message
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ap-retry-btn",
						onClick: this.handleReset,
						children: "Retry"
					})
				]
			});
			return this.props.children;
		}
	};
	/**
	* The standalone, self-contained player (`PLAYER_FACE_CAPABILITIES.portable`).
	*
	* Main is *the better version of the FullCardPlayer*, not a different player:
	* it runs on the exact same `AudioSessionProvider` engine every other skin
	* uses. Rather than require the host to wrap it, `AudioPlayer` provides its own
	* session internally from its flat props (`title`/`artist`/`audioFile` or a
	* `tracks` playlist), so standalone usage is unchanged while the queue,
	* shuffle/repeat/automix logic, plugin pipeline, and end-of-track advance are
	* all owned by the shared session — no duplicated playback engine.
	*
	* Full-featured portable player with complete surface infrastructure support:
	* - `SEICanvasHost` for plugin visual areas (canvas toggle + Up Next queue)
	* - `ScrubberCanvasHost` + `WaveformAdapter` for unified scrubber waveform
	* - `PlayerSurfaceButtons` providing:
	*   - Left: SEI Canvas toggle button
	*   - Right: `SEICanvasActionMenu` (radial command wheel)
	* - `SAPController` for deep actions (shuffle, repeat, automix, autoplay,
	*   queue, info, share, plugins) — shared with the arc menu via workspace routes
	*
	* The arc menu and "..." button share a single SAPController instance, with
	* workspace routes determining which focused panel displays (e.g. Lyrics,
	* Automix, Plugin Settings). This matches the FullCardPlayer architecture.
	*
	* Waveform display is controlled by:
	* 1. Explicit `showWaveform` prop (highest priority)
	* 2. WaveformPlugin presence + toggle state
	* 3. Falls back to basic progress bar
	*
	* Mobile volume follows `defaultShowVolume()` default (visible on desktop,
	* hidden on touch).
	*/
	function AudioPlayer(props) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudioPlayerErrorBoundary, {
			fallbackTitle: "Audio player failed to render",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudioPlayerInner, { ...props })
		});
	}
	/**
	* Outer shell: resolves props into a session queue and provides its own
	* `AudioSessionProvider`, so the body below is a true session skin (like
	* `FullCardPlayer`) instead of a parallel engine. The provider owns the single
	* `<audio>` element, the queue/shuffle/repeat/automix logic, the plugin
	* pipeline, and end-of-track advance.
	*/
	function AudioPlayerInner(props) {
		const { tracks: tracksProp, audioFile = DEFAULT_AUDIO, title = "Audio Track", artist = "Artist Name", purchaseUrl = "", lyrics = "", autoPlay = false, loop = false, shuffle = false, repeatMode: repeatModeProp, automix = false, plugins: externalPlugins = EMPTY_PLUGINS, audioBackend = "html5", onFallbackSource } = props;
		const tracks = resolveTrackList(tracksProp);
		const isPlaylistMode = tracks.length > 0;
		const initialQueue = (0, react.useMemo)(() => isPlaylistMode ? tracks : [{
			title,
			artist,
			audioFile,
			fallbackSources: props.fallbackSources,
			sources: props.sources,
			purchaseUrl,
			lyrics
		}], [
			isPlaylistMode,
			tracks,
			title,
			artist,
			audioFile,
			props.fallbackSources,
			props.sources,
			purchaseUrl,
			lyrics
		]);
		const queueSignature = (0, react.useMemo)(() => trackListSignature(initialQueue), [initialQueue]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudioSessionProvider, {
			initialQueue,
			autoPlay,
			shuffle,
			repeatMode: repeatModeProp ?? (loop ? "one" : "off"),
			automix,
			plugins: externalPlugins,
			audioBackend,
			onFallbackSource,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudioPlayerBody, {
				...props,
				isPlaylistMode,
				resolvedQueue: initialQueue,
				queueSignature
			})
		});
	}
	function AudioPlayerBody(props) {
		const { isPlaylistMode, resolvedQueue, queueSignature, audioFile = DEFAULT_AUDIO, title = "Audio Track", artist = "Artist Name", purchaseUrl = "", lyrics = "", autoPlay = false, backgroundImage, backgroundMedia, blurSize = 20, darkenAmount = 0, showTracklist = false, showVolume = defaultShowVolume(), showWaveform, waveformHeight = 48, titleFont, artistFont, accentColor = "#FFFFFF", playIconColor = "#000000", textColor = "#FFFFFF", progressColor = "#FFFFFF", trackColor = "rgba(204, 204, 204, 0.35)", backgroundColor = "rgba(255, 255, 255, 0)", glowColor = "transparent", glowIntensity = 100, buttonOpacity = 0, plugins: externalPlugins = EMPTY_PLUGINS, className, style } = props;
		const s = useAudioSession();
		const [announcement, setAnnouncement] = (0, react.useState)("");
		const [controllerOpen, setControllerOpen] = (0, react.useState)(false);
		const [localAutoPlay, setLocalAutoPlay] = (0, react.useState)(autoPlay);
		const [queueOpen, setQueueOpen] = (0, react.useState)(false);
		const surface = usePlayerSurface("portable");
		const [controllerRoute, setControllerRoute] = (0, react.useState)("options");
		const rootRef = (0, react.useRef)(null);
		const previousQueueSignatureRef = (0, react.useRef)(queueSignature);
		const hasWaveformPlugin = (0, react.useMemo)(() => externalPlugins.some((plugin) => plugin.providesWaveform), [externalPlugins]);
		const hasKeyboardShortcutPlugin = (0, react.useMemo)(() => externalPlugins.some((plugin) => plugin.handlesKeyboardShortcuts), [externalPlugins]);
		const [waveformEnabled, setWaveformEnabled] = (0, react.useState)(true);
		const [prevHasWaveformPlugin, setPrevHasWaveformPlugin] = (0, react.useState)(hasWaveformPlugin);
		if (hasWaveformPlugin !== prevHasWaveformPlugin) {
			setPrevHasWaveformPlugin(hasWaveformPlugin);
			if (hasWaveformPlugin) setWaveformEnabled(true);
		}
		const effectiveWaveform = showWaveform ?? (hasWaveformPlugin ? waveformEnabled : false);
		(0, react.useEffect)(() => {
			if (previousQueueSignatureRef.current === queueSignature) return;
			previousQueueSignatureRef.current = queueSignature;
			const current = s.currentIndex < 0 ? 0 : s.currentIndex;
			const nextIndex = Math.min(current, Math.max(0, resolvedQueue.length - 1));
			s.setQueue(resolvedQueue, nextIndex, false);
		}, [queueSignature]);
		const [prevAutoPlay, setPrevAutoPlay] = (0, react.useState)(autoPlay);
		if (autoPlay !== prevAutoPlay) {
			setPrevAutoPlay(autoPlay);
			setLocalAutoPlay(autoPlay);
		}
		const { currentTrack: sessionTrack, currentIndex, queue, isPlaying, currentTime, duration, buffered, volume, isMuted, isBuffering, isSeeking, hasError, errorMessage, hasAudio, currentSrc, volumeUnsupported, autoplayBlocked, shuffle, repeatMode, automix, canNext, canPrevious } = s;
		const currentTrack = sessionTrack ?? {
			title,
			artist,
			audioFile,
			fallbackSources: props.fallbackSources,
			sources: props.sources,
			purchaseUrl,
			lyrics
		};
		const sourceKey = sessionTrack ? `${currentIndex}:${trackKey(sessionTrack)}:${trackSourcesSignature(sessionTrack)}` : "empty";
		const showPlaySpinner = isBuffering;
		const canPreviousTrack = isPlaylistMode && canPrevious;
		const canNextTrack = isPlaylistMode && canNext;
		const handleAutoPlayToggle = (0, react.useCallback)(() => setLocalAutoPlay((v) => !v), []);
		const handleQueuePlayTrack = (0, react.useCallback)((index) => {
			s.playTrack(index);
			setQueueOpen(false);
		}, [s]);
		const { share, copied: shareCopied, nativeShare } = useShareTrack(currentTrack.title ?? "", currentTrack.artist ?? "");
		const handleShareClick = (0, react.useCallback)(() => {
			if (nativeShare) setControllerOpen(false);
			share();
		}, [nativeShare, share]);
		const handleCloseController = (0, react.useCallback)(() => {
			setControllerOpen(false);
			setControllerRoute("options");
		}, []);
		const handleOpenFocusedController = (0, react.useCallback)((route) => {
			setControllerRoute(route);
			setControllerOpen(true);
		}, []);
		const handleOpenOptions = (0, react.useCallback)(() => {
			setControllerRoute("options");
			setControllerOpen(true);
		}, []);
		const handleRootKeyDown = (0, react.useCallback)((event) => {
			if (hasKeyboardShortcutPlugin) return;
			const onInteractive = !!event.target.closest("button, a, input, [role='slider']");
			const key = event.key.toLowerCase();
			if ((event.key === " " || key === "k") && !onInteractive) {
				event.preventDefault();
				s.toggle();
			} else if (key === "j") {
				event.preventDefault();
				s.seekBy(-10);
			} else if (key === "l") {
				event.preventDefault();
				s.seekBy(10);
			} else if (key === "n" && isPlaylistMode) {
				event.preventDefault();
				s.next();
			} else if (key === "p" && isPlaylistMode) {
				event.preventDefault();
				s.previous();
			}
		}, [
			hasKeyboardShortcutPlugin,
			isPlaylistMode,
			s
		]);
		const lastPlayedRef = (0, react.useRef)(null);
		const lastErrorRef = (0, react.useRef)(null);
		const lastAutoplayRef = (0, react.useRef)(null);
		const lastMissingRef = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			if (lastPlayedRef.current !== isPlaying) {
				lastPlayedRef.current = isPlaying;
				if (isPlaying) setAnnouncement(`Playing ${currentTrack.title} by ${currentTrack.artist}`);
			}
		}, [
			isPlaying,
			currentTrack.title,
			currentTrack.artist
		]);
		(0, react.useEffect)(() => {
			const msg = errorMessage || "";
			if (lastErrorRef.current !== msg && hasError) {
				lastErrorRef.current = msg;
				setAnnouncement(`Error: ${msg}`);
			} else if (!hasError) lastErrorRef.current = null;
		}, [hasError, errorMessage]);
		(0, react.useEffect)(() => {
			if (lastAutoplayRef.current !== autoplayBlocked) {
				lastAutoplayRef.current = autoplayBlocked;
				if (autoplayBlocked) setAnnouncement("Autoplay blocked. Tap play to start audio.");
			}
		}, [autoplayBlocked]);
		(0, react.useEffect)(() => {
			if (lastMissingRef.current !== hasAudio) {
				lastMissingRef.current = hasAudio;
				if (!hasAudio) setAnnouncement("Audio file missing");
			}
		}, [hasAudio]);
		const artworkSrc = (0, react.useMemo)(() => {
			const candidates = [
				currentTrack.artwork,
				backgroundMedia?.src,
				backgroundImage?.src
			];
			for (const value of candidates) {
				const resolved = resolveArtworkSrc(value);
				if (resolved) return resolved;
			}
		}, [
			currentTrack.artwork,
			backgroundMedia?.src,
			backgroundImage?.src
		]);
		const artwork = (0, react.useMemo)(() => artworkSrc ? buildMediaSessionArtwork(artworkSrc) : [], [artworkSrc]);
		const dynamicColor = useArtworkColor(artworkSrc);
		useMediaSessionObserver(s, {
			title: currentTrack.title,
			artist: currentTrack.artist,
			album: currentTrack.albumTitle ?? "",
			artwork,
			onNext: canNextTrack ? s.next : void 0,
			onPrevious: canPreviousTrack ? s.previous : void 0,
			sourceKey
		});
		const [pageVisible, setPageVisible] = (0, react.useState)(() => typeof document === "undefined" ? true : document.visibilityState !== "hidden");
		(0, react.useEffect)(() => {
			if (typeof document === "undefined") return;
			const onVis = () => setPageVisible(document.visibilityState !== "hidden");
			document.addEventListener("visibilitychange", onVis);
			return () => document.removeEventListener("visibilitychange", onVis);
		}, []);
		const themeVars = {
			"--ap-accent": accentColor?.toUpperCase() === "#FFFFFF" && dynamicColor ? dynamicColor : accentColor,
			"--ap-play-icon": playIconColor,
			"--ap-text": textColor,
			"--ap-progress": progressColor?.toUpperCase() === "#FFFFFF" && dynamicColor ? dynamicColor : progressColor,
			"--ap-track": trackColor,
			"--ap-bg": backgroundColor,
			"--ap-glow": glowColor === "transparent" && dynamicColor ? dynamicColor : glowColor,
			"--ap-glow-intensity": glowIntensity / 100,
			"--ap-btn-opacity-delta": `${buttonOpacity}%`,
			"--ap-blur": `${blurSize}px`
		};
		const trackListData = (0, react.useMemo)(() => ({
			queue,
			currentIndex,
			onPlay: s.playTrack,
			isPlaying
		}), [
			queue,
			currentIndex,
			s.playTrack,
			isPlaying
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualSlotsProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: rootRef,
			className: `ap-root${className ? ` ${className}` : ""}${pageVisible ? "" : " ap-root--hidden"}`,
			style: {
				...themeVars,
				...style
			},
			role: "region",
			"aria-label": "Audio player",
			onKeyDown: handleRootKeyDown,
			children: [
				isPlaylistMode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueDrawer, {
					queue,
					currentIndex,
					isPlaying,
					open: queueOpen,
					onClose: () => setQueueOpen(false),
					onPlayTrack: handleQueuePlayTrack,
					onReorder: s.moveQueueItem,
					onRemove: s.removeFromQueue
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SAPController, {
					open: controllerOpen,
					onClose: handleCloseController,
					route: controllerRoute,
					playback: {
						shuffle,
						onToggleShuffle: s.toggleShuffle,
						repeatMode,
						onCycleRepeat: s.cycleRepeat,
						...isPlaylistMode ? {
							automix,
							onToggleAutomix: s.toggleAutomix
						} : {},
						autoPlay: localAutoPlay,
						onToggleAutoPlay: handleAutoPlayToggle
					},
					queue: isPlaylistMode ? {
						count: queue.length,
						onOpenQueue: () => setQueueOpen(true)
					} : void 0,
					info: {
						title: currentTrack.title ?? "",
						artist: currentTrack.artist ?? "",
						duration,
						lyrics: currentTrack.lyrics
					},
					share: {
						onShare: handleShareClick,
						copied: shareCopied
					},
					pluginNames: externalPlugins.map((plugin) => plugin.name),
					waveform: hasWaveformPlugin ? {
						enabled: waveformEnabled,
						onToggle: () => setWaveformEnabled((v) => !v)
					} : void 0,
					accentColor,
					playIconColor,
					textColor,
					progressColor,
					trackColor,
					backgroundColor
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-sr-only",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					children: announcement
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackgroundMedia, {
					...resolveMedia({
						media: backgroundMedia,
						legacyImage: backgroundImage
					}),
					darkenAmount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-content",
					children: [
						!hasAudio && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-banner ap-banner--error ap-anim-in",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorIcon, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Audio file missing" })]
						}),
						autoplayBlocked && hasAudio && !hasError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-banner ap-banner--info ap-banner--col ap-anim-in",
							role: "status",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-banner__row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InfoIcon, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Autoplay blocked. Tap play to start audio." })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ap-retry-btn",
								onClick: () => {
									s.dismissAutoplayBlocked();
									s.toggle();
								},
								children: "Play"
							})]
						}),
						hasError && hasAudio && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-banner ap-banner--error ap-banner--col ap-anim-in",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-banner__row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorIcon, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: errorMessage })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ap-retry-btn",
								onClick: s.retry,
								children: "Retry"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ap-top-actions",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "ap-menu",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "ap-icon-btn ap-tap ap-menu__btn",
									onClick: handleOpenOptions,
									"aria-label": "Player options",
									"aria-haspopup": "dialog",
									"aria-expanded": controllerOpen,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DotsIcon, {})
								})
							})
						}),
						isPlaylistMode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-track-counter",
							children: [
								"Track ",
								currentIndex + 1,
								" of ",
								queue.length,
								shuffle ? " · Shuffle" : "",
								repeatMode !== "off" ? ` · Repeat ${repeatMode}` : "",
								automix ? " · Automix" : ""
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-track-info",
							role: "group",
							"aria-label": "Track information",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-track-info__title",
								style: titleFont,
								title: formatVersionedTitle(currentTrack.title, currentTrack.versionLabel),
								children: [formatVersionedTitle(currentTrack.title, currentTrack.versionLabel), currentTrack.explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "ap-track-info__artist",
								style: artistFont,
								title: formatSecondaryLine(currentTrack),
								children: formatSecondaryLine(currentTrack)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-progress-group",
							role: "group",
							"aria-label": "Playback progress",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrubberCanvasHost, {
								face: "portable",
								density: getScrubberDensity("portable"),
								currentTime,
								duration,
								progress: duration > 0 ? currentTime / duration : 0,
								onSeek: s.seek,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrubberCanvasRenderer, {
									currentTime,
									duration,
									onSeek: s.seek,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformAdapter, {
										face: "portable",
										density: getScrubberDensity("portable"),
										waveform: effectiveWaveform,
										currentTime,
										duration,
										buffered,
										disabled: !hasAudio,
										isSeeking,
										onSeek: s.seek,
										onSeekStart: () => s.setSeeking(true),
										onSeekEnd: () => s.setSeeking(false),
										peaks: currentTrack.peaks,
										peaksDuration: currentTrack.waveformDuration,
										getDecodedData: s.getDecodedData,
										url: s.getBackendInfo().active === "html5" ? currentSrc : void 0,
										sourceKey,
										height: waveformHeight,
										waveColor: trackColor,
										progressColor,
										cursorColor: accentColor
									})
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-times",
								"aria-hidden": "true",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatTime(currentTime) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatTime(duration) })]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-transport",
							role: "group",
							"aria-label": "Playback controls",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldSkipButton, {
									direction: "previous",
									className: "ap-btn ap-btn--ghost ap-tap",
									disabled: !hasAudio,
									skipDisabled: !isPlaylistMode || !canPreviousTrack,
									seekLabel: "Skip backward 10 seconds",
									skipLabel: "Previous track",
									onSeek: () => s.seekBy(-10),
									onSkip: s.previous,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrevIcon, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: `ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`,
									onClick: s.toggle,
									disabled: !hasAudio,
									"aria-label": !hasAudio ? "Audio file missing" : showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play",
									children: showPlaySpinner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon, {}) : isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldSkipButton, {
									direction: "next",
									className: "ap-btn ap-btn--ghost ap-tap",
									disabled: !hasAudio,
									skipDisabled: !isPlaylistMode || !canNextTrack,
									seekLabel: "Skip forward 10 seconds",
									skipLabel: "Next track",
									onSeek: () => s.seekBy(10),
									onSkip: s.next,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NextIcon, {})
								})
							]
						}),
						showVolume && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeControl, {
							volume,
							isMuted,
							disabled: !hasAudio,
							volumeUnsupported,
							onVolumeChange: s.setVolume,
							onToggleMute: s.toggleMute
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasHost, {
							open: surface.isCanvasOpen || surface.isQueueOpen,
							face: "portable",
							supported: surface.canvasSupported,
							activeSurfaceId: surface.mode === "default" ? void 0 : surface.mode,
							children: surface.isQueueOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueSurface, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasRenderer, {
								currentTime,
								duration,
								lyrics: currentTrack?.lyrics
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerSurfaceButtons, {
							surface,
							onOpenQueue: () => setQueueOpen(true),
							onOpenFocusedController: handleOpenFocusedController
						}),
						currentTrack.purchaseUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							className: "ap-wide-btn ap-wide-btn--solid ap-tap",
							href: currentTrack.purchaseUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeartIcon, {}), "Support Artist"]
						}),
						isPlaylistMode && showTracklist && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ap-tracklist ap-anim-in",
							role: "list",
							"aria-label": "Playlist tracks",
							style: { overflowY: "hidden" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FixedSizeList, {
								height: Math.min(276, queue.length * 52),
								itemCount: queue.length,
								itemSize: 52,
								width: "100%",
								itemData: trackListData,
								children: TrackRow
							})
						})
					]
				})
			]
		}) });
	}
	var ErrorIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "20",
		height: "20",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "10"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "8",
				x2: "12",
				y2: "12"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "16",
				x2: "12.01",
				y2: "16"
			})
		]
	});
	var InfoIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "20",
		height: "20",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "10"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "16",
				x2: "12",
				y2: "12"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: "12",
				y1: "8",
				x2: "12.01",
				y2: "8"
			})
		]
	});
	var PlayIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5v14l12-7z" })
	});
	var PauseIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "6",
			y: "4",
			width: "4",
			height: "16"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "14",
			y: "4",
			width: "4",
			height: "16"
		})]
	});
	var SpinnerIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		className: "ap-spin",
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
			cx: "12",
			cy: "12",
			r: "10",
			opacity: "0.25"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M12 2a10 10 0 0 1 10 10",
			strokeLinecap: "round"
		})]
	});
	var PrevIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "5",
			y: "4",
			width: "2.5",
			height: "16",
			rx: "0.5"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 5v14L9 12z" })]
	});
	var NextIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 5v14l11-7z" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: "16.5",
			y: "4",
			width: "2.5",
			height: "16",
			rx: "0.5"
		})]
	});
	var HeartIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" })
	});
	var DotsIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "18",
		height: "18",
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "5",
				cy: "12",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "1.8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "19",
				cy: "12",
				r: "1.8"
			})
		]
	});
	//#endregion
	//#region src/audio-player/automix/useAutomix.ts
	/**
	* Automix Lite: opt-in two-deck crossfade transitions between queued tracks.
	*
	* The hook deliberately does NOT touch the engine's internals. The engine's
	* single <audio> element ("deck A") stays the source of truth; this hook owns
	* one detached, never-rendered second element ("deck B") that only exists
	* around a transition. The lifecycle is:
	*
	*   idle ──(near end of A)──▶ preloading: deck B loads the next track and is
	*        parked at its silence-trimmed start; silence analysis runs.
	*   preloading ──(fade window)──▶ fading: deck B plays while an equal-power
	*        ramp swaps the audible balance from A to B over AUTOMIX_FADE_MS.
	*   fading ──(ramp done / A ended)──▶ handoff: the host advances its queue
	*        exactly like a normal end-of-track advance, the engine reloads the
	*        main element with B's URL (HTTP-cached — deck B just fetched it),
	*        the hook time-syncs the main element to deck B and, on its first
	*        'playing', flips the audio back to the main element and releases the
	*        deck. From here on, playback is indistinguishable from normal mode.
	*
	* Anything unexpected — pause, seek away, manual next/previous, queue edits,
	* deck errors, blocked play(), unsupported programmatic volume (iOS Safari) —
	* cancels the transition, restores the engine volume, and falls back to the
	* existing end-of-track behavior. With `enabled` false the hook is inert.
	*/
	/** Crossfade duration. Conservative fixed value for V1. */
	var AUTOMIX_FADE_MS = 5500;
	/** How far before the (trimmed) end of A deck B starts preloading. */
	var PRELOAD_LEAD_S = 15;
	/** Tracks shorter than this never automix. */
	var MIN_TRACK_S = 25;
	/** Backward currentTime jump beyond this cancels an active fade. */
	var SEEK_BACK_TOLERANCE_S = .75;
	/** Give up on a handoff if the main element never reaches 'playing'. */
	var HANDOFF_TIMEOUT_MS = 6e3;
	/** Re-sync the main element at flip time if it drifted past this. */
	var MAX_FLIP_DRIFT_S = .35;
	/**
	* Page-wide latch: once a browser proves it ignores programmatic element
	* volume (iOS Safari), crossfading is impossible. Automix then leaves
	* playback entirely to the normal end-of-track behavior.
	*/
	var fadeUnsupported = false;
	var warnedUseAutomixDeprecated = false;
	function warnUseAutomixDeprecated() {
		if (warnedUseAutomixDeprecated || typeof console === "undefined") return;
		warnedUseAutomixDeprecated = true;
		console.warn("[AudioPlayer] useAutomix is deprecated. Prefer registering AutomixPlugin through the plugin system.");
	}
	function useAutomix(options) {
		const { engine, enabled, sourceKey, currentTrack, nextTrack } = options;
		(0, react.useEffect)(() => {
			if (!options.suppressDeprecatedWarning) warnUseAutomixDeprecated();
		}, [options.suppressDeprecatedWarning]);
		const optionsRef = (0, react.useRef)(options);
		optionsRef.current = options;
		const volumeRef = (0, react.useRef)(engine.volume);
		volumeRef.current = engine.volume;
		const phaseRef = (0, react.useRef)("idle");
		const deckRef = (0, react.useRef)(null);
		const deckAbortRef = (0, react.useRef)(null);
		const preloadedKeyRef = (0, react.useRef)(null);
		const fadeIntervalRef = (0, react.useRef)(null);
		const fadeT0Ref = (0, react.useRef)(0);
		const fadeAnchorRef = (0, react.useRef)(0);
		const pendingHandoffRef = (0, react.useRef)(null);
		const handoffAbortRef = (0, react.useRef)(null);
		const handoffTimerRef = (0, react.useRef)(null);
		/** `${sourceKey}->${nextKey}` pairs that errored; never retried. */
		const failedPairRef = (0, react.useRef)(null);
		const prevSourceKeyRef = (0, react.useRef)(sourceKey);
		const [isTransitioning, setIsTransitioning] = (0, react.useState)(false);
		const stopRamp = (0, react.useCallback)(() => {
			if (fadeIntervalRef.current !== null) {
				clearInterval(fadeIntervalRef.current);
				fadeIntervalRef.current = null;
			}
		}, []);
		const releaseDeck = (0, react.useCallback)(() => {
			deckAbortRef.current?.abort();
			deckAbortRef.current = null;
			preloadedKeyRef.current = null;
			const deck = deckRef.current;
			deckRef.current = null;
			if (deck) try {
				deck.pause();
				deck.removeAttribute("src");
				deck.load();
			} catch {}
		}, []);
		const clearHandoff = (0, react.useCallback)(() => {
			pendingHandoffRef.current = null;
			handoffAbortRef.current?.abort();
			handoffAbortRef.current = null;
			if (handoffTimerRef.current !== null) {
				clearTimeout(handoffTimerRef.current);
				handoffTimerRef.current = null;
			}
		}, []);
		/** Abort any in-flight transition and restore normal playback audio. */
		const cancel = (0, react.useCallback)(() => {
			const wasAudible = phaseRef.current === "fading" || phaseRef.current === "handoff";
			stopRamp();
			clearHandoff();
			releaseDeck();
			phaseRef.current = "idle";
			setIsTransitioning(false);
			if (wasAudible) {
				const main = optionsRef.current.engine.audioRef.current;
				if (main) try {
					main.volume = volumeRef.current;
				} catch {}
			}
		}, [
			clearHandoff,
			releaseDeck,
			stopRamp
		]);
		/**
		* The fade is over (ramp completed, or A reached its natural end first).
		* Mark the upcoming source change as ours; optionally trigger it.
		*/
		const finalizeFade = (0, react.useCallback)((advance) => {
			stopRamp();
			pendingHandoffRef.current = preloadedKeyRef.current;
			phaseRef.current = "handoff";
			if (advance) optionsRef.current.requestAdvance();
		}, [stopRamp]);
		const handleTrackEnded = (0, react.useCallback)(() => {
			if (phaseRef.current === "fading") {
				finalizeFade(false);
				return false;
			}
			return phaseRef.current === "handoff";
		}, [finalizeFade]);
		/** Wire deck B for the resolved next track and park it at its trim start. */
		const startPreload = (0, react.useCallback)((next) => {
			if (typeof Audio === "undefined") return;
			const src = getPrimaryTrackSource(next);
			if (!src) return;
			const key = trackKey(next);
			const deck = new Audio();
			deck.preload = "auto";
			try {
				deck.volume = 0;
			} catch {}
			deck.src = src;
			const ac = new AbortController();
			const applyTrimStart = () => {
				const trims = getTrackTrims(next);
				if (!trims || trims.trimStartMs <= 0) return;
				if (deck.paused && deck.readyState >= 1) try {
					deck.currentTime = trims.trimStartMs / 1e3;
				} catch {}
			};
			deck.addEventListener("loadedmetadata", applyTrimStart, { signal: ac.signal });
			deck.addEventListener("error", () => {
				failedPairRef.current = `${optionsRef.current.sourceKey}->${key}`;
				if (phaseRef.current === "fading" || phaseRef.current === "handoff") cancel();
				else if (phaseRef.current === "preloading") {
					releaseDeck();
					phaseRef.current = "idle";
				}
			}, { signal: ac.signal });
			try {
				deck.load();
			} catch {
				return;
			}
			deckAbortRef.current = ac;
			deckRef.current = deck;
			preloadedKeyRef.current = key;
			phaseRef.current = "preloading";
			ensureTrackAnalysis(next).then(applyTrimStart);
		}, [cancel, releaseDeck]);
		/**
		* Equal-power ramp driven by wall-clock setInterval (keeps progressing in
		* throttled background tabs, unlike rAF). Re-reads the user volume every
		* tick so a mid-fade volume change re-targets instead of fighting.
		*/
		const runRamp = (0, react.useCallback)(() => {
			const tick = () => {
				if (phaseRef.current !== "fading") {
					stopRamp();
					return;
				}
				const main = optionsRef.current.engine.audioRef.current;
				const deck = deckRef.current;
				if (!main || !deck) {
					cancel();
					return;
				}
				const t = Math.min(1, (performance.now() - fadeT0Ref.current) / AUTOMIX_FADE_MS);
				const vol = volumeRef.current;
				const mainTarget = Math.cos(t * Math.PI / 2) * vol;
				const deckTarget = Math.sin(t * Math.PI / 2) * vol;
				try {
					main.volume = mainTarget;
					deck.volume = deckTarget;
				} catch {
					fadeUnsupported = true;
					cancel();
					return;
				}
				if (vol > .1 && Math.abs(main.volume - mainTarget) > .05) {
					fadeUnsupported = true;
					cancel();
					return;
				}
				if (t >= 1) {
					stopRamp();
					finalizeFade(true);
				}
			};
			stopRamp();
			fadeIntervalRef.current = setInterval(tick, 33);
		}, [
			cancel,
			finalizeFade,
			stopRamp
		]);
		const startFade = (0, react.useCallback)(() => {
			const opts = optionsRef.current;
			const main = opts.engine.audioRef.current;
			const deck = deckRef.current;
			if (!main || !deck) return;
			if (fadeUnsupported || opts.engine.volumeUnsupported) return;
			if (deck.readyState < 2) return;
			try {
				deck.volume = 0;
				if (deck.volume > .001) {
					fadeUnsupported = true;
					return;
				}
				deck.muted = main.muted;
			} catch {
				fadeUnsupported = true;
				return;
			}
			let playPromise;
			try {
				playPromise = deck.play();
			} catch {
				failedPairRef.current = `${opts.sourceKey}->${preloadedKeyRef.current}`;
				releaseDeck();
				phaseRef.current = "idle";
				return;
			}
			phaseRef.current = "fading";
			setIsTransitioning(true);
			fadeT0Ref.current = performance.now();
			fadeAnchorRef.current = opts.engine.currentTime;
			playPromise.then(() => {
				if (phaseRef.current === "fading") runRamp();
			}).catch(() => {
				if (phaseRef.current === "fading") {
					failedPairRef.current = `${optionsRef.current.sourceKey}->${preloadedKeyRef.current}`;
					cancel();
				}
			});
		}, [
			cancel,
			releaseDeck,
			runRamp
		]);
		/**
		* After our requestAdvance, the host swaps sources and the engine reloads
		* the main element with B's URL. Sync it to deck B's position and flip the
		* audible output back to the main element on its first 'playing'.
		*/
		const attachHandoff = (0, react.useCallback)(() => {
			pendingHandoffRef.current = null;
			const main = optionsRef.current.engine.audioRef.current;
			const deck = deckRef.current;
			if (!main || !deck) {
				cancel();
				return;
			}
			const ac = new AbortController();
			handoffAbortRef.current = ac;
			const syncTime = () => {
				try {
					main.currentTime = deck.currentTime;
				} catch {}
			};
			if (main.readyState >= 1) syncTime();
			else main.addEventListener("loadedmetadata", syncTime, {
				signal: ac.signal,
				once: true
			});
			main.addEventListener("playing", () => {
				try {
					if (Math.abs(deck.currentTime - main.currentTime) > MAX_FLIP_DRIFT_S) syncTime();
					main.volume = volumeRef.current;
				} catch {}
				clearHandoff();
				releaseDeck();
				phaseRef.current = "idle";
				setIsTransitioning(false);
			}, {
				signal: ac.signal,
				once: true
			});
			main.addEventListener("error", cancel, {
				signal: ac.signal,
				once: true
			});
			handoffTimerRef.current = setTimeout(cancel, HANDOFF_TIMEOUT_MS);
		}, [
			cancel,
			clearHandoff,
			releaseDeck
		]);
		(0, react.useEffect)(() => {
			if (prevSourceKeyRef.current === sourceKey) return;
			prevSourceKeyRef.current = sourceKey;
			const expected = pendingHandoffRef.current;
			const current = optionsRef.current.currentTrack;
			if (expected !== null && phaseRef.current === "handoff" && current && trackKey(current) === expected) {
				attachHandoff();
				return;
			}
			if (phaseRef.current !== "idle") cancel();
		}, [
			sourceKey,
			attachHandoff,
			cancel
		]);
		(0, react.useEffect)(() => {
			if (enabled && currentTrack) ensureTrackAnalysis(currentTrack);
		}, [enabled, currentTrack]);
		(0, react.useEffect)(() => {
			if (!enabled && phaseRef.current !== "idle") cancel();
		}, [enabled, cancel]);
		(0, react.useEffect)(() => {
			if (!enabled) return;
			const phase = phaseRef.current;
			const { isPlaying, isSeeking, duration, currentTime, hasError } = engine;
			if (phase === "fading") {
				if (!isPlaying || isSeeking || hasError) {
					cancel();
					return;
				}
				if (currentTime < fadeAnchorRef.current - SEEK_BACK_TOLERANCE_S) {
					cancel();
					return;
				}
				if (!nextTrack || trackKey(nextTrack) !== preloadedKeyRef.current) {
					cancel();
					return;
				}
				return;
			}
			if (phase === "handoff") return;
			if (!currentTrack || !nextTrack) {
				if (phase === "preloading") {
					releaseDeck();
					phaseRef.current = "idle";
				}
				return;
			}
			if (!isPlaying || isSeeking || hasError) return;
			if (duration < MIN_TRACK_S) return;
			if (!engine.audioRef.current) return;
			const nextKey = trackKey(nextTrack);
			if (failedPairRef.current === `${sourceKey}->${nextKey}`) return;
			const trims = getTrackTrims(currentTrack);
			const effectiveEnd = duration - (trims ? trims.trimEndMs / 1e3 : 0);
			const fadeStartAt = Math.max(effectiveEnd - AUTOMIX_FADE_MS / 1e3, duration * .5);
			if (phase === "idle") {
				if (currentTime >= effectiveEnd - PRELOAD_LEAD_S) startPreload(nextTrack);
				return;
			}
			if (preloadedKeyRef.current !== nextKey) {
				releaseDeck();
				phaseRef.current = "idle";
				return;
			}
			if (currentTime >= fadeStartAt) startFade();
		}, [
			enabled,
			engine,
			sourceKey,
			currentTrack,
			nextTrack,
			cancel,
			releaseDeck,
			startFade,
			startPreload
		]);
		(0, react.useEffect)(() => () => cancel(), [cancel]);
		return {
			isTransitioning,
			handleTrackEnded
		};
	}
	//#endregion
	//#region src/audio-player/utils/colorExtraction.ts
	/** Convert an RGB triple to a CSS `rgb(...)` string. */
	function rgbToCss([r, g, b]) {
		return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
	}
	/**
	* Relative luminance per WCAG 2.x (0 = black, 1 = white). Used to decide
	* adaptive text color and whether a swatch reads as "dark".
	*/
	function relativeLuminance([r, g, b]) {
		const channel = (v) => {
			const s = v / 255;
			return s <= .03928 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
		};
		return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
	}
	/** Pick black or white text for best contrast against a background color. */
	function contrastText(bg) {
		return relativeLuminance(bg) > .4 ? "#000000" : "#FFFFFF";
	}
	/** Build a 135° linear gradient between two colors. */
	function gradient(a, b) {
		return `linear-gradient(135deg, ${rgbToCss(a)} 0%, ${rgbToCss(b)} 100%)`;
	}
	/**
	* Extract a palette from an image URL.
	*
	* Resolves `null` (never rejects) when the image cannot be loaded or its pixels
	* cannot be read (e.g. a cross-origin host without permissive CORS headers).
	*/
	function extractPalette(src, options = {}) {
		const sampleSize = options.sampleSize ?? 48;
		const quantStep = options.quantStep ?? 24;
		return new Promise((resolve) => {
			if (!src || typeof document === "undefined") {
				resolve(null);
				return;
			}
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.decoding = "async";
			img.onload = () => {
				try {
					const canvas = document.createElement("canvas");
					canvas.width = sampleSize;
					canvas.height = sampleSize;
					const ctx = canvas.getContext("2d", { willReadFrequently: true });
					if (!ctx) {
						resolve(null);
						return;
					}
					ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
					const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
					resolve(quantizePixels(data, quantStep));
				} catch {
					resolve(null);
				}
			};
			img.onerror = () => resolve(null);
			img.src = src;
		});
	}
	/**
	* Bucket pixels into coarse color bins and pick the two most prominent vivid
	* colors. Exported for unit testing against a hand-built pixel array.
	*/
	function quantizePixels(data, quantStep = 24) {
		const buckets = /* @__PURE__ */ new Map();
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			if (data[i + 3] < 125) continue;
			const max = Math.max(r, g, b);
			if ((max === 0 ? 0 : (max - Math.min(r, g, b)) / max) < .12 && (max < 40 || max > 225)) continue;
			const key = Math.round(r / quantStep) << 16 | Math.round(g / quantStep) << 8 | Math.round(b / quantStep);
			const bucket = buckets.get(key);
			if (bucket) {
				bucket.count++;
				bucket.sum[0] += r;
				bucket.sum[1] += g;
				bucket.sum[2] += b;
			} else buckets.set(key, {
				count: 1,
				sum: [
					r,
					g,
					b
				]
			});
		}
		if (buckets.size === 0) return null;
		const ranked = [...buckets.values()].sort((a, b) => b.count - a.count).map((bucket) => avg(bucket.sum, bucket.count));
		const primary = ranked[0];
		return {
			primary,
			secondary: pickDistinct(primary, ranked) ?? primary,
			accent: primary,
			isDark: relativeLuminance(primary) < .4
		};
	}
	function avg(sum, count) {
		return [
			sum[0] / count,
			sum[1] / count,
			sum[2] / count
		];
	}
	/** First ranked color far enough from `base` in RGB space to read as distinct. */
	function pickDistinct(base, ranked) {
		const threshold = 60;
		for (const color of ranked) if (Math.sqrt((color[0] - base[0]) ** 2 + (color[1] - base[1]) ** 2 + (color[2] - base[2]) ** 2) > threshold) return color;
		return null;
	}
	//#endregion
	//#region src/audio-player/plugins/AutoThemePlugin.ts
	/** CSS custom properties this plugin writes onto the player root. */
	var MANAGED_VARS = [
		"--ap-accent",
		"--ap-progress",
		"--ap-bg",
		"--ap-text",
		"--ap-glow"
	];
	/**
	* Auto Theme: derive the player's palette from the current album art.
	*
	* While active, this plugin reads the artwork rendered behind the player
	* (`.ap-bg-image`, falling back to Media Session artwork), extracts its dominant
	* colors via the Canvas API, and writes `--ap-*` CSS variables onto the player
	* root — accent, a gradient progress fill, a tinted background, contrast-correct
	* text, and an ambient glow. Removing the plugin restores the manual theme: the
	* managed vars are cleared on `destroy`, so the root's original inline values
	* take over again.
	*/
	var AutoThemePlugin = class {
		name;
		applyGlow;
		applyGradient;
		extractOptions;
		onPaletteChange;
		context = null;
		currentSrc = null;
		generation = 0;
		constructor(config = {}) {
			const valid = validateConfig(AutoThemePluginConfigSchema, config, "auto-theme");
			this.name = valid.name;
			this.applyGlow = valid.applyGlow;
			this.applyGradient = valid.applyGradient;
			this.extractOptions = {
				sampleSize: valid.sampleSize,
				quantStep: valid.quantStep
			};
			this.onPaletteChange = valid.onPaletteChange;
		}
		init(playerInstance) {
			this.context = playerInstance;
			this.refresh(playerInstance.getCurrentTrack());
		}
		destroy() {
			this.generation++;
			this.clearVars();
			this.currentSrc = null;
			this.context = null;
		}
		onTrackLoad = (track) => {
			this.refresh(track);
		};
		async refresh(track) {
			const root = this.context?.getRootElement();
			if (!root) return;
			const src = this.resolveArtworkSrc(root);
			if (src === this.currentSrc) return;
			this.currentSrc = src;
			const token = ++this.generation;
			if (!src) {
				this.clearVars();
				this.onPaletteChange?.(null, track);
				return;
			}
			const palette = await extractPalette(src, this.extractOptions);
			if (token !== this.generation) return;
			if (!palette) {
				this.clearVars();
				this.onPaletteChange?.(null, track);
				return;
			}
			this.applyPalette(root, palette);
			this.onPaletteChange?.(palette, track);
		}
		/** Read the artwork URL from the rendered backdrop, else Media Session. */
		resolveArtworkSrc(root) {
			const bg = root.querySelector(".ap-bg-image");
			const fromBackdrop = bg ? parseCssUrl(bg.style.backgroundImage) : null;
			if (fromBackdrop) return fromBackdrop;
			if (typeof navigator !== "undefined" && navigator.mediaSession) {
				const artwork = navigator.mediaSession.metadata?.artwork;
				if (artwork && artwork.length > 0) return artwork[0].src;
			}
			return null;
		}
		applyPalette(root, palette) {
			const { primary, secondary, accent, isDark } = palette;
			const surface = isDark ? primary : secondary;
			root.style.setProperty("--ap-accent", rgbToCss(accent));
			root.style.setProperty("--ap-progress", this.applyGradient ? gradient(primary, secondary) : rgbToCss(accent));
			root.style.setProperty("--ap-bg", rgbaTint(surface, .55));
			root.style.setProperty("--ap-text", contrastText(surface));
			if (this.applyGlow) root.style.setProperty("--ap-glow", rgbaTint(accent, .45));
		}
		clearVars() {
			const root = this.context?.getRootElement();
			if (!root) return;
			for (const name of MANAGED_VARS) root.style.removeProperty(name);
		}
	};
	/** Pull the URL out of a CSS `url("...")` value, if present. */
	function parseCssUrl(value) {
		return /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(value)?.[2] || null;
	}
	function rgbaTint([r, g, b], alpha) {
		return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
	}
	function createAutoThemePlugin(config) {
		return new AutoThemePlugin(config);
	}
	//#endregion
	//#region src/audio-player/plugins/KeyboardShortcutPlugin.ts
	/** Space/arrow keyboard controls implemented as a swappable plugin. */
	var KeyboardShortcutPlugin = class {
		name;
		handlesKeyboardShortcuts = true;
		scope;
		seekSeconds;
		enableJKL;
		enablePlaylistKeys;
		target = null;
		context = null;
		constructor(config = {}) {
			const valid = validateConfig(KeyboardShortcutPluginConfigSchema, config, "keyboard-shortcuts");
			this.name = valid.name;
			this.scope = valid.scope;
			this.seekSeconds = valid.seekSeconds;
			this.enableJKL = valid.enableJKL;
			this.enablePlaylistKeys = valid.enablePlaylistKeys;
		}
		init(playerInstance) {
			this.context = playerInstance;
			this.target = this.scope === "document" ? typeof document === "undefined" ? null : document : playerInstance.getRootElement();
			this.target?.addEventListener("keydown", this.handleKeyDown);
		}
		destroy() {
			this.target?.removeEventListener("keydown", this.handleKeyDown);
			this.target = null;
			this.context = null;
		}
		handleKeyDown = (nativeEvent) => {
			const event = nativeEvent;
			if (!this.context || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
			if (!!event.target?.closest("button, a, input, textarea, select, [role='slider'], [contenteditable='true']")) return;
			const engine = this.context.getEngine();
			const key = event.key.toLowerCase();
			let handled = true;
			if (event.key === " " || event.key === "Spacebar" || this.enableJKL && key === "k") engine.toggle();
			else if (event.key === "ArrowLeft" || this.enableJKL && key === "j") engine.seekBy(-this.seekSeconds);
			else if (event.key === "ArrowRight" || this.enableJKL && key === "l") engine.seekBy(this.seekSeconds);
			else if (this.enablePlaylistKeys && key === "n" && this.context.next) this.context.next();
			else if (this.enablePlaylistKeys && key === "p" && this.context.previous) this.context.previous();
			else handled = false;
			if (handled) event.preventDefault();
		};
	};
	function createKeyboardShortcutPlugin(config) {
		return new KeyboardShortcutPlugin(config);
	}
	//#endregion
	//#region src/audio-player/plugins/AnalyticsPlugin.ts
	/** Small analytics adapter. Provide `send` or `endpoint` to emit events. */
	var AnalyticsPlugin = class {
		name;
		endpoint;
		sendCallback;
		includeTimeUpdates;
		timeUpdateIntervalSeconds;
		context = null;
		lastTimeUpdateBucket = -1;
		constructor(config = {}) {
			const valid = validateConfig(AnalyticsPluginConfigSchema, config, "analytics");
			this.name = valid.name;
			this.endpoint = valid.endpoint;
			this.sendCallback = valid.send;
			this.includeTimeUpdates = valid.includeTimeUpdates;
			this.timeUpdateIntervalSeconds = valid.timeUpdateIntervalSeconds;
		}
		init(playerInstance) {
			this.context = playerInstance;
		}
		destroy() {
			this.context = null;
			this.lastTimeUpdateBucket = -1;
		}
		onTrackLoad = (_track) => {
			this.lastTimeUpdateBucket = -1;
			this.emit("track_load");
		};
		onPlay = () => this.emit("play");
		onPause = () => this.emit("pause");
		onStop = () => this.emit("stop");
		onSeek = (position) => this.emit("seek", position);
		onTrackEnded = () => {
			this.emit("track_ended");
		};
		onTimeUpdate = (position) => {
			if (!this.includeTimeUpdates) return;
			const bucket = Math.floor(position / this.timeUpdateIntervalSeconds);
			if (bucket === this.lastTimeUpdateBucket) return;
			this.lastTimeUpdateBucket = bucket;
			this.emit("time_update", position);
		};
		emit(type, overridePosition) {
			if (!this.context || !this.sendCallback && !this.endpoint) return;
			const engine = this.context.getEngine();
			const event = {
				type,
				track: this.context.getCurrentTrack(),
				sourceKey: this.context.getSourceKey(),
				position: overridePosition ?? engine.currentTime,
				duration: engine.duration,
				timestamp: Date.now(),
				plugin: this.name
			};
			if (this.sendCallback) {
				this.sendCallback(event);
				return;
			}
			if (!this.endpoint || typeof window === "undefined") return;
			const body = JSON.stringify(event);
			if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
				const blob = new Blob([body], { type: "application/json" });
				if (navigator.sendBeacon(this.endpoint, blob)) return;
			}
			fetch(this.endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
				keepalive: true
			}).catch(() => {});
		}
	};
	function createAnalyticsPlugin(config) {
		return new AnalyticsPlugin(config);
	}
	//#endregion
	//#region src/audio-player/plugins/LyricsPlugin.ts
	/** Syncs LRC-style lyrics with playback and optionally writes the active line to a DOM node. */
	var LyricsPlugin = class {
		name;
		configuredLyrics;
		configuredLines;
		onLineChangeCallback;
		target;
		context = null;
		lines = [];
		activeIndex = -1;
		constructor(config = {}) {
			const valid = validateConfig(LyricsPluginConfigSchema, config, "lyrics");
			this.name = valid.name;
			this.configuredLyrics = valid.lyrics;
			this.configuredLines = valid.lines;
			this.onLineChangeCallback = valid.onLineChange;
			this.target = valid.target;
		}
		init(playerInstance) {
			this.context = playerInstance;
			this.loadLyrics(playerInstance.getCurrentTrack());
		}
		destroy() {
			this.context = null;
			this.lines = [];
			this.activeIndex = -1;
			this.writeTarget("");
		}
		onTrackLoad = (track) => {
			this.loadLyrics(track);
		};
		onTimeUpdate = (position) => {
			if (!this.context || this.lines.length === 0) return;
			const engine = this.context.getEngine();
			const index = this.lines.some((line) => line.time > 0) ? this.findTimedLine(position) : this.findApproximateLine(position, engine.duration);
			if (index === this.activeIndex) return;
			this.activeIndex = index;
			const line = index >= 0 ? this.lines[index] : null;
			this.writeTarget(line?.text ?? "");
			this.onLineChangeCallback?.(line, index, this.context.getCurrentTrack());
		};
		loadLyrics(track) {
			const source = this.configuredLines ? this.configuredLines : parseLyrics(this.configuredLyrics ?? track?.lyrics ?? "");
			this.lines = source;
			this.activeIndex = -1;
			this.writeTarget("");
		}
		findTimedLine(position) {
			let active = -1;
			for (let i = 0; i < this.lines.length; i++) if (this.lines[i].time <= position) active = i;
			else break;
			return active;
		}
		findApproximateLine(position, duration) {
			if (duration <= 0) return -1;
			const ratio = Math.max(0, Math.min(.999, position / duration));
			return Math.floor(ratio * this.lines.length);
		}
		writeTarget(text) {
			const target = typeof this.target === "function" ? this.target() : this.target ?? null;
			if (target) target.textContent = text;
		}
	};
	function parseLyrics(lyrics) {
		const lines = lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
		const parsed = [];
		const lrcPattern = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
		for (const line of lines) {
			const match = line.match(lrcPattern);
			if (!match) {
				parsed.push({
					time: 0,
					text: line
				});
				continue;
			}
			const minutes = Number(match[1]);
			const seconds = Number(match[2]);
			const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
			parsed.push({
				time: minutes * 60 + seconds + fraction,
				text: match[4]
			});
		}
		return parsed.sort((a, b) => a.time - b.time);
	}
	function createLyricsPlugin(config) {
		return new LyricsPlugin(config);
	}
	//#endregion
	//#region src/audio-player/plugins/SleepTimerPlugin.ts
	var PRESET_DURATIONS_MS = {
		"15m": 900 * 1e3,
		"30m": 1800 * 1e3,
		"45m": 2700 * 1e3,
		"60m": 3600 * 1e3
	};
	var OPTIONS = [
		{
			value: "off",
			label: "Sleep timer"
		},
		{
			value: "15m",
			label: "15 min"
		},
		{
			value: "30m",
			label: "30 min"
		},
		{
			value: "45m",
			label: "45 min"
		},
		{
			value: "60m",
			label: "1 hr"
		},
		{
			value: "track-end",
			label: "Until end of track"
		}
	];
	/** Adds a scoped sleep-timer dropdown and pauses playback when the timer expires. */
	var SleepTimerPlugin = class {
		name;
		label;
		renderUi;
		target;
		now;
		context = null;
		preset = "off";
		deadlineMs = null;
		timeoutId = null;
		container = null;
		select = null;
		constructor(config = {}) {
			const valid = validateConfig(SleepTimerPluginConfigSchema, config, "sleep-timer");
			this.name = valid.name;
			this.label = valid.label;
			this.renderUi = valid.renderUi;
			this.target = valid.target;
			this.now = valid.now ?? (() => Date.now());
		}
		init(playerInstance) {
			this.context = playerInstance;
			this.mountUi();
		}
		destroy() {
			this.clearCountdown();
			this.unmountUi();
			this.context = null;
			this.preset = "off";
			this.deadlineMs = null;
		}
		setTimer(preset) {
			this.clearCountdown();
			this.preset = preset;
			this.deadlineMs = null;
			const durationMs = PRESET_DURATIONS_MS[preset];
			if (durationMs !== void 0) {
				this.deadlineMs = this.now() + durationMs;
				this.timeoutId = setTimeout(this.expire, durationMs);
			}
			this.syncSelect();
		}
		getActiveTimer() {
			const remainingMs = this.deadlineMs === null ? null : Math.max(0, this.deadlineMs - this.now());
			return {
				preset: this.preset,
				deadlineMs: this.deadlineMs,
				remainingMs
			};
		}
		onTrackEnded = (_track) => {
			if (this.preset !== "track-end") return;
			this.pauseAndReset();
			return true;
		};
		expire = () => {
			if (this.deadlineMs !== null && this.now() < this.deadlineMs) {
				this.timeoutId = setTimeout(this.expire, this.deadlineMs - this.now());
				return;
			}
			this.pauseAndReset();
		};
		pauseAndReset() {
			this.context?.getEngine().pause();
			this.clearCountdown();
			this.preset = "off";
			this.deadlineMs = null;
			this.syncSelect();
		}
		clearCountdown() {
			if (this.timeoutId === null) return;
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		mountUi() {
			if (!this.renderUi || typeof document === "undefined") return;
			const target = this.resolveTarget();
			if (!target) return;
			const container = document.createElement("label");
			container.className = "sap-sleep-timer";
			const label = document.createElement("span");
			label.className = "sap-sleep-timer__label";
			label.textContent = this.label;
			const select = document.createElement("select");
			select.className = "sap-sleep-timer__select";
			select.setAttribute("aria-label", "Sleep timer");
			for (const optionConfig of OPTIONS) {
				const option = document.createElement("option");
				option.value = optionConfig.value;
				option.textContent = optionConfig.label;
				select.appendChild(option);
			}
			select.addEventListener("change", this.handleSelectChange);
			container.append(label, select);
			target.appendChild(container);
			this.container = container;
			this.select = select;
			this.syncSelect();
		}
		unmountUi() {
			this.select?.removeEventListener("change", this.handleSelectChange);
			this.container?.remove();
			this.container = null;
			this.select = null;
		}
		resolveTarget() {
			if (typeof this.target === "function") return this.target();
			return this.target ?? this.context?.getRootElement() ?? null;
		}
		syncSelect() {
			if (this.select) this.select.value = this.preset;
		}
		handleSelectChange = (event) => {
			const select = event.currentTarget;
			this.setTimer(select?.value ?? "off");
		};
	};
	function createSleepTimerPlugin(config) {
		return new SleepTimerPlugin(config);
	}
	//#endregion
	//#region src/audio-player/plugins/WaveformPlugin.ts
	/**
	* Waveform: a marker plugin that switches a standalone player's scrubber from
	* the plain progress bar to the interactive wavesurfer waveform.
	*
	* It owns no playback behavior — it sets `providesWaveform`, which the
	* `AudioPlayer` detects to render the waveform (gated by the player's "Show
	* Waveform" toggle). Its only side effect is an optional best-effort peaks
	* pre-warm via `computePeaksFromUrl`, so removing it cannot disturb playback.
	*/
	var WaveformPlugin = class {
		name;
		providesWaveform = true;
		prewarmPeaks;
		prewarmed = null;
		constructor(config = {}) {
			const valid = validateConfig(WaveformPluginConfigSchema, config, "waveform");
			this.name = valid.name;
			this.prewarmPeaks = valid.prewarmPeaks;
		}
		init(playerInstance) {
			this.warm(playerInstance.getCurrentTrack());
		}
		destroy() {
			this.prewarmed = null;
		}
		onTrackLoad(track) {
			this.warm(track);
		}
		/** Best-effort peaks pre-warm; never throws into the host. */
		warm(track) {
			if (!this.prewarmPeaks) return;
			const url = getPrimaryTrackSource(track);
			if (!url || track?.peaks || this.prewarmed === url) return;
			this.prewarmed = url;
			computePeaksFromUrl(url).catch(() => {});
		}
	};
	/** Factory mirroring the other registry plugins (fresh instance per install). */
	function createWaveformPlugin(config = {}) {
		return new WaveformPlugin(config);
	}
	//#endregion
	//#region src/audio-player/cues/cueRuntime.ts
	var CueRuntime = class {
		context;
		firedCueIds = /* @__PURE__ */ new Set();
		timeCues;
		cueMap = /* @__PURE__ */ new Map();
		triggerMap = /* @__PURE__ */ new Map();
		lastTime = 0;
		activeSprites = /* @__PURE__ */ new Map();
		constructor(context, manifest) {
			this.context = context;
			this.timeCues = manifest.cues.filter((c) => c.trigger.kind === "time").sort((a, b) => {
				return (a.trigger.kind === "time" ? a.trigger.at : 0) - (b.trigger.kind === "time" ? b.trigger.at : 0);
			});
			for (const cue of manifest.cues) {
				if (cue.id) this.cueMap.set(cue.id, cue);
				if (cue.trigger.kind !== "time") {
					const triggerKey = `${cue.trigger.kind}:${cue.trigger.value}`;
					if (!this.triggerMap.has(triggerKey)) this.triggerMap.set(triggerKey, []);
					this.triggerMap.get(triggerKey).push(cue);
				}
			}
			if (manifest.assets?.spritePacks && this.context.sounds) {
				const packToLoad = manifest.assets.spritePacks["default"] || Object.values(manifest.assets.spritePacks)[0];
				if (packToLoad) this.context.sounds.loadSpritePack(packToLoad).catch((e) => {
					console.warn("SAP Cues: Failed to load sprite pack", e);
				});
			}
		}
		reset() {
			this.firedCueIds.clear();
			this.lastTime = 0;
			if (this.context.sounds) for (const ids of this.activeSprites.values()) for (const id of ids) this.context.sounds.stopSprite(id);
			this.activeSprites.clear();
		}
		handleTimeUpdate(currentTime, isSeeking = false) {
			for (const cue of this.timeCues) {
				if (cue.trigger.kind !== "time") continue;
				const hasFired = this.firedCueIds.has(cue.id);
				const triggerTime = cue.trigger.at;
				if (isSeeking && currentTime < triggerTime) {
					if (cue.replayable) this.firedCueIds.delete(cue.id);
					continue;
				}
				if (!hasFired && currentTime >= triggerTime) {
					if (isSeeking && !cue.fireOnSeek) {
						this.firedCueIds.add(cue.id);
						continue;
					}
					if (isSeeking || this.lastTime <= triggerTime && currentTime >= triggerTime) {
						this.firedCueIds.add(cue.id);
						this.executeActions(cue.actions);
					}
				}
			}
			this.lastTime = currentTime;
		}
		/** Manually execute a cue by its ID, ignoring time checks. */
		executeCueById(id) {
			const cue = this.cueMap.get(id);
			if (cue) this.executeActions(cue.actions);
		}
		/** Execute any cues matching the given trigger kind and value. */
		executeCueByTrigger(kind, value) {
			const triggerKey = `${kind}:${value}`;
			const cues = this.triggerMap.get(triggerKey);
			if (cues) for (const cue of cues) this.executeActions(cue.actions);
		}
		executeActions(actions) {
			for (const action of actions) try {
				switch (action.command) {
					case "sprite.play":
						if (this.context.sounds) {
							const id = this.context.sounds.playSprite(action.clip, {
								loop: action.loop,
								volume: action.volume
							});
							if (id) {
								const key = `${action.pack || "default"}:${action.clip}`;
								if (!this.activeSprites.has(key)) this.activeSprites.set(key, []);
								this.activeSprites.get(key).push(id);
							}
						}
						break;
					case "sprite.stop":
						if (this.context.sounds) if (action.clip) {
							const key = `${action.pack || "default"}:${action.clip}`;
							const ids = this.activeSprites.get(key);
							if (ids) {
								for (const id of ids) this.context.sounds.stopSprite(id);
								this.activeSprites.delete(key);
							}
						} else {
							for (const ids of this.activeSprites.values()) for (const id of ids) this.context.sounds.stopSprite(id);
							this.activeSprites.clear();
						}
						break;
					case "sprite.fade":
						if (this.context.sounds) {
							const key = `${action.pack || "default"}:${action.clip}`;
							const ids = this.activeSprites.get(key);
							if (ids) for (const id of ids) this.context.sounds.fadeSprite(id, action.volume, action.durationMs);
						}
						break;
					case "player.seek":
						this.context.getEngine().seek(action.time);
						break;
					case "player.pause":
						this.context.getEngine().pause();
						break;
					case "event.emit":
						(this.context.getRootElement() || window).dispatchEvent(new CustomEvent(action.eventName, {
							detail: action.detail,
							bubbles: true
						}));
						break;
					case "ambience.crossfade":
					case "duck.set":
					case "volume.fadeNarration":
					case "layer.set":
					case "spatial.pan":
						(this.context.getRootElement() || window).dispatchEvent(new CustomEvent("sap-narrative-cue", {
							detail: action,
							bubbles: true
						}));
						break;
				}
			} catch (e) {
				console.error("SAP Cues: Failed to execute cue action", action, e);
			}
		}
	};
	var cueTriggerSchema = union([object({
		kind: literal("time"),
		at: number()
	}), object({
		kind: _enum([
			"scene",
			"paragraph",
			"chapter",
			"metadata",
			"tension",
			"powerShift",
			"emotion",
			"relationshipShift",
			"danger",
			"element",
			"signature",
			"intensity"
		]),
		value: union([string(), number()])
	})]);
	var cueActionSchema = discriminatedUnion("command", [
		object({
			command: literal("sprite.play"),
			pack: string(),
			clip: string(),
			loop: boolean().optional(),
			fadeInMs: number().optional(),
			volume: number().optional()
		}),
		object({
			command: literal("sprite.stop"),
			pack: string().optional(),
			clip: string().optional(),
			fadeOutMs: number().optional()
		}),
		object({
			command: literal("sprite.fade"),
			pack: string(),
			clip: string(),
			volume: number(),
			durationMs: number()
		}),
		object({
			command: literal("ambience.crossfade"),
			profile: string(),
			durationMs: number().optional()
		}),
		object({
			command: literal("duck.set"),
			amount: number()
		}),
		object({
			command: literal("volume.fadeNarration"),
			volume: number(),
			durationMs: number()
		}),
		object({
			command: literal("player.seek"),
			time: number()
		}),
		object({ command: literal("player.pause") }),
		object({
			command: literal("event.emit"),
			eventName: string(),
			detail: unknown().optional()
		}),
		object({
			command: literal("layer.set"),
			layer: string(),
			state: union([string(), number()])
		}),
		object({
			command: literal("spatial.pan"),
			pack: string().optional(),
			clip: string().optional(),
			x: number(),
			y: number(),
			z: number(),
			durationMs: number().optional()
		})
	]);
	var cueEventSchema = object({
		id: string().optional().transform((val) => val || `cue-${Math.random().toString(36).slice(2, 9)}`),
		trigger: cueTriggerSchema,
		actions: array(any().transform((val) => {
			const parsed = cueActionSchema.safeParse(val);
			if (!parsed.success) {
				console.warn("SAP Cues: Ignoring invalid action:", parsed.error);
				return null;
			}
			return parsed.data;
		})).transform((actions) => actions.filter((a) => a !== null)),
		replayable: boolean().optional(),
		fireOnSeek: boolean().optional()
	});
	var audioSpriteClipSchema = object({
		offset: number(),
		duration: number(),
		volume: number().optional(),
		loop: boolean().optional()
	});
	var audioSpriteManifestSchema = object({
		src: string(),
		clips: record(string(), audioSpriteClipSchema)
	});
	var cueManifestSchema = object({
		version: literal("sap-cues/1"),
		id: string().optional(),
		metadata: record(string(), unknown()).optional(),
		assets: object({ spritePacks: record(string(), audioSpriteManifestSchema).optional() }).optional(),
		cues: array(any().transform((val, _ctx) => {
			const parsed = cueEventSchema.safeParse(val);
			if (!parsed.success) {
				console.warn("SAP Cues: Ignoring invalid cue:", parsed.error);
				return null;
			}
			return parsed.data;
		})).transform((cues) => cues.filter((c) => c !== null))
	});
	function validateCueManifest(json) {
		try {
			const parsed = cueManifestSchema.safeParse(json);
			if (parsed.success) return parsed.data;
			console.warn("SAP Cues: Manifest validation failed entirely.", parsed.error);
			return null;
		} catch (e) {
			console.error("SAP Cues: Validation threw an exception", e);
			return null;
		}
	}
	//#endregion
	//#region src/audio-player/cues/CueManifestPlugin.ts
	var CueManifestPlugin = class {
		name = "cueManifest";
		context = null;
		runtime = null;
		abortController = null;
		init(context) {
			this.context = context;
			this.handleDispatchCue = this.handleDispatchCue.bind(this);
			(this.context.getRootElement() || window).addEventListener("sap-dispatch-cue", this.handleDispatchCue);
		}
		destroy() {
			if (this.context) (this.context.getRootElement() || window).removeEventListener("sap-dispatch-cue", this.handleDispatchCue);
			this.cleanup();
			this.context = null;
		}
		handleDispatchCue(e) {
			if (!this.runtime) return;
			const detail = e.detail;
			if (!detail) return;
			if (detail.id) this.runtime.executeCueById(detail.id);
			else if (detail.kind && detail.value !== void 0) this.runtime.executeCueByTrigger(detail.kind, detail.value);
		}
		cleanup() {
			if (this.abortController) {
				this.abortController.abort();
				this.abortController = null;
			}
			if (this.runtime) {
				this.runtime.reset();
				this.runtime = null;
			}
		}
		onTrackLoad(track) {
			this.cleanup();
			if (!track || !this.context) return;
			if (track.cueManifest) {
				const manifest = validateCueManifest(track.cueManifest);
				if (manifest) this.runtime = new CueRuntime(this.context, manifest);
			} else if (track.cueManifestUrl) {
				this.abortController = new AbortController();
				fetch(track.cueManifestUrl, { signal: this.abortController.signal }).then((res) => {
					if (!res.ok) throw new Error(`Failed to fetch cue manifest: ${res.status} ${res.statusText}`);
					return res.json();
				}).then((data) => {
					const manifest = validateCueManifest(data);
					if (manifest && this.context) this.runtime = new CueRuntime(this.context, manifest);
				}).catch((e) => {
					if (e.name !== "AbortError") console.warn("Failed to fetch cue manifest from URL:", e);
				});
			}
		}
		onTimeUpdate(position) {
			if (this.runtime && this.context) this.runtime.handleTimeUpdate(position, false);
		}
		onSeek(position) {
			if (this.runtime) this.runtime.handleTimeUpdate(position, true);
		}
		onStop() {
			this.cleanup();
		}
	};
	function createCueManifestPlugin() {
		return new CueManifestPlugin();
	}
	//#endregion
	//#region src/audio-player/cues/useNarrativeCueController.ts
	/**
	* A host-facing React hook that acts as the bridge between generic Cue Manifest
	* events and the SAP narrative audio engine.
	*/
	function useNarrativeCueController(options = {}) {
		const { eventTarget } = options;
		const [state, setState] = (0, react.useState)({
			sceneMood: void 0,
			ambientProfile: void 0,
			fxClip: void 0,
			fxLoop: false,
			duckAmount: .6,
			intensity: 1,
			chapterId: void 0
		});
		(0, react.useEffect)(() => {
			const target = eventTarget || (typeof window !== "undefined" ? window : null);
			if (!target) return;
			const handler = (e) => {
				const action = e.detail;
				if (!action || !action.command) return;
				setState((s) => {
					const next = { ...s };
					switch (action.command) {
						case "ambience.crossfade":
							next.ambientProfile = action.profile;
							break;
						case "duck.set":
							next.duckAmount = action.amount;
							break;
					}
					return next;
				});
			};
			target.addEventListener("sap-narrative-cue", handler);
			return () => target.removeEventListener("sap-narrative-cue", handler);
		}, [eventTarget]);
		const dispatchCueEvent = (0, react.useCallback)((trigger) => {
			const target = eventTarget || (typeof window !== "undefined" ? window : null);
			if (!target) return;
			target.dispatchEvent(new CustomEvent("sap-dispatch-cue", {
				detail: trigger,
				bubbles: true
			}));
		}, [eventTarget]);
		return {
			/** Options to spread into `useNarrativeAudio`. */
			narrativeOptions: state,
			dispatchCueEvent,
			enterScene: (0, react.useCallback)((sceneId) => {
				dispatchCueEvent({
					kind: "scene",
					value: sceneId
				});
			}, [dispatchCueEvent]),
			enterParagraph: (0, react.useCallback)((paragraphId) => {
				dispatchCueEvent({
					kind: "paragraph",
					value: paragraphId
				});
			}, [dispatchCueEvent]),
			enterChapter: (0, react.useCallback)((chapterId) => {
				dispatchCueEvent({
					kind: "chapter",
					value: chapterId
				});
			}, [dispatchCueEvent]),
			applyMetadataSignature: (0, react.useCallback)((signature) => {
				dispatchCueEvent({
					kind: "signature",
					value: signature
				});
			}, [dispatchCueEvent])
		};
	}
	//#endregion
	//#region src/audio-player/utils/checkCodecSupport.ts
	/**
	* Check if the browser supports a given audio MIME type.
	* Returns false in SSR/non-browser environments.
	*/
	function checkCodecSupport(mimeType) {
		if (typeof window === "undefined" || typeof document === "undefined") return false;
		const a = document.createElement("audio");
		if (!a.canPlayType) return false;
		const result = a.canPlayType(mimeType);
		return result === "probably" || result === "maybe";
	}
	//#endregion
	//#region src/audio-player/utils/validateTrackSource.ts
	/**
	* Validates an audio track URL by attempting a HEAD request.
	* Returns information about accessibility, CORS status, and optionally
	* checks codec support if the MIME type can be determined.
	*/
	async function validateTrackSource(url, options = {}) {
		const { timeoutMs = 5e3, checkCodec = true } = options;
		let response;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		try {
			response = await fetch(url, {
				method: "HEAD",
				mode: "cors",
				signal: controller.signal
			});
			clearTimeout(timeoutId);
		} catch (error) {
			clearTimeout(timeoutId);
			if (error.name === "AbortError") return {
				ok: false,
				accessible: false,
				corsEnabled: false,
				error: "Request timed out"
			};
			try {
				const fallbackController = new AbortController();
				const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), timeoutMs);
				response = await fetch(url, {
					method: "HEAD",
					mode: "no-cors",
					signal: fallbackController.signal
				});
				clearTimeout(fallbackTimeoutId);
				if (response.type === "opaque") return {
					ok: true,
					accessible: true,
					corsEnabled: false
				};
			} catch (fallbackError) {
				return {
					ok: false,
					accessible: false,
					corsEnabled: false,
					error: fallbackError.message || "Network error"
				};
			}
		}
		if (!response.ok && response.type !== "opaque") return {
			ok: false,
			accessible: false,
			corsEnabled: true,
			error: `HTTP ${response.status} ${response.statusText}`
		};
		const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || void 0;
		let codecSupported = void 0;
		if (mimeType && checkCodec) codecSupported = checkCodecSupport(mimeType);
		return {
			ok: codecSupported === false ? false : true,
			accessible: true,
			corsEnabled: true,
			mimeType,
			codecSupported
		};
	}
	//#endregion
	//#region src/audio-player/components/workspace/VisualLyricsWorkspace.tsx
	function VisualLyricsWorkspace({ lyrics }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sap-ctl__workspace-empty",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-lead",
				children: "Lyrics"
			}), lyrics ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sap-ctl__lyrics",
				children: lyrics
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "sap-ctl__workspace-sub",
				children: "Lyrics display and sync settings will appear here."
			})]
		});
	}
	//#endregion
	//#region src/audio-player/headless/composeEventHandlers.ts
	/** True when a previous handler asked for the rest of the chain to be skipped. */
	function isSAPDefaultPrevented(event) {
		if (!event || typeof event !== "object") return false;
		const e = event;
		return e.defaultPrevented === true || e.sapPreventDefault === true || e.nativeEvent?.sapPreventDefault === true;
	}
	/**
	* Merge any number of optional event handlers into one. Handlers run in
	* order, nullish entries are skipped, and the chain stops as soon as
	* `isSAPDefaultPrevented(event)` reports true.
	*/
	function composeEventHandlers(...handlers) {
		return (event) => {
			for (const handler of handlers) {
				if (!handler) continue;
				if (isSAPDefaultPrevented(event)) return;
				handler(event);
			}
		};
	}
	//#endregion
	//#region src/audio-player/headless/mergeRefs.ts
	/**
	* Merge callback refs and object refs into a single callback ref, so a prop
	* getter can attach SAP's internal ref without losing the caller's:
	*
	*     <audio {...getAudioElementProps({ ref: myRef })} />
	*
	* Nullish refs are skipped.
	*/
	function mergeRefs(...refs) {
		return (node) => {
			for (const ref of refs) {
				if (!ref) continue;
				if (typeof ref === "function") ref(node);
				else ref.current = node;
			}
		};
	}
	//#endregion
	//#region src/audio-player/headless/useSAPPropGetters.ts
	/** True when the engine is a `SessionEngine` (has queue navigation). */
	function isSessionEngine(engine) {
		const candidate = engine;
		return typeof candidate.next === "function" && typeof candidate.previous === "function";
	}
	/**
	* Downshift-style prop getters over an EXISTING SAP engine. This is an
	* adapter, not an engine creator: pass it the engine you already have —
	* `useAudioPlayer(...)` for a standalone player, or `useAudioSession()` so a
	* custom skin shares the one global `<audio>` source with every other skin.
	*
	* Each getter returns spreadable, unstyled props: correct accessibility
	* attributes, disabled handling, Enter/Space activation for non-`<button>`
	* hosts, and caller props preserved (caller event handlers run first; set
	* `event.sapPreventDefault = true` or call `event.preventDefault()` to skip
	* SAP's internal handler).
	*
	* Queue getters (`getNextButtonProps` / `getPreviousButtonProps`) are only
	* active on a `SessionEngine`; on a plain `AudioPlayerEngine` they render
	* disabled and no-op safely.
	*/
	function useSAPPropGetters(engine, options = {}) {
		const { seekStep = 10 } = options;
		return (0, react.useMemo)(() => {
			const session = isSessionEngine(engine) ? engine : null;
			const noAudio = !engine.hasAudio;
			const keyboardActivation = (run) => (event) => {
				const tag = event.currentTarget.tagName;
				if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				run();
			};
			const buttonProps = (sap, user = {}) => {
				const { onClick, onKeyDown, disabled: userDisabled, ...rest } = user;
				const isDisabled = userDisabled ?? sap.disabled;
				const run = () => {
					if (!isDisabled) sap.action();
				};
				return {
					type: "button",
					"aria-label": sap.label,
					"aria-pressed": sap.pressed,
					disabled: isDisabled || void 0,
					"aria-disabled": isDisabled || void 0,
					...rest,
					onClick: composeEventHandlers(onClick, run),
					onKeyDown: composeEventHandlers(onKeyDown, keyboardActivation(run))
				};
			};
			const getPlayButtonProps = (user = {}) => buttonProps({
				label: engine.isPlaying ? "Pause" : "Play",
				pressed: engine.isPlaying,
				action: () => engine.toggle(),
				disabled: noAudio
			}, user);
			const getMuteButtonProps = (user = {}) => buttonProps({
				label: engine.isMuted ? "Unmute" : "Mute",
				pressed: engine.isMuted,
				action: () => engine.toggleMute(),
				disabled: false
			}, user);
			const getNextButtonProps = (user = {}) => buttonProps({
				label: "Next track",
				action: () => session?.next(),
				disabled: !session || !session.canNext
			}, user);
			const getPreviousButtonProps = (user = {}) => buttonProps({
				label: "Previous track",
				action: () => session?.previous(),
				disabled: !session || !session.canPrevious
			}, user);
			const getSeekForwardButtonProps = (user = {}) => buttonProps({
				label: `Seek forward ${seekStep} seconds`,
				action: () => engine.seekBy(seekStep),
				disabled: noAudio
			}, user);
			const getSeekBackwardButtonProps = (user = {}) => buttonProps({
				label: `Seek backward ${seekStep} seconds`,
				action: () => engine.seekBy(-seekStep),
				disabled: noAudio
			}, user);
			/**
			* Simple slider fallback for fully custom skins. For advanced
			* scrubbing (pointer capture, buffered ranges) keep using the
			* exported `ProgressBar` component.
			*/
			const getProgressBarProps = (user = {}) => {
				const { onKeyDown, ...rest } = user;
				const duration = engine.duration || 0;
				const now = duration > 0 ? Math.min(Math.max(engine.currentTime, 0), duration) : 0;
				const handleKeyDown = (event) => {
					if (noAudio) return;
					switch (event.key) {
						case "ArrowRight":
						case "ArrowUp":
							event.preventDefault();
							engine.seekBy(seekStep);
							break;
						case "ArrowLeft":
						case "ArrowDown":
							event.preventDefault();
							engine.seekBy(-seekStep);
							break;
						case "Home":
							event.preventDefault();
							engine.seek(0);
							break;
						case "End":
							if (duration > 0) {
								event.preventDefault();
								engine.seek(duration);
							}
							break;
					}
				};
				return {
					role: "slider",
					tabIndex: noAudio ? -1 : 0,
					"aria-label": "Seek slider",
					"aria-valuemin": 0,
					"aria-valuemax": Math.max(0, Math.floor(duration)),
					"aria-valuenow": Math.floor(now),
					"aria-valuetext": `${formatTime(now)} of ${formatTime(duration)}`,
					"aria-disabled": noAudio || void 0,
					...rest,
					onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown)
				};
			};
			/**
			* Props for a host-rendered hidden `<audio>` element. The engine's
			* internal ref stays attached (merged with the caller's), keeping the
			* engine the single source of truth — no direct backend mutation is
			* exposed. Not needed under `AudioSessionProvider`, which already
			* renders the one shared element.
			*/
			const getAudioElementProps = (user = {}) => {
				const { ref, ...rest } = user;
				return {
					...rest,
					src: engine.hasAudio ? engine.currentSrc : void 0,
					ref: mergeRefs(engine.audioRef, ref)
				};
			};
			return {
				getPlayButtonProps,
				getMuteButtonProps,
				getNextButtonProps,
				getPreviousButtonProps,
				getSeekForwardButtonProps,
				getSeekBackwardButtonProps,
				getProgressBarProps,
				getAudioElementProps
			};
		}, [engine, seekStep]);
	}
	//#endregion
	//#region src/audio-player/session/sessionSerializer.ts
	/**
	* Serializes the current session state into a plain object suitable for
	* localStorage or sharing.
	*/
	function serializeSession(session) {
		return {
			queue: [...session.queue],
			currentIndex: session.currentIndex,
			currentTime: session.currentTime,
			shuffle: session.shuffle,
			repeatMode: session.repeatMode,
			timestamp: Date.now()
		};
	}
	function isValidTrack(track) {
		return track && typeof track === "object" && typeof track.title === "string" && typeof track.artist === "string" && (typeof track.audioFile === "string" || Array.isArray(track.sources));
	}
	function isValidRepeatMode(mode) {
		return mode === "off" || mode === "all" || mode === "one";
	}
	/**
	* Deserializes a session state, validating its structure.
	* Returns the validated session, or null if the data is invalid or expired.
	*/
	function deserializeSession(data, options) {
		if (!data || typeof data !== "object") return null;
		const session = data;
		if (options?.maxAgeMs !== void 0 && typeof session.timestamp === "number" && Date.now() - session.timestamp > options.maxAgeMs) return null;
		if (!Array.isArray(session.queue)) return null;
		const validQueue = [];
		for (const item of session.queue) if (isValidTrack(item)) {
			const track = { ...item };
			if (options?.urlTransformer) {
				if (track.audioFile) track.audioFile = options.urlTransformer(track.audioFile);
				if (track.fallbackSources) track.fallbackSources = track.fallbackSources.map(options.urlTransformer);
				if (track.sources) track.sources = track.sources.map((s) => ({
					...s,
					url: options.urlTransformer(s.url)
				}));
			}
			validQueue.push(track);
		}
		if (validQueue.length === 0 && session.queue.length > 0) return null;
		return {
			queue: validQueue,
			currentIndex: typeof session.currentIndex === "number" ? session.currentIndex : -1,
			currentTime: typeof session.currentTime === "number" ? session.currentTime : 0,
			shuffle: typeof session.shuffle === "boolean" ? session.shuffle : false,
			repeatMode: isValidRepeatMode(session.repeatMode) ? session.repeatMode : "off",
			timestamp: typeof session.timestamp === "number" ? session.timestamp : Date.now()
		};
	}
	//#endregion
	//#region src/audio-player/surfaces/PlayerHero.tsx
	/**
	* The hero identity block. It renders the full hero by default and a compact
	* identity header when `collapsed` — the SAME DOM node with a `data-collapsed`
	* flag, so the transition animates and nothing navigates away (no route/modal/
	* tab). Faces that don't support hero collapse always receive `collapsed={false}`.
	*
	* The title shows an optional version qualifier and explicit badge and can
	* marquee when it overflows; the artist line composes featured artists + album.
	*/
	function PlayerHero({ face, collapsed, title, artist, art, className, album, featuredArtists, versionLabel, explicit, releaseTitle, subtitle, marquee = false, titleFont, artistFont }) {
		const fullTitle = formatVersionedTitle(title, versionLabel);
		const secondary = formatSecondaryLine({
			artist,
			featuredArtists,
			albumTitle: album,
			subtitle
		});
		const release = releaseTitle?.trim();
		const useMarquee = marquee && !collapsed;
		const titleContent = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [fullTitle, explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})] });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-hero${className ? ` ${className}` : ""}`,
			"data-collapsed": collapsed ? "true" : "false",
			"data-face": face,
			role: "group",
			"aria-label": "Track information",
			children: [art && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-hero__art",
				children: art
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ap-hero__text",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-hero__title",
						title: fullTitle,
						dir: "auto",
						style: titleFont,
						children: useMarquee ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextMarquee, {
							className: "ap-hero__marquee",
							children: titleContent
						}) : titleContent
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-hero__artist",
						title: secondary,
						dir: "auto",
						style: artistFont,
						children: secondary
					}),
					!collapsed && release && release !== album?.trim() && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-hero__release",
						title: release,
						dir: "auto",
						children: release
					})
				]
			})]
		});
	}
	//#endregion
	//#region src/audio-player/skins/FullCardPlayer.tsx
	/**
	* The rich "now playing" card, driven by the global session. Keeps the core
	* transport visible (prev / back 10 / play / fwd 10 / next); shuffle, repeat,
	* automix, queue, info, and share live in the SAP Controller behind the "…"
	* button. This skin is the designated owner of the autoplay-blocked prompt so
	* users don't see five simultaneous prompts.
	*
	* Capability-driven (`PLAYER_FACE_CAPABILITIES.fullCard`): the fully-wired face.
	* It hosts the SEICanvas (`supportsSEICanvas`), the ScrubberCanvas
	* (`supportsScrubberCanvas`), and the contextual radial menu
	* (`supportsContextualActions`, rendered via `PlayerSurfaceButtons`) — none of
	* these are hard-coded here; each render zone follows the model. The SAP
	* three-dot controller is always present for deep actions independent of those
	* capabilities.
	*/
	function FullCardPlayer({ showVolume = defaultShowVolume(), backgroundMedia, backgroundImage, blurSize = 20, darkenAmount = 0, artMedia, art, titleFont, artistFont, className, style, ...theme }) {
		const s = useAudioSession();
		const surface = usePlayerSurface("fullCard");
		const [queueDrawerOpen, setQueueDrawerOpen] = (0, react.useState)(false);
		const [controllerOpen, setControllerOpen] = (0, react.useState)(false);
		const [controllerRoute, setControllerRoute] = (0, react.useState)("options");
		const { currentTrack, currentIndex, queue, isPlaying, isBuffering, currentTime, duration, buffered, isSeeking, volume, isMuted, volumeUnsupported, hasAudio, hasError, errorMessage, autoplayBlocked, shuffle, repeatMode, automix, canNext, canPrevious } = s;
		const themeVars = buildThemeVars(theme);
		const backdrop = resolveMedia({
			media: backgroundMedia,
			legacyImage: backgroundImage
		});
		const heroArt = resolveMedia({
			media: artMedia,
			legacyCss: art
		});
		const heroArtNode = heroArt.media?.kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
			className: "ap-fc__hero-art",
			src: heroArt.media.src,
			poster: heroArt.media.poster,
			ref: ensureMuted,
			muted: true,
			autoPlay: true,
			loop: true,
			playsInline: true,
			"aria-hidden": "true"
		}) : heroArt.cssBackground ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ap-fc__hero-art",
			style: { backgroundImage: heroArt.cssBackground },
			"aria-hidden": "true"
		}) : void 0;
		const isEmpty = queue.length === 0;
		const showPlaySpinner = isBuffering;
		const mediaSessionArtworkSrc = currentTrack?.artwork ?? artMedia?.src ?? (art ? extractUrlFromCss(art) : null) ?? backgroundMedia?.src ?? backgroundImage?.src;
		const artwork = (0, react.useMemo)(() => mediaSessionArtworkSrc ? buildMediaSessionArtwork(mediaSessionArtworkSrc) : [], [mediaSessionArtworkSrc]);
		useMediaSessionObserver(s, {
			title: currentTrack?.title ?? "",
			artist: currentTrack?.artist ?? "",
			album: currentTrack?.albumTitle ?? "",
			artwork,
			sourceKey: currentTrack ? `${currentIndex}:${trackKey(currentTrack)}:${trackSourcesSignature(currentTrack)}` : "empty",
			onNext: canNext ? s.next : void 0,
			onPrevious: canPrevious ? s.previous : void 0
		});
		const handleOpenQueue = (0, react.useCallback)(() => setQueueDrawerOpen(true), []);
		const handleCloseQueue = (0, react.useCallback)(() => setQueueDrawerOpen(false), []);
		const { share, copied: shareCopied, nativeShare } = useShareTrack(currentTrack?.title ?? "", currentTrack?.artist ?? "");
		const handleShareClick = (0, react.useCallback)(() => {
			if (nativeShare) setControllerOpen(false);
			share();
		}, [nativeShare, share]);
		const handleOpenFocusedController = (0, react.useCallback)((route) => {
			setControllerRoute(route);
			setControllerOpen(true);
		}, []);
		const handleCloseController = (0, react.useCallback)(() => {
			setControllerOpen(false);
			setControllerRoute("options");
		}, []);
		const handleOpenOptions = (0, react.useCallback)(() => {
			setControllerRoute("options");
			setControllerOpen(true);
		}, []);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualSlotsProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-fc ap-glass-surface${className ? ` ${className}` : ""}`,
			style: {
				...themeVars,
				"--ap-blur": `${blurSize}px`,
				...style
			},
			role: "region",
			"aria-label": "Now playing",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackgroundMedia, {
					media: backdrop.media,
					cssBackground: backdrop.cssBackground,
					darkenAmount,
					className: "ap-fc__bg"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueDrawer, {
					queue,
					currentIndex,
					isPlaying,
					open: queueDrawerOpen,
					onClose: handleCloseQueue,
					onPlayTrack: s.playTrack,
					onReorder: s.moveQueueItem,
					onRemove: s.removeFromQueue
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SAPController, {
					open: controllerOpen,
					onClose: handleCloseController,
					route: controllerRoute,
					playback: {
						shuffle,
						onToggleShuffle: s.toggleShuffle,
						repeatMode,
						onCycleRepeat: s.cycleRepeat,
						automix,
						onToggleAutomix: s.toggleAutomix
					},
					queue: isEmpty ? void 0 : {
						count: queue.length,
						onOpenQueue: handleOpenQueue
					},
					info: currentTrack ? {
						title: currentTrack.title ?? "",
						artist: currentTrack.artist ?? "",
						duration,
						lyrics: currentTrack.lyrics
					} : void 0,
					share: currentTrack ? {
						onShare: handleShareClick,
						copied: shareCopied
					} : void 0,
					...theme
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ap-fc__menu",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ap-icon-btn ap-tap ap-menu__btn",
						onClick: handleOpenOptions,
						"aria-label": "Player options",
						"aria-haspopup": "dialog",
						"aria-expanded": controllerOpen,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DotsIcon$1, {})
					})
				}),
				isEmpty && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-banner ap-banner--info ap-anim-in",
					role: "status",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorIcon$1, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Queue is empty" })]
				}),
				autoplayBlocked && hasAudio && !hasError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-banner ap-banner--info ap-banner--col ap-anim-in",
					role: "status",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ap-banner__row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorIcon$1, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Autoplay blocked. Tap play to start audio." })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ap-retry-btn",
						onClick: () => {
							s.dismissAutoplayBlocked();
							s.toggle();
						},
						children: "Play"
					})]
				}),
				hasError && hasAudio && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-banner ap-banner--error ap-banner--col ap-anim-in",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ap-banner__row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorIcon$1, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: errorMessage })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ap-retry-btn",
						onClick: s.retry,
						children: "Retry"
					})]
				}),
				!isEmpty && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-fc__counter",
					children: [
						"Track ",
						currentIndex + 1,
						" of ",
						queue.length,
						shuffle ? " · Shuffle" : "",
						repeatMode !== "off" ? ` · Repeat ${repeatMode}` : "",
						automix ? " · Automix" : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-fc__stage",
					"data-surface-open": surface.mode !== "default",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerHero, {
						face: "fullCard",
						collapsed: surface.isHeroCollapsed,
						title: currentTrack?.title ?? "Nothing playing",
						artist: currentTrack?.artist ?? "—",
						art: heroArtNode,
						album: currentTrack?.albumTitle,
						featuredArtists: currentTrack?.featuredArtists,
						versionLabel: currentTrack?.versionLabel,
						explicit: currentTrack?.explicit,
						releaseTitle: currentTrack?.releaseTitle,
						subtitle: currentTrack?.subtitle,
						marquee: true,
						titleFont,
						artistFont
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasHost, {
						open: surface.isCanvasOpen || surface.isQueueOpen,
						face: "fullCard",
						supported: surface.canvasSupported,
						activeSurfaceId: surface.mode === "default" ? void 0 : surface.mode,
						children: surface.isQueueOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueSurface, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasRenderer, {
							currentTime,
							duration,
							lyrics: currentTrack?.lyrics
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-fc__control-dock",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrubberCanvasHost, {
							face: "fullCard",
							density: getScrubberDensity("fullCard"),
							currentTime,
							duration,
							progress: duration > 0 ? currentTime / duration : 0,
							onSeek: s.seek,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrubberCanvasRenderer, {
								currentTime,
								duration,
								onSeek: s.seek,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ap-progress-group",
									role: "group",
									"aria-label": "Playback progress",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformAdapter, {
										face: "fullCard",
										density: getScrubberDensity("fullCard"),
										currentTime,
										duration,
										buffered,
										disabled: !hasAudio,
										isSeeking,
										onSeek: s.seek,
										onSeekStart: () => s.setSeeking(true),
										onSeekEnd: () => s.setSeeking(false),
										peaks: currentTrack?.peaks,
										peaksDuration: currentTrack?.waveformDuration,
										getDecodedData: s.getDecodedData,
										url: s.getBackendInfo().active === "html5" ? s.currentSrc : void 0,
										sourceKey: currentTrack ? trackKey(currentTrack) : void 0
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ap-times",
										"aria-hidden": "true",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatTime(currentTime) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatTime(duration) })]
									})]
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-transport",
							role: "group",
							"aria-label": "Playback controls",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldSkipButton, {
									direction: "previous",
									className: "ap-btn ap-btn--ghost ap-tap",
									disabled: !hasAudio,
									skipDisabled: !canPrevious,
									seekLabel: "Skip backward 10 seconds",
									skipLabel: "Previous track",
									onSeek: () => s.seekBy(-10),
									onSkip: s.previous,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrevIcon$1, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: `ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`,
									onClick: s.toggle,
									disabled: !hasAudio,
									"aria-label": showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play",
									children: showPlaySpinner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon$1, {}) : isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon$1, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon$1, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldSkipButton, {
									direction: "next",
									className: "ap-btn ap-btn--ghost ap-tap",
									disabled: !hasAudio,
									skipDisabled: !canNext,
									seekLabel: "Skip forward 10 seconds",
									skipLabel: "Next track",
									onSeek: () => s.seekBy(10),
									onSkip: s.next,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NextIcon$1, {})
								})
							]
						}),
						showVolume && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeControl, {
							volume,
							isMuted,
							disabled: !hasAudio,
							volumeUnsupported,
							onVolumeChange: s.setVolume,
							onToggleMute: s.toggleMute
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerSurfaceButtons, {
							surface,
							onOpenQueue: handleOpenQueue,
							onOpenFocusedController: handleOpenFocusedController
						})
					]
				})
			]
		}) });
	}
	//#endregion
	//#region src/audio-player/surfaces/ArcActionButton.tsx
	/** Map the declarative action tree onto the arc menu's `MenuNode` tree. */
	function toMenuNodes(actions) {
		return actions.map((a) => ({
			id: a.id,
			label: a.label,
			icon: a.icon ?? DotsIcon$1,
			state: a.state,
			children: a.children && a.children.length > 0 ? toMenuNodes(a.children) : void 0
		}));
	}
	/** Flatten leaf actions into an id → action map for O(1) dispatch. */
	function indexLeaves(actions, map) {
		for (const a of actions) if (a.children && a.children.length > 0) indexLeaves(a.children, map);
		else map.set(a.id, a);
	}
	/**
	* A generic Arc Action Button: the SEIHouse command-wheel affordance backed by a
	* plain `ArcAction[]` model. It is a thin, engine-agnostic adapter over
	* `SEICanvasActionMenu` — the trigger is a single button when closed (cheap to
	* mount in long lists), and the arc overlay only renders on tap. Any face can
	* reuse it as its primary action surface; Vault rows use it in place of the old
	* three-dot menu.
	*/
	function ArcActionButton({ actions, ariaLabel = "Actions", className }) {
		const items = (0, react.useMemo)(() => toMenuNodes(actions), [actions]);
		const leaves = (0, react.useMemo)(() => {
			const map = /* @__PURE__ */ new Map();
			indexLeaves(actions, map);
			return map;
		}, [actions]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasActionMenu, {
			items,
			onSelect: (node) => leaves.get(node.id)?.onSelect?.(node.id),
			ariaLabel,
			className
		});
	}
	//#endregion
	//#region src/audio-player/skins/vaultCategories.ts
	/**
	* Vault category → visual identity. Rows derive their color/status from this map
	* (driven by `Track.vaultCategory`) instead of depending on per-row artwork, so
	* a long list stays fast, clean, and scannable.
	*
	* Colors are plain CSS values so the host can keep using its own theme tokens
	* elsewhere; override per row via the existing `AudioPlayerTheme` props when a
	* different palette is needed.
	*/
	var VAULT_CATEGORY_META = {
		demo: {
			label: "Demo",
			color: "#7C5CFF"
		},
		beat: {
			label: "Beat",
			color: "#22D3A6"
		},
		mix: {
			label: "Mix",
			color: "#38BDF8"
		},
		master: {
			label: "Master",
			color: "#F5C451"
		},
		memo: {
			label: "Memo",
			color: "#A1A1AA"
		},
		arcNote: {
			label: "Arc Note",
			color: "#FB7185"
		},
		toFinish: {
			label: "To Finish",
			color: "#FB923C"
		},
		archived: {
			label: "Archived",
			color: "#6B7280"
		}
	};
	/**
	* Host-registered custom categories. Kept in a Map (mirroring the visual-slots
	* registry) so apps can add their own classifications — or recolor a built-in —
	* without editing the library. Checked before the built-ins so a registration
	* can override a built-in id.
	*/
	var CUSTOM_CATEGORIES = /* @__PURE__ */ new Map();
	/**
	* Register (or replace) a custom Vault category's visual identity. Call once at
	* startup; rows reading `track.vaultCategory === id` then pick up the label +
	* accent color automatically. Registering under a built-in id overrides it.
	*/
	function registerVaultCategory(id, meta) {
		CUSTOM_CATEGORIES.set(id, meta);
	}
	/** Remove all custom registrations, restoring the built-in defaults. Mainly
	*  useful for test isolation, or to reset host-defined categories. */
	function clearCustomCategories() {
		CUSTOM_CATEGORIES.clear();
	}
	/**
	* Every known category as `[id, meta]` pairs — built-ins first, then custom
	* registrations (custom entries that reuse a built-in id appear once, overridden).
	* Useful for building a category picker.
	*/
	function getAllVaultCategories() {
		const merged = new Map(Object.entries(VAULT_CATEGORY_META));
		for (const [id, meta] of CUSTOM_CATEGORIES) merged.set(id, meta);
		return Array.from(merged.entries());
	}
	/**
	* Look up a category's visual identity, or `null` when none is set. Accepts any
	* string so custom (host-registered) categories resolve alongside the built-ins;
	* custom registrations win. Unknown values return `null`, keeping the contract
	* honest against unexpected external data.
	*/
	function getVaultCategoryMeta(category) {
		if (!category) return null;
		if (CUSTOM_CATEGORIES.has(category)) return CUSTOM_CATEGORIES.get(category);
		return Object.prototype.hasOwnProperty.call(VAULT_CATEGORY_META, category) ? VAULT_CATEGORY_META[category] : null;
	}
	//#endregion
	//#region src/audio-player/skins/VaultRowPlayer.tsx
	/** Identify a track within the queue the same way the session's playNow does. */
	function sameTrack$1(a, b) {
		return trackKey(a) === trackKey(b);
	}
	/**
	* A slim Vault list row. Each row controls the shared session: pressing play
	* starts this track in the one global engine (jumping if it's already queued,
	* else appending). When this row is the active track its play button mirrors the
	* global play state — so it stays in sync with every other skin.
	*
	* Capability-driven (`PLAYER_FACE_CAPABILITIES.vaultRow`, CompactPlayer family):
	* the most compact face. `supportsSEICanvas: false`, `supportsContextualActions:
	* false`, and `supportsScrubberCanvas: false` — a list row mounts **no** scrubber
	* of its own; seeking lives on the shared StickyBottom master scrubber that
	* follows the active song. It keeps `supportsAction: true`, so it renders a row
	* action button. Visual identity comes from the track's `vaultCategory` (accent
	* color + status label), not per-row artwork, keeping long lists fast to render.
	*/
	function VaultRowPlayer({ track, number, actions, onAction, className, style, ...theme }) {
		const s = useAudioSession();
		const isActive = s.currentTrack ? sameTrack$1(s.currentTrack, track) : false;
		const isPlayingThis = isActive && s.isPlaying;
		const isBufferingThis = isActive && s.isBuffering;
		const category = getVaultCategoryMeta(track.vaultCategory);
		const resolvedActions = (0, react.useMemo)(() => {
			if (actions && actions.length > 0) return actions;
			if (onAction) return [{
				id: "more",
				label: "More",
				icon: DotsIcon$1,
				onSelect: () => onAction(track)
			}];
			return [];
		}, [
			actions,
			onAction,
			track
		]);
		const showAction = faceSupportsAction("vaultRow") && resolvedActions.length > 0;
		const handleToggle = () => {
			if (isActive) s.toggle();
			else s.playNow(track);
		};
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-vr${isActive ? " ap-vr--active" : ""}${className ? ` ${className}` : ""}`,
			style: {
				...buildThemeVars(theme),
				...category ? { "--ap-vault-accent": category.color } : {},
				...style
			},
			"data-vault-category": track.vaultCategory,
			"aria-current": isActive ? "true" : void 0,
			children: [
				category && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-vr__chip ap-vr__chip--lead",
					title: category.label,
					children: category.label
				}),
				number !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-vr__num",
					children: number
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ap-btn ap-btn--play ap-vr__play ap-tap",
					onClick: handleToggle,
					"aria-label": isBufferingThis ? "Buffering audio" : isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`,
					children: isBufferingThis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon$1, {}) : isPlayingThis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon$1, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon$1, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-vr__meta",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ap-vr__title",
						title: formatVersionedTitle(track.title, track.versionLabel),
						children: [formatVersionedTitle(track.title, track.versionLabel), track.explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ap-vr__artist",
						title: formatSecondaryLine(track),
						children: [category && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-vr__chip ap-vr__chip--inline",
							children: category.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-vr__artist-text",
							children: formatSecondaryLine(track)
						})]
					})]
				}),
				isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ap-vr__time",
					"aria-hidden": "true",
					children: formatTime(s.currentTime)
				}),
				isPlayingThis && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "ap-eq",
					"aria-hidden": "true",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
					]
				}),
				showAction && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArcActionButton, {
					actions: resolvedActions,
					ariaLabel: `Actions for ${track.title}`,
					className: "ap-vr__action"
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/skins/StickyBottomPlayer.tsx
	/**
	* An always-visible now-playing bar (Spotify-style). Reads the shared session,
	* so it reflects and controls whatever any other skin is doing. Core transport
	* only — shuffle, repeat, automix, queue, info, and share live in the SAP
	* Controller behind the "…" button. Renders nothing when the queue is empty.
	*
	* Capability-driven (`PLAYER_FACE_CAPABILITIES.stickyBottom`): a compact bar
	* with `supportsContextualActions: false` — deep actions and queue access route
	* through its SAPController three-dot sheet instead of a radial menu, so it does
	* not render `PlayerSurfaceButtons`. `supportsSEICanvas: false` (no canvas
	* zone). Phase 3 wires its scrubber through `ScrubberCanvasHost` (compact
	* density) so the timeline becomes a real plugin mount point.
	*/
	function StickyBottomPlayer({ fixed = true, showVolume = defaultShowVolume(), className, style, ...theme }) {
		const s = useAudioSession();
		const [queueDrawerOpen, setQueueDrawerOpen] = (0, react.useState)(false);
		const [controllerOpen, setControllerOpen] = (0, react.useState)(false);
		const handleOpenQueue = (0, react.useCallback)(() => setQueueDrawerOpen(true), []);
		const handleCloseQueue = (0, react.useCallback)(() => setQueueDrawerOpen(false), []);
		const { share, copied: shareCopied, nativeShare } = useShareTrack(s.currentTrack?.title ?? "", s.currentTrack?.artist ?? "");
		const handleShareClick = (0, react.useCallback)(() => {
			if (nativeShare) setControllerOpen(false);
			share();
		}, [nativeShare, share]);
		if (s.queue.length === 0 || !s.currentTrack) return null;
		const { currentTrack, isPlaying, isBuffering, shuffle, repeatMode, automix } = s;
		const showPlaySpinner = isBuffering;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-sb${fixed ? " ap-sb--fixed" : ""}${className ? ` ${className}` : ""}`,
			style: {
				...buildThemeVars(theme),
				...style
			},
			role: "region",
			"aria-label": "Playback bar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueDrawer, {
					queue: s.queue,
					currentIndex: s.currentIndex,
					isPlaying: s.isPlaying,
					open: queueDrawerOpen,
					onClose: handleCloseQueue,
					onPlayTrack: s.playTrack,
					onReorder: s.moveQueueItem,
					onRemove: s.removeFromQueue
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SAPController, {
					open: controllerOpen,
					onClose: () => setControllerOpen(false),
					route: "options",
					playback: {
						shuffle,
						onToggleShuffle: s.toggleShuffle,
						repeatMode,
						onCycleRepeat: s.cycleRepeat,
						automix,
						onToggleAutomix: s.toggleAutomix
					},
					queue: {
						count: s.queue.length,
						onOpenQueue: handleOpenQueue
					},
					info: {
						title: currentTrack.title ?? "",
						artist: currentTrack.artist ?? "",
						duration: s.duration,
						lyrics: currentTrack.lyrics
					},
					share: {
						onShare: handleShareClick,
						copied: shareCopied
					},
					...theme
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-sb__inner",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-sb__meta",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "ap-sb__title",
								title: formatVersionedTitle(currentTrack.title, currentTrack.versionLabel),
								children: [formatVersionedTitle(currentTrack.title, currentTrack.versionLabel), currentTrack.explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ap-sb__artist",
								title: formatSecondaryLine(currentTrack),
								children: formatSecondaryLine(currentTrack)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-sb__center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-sb__controls",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldSkipButton, {
										direction: "previous",
										className: "ap-btn ap-btn--ghost ap-btn--sm ap-tap",
										disabled: !s.hasAudio,
										skipDisabled: !s.canPrevious,
										seekLabel: "Skip backward 10 seconds",
										skipLabel: "Previous track",
										onSeek: () => s.seekBy(-10),
										onSkip: s.previous,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrevIcon$1, {})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: `ap-btn ap-btn--play ap-sb__play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`,
										onClick: s.toggle,
										disabled: !s.hasAudio,
										"aria-label": showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play",
										children: showPlaySpinner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon$1, {}) : isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon$1, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon$1, {})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldSkipButton, {
										direction: "next",
										className: "ap-btn ap-btn--ghost ap-btn--sm ap-tap",
										disabled: !s.hasAudio,
										skipDisabled: !s.canNext,
										seekLabel: "Skip forward 10 seconds",
										skipLabel: "Next track",
										onSeek: () => s.seekBy(10),
										onSkip: s.next,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NextIcon$1, {})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "ap-icon-btn ap-tap",
										onClick: () => setControllerOpen(true),
										"aria-label": "Player options",
										"aria-haspopup": "dialog",
										"aria-expanded": controllerOpen,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DotsIcon$1, {})
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-sb__scrub",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ap-sb__t",
										"aria-hidden": "true",
										children: formatTime(s.currentTime)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrubberCanvasHost, {
										face: "stickyBottom",
										density: getScrubberDensity("stickyBottom"),
										currentTime: s.currentTime,
										duration: s.duration,
										progress: s.duration > 0 ? s.currentTime / s.duration : 0,
										onSeek: s.seek,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformAdapter, {
											face: "stickyBottom",
											density: getScrubberDensity("stickyBottom"),
											currentTime: s.currentTime,
											duration: s.duration,
											buffered: s.buffered,
											disabled: !s.hasAudio,
											isSeeking: s.isSeeking,
											onSeek: s.seek,
											onSeekStart: () => s.setSeeking(true),
											onSeekEnd: () => s.setSeeking(false)
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ap-sb__t",
										"aria-hidden": "true",
										children: formatTime(s.duration)
									})
								]
							})]
						}),
						showVolume && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ap-sb__volume",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeControl, {
								volume: s.volume,
								isMuted: s.isMuted,
								disabled: !s.hasAudio,
								volumeUnsupported: s.volumeUnsupported,
								onVolumeChange: s.setVolume,
								onToggleMute: s.toggleMute
							})
						})
					]
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/skins/MiniSidebarPlayer.tsx
	/**
	* A condensed widget for a sidebar: small art, current track, play/pause, and
	* the action menu. Reads the shared session so it always shows what is globally
	* playing.
	*
	* Capability-driven (`PLAYER_FACE_CAPABILITIES.miniSidebar`, CompactPlayer
	* family): a compact face. `supportsSEICanvas: false`, so the canvas zone and its
	* left surface button are auto-hidden. `supportsScrubberCanvas: false` — the mini
	* mounts **no** scrubber; seeking lives on the shared StickyBottom master. It is
	* the only compact face with the contextual radial menu
	* (`supportsContextualActions`), which is also where skip/next now live (via
	* `showTransport`) — freeing the row for title/artist instead of a Next button.
	* `PlayerSurfaceButtons` reads the capability flags from the model, so passing
	* `surface` plus the transport wiring yields the correct menu.
	*/
	function MiniSidebarPlayer({ art = "linear-gradient(135deg,#7C5CFF,#22D3A6)", artMedia, className, style, ...theme }) {
		const s = useAudioSession();
		const surface = usePlayerSurface("miniSidebar");
		const blockArt = resolveMedia({
			media: artMedia,
			legacyCss: art
		});
		const { currentTrack, isPlaying, isBuffering, hasAudio } = s;
		const msTitle = currentTrack ? formatVersionedTitle(currentTrack.title, currentTrack.versionLabel) : "Nothing playing";
		const msSecondary = currentTrack ? formatSecondaryLine(currentTrack) : "—";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-ms-shell${className ? ` ${className}` : ""}`,
			style: {
				...buildThemeVars(theme),
				...style
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ap-ms ap-glass-surface ap-glass-surface--compact",
				role: "region",
				"aria-label": "Mini player",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `ap-ms__art${isPlaying ? " ap-ms__art--playing" : ""}`,
						style: blockArt.cssBackground ? { backgroundImage: blockArt.cssBackground } : void 0,
						"aria-hidden": "true",
						children: blockArt.media && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackgroundMedia, {
							media: blockArt.media,
							className: "ap-ms__bg"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ap-ms__meta",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "ap-ms__title",
							title: msTitle,
							children: [msTitle, currentTrack?.explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-ms__artist",
							title: msSecondary,
							children: msSecondary
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ap-btn ap-btn--play ap-ms__play ap-tap",
						onClick: s.toggle,
						disabled: !hasAudio,
						"aria-label": isBuffering ? "Buffering audio" : isPlaying ? "Pause" : "Play",
						children: isBuffering ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon$1, {}) : isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon$1, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon$1, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerSurfaceButtons, {
						surface,
						showTransport: true,
						canPrevious: s.canPrevious,
						canNext: s.canNext,
						onPrevious: s.previous,
						onNext: s.next
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ap-ms__surface",
				"data-open": surface.isQueueOpen ? "true" : "false",
				children: surface.isQueueOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueueSurface, { maxItems: 6 })
			})]
		});
	}
	//#endregion
	//#region src/audio-player/skins/SeaCardPlayer.tsx
	/** Identify a track within the queue (matches the session's playNow logic). */
	function sameTrack(a, b) {
		return trackKey(a) === trackKey(b);
	}
	/**
	* An embeddable "SEA card" surface — a marketplace/album card with an overlaid
	* play button that plays its track in the global session. When its track is the
	* active one it shows live progress and a pause state, kept in sync with every
	* other skin through the shared engine.
	*
	* Capability-driven (`PLAYER_FACE_CAPABILITIES.seaCard`): a marketplace card.
	* `supportsContextualActions: false`, so it renders no contextual menu — taps on
	* the card are about previewing/playing the track, not deep actions. The inline
	* scrubber stays a plain progress bar; Phase 4 adds a small wave trigger on the
	* active card that opens the overlay `SEICanvasHost`, which shows the hero +
	* the interactive `WaveformAdapter` (`supportsWaveform: true`). No radial menu is
	* added — the card stays clean and tap-to-play.
	*/
	function SeaCardPlayer({ track, art = "linear-gradient(135deg,#FF7AC6,#7C5CFF)", artMedia, tag, actions, titleFont, artistFont, className, style, ...theme }) {
		const s = useAudioSession();
		const surface = usePlayerSurface("seaCard");
		const isActive = s.currentTrack ? sameTrack(s.currentTrack, track) : false;
		const hasPeaks = (track.peaks?.length ?? 0) > 0 && (track.peaks?.[0]?.length ?? 0) > 0;
		const isPlayingThis = isActive && s.isPlaying;
		const isBufferingThis = isActive && s.isBuffering;
		const showAction = faceSupportsAction("seaCard") && (actions?.length ?? 0) > 0;
		const handleToggle = () => {
			if (isActive) s.toggle();
			else s.playNow(track);
		};
		const cardArt = resolveMedia({
			media: artMedia,
			legacyCss: art
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: `ap-sea${isActive ? " ap-sea--active" : ""}${className ? ` ${className}` : ""}`,
			style: {
				...buildThemeVars(theme),
				...style
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-sea__art",
					style: cardArt.cssBackground ? { backgroundImage: cardArt.cssBackground } : void 0,
					children: [
						cardArt.media && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackgroundMedia, {
							media: cardArt.media,
							className: "ap-sea__bg"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ap-btn ap-btn--play ap-sea__play ap-tap",
							onClick: handleToggle,
							"aria-label": isBufferingThis ? "Buffering audio" : isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`,
							children: isBufferingThis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon$1, {}) : isPlayingThis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon$1, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon$1, {})
						}),
						tag && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ap-sea__tag",
							children: tag
						}),
						isActive && hasPeaks && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ap-icon-btn ap-tap ap-sea__wave-btn",
							onClick: surface.toggleCanvas,
							"aria-label": surface.isCanvasOpen ? "Hide waveform" : "Show waveform",
							"aria-expanded": surface.isCanvasOpen,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveIcon, {})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-sea__body",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ap-sea__head",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ap-sea__meta",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ap-sea__title",
								title: formatVersionedTitle(track.title, track.versionLabel),
								style: titleFont,
								children: [formatVersionedTitle(track.title, track.versionLabel), track.explicit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplicitBadge, {})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "ap-sea__artist",
								title: formatSecondaryLine(track),
								style: artistFont,
								children: formatSecondaryLine(track)
							})]
						}), showAction && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArcActionButton, {
							actions,
							ariaLabel: `Actions for ${track.title}`,
							className: "ap-sea__action"
						})]
					}), isActive && !surface.isCanvasOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ap-sea__progress",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrubberCanvasHost, {
							face: "seaCard",
							density: getScrubberDensity("seaCard"),
							currentTime: s.currentTime,
							duration: s.duration,
							progress: s.duration > 0 ? s.currentTime / s.duration : 0,
							onSeek: s.seek,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
								currentTime: s.currentTime,
								duration: s.duration,
								buffered: s.buffered,
								disabled: !s.hasAudio,
								isSeeking: s.isSeeking,
								onSeek: s.seek,
								onSeekStart: () => s.setSeeking(true),
								onSeekEnd: () => s.setSeeking(false)
							})
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SEICanvasHost, {
					open: surface.isCanvasOpen,
					face: "seaCard",
					supported: isActive && surface.canvasSupported,
					activeSurfaceId: surface.mode === "default" ? void 0 : surface.mode,
					children: surface.isCanvasOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ap-sea__overlay",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerHero, {
							face: "seaCard",
							collapsed: false,
							title: track.title ?? "",
							artist: track.artist ?? "",
							album: track.albumTitle,
							featuredArtists: track.featuredArtists,
							versionLabel: track.versionLabel,
							explicit: track.explicit,
							releaseTitle: track.releaseTitle,
							subtitle: track.subtitle,
							marquee: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformAdapter, {
							face: "seaCard",
							density: getScrubberDensity("seaCard"),
							currentTime: s.currentTime,
							duration: s.duration,
							buffered: s.buffered,
							disabled: !s.hasAudio,
							isSeeking: s.isSeeking,
							onSeek: s.seek,
							onSeekStart: () => s.setSeeking(true),
							onSeekEnd: () => s.setSeeking(false),
							peaks: track.peaks,
							peaksDuration: track.waveformDuration,
							getDecodedData: s.getDecodedData,
							url: s.getBackendInfo().active === "html5" ? s.currentSrc : void 0,
							sourceKey: trackKey(track)
						})]
					})
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/narrative/useNarrativeAudio.ts
	function clamp01(value) {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(1, value));
	}
	/**
	* Headless orchestrator for the Narrative face. It layers three audio sources
	* over existing SAP primitives without changing engine behavior:
	*
	* - **Narration / voice** → the shared global session (`useAudioSession`). The
	*   current session track is the narration; play/pause/mute/volume all route to
	*   it, so any other SAP face stays in sync.
	* - **Ambience loop + FX** → a private `AudioSpriteEngine`. The `ambientProfile`
	*   names a looping clip in `ambienceManifest`; `fxClip` is an optional extra
	*   layer.
	*
	* Behaviors it wires for story playback:
	* - **Ducking** — while narration plays, ambience fades to
	*   `ambienceVolume * (1 - duckAmount)` (scaled by `intensity`), and restores on
	*   pause.
	* - **Crossfade** — when `sceneMood`/`ambientProfile` changes, the old ambience
	*   instance fades out (and stops) while the new clip fades in.
	*
	* With no `ambienceManifest`, ambience is inert and the face is a narration-only
	* transport. The reader app feeds scene metadata in via the options; the UI does
	* not need to change.
	*/
	function useNarrativeAudio(options = {}) {
		const { sceneMood, ambientProfile, fxClip, fxLoop = false, ambienceManifest, narrationState, intensity = 1, ambienceVolume: ambienceVolumeProp = .6, narrationVolume: narrationVolumeProp, duckAmount = .6, crossfadeMs = 1200 } = options;
		const session = useAudioSession();
		const engineRef = (0, react.useRef)(null);
		const ambienceIdRef = (0, react.useRef)(null);
		const fxIdRef = (0, react.useRef)(null);
		const loadedSrcRef = (0, react.useRef)(null);
		const [ambienceVolume, setAmbienceVolumeState] = (0, react.useState)(clamp01(ambienceVolumeProp));
		(0, react.useEffect)(() => {
			setAmbienceVolumeState(clamp01(ambienceVolumeProp));
		}, [ambienceVolumeProp]);
		const getEngine = (0, react.useCallback)(() => {
			if (!engineRef.current) engineRef.current = createAudioSpriteEngine();
			return engineRef.current;
		}, []);
		const targetAmbience = clamp01(ambienceVolume * clamp01(intensity));
		const isNarrating = narrationState === "playing" || narrationState === void 0 && session.isPlaying;
		const duckedAmbience = clamp01(targetAmbience * (1 - clamp01(duckAmount) * clamp01(intensity)));
		const liveAmbienceTarget = isNarrating ? duckedAmbience : targetAmbience;
		(0, react.useEffect)(() => {
			const src = ambienceManifest?.src?.trim();
			if (!src) {
				const engine = engineRef.current;
				if (engine) {
					if (ambienceIdRef.current) engine.fadeOut(ambienceIdRef.current, crossfadeMs);
					if (fxIdRef.current) engine.stop(fxIdRef.current);
				}
				ambienceIdRef.current = null;
				fxIdRef.current = null;
				loadedSrcRef.current = null;
				return;
			}
			const engine = getEngine();
			let cancelled = false;
			const run = async () => {
				if (loadedSrcRef.current !== src) {
					loadedSrcRef.current = src;
					try {
						await engine.load(ambienceManifest);
					} catch {
						loadedSrcRef.current = null;
						return;
					}
				} else await engine.ready();
				if (cancelled) return;
				engine.setMasterVolume(1);
				if (ambientProfile) {
					const previous = ambienceIdRef.current;
					const next = engine.play(ambientProfile, {
						loop: true,
						volume: 0
					});
					if (next) {
						ambienceIdRef.current = next;
						engine.fade(next, liveAmbienceTarget, crossfadeMs);
					} else ambienceIdRef.current = null;
					if (previous) engine.fadeOut(previous, crossfadeMs);
				} else if (ambienceIdRef.current) {
					engine.fadeOut(ambienceIdRef.current, crossfadeMs);
					ambienceIdRef.current = null;
				}
				if (fxIdRef.current) {
					engine.stop(fxIdRef.current);
					fxIdRef.current = null;
				}
				if (fxClip) fxIdRef.current = engine.play(fxClip, {
					loop: fxLoop,
					volume: liveAmbienceTarget
				});
			};
			run();
			return () => {
				cancelled = true;
			};
		}, [
			ambienceManifest?.src,
			ambientProfile,
			sceneMood,
			fxClip,
			fxLoop
		]);
		(0, react.useEffect)(() => {
			const engine = engineRef.current;
			if (!engine) return;
			if (ambienceIdRef.current) engine.fade(ambienceIdRef.current, liveAmbienceTarget, 350);
			if (fxIdRef.current) engine.fade(fxIdRef.current, liveAmbienceTarget, 350);
		}, [liveAmbienceTarget]);
		(0, react.useEffect)(() => {
			if (narrationVolumeProp === void 0) return;
			session.setVolume(clamp01(narrationVolumeProp));
		}, [narrationVolumeProp, session]);
		(0, react.useEffect)(() => {
			return () => {
				engineRef.current?.dispose();
				engineRef.current = null;
				ambienceIdRef.current = null;
				fxIdRef.current = null;
			};
		}, []);
		const setAmbienceVolume = (0, react.useCallback)((value) => {
			setAmbienceVolumeState(clamp01(value));
		}, []);
		const setNarrationVolume = (0, react.useCallback)((value) => session.setVolume(clamp01(value)), [session]);
		const hasAmbience = Boolean(ambienceManifest?.src?.trim()) && Boolean(ambientProfile);
		const indicatorState = isNarrating ? "narrating" : hasAmbience ? "ambient" : "silent";
		return {
			isPlaying: session.isPlaying,
			isMuted: session.isMuted,
			hasNarration: session.hasAudio,
			hasAmbience,
			mood: sceneMood,
			indicatorState,
			ambienceVolume,
			narrationVolume: session.volume,
			togglePlay: session.toggle,
			toggleMute: session.toggleMute,
			setAmbienceVolume,
			setNarrationVolume
		};
	}
	//#endregion
	//#region src/audio-player/skins/NarrativeFace.tsx
	/**
	* A "faceless" SAP control surface for story/reader apps. It keeps the full SAP
	* audio engine underneath — narration on the shared session, ambience/FX on the
	* sprite layer (see {@link useNarrativeAudio}) — but presents only story-native
	* controls: a soundscape indicator, play/pause, mute, and ambience + narration
	* volume, with an optional expand/settings affordance.
	*
	* It deliberately renders none of the music-player chrome (no album art,
	* artwork, shuffle, repeat, queue, or waveform), per its `narrative`-family
	* capability declaration. Pass `embedded` to pin it as a tiny bottom overlay in
	* a reader. Scene metadata (`sceneMood`, `ambientProfile`, `intensity`, …) is
	* accepted as props so a host like the Light Novels app can feed scenes in
	* without the UI changing.
	*/
	function NarrativeFace({ chapterId, sceneMood, ambientProfile, fxClip, fxLoop, ambienceManifest, narrationState, intensity, ambienceVolume, narrationVolume, duckAmount, crossfadeMs, embedded = false, showExpand = false, onExpand, className, style, ...theme }) {
		const session = useAudioSession();
		const narrative = useNarrativeAudio({
			chapterId,
			sceneMood,
			ambientProfile,
			fxClip,
			fxLoop,
			ambienceManifest,
			narrationState,
			intensity,
			ambienceVolume,
			narrationVolume,
			duckAmount,
			crossfadeMs
		});
		const handleAmbienceChange = (0, react.useCallback)((e) => {
			narrative.setAmbienceVolume(Number(e.target.value) / 100);
		}, [narrative]);
		const showSpinner = session.isBuffering;
		const moodLabel = narrative.mood ?? "Ambience";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `ap-nf${embedded ? " ap-nf--embedded" : ""} ap-nf--${narrative.indicatorState}${className ? ` ${className}` : ""}`,
			style: {
				...buildThemeVars(theme),
				...style
			},
			role: "region",
			"aria-label": "Narration audio",
			"data-chapter-id": chapterId,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-nf__scape",
					title: `Soundscape: ${moodLabel}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-nf__dot",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-nf__mood",
						children: moodLabel
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `ap-btn ap-btn--play ap-nf__play ap-tap${narrative.isPlaying ? " ap-btn--play-active" : ""}`,
					onClick: narrative.togglePlay,
					disabled: !narrative.hasNarration,
					"aria-label": showSpinner ? "Buffering narration" : narrative.isPlaying ? "Pause narration" : "Play narration",
					children: showSpinner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpinnerIcon$1, {}) : narrative.isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseIcon$1, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayIcon$1, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ap-nf__vol ap-nf__vol--narration",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-nf__vol-label",
						"aria-hidden": "true",
						children: "Voice"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeControl, {
						volume: narrative.narrationVolume,
						isMuted: narrative.isMuted,
						disabled: !narrative.hasNarration,
						volumeUnsupported: session.volumeUnsupported,
						onVolumeChange: narrative.setNarrationVolume,
						onToggleMute: narrative.toggleMute
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "ap-nf__vol ap-nf__vol--ambience",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ap-nf__vol-label",
						children: "Ambience"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "ap-nf__range",
						type: "range",
						min: 0,
						max: 100,
						value: Math.round(narrative.ambienceVolume * 100),
						disabled: !narrative.hasAmbience,
						onChange: handleAmbienceChange,
						"aria-label": "Ambience volume"
					})]
				}),
				showExpand && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ap-icon-btn ap-nf__expand ap-tap",
					onClick: onExpand,
					"aria-label": "Soundscape settings",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DotsIcon$1, {})
				})
			]
		});
	}
	//#endregion
	//#region src/audio-player/plugins/registry/usePluginRegistry.tsx
	var availablePlugins = [
		{
			id: "keyboard-shortcuts",
			label: "Keyboard Shortcuts",
			description: "Space/J/K/L/N/P keyboard controls scoped to the player root. Conflicts with the player's built-in key handler are suppressed.",
			factory: () => createKeyboardShortcutPlugin({
				name: "registry-keyboard-shortcuts",
				enablePlaylistKeys: true
			}),
			defaultActive: true,
			category: "playback"
		},
		{
			id: "analytics",
			label: "Analytics",
			description: "Emits play/pause/seek/stop events to a callback or endpoint. Default: console.table output -- no network traffic.",
			factory: () => createAnalyticsPlugin({
				name: "registry-analytics",
				includeTimeUpdates: false,
				send: (event) => {
					if (typeof console !== "undefined") console.table([{
						type: event.type,
						track: event.track?.title ?? "(none)",
						position: event.position.toFixed(1),
						duration: event.duration.toFixed(1)
					}]);
				}
			}),
			defaultActive: false,
			category: "analytics"
		},
		{
			id: "lyrics",
			label: "Lyrics Sync",
			description: "Displays LRC-style lyrics synced to playback time. Comes with a sample lyric set so the effect is visible immediately.",
			factory: () => createLyricsPlugin({
				name: "registry-lyrics",
				lyrics: SAMPLE_LYRICS,
				onLineChange: (line) => {
					if (typeof document !== "undefined") {
						const el = document.getElementById("registry-lyrics-line");
						if (el) el.textContent = line?.text ?? "";
					}
				}
			}),
			defaultActive: false,
			category: "ui"
		},
		{
			id: "sleep-timer",
			label: "Sleep Timer",
			description: "Adds a sleep-timer dropdown to the player root. Supports 15/30/45/60-minute counts and end-of-track.",
			factory: () => createSleepTimerPlugin({ name: "registry-sleep-timer" }),
			defaultActive: false,
			category: "ui"
		},
		{
			id: "automix",
			label: "Automix",
			description: "Beat/BPM-aware crossfades between playlist tracks, with automatic light-mode fallback (silence-based trims) when analysis is unavailable or low-confidence. No setup required.",
			factory: () => createAutomixPlugin({ name: "registry-automix" }),
			defaultActive: false,
			category: "playback"
		},
		{
			id: "auto-theme",
			label: "Auto Theme",
			description: "Derives the player's accent, progress gradient, background tint, text contrast, and ambient glow from the album artwork.",
			factory: () => createAutoThemePlugin({ name: "registry-auto-theme" }),
			defaultActive: false,
			category: "ui"
		},
		{
			id: "waveform",
			label: "Waveform",
			description: "Replaces the progress bar with an interactive wavesurfer waveform on players that support it. Adds a Show Waveform toggle in the player's options.",
			factory: () => createWaveformPlugin({ name: "registry-waveform" }),
			defaultActive: false,
			category: "ui"
		}
	];
	var SAMPLE_LYRICS = [
		"[00:00.00]Plugin registry ready",
		"[00:04.00]Browse available plugins",
		"[00:08.00]Install what you need",
		"[00:12.00]Toggle them on and off",
		"[00:16.00]Watch playback stay smooth"
	].join("\n");
	var PluginRegistryContext = (0, react.createContext)(null);
	/**
	* Wraps children with a plugin registry context.
	* Tracks which plugins are installed and which are active.
	* Exposes `activeInstances` – a stable array of `AudioPlayerPlugin` objects
	* that can be passed directly into `<AudioPlayer plugins={...} />`.
	*
	* The provider only materialises instances for **active** plugins, so an
	* installed-but-inactive plugin does not consume slots in the player.
	*/
	function PluginRegistryProvider({ children }) {
		const [installed, setInstalled] = (0, react.useState)(() => availablePlugins.filter((e) => e.defaultActive).map((entry) => ({
			entry,
			active: entry.defaultActive
		})));
		const revRef = (0, react.useRef)(0);
		const install = (0, react.useCallback)((id) => {
			const entry = availablePlugins.find((e) => e.id === id);
			if (!entry) return;
			setInstalled((prev) => {
				if (prev.some((r) => r.entry.id === id)) return prev;
				revRef.current++;
				return [...prev, {
					entry,
					active: entry.defaultActive
				}];
			});
		}, []);
		const uninstall = (0, react.useCallback)((id) => {
			setInstalled((prev) => {
				const next = prev.filter((r) => r.entry.id !== id);
				if (next.length === prev.length) return prev;
				revRef.current++;
				return next;
			});
		}, []);
		const activate = (0, react.useCallback)((id) => {
			revRef.current++;
			setInstalled((prev) => prev.map((r) => r.entry.id === id && !r.active ? {
				...r,
				active: true
			} : r));
		}, []);
		const deactivate = (0, react.useCallback)((id) => {
			revRef.current++;
			setInstalled((prev) => prev.map((r) => r.entry.id === id && r.active ? {
				...r,
				active: false
			} : r));
		}, []);
		const toggleActive = (0, react.useCallback)((id) => {
			revRef.current++;
			setInstalled((prev) => prev.map((r) => r.entry.id === id ? {
				...r,
				active: !r.active
			} : r));
		}, []);
		const activeInstances = (0, react.useMemo)(() => {
			return installed.filter((r) => r.active).map((r) => r.entry.factory());
		}, [installed, revRef.current]);
		const snapshot = (0, react.useMemo)(() => ({
			available: availablePlugins,
			installed,
			install,
			uninstall,
			activate,
			deactivate,
			toggleActive,
			activeInstances
		}), [
			installed,
			install,
			uninstall,
			activate,
			deactivate,
			toggleActive,
			activeInstances
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginRegistryContext.Provider, {
			value: snapshot,
			children
		});
	}
	/**
	* Access the plugin registry from any component within a
	* `<PluginRegistryProvider>`. Returns the full registry snapshot including
	* `activeInstances` which can be spread into an `<AudioPlayer>`.
	*/
	function usePluginRegistry() {
		const ctx = (0, react.useContext)(PluginRegistryContext);
		if (ctx === null) throw new Error("usePluginRegistry must be used within a <PluginRegistryProvider>");
		return ctx;
	}
	/**
	* Returns the current `activeInstances` array from the registry.
	* This is a thin wrapper around `usePluginRegistry()` for convenience.
	*/
	function useActivePluginInstances() {
		const { activeInstances } = usePluginRegistry();
		const prev = (0, react.useRef)(activeInstances);
		const [stable, setStable] = (0, react.useState)(activeInstances);
		(0, react.useEffect)(() => {
			const a = prev.current;
			const b = activeInstances;
			if (a.length !== b.length || a.some((plugin, i) => plugin !== b[i])) {
				prev.current = b;
				setStable(b);
			}
		}, [activeInstances]);
		return stable;
	}
	//#endregion
	//#region src/audio-player/plugins/registry/PluginManagerPanel.tsx
	/**
	* A plugin registry UI panel that lets users browse available plugins,
	* install/uninstall them, and toggle active/inactive state.
	*
	* Designed to be rendered inside a `<PluginRegistryProvider>`.
	*/
	function PluginManagerPanel() {
		const { available, installed, install, uninstall, toggleActive, activeInstances } = usePluginRegistry();
		const installedIds = new Set(installed.map((r) => r.entry.id));
		const availableButNotInstalled = available.filter((e) => !installedIds.has(e.id));
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lab-plugin-manager",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lab-plugin-manager__head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "lab-plugin-manager__title",
					children: "Plugin Registry"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "lab-plugin-manager__badge",
					children: [
						activeInstances.length,
						" / ",
						installed.length,
						" active"
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lab-plugin-manager__body",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginListSection, {
					title: "Available",
					count: availableButNotInstalled.length,
					emptyLabel: "All plugins are installed.",
					children: availableButNotInstalled.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginCard, {
						entry,
						action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "lab-plugin-card__btn lab-plugin-card__btn--install",
							onClick: () => install(entry.id),
							"aria-label": `Install ${entry.label}`,
							children: "Install"
						})
					}, entry.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginListSection, {
					title: "Installed",
					count: installed.length,
					emptyLabel: "No plugins installed yet.",
					children: installed.map((record) => {
						const active = record.active;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginCard, {
							entry: record.entry,
							active,
							action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `lab-plugin-card__btn${active ? " lab-plugin-card__btn--active" : " lab-plugin-card__btn--inactive"}`,
								onClick: () => toggleActive(record.entry.id),
								"aria-label": `${active ? "Deactivate" : "Activate"} ${record.entry.label}`,
								children: active ? "Active" : "Inactive"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "lab-plugin-card__btn lab-plugin-card__btn--uninstall",
								onClick: () => uninstall(record.entry.id),
								"aria-label": `Uninstall ${record.entry.label}`,
								children: "×"
							})] })
						}, record.entry.id);
					})
				})]
			})]
		});
	}
	function PluginListSection({ title, count, emptyLabel, children }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lab-plugin-manager__section",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lab-plugin-manager__section-head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "lab-plugin-manager__section-title",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "lab-plugin-manager__section-count",
					children: count
				})]
			}), count === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "lab-plugin-manager__empty",
				children: emptyLabel
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lab-plugin-manager__list",
				children
			})]
		});
	}
	function PluginCard({ entry, active, action }) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `lab-plugin-card${active ? " lab-plugin-card--active" : ""}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lab-plugin-card__body",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lab-plugin-card__head",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "lab-plugin-card__label",
						children: entry.label
					}), entry.category && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "lab-plugin-card__category",
						children: entry.category
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "lab-plugin-card__desc",
					children: entry.description
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lab-plugin-card__actions",
				children: action
			})]
		});
	}
	//#endregion
	//#region src/audio-player/diagnostics/ActivityLogProvider.tsx
	/**
	* ActivityLogProvider — React context provider for the Activity Log.
	*
	* Mount this near the root of your player tree to make the Activity Log
	* available through `useActivityLog()`. The provider creates a single store
	* at mount time that lasts the lifetime of the component; it clears on
	* unmount (provider is torn down) but NOT on session reset unless you
	* manually call `clear()`.
	*
	* Usage:
	* ```tsx
	* <ActivityLogProvider>
	*   <AudioSessionProvider>
	*     <App />
	*   </AudioSessionProvider>
	* </ActivityLogProvider>
	* ```
	*/
	function ActivityLogProvider({ children, config }) {
		const storeRef = (0, react.useRef)(null);
		if (storeRef.current === null) storeRef.current = createActivityLogStore(config);
		const api = (0, react.useMemo)(() => storeRef.current, []);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityLogContext.Provider, {
			value: api,
			children
		});
	}
	//#endregion
	//#region src/audio-player/diagnostics/useActivityLogRecording.ts
	/**
	* useActivityLogRecording — wires lifecycle recording into an activity log
	* context. Designed to be used inside AudioSessionProvider (or any other
	* component that wants to automatically log player lifecycle events).
	*
	* Records events for:
	* - Play/pause transitions
	* - Track changes
	* - Errors
	* - Volume changes above threshold
	* - Session lifecycle (queue changes, repeat/shuffle toggles)
	*
	* Usage:
	* ```tsx
	* useActivityLogRecording(engine, currentTrack, repeatMode, shuffle)
	* ```
	*
	* This is fully optional — the activity log works without it, and callers
	* can always record manually with `log.record(...)`.
	*/
	/**
	* Automatically records common lifecycle events to the activity log. Safe to
	* call from any component; does nothing if no ActivityLogProvider is mounted.
	*
	* Designed for use inside AudioSessionProvider or a skin component.
	*/
	function useActivityLogRecording({ engine, currentTrack, repeatMode, shuffle, trackLabel }) {
		const log = useOptionalActivityLog();
		const prevPlayingRef = (0, react.useRef)(engine.isPlaying);
		const prevTrackKeyRef = (0, react.useRef)(null);
		const prevVolumeRef = (0, react.useRef)(engine.volume);
		const prevMutedRef = (0, react.useRef)(engine.isMuted);
		(0, react.useEffect)(() => {
			if (!log) return;
			if (prevPlayingRef.current === engine.isPlaying) return;
			prevPlayingRef.current = engine.isPlaying;
			if (engine.isPlaying) log.record({
				area: "playback",
				status: "info",
				message: trackLabel ? `Playback started — ${trackLabel}` : "Playback started",
				details: currentTrack ? {
					title: currentTrack.title,
					artist: currentTrack.artist
				} : void 0
			});
			else log.record({
				area: "playback",
				status: "info",
				message: "Playback paused"
			});
		}, [
			engine.isPlaying,
			log,
			currentTrack,
			trackLabel
		]);
		(0, react.useEffect)(() => {
			if (!log || !currentTrack) return;
			const key = currentTrack.id ?? `${currentTrack.title}:${currentTrack.artist}`;
			if (prevTrackKeyRef.current === key) return;
			prevTrackKeyRef.current = key;
			log.record({
				area: "playback",
				status: "info",
				message: `Now playing: ${currentTrack.title}`,
				details: {
					title: currentTrack.title,
					artist: currentTrack.artist,
					duration: engine.duration
				}
			});
		}, [
			currentTrack,
			engine.duration,
			log
		]);
		(0, react.useEffect)(() => {
			if (!log || !engine.hasError) return;
			log.record({
				area: "playback",
				status: "error",
				message: engine.errorMessage || "Playback error",
				details: currentTrack ? {
					title: currentTrack.title,
					artist: currentTrack.artist
				} : void 0
			});
		}, [
			engine.hasError,
			engine.errorMessage,
			log,
			currentTrack
		]);
		(0, react.useEffect)(() => {
			if (!log) return;
			const prevVol = prevVolumeRef.current;
			const prevMuted = prevMutedRef.current;
			prevVolumeRef.current = engine.volume;
			prevMutedRef.current = engine.isMuted;
			if (engine.isMuted && !prevMuted) log.record({
				area: "playback",
				status: "warn",
				message: "Audio muted"
			});
			else if (!engine.isMuted && prevMuted) log.record({
				area: "playback",
				status: "info",
				message: `Audio unmuted — volume ${Math.round(engine.volume * 100)}%`
			});
			else if (!engine.isMuted) {
				if (Math.abs(engine.volume - prevVol) > .05) log.record({
					area: "playback",
					status: "info",
					message: `Volume changed to ${Math.round(engine.volume * 100)}%`
				});
			}
		}, [
			engine.volume,
			engine.isMuted,
			log
		]);
		const prevRepeatRef = (0, react.useRef)(repeatMode);
		const prevShuffleRef = (0, react.useRef)(shuffle);
		(0, react.useEffect)(() => {
			if (!log) return;
			if (prevRepeatRef.current !== repeatMode) {
				prevRepeatRef.current = repeatMode;
				log.record({
					area: "session",
					status: "info",
					message: `Repeat mode: ${repeatMode}`
				});
			}
		}, [repeatMode, log]);
		(0, react.useEffect)(() => {
			if (!log) return;
			if (prevShuffleRef.current !== shuffle) {
				prevShuffleRef.current = shuffle;
				log.record({
					area: "session",
					status: "info",
					message: shuffle ? "Shuffle enabled" : "Shuffle disabled"
				});
			}
		}, [shuffle, log]);
	}
	//#endregion
	//#region src/audio-player/plugins/surfaces/pluginSurfaceHelpers.ts
	/** True when the plugin exposes a (enabled) settings surface. */
	function hasSettingsSurface(definition) {
		if (definition.kind !== "settings" && definition.kind !== "dual") return false;
		return definition.settings?.enabled === true;
	}
	/** True when the plugin exposes a (enabled) SEI Canvas surface. */
	function hasCanvasSurface(definition) {
		if (definition.kind !== "canvas" && definition.kind !== "dual") return false;
		return definition.canvas?.enabled === true;
	}
	/** True when the plugin renders no UI at all. */
	function isHeadlessPlugin(definition) {
		return definition.kind === "headless";
	}
	/** The declarative settings route, when the plugin has an enabled settings surface. */
	function getPluginSettingsRoute(definition) {
		return hasSettingsSurface(definition) ? definition.settings?.route : void 0;
	}
	/** The SEI Canvas surface id, when the plugin has an enabled canvas surface. */
	function getPluginCanvasSurfaceId(definition) {
		return hasCanvasSurface(definition) ? definition.canvas?.surfaceId : void 0;
	}
	/**
	* Return a new array sorted by menu order (ascending), tie-broken by pluginId.
	* Stable and non-mutating — the input array is left untouched.
	*/
	function sortPluginSurfaceDefinitions(definitions) {
		return [...definitions].sort((a, b) => {
			const orderA = a.menu?.order ?? Number.MAX_SAFE_INTEGER;
			const orderB = b.menu?.order ?? Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.pluginId.localeCompare(b.pluginId);
		});
	}
	//#endregion
	//#region src/audio-player/plugins/surfaces/defaultPluginSurfaces.ts
	var DEFAULT_PLUGIN_SURFACES = [
		{
			pluginId: "keyboard-shortcuts",
			label: "Keyboard Shortcuts",
			description: "Space / arrow / JKL transport controls.",
			category: "utility",
			kind: "headless"
		},
		{
			pluginId: "analytics",
			label: "Analytics",
			description: "Playback event reporting.",
			category: "analytics",
			kind: "settings",
			settings: {
				enabled: true,
				route: "plugin-settings:analytics",
				label: "Analytics"
			},
			menu: {
				branch: "plugin:analytics",
				order: 40
			}
		},
		{
			pluginId: "lyrics",
			label: "Lyrics",
			description: "Synced lyrics — primary UI lives in SEI Canvas.",
			category: "visual",
			kind: "dual",
			settings: {
				enabled: true,
				route: "plugin-settings:lyrics",
				label: "Lyrics"
			},
			canvas: {
				enabled: true,
				surfaceId: "lyrics",
				label: "Lyrics",
				requiresActiveTrack: true,
				preferredHeight: "standard"
			},
			menu: {
				showInArc: true,
				branch: "plugin:visual",
				order: 10
			}
		},
		{
			pluginId: "sleep-timer",
			label: "Sleep Timer",
			description: "Auto-stop after a chosen duration.",
			category: "utility",
			kind: "settings",
			settings: {
				enabled: true,
				route: "plugin-settings:sleep-timer",
				label: "Sleep Timer"
			},
			menu: {
				branch: "playback",
				order: 30
			}
		},
		{
			pluginId: "automix",
			label: "Automix",
			description: "Beat-aware crossfades between tracks.",
			category: "playback",
			kind: "settings",
			settings: {
				enabled: true,
				route: "playback:automix",
				label: "Automix"
			},
			menu: {
				branch: "playback",
				order: 20
			}
		},
		{
			pluginId: "auto-theme",
			label: "Auto Theme",
			description: "Derives player colors from album art.",
			category: "visual",
			kind: "settings",
			settings: {
				enabled: true,
				route: "plugin-settings:auto-theme",
				label: "Auto Theme"
			},
			menu: {
				branch: "plugin:visual",
				order: 50
			}
		},
		{
			pluginId: "waveform",
			label: "Waveform",
			description: "Interactive waveform scrubber (no SEI Canvas surface yet).",
			category: "visual",
			kind: "settings",
			settings: {
				enabled: true,
				route: "plugin-settings:waveform",
				label: "Waveform"
			},
			menu: {
				branch: "plugin:visual",
				order: 60
			}
		}
	];
	/** Look up a single plugin's surface definition by its plugin id. */
	function getPluginSurfaceDefinition(pluginId) {
		return DEFAULT_PLUGIN_SURFACES.find((def) => def.pluginId === pluginId);
	}
	/** All surface definitions in a given category, sorted by menu order. */
	function getPluginSurfaceDefinitionsByCategory(category) {
		return sortPluginSurfaceDefinitions(DEFAULT_PLUGIN_SURFACES.filter((def) => def.category === category));
	}
	/** All surface definitions whose menu placement targets a given branch, sorted. */
	function getPluginSurfaceDefinitionsForMenuBranch(branch) {
		return sortPluginSurfaceDefinitions(DEFAULT_PLUGIN_SURFACES.filter((def) => def.menu?.branch === branch));
	}
	//#endregion
	//#region src/audio-player/properties/propertyRegistry.ts
	/**
	* The shared property model. Every editable property is declared here exactly
	* once with its group, control, default, and per-face applicability. Faces and
	* the Properties panel both read this registry, so a property added here becomes
	* available everywhere a face opts into it — no per-face wiring.
	*
	* Defaults mirror the historical in-code defaults (the SEI theme + OG typography
	* the workshop has always shipped) so nothing shifts when the panel switches to
	* reading this registry.
	*/
	var TITLE_FONT_DEFAULT = {
		fontSize: "24px",
		fontWeight: 600,
		letterSpacing: "-0.02em",
		lineHeight: "1.2em"
	};
	var ARTIST_FONT_DEFAULT = {
		fontSize: "15px",
		fontWeight: 500,
		letterSpacing: "-0.01em",
		lineHeight: "1.3em"
	};
	/** Faces that render a full-bleed background layer. */
	var BACKGROUND_FACES = ["portable", "fullCard"];
	/** Faces that render a dedicated artwork/cover block. */
	var ART_FACES = [
		"fullCard",
		"seaCard",
		"miniSidebar"
	];
	/** Major full-size faces sharing the core typography + media property set. */
	var MAJOR_FACES = [
		"portable",
		"fullCard",
		"seaCard"
	];
	/** Faces that surface a volume control. */
	var VOLUME_FACES = [
		"portable",
		"fullCard",
		"stickyBottom"
	];
	var PROPERTY_GROUPS = [
		"content",
		"appearance",
		"playback",
		"advanced"
	];
	/** Human labels for the four sections, used by the panel headers. */
	var PROPERTY_GROUP_LABELS = {
		content: "Content",
		appearance: "Appearance",
		playback: "Playback",
		advanced: "Advanced"
	};
	var PROPERTY_REGISTRY = [
		{
			id: "backgroundMedia",
			label: "Background",
			description: "Full-bleed image or video behind the player.",
			group: "content",
			control: {
				kind: "media",
				role: "background"
			},
			propPath: "backgroundMedia",
			default: null,
			faces: BACKGROUND_FACES
		},
		{
			id: "artMedia",
			label: "Cover Art",
			description: "Image or video shown in the artwork block.",
			group: "content",
			control: {
				kind: "media",
				role: "art"
			},
			propPath: "artMedia",
			default: null,
			faces: ART_FACES
		},
		{
			id: "accentColor",
			label: "Button Color",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.accentColor",
			default: "#7C5CFF"
		},
		{
			id: "playIconColor",
			label: "Play Icon",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.playIconColor",
			default: "#0b0b12"
		},
		{
			id: "textColor",
			label: "Text",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.textColor",
			default: "#FFFFFF"
		},
		{
			id: "progressColor",
			label: "Progress",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.progressColor",
			default: "#7C5CFF"
		},
		{
			id: "trackColor",
			label: "Track",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.trackColor",
			default: "rgba(124,92,255,0.25)"
		},
		{
			id: "backgroundColor",
			label: "Surface",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.backgroundColor",
			default: "rgba(20,20,28,0.6)"
		},
		{
			id: "glowColor",
			label: "Glow Color",
			description: "Ambient glow color around the player root. Transparent disables it.",
			group: "appearance",
			control: { kind: "color" },
			propPath: "theme.glowColor",
			default: "transparent"
		},
		{
			id: "glowIntensity",
			label: "Glow",
			description: "Ambient glow strength. 0 turns the glow off regardless of Glow Color.",
			group: "appearance",
			control: {
				kind: "range",
				min: 0,
				max: 150,
				step: 5,
				unit: "%"
			},
			propPath: "theme.glowIntensity",
			default: 100
		},
		{
			id: "buttonOpacity",
			label: "Button Fill",
			description: "Translucency of button fills — lower is more see-through, higher is more solid.",
			group: "appearance",
			control: {
				kind: "range",
				min: -20,
				max: 40,
				step: 1,
				unit: "%"
			},
			propPath: "theme.buttonOpacity",
			default: 0
		},
		{
			id: "blurSize",
			label: "Blur",
			group: "appearance",
			control: {
				kind: "range",
				min: 0,
				max: 50,
				step: 1,
				unit: "px"
			},
			propPath: "blurSize",
			default: 20,
			faces: BACKGROUND_FACES
		},
		{
			id: "darkenAmount",
			label: "Darken",
			group: "appearance",
			control: {
				kind: "range",
				min: 0,
				max: 100,
				step: 1,
				unit: "%"
			},
			propPath: "darkenAmount",
			default: 45,
			faces: BACKGROUND_FACES
		},
		{
			id: "titleFont",
			label: "Title Font",
			group: "appearance",
			control: { kind: "font" },
			propPath: "titleFont",
			default: { ...TITLE_FONT_DEFAULT },
			faces: MAJOR_FACES
		},
		{
			id: "artistFont",
			label: "Artist Font",
			group: "appearance",
			control: { kind: "font" },
			propPath: "artistFont",
			default: { ...ARTIST_FONT_DEFAULT },
			faces: MAJOR_FACES
		},
		{
			id: "autoPlay",
			label: "Auto Play",
			group: "playback",
			control: { kind: "toggle" },
			propPath: "autoPlay",
			default: false
		},
		{
			id: "shuffle",
			label: "Shuffle",
			group: "playback",
			control: { kind: "toggle" },
			propPath: "shuffle",
			default: false
		},
		{
			id: "repeatMode",
			label: "Repeat",
			group: "playback",
			control: {
				kind: "select",
				options: [
					{
						value: "off",
						label: "Off"
					},
					{
						value: "all",
						label: "All"
					},
					{
						value: "one",
						label: "One"
					}
				]
			},
			propPath: "repeatMode",
			default: "off"
		},
		{
			id: "showVolume",
			label: "Show Volume",
			group: "playback",
			control: { kind: "toggle" },
			propPath: "showVolume",
			default: true,
			faces: VOLUME_FACES
		},
		{
			id: "showTracklist",
			label: "Show Tracklist",
			group: "playback",
			control: { kind: "toggle" },
			propPath: "showTracklist",
			default: true,
			faces: ["portable"]
		},
		{
			id: "showWaveform",
			label: "Show Waveform",
			group: "playback",
			control: { kind: "toggle" },
			propPath: "showWaveform",
			default: false,
			faces: ["portable"]
		},
		{
			id: "artCss",
			label: "Art (CSS)",
			description: "Raw CSS background-image escape hatch (gradient or url).",
			group: "advanced",
			control: {
				kind: "text",
				placeholder: "url(\"…\") or linear-gradient(…)"
			},
			propPath: "art",
			default: "",
			faces: ART_FACES
		}
	];
	/** All properties a face exposes, in registry order. */
	function getPropertiesForFace(face) {
		return PROPERTY_REGISTRY.filter((d) => !d.faces || d.faces.includes(face));
	}
	/** A face's properties within a single section. */
	function getPropertiesForGroup(face, group) {
		return getPropertiesForFace(face).filter((d) => d.group === group);
	}
	/** Set a value at a dotted `propPath`, returning a new object (immutable). */
	function setByPropPath(target, propPath, value) {
		const keys = propPath.split(".");
		const next = { ...target };
		let cursor = next;
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (key === "__proto__" || key === "constructor" || key === "prototype") return next;
			cursor[key] = { ...cursor[key] };
			cursor = cursor[key];
		}
		const lastKey = keys[keys.length - 1];
		if (lastKey === "__proto__" || lastKey === "constructor" || lastKey === "prototype") return next;
		cursor[lastKey] = value;
		return next;
	}
	/** Read a value at a dotted `propPath`. */
	function getByPropPath(target, propPath) {
		return propPath.split(".").reduce((acc, key) => acc == null ? void 0 : acc[key], target);
	}
	/**
	* A nested defaults object built from every descriptor's `default`, keyed by
	* `propPath`. Consumers (e.g. the workshop) spread this to seed their settings
	* so editor defaults always track the registry.
	*/
	function getPropertyDefaults() {
		let acc = {};
		for (const d of PROPERTY_REGISTRY) acc = setByPropPath(acc, d.propPath, d.default);
		return acc;
	}
	//#endregion
	exports.ARC_RADIUS = ARC_RADIUS;
	exports.AUTOMIX_FADE_MS = AUTOMIX_FADE_MS;
	exports.ActivityLogContext = ActivityLogContext;
	exports.ActivityLogPanel = ActivityLogPanel;
	exports.ActivityLogProvider = ActivityLogProvider;
	exports.ActivityLogWorkspace = ActivityLogWorkspace;
	exports.AgentQueueDirectorWorkspace = AgentQueueDirectorWorkspace;
	exports.AnalyticsPlugin = AnalyticsPlugin;
	exports.ArcActionButton = ArcActionButton;
	exports.AudioPlayer = AudioPlayer;
	exports.AudioSessionProvider = AudioSessionProvider;
	exports.AudioSpriteEngine = AudioSpriteEngine;
	exports.AutoThemePlugin = AutoThemePlugin;
	exports.AutomixPlugin = AutomixPlugin;
	exports.BUILTIN_VISUAL_COMPONENTS = BUILTIN_VISUAL_COMPONENTS;
	exports.BackgroundMedia = BackgroundMedia;
	exports.ControllerPanelRenderer = ControllerPanelRenderer;
	exports.CueManifestPlugin = CueManifestPlugin;
	exports.CueRuntime = CueRuntime;
	exports.DEFAULT_ACTIVITY_LOG_CONFIG = DEFAULT_ACTIVITY_LOG_CONFIG;
	exports.DEFAULT_PLUGIN_SURFACES = DEFAULT_PLUGIN_SURFACES;
	exports.DefaultPluginErrorHandler = DefaultPluginErrorHandler;
	exports.ExplicitBadge = ExplicitBadge;
	exports.FAMILY_DEFAULTS = FAMILY_DEFAULTS;
	exports.FullCardPlayer = FullCardPlayer;
	exports.GracefulDegradation = GracefulDegradation;
	exports.HTML5AudioBackend = HTML5AudioBackend;
	exports.INITIAL_SURFACE_STATE = INITIAL_SURFACE_STATE;
	exports.KeyboardShortcutPlugin = KeyboardShortcutPlugin;
	exports.LYRIC_DISPLAY_ID = LYRIC_DISPLAY_ID;
	exports.LibraryPlaylistsWorkspace = LibraryPlaylistsWorkspace;
	exports.LibraryQueueWorkspace = LibraryQueueWorkspace;
	exports.LyricDisplay = LyricDisplay;
	exports.LyricSettingsPanel = LyricSettingsPanel;
	exports.LyricsPlugin = LyricsPlugin;
	exports.MAJOR_FACES = MAJOR_FACES;
	exports.MiniSidebarPlayer = MiniSidebarPlayer;
	exports.NarrativeFace = NarrativeFace;
	exports.PLAYER_FACE_CAPABILITIES = PLAYER_FACE_CAPABILITIES;
	exports.PROPERTY_GROUPS = PROPERTY_GROUPS;
	exports.PROPERTY_GROUP_LABELS = PROPERTY_GROUP_LABELS;
	exports.PROPERTY_REGISTRY = PROPERTY_REGISTRY;
	exports.PRO_CONFIDENCE_MIN = PRO_CONFIDENCE_MIN;
	exports.PlaybackAutomixWorkspace = PlaybackAutomixWorkspace;
	exports.PlayerHero = PlayerHero;
	exports.PlayerSurfaceButtons = PlayerSurfaceButtons;
	exports.PluginError = PluginError;
	exports.PluginErrorBoundary = PluginErrorBoundary;
	exports.PluginErrorBoundaryFactory = PluginErrorBoundaryFactory;
	exports.PluginManager = PluginManager;
	exports.PluginManagerPanel = PluginManagerPanel;
	exports.PluginRegistryProvider = PluginRegistryProvider;
	exports.PluginSettingsWorkspace = PluginSettingsWorkspace;
	exports.ProgressBar = ProgressBar;
	exports.QueueDrawer = QueueDrawer;
	exports.QueueSurface = QueueSurface;
	exports.SAPController = SAPController;
	exports.SEICanvasActionMenu = SEICanvasActionMenu;
	exports.SEICanvasHost = SEICanvasHost;
	exports.SEICanvasRenderer = SEICanvasRenderer;
	exports.ScrubberCanvasHost = ScrubberCanvasHost;
	exports.ScrubberCanvasRenderer = ScrubberCanvasRenderer;
	exports.SeaCardPlayer = SeaCardPlayer;
	exports.SleepTimerPlugin = SleepTimerPlugin;
	exports.StickyBottomPlayer = StickyBottomPlayer;
	exports.SurfaceButton = SurfaceButton;
	exports.TextMarquee = TextMarquee;
	exports.TrackMetadata = TrackMetadata;
	exports.VAULT_CATEGORY_META = VAULT_CATEGORY_META;
	exports.VaultRowPlayer = VaultRowPlayer;
	exports.VisualLyricsWorkspace = VisualLyricsWorkspace;
	exports.VisualSlotPicker = VisualSlotPicker;
	exports.VisualSlotsProvider = VisualSlotsProvider;
	exports.VolumeControl = VolumeControl;
	exports.WORKSPACE_ROUTES = WORKSPACE_ROUTES;
	exports.WaveformAdapter = WaveformAdapter;
	exports.WaveformPlugin = WaveformPlugin;
	exports.WaveformProgress = WaveformProgress;
	exports.WebAudioBackend = WebAudioBackend;
	exports.WorkspaceShell = WorkspaceShell;
	exports.arcOffsets = arcOffsets;
	exports.bpmCompatibility = bpmCompatibility;
	exports.buildMenuTree = buildMenuTree;
	exports.canEnterCanvas = canEnterCanvas;
	exports.checkCodecSupport = checkCodecSupport;
	exports.clearCustomCategories = clearCustomCategories;
	exports.composeEventHandlers = composeEventHandlers;
	exports.computePeaksFromUrl = computePeaksFromUrl;
	exports.computeTransitionPoints = computeTransitionPoints;
	exports.contrastText = contrastText;
	exports.createActivityLogStore = createActivityLogStore;
	exports.createAnalyticsPlugin = createAnalyticsPlugin;
	exports.createAudioBackend = createAudioBackend;
	exports.createAudioSpriteEngine = createAudioSpriteEngine;
	exports.createAutoThemePlugin = createAutoThemePlugin;
	exports.createAutomixPlugin = createAutomixPlugin;
	exports.createCueManifestPlugin = createCueManifestPlugin;
	exports.createKeyboardShortcutPlugin = createKeyboardShortcutPlugin;
	exports.createLyricsPlugin = createLyricsPlugin;
	exports.createPluginErrorBoundary = createPluginErrorBoundary;
	exports.createSleepTimerPlugin = createSleepTimerPlugin;
	exports.createWaveformPlugin = createWaveformPlugin;
	exports.default = AudioPlayer;
	exports.defaultShowVolume = defaultShowVolume;
	exports.deriveHeroCollapsed = deriveHeroCollapsed;
	exports.deserializeSession = deserializeSession;
	exports.ensureMuted = ensureMuted;
	exports.ensureProTrackAnalysis = ensureProTrackAnalysis;
	exports.ensureTrackAnalysis = ensureTrackAnalysis;
	exports.extractPalette = extractPalette;
	exports.extractPeaks = extractPeaks;
	exports.faceSupportsAction = faceSupportsAction;
	exports.faceSupportsContextualActions = faceSupportsContextualActions;
	exports.faceSupportsHeroCollapse = faceSupportsHeroCollapse;
	exports.faceSupportsSEICanvas = faceSupportsSEICanvas;
	exports.faceSupportsScrubberCanvas = faceSupportsScrubberCanvas;
	exports.faceSupportsWaveform = faceSupportsWaveform;
	exports.formatFeatured = formatFeatured;
	exports.formatSecondaryLine = formatSecondaryLine;
	exports.formatTime = formatTime;
	exports.formatVersionedTitle = formatVersionedTitle;
	exports.getAllVaultCategories = getAllVaultCategories;
	exports.getAllVisualComponents = getAllVisualComponents;
	exports.getByPropPath = getByPropPath;
	exports.getDefaultComponentForSlot = getDefaultComponentForSlot;
	exports.getDisplayArtist = getDisplayArtist;
	exports.getDisplayTitle = getDisplayTitle;
	exports.getFaceCapability = getFaceCapability;
	exports.getFaceFamily = getFaceFamily;
	exports.getGlobalErrorBoundaryFactory = getGlobalErrorBoundaryFactory;
	exports.getPluginCanvasSurfaceId = getPluginCanvasSurfaceId;
	exports.getPluginSettingsRoute = getPluginSettingsRoute;
	exports.getPluginSurfaceDefinition = getPluginSurfaceDefinition;
	exports.getPluginSurfaceDefinitionsByCategory = getPluginSurfaceDefinitionsByCategory;
	exports.getPluginSurfaceDefinitionsForMenuBranch = getPluginSurfaceDefinitionsForMenuBranch;
	exports.getPreferredCanvasPlacement = getPreferredCanvasPlacement;
	exports.getPrimaryTrackSource = getPrimaryTrackSource;
	exports.getPropertiesForFace = getPropertiesForFace;
	exports.getPropertiesForGroup = getPropertiesForGroup;
	exports.getPropertyDefaults = getPropertyDefaults;
	exports.getScrubberDensity = getScrubberDensity;
	exports.getScrubberHeight = getScrubberHeight;
	exports.getTrackAnalysis = getTrackAnalysis;
	exports.getTrackSources = getTrackSources;
	exports.getTrackTrims = getTrackTrims;
	exports.getVaultCategoryMeta = getVaultCategoryMeta;
	exports.getVisualComponent = getVisualComponent;
	exports.getVisualComponentsForSlot = getVisualComponentsForSlot;
	exports.gradient = gradient;
	exports.hasCanvasSurface = hasCanvasSurface;
	exports.hasSettingsSurface = hasSettingsSurface;
	exports.isHeadlessPlugin = isHeadlessPlugin;
	exports.isIOS = isIOS;
	exports.isMobileDevice = isMobileDevice;
	exports.isNodeInteractive = isNodeInteractive;
	exports.isPluginError = isPluginError;
	exports.isSAPDefaultPrevented = isSAPDefaultPrevented;
	exports.isSessionEngine = isSessionEngine;
	exports.isWorkspaceRoute = isWorkspaceRoute;
	exports.lyricDefaultSettings = lyricDefaultSettings;
	exports.lyricDisplayDefinition = lyricDisplayDefinition;
	exports.mergeRefs = mergeRefs;
	exports.normalizeRhythmConfidence = normalizeRhythmConfidence;
	exports.parseWorkspaceRoute = parseWorkspaceRoute;
	exports.planTransition = planTransition;
	exports.quantizePixels = quantizePixels;
	exports.registerVaultCategory = registerVaultCategory;
	exports.registerVisualComponent = registerVisualComponent;
	exports.relativeLuminance = relativeLuminance;
	exports.resolveMedia = resolveMedia;
	exports.rgbToCss = rgbToCss;
	exports.serializeSession = serializeSession;
	exports.setByPropPath = setByPropPath;
	exports.setGlobalErrorHandler = setGlobalErrorHandler;
	exports.shouldEnableMarquee = shouldEnableMarquee;
	exports.snapToBeat = snapToBeat;
	exports.sortPluginSurfaceDefinitions = sortPluginSurfaceDefinitions;
	exports.surfaceReducer = surfaceReducer;
	exports.trackKey = trackKey;
	exports.trackSourcesSignature = trackSourcesSignature;
	exports.useActivePluginInstances = useActivePluginInstances;
	exports.useActivityLog = useActivityLog;
	exports.useActivityLogRecording = useActivityLogRecording;
	exports.useAudioPlayer = useAudioPlayer;
	exports.useAudioSession = useAudioSession;
	exports.useAutomix = useAutomix;
	exports.useMediaSessionObserver = useMediaSessionObserver;
	exports.useNarrativeAudio = useNarrativeAudio;
	exports.useNarrativeCueController = useNarrativeCueController;
	exports.usePlayerSurface = usePlayerSurface;
	exports.usePluginManager = usePluginManager;
	exports.usePluginRegistry = usePluginRegistry;
	exports.useReducedMotion = useReducedMotion;
	exports.useSAPPropGetters = useSAPPropGetters;
	exports.useShareTrack = useShareTrack;
	exports.useVisualSlots = useVisualSlots;
	exports.validateCueManifest = validateCueManifest;
	exports.validateTrackSource = validateTrackSource;
	exports.withErrorBoundary = withErrorBoundary;
});

//# sourceMappingURL=index.cjs.map