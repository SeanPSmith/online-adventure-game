# Pass 65.6.3 — Six paper and ink palettes

## Player request

The authenticated Inkbound dashboard supports exactly six curated appearances:
- White: cool white/light gray, graphite text
- Ivory: off-white, charcoal text
- Cream: warm pale cream (not tan parchment), deep brown text
- Midnight blue: navy paper, pale text
- Green phosphor: deep forest green, bright readable green text in tribute to the original terminal UI
- Midnight black: near-black paper, bright off-white text

## Settings location

Account → Preferences → Paper & ink. The previous small Paper & ink dropdown is removed from the dashboard header to preserve editorial whitespace. The footer provides a small link to the account preference section.

Each choice previews real text and a rule on its actual color. The setting is saved per user per browser in the existing `tot:inkbound:paper:${userId}` key. A previous `parchment` selection reads as `cream`. Ivory/midnight/chalk selections retain their existing keys and migrate without action. Preference changes sync between open tabs and mounted components.

The theme tokens apply to the **real authenticated /game dashboard** and all its interior tabs, custom Hero/world pickers and the synopsis dialog. They are ready to be consumed later by the story/Arcade reskin; this pass does not force the new theme onto the existing game reader or terminal authoring/admin pages.

## Safety

- No new backend requirements, DB migrations, or native `<select>` elements.
- The game's live Hero/room/creation handlers remain unchanged.
- No generated artwork or clipping masks. The existing approved transparent panorama is reused with a display filter for dark paper only.
- No layout rewrite; Pass 65.6.2 document scrolling retained.
- The appearance setting is local to a browser and the signed-in user, not yet synced across devices.
- CSS palettes meet >= 7:1 contrast for body copy (calculated).

## Tests

Focus tests: `python -m pytest -q tests/frontend/test_pass65_6_live_inkbound_home.py tests/frontend/test_pass65_6_1_select_contract.py tests/frontend/test_pass65_6_2_document_scroll.py tests/frontend/test_pass65_6_3_six_paper_ink_palettes.py`

The regular `release-staging.sh` runs all project checks, Git, and staging AWS deployment. Do not run standalone checks before release.

## Files

- `frontend/src/features/appearance/inkboundPaper.ts`
- `frontend/src/features/appearance/InkboundPaperPreferences.tsx`
- `frontend/src/features/appearance/inkboundPaperPreferences.css`
- `frontend/src/pages/account/AccountPage.tsx`
- `frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx`
- `frontend/src/pages/game/inkboundAuthenticatedDashboard.css`
- `tests/frontend/test_pass65_6_live_inkbound_home.py` (updated to protect the new six-theme contract)
- `tests/frontend/test_pass65_6_3_six_paper_ink_palettes.py`
