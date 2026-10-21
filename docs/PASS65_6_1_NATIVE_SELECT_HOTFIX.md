# Pass 65.6.1 — Custom select regression hotfix

Replaces the four native HTML select elements introduced in Pass 65.6 with the
existing `TerminalSelect` React component. All existing callbacks, hero
availability restrictions, room creation/joining, and catalog filtering are
preserved. Overrides the global terminal palette with the four Inkbound paper
and ink tokens. No backend or art changes.

The Pass 65.6 Hero selection contract was updated to assert that the actual
`onSelectHero` handler is passed to each shared picker, instead of asserting an
obsolete native select DOM event. The older launch regression is unchanged.

Install this small incremental overlay **after Pass 65.6**. The release command
runs the full checks, Git, and staging deployment. Preflight test failures halt
release before deployment; AWS rollback is not guaranteed for mid-flight errors.
