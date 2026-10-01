from datetime import datetime, timezone

from app.adventures.models import CheckSpec, ChoiceDefinition
from app.characters.models import Character, Skill
from app.characters.progression import (
    choice_xp_breakdown,
    choice_xp_reward,
    level_for_experience,
    progression_public_data,
    xp_level_multiplier,
)


def test_progression_curve_and_next_level_values():
    assert level_for_experience(0) == 1
    assert level_for_experience(99) == 1
    assert level_for_experience(100) == 2

    data = progression_public_data(2, 175)
    assert data["xp_level_floor"] == 100
    assert data["xp_next_level"] == 300
    assert data["xp_needed_for_next_level"] == 125
    assert data["xp_progress_percent"] == 37.5


def test_choice_public_data_exposes_risk_weighted_visible_xp_reward():
    safe = ChoiceDefinition(
        id="wait",
        label="Wait it out",
        risk_level="safe",
    )
    reckless = ChoiceDefinition(
        id="breach",
        label="Breach the gate",
        risk_level="extreme",
        check=CheckSpec(difficulty=18, skill=Skill.ATHLETICS),
    )

    assert safe.public_data({})["xp_reward"] == choice_xp_reward(
        has_check=False,
        risk_level="safe",
    )
    assert reckless.public_data({})["xp_reward"] == choice_xp_reward(
        has_check=True,
        difficulty=18,
        risk_level="extreme",
    )
    assert reckless.public_data({})["xp_reward"] > safe.public_data({})["xp_reward"]


def test_xp_reward_scales_with_risk_level_and_hero_level():
    low = choice_xp_breakdown(
        has_check=True,
        difficulty=12,
        risk_level="low",
        hero_level=1,
        outcome="success",
    )
    high = choice_xp_breakdown(
        has_check=True,
        difficulty=12,
        risk_level="high",
        hero_level=1,
        outcome="success",
    )
    veteran = choice_xp_breakdown(
        has_check=True,
        difficulty=12,
        risk_level="high",
        hero_level=6,
        outcome="success",
    )

    assert high["final_xp"] > low["final_xp"]
    assert veteran["final_xp"] > high["final_xp"]
    assert xp_level_multiplier(6) == 1.2


def test_failure_still_earns_risk_xp_and_critical_success_boosts_it():
    failed = choice_xp_breakdown(
        has_check=True,
        risk_level="severe",
        hero_level=3,
        outcome="failure",
    )
    critical = choice_xp_breakdown(
        has_check=True,
        risk_level="severe",
        hero_level=3,
        outcome="critical_success",
    )

    assert failed["final_xp"] > 0
    assert critical["final_xp"] > failed["final_xp"]


def test_character_effects_and_xp_idempotence_events_round_trip():
    now = datetime.now(timezone.utc)
    character = Character(
        character_id="hero-1",
        owner_user_id="user-1",
        name="Mara",
        created_at=now,
        updated_at=now,
        experience=40,
        effects=[{
            "effect_id": "fx_1",
            "source_key": "director:ROOM:abc",
            "name": "Burned Hand",
            "permanence": "lasting",
            "active": True,
        }],
        awarded_xp_events=["choice:ROOM:1:p1:open_door"],
    )

    restored = Character.from_dict(character.to_dict())
    assert restored.effects[0]["name"] == "Burned Hand"
    assert restored.effects[0]["active"] is True
    assert restored.awarded_xp_events == ["choice:ROOM:1:p1:open_door"]


def test_mechanical_effect_modifier_applies_to_matching_check_and_expires():
    from app.characters.effects import consume_effect_checks, effect_modifier_for_check
    from app.characters.models import Stat

    now = datetime.now(timezone.utc)
    character = Character(
        character_id="hero-fx",
        owner_user_id="user-1",
        name="Mara",
        created_at=now,
        updated_at=now,
        effects=[{
            "effect_id": "fx_burn",
            "name": "Burned Hand",
            "permanence": "temporary",
            "active": True,
            "stat_modifiers": {"agility": -1},
            "skill_modifiers": {},
            "remaining_checks": 2,
        }],
    )

    modifier, applied = effect_modifier_for_check(
        character,
        stat=Stat.AGILITY,
        skill=Skill.ACROBATICS,
    )
    assert modifier == -1
    assert [item.effect_id for item in applied] == ["fx_burn"]

    expired = consume_effect_checks(character, ["fx_burn"])
    assert expired == []
    assert character.effects[0]["remaining_checks"] == 1
    assert character.effects[0]["active"] is True

    expired = consume_effect_checks(character, ["fx_burn"])
    assert len(expired) == 1
    assert character.effects[0]["remaining_checks"] == 0
    assert character.effects[0]["active"] is False


def test_effect_modifier_does_not_apply_to_unrelated_check():
    from app.characters.effects import effect_modifier_for_check
    from app.characters.models import Stat

    now = datetime.now(timezone.utc)
    character = Character(
        character_id="hero-fx-2",
        owner_user_id="user-1",
        name="Mara",
        created_at=now,
        updated_at=now,
        effects=[{
            "effect_id": "fx_leg",
            "name": "Twisted Knee",
            "permanence": "lasting",
            "active": True,
            "stat_modifiers": {"agility": -2},
            "remaining_checks": 8,
        }],
    )

    modifier, applied = effect_modifier_for_check(
        character,
        stat=Stat.INTELLECT,
        skill=Skill.INVESTIGATION,
    )
    assert modifier == 0
    assert applied == []


def test_effect_stack_is_server_capped():
    from app.characters.effects import effect_modifier_for_check
    from app.characters.models import Stat

    now = datetime.now(timezone.utc)
    character = Character(
        character_id="hero-fx-3",
        owner_user_id="user-1",
        name="Mara",
        created_at=now,
        updated_at=now,
        effects=[
            {"effect_id": "a", "active": True, "stat_modifiers": {"presence": 2}},
            {"effect_id": "b", "active": True, "stat_modifiers": {"presence": 2}},
            {"effect_id": "c", "active": True, "stat_modifiers": {"presence": 2}},
        ],
    )

    modifier, applied = effect_modifier_for_check(
        character,
        stat=Stat.PRESENCE,
        skill=None,
    )
    assert modifier == 4
    assert len(applied) == 3


def test_perform_character_check_includes_status_effect_modifier(monkeypatch):
    from types import SimpleNamespace
    from app.characters.models import Stat
    from app.game.check_engine import CheckRequest, perform_character_check
    import app.game.check_engine as check_engine

    now = datetime.now(timezone.utc)
    character = Character(
        character_id="hero-check-fx",
        owner_user_id="user-1",
        name="Mara",
        created_at=now,
        updated_at=now,
        stats={Stat.AGILITY: 2},
        effects=[{
            "effect_id": "fx_burn",
            "name": "Burned Hand",
            "active": True,
            "stat_modifiers": {"agility": -1},
            "remaining_checks": 3,
        }],
    )

    monkeypatch.setattr(check_engine, "d20", lambda: SimpleNamespace(result=10))
    result = perform_character_check(
        character,
        CheckRequest(difficulty=11, stat=Stat.AGILITY),
    )

    assert result.effect_modifier == -1
    assert result.total_modifier == 1
    assert result.total == 11
    assert result.succeeded is True
    assert result.to_dict()["effect_details"][0]["name"] == "Burned Hand"


def test_failed_check_xp_scales_with_proximity_to_dc():
    near_miss = choice_xp_breakdown(
        has_check=True,
        difficulty=15,
        risk_level="high",
        hero_level=1,
        outcome="failure",
        check_total=14,
    )
    mid_miss = choice_xp_breakdown(
        has_check=True,
        difficulty=15,
        risk_level="high",
        hero_level=1,
        outcome="failure",
        check_total=9,
    )
    bad_miss = choice_xp_breakdown(
        has_check=True,
        difficulty=15,
        risk_level="high",
        hero_level=1,
        outcome="failure",
        check_total=3,
    )
    success = choice_xp_breakdown(
        has_check=True,
        difficulty=15,
        risk_level="high",
        hero_level=1,
        outcome="success",
        check_total=15,
    )

    assert 0.55 <= near_miss["outcome_multiplier"] <= 0.65
    assert mid_miss["outcome_multiplier"] < near_miss["outcome_multiplier"]
    assert bad_miss["outcome_multiplier"] == 0.15
    assert bad_miss["final_xp"] < mid_miss["final_xp"] < near_miss["final_xp"]
    assert near_miss["final_xp"] < success["final_xp"]


def test_critical_failure_caps_partial_xp_even_when_total_is_close():
    critical_failure = choice_xp_breakdown(
        has_check=True,
        difficulty=15,
        risk_level="extreme",
        hero_level=1,
        outcome="critical_failure",
        check_total=14,
    )

    assert critical_failure["outcome_multiplier"] <= 0.20
    assert critical_failure["final_xp"] > 0
