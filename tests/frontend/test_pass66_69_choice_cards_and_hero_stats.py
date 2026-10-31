"""Pass 66.69: mockup-style choice cards and hero stat ledger, built only from real game data."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "frontend/src/pages/game"
ROOM = (GAME / "InkboundLiveRoom.tsx").read_text(encoding="utf-8")
CSS = (GAME / "inkscapeFolioChoicesPass6669.css").read_text(encoding="utf-8")
ICONS = (ROOT / "frontend/src/features/adventure/ChoiceFactIcon.tsx").read_text(encoding="utf-8")


def test_hero_stats_use_real_data_in_canonical_order_only():
    assert 'STAT_ORDER = ["strength", "agility", "intellect", "perception", "presence", "willpower", "luck"]' in ROOM
    assert "orderedStats(props.hero?.stats)" in ROOM
    assert '<dl className="ibl-hero-stats" aria-label="Hero stats">' in ROOM
    # Nothing the game does not track may be printed as a stat.
    for invented in ("Resolve", "Relationship", "Reputation", "Charisma"):
        assert invented not in ROOM, invented


def test_choice_cards_print_only_real_choice_facts():
    for kind in ("skill", "dc", "odds", "reward"):
        assert f'data-fact="{kind}"' in ROOM and f'"{kind}"' in ICONS
    assert "choice.check.difficulty" in ROOM and "choice.xp_reward" in ROOM
    # The honest odds wording is preserved, and a missing risk level is never printed as "Unknown".
    assert "Base chance ≈ ${chance}%" in ROOM and "Odds vary" in ROOM
    assert "Unknown risk" not in ROOM
    assert "baseSuccessChance(choice," in ROOM
    # Icons are decorative; the adjacent text carries the meaning.
    assert 'aria-hidden="true"' in ICONS and "currentColor" in ICONS


def test_choices_are_three_across_from_tablet_up_and_one_column_on_phones():
    assert "@media (min-width:761px)" in CSS
    assert ".inkbound-live .ibl-layout .ibl-choices {grid-template-columns:repeat(3,minmax(0,1fr))!important}" in CSS
    assert ".inkbound-live .ibl-layout .ibl-choices {grid-template-columns:1fr!important}" in CSS
    assert ".inkbound-live .ibl-choices > .ibl-choice {min-height:0}" in CSS
    older = (ROOT / "frontend/src/styles/quillairoLiveFolioPass6623.css").read_text(encoding="utf-8")
    assert "@media (min-width:761px){.inkbound-live .ibl-choices{grid-template-columns:repeat(3" in older
    assert "min-height:220px" not in older


def test_stylesheet_is_wired_and_gameplay_handlers_are_untouched():
    assert 'import "./inkscapeFolioChoicesPass6669.css";' in ROOM
    assert 'import { ChoiceFactIcon }' in ROOM
    for contract in ("onSelectChoice", "onLockChoice", "chapterReleased"):
        assert contract in ROOM, contract
