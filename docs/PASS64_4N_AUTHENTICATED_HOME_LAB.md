# Pass 64.4N — Authenticated Living Book Home Lab

## Why this pass exists
The approved Living Book visual prototypes and floating-instrument demos are valuable, but they do not yet prove the full signed-in product. Start migrating the actual authenticated user journeys into one unified design, one working screen at a time. Home comes first, the full adventure reader/room comes next.

## URL and scope
- `/game/home-lab` — authenticated, opt-in interactive Home built from the **existing** `GameHomePage` state, socket provider, and real Hero service. There is no mock API, no fake user, no independent socket, and no duplicate gameplay mutation path.
- `/game` — existing production Home unchanged by default (aside from adding a display:contents wrapper around its book and a prop default that evaluates false).
- `/game/adventure/:roomId` — existing authoritative adventure, unchanged.
- Other earlier visual labs are untouched.
- `RequireAuth` continues to protect the entire nested game route tree.

## Actual functionality represented by the new Home
- Logged-in account username (links to real account).
- Hero roster fetched from `/api/characters`; selected Hero uses existing state and enforces alive/active/not already occupied.
- Authenticated catalog and room list from the existing `GameSocketContext`; real connection and loading states.
- Active journey link with real room code, Hero ID, turn number, and Director recovery state.
- Recent active/completed stories; completed entries link to the My Adventures archive instead of assuming an active room remains.
- Real adventure synopsis and solo/co-op lobby entry via the existing Home modal and `createRoom` callback, never a local fake starter.
- Existing Home's Heroes, Journeys, Discover, Wardrobe, and System spreads remain accessible from live top navigation. These interior spreads and their join/leave/invite/search/catalog actions are inherited, not yet redesigned.
- No page artwork falsely claims to be a specific player's actual Hero portrait. Medallion initials are real Hero initials. Genre illustrations are current generic fallback assets.

## Key implementation decisions
1. `GameHomePage({homeLab?})` remains the sole source of authenticated Home state and side effects.
2. `InkspaceAuthenticatedHome.tsx` is **presentational** and accepts only current real data and callbacks. It may not import a socket, call a server mutation, or invent a data record.
3. `GameLayout` treats `/game/home-lab` as a bounded desktop book route with the same header suppression as `/game`.
4. `p64n-scene-plane` uses source-aligned CSS cover geometry (`177.6833vh` / `56.2799vw`), with the single flattened photographic scene as the physical base; the DOM writing and decorative transparent PNG artwork are separate.
5. Do not change authoritative game outcomes, room joins, invite security, or completion state.
6. Phone layout is an accessible scrolling journal, not a scaled-down 2-up desktop spread.
7. Tabletop art layers in the future: **base table**, **baked dressing**, **independent transparent alpha anchor objects**. No commerce in this pass.

## Known limitations / next passes
- This is the actual signed-in Home, **not** a complete replacement of the actual game room yet. AdventurePage still has loading, lobby, intermission, Arcade, co-op actions, reconnects, Hero death, XP, results, TTS, etc. Each has to be surfaced and verified in the Living Book reader before any main UI replacement.
- Existing Home's interior spreads use inherited styling; premium illuminated-manuscript polish is not yet complete.
- Generic genre art and letter medallions stand in for future persistent art assets. Do not claim player-specific image generation.
- The full Vite production build is run by the user on their Mac after overlay installation. The authoring runtime validates TSX syntax, focused contracts, and desktop/mobile static-layout browser proofs but does not have the project's npm dependency tree.

## QA / workflow
From `OnlineAdventureGame/root`, after backing up or committing changes, copy the ZIP to `../assets/AWS/` and run:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4n-authenticated-home-lab.zip && ./scripts/check-project.sh
```

Only after green checks:

```bash
./scripts/release-staging.sh "Pass 64.4N: Authenticated Living Book home and real data migration"
```

Open `/game/home-lab` after sign-in and verify two scenarios: a user with an active adventure and available Heroes, and an account with no Heroes / journeys. Check top navigation, Hero select disabled for occupied Heroes, resumed adventure code, synopsis modal, browse/search/filter, and Join a Friend. On mobile test the scrolling journal and horizontal nav.

## Acceptance boundary
Never advertise a pass as 'all the game page is migrated' until the real room functionality—lobby, chapter presentation, choices, authoritative rolls/results, progression, intermission games, TTS, co-op chat and invites, reconnect/retry, finale, death/XP—has been tested through the new UI. This pass is the first real authenticated Home screen in that process.
