# Tales of Two — Pass 64.4C: Ink on Paper

**Target baseline:** Pass 64.4B, after a successful staging deploy and project verification.
**Scope:** React `/game` Living Book shell only. No changes to authoritative gameplay, room events, narration, Author tools, Admin or AWS infrastructure.

## Art direction

Preserve the physical, photographic open book and the tabletop. The scenery, leather tabs, paper faces and binding never disappear during in-book navigation. Only the changing manuscript ink (real selectable React text, interactive images and controls) dissolves, then reappears. Visual treatment emphasizes stark ivory, quiet hairline dividers and illustrated artwork instead of dashboard rectangles. Graphical buttons use a local SVG ornament, with real text in the DOM.

## Implementation

- `GameHomePage.tsx` renders persistent `p644-pages` and two `p644-paper-leaf` elements, with a keyed child `p644-ink-layer` that alone handles page-content fade.
- In-place sections: Home, Journeys, Heroes, Discover, Wardrobe hub and More. The Wardrobe tab opens an in-book spread; its complete Workshop remains under Account as a deep tool.
- `livingBook644Ink.css` overrides card/panel styling inside the book only. Inputs, selection controls, focus rings and modals retain clear affordances. Desktop book is viewport-bounded; mobile remains a scrolling one-page journal.
- Visual buttons gain the local `p644-ink-button-ornament.svg`; no scripts or remote images are injected.
- Cover `<img>` tags receive meaningful `alt` descriptions, Hero-selection buttons have accessible names, and the current spread has a screen-reader status message. Decorative visuals remain non-interactive.
- Motion is opacity-only, short, non-blocking and reduced-motion-safe (no WebGL, page curl, blur or video).

## Scope boundary

This is **not** yet a global route-persistent application shell. It upgrades the `/game` Home/Library spreads; deeper Hero Sheet, full Wardrobe Workshop, Arcade, Reader and Author portal still have separate routes/components. A subsequent pass should provide a shared shell for more of those screens where appropriate, without remounting the live Adventure Reader during socket/Story Time activity.

Artwork currently includes fallbacks; persistence and generation of true Hero portraits, world and adventure art are still planned, not delivered here.

## Validation

Browser fixture checked at 1600×900, 1440×900, 1280×800 and 390×844. Desktop is bounded; mobile has no horizontal overflow. A browser DOM check confirms paper stays opaque and stationary while the ink transitions to opacity 0. The browser fixture uses illustrative data; the user must still build and run the full project checks on the real checkout, then compare live screenshots before release.

## Standard installation

Download the overlay ZIP to `OnlineAdventureGame/assets/AWS` then, from `OnlineAdventureGame/root`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4c-ink-on-paper.zip && ./scripts/check-project.sh
```

Do not deploy to AWS until these checks pass and the visual output has been reviewed. The standard installer overwrites matching files; commit/back up first.
