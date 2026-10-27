# Pass 66.45 — Quillairo Inkspace Atlas / Hero / Lobby

## Scope

Pure frontend presentation update after the Pass 66.44 production-shell cleanup. Based on the latest available full Quillairo repository review snapshot (October 23, 2026), plus the ordered Pass 66.18–66.44 overlays and guarded patches. **No AI Director, turn theater, HTTP or Socket.IO protocol, Hero mutation, Arcade, or server changes.**

- Keep the existing genuine catalog cover artwork and transparent illustration fallback. Present cards consistently without cropping, grayscale masks, or generated placeholder assets.
- Add a **single reusable Hero preview** to Atlas and preflight synopsis. Its name, level, health, and profile URL come from the existing `Character` object selected via the existing custom selector.
- Recompose the existing lobby into an editorial intro + artwork + synopsis + readiness section, while keeping room invitations, solo fallback, voice selection, `onBeginAdventure`, readiness and connected-state guards untouched.
- Preserve all six editions, keyboard focus, responsive design, and reduced motion.

## Install and validation

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_45_quillairo_atlas_lobby_folio.zip \
  && python3 scripts/pass66_45_apply.py --apply \
  && ./scripts/release-staging.sh
```

The overlay installer places the two **new scoped stylesheets**, an audited source patch, its guarded applicator, tests, and this document. The applicator modifies only `InkboundAuthenticatedDashboard.tsx` and `InkboundLobby.tsx`. Its `git apply --check` rejects mismatched source and creates backups. It is idempotent.

## Browser signoff

1. `/game` → Discover: explore desktop/mobile catalog, fallback images, search/filter, hero eligibility, focus and hover.
2. Change Hero in Discover. Confirm the new folio reflects the selected Hero's real name, health, and level; verify linked Hero sheet.
3. Open a synopsis; test Solo/Co-op, Hero selector, Cancel/Escape, disabled submit, and Enter Lobby.
4. Lobby: test solo Begin, co-op invite, readiness, Story Time toggle, reconnect status, and mobile width.
5. Run one complete adventure turn to verify that the styling pass did not affect dice, results, or story advancement.

No authenticated staging browser test was run as part of building this overlay. Full Mac build and live validation are release gates.
