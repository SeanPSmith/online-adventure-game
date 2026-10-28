# Quillairo — Pass 66.48: Inkscape Live Composition

## Intent
Presentation-only visual refinement of the existing live adventure to better match the supplied approved Inkscape screenshots. **No faux book/desk UI.** No new visual system, engine, buttons, or artwork calls.

## Changed
- New scoped `quillairoInkscapeLivePass6648.css` styles the left folio, central manuscript, contextual scene art, labels, and server-authored choice cards.
- Guarded installer adds only a stylesheet import to the existing `InkboundLiveRoom.tsx`.
- Independent desktop scroll regions; small-screen layout remains readable; all six paper themes inherit current token values.

## Protected
No edits to Director, state machine, sockets, Arcade, authoritative dice, scenes, choice handlers, Hero progression, multiplayer, narration, finale sequencing, or backend. No art assets replaced. Existing CSS stays temporarily for safe compatibility.

## Verification
Run `python3 -m pytest -q tests/frontend/test_pass66_48_inkscape_live_presentation.py`; then full `./scripts/release-staging.sh`. Desktop/mobile visual signoff requires an authenticated live-browser comparison with original mockups. This pass does not claim pixel parity.

## Install
From `root/`, with the ZIP under `../assets/AWS/`:
```
bash scripts/install-overlay.sh ../assets/AWS/pass66_48_inkscape_live_composition.zip && python3 scripts/pass66_48_apply.py --apply && ./scripts/release-staging.sh
```
