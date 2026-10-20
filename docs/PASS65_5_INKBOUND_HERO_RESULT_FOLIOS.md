# Pass 65.5 — Inkbound Hero & Result Folios

## Scope

Adds two real React visual compositions within the **protected** `/dev/inkbound` atelier.
This pass does not change live adventure routes, game turn logic, Arcade implementation,
server rolls, leveling, narration, notifications, or authentication.

### Character folio — real data

- Hero Hall entries now open a read-only Inkbound folio directly in the workshop.
- `getCharacter`, `listCharacters`, and optional `getCreationRules` supply the data.
- Attributes, skills, HP, XP, talents, effects, inventory, status, and unspent points
  all come from the existing character APIs. No fictional RPG properties are invented.
- Editing biography, spending advancement points and changing disposition continue to
  use the canonical existing Hero Sheet, linked directly from the folio.
- The approved source-alpha panorama is presented as an illustration, not falsely
  represented as an individualized Hero portrait. A separate original character
  portrait can replace/supplement it when supplied as an approved transparent asset.

### Roll result — safe illustrative dialog

- A single restrained manuscript sheet over a dimmed sample chapter, inspired by the
  approved result reference. Uses independent existing RGBA drawings and handmade SVG.
- Displays an internally consistent **sample** roll: 14 + 2 = 16, difficulty 15.
- The workshop does not generate, store, or apply a roll, XP, HP, or plot outcomes.
- Keyboard Escape closes, focus stays inside the dialog when tabbing, and a sample
  calculation disclosure is available. Only a simple entry/exit is used.

### Theme and media contract

The folios inherit the existing ivory/parchment/slate/midnight themes. Page/paper
texture is a CSS surface separate from illustrations. No new rectangular feathering,
image masks, or baked UI screenshots. All current artwork is reused; no invented
portrait or competing visual mockup was generated.

### Tests and verification

The focused Python contracts cover read-only services, correct APIs, modal
accessibility and transparency-safe CSS. The existing 65.4 PNG validator remains
standard-library-only (65.4.1 hotfix included).

The Hero folio and result dialog were browser-rendered in isolated Chromium at
1440x960 and 390x844 without horizontal overflow or JS errors. The result dialog
was separately mounted in the offline rendering harness, which predates the React
19 runtime and cannot faithfully emulate hooks across multiple screen switches.
Full React/Vite/TS checks and staging tests are still performed by
`scripts/release-staging.sh` on the user's Mac.

## Deployment

From `/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root`, once the ZIP is
placed under `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass65_5_inkbound_hero_result_folios.zip \
  && ./scripts/release-staging.sh "Pass 65.5: Inkbound Hero and result folios"
```
