# Quillairo Pass 66.37 — Account Settings Inkspace parity

Baseline: October 23 full repository review plus sequential overlays through Pass 66.36 R2.

## What changed
- Rebuilt the **existing Settings stylesheet** as one readable, responsive Inkspace folio rather than adding yet another override layer. Its 6 paper themes derive from the existing `--ib-*` tokens, with a muted gold accent per theme.
- Retained the **original** SettingsPage handlers for Web Push, email, SMS verification, volume, Story Time, narration, reading preferences and the user-facing paper editions.
- Styled the legacy Pass 64 Wardrobe **at source** (`wardrobe.css`, `themeWorkshop.css`), including included/installed themes, reader mode, Day/Night lighting, custom palette previews, JSON import/export and theme editor. No theme format or persistence changes.
- Restyled administrator-only global Story/Recap model selectors; both still persist through their existing API.
- Repaired anchor discovery for global AI models and Personal Editions; removed the old terminal notification copy and emoticon statuses.
- The **separate Notifications account tab** receives the same notification control styling.

## Scope and compatibility
No Director, dice, turn flow, Socket.IO, narration engines, account security, permission checks or backend changed. Existing class names are deliberately retained for their active consumers; this is a visual replacement of the styling, not a blind class migration. The legacy Classic/Book readers and optional Phosphor paper edition are untouched.

## Release validation
1. Run `python -m pytest -q tests/frontend/test_pass66_5_quillairo_settings.py tests/frontend/test_pass66_37_settings_inkspace_parity.py`.
2. Run `npm --prefix frontend run build` in your project environment and the regular `./scripts/release-staging.sh` gate.
3. Manually inspect Account → Preferences at 1440px, 768px and 390px in ivory and midnight, toggle Story Time/effects, preview narration, switch paper editions, save AI models (admin only), check push permissions and SMS verification, open Palette Studio and import/export a theme. Also check the separate Notifications tab.

No changes should be called a live-browser pass until these checks run against the deployed authenticated session.
