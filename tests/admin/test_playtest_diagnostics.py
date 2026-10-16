"""Pass 63.8: offline cost/momentum diagnostics, no live provider requests."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.admin.playtest import PlaytestReportStore, _percentile, build_playtest_snapshot
from app.database import connect_database, _translate_postgres_sql
from app.usage.pricing import estimate_cost_microusd


def _history(room="RM123", *, turns=4, history=None):
    return {
        "room_code": room, "adventure_id": "adventure-1",
        "adventure_title": "The Haunted Gate", "turn_count": turns,
        "completed_at": "2026-10-16T10:00:00+00:00",
        "director_history_json": json.dumps(history if history is not None else [
            {"narrative_progress": {"level": "low"}},
            {"narrative_progress": {"level": "low"}},
            {"narrative_progress": {"level": "substantive"}},
            {"scene_body": "Legacy without progress"},
        ]),
    }


def _event(room="RM123", *, model="gpt-5.6-sol", operation="director_story",
           status="succeeded", cost=52000, inp=8000, out=1000, cached=0, latency=20000):
    return {"room_code": room, "model": model, "operation": operation,
            "status": status, "estimated_cost_microusd": cost,
            "input_tokens": inp, "output_tokens": out,
            "cached_input_tokens": cached, "latency_ms": latency}


def test_reports_actual_cost_and_separately_labels_same_tokens_projection():
    sol = _event()
    luna = _event(model="gpt-5.6-luna", operation="director_recap", cost=1000, latency=700)
    failed = _event(status="failed", operation="director_json_repair", cost=3000, inp=0, out=0, latency=0)
    data = build_playtest_snapshot([_history()], [sol, luna, failed])
    run = data["runs"][0]
    expected_sol = estimate_cost_microusd(model="gpt-6.1-sol", input_tokens=8000, output_tokens=1000)
    assert run["estimated_ai_cost_usd"] == .056
    assert run["gpt61_same_tokens_usd"] == round((expected_sol + 1000 + 3000) / 1e6, 6)
    assert run["gpt61_comparable_calls"] == 1
    assert run["models"] == ["gpt-5.6-luna", "gpt-5.6-sol"]
    assert run["story_latency_p50_ms"] == 20000
    assert run["ai_failures"] == 1 and run["repair_calls"] == 1
    assert "not an actual latency or quality benchmark" in data["limits"]["comparison"]


def test_progress_streak_and_old_unscored_scenes_not_mislabeled():
    data = build_playtest_snapshot([_history()], [])
    run = data["runs"][0]
    assert run["progress"]["assessed_turns"] == 3
    assert run["progress"]["longest_low_streak"] == 2
    assert run["progress"]["low_progress_percent"] == 66.7
    assert run["estimated_ai_cost_usd"] is None
    assert run["gpt61_same_tokens_usd"] is None
    assert data["summary"]["runs_with_two_low_in_a_row"] == 1


def test_multiple_rooms_do_not_leak_each_others_cost_or_stats():
    data = build_playtest_snapshot([_history("A"), _history("B", history=[])], [
        _event("A", cost=1000), _event("B", cost=2000, model="gpt-5.6-luna"),
    ])
    first, second = data["runs"]
    assert first["estimated_ai_cost_usd"] == .001
    assert second["estimated_ai_cost_usd"] == .002
    assert second["progress"]["low_progress_percent"] is None
    assert second["gpt61_same_tokens_usd"] is None


def test_never_fabricates_model_comparison_without_tokens():
    data = build_playtest_snapshot([_history()], [
        _event(inp=0, out=0, cost=7000),
    ])
    assert data["runs"][0]["gpt61_same_tokens_usd"] is None
    assert data["runs"][0]["estimated_ai_cost_usd"] == .007


def test_empty_and_malformed_history_are_handled_without_story_text():
    bad = _history()
    bad["director_history_json"] = "{ invalid"
    data = build_playtest_snapshot([bad], [])
    assert data["runs"][0]["progress"]["assessed_turns"] == 0
    assert "director_history_json" not in data["runs"][0]
    assert "scene_body" not in str(data)
    assert build_playtest_snapshot([], [])["summary"]["low_progress_percent"] is None


def test_nearest_rank_percentiles_and_no_missing_data_fabrication():
    assert _percentile([10, 20, 30, 40, 50], .5) == 30
    assert _percentile([10, 20, 30, 40, 50], .9) == 50
    assert _percentile([], .9) is None


@pytest.mark.asyncio
async def test_store_queries_existing_tables_in_one_batch_and_is_capped(tmp_path):
    path = tmp_path / "sample.sqlite"
    with connect_database(path) as db:
        db.execute("CREATE TABLE adventure_history (history_id TEXT PRIMARY KEY, room_code TEXT, adventure_id TEXT, adventure_title TEXT, turn_count INTEGER, director_history_json TEXT, completed_at TEXT)")
        db.execute("CREATE TABLE ai_usage_events (room_code TEXT, model TEXT, operation TEXT, status TEXT, input_tokens INTEGER, cached_input_tokens INTEGER, output_tokens INTEGER, estimated_cost_microusd INTEGER, latency_ms INTEGER)")
        for index in range(3):
            h = _history(str(index))
            db.execute("INSERT INTO adventure_history VALUES (?, ?, ?, ?, ?, ?, ?)", (
                str(index), h["room_code"], h["adventure_id"], h["adventure_title"],
                h["turn_count"], h["director_history_json"], f"2026-10-16T10:00:0{index}",
            ))
        db.execute("INSERT INTO ai_usage_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (
            "2", "gpt-5.6-sol", "director_story", "succeeded", 8000, 0, 1000, 52000, 2500,
        ))
        db.commit()
    snapshot = await PlaytestReportStore(path).snapshot(limit=1)
    assert snapshot["sample_limit"] == 1
    assert len(snapshot["runs"]) == 1
    assert snapshot["runs"][0]["room_code"] == "2"
    assert snapshot["runs"][0]["estimated_ai_cost_usd"] == .052
    assert "IN (%s)" in _translate_postgres_sql("SELECT * FROM ai_usage_events WHERE room_code IN (?)")


def test_admin_route_is_read_only_and_permission_guarded():
    from pathlib import Path
    source = (Path(__file__).resolve().parents[2] / "app/auth/routes.py").read_text()
    assert '@router.get("/admin/playtest-diagnostics")' in source
    assert "user=Depends(require_admin_user)" in source[source.index('async def admin_playtest_diagnostics'):][:250]
    assert "playtest_report_store.snapshot" in source
