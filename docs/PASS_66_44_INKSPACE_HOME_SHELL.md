# Pass 66.44 — Inkspace production home shell separation

## Source of truth

Built from the full Quillairo root-review-20261023-105414.zip and sequential overlays 66.18–66.43, including the guarded 66.42 and 66.43 source patches. Do not use root-review-20261023-195811.zip: it belongs to another project.

## Issue fixed

The production `/game` dashboard rendered the modern `InkboundAuthenticatedDashboard` while `GameLayout` *also* marked it `is-desk-home`. The retired Pass 64 book CSS gave that shell a dark background, fixed height, and hidden overflow. The modern page then needed `body:has(.inkbound-home)` to undo those styles only after the lazy dashboard appeared. On slow navigation this could visibly flash old styling and impose unnecessary style recalculation.

## Changes

- `/game` now receives `is-inkspace-home` immediately, before the lazy dashboard loads. The desk marker remains only for the protected legacy home lab.
- Selected paper's background and ink color load in the eagerly imported bootstrap CSS (ivory, cream, parchment, navy, midnight, phosphor); the legacy book's dark loading frame no longer applies to the production home.
- The existing Inkbound dashboard stylesheet uses this explicit route marker in place of the expensive/deferred `body:has(.inkbound-home)` override.
- Four legacy CSS imports (approximately 32 KB in raw source, pre-minification) move from the shared game layout to the lazy `GameHomePage` module. Their book-preview rules remain intact, but they are no longer eagerly imported by the shared game shell and direct adventure routes.
- Original authenticated data fetching, world browser, invite/room actions, theme preferences, Hero management, and all game/turn mechanics remain unchanged.
- Earlier source contract tests are updated to assert the proper opt-in boundaries, not the accidental production coupling. Four additional tests protect the migration.

## Scope and limitations

This is a targeted production-shell cleanup, **not** a complete retirement of the Book or Classic modes, and **not** a measured network bundle reduction for `/game`: the existing GameHomePage still imports its preview styles. A deeper route-level split is deferred until the dev Book preview and all required behaviors can be separately tested in a complete browser environment. This avoids destabilizing the game that was just restored.

## Installation

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_44_quillairo_inkspace_home_cleanup.zip \
  && python3 scripts/pass66_44_apply.py --apply \
  && ./scripts/release-staging.sh
```

The patch is idempotent, preflight-checked and backed up. If source files differ, the script stops before modifying them: regenerate a current full-source review archive rather than forcing stale replacements.

## QA checklist

- `/game` first paint is the selected paper theme; no dark leather/fixed-book flash.
- `/game` scrolls normally, and Hero/world/journey controls remain functional.
- `/game/adventure/:roomId` still uses its own Inkspace theater and loading shell, with functioning intermission → dice → story progression.
- Protected `/dev/home-lab` still displays the opt-in old book correctly.
- Themes: ivory, cream, parchment, navy, midnight, phosphor; desktop and mobile.
