# Pass 66.7 — Live gameplay repair

Scope: the actual Inkbound started-adventure reader, not a mockup.

## Changes

- The main chapter uses a vertically scrollable text column on desktop.
- Hero/HP/XP/effects, party, notes, utilities and chat sit in an expanded,
  sticky, individually scrollable side rail. Mobile uses normal document scroll.
- Choices expose the real server-supplied DC, stat/skill, risk, XP and candidate
  consequences. When the full local Hero model is available, an explicitly
  labeled **base** chance uses the real D20 rules (natural 1/20). This is NOT
  a final probability because effects, equipment and situational bonuses vary.
- The Inkbound reader no longer renders `scene.ascii_art`. Transparent fantasy
  assets are used for its scenery; the original ASCII stays in Classic View.
- The resolved-turn state machine no longer depends indefinitely on a nested
  Arcade React component invoking its story-ready close callback. A fallback
  closes the Arcade *only after* the durable final receipt exists and the
  three-second story-ready countdown reaches zero; it then displays that same
  committed receipt, never a new roll. The Arcade has 900 ms to submit its
  final score. `TurnResolutionTheater` still requires explicit acknowledgement
  before the next chapter is revealed. The existing chapter opacity fade remains.
- The optional room re-sync action becomes available after 30 seconds of
  writing. Sync never rerolls dice or starts new Director generation.

## Safety, scope, and limitations

- No gameplay rule or backend schema has been modified.
- A per-chapter AI illustration service is NOT introduced in this repair.
  Static transparent art is used for fantasy chapters. Future scene-specific
  generation needs persistent owned assets, caching, and an explicit API-cost
  budget; do not fake it by embedding ASCII or applying rectangular masks.
- Classic View continues to preserve its original experience.
- Existing server-owned choices, outcome modifiers, room events, Arcade games,
  and Story Time are unchanged.

## Manual staging acceptance

1. Resume a solo game (ivory), choose a DC-backed choice, confirm the visible
   check/XP/risk, and commit once.
2. Enter Arcade; wait until Director completes. Confirm it exits without
   refresh, shows the **actual stored roll** and its consequences, then waits
   for Continue and fades into the next chapter.
3. Refresh while the Director writes, and again after it commits. Confirm no
   reroll, no repeated reward, and no permanently sealed chapter.
4. Test 2-player co-op where the other player completes a game earlier.
5. Test ivory, parchment, midnight blue and CRT green for sidebar readability;
   verify mobile normal scrolling and the full-width Story layout.
6. Try a scene without an illustration; no ASCII should appear in Inkbound.

## Checks performed here

- 30 focused Python source/flow tests passed.
- 329 broader tests passed; five others require `socketio` unavailable in this
  sandbox. Full Mac project checks remain authoritative.
- TypeScript syntax transpilation passed for all changed TS/TSX files.
- Direct D20 base-chance checks passed.
- Simulated real state hook passes complete committed-turn transition even when
  Arcade's `onStoryReadyComplete` never fires.
