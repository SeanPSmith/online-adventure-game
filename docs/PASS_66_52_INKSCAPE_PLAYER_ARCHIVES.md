# Quillairo Pass 66.52r1 — Inkscape Player Archives compatibility repair

**This replaces the overly strict Pass 66.52 apply script.** The original pass
successfully installed the 4 overlay files, then refused the real
`MyAdventuresPage.tsx` because it required one exact JSX `return <>` line.
This hotfix accepts equivalent JSX fragment/parenthesized returns and existing
static `<div>`, `<main>` or `<section>` roots, without rewriting components.

Scope remains Hero Hall, My Adventures, and Sealed Chronicles presentation only.
All Continue, Recover, Read, Share, narration, Hero disposition and delete
handlers are preserved. The stylesheet is identical to 66.52.

Safety:
- Preflight verifies recognizable, live archive component contracts.
- Unknown JSX structure or missing handlers cause a refusal *before any source change*.
- Existing static wrapper classes are preserved.
- Idempotent (second application makes no changes).
- Backups are stored under ignored `backups/pass66_52/`.
- No Director, socket, dice, Arcade, turn, XP, multiplayer or finale files changed.

After copying the ZIP into `assets/AWS/` from the `root` directory:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_52r1_inkscape_archives_source_compat.zip \
&& python3 scripts/pass66_52_apply.py --apply \
&& ./scripts/release-staging.sh
```

The full macOS frontend build and staging browser acceptance occur during the
user's standard release command; they are not claimed by this local smoke test.
