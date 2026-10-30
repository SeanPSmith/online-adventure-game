# Pass 66.63 R2 — Actual-source physical book retirement

Baseline: quillairo-review-20261030-004500.zip; production is deployed directly by the release script.

Removes the abandoned physical-book laboratory and eleven CSS files plus its private InkspaceAuthenticatedHome component. Keeps the live InkboundAuthenticatedDashboard, real socket/character service wiring, hero selection, co-op lobby, room recovery handoff, active adventure layout and all backend systems.

Legacy /dev/home-lab and /game/home-lab links redirect to /dev, behind the existing authorization gate.

No public illustration files are removed; artwork and older visual experiments need a separate dynamic-reference audit before bulk deletion. Old tests testing exclusively retired designs are removed; relevant current player-state and navigation tests are updated and a new dedicated regression test enforces CSS isolation.
