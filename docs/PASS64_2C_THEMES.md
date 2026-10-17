# Tales of Two — Pass 64.2c Skin Workshop and Book Navigation

## Player experience

- Account > Preferences > Wardrobe: original three library editions preserved, with **six new included theme packs** (three Library, three Reader).
- **Skin Workshop**: choose Library or Reader, name the edition, adjust eight constrained palette colors, choose a material, inspect a live local preview, and install and equip immediately.
- **Install JSON**: import a theme-manifest file, **not** a JavaScript/CSS ZIP; select the newly installed theme to equip it.
- **Export**: download JSON for any theme (included or locally created) for backup or sharing.
- **Reader behavior**: adventure author's world theme remains the default. An explicitly equipped Reader theme overrides its presentation only. The **plain, high-legibility Reader always wins**.
- **Book navigation**: a short decorative flip appears between non-live library pages, never around ongoing Adventure Room components. Honors OS reduced-motion and the in-game preference.
- **Performance**: less top padding on desktop, no giant blurred drop-shadow filter, shorter hover transitions and no hover transforms on touch.

## Theme safety contract

Only `tales-of-two-theme/v1` JSON is accepted. The strict schema is in `frontend/src/features/appearance/themePacks.ts`.
- `id`: lower-case slug of 3–40 characters.
- `name`: 3–48 plain-text characters.
- `target`: `library` or `reader`.
- `material`: `parchment`, `linen`, `velvet`, or `metal`.
- `palette`: exactly eight `#RRGGBB` values: `paper`, `ink`, `muted`, `leather`, `accent`, `accentText`, `frame`, `desk`.
- At least 4.5:1 contrast for ink/paper, muted/paper and accentText/accent.
- File must be <=16 KiB, at most 24 locally imported packs per account in the browser; no extra keys, images, CSS or external URLs allowed.

Example: `docs/themes/my-field-journal.example.json`. Upload via Wardrobe > Install JSON. No command-line import needed.

Local packs are saved under a **user-scoped browser storage key**, are not synchronized, and confer **no entitlement or token value**. Use Export to retain a copy.

## Monetization later (NOT enabled in this pass)

When users can buy skins with tokens, introduce server-owned entitlements and an immutable, versioned catalog. The client MUST verify ownership with the backend, not localStorage. Seller-submitted packs require moderation, content validation, a reviewed static asset pipeline with checksums, license/attribution metadata, and policy for public sharing. Do not accept arbitrary external CSS or JS.

Author-selected world skins currently resolve only known/allowlisted world themes. Extending authors' publishing to use packaged world skins should be a separate backend/schema pass; locally installed player packs cannot be advertised as published world skins.

## Tests and deployment

From `OnlineAdventureGame/root` after applying the standard overlay:

```bash
./scripts/check-project.sh
```

For focused theme data tests (already tested before packaging):

```bash
node --experimental-strip-types scripts/pass64/test-theme-packs.mjs
```

The full project production build and functional smoke tests must run on the user's complete checkout. A static snapshot alone cannot certify device performance or correctness of every live route. No changes to AWS infrastructure or server gameplay authority are necessary.

## Rollback

Commit before installing, and use Git to restore files if necessary. `install-overlay.sh` checks archive safety and installed checksums but does **not** create backups or verify the previous source versions. Do not confuse successful installation with a gameplay/browser smoke test.
