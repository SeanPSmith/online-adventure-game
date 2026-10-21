# Pass 65.8.1 — Inkbound TurnTheater type hotfix

Pass 65.8 adds `inkPaper={inkboundReady ? inkPaper : undefined}` to the
`<TurnTheater />` call in `AdventurePage.tsx`. An incremental installation
may have a previous `TurnTheater.tsx` whose TypeScript props do not accept
`inkPaper`, stopping `tsc -b` with TS2322.

This hotfix explicitly re-ships `TurnTheater.tsx` with the already-designed
optional `inkPaper?: InkPaper` prop and the appropriate `data-ink-paper`
markers for the resolution, intermission, and fallback theater overlays.

The hotfix changes no server-side authority, roll calculation, countdown,
intermission score submission, resynchronization, or visual assets. It adds
one dependency-free regression test for the prop contract.

Install after Pass 65.8 and run the normal release workflow:

```sh
bash scripts/install-overlay.sh ../assets/AWS/pass65_8_1_inkbound_turn_theater_type_hotfix.zip && ./scripts/release-staging.sh "Pass 65.8.1: Inkbound TurnTheater TypeScript hotfix"
```
