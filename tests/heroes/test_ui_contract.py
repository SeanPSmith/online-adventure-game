from tests.support import PROJECT_ROOT
from pathlib import Path

ROOT = PROJECT_ROOT


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_character_creation_exposes_bio_and_progression_rules():
    source = read("frontend/src/pages/heroes/HeroCreatePage.tsx")
    assert "BIO // BACKGROUND, TEMPERAMENT, QUIRKS" in source
    assert "OPTIONAL BACKGROUND — HELPS PERSONALIZE YOUR STORIES" in source
    assert "EVERY LEVEL" in source
    assert "ATTRIBUTE POINT" in source
    assert "TALENT POINT" in source


def test_character_sheet_exposes_bio_attributes_skills_and_talents():
    source = read("frontend/src/pages/heroes/HeroSheetPage.tsx")
    assert "HERO DOSSIER" in source
    assert "DIRECTOR CANON" in source
    assert "CORE ATTRIBUTES" in source
    assert "TALENTS // PERMANENT EDGES" in source
    assert "COMMIT ADVANCEMENT" in source
    assert "SegmentedMeter" in source


def test_director_receives_authored_bio_and_talents():
    source = read("app/generation/director.py")
    assert '"bio"' in source
    assert 'data["talents"]' in source
    assert "player-authored Hero canon" in source


def test_character_sheet_advancement_queue_supports_multi_point_allocations():
    source = read("frontend/src/pages/heroes/HeroSheetPage.tsx")
    assert "remainingStatPoints" in source
    assert "remainingSkillPoints" in source
    assert "setSpending((current) =>" in source
    assert 'queueSpend("stat", definition.id, "max")' in source
    assert 'queueSpend("skill", definition.id, "max")' in source
    assert "RESET QUEUE" in source
    assert ">+1</button>" in source
    assert ">MAX</button>" in source


def test_character_sheet_labels_advancement_currency_and_links_to_spend_sections():
    source = read("frontend/src/pages/heroes/HeroSheetPage.tsx")
    assert 'ATTRIBUTE {hero.unspent_stat_points === 1 ? "POINT" : "POINTS"}' in source
    assert 'SKILL {hero.unspent_skill_points === 1 ? "POINT" : "POINTS"}' in source
    assert 'TALENT {hero.unspent_talent_points === 1 ? "POINT" : "POINTS"}' in source
    assert 'jumpToAdvancement("hero-attributes")' in source
    assert 'jumpToAdvancement("hero-skills")' in source
    assert 'jumpToAdvancement("hero-talents")' in source
    assert 'READY TO SPEND' in source
    assert '>NONE<' not in source  # labels are computed, not misleading static availability text
