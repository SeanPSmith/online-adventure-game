from tests.support import PROJECT_ROOT
from pathlib import Path

from app.generation.director import (
    OpenAIRuntimeDirector,
    SYSTEM_INSTRUCTIONS,
    _compact_story_state_context,
)
from app.generation.director_schema import DirectorStoryTurnDraft


ROOT = PROJECT_ROOT


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_runtime_story_schema_is_compact_and_forward_moving() -> None:
    schema = DirectorStoryTurnDraft.model_json_schema()
    assert schema["properties"]["scene_body"]["maxLength"] == 1800
    assert schema["properties"]["memory_summary"]["maxLength"] == 600
    choice_ref = schema["properties"]["choices"]["items"]["$ref"].split("/")[-1]
    choice = schema["$defs"][choice_ref]
    assert choice["properties"]["description"]["maxLength"] == 240
    assert choice["properties"]["possible_gains"]["maxItems"] == 3
    assert choice["properties"]["possible_costs"]["maxItems"] == 3
    assert "at most 1-2 sentences of causal bridge" in SYSTEM_INSTRUCTIONS
    assert "MOVE FORWARD" in SYSTEM_INSTRUCTIONS


def test_runtime_defaults_use_bounded_output_and_fast_routine_reasoning(monkeypatch) -> None:
    for key in (
        "TOT_OPENAI_DIRECTOR_MAX_OUTPUT_TOKENS",
        "TOT_OPENAI_DIRECTOR_FAST_REASONING",
        "TOT_OPENAI_DIRECTOR_STORY_REASONING",
    ):
        monkeypatch.delenv(key, raising=False)
    director = OpenAIRuntimeDirector()
    assert director.max_output_tokens == 4600
    assert director.fast_story_reasoning == "low"
    assert director.story_reasoning == "medium"


def test_director_context_is_compacted_and_repair_work_uses_economy_model() -> None:
    source = read("app/generation/director.py")
    assert '"opening_scene"' not in source[source.index("compact_seed = {"):source.index("payload = {", source.index("compact_seed = {"))]
    assert '"player_synopsis"' not in source[source.index("compact_seed = {"):source.index("payload = {", source.index("compact_seed = {"))]
    assert 'list(session.director_history)[-2:]' in source
    assert 'separators=(",", ":")' in source
    assert 'model=self.economy_model' in source
    assert '[DIRECTOR FRESHNESS WARNING]' in source
    assert '[DIRECTOR FRESHNESS REPAIR]' not in source


def test_result_receipt_is_emitted_before_story_commit() -> None:
    source = read("app/main.py")
    receipt = source.index('"turn_receipt_ready"')
    wait = source.index('done, _pending = await asyncio.wait(', receipt)
    commit = source.index('.commit_director_turn(', wait)
    assert receipt < wait < commit
    assert 'runtime_director.generate_recap(' in source
    assert 'recap_task=' in source
    assert 'recap_task,' in source


def test_turn_archive_is_exposed_and_rendered_as_compact_carousel() -> None:
    main = read("app/main.py")
    session = read("app/game/session.py")
    store = read("app/persistence/store.py")
    page = read("frontend/src/pages/game/AdventurePage.tsx")
    service = read("frontend/src/services/game.ts")
    css = read("frontend/src/styles/components.css")
    assert 'def public_turn_history(session)' in main
    assert 'getattr(session, "turn_archive", [])' in main
    assert 'archive[-50:]' in main
    assert '"turn_history":' in main
    assert 'turn_archive: list[' in session
    assert 'session.turn_archive[-100:]' in session
    assert 'session.director_history[' in session and '-10:' in session
    assert '"turn_archive":' in store
    assert 'export interface TurnHistoryEntry' in service
    assert 'TURN HISTORY //' in page
    assert 'turn-history-controls' in page
    assert 'turn-history-card' in page
    assert '.turn-history-panel' in css


def test_preliminary_receipt_has_stable_resolved_turn_identity() -> None:
    main = read("app/main.py")
    session = read("app/game/session.py")
    theater = read("frontend/src/features/adventure/useTurnTheater.ts")
    assert '"resolved_turn_number": resolved_turn_number' in main
    assert '"resolved_turn_number":\n                resolved_turn' in session
    assert 'receipt.resolved_turn_number ?? receipt.turn_number' in theater
    assert 'turnReceipt.preliminary ? "resolution" : "story-ready"' in theater


def test_story_state_context_window_is_bounded() -> None:
    state = {
        "current_goal": "Keep moving",
        "story_phase": "escalation",
        "known_facts": [f"fact-{index}-" + ("x" * 500) for index in range(30)],
        "unresolved_threads": [f"thread-{index}" for index in range(20)],
        "active_npcs": [{"name": f"NPC {index}"} for index in range(20)],
        "recent_consequences": [{"description": f"C{index}"} for index in range(20)],
    }
    compact = _compact_story_state_context(state)
    assert len(compact["known_facts"]) == 12
    assert all(len(item) <= 320 for item in compact["known_facts"])
    assert len(compact["unresolved_threads"]) == 8
    assert len(compact["active_npcs"]) == 8
    assert len(compact["recent_consequences"]) == 6


def test_acknowledged_early_receipt_releases_intermission_when_story_commits() -> None:
    theater = read("frontend/src/features/adventure/useTurnTheater.ts")
    assert "The player already read the early dice/result receipt" in theater
    assert "rememberIntermission(null);" in theater
    assert 'setPhase("none");' in theater
