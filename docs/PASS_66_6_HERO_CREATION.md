# Pass 66.6 — Quillairo Hero creation, biography & private portraits

## What this changes

`/game/heroes/new` becomes a real multi-stage manuscript-style character creator, not a static workshop preview. All stages are usable in the six Inkbound paper tones.

1. **Likeness:** open-ended species, gender/presentation, age, height, weight, physique, skin/markings, features, face, wardrobe, signature details.
2. **Nature:** three narrative questions produce a recommended **starting** allocation, independent of species, body size, and gender. Calling/archetype, origin, disposition, and motivation are player-editable.
3. **Abilities:** full adjustable canonical stats and skills with unchanged server point budgets. The player can reapply or overwrite the questionnaire's suggested distribution.
4. **Story:** optional server-backed AI biography based on chosen identity, stats and skills; explicitly editable, not autosaved. Manual biography works when the AI service is unavailable.
5. **Portraits:** save the server-validated Hero, then optionally commission up to **three** genuine RGBA ink portraits and choose a favorite. Images reside in the existing encrypted private S3 archive and are served only to the owning account. Selected portraits show on the Hero sheet.

## Production notes

- No new AWS resources/CDK mutation. Uses the already deployed `KOKORO_ARCHIVE_BUCKET`, with a separate `hero-portraits/` prefix. Optional `HERO_PORTRAIT_BUCKET` can point to dedicated private storage later. S3 API remains private.
- Uses existing `OPENAI_API_KEY` secret. Bio model defaults to `gpt-4.1-mini` (`HERO_BIO_MODEL` override). Image model defaults to `gpt-image-1` (`HERO_IMAGE_MODEL` override). A real provider call is made only after pressing the associated button.
- **Paid API calls:** strictly bounded to 3 image requests per saved Hero and by default 9 per account per UTC day (`HERO_PORTRAITS_DAILY_LIMIT`). Limits enforced transactionally in the database before provider dispatch; selecting a portrait closes generation for that Hero. Failed attempts stay reserved because a provider call may already have incurred cost. Clear user-facing errors are shown; the saved Hero is never lost.
- Verifies RGBA PNG with real transparent 8% all-side margins using the Python standard library (no Pillow dependency). Invalid images are **not** accepted/saved.
- `archetype` and `appearance` are optional backward-compatible additions to the Hero payload. Existing Hero/gameplay records deserialize unchanged. Combat/progression remains server authoritative. Bio text remains limited to 800 chars.
- Portrait images and generation status are in separate backend tables; character deletion performs best-effort S3 cleanup. Old Heroes without images continue working.
- User-selected character portrait is an illustration, not a likeness verification or photo import. The spec permits realistic humans, aliens, fantastical races and any body type.

## Smoke test after deploying

1. `/game/heroes/new` → create an ordinary human with personalized appearance; complete all questions and adjust attributes.
2. Generate bio, review text, change a sentence, create Hero. Check that manual bio works if the provider is unavailable.
3. Generate the first portrait; verify no opaque matte or image-edge cutoff against ivory and midnight backgrounds. Generate another, choose one; reload Hero sheet and confirm it persists.
4. Change themes in Account → Preferences, confirm the creation page and sheet retain contrast and scrolling on mobile.
5. Check the 3-per-Hero cap, daily cap, cross-account portrait authorization and private image URLs. Use a test account for paid API calls.

## Verification limitations

The local regression suite exercises store limits, authorization guards, payload roundtrips, frontend source contracts, and alpha safety. Actual OpenAI image generation and S3 writes can only be verified against staging and will incur usage costs. Full `tsc -b && vite build` and project-wide integration checks run in `release-staging.sh` on the user's Mac.
