# Tales of Two — Pass 64.4K / Live Reader Bridge

## Scope & installation
This overlay includes the shared paginator and reader CSS required by 64.4J; the separate 64.4J playground route remains an independent optional installation. The existing `/game/adventure/:roomId` route is unchanged. `?reader=book` is an optional view preference, preserving `?hero=...` and other query parameters. A button in the standard AdventurePage enters the Living Book; EXIT BOOK VIEW returns to the standard AdventurePage without leaving/rejoining the room. It is not a new gameplay mode or alternate socket.

### Data ownership
`AdventurePage` continues to own the room socket, Story Director state, Hero, server messages, choice selection, selected-choice recovery, commit, lock countdown, QTE, death and level-up. The book receives ONLY already-authorized props and the exact existing select/lock/send callbacks. No fetch or socket emissions occur in the new view. Scene title/body/choices are verbatim live data. **No generic watercolor image is passed off as a current adventure scene**; scene-specific transparent illustrations will appear only after author/story art attachment is supported.

### Canonical room flow
Book view is available only when the saved room is restored, adventure started, chapter released, no pending micro-event, and the theater is idle. During Director generation, intermission, QTEs, death/level-up, or reconnection, the existing game UI remains the fallback. This should be refined in subsequent passes to bring those surfaces into the book safely, without bypassing server facts or hiding required controls.

### Reader
Both leaves use `paginateReader` in `inkspaceReaderPagination.ts` and `SCENE_COMPOSITING.contentSafeZones`. Paragraph splits preserve words and punctuation. Server choices live on an explicit final leaf; choosing is local visual selection; LOCK IN calls `AdventurePage.lockChoice()` which submits authoritatively. Images are real `<img>` only when provided and accompanied by descriptive `alt` text. Mask decoding precedes transitions. Reduced-motion users get a direct swap. The desk/spine/paper/nav remain static.

### Journals
Character = existing Hero data, Chat = existing room messages and authorized socket send handler, Notes = explicitly unsaved draft (no persistence claim). UI is compact, keyboard navigable, with visible focus rings.

## Approved future tabletop assets — three-layer environment
1. **Base plate**: clean photorealistic tabletop plus open book, stable camera, registered page geometry, baseline cast shadows. No UI/text and no baked removable collectible objects.
2. **Baked decoration**: non-interactive scatter/texture/ambient paper maps, foliage, wear. These are optional scenery and can remain physically part of the base image.
3. **Anchor props**: separately supplied transparent RGBA PNG (or alpha-capable WebP) images that visually belong to the same photographed world, composited **over** the base. Slots use registration coordinates relative to the stable scene plane, explicit z-order, shadow/light matching, click boundaries when needed, accessibility descriptions, and ownership/entitlement identifiers. Avoid painting anchor items back into the base. Each anchor can later be mixed, equipped, gifted/unlocked/purchased as cosmetics without changing gameplay.

Each theme describes a base plate, compatible decorations, permitted anchor slots/items, book/page materials, ink font palette and lighting. Player modes: Follow World / Use My Setup / Custom Mix. This pass records the contract only: it does not introduce an item shop, paid entitlements, new art assets, or production theme mixing.

## Mandatory acceptance on user's Mac
1. `bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4k-live-reader-bridge.zip && ./scripts/check-project.sh`
2. Verify standard adventure `/game/adventure/:roomId?hero=...` still works.
3. Enter Living Book and verify current scene title, exact text, actual choice labels and live Hero; page through to final choice.
4. Select a choice (no commit), then lock; confirm exactly one server submission, normal turn resolution, intermission, and next chapter.
5. Check chat sends through room handler once, no duplicate connection; leave/rejoin/reconnect and ensure standard UI fallback.
6. Desktop 1280×800 and 1600×900; mobile 390px. Inspect visible last page, no overflow; reduced motion.
7. Repeatedly navigate, rapidly switch pages, switch book/standard view; monitor for mask flicker.

**Do not deploy** unless full project checks pass and there are no gameplay regressions. Do not claim this pass fully ports the intermission, dice, Story Time controls or gameplay modals into the book. Those remain in the authoritative AdventurePage view.
