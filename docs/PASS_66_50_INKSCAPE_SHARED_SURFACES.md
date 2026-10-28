# Pass 66.50 — Inkscape Shared Surfaces

Scope: the global native-dialog portal, and the 404 / route-error fallback pages.

- One editorial modal width and hierarchy, no conflicting 1040px override.
- Correct six-edition ink/paper contrasts, clean gold focus state, 44px controls.
- Removes the global dialog backdrop blur, retains focus trapping and closing.
- Error/not-found pages inherit current user paper and keep working recovery links.
- CSS edits are made in existing files; no additional stylesheet layer.
- **No gameplay source, Socket.IO, Director, Arcade, dice, choice or turn files altered.**

Apply after Pass 66.49, from Quillairo project root:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_50_inkscape_shared_surfaces.zip \
&& python3 scripts/pass66_50_apply.py --apply \
&& ./scripts/release-staging.sh
```

The guarded installer checks all six targets before any modification, snapshots
originals under `backups/pass66_50/`, and is idempotent. It rejects unknown
source differences. Full production build and browser visual review occur on
user's Mac during deployment; local smoke tests are not equivalent.
