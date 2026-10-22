# Pass 66.12 — Quillairo public homepage and authentication

## Scope

This is an incremental, functional React/CSS public-surface implementation following Pass 66.11.

- `/` — redesigned, responsive Quillairo homepage with editorial ink artwork, accurate product value proposition, genre examples, explanatory gameplay steps, interactive **labeled sample** story choices, and calls to action to the existing app.
- `/login` — manuscript login with working `useAuth().login`, password visibility, error display, preserved return path.
- `/register` — manuscript account registration with existing `useAuth().register`, required fields and existing password length rule, preserved return path.
- `/forgot-password` — matching recovery screen, explicitly states no reset request can be sent until backend recovery exists.
- Shared public header/footer, functioning small-screen menu, themed light and dark palettes, the approved Quillairo wordmark/monogram.

## Assets

The artwork is intentionally separate from the UI. `frontend/public/art/quillairo-public/{home-vista,living-worlds,auth-journey}.png` are source-derived artwork cutouts with **real RGBA alpha** and at least 7–10% transparent image-boundary clearance. `*-cover.webp` are intentionally rectangular framed editorial genre samples, not false-alpha illustrations.

The logo images are the previously approved original assets. Do not regenerate or recolor them. Dark account theme uses a separately approved monogram variant; the brand logo gold detail is not CSS-filtered.

## Honest functionality boundaries

- World-card titles are *genre illustrations*, **not claims of published playable adventures**. The actual catalog opens through `/game`.
- The sample-choice block is an **illustrative, local, no-cost interaction**, explicitly labeled as such; it is not a fake live Director session.
- There is no fake OAuth (Google/Apple) or fake password reset API. Authentication relies on existing backend auth services only.
- No gameplay implementation or authoring API is touched.

## Validation

- `pytest -q tests/auth tests/frontend/test_public_shell.py tests/frontend/test_pass66_8_quillairo_brand.py tests/frontend/test_pass66_12_public_site.py tests/multiplayer/test_invites.py` — 26 passed in the packaging environment.
- `node --test scripts/tests/turn-flow.cjs` — 16 passed.
- Changed TSX passes the global TypeScript parser and JSX syntax transform; CSS parses without syntax errors.
- The complete TypeScript/Vite build was **not completed** in the container, because npm modules were unavailable and the environment's Node 22.16 is older than the project's 22.22 minimum. The release script must perform the full build and regression suite on the user's Mac before any AWS deployment.
- Chromium automation was blocked by the container environment; desktop/mobile browser pixel verification is still required in staging. This is **not** a browser acceptance signoff.

## Deployment

Save this ZIP into `../assets/AWS/` and run from the project root:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_12_quillairo_public_home_auth.zip \
  && ./scripts/release-staging.sh "Pass 66.12: Quillairo homepage and auth"
```

If the release script fails, do not bypass it. Preserve the working previous release and share the error for a targeted fix.

## Visual acceptance / smoke checklist

- Desktop/mobile, all six themes: `/`, `/login`, `/register`, `/forgot-password`.
- One approved logo appears in header; no text/logo collisions; no horizontal scrolling; artwork clears the headline.
- Mobile navigation opens/closes; each CTA targets a real route; interactive sample choices update their illustrative feedback.
- Login and registration retain server auth and display validation errors; invite return path persists after sign-in.
- No broken image imports, transparent cutouts or native UI controls with unreadable colors.
