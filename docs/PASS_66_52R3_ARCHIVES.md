# Quillairo Inkscape — Pass 66.52 R3

## Root cause

The R2 installer depended on a TypeScript Node module shape and inspected JSX
render trees merely to add a class. On this Mac, its TypeScript import returned
no `ScriptTarget`, so the probe failed before release. The earlier literal JSX
matcher had also been too restrictive.

## Resolution

Delete the dependency on TypeScript and JSX rewriting altogether. The stable authenticated `game-main` layout contains both archive routes. Both archive
pages already render a `.history-grid`, so the existing shared CSS scopes to
`.game-main:has(.history-grid)` and the appropriate child elements. The patch changes
no event handlers, React roots, or gameplay systems; it only adds an archive
CSS import if needed and adjusts inert page copy. All six paper themes inherit
the original theme tokens. `:has()` is supported by current Chrome/Safari.

## Safety

The Python installer checks all four source contracts, verifies the exact CSS
SHA before writing, stages all changes first, and keeps backups. `--check`
does not write; repeat `--apply` is no-op. The old read-only JSX probe remains
on disk from R2 but is never run and can be removed in a future cleanup.
