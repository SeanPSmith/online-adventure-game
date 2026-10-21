# Pass 65.6 — Inkbound production dashboard

## Scope

The authenticated `/game` homepage now uses `InkboundAuthenticatedDashboard`.
Unlike the protected `/dev/inkbound` design workshop, this is a **live view**:
it receives the existing socket-backed room directory/adventure catalog, actual
Hero roster, account identity, room connection status and live errors from
`GameHomePage`. No fake account records appear in production.

### Preserved functionality

- Continue or recover active adventures through existing room/character routes.
- Browse/filter real catalog titles, metadata and tags.
- Choose an eligible Hero; busy, deceased, buried and retired Heroes cannot
  be selected to create or join a new adventure.
- Read a synopsis; select solo or co-op; create the room using the existing
  `createRoom(characterId, adventureId, playMode)` callback. The existing
  `lastRoomEntry` handler navigates the player to the real lobby. This action
  does **not** generate Chapter One before readiness.
- Join existing room with a valid six-character code using `joinRoom`.
- Hero sheets, graveyard, adventure archive, Arcade, Rulebook, account,
  author/admin links and logout retain their original destinations.
- Errors are surfaced instead of swallowed.

### Visual contract

- Original approved RGBA `north-road-editorial.png` (safe alpha margins),
  not a screenshot crop, rectangular background, edge fade or image mask.
- White / cool gray, ivory / cream, tan parchment, and midnight / light-ink
  surfaces; saved per user in the browser (not a server-side world preference).
- Plain opacity/normal transitions only; reduced-motion honored.
- No overlaid marginal scribbles that fight with body text or buttons.
- Catalog cover thumbnails are intentionally rectangular *book covers*, not
  floating artwork. Future world-specific masthead art must be delivered as
  separate genuine-alpha assets and built as world-specific templates, not
  inferred by cropping the supplied reference screenshots.

### Release and rollback

Place overlay ZIP in `../assets/AWS/`, from project root:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass65_6_inkbound_real_dashboard.zip && \
./scripts/release-staging.sh "Pass 65.6: Inkbound real authenticated dashboard"
```

The release script runs the full project verification suite **before** Git
commit/push and AWS deployment. Preflight failure aborts deployment. It does
NOT guarantee automatic rollback if an AWS deployment has already begun.

This release deliberately does not change the adventure reader, dice rolls,
Director, Arcade games, or any backend server-owned gameplay facts.

## Verification limits

Focused Python regression tests and syntax checks passed in the sandbox. An
isolated React visual fixture rendered at 1440px, 850px and 390px without JS
page errors or horizontal overflow; the fixture uses representative data and a
limited legacy hook shim, **not** the production React 19+ environment. This
harness cannot verify all modal/game-socket interactions. The full production
TypeScript/Vite build and authenticated real-phone co-op smoke test must run on
the user's Mac/staging before claiming launch readiness.
