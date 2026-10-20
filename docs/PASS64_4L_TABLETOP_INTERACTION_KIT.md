# Tales of Two — Pass 64.4L — Floating Tabletop Interaction Kit

## Goal
Compare intentionally floating, functional game instruments with the earlier
physical-book-tab presentation. This is an **isolated React playground**, not a
redesign of the actual adventure screen.

## Try it

- New protected route: `/game/tabletop-kit` (requires sign-in).
- Old attached-tab baseline: `/game/inkspace-reader`.
- Existing `/game` and `/game/adventure/:roomId` are unchanged.
- Click **Character**, **Chat**, or **Journal** on the desk at left.
- Close the parchment dossier with the X, by selecting its active instrument,
  or by pressing Escape. Focus is returned to the selected tool on close.
- Switch Journal → Chat → Journal; the draft stays intact until leaving the route.
- Chat submit adds a **local preview** only, not a co-op message.
- Page Next/Previous and ink replay remain as the existing reader experiment.

## Visual rules

The physical desk/book artwork and top navigation stay still. Instrument icons
are actual DOM controls with illustrated CSS materials, not baked-in image text,
not fake leather tabs attached to a book, and not player-purchasable anchor
objects. The opened dossier is parchment-like but clearly a magical UI overlay.

**Tabletop theme architecture retained**:
1. Base desk/book plate (stable composition and lighting).
2. Baked table dressing (small stains, map remnants, shadows, leaves).
3. Independent alpha anchor-object assets (future cosmetic mix-and-match).

Floating UI instruments are a **fourth UI layer**, separate from purchasable
anchor-object decor and the changing ink/content layer. They should not be sold
as gameplay advantages.

## Safeguards

- No server writes, purchases, inventory, socket chat, dice, XP, Hero mutations,
  or state authority are introduced by this pass.
- Hero statistics are labeled as sample data.
- Draft messages and notes live only in React state; they are not persisted.
- Mobile uses a fixed accessible bottom instrument dock and content-sized sheet.
- Focus-visible and reduced-motion styles are included.
- The existing reader's physical-tab implementation remains available intact;
  it is not silently replaced.

## Standard installation

From `OnlineAdventureGame/root`, after saving ZIP in `../assets/AWS/`:

```sh
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4l-floating-tabletop-instruments.zip \
  && ./scripts/check-project.sh
```

Only after a full green local check, deploy:

```sh
./scripts/release-staging.sh "Pass 64.4L: Floating tabletop instruments and contextual dossiers"
```

## QA checklist

- Desktop 1600x900; laptop 1280x800; phone 390x844.
- Floating instruments are visually distinct from physical book tabs.
- All three open/close; input and notes preserve local state between modes.
- Escape closes; focus returns to instrument. Keyboard focus is visible.
- Compare `/game/tabletop-kit` with `/game/inkspace-reader`.
- No horizontal scroll, text collisions, invisible submit buttons, or errors.
- Existing adventure flows, tests, and CSS unaffected.
- Full React TypeScript build is mandatory before staging release.
