from datetime import datetime, timezone
from types import SimpleNamespace

from app.characters.advancement import (
    apply_advancement_allocation,
    award_for_level_transition,
    migrate_progression,
)
from app.characters.creation import creation_rules_public_data
from app.characters.models import Character, Skill, Stat
from app.game.check_engine import CheckRequest, perform_character_check
import app.game.check_engine as check_engine


def make_character(**kwargs):
    now = datetime.now(timezone.utc)
    base = dict(
        character_id="hero-v2",
        owner_user_id="user-v2",
        name="Mara",
        created_at=now,
        updated_at=now,
    )
    base.update(kwargs)
    return Character(**base)


def test_creation_rules_expose_luck_broader_skills_and_talents():
    rules = creation_rules_public_data()
    stat_ids = {item["id"] for item in rules["stats"]}
    skill_ids = {item["id"] for item in rules["skills"]}

    assert "luck" in stat_ids
    assert {"brawl", "sleight", "medicine", "mechanics", "navigation", "insight", "performance", "composure"} <= skill_ids
    assert rules["skill_points_per_level"] == 2
    assert len(rules["talents"]) >= 10


def test_character_bio_and_talents_round_trip():
    character = make_character(
        bio="Former paramedic. Hates confined spaces. Never leaves anyone behind.",
        talents=["field_medic", "hard_case"],
        unspent_talent_points=1,
    )

    restored = Character.from_dict(character.to_dict())
    assert restored.bio.startswith("Former paramedic")
    assert restored.talents == ["field_medic", "hard_case"]
    assert restored.unspent_talent_points == 1
    assert restored.get_stat(Stat.LUCK) == 0
    assert restored.get_skill(Skill.MEDICINE) == 0


def test_level_awards_alternate_attribute_and_talent_choices():
    level_two = award_for_level_transition(1, 2)
    assert level_two.stat_points == 1
    assert level_two.skill_points == 2
    assert level_two.talent_points == 0

    level_three = award_for_level_transition(2, 3)
    assert level_three.stat_points == 0
    assert level_three.skill_points == 2
    assert level_three.talent_points == 1


def test_legacy_hero_progression_migration_grants_only_new_v2_currency():
    character = make_character(
        level=5,
        progression_version=1,
        unspent_stat_points=2,
        unspent_skill_points=1,
    )

    changed = migrate_progression(character)

    assert changed is True
    assert character.progression_version == 2
    assert character.unspent_stat_points == 2
    assert character.unspent_skill_points == 5  # +1 missing skill point for L2-L5
    assert character.unspent_talent_points == 2  # L3 and L5
    assert migrate_progression(character) is False


def test_spending_talent_point_adds_permanent_talent():
    character = make_character(level=3, unspent_talent_points=1)
    event = apply_advancement_allocation(character, talents=["sleuth"])

    assert character.talents == ["sleuth"]
    assert character.unspent_talent_points == 0
    assert event["talents"] == ["sleuth"]


def test_talent_bonus_is_server_owned_and_included_in_check(monkeypatch):
    character = make_character(
        level=3,
        stats={Stat.INTELLECT: 2},
        skills={Skill.INVESTIGATION: 2},
        talents=["sleuth"],
    )
    monkeypatch.setattr(check_engine, "d20", lambda: SimpleNamespace(result=10))

    result = perform_character_check(
        character,
        CheckRequest(difficulty=15, skill=Skill.INVESTIGATION),
    )

    assert result.talent_modifier == 1
    assert result.talent_details[0]["label"] == "Sleuth"
    assert result.total_modifier == 5
    assert result.total == 15
    assert result.succeeded is True
