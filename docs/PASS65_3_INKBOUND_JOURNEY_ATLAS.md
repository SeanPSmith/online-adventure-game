# Pass 65.3 — Inkbound Journey Atlas

## Intent

The approved wide transparent panorama remains the chapter/frontispiece asset.
This pass makes `/dev/inkbound` a browsable design atlas rather than replacing
working live routes ahead of art approvals.

## Screens

- Frontispiece (existing alpha-art composition)
- Story/choices (existing preview, now links to dice turn sequence)
- Personal dashboard (reads authenticated socket `adventures` + `catalog`; **no writes**)
- Hero Hall (reads authenticated `listCharacters`; **no writes**)
- Dice → intermission → illustrative outcome (explicitly non-authoritative)
- Arcade design index (illustrative; open actual Arcade through a link)
- Existing manuscript utilities (Journal, Character, Notes, Party, Chat, Inventory, Settings)

## Themes and typography

Four curated page modes: ivory, parchment, slate, midnight. Typography uses
progressively loaded IM Fell English, Special Elite and Caveat (web served) with
macOS/Windows system fallbacks. A production pre-launch pass should verify the
font domain is allowed by the serving CSP and consider approved local hosting.

## Compositing contract

Illustrations are independent transparent RGBA PNGs with clear alpha margins.
The page/paper background and all live text remain separate. Absolutely no
white/black mattes, rectangular feather masks, or baked UI screenshots.
The alpha-art asset and base artwork from prior passes are unchanged here;
new mockup outputs should be incorporated only once approved individually.

## Scope / critical safety

- `/dev/inkbound` is protected behind authentication AND `DevLabGate`.
- Dashboard and Hero screens read real user data and link to real game routes.
- The turn sequence is a preview: values and progression are illustrative and
  never written to authoritative game state.
- Actual AdventurePage, intermission logic, existing Arcade games and backend
  APIs are unchanged. Future integration will be deliberate and contract-tested.
- Prior simple opacity transitions remain in the real reader (no restored ink-mask swaps).

## Verification

Focused Python regressions and isolated browser screenshots were exercised on
1440×960 desktop and 390×844 mobile without JS page errors or horizontal
scrolling. They use an offline React 16 static rendering harness and stubbed
account data; the authoritative TypeScript/Vite production build and deployed
visual inspection still run on the user's machine through release-staging.sh.
