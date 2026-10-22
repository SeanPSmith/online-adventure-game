# Quillairo — Brand Identity & Production Usage, v1.0

**Status:** Approved identity. This document governs how existing artwork is displayed; it does **not** authorize redesign of the logo.

**Positioning:** *A living storybook. A handcrafted world of ink, paper, imagination, and choice—quietly powered by AI.*

## Approved marks and usage

| Mark | Asset | Intended use |
|---|---|---|
| Primary hero wordmark | `frontend/public/brand/primary-light.png` | Landing hero, splash, large promotional composition |
| Approved pale-letter secondary | `frontend/public/brand/secondary-dark.png` | Navigation on dark e-ink themes and dark editorial surfaces |
| Q-and-quill monogram | `frontend/public/brand/monogram-ink.png` | Compact UI mark, badges, loading, chapter imprint |
| Gold-ring seal | `frontend/public/brand/seal-gold.png` | Prestige and chapter stamp applications, sparingly |
| Official dark-tile app icon | `frontend/public/brand/icon-512.png` | App icon basis; the dark square is intentional |
| Official Apple icon / favicon | `apple-touch-icon.png` / `favicon.ico` | Installed home-screen icon and browser tab |

The files suffixed `-original.png` are byte-for-byte copies of the approved uploaded logo artwork. Display versions are **transparent-boundary crops only**, without pixel retouching, recoloring, or reinterpretation. The gold **AI** belongs to the original image and must not be reproduced with generic HTML text.

## Light and dark surfaces

For ivory, cream and parchment use the approved dark-ink **primary** wordmark. For midnight blue, green phosphor, and midnight black use the approved pale-letter **secondary** lockup. This is a contrast accommodation using the **two approved supplied assets**, not a redraw. Never apply `filter: invert()` or a white overlay because that would remove the gold accent.

## Color tokens

See `frontend/public/brand/tokens.json` for machine-readable tokens. Gold `#a68145` is an **editorial accent**, not the universal button color. Six player-selectable e-ink themes keep their own readable text colors.

| Theme | Paper | Ink |
|---|---|---|
| Ivory | `#f7f3e9` | `#28251f` |
| Cream | `#eee7d9` | `#30291e` |
| Parchment | `#d9c6a4` | `#33271a` |
| Midnight blue | `#0b1725` | `#f4e9d6` |
| CRT green | `#06140c` | `#c6f9b1` |
| Midnight black | `#141516` | `#f5f6f3` |

## Clear space, composition and accessibility

- Reserve at least **half the visible monogram height** as clear space around brand marks.
- The desktop nav mark is normally **180–220px** wide. At mobile widths keep it **approximately 140–160px** wide and avoid surrounding clutter.
- Use image `alt` or an accessible label on the parent link, not redundant announcements.
- Do not stretch, tint, warp, rotate, put an outline around, or animate the lockups.
- Keep UI/navigation/body text as **real HTML**; branding artwork is an independent alpha PNG.
- The logo is a premium illustration, not a decorative texture. No random ink splatters across headings or controls.
- Serif headlines: Iowan/Baskerville/Palatino/Georgia-style fallback. Body text: readable literary serif. CRT mode uses restrained monospace in UI labels, with story paragraphs remaining readable.

## Asset application checklist

- [x] Metadata, web app manifest, favicon, Apple touch icon and app tile
- [x] Shared public/game/account headers
- [x] Real authenticated dashboard header
- [x] Started-adventure reader and pre-adventure lobby mastheads
- [x] Public landing hero and footer
- [x] Player-facing share/notification identity strings
- [x] Author Console display name
- [ ] Replace preview/lab-only decorative brand placements as those workshops are retired
- [ ] App Store submission art: confirm platform-specific size, legal text, and screenshots at release
- [ ] Email HTML template brand art: only after image hosting and email client behavior are validated

## Preservation boundary

This pass updates *branding and user-facing labels only*. Game identifiers, API routes, AWS resource names, stored legacy keys, gameplay roll logic, narration, creator progression, and database ownership are intentionally unchanged.
