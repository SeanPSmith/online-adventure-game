"""Read-only, bounded diagnostics for completed live adventures.

No story text, prompts, character biographies or player identifiers leave this API.
Results use already-persisted history and AI usage events; no model calls.
"""
from __future__ import annotations

import asyncio
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.database import connect_database
from app.usage.pricing import estimate_cost_microusd

DATABASE_PATH = Path(__file__).resolve().parents[2] / "data" / "game_state.sqlite3"
MAX_RUNS = 40


def _percentile(values: list[int], fraction: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)]


def _progress_counts(serialized: str) -> dict[str, Any]:
    counts = {"low": 0, "scene_shift": 0, "substantive": 0, "unknown": 0}
    examined = 0
    longest_low_streak = 0
    streak = 0
    try:
        history = json.loads(serialized or "[]")
    except (TypeError, ValueError):
        history = []
    if not isinstance(history, list):
        history = []
    for turn in history:
        progress = turn.get("narrative_progress") if isinstance(turn, dict) else None
        level = progress.get("level") if isinstance(progress, dict) else None
        if level not in counts:
            streak = 0
            continue
        counts[level] += 1
        if level != "unknown":
            examined += 1
        if level == "low":
            streak += 1
            longest_low_streak = max(longest_low_streak, streak)
        else:
            streak = 0
    return {
        "counts": counts, "assessed_turns": examined,
        "longest_low_streak": longest_low_streak,
        "low_progress_percent": round(100 * counts["low"] / examined, 1) if examined else None,
    }


def build_playtest_snapshot(completions: list[dict], usage_events: list[dict]) -> dict:
    """Pure assembly for PostgreSQL/SQLite adapters and tests."""
    grouped: dict[str, list[dict]] = defaultdict(list)
    for event in usage_events:
        grouped[str(event.get("room_code") or "")].append(event)

    runs: list[dict] = []
    for completion in completions:
        room = str(completion["room_code"])
        progress = _progress_counts(completion.get("director_history_json") or "[]")
        events = grouped.get(room, [])
        cost = 0
        projected = 0
        story_latencies: list[int] = []
        repairs = failures = switched_calls = comparable_calls = 0
        models: set[str] = set()
        for event in events:
            model = str(event.get("model") or "").lower()
            operation = str(event.get("operation") or "")
            status = str(event.get("status") or "")
            models.add(model)
            microusd = max(0, int(event.get("estimated_cost_microusd") or 0))
            cost += microusd
            projected += microusd
            if status == "failed":
                failures += 1
            if "repair" in operation:
                repairs += 1
            latency = max(0, int(event.get("latency_ms") or 0))
            if operation == "director_story" and status == "succeeded" and latency:
                story_latencies.append(latency)
            # A counterfactual pricing calculation, NOT an actual GPT-6.1 run.
            # Only Sol calls with real token counts are comparable. All other
            # model costs stay fixed, including recap and repair models.
            if model == "gpt-5.6-sol" and status == "succeeded":
                tokens_in = max(0, int(event.get("input_tokens") or 0))
                tokens_out = max(0, int(event.get("output_tokens") or 0))
                if tokens_in + tokens_out > 0:
                    comparable_calls += 1
                    switched_calls += 1
                    simulated = estimate_cost_microusd(
                        model="gpt-6.1-sol", input_tokens=tokens_in,
                        cached_input_tokens=max(0, int(event.get("cached_input_tokens") or 0)),
                        output_tokens=tokens_out,
                    )
                    projected += simulated - microusd

        has_metering = bool(events)
        runs.append({
            "room_code": room,
            "adventure_id": str(completion.get("adventure_id") or ""),
            "adventure_title": str(completion.get("adventure_title") or ""),
            "completed_at": str(completion.get("completed_at") or ""),
            "turns": max(0, int(completion.get("turn_count") or 0)),
            "progress": progress,
            "ai_requests": len(events),
            "ai_failures": failures,
            "repair_calls": repairs,
            "story_latency_p50_ms": _percentile(story_latencies, .5),
            "story_latency_p90_ms": _percentile(story_latencies, .9),
            "estimated_ai_cost_usd": round(cost / 1_000_000, 6) if has_metering else None,
            "gpt61_same_tokens_usd": round(projected / 1_000_000, 6) if comparable_calls else None,
            "gpt61_comparable_calls": comparable_calls,
            "models": sorted(models),
        })

    measured = [r for r in runs if r["estimated_ai_cost_usd"] is not None]
    progress_runs = [r for r in runs if r["progress"]["assessed_turns"]]
    total_assessed = sum(r["progress"]["assessed_turns"] for r in progress_runs)
    total_low = sum(r["progress"]["counts"]["low"] for r in progress_runs)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sample_limit": MAX_RUNS,
        "summary": {
            "completed_runs": len(runs),
            "runs_with_ai_metering": len(measured),
            "runs_with_progress_data": len(progress_runs),
            "total_assessed_turns": total_assessed,
            "low_progress_percent": round(total_low * 100 / total_assessed, 1) if total_assessed else None,
            "runs_with_two_low_in_a_row": sum(r["progress"]["longest_low_streak"] >= 2 for r in runs),
            "sample_estimated_ai_cost_usd": round(sum(r["estimated_ai_cost_usd"] for r in measured), 6),
        },
        "runs": runs,
        "limits": {
            "costs": "Estimated OpenAI usage only; excludes GPU, storage, AWS overhead, retries without usage details, and taxes.",
            "comparison": "GPT-6.1 Sol uses the same measured token counts as successful GPT-5.6 Sol calls; not an actual latency or quality benchmark. Other models unchanged.",
            "timing": "Latency is provider call latency, not chapter readiness or session playtime. Session duration is not currently recorded.",
            "progress": "Momentum is a heuristic from committed state; earlier chapters without assessments are not scored.",
        },
    }


class PlaytestReportStore:
    def __init__(self, database_path: Path = DATABASE_PATH):
        self.database_path = database_path

    async def snapshot(self, limit: int = 20) -> dict:
        return await asyncio.to_thread(self._snapshot, limit)

    def _snapshot(self, limit: int) -> dict:
        cap = max(1, min(MAX_RUNS, int(limit)))
        with connect_database(self.database_path) as db:
            history = [dict(row) for row in db.execute(
                "SELECT room_code, adventure_id, adventure_title, turn_count, "
                "director_history_json, completed_at "
                "FROM adventure_history ORDER BY completed_at DESC, history_id DESC LIMIT ?",
                (cap,),
            ).fetchall()]
            events = []
            if history:
                placeholders = ", ".join("?" for _ in history)
                events = [dict(row) for row in db.execute(
                    "SELECT room_code, model, operation, status, input_tokens, "
                    "cached_input_tokens, output_tokens, estimated_cost_microusd, latency_ms "
                    f"FROM ai_usage_events WHERE room_code IN ({placeholders})",
                    tuple(item["room_code"] for item in history),
                ).fetchall()]
        result = build_playtest_snapshot(history, events)
        result["sample_limit"] = cap
        return result


playtest_report_store = PlaytestReportStore()
