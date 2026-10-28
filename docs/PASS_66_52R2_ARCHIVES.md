# Quillairo Pass 66.52 R2 — Chronicle JSX compatibility

This is an **installer-only compatibility repair** for 66.52. Neither user
failure changed any application files: the guarded patch refused before writes.
R2 uses TypeScript's parser to locate the actual JSX rendering expressions
of the named `HistoryPage` function. It wraps only those expressions with
`ix52-archive ix52-chronicles`, while retaining every existing component,
handler, and source line within them. The archive stylesheet also handles a
pre-existing inner page wrapper. Existing `MyAdventuresPage.tsx` compatibility
and hero art cleanup are preserved.

## Safety
- Preconditions verify Chronicle/Archive feature contracts.
- TSX parser fails closed if the source cannot be parsed, the exported component
  cannot be found, or rendering is ambiguous. No source writes on refusal.
- Existing archive wrapper is reused rather than duplicated.
- Read-only JSX probe uses the project's installed frontend `typescript` package.
- Backups go to ignored `backups/pass66_52/` and remain idempotent.
- **Zero gameplay source files** are included or modified.

From Quillairo `root`, with ZIP in `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_52r2_inkscape_archive_ast_compat.zip \
&& python3 scripts/pass66_52_apply.py --check \
&& python3 scripts/pass66_52_apply.py --apply \
&& ./scripts/release-staging.sh
```

Full Mac production build and browser acceptance remain to be verified.
