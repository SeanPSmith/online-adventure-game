"""Distributed Story Time admission and privacy-limited operational counters.

All deployed speech workers use one DynamoDB table. Conditional writes and a
transaction serialize spend admissions; the GPU/EC2 runtime budget remains a
separate infrastructure safeguard, not an exact billing limit.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)
WINDOW_SECONDS = 300
DAILY_RETENTION_SECONDS = 45 * 86400
RATE_RETENTION_SECONDS = 2 * 86400


class LimitReached(Exception):
    pass


class MeterUnavailable(Exception):
    pass


def enabled() -> bool:
    return bool(os.getenv("STORY_TIME_METER_TABLE", "").strip())


def _limit(name: str, fallback: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(fallback))))
    except ValueError:
        return fallback


def limits() -> dict[str, int]:
    return {
        "window_requests": _limit("STORY_TIME_WINDOW_REQUEST_LIMIT", 50),
        "user_daily_generations": _limit("STORY_TIME_USER_DAILY_GENERATIONS", 300),
        "user_daily_characters": _limit("STORY_TIME_USER_DAILY_CHARACTERS", 180000),
        "global_daily_generations": _limit("STORY_TIME_GLOBAL_DAILY_GENERATIONS", 9000),
        "global_daily_characters": _limit("STORY_TIME_GLOBAL_DAILY_CHARACTERS", 5000000),
    }


def _identity(user_id: str) -> str:
    # Do not put raw account IDs, room names, or story prose in DynamoDB keys.
    return hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()


def _day(now: int) -> str:
    return datetime.fromtimestamp(now, timezone.utc).strftime("%Y-%m-%d")


def _table():
    import boto3
    return boto3.resource("dynamodb").Table(os.environ["STORY_TIME_METER_TABLE"])


def admit_request(user_id: str, *, now: int | None = None) -> None:
    """One 5-minute quota shared by all ECS replicas; counts cache hits too.

    This deliberately uses a fixed UTC window. AWS WAF must independently
    control anonymous, cross-account, IP-level and burst traffic at the edge.
    """
    if not enabled():
        return
    tick = int(time.time()) if now is None else now
    end = (tick // WINDOW_SECONDS + 1) * WINDOW_SECONDS
    key = f"rate#{_identity(user_id)}#{end}"
    try:
        _table().update_item(
            Key={"id": key},
            UpdateExpression="SET expires_at_epoch = :ttl ADD #requests :one",
            ConditionExpression="attribute_not_exists(#requests) OR #requests < :cap",
            ExpressionAttributeNames={"#requests": "requests"},
            ExpressionAttributeValues={":ttl": end + RATE_RETENTION_SECONDS,
                                       ":one": 1, ":cap": limits()["window_requests"]},
        )
    except Exception as exc:
        if _conditional_failure(exc):
            raise LimitReached("Narration request rate exceeded.") from exc
        logger.exception("story_time_rate_limit_backend_failure")
        raise MeterUnavailable("Narration capacity protection is unavailable.") from exc


def _conditional_failure(exc: Exception) -> bool:
    code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
    return code in {"ConditionalCheckFailedException", "TransactionCanceledException"}


def admit_generation(user_id: str, characters: int, *, now: int | None = None) -> None:
    """Atomically reserve BOTH per-account and global daily GPU generation quota.

    These are attempted inference reservations, not measured GPU dollars. Failed
    inference may still use compute. Cache hits never consume these quotas.
    """
    if not enabled():
        return
    tick = int(time.time()) if now is None else now
    day = _day(tick)
    uid = _identity(user_id)
    conf = limits()
    ttl = tick + DAILY_RETENTION_SECONDS
    if characters < 1 or characters > conf["user_daily_characters"]:
        raise LimitReached("Narration text is outside the daily allowance.")
    import boto3
    table_name = os.environ["STORY_TIME_METER_TABLE"]
    actions = []
    for key, max_jobs, max_chars in (
        (f"budget#{day}#{uid}", conf["user_daily_generations"], conf["user_daily_characters"]),
        (f"budget#{day}#GLOBAL", conf["global_daily_generations"], conf["global_daily_characters"]),
    ):
        actions.append({"Update": {
            "TableName": table_name,
            "Key": {"id": {"S": key}},
            "UpdateExpression": "SET expires_at_epoch = :ttl ADD #jobs :one, #chars :chars",
            "ConditionExpression": "(attribute_not_exists(#jobs) OR #jobs < :jobcap) AND "
                                   "(attribute_not_exists(#chars) OR #chars <= :remaining)",
            "ExpressionAttributeNames": {"#jobs": "jobs", "#chars": "chars"},
            "ExpressionAttributeValues": {
                ":ttl": {"N": str(ttl)}, ":one": {"N": "1"},
                ":chars": {"N": str(characters)}, ":jobcap": {"N": str(max_jobs)},
                ":remaining": {"N": str(max_chars - characters)},
            },
        }})
    try:
        boto3.client("dynamodb").transact_write_items(TransactItems=actions)
    except Exception as exc:
        if _conditional_failure(exc):
            # TransactionCanceledException can also mean an internal conflict.
            # Denying inference is safe either way; concurrent client may retry.
            raise LimitReached("Narration generation allowance reached or busy. Try again later.") from exc
        logger.exception("story_time_generation_quota_backend_failure")
        raise MeterUnavailable("Narration capacity protection is unavailable.") from exc


def preflight_generation(user_id: str, characters: int, *, now: int | None = None) -> None:
    """Read-only check BEFORE GPU wake. Atomic reservation remains authoritative."""
    if not enabled():
        return
    tick = int(time.time()) if now is None else now
    day = _day(tick)
    conf = limits()
    if characters < 1 or characters > conf["user_daily_characters"]:
        raise LimitReached("Narration passage exceeds the account allowance.")
    try:
        table = _table()
        for key, max_jobs, max_chars in (
            (f"budget#{day}#{_identity(user_id)}", conf["user_daily_generations"], conf["user_daily_characters"]),
            (f"budget#{day}#GLOBAL", conf["global_daily_generations"], conf["global_daily_characters"]),
        ):
            row = table.get_item(Key={"id": key}, ConsistentRead=True).get("Item", {})
            if int(row.get("jobs", 0)) >= max_jobs or int(row.get("chars", 0)) + characters > max_chars:
                raise LimitReached("Today's narrator generation allowance has been reached.")
    except LimitReached:
        raise
    except Exception as exc:
        logger.exception("story_time_budget_preflight_failed")
        raise MeterUnavailable("Narration protection is temporarily unavailable.") from exc


def record_result(user_id: str, source: str, *, bytes_sent: int = 0,
                  inference_ms: int = 0, now: int | None = None) -> None:
    """Best-effort aggregate metrics. Never persist prompts, text or raw voices."""
    if not enabled():
        return
    if source not in {"memory", "s3", "generated", "failed", "denied"}:
        return
    tick = int(time.time()) if now is None else now
    day = _day(tick)
    uid = _identity(user_id)
    ttl = tick + DAILY_RETENTION_SECONDS
    for owner in (uid, "GLOBAL"):
        try:
            _table().update_item(
                Key={"id": f"usage#{day}#{owner}"},
                UpdateExpression=("SET #day = :d, expires_at_epoch = :ttl, "
                                  "account_id = :who ADD #requests :one, "
                                  "#source :one, sent_bytes :bytes, inference_ms :ms"),
                ExpressionAttributeNames={"#day": "day", "#source": source, "#requests": "requests"},
                ExpressionAttributeValues={
                    ":d": day, ":ttl": ttl, ":who": user_id if owner != "GLOBAL" else "GLOBAL",
                    ":one": 1, ":bytes": max(0, bytes_sent), ":ms": max(0, inference_ms),
                },
            )
        except Exception:
            # Counting must not convert a successful generated MP3 into a 500.
            logger.exception("story_time_usage_telemetry_write_failed")


def record_denial(user_id: str, reason: str, *, now: int | None = None) -> None:
    """Account-level abuse signal, throttled to ONE event per account/reason/5m.

    An attacker repeatedly exceeding a limit cannot induce a stats-table write
    for every denied request. Edge-level rate limiting is still necessary.
    """
    if not enabled():
        return
    if reason not in {"rate", "generation"}:
        return
    tick = int(time.time()) if now is None else now
    key = f"denial#{_identity(user_id)}#{tick // WINDOW_SECONDS}#{reason}"
    try:
        _table().put_item(
            Item={"id": key, "expires_at_epoch": tick + DAILY_RETENTION_SECONDS},
            ConditionExpression="attribute_not_exists(id)",
        )
    except Exception as exc:
        if _conditional_failure(exc):
            return
        logger.warning("story_time_denial_signal_unavailable type=%s", type(exc).__name__)
        return
    record_result(user_id, "denied", now=tick)


def _rows_for_day(day: str) -> list[dict[str, Any]]:
    from boto3.dynamodb.conditions import Key
    table = _table()
    query = {"IndexName": "DayIndex", "KeyConditionExpression": Key("day").eq(day),
             "ConsistentRead": False}
    items: list[dict[str, Any]] = []
    while True:
        page = table.query(**query)
        items.extend(page.get("Items", []))
        if len(items) > 10000:
            raise ValueError("Story Time usage report exceeded safe row limit.")
        if "LastEvaluatedKey" not in page:
            break
        query["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    return items


def admin_snapshot(*, days: int = 7, now: int | None = None) -> dict[str, Any]:
    """Aggregates last N UTC days; scoped to the admin-only route."""
    conf = limits()
    if not enabled():
        return {"configured": False, "days": days, "totals": {}, "top_users": [],
                "alerts": [], "limits": conf}
    tick = int(time.time()) if now is None else now
    by_user: dict[str, dict[str, Any]] = {}
    totals = {k: 0 for k in ("requests", "memory", "s3", "generated", "failed", "denied", "sent_bytes", "inference_ms")}
    try:
        for offset in range(min(7, max(1, days))):
            day = _day(tick - offset * 86400)
            for item in _rows_for_day(day):
                if not str(item.get("id", "")).startswith("usage#"):
                    continue
                account = str(item.get("account_id", ""))
                if account == "GLOBAL":
                    for k in totals:
                        totals[k] += int(item.get(k, 0))
                    continue
                target = by_user.setdefault(account, {"user_id": account, "today_generated": 0,
                                                      "today_requests": 0, **{k: 0 for k in totals}})
                for k in totals:
                    target[k] += int(item.get(k, 0))
                if offset == 0:
                    target["today_generated"] += int(item.get("generated", 0))
                    target["today_requests"] += int(item.get("requests", 0))
    except Exception as exc:
        logger.exception("story_time_admin_meter_read_failed")
        raise MeterUnavailable("Narration monitoring is temporarily unavailable.") from exc
    users = sorted(by_user.values(), key=lambda row: (-row["generated"], -row["requests"], row["user_id"]))
    alerts = [
        {"user_id": row["user_id"],
         "reason": "Quota denials detected" if row["denied"] else "High narration generation volume",
         "generations": row["today_generated"], "requests": row["today_requests"]}
        for row in users if row["denied"] or row["today_generated"] >= conf["user_daily_generations"] * .7
    ]
    return {"configured": True, "days": days, "totals": totals,
            "top_users": users[:20], "alerts": alerts[:20], "limits": conf,
            "disclaimer": "Counts are per-user API events, not actual AWS dollars or EC2 runtime. "
                          "Global generation reservations may exceed completed recordings."}
