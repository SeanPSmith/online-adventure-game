from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_character_creation_exposes_bio_and_progression_rules():
    source = read("frontend/src/pages/heroes/HeroCreatePage.tsx")
    assert "BIO // BACKGROUND, TEMPERAMENT, QUIRKS" in source
    assert "DIRECTOR MAY USE THIS IN PLAY" in source
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
