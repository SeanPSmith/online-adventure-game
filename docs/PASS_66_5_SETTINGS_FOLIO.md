# Pass 66.5 — Quillairo Settings Folio

**Target:** `/account?tab=preferences` (the route `/settings` redirects to account preferences).

## Reference and implementation

- Matches the approved editorial settings mockup's core layout: left introduction, right two-column Story Time / Reading & Display, then sound/gameplay and notification settings.
- Preserves existing account tabs and their profile, security, deletion, and billing behavior.
- Reuses the existing `InkboundPaperPreferences` and appearance services for six palettes.
- Retains all 28 supported narration voices via the existing `NarratorVoicePicker`, its audio preview, Story Time startup, audio volume/speed, and narration actions. These are real controls, not sample data.
- Keeps real Web Push/email/SMS notification preferences and SMS verification. Unavailable channels remain disabled.
- Keeps visual story-reveal preferences, typeface selection, illuminated initials, and reduced-motion behavior.
- Decorative landscape is the existing transparent `/art/inkbound/north-road-editorial.png` with no extra opaque page background and no mask.
- CRT green applies its monospaced typography through the shared Inkbound theme foundation.

## Validation

- Focused Python regressions and TypeScript *syntax* parsing; the complete TypeScript/Vite compilation is run by `release-staging.sh` on the user's development machine.
- Desktop 1500 px and mobile 390 px Chromium **static layout fixtures** were rendered with the production settings CSS in all six palettes (mobile checked in ivory, navy, green). These fixtures do not exercise React state or remote APIs.
- Separate account/notification service contracts remain the authoritative behavior; live deployment should test narrator voice preview, Story Time startup, theme persistence, Web Push, and mobile dialogs.

## Rollout

Only the account preferences page layout, its own styling, and account header branding are changed. Game turn flow and authoring logic are untouched.
