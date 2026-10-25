# Quillairo Pass 66.40 R1 — global model snapshot restored

This hotfix merges the administrator-saved global model selection from Pass 66.33 with the expanded JSON/schema repair handling in Pass 66.40. Pass 66.40's replacement director.py inadvertently reverted to instance-level `story_model` and `economy_model`, dropping the request-local `ContextVar` lookup and database-backed model initialization.

The Director now loads server-saved Story and Recap/Economy defaults at both `advance()` and `generate_recap()` entry points, retaining an independent model snapshot for each async task. GPT-6 selections persist and apply to new requests only. If preference storage is unavailable, the existing safe environment defaults apply.

No scene, dice, arcade, UI, quota/metering or repair-budget changes were introduced in this hotfix. The Pass 66.40 bounded larger repair responses and existing timeout rescue remain in place.

Run the whole regression suite and React build with the normal `release-staging.sh` on the development Mac before deployment.
