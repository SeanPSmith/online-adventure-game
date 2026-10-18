# Pass 64.4B — Photographic Book Fidelity

## Scope
A presentation-only follow-up to Pass 64.4A. It does **not** replace any GameSocket action handlers, Hero IDs, adventure state, authentication flow, dice outcomes, narration, permissions, or persistent data. It is not a new 3D engine.

### Improvements
1. Cleaned and rebuilt Brighter World tabletop art to eliminate painted-in text and duplicate visual navigation.
2. Added a transparent, photographic edge overlay for the leather book, page stack, botanical spine and gutter (with all interior UI portions masked out).
3. Removed the old caption accidentally baked into the decorative watercolor vista.
4. Made missing Hero portraits read as deliberate watercolor placeholders with real character initials, never inventing Hero identities.
5. Updated the real DOM masthead, tab shadows, inset notes and art mounts to better match the approved watercolor reference.
6. Kept all artwork as bundled local files, with no injected HTML/CSS or network calls.
7. Kept reduced-motion and responsive mobile journal support; avoided expensive blur transitions on older graphics hardware.

### Deliberately not in scope
- New canonical Hero portrait data, AI image generation orchestration, cropped versions and billing/quota infrastructure; those require a separately reviewed backend system.
- Per-adventure cover image persistence (the catalog still uses genre-based fallback illustrations).
- Rebuilding Discover, Hero Hall, Author Portal, Admin and Adventure Reader pages.
- Modifying world-themed night/horror/sci-fi surfaces: photographic Brighter World assets are scoped to the day edition.

### Validation
Rendered *static layout fixtures* using actual CSS and images at 1600x900, 1440x900, 1280x800 and 390x844. No overflow on desktop and no horizontal overflow on mobile; the mobile layout intentionally scrolls. Static fixtures are not the live app and do not exercise real socket/auth traffic. Full `./scripts/check-project.sh` and real browser/gameplay review must run on the user's Mac before deploying.

### Installation
Download the ZIP into `OnlineAdventureGame/assets/AWS/`. From `OnlineAdventureGame/root`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4b-photographic-book.zip && ./scripts/check-project.sh
```

This is the existing standard overlay installer; it verifies copied bytes but does not perform source-version preflight or rollback backups. Commit or back up local work first. Do not deploy if checks fail.

### Recommended next production pass
**Portrait and Adventure Art Pipeline**: persistent artwork metadata with opt-in generation, approval, S3 versioned object assets, crop variants, image-size quotas and cost safeguards. Treat image assets as cosmetic presentation; authors control cover direction and individual Hero owners control their portraits. No gameplay advantage from art or paid themes.
