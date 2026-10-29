# Inkscape QA / Pass 66.57

**Reference standard:** the nine approved Quillairo UI/illustration images supplied on October 23, 2026. Preserve their editorial ivory/black-ink/gray-watercolor composition and restrained antique-gold accents. Do not replace this direction with generic fantasy stock art, filters, texture overlays, or arbitrary decorative ornaments.

## Automated source gate

`python3 scripts/audit-inkscape-ui.py --strict`

This runs as part of `scripts/check-project.sh`, before Python tests, Git commits, or deployment. It checks that production lazy route targets and their relative imports exist; route composition retains public/auth/dev protection; layouts retain the skip-link/main focus target and theme selection; and shared QA stylesheet/navigation contracts remain installed. The existing source hygiene and player-touchpoint audits retain responsibility for assets/brand refs.

**What it does not do:** browser rendering, logged-in interactions, image diffs, content accuracy, color contrast measurements, multiplayer, authoring persistence, game-state transitions, audio, or CloudFront/production validation. A green source audit is necessary, not sufficient.

## Manual staging acceptance matrix

Use an actual browser (preferably desktop Chrome/Firefox and iPhone/Android equivalent) on the deployed authenticated staging site. Check at desktop ~1440×900, tablet ~768×1024, and small mobile ~390×844 or 320px minimum. Repeat critical screens with ivory, cream, parchment, navy, phosphor and midnight themes.

| Journey | Routes / workflow | Must pass |
| --- | --- | --- |
| Public | `/`, `/login`, `/register`, `/forgot-password`, `/rulebook` | Approved illustration placement and readable text; navigation menu opens/closes; no horizontal page overflow; keyboard focus visible; validation messages usable |
| Adventure discovery | `/game`, open a world and lobby | Real catalog/illustrations, Hero eligibility, filters, selection and Begin Adventure visible; no fake/demo data |
| Heroes | `/game/heroes`, `/game/heroes/new`, `/game/heroes/:heroId`, `/game/graveyard` | Portraits, real stats, forms, confirmation, progression; no clipped actions; heading/read order clear |
| Chronicles | `/game/adventures`, `/game/history` | Search, filters, results, resume/recover, READ CHRONICLE, sharing and archive audio intact; long passages readable |
| Reader | `/game/adventure/:roomId` | Sticky Hero info, readable manuscript, choice odds/DC tags, intermission, dice, result and next reveal; **do not alter game logic** |
| Account | `/account` tabs and preferences | Profile/session controls, settings, themes, account data and error states; accessible focus, tab navigation |
| Author | `/author`, `/account/author`, Studio editor | Document list, proposal review, editor inputs, save indicators and permission checks intact |
| Admin | `/admin` | Section jump index, operational tables, analytics, metering, user permissions, guarded actions and import; test with admin only |
| Fallbacks | invalid route, failed lazy import / offline | 404 and retry/return controls; no user-visible raw exception stack |

For each screen: assess at **thumbnail scale** (focal point, visual hierarchy, negative space, large silhouette) and **full resolution** (letterforms, actual watercolor/ink edge quality, tonal hierarchy, material consistency, visible controls and correct focus rings). Prefer repairing the underlying composition over adding texture or decorative effects.

### Release sign-off

- [ ] Full `./scripts/check-project.sh` completes on the local developer environment.
- [ ] Desktop and mobile real-browser smoke checks completed, with screenshot evidence if practical.
- [ ] No horizontal scroll hiding SYSTEM/ACCOUNT actions on small screens.
- [ ] All six paper themes have readable contrast and visible keyboard focus.
- [ ] Logged-in protected routes cannot be entered anonymously; dev labs remain admin-only.
- [ ] Director, gameplay state, dice, Hero HP/XP, Arcade and multiplayer recoveries remain unchanged.

Do not mark manual items as complete based solely on static checks.
