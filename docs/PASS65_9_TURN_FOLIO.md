# Pass 65.9 — The Turn Folio

## Scope
This incremental pass replaces the live Inkbound turn-result **presentation**, not its mechanics. `TurnResolutionTheater` renders a standalone, genuinely transparent inline-SVG D20 drawing instead of terminal ASCII when the Inkbound reader is active. The displayed final roll, check breakdown, XP/HP/level effects, death, and continuation come exclusively from the existing committed server receipt. Intermediate dice faces are **cosmetic only** and never constitute a new check.

The classic reader keeps its original ASCII result. The result manuscript and intermission outer shell use the six inherited Paper & Ink themes with responsive spacing, stable overflow, and reduced-motion support. Arcade games retain their own existing boards and canvas code; only the surrounding layout changes.

## Source paths
- `frontend/src/features/adventure/TurnResolutionTheater.tsx`
- `frontend/src/features/adventure/TurnTheater.tsx`
- `frontend/src/pages/game/AdventurePage.tsx`
- `frontend/src/pages/game/inkboundTurnPass659.css`
- `tests/frontend/test_pass65_9_inkbound_turn_folio.py`

## Tests
Focused source tests plus earlier turn-flow and import contracts. Browser renders of the actual result component with a representative authoritative-receipt fixture, in six themes at 1440px and 390px, checked for JavaScript errors and overflow. This isolated rendering does **not** replace full production TypeScript/Vite or real co-op integration testing.

## Install & release (after Pass 65.8.2)
From the project root, after placing the overlay in `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass65_9_inkbound_turn_folio.zip && ./scripts/release-staging.sh 'Pass 65.9: Inkbound turn folio'
```

A failing local check halts release before Git/AWS. Mid-deployment AWS rollback is not guaranteed by the existing scripts.
