from types import SimpleNamespace

from app.game.challenge_scaling import (
    adventure_dc_adjustment,
    build_challenge_profile,
    challenge_tier_for_base_difficulty,
    level_dc_adjustment,
    scale_director_difficulty,
)
from app.game.session import GameSessionManager


def test_level_scaling_is_slow_and_bounded():
    assert level_dc_adjustment(1) == 0
    assert level_dc_adjustment(4) == 0
    assert level_dc_adjustment(5) == 1
    assert level_dc_adjustment(50) == 10
    assert level_dc_adjustment(999) == 10


def test_adventure_difficulty_adjustment_is_conservative():
    assert adventure_dc_adjustment("introductory") == -1
    assert adventure_dc_adjustment("moderate") == 0
    assert adventure_dc_adjustment("hard") == 1
    assert adventure_dc_adjustment("nightmare") == 2


def test_relative_challenge_tiers_preserve_director_bands():
    assert challenge_tier_for_base_difficulty(5) == "easy"
    assert challenge_tier_for_base_difficulty(10) == "standard"
    assert challenge_tier_for_base_difficulty(13) == "hard"
    assert challenge_tier_for_base_difficulty(15) == "severe"
    assert challenge_tier_for_base_difficulty(16) == "legendary"


def test_level_50_party_scales_standard_check_without_runaway_dc():
    profile = build_challenge_profile([50], adventure_difficulty="moderate")
    scaled = scale_director_difficulty(10, profile)

    assert profile.effective_party_level == 50
    assert profile.level_adjustment == 10
    assert scaled["base_difficulty"] == 10
    assert scaled["difficulty"] == 20
    assert scaled["challenge_tier"] == "standard"


def test_mixed_party_uses_shared_effective_level():
    profile = build_challenge_profile([8, 12], adventure_difficulty="hard")
    assert profile.effective_party_level == 10
    assert profile.level_adjustment == 2
    assert profile.adventure_adjustment == 1


def test_director_commit_stores_final_dc_and_scaling_breakdown():
    manager = GameSessionManager()
    # Existing AI runtime fixture is registered by normal bootstrap. Use a
    # fresh generated-style test definition from the director runtime suite if
    # available; fall back to registering one locally.
    from app.adventures.models import AdventureDefinition, ChoiceDefinition, SceneDefinition
    from app.adventures.registry import adventure_registry

    adventure_id = "challenge_scaling_runtime_test"
    if not adventure_registry.exists(adventure_id):
        adventure_registry.register(AdventureDefinition(
            id=adventure_id,
            title="SCALING TEST",
            description="test",
            starting_scene_id="opening",
            metadata={"runtime_mode": "ai_director", "difficulty": "moderate"},
            scenes={
                "opening": SceneDefinition(
                    id="opening",
                    title="OPENING",
                    body="Start.",
                    ascii_art="",
                    choices=(
                        ChoiceDefinition(id="a", label="A"),
                        ChoiceDefinition(id="b", label="B"),
                        ChoiceDefinition(id="c", label="C"),
                    ),
                    default_next_scene_id=None,
                )
            },
        ))

    session = manager.create("SCALE1", adventure_id)
    output = manager.commit_director_turn(
        "SCALE1",
        turn_facts={"results": []},
        characters_by_player_id={"p1": SimpleNamespace(level=50)},
        director_output={
            "title": "NEXT",
            "resolution_narration": "The previous action resolves.",
            "scene_body": "A harder problem appears.",
            "choices": [
                {
                    "label": "Standard move",
                    "description": "Attempt a meaningful veteran-level action.",
                    "archetype": "clever",
                    "tone": "pragmatic",
                    "risk_level": "moderate",
                    "reward_level": "moderate",
                    "impact_level": "meaningful",
                    "possible_gains": ["Progress"],
                    "possible_costs": ["Time"],
                    "check": {"difficulty": 10, "skill": "investigation", "stat": None},
                },
                "Wait",
                "Leave",
            ],
            "memory_summary": "Progress continues.",
            "story_state": {},
            "completed": False,
        },
    )

    check = session.scene.public_data()["choices"][0]["check"]
    assert check["base_difficulty"] == 10
    assert check["challenge_tier"] == "standard"
    assert check["effective_party_level"] == 50
    assert check["level_adjustment"] == 10
    assert check["difficulty"] == 20
    assert session.scene.choices[0].check.difficulty == 20
