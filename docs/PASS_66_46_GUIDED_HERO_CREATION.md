# Quillairo Pass 66.46 — Guided Hero Creation

This pass replaces the open-ended identity form and three-at-once personality form with a guided Inkspace flow.

- 4 appearance chapters covering 14 curated answer fields; Hero name remains editable.
- 8 magazine-style scenario questions, one at a time, with A/B/C/D/E responses.
- Personality results determine **suggested** attributes/skills through the existing rule/budget allocator. No ancestry, age, gender, or body-type stat penalties. The user can still adjust all points before creation.
- Personality traits are preserved in the existing bounded disposition field, so the AI biography and transparent portrait prompt receive them without changing the database schema.
- The existing 3-attempt private image generation pipeline is unchanged. A selected full-character illustration is displayed as large artwork plus a profile-sized CSS crop. **This is not two separate AI generations**; the PFP crop may require adjustment for individual poses. No additional image charge, quota, or S3 permission changes.
- Existing Hero Sheet and Hero Hall management, server-owned stat validation, save, biography, portrait selection, privacy, and old Hero records remain functional.

## Apply from root

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_46_quillairo_guided_hero_creation.zip \
&& python3 scripts/pass66_46_apply.py --apply \
&& ./scripts/release-staging.sh
```

## Verification

```bash
python3 -m pytest -q tests/frontend/test_pass66_46_guided_hero.py tests/heroes/test_pass66_6_hero_creator.py
node --experimental-strip-types scripts/tests/hero-questionnaire-pass6646.mjs
```

The installer only adds new files. The guarded patch modifies HeroCreatePage and HeroSheetPage in place, checking for expected source context, backing up both files, and refusing unexpected differences. If the source changed since the full review, stop and rebuild against a fresh `package-for-review.sh` snapshot rather than forcing the patch.
