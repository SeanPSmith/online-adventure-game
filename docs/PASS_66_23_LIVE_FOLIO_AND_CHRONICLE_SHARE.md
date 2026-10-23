# Pass 66.23 — Live Folio Composition + Chronicle Share Fix

Based on the user's Quillairo visual references. The screenshots remain references,
not source assets; no baked UI, character portraits or fake turn outcomes.

- HistoryPage: restores exact `SHARE CHRONICLE` button label for existing sharing
  contract. Actual ShareMomentButton and archived narration remain untouched.
- New isolated theme-aware CSS makes the real Hero, party, journal and chat folio
  the left desktop column and the scrolling story the center/right column.
  Desktop >=1480px: three live choice cards; >=1100px: two; narrower: one.
- The independent story/folio scroll, existing mobile natural scrolling, theme
  variants and focus states are maintained. The server-driven intermission,
  dice/result overlays, next chapter handoff and image generator are unchanged.
- The visual reference's third-column turn-result narrative is not implemented
  as a fake result. A genuine persistent right outcome rail requires a separate
  integration pass with authoritative turn states and accessibility review.

To release, place overlay in `../assets/AWS/` then run the usual
`bash scripts/install-overlay.sh ../assets/AWS/pass66_23_quillairo_live_folio_and_share_fix.zip && ./scripts/release-staging.sh`.

Verify Chrome desktop 1920px, 1440px, mobile <=900px, all paper themes,
choice selection/locked state, Story Time, chat, hero, scene artwork, and share.
