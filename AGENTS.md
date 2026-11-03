# Coding Agent Instructions

Read this file before making changes. These rules apply whenever you create or change any UI component, screen, or visual surface in this repository (SAP, the SEIHouse Audio Player).

## Design principles

### Mobile Viewport Architecture Rule (No Webpage Card Stacks)

Build every screen as a **viewport-locked native mobile app shell** (`100dvh`, `overflow: hidden`), **not** a scrolling web document.

- **Fixed safe-area bounds.** Reserve explicit, fixed safe-area space for the top header bar and the floating bottom navigation dock so content never clips behind them.
- **No card stacks.** Do not stack multiple outer rounded cards vertically down the page.
- **No box-in-a-box.** Do not nest boxed images inside padded card containers.
- **Full-bleed stage.** Use a full-bleed visual stage with translucent HUD overlays (`backdrop-filter: blur`).
- **Compact data rows.** Use compact left/right key-value rows for metadata and stats.
- **In-place panel switching.** Use segmented pill tabs to switch panels in place, so all features fit within a single non-scrolling mobile viewport.

If a feature seems to need more room than one viewport allows, move it into a tab or panel. Do not add page scroll.
