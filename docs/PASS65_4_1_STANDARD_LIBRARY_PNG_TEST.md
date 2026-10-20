# Pass 65.4.1 — standard-library PNG alpha regression fix

## Reason

Pass 65.4 added an unconditional `from PIL import Image` to a frontend regression test. `Pillow` is not an application dependency of the Tales of Two runtime, so this caused `pytest` to fail during test collection on some developer environments.

## Fix

Replace only `tests/frontend/test_pass65_4_inkbound_sketchbook.py` with a test that decodes PNG alpha using Python's standard library (`struct`, `zlib`), including PNG scanline filters 0–4 and chunk CRCs. It still asserts the illustration has real RGBA transparency, non-empty ink content, and inset safe margins on all four sides. No changes to game code, live routes, art, or infrastructure.

The optional art-authoring script `scripts/build-inkbound-art.py` still requires Pillow and CairoSVG if someone explicitly regenerates illustrations; neither is needed to run checked-in site assets or this regression test.

## Installation

From the project root:

```sh
bash scripts/install-overlay.sh ../assets/AWS/pass65_4_1_png_test_hotfix.zip && ./scripts/release-staging.sh "Pass 65.4.1: dependency-free PNG alpha regression"
```

Checks run once inside the release script, before Git and AWS operations. If preflight fails, no deploy begins; automatic rollback of a mid-deployment AWS failure is not guaranteed.
