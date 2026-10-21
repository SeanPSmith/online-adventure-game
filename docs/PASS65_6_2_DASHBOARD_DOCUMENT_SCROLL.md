# Pass 65.6.2 — Inkbound dashboard document scrolling

## Problem

The real `/game` dashboard had replaced the old photographic book contents, but
remained nested inside `GameLayout` with `is-desk-home`. The legacy
`livingBook644.css` styles force the shell to `height: 100dvh` and
`overflow: hidden !important` and the `.game-main` to `overflow: hidden
!important`. Therefore the dashboard's beautifully spaced lower sections were
in the DOM but clipped beyond the first screen, especially on desktop.

## Change

The Inkbound dashboard stylesheet releases the legacy shell and main container
**only when `.inkbound-home` is actually mounted**, using the existing scoped
`body:has(.inkbound-home)` convention:

- The outer shell becomes content-height, with only a minimum viewport height.
- The main area expands with content and stops clipping vertical overflow.
- Normal browser/window scrolling works on desktop, tablet, and mobile.
- The old book workshop, adventure reader, modals, and their distinct overflow
  contracts are unchanged.
- No art, typography, color scheme, or gameplay logic is modified.

## Verification

Run the ordinary `./scripts/release-staging.sh` workflow (it invokes checks).
Manual smoke test: on `/game`, scroll past the panorama to Open Chapters, Hero
Hall, discovery and footer; repeat on Discover, Heroes, My Adventures, and Join
at common desktop/mobile viewport sizes. Verify themed dropdown menus and the
synopsis modal remain usable. The original book workshop should retain its own
scroll/height rules.
