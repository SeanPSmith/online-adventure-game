# Quillairo Inkscape / Pass 66.58 — Public Polish and Launch Readiness

The **nine approved Oct 23 artwork/UI references** remain the acceptance standard. This pass preserves the original brand assets and existing ink/watercolor compositions. No blanket texture, color filter, glowing effect, substitute illustration or gameplay CSS is introduced.

## Verified source fixes

- Public mobile MENU can be dismissed with Escape and returns keyboard focus to its toggle; location changes also close it.
- A link labeled `FEEDBACK // OFFLINE` no longer appears on the public site. A configured feedback email continues to work as before.
- Router error UI returns signed-out visitors to the public homepage, not a protected game location; logged-in visitors can still return to Adventure Hall.
- On narrow screens, overly tiny metadata and choice text are increased, sample choice controls have 44px targets, and at 375px or below the crowded pillars and five-step strip become one readable column.
- Existing brand/public imagery and all live player/game components are unchanged.

## Static readiness inventory

Run `python3 scripts/audit-inkscape-launch-readiness.py --strict-source` for a read-only report. This is now called automatically by `scripts/check-project.sh`, which runs before the Python suite and deployment. `--json` provides structured results. It checks source contracts and actual PNG headers/dimensions, **not rendered visual correctness**.

**Known PUBLIC LAUNCH BLOCKER:** `/forgot-password` explicitly says the password reset service is not connected. This was already the project's state. The 66.58 installer intentionally does not change authentication, email, or account recovery. Staging can still be deployed; do not declare public launch ready until secure password recovery is implemented and manually verified.

## Manual QA required before launch

Use actual staging in desktop (1440×900), tablet (768×1024) and mobile (390×844, 375×812, 320×568). Compare at thumbnail scale and full resolution with the nine approved references. Capture screenshots as evidence. Verify:

1. `/` illustrations, first focal point, reading order, world card images, real catalogue link and interactive sample disclaimer.
2. `/login`, `/register`, `/forgot-password` readable errors and fields, show-password control, and keyboard navigation; **block launch for unavailable recovery**.
3. Public MENU open/close, Escape return focus, legal links and configured feedback option at 320/375px. Ensure no horizontal overflow.
4. `/game`, Hero Hall, creation and character sheet, `/game/adventures`, `/game/history`, reader and result panel with live real data.
5. `/author` and `/admin` with authorized accounts; account permissions, save/review behavior and rendering, including dark themes.
6. Full gameplay cycle: choice DC/odds → intermission → dice roll → result → next chapter. **No changes** to generation/recovery/dice logic were made by this pass.
7. Keyboard focus, screen-reader reading order, reduced motion, adequate text contrast across all six paper themes.

**Honest sign-off:** source tests passing is not desktop/mobile approval. An authenticated staging playtest and actual screenshots are still outstanding.
