# Pass 66.2 — Real Story Page, Mockup-First

Reference: user's approved Chapter One / The Road North Inkbound screenshot, 1408 × 1056.

## What actually changed

- The **real started-adventure reader** (not `/dev` or a static sample) now uses a full-width editorial story composition.
- Existing independent, genuinely transparent `north-road-editorial.png` sits on the selected CSS paper, with no mask, edge feathering, new opaque matte, or image regeneration.
- Story title / chapter header, panorama, live StoryReveal narration, choices, commit action, and compact Hero/party status appear in one readable manuscript flow.
- Journal / party / chat / sound / menu remain reachable in the manuscript header. Existing session tools, audio settings and Classic fallback live inside Menu; additional Hero/notes/history/chat summaries live behind **More from your adventure**.
- The same six persisted theme variables still control text, rules, interactions and the existing image's dark-mode transformation. No state or roll logic was touched.
- Ordinary vertical document scrolling remains enabled. Mobile choices stack; details/drawers stay keyboard accessible.

## Visual fidelity — remaining known differences

- The illustration uses the approved, original transparent production panorama. It is **not** a flattened crop of the reference screenshot; its proportions and exact art placement differ.
- The reference's choice-specific miniature illustrations and bespoke carved drop cap require independently approved transparent assets. Do not substitute arbitrary keyword icons or paste crops from mockup.
- Chapter lengths vary, so the page intentionally scrolls instead of requiring all controls to fit a fixed 1056px viewport.
- React browser snapshots used a lightweight StoryReveal stub only for illustrative data. Full word reveal, narration and connected co-op turn behavior still need verification on Mac staging.

## Follow-on screens — complete one at a time against each supplied reference

1. **Story reader** — this pass, ready for visual and functional review.
2. **Real Hero character sheet** — large portrait, attributes, traits, equipment and conditions from actual Hero data; no invented stats.
3. **Real authoritative dice/result folio** — use server receipt, not fabricated outcomes; match supplied mockup geometry.
4. **World homepages** — science fiction and horror compositions from supplied side-by-side references, world-specific transparent assets, catalog state.
5. **Dashboard and public home** — verify existing running routes and world entry points.
6. **Lobby, intermission, Arcade games, modals, settings, Author Studio and admin** — actual route-by-route functional/visual acceptance for six themes.

## Release guidance

Install from project root with `bash scripts/install-overlay.sh ../assets/AWS/pass66_2_story_reference.zip && ./scripts/release-staging.sh "Pass 66.2: Story page mockup parity"`. The release script runs project checks before pushing/deploying. If any test fails, do not release; do not weaken the test.
