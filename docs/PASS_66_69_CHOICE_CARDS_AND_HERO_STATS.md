# Pass 66.69 — Mockup-style choice cards and hero stat ledger

Presentation only. No server, dice, HP/XP, turn-state, socket, narration or persistence code changed.

- **Hero folio:** a stat ledger (Strength, Agility, Intellect, Perception, Presence, Willpower, Luck) read from
  the hero's real `stats`. Rows appear only for stats the hero actually has; nothing is invented.
  Party members show an initial in place of a portrait because other players' portraits are owner-private.
- **Choice cards:** three across from 761px up, one column on phones. Each card reads index/arrow, title,
  description, then icon-led facts: skill, DC, base chance (or "Odds vary" when skills are unknown),
  risk and XP, followed by the possible/at-risk stakes line from the choice data.
- **Layers fixed at source:** the 66.23 three-column rule now starts at 761px (was 1480px) and drops its
  220px minimum; the 66.65 forced two-column and 145px minimum rules were removed; the 66.7 `·` separator
  rule was removed. The new stylesheet raises specificity so older `!important` layers cannot override it.
- **Tests:** new `test_pass66_69_choice_cards_and_hero_stats.py`; the 66.65 two-column assertion now
  asserts the phone one-column rule.
