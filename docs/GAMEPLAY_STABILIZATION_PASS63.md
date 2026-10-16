# Pass 63.1 — gameplay presentation stabilization (staging only)

## Scope

- Turn theater: a 120ms Story Ready exit timer is scheduled **before** the final
  score and `finalized` state update; otherwise React cleans up its own timer.
- Authoritative dice: never animate an invented roll or mask the committed
  value behind a question mark. Frozen preliminary receipt rolls must not be
  replaced by late payloads during countdown state updates.
- Server retry after Story Ready is visible as a retry action; after >45s of
  a writing intermission (or >2s past zero at Story Ready), offer a read-only
  room-state re-sync without reloading or rerolling.
- War: the first two face-up ranks that trigger war are displayed before the
  follow-on tiebreaker. Unequal starting ranks never trigger War.
- Word reveal: the user preference still respects reduced motion, but Story
  Time enabled/autoplay settings no longer suppress the reveal when narration
  is not actually following a spoken passage.

## Not addressed in this patch

The admin Operations `Internal Server Error` is an unhandled backend 500.
The screenshot alone cannot establish its cause. Capture **staging backend
CloudWatch logs** around a fresh request:

```bash
AWS_PAGER='' aws logs tail /adventure-platform/staging/backend \
  --since 15m --format short --profile adventure-staging --region us-east-1 \
  > "$HOME/Downloads/tot-backend-errors.txt"
```

Review the file before sharing (it may contain account/log details). Trigger
Admin -> Control Room -> REFRESH OPERATIONS first. We must diagnose the
exception rather than conceal a failing monitoring panel with fake zeros.

Hero resting/regeneration and currency healing require server-authoritative
last-active timestamps, caps, dead-Hero exclusion, and currency accounting;
that progression change is deliberately deferred until after core turn-flow
stabilization to avoid healing active players unintentionally.

## Acceptance checklist

1. In a fresh solo adventure, pick a meaningful choice. The Arcade appears
   while generation runs, then closes after Story Ready countdown.
2. The D20 shows the exact server roll and resolution effects, then the new
   chapter is revealed; no duplicate choice submission after refresh.
3. Force a delayed generation/retry. The recovery action is visible and
   re-sync never rerolls an accepted choice.
4. In War, compare equal opener ranks to trigger War; see tiebreaker cards
   separately. Other ranks are ordinary battles.
5. With word reveal on, confirm new chapters and browser refreshes animate;
   reduced-motion settings continue to take priority.
6. Refresh Control Room. If it still shows 500, capture the backend traceback.
7. Test a two-player run separately. Confirm both clients see one authoritative
   resolution and the same committed chapter.

No infrastructure cutover or deployment should be necessary.

## Pass 63.2 — strict TypeScript dice hotfix

The first Pass 63.1 staging release completed 502 Python tests and relevant
browser regressions but was stopped by two `TS18047` errors in
`TurnResolutionTheater.tsx`. Although the effect already guarded against
`result.check === null`, TypeScript cannot preserve narrowing of a nullable
object property within the later `nextFrame` callback. Capture
`const check = result.check` before the guard, and use this immutable local
binding in all delayed dice/sound callbacks. The committed D20 value and its
critical outcome remain unchanged. Update the Python source regression to
verify both asynchronous roll updates use `check.roll`.

This is a frontend build correction only; rerun the full Mac staging release.
