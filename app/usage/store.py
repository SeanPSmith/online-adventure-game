from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.database import connect_database
from app.usage.pricing import dollars_from_microusd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_PATH = PROJECT_ROOT / "data" / "game_state.sqlite3"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None = None) -> str:
    return (value or _now()).isoformat()


def _money_env(name: str, default: str) -> int:
    raw = os.getenv(name, default).strip()
    try:
        return max(0, int(round(float(raw) * 1_000_000)))
    except ValueError:
        return int(round(float(default) * 1_000_000))


def _int_env(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default)).strip()))
    except ValueError:
        return default


class UsageLimitExceeded(RuntimeError):
    def __init__(self, message: str, *, code: str, snapshot: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.snapshot = snapshot or {}


@dataclass(frozen=True)
class Entitlement:
    user_id: str
    plan_id: str
    monthly_budget_microusd: int
    monthly_request_limit: int
    is_unlimited: bool
    source: str

    def public_data(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "plan_id": self.plan_id,
            "monthly_budget_usd": dollars_from_microusd(self.monthly_budget_microusd),
            "monthly_request_limit": self.monthly_request_limit,
            "is_unlimited": self.is_unlimited,
            "source": self.source,
        }


class AIUsageStore:
    def __init__(self, database_path: Path = DATABASE_PATH) -> None:
        self.database_path = database_path
        self._lock = asyncio.Lock()

    def _connect(self):
        return connect_database(self.database_path)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize_sync)

    def _initialize_sync(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_usage_events (
                    event_id TEXT PRIMARY KEY,
                    occurred_at TEXT NOT NULL,
                    period_key TEXT NOT NULL,
                    day_key TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    room_code TEXT,
                    adventure_id TEXT,
                    generated_adventure_id TEXT,
                    surface TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_tokens INTEGER NOT NULL DEFAULT 0,
                    cached_input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    total_tokens INTEGER NOT NULL DEFAULT 0,
                    estimated_cost_microusd INTEGER NOT NULL DEFAULT 0,
                    reserved_cost_microusd INTEGER NOT NULL DEFAULT 0,
                    latency_ms INTEGER NOT NULL DEFAULT 0,
                    error_type TEXT,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ai_usage_user_period
                ON ai_usage_events (user_id, period_key)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ai_usage_day
                ON ai_usage_events (day_key)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_entitlements (
                    user_id TEXT PRIMARY KEY,
                    plan_id TEXT NOT NULL,
                    monthly_budget_microusd INTEGER NOT NULL,
                    monthly_request_limit INTEGER NOT NULL,
                    is_unlimited INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    updated_by TEXT
                )
                """
            )
            stale_cutoff = _iso(_now() - timedelta(minutes=20))
            connection.execute(
                """
                UPDATE ai_usage_events
                SET status = 'failed', error_type = 'stale_reservation', reserved_cost_microusd = 0
                WHERE status = 'pending' AND occurred_at < ?
                """,
                (stale_cutoff,),
            )
            connection.commit()

    def _default_entitlement(self, user_id: str, *, admin: bool = False) -> Entitlement:
        return Entitlement(
            user_id=user_id,
            plan_id="operator" if admin else os.getenv("TOT_AI_DEFAULT_PLAN", "playtester").strip() or "playtester",
            monthly_budget_microusd=_money_env("TOT_AI_PLAYTESTER_MONTHLY_BUDGET_USD", "5.00"),
            monthly_request_limit=_int_env("TOT_AI_PLAYTESTER_MONTHLY_REQUEST_LIMIT", 500),
            is_unlimited=admin,
            source="admin_permission" if admin else "default",
        )

    def _is_admin_sync(self, connection, user_id: str) -> bool:
        row = connection.execute(
            "SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = 'admin' LIMIT 1",
            (user_id,),
        ).fetchone()
        return row is not None

    def _entitlement_sync(self, connection, user_id: str) -> Entitlement:
        admin = self._is_admin_sync(connection, user_id)
        row = connection.execute(
            "SELECT * FROM ai_entitlements WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return self._default_entitlement(user_id, admin=admin)
        return Entitlement(
            user_id=user_id,
            plan_id=str(row["plan_id"]),
            monthly_budget_microusd=max(0, int(row["monthly_budget_microusd"] or 0)),
            monthly_request_limit=max(0, int(row["monthly_request_limit"] or 0)),
            is_unlimited=bool(row["is_unlimited"]) or admin,
            source="admin_override" if not admin else "admin_permission+override",
        )

    async def entitlement(self, user_id: str) -> Entitlement:
        return await asyncio.to_thread(self._entitlement_read_sync, user_id)

    def _entitlement_read_sync(self, user_id: str) -> Entitlement:
        with self._connect() as connection:
            return self._entitlement_sync(connection, user_id)

    async def set_entitlement(
        self,
        *,
        user_id: str,
        plan_id: str,
        monthly_budget_microusd: int,
        monthly_request_limit: int,
        is_unlimited: bool,
        updated_by: str,
    ) -> Entitlement:
        async with self._lock:
            await asyncio.to_thread(
                self._set_entitlement_sync,
                user_id,
                plan_id,
                monthly_budget_microusd,
                monthly_request_limit,
                is_unlimited,
                updated_by,
            )
        return await self.entitlement(user_id)

    def _set_entitlement_sync(self, user_id, plan_id, monthly_budget_microusd, monthly_request_limit, is_unlimited, updated_by):
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO ai_entitlements (
                    user_id, plan_id, monthly_budget_microusd, monthly_request_limit,
                    is_unlimited, updated_at, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE SET
                    plan_id = excluded.plan_id,
                    monthly_budget_microusd = excluded.monthly_budget_microusd,
                    monthly_request_limit = excluded.monthly_request_limit,
                    is_unlimited = excluded.is_unlimited,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
                """,
                (
                    user_id,
                    (plan_id or "playtester").strip()[:64],
                    max(0, int(monthly_budget_microusd)),
                    max(0, int(monthly_request_limit)),
                    1 if is_unlimited else 0,
                    _iso(),
                    updated_by,
                ),
            )
            connection.commit()

    def _period_usage_sync(self, connection, user_id: str, period_key: str) -> tuple[int, int, int, int, int]:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS requests,
                COALESCE(SUM(estimated_cost_microusd), 0) AS spent,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN reserved_cost_microusd ELSE 0 END), 0) AS reserved,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens
            FROM ai_usage_events
            WHERE user_id = ? AND period_key = ?
            """,
            (user_id, period_key),
        ).fetchone()
        return (
            int(row["requests"] or 0),
            int(row["spent"] or 0),
            int(row["reserved"] or 0),
            int(row["input_tokens"] or 0),
            int(row["output_tokens"] or 0),
        )

    async def begin_event(
        self,
        *,
        user_id: str,
        room_code: str | None,
        adventure_id: str | None,
        generated_adventure_id: str | None,
        surface: str,
        operation: str,
        provider: str,
        model: str,
        reserved_cost_microusd: int,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        async with self._lock:
            return await asyncio.to_thread(
                self._begin_event_sync,
                user_id,
                room_code,
                adventure_id,
                generated_adventure_id,
                surface,
                operation,
                provider,
                model,
                reserved_cost_microusd,
                metadata or {},
            )

    def _begin_event_sync(self, user_id, room_code, adventure_id, generated_adventure_id, surface, operation, provider, model, reserved_cost_microusd, metadata):
        now = _now()
        period_key = now.strftime("%Y-%m")
        day_key = now.strftime("%Y-%m-%d")
        with self._connect() as connection:
            entitlement = self._entitlement_sync(connection, user_id)
            requests, spent, reserved, _, _ = self._period_usage_sync(connection, user_id, period_key)

            day = connection.execute(
                """
                SELECT COUNT(*) AS requests,
                       COALESCE(SUM(estimated_cost_microusd), 0) AS spent,
                       COALESCE(SUM(CASE WHEN status = 'pending' THEN reserved_cost_microusd ELSE 0 END), 0) AS reserved
                FROM ai_usage_events WHERE day_key = ?
                """,
                (day_key,),
            ).fetchone()
            day_requests = int(day["requests"] or 0)
            day_spent = int(day["spent"] or 0)
            day_reserved = int(day["reserved"] or 0)

            global_daily_budget = _money_env("TOT_AI_GLOBAL_DAILY_BUDGET_USD", "25.00")
            global_daily_requests = _int_env("TOT_AI_GLOBAL_DAILY_REQUEST_LIMIT", 1500)
            requested_reserve = max(0, int(reserved_cost_microusd or 0))

            snapshot = {
                "period_key": period_key,
                "requests": requests,
                "spent_usd": dollars_from_microusd(spent),
                "reserved_usd": dollars_from_microusd(reserved),
                "plan": entitlement.public_data(),
            }

            if global_daily_requests and day_requests >= global_daily_requests:
                raise UsageLimitExceeded(
                    "The Tales of Two AI service has reached its daily request safety ceiling. Try again after the daily reset.",
                    code="global_daily_request_limit",
                    snapshot=snapshot,
                )
            if global_daily_budget and day_spent + day_reserved + requested_reserve > global_daily_budget:
                raise UsageLimitExceeded(
                    "The Tales of Two AI service has reached its daily spend safety ceiling. Try again after the daily reset.",
                    code="global_daily_budget",
                    snapshot=snapshot,
                )
            if not entitlement.is_unlimited:
                if requests >= entitlement.monthly_request_limit:
                    raise UsageLimitExceeded(
                        "Your playtest AI request allowance has been used for this month.",
                        code="monthly_request_limit",
                        snapshot=snapshot,
                    )
                if spent + reserved + requested_reserve > entitlement.monthly_budget_microusd:
                    raise UsageLimitExceeded(
                        "Your playtest AI allowance has been used for this month.",
                        code="monthly_budget",
                        snapshot=snapshot,
                    )

            event_id = uuid.uuid4().hex
            connection.execute(
                """
                INSERT INTO ai_usage_events (
                    event_id, occurred_at, period_key, day_key, user_id, room_code,
                    adventure_id, generated_adventure_id, surface, operation, provider,
                    model, status, reserved_cost_microusd, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (
                    event_id, _iso(now), period_key, day_key, user_id, room_code,
                    adventure_id, generated_adventure_id, surface or "unknown",
                    operation, provider, model, requested_reserve,
                    json.dumps(metadata, ensure_ascii=False, separators=(",", ":")),
                ),
            )
            connection.commit()
            return event_id

    async def finish_event(
        self,
        *,
        event_id: str,
        status: str,
        input_tokens: int = 0,
        cached_input_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: int = 0,
        estimated_cost_microusd: int = 0,
        latency_ms: int = 0,
        error_type: str | None = None,
    ) -> None:
        await asyncio.to_thread(
            self._finish_event_sync,
            event_id,
            status,
            input_tokens,
            cached_input_tokens,
            output_tokens,
            total_tokens,
            estimated_cost_microusd,
            latency_ms,
            error_type,
        )

    def _finish_event_sync(self, event_id, status, input_tokens, cached_input_tokens, output_tokens, total_tokens, estimated_cost_microusd, latency_ms, error_type):
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE ai_usage_events
                SET status = ?, input_tokens = ?, cached_input_tokens = ?, output_tokens = ?,
                    total_tokens = ?, estimated_cost_microusd = ?, reserved_cost_microusd = 0,
                    latency_ms = ?, error_type = ?
                WHERE event_id = ?
                """,
                (
                    status,
                    max(0, int(input_tokens or 0)),
                    max(0, int(cached_input_tokens or 0)),
                    max(0, int(output_tokens or 0)),
                    max(0, int(total_tokens or 0)),
                    max(0, int(estimated_cost_microusd or 0)),
                    max(0, int(latency_ms or 0)),
                    error_type,
                    event_id,
                ),
            )
            connection.commit()

    async def user_snapshot(self, user_id: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._user_snapshot_sync, user_id)

    def _user_snapshot_sync(self, user_id: str) -> dict[str, Any]:
        now = _now()
        period_key = now.strftime("%Y-%m")
        with self._connect() as connection:
            entitlement = self._entitlement_sync(connection, user_id)
            requests, spent, reserved, input_tokens, output_tokens = self._period_usage_sync(connection, user_id, period_key)
            remaining = None if entitlement.is_unlimited else max(0, entitlement.monthly_budget_microusd - spent - reserved)
            return {
                "period_key": period_key,
                "entitlement": entitlement.public_data(),
                "usage": {
                    "requests": requests,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "estimated_cost_usd": dollars_from_microusd(spent),
                    "reserved_usd": dollars_from_microusd(reserved),
                    "remaining_budget_usd": None if remaining is None else dollars_from_microusd(remaining),
                },
            }

    async def admin_snapshot(self, *, limit: int = 20) -> dict[str, Any]:
        return await asyncio.to_thread(self._admin_snapshot_sync, limit)

    def _admin_snapshot_sync(self, limit: int) -> dict[str, Any]:
        now = _now()
        period_key = now.strftime("%Y-%m")
        day_key = now.strftime("%Y-%m-%d")
        with self._connect() as connection:
            totals = connection.execute(
                """
                SELECT COUNT(*) AS requests,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(estimated_cost_microusd), 0) AS cost,
                       COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
                       COALESCE(AVG(CASE WHEN latency_ms > 0 THEN latency_ms ELSE NULL END), 0) AS latency_ms
                FROM ai_usage_events WHERE period_key = ?
                """,
                (period_key,),
            ).fetchone()
            today = connection.execute(
                """
                SELECT COUNT(*) AS requests, COALESCE(SUM(estimated_cost_microusd), 0) AS cost
                FROM ai_usage_events WHERE day_key = ?
                """,
                (day_key,),
            ).fetchone()
            users = connection.execute(
                """
                SELECT ai_usage_events.user_id,
                       COALESCE(users.username, 'DELETED ACCOUNT') AS username,
                       COUNT(*) AS requests,
                       COALESCE(SUM(ai_usage_events.input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(ai_usage_events.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(ai_usage_events.estimated_cost_microusd), 0) AS cost,
                       COALESCE(SUM(CASE WHEN ai_usage_events.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
                FROM ai_usage_events
                LEFT JOIN users ON users.user_id = ai_usage_events.user_id
                WHERE ai_usage_events.period_key = ?
                GROUP BY ai_usage_events.user_id, users.username
                ORDER BY cost DESC, requests DESC
                LIMIT ?
                """,
                (period_key, max(1, min(100, int(limit)))),
            ).fetchall()
            operations = connection.execute(
                """
                SELECT operation, model, COUNT(*) AS requests,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(estimated_cost_microusd), 0) AS cost,
                       COALESCE(AVG(CASE WHEN latency_ms > 0 THEN latency_ms ELSE NULL END), 0) AS latency_ms
                FROM ai_usage_events WHERE period_key = ?
                GROUP BY operation, model
                ORDER BY cost DESC
                """,
                (period_key,),
            ).fetchall()
            return {
                "generated_at": _iso(now),
                "period_key": period_key,
                "guardrails": {
                    "global_daily_budget_usd": dollars_from_microusd(_money_env("TOT_AI_GLOBAL_DAILY_BUDGET_USD", "25.00")),
                    "global_daily_request_limit": _int_env("TOT_AI_GLOBAL_DAILY_REQUEST_LIMIT", 1500),
                    "default_playtester_budget_usd": dollars_from_microusd(_money_env("TOT_AI_PLAYTESTER_MONTHLY_BUDGET_USD", "5.00")),
                    "default_playtester_request_limit": _int_env("TOT_AI_PLAYTESTER_MONTHLY_REQUEST_LIMIT", 500),
                },
                "today": {
                    "requests": int(today["requests"] or 0),
                    "estimated_cost_usd": dollars_from_microusd(int(today["cost"] or 0)),
                },
                "month": {
                    "requests": int(totals["requests"] or 0),
                    "failed_requests": int(totals["failed"] or 0),
                    "input_tokens": int(totals["input_tokens"] or 0),
                    "output_tokens": int(totals["output_tokens"] or 0),
                    "estimated_cost_usd": dollars_from_microusd(int(totals["cost"] or 0)),
                    "average_latency_ms": int(float(totals["latency_ms"] or 0)),
                },
                "top_users": [
                    {
                        "user_id": str(row["user_id"]),
                        "username": str(row["username"]),
                        "requests": int(row["requests"] or 0),
                        "failed_requests": int(row["failed"] or 0),
                        "input_tokens": int(row["input_tokens"] or 0),
                        "output_tokens": int(row["output_tokens"] or 0),
                        "estimated_cost_usd": dollars_from_microusd(int(row["cost"] or 0)),
                    }
                    for row in users
                ],
                "operations": [
                    {
                        "operation": str(row["operation"]),
                        "model": str(row["model"]),
                        "requests": int(row["requests"] or 0),
                        "input_tokens": int(row["input_tokens"] or 0),
                        "output_tokens": int(row["output_tokens"] or 0),
                        "estimated_cost_usd": dollars_from_microusd(int(row["cost"] or 0)),
                        "average_latency_ms": int(float(row["latency_ms"] or 0)),
                    }
                    for row in operations
                ],
            }


ai_usage_store = AIUsageStore()
