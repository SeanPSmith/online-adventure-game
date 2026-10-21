# Pass 65.8.2 — Missing CSS Recovery

## Cause
`AdventurePage.tsx` imports `./inkboundAdventurePass657.css` (introduced by
Pass 65.7), but the subsequent Pass 65.8 and 65.8.1 *incremental* packages
omitted this unchanged file. A checkout that did not already have the file
therefore passed TypeScript typechecking but failed Vite asset resolution.

## Repair
- Restore the **unchanged, exact** Pass 65.7 stylesheet, including its six
  color schemes and real reader/turn/intermission styles.
- Add a stdlib-only regression that resolves all local stylesheet imports in
  the actual TS/TSX/JS/JSX frontend source before the production build.
- Assert that the restored stylesheet contains the real reader, drawer, roll,
  and intermission selectors rather than merely an empty stub.

No gameplay callbacks, TypeScript source, backend logic, React layout, artwork,
or existing tests were changed. Install after Pass 65.8.1.

## Release
```
bash scripts/install-overlay.sh ../assets/AWS/pass65_8_2_inkbound_missing_stylesheet_recovery.zip && ./scripts/release-staging.sh "Pass 65.8.2: Restore Inkbound adventure stylesheet"
```
