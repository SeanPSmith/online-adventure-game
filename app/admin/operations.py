"""Private operator telemetry. No story text or provider prompts are collected."""
from __future__ import annotations
import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from app.database import connect_database

DATABASE_PATH = Path(__file__).resolve().parents[2] / 'data' / 'game_state.sqlite3'

def insert_action(db, actor_id, action, target_id, details=None):
    db.execute('INSERT INTO operator_actions (event_id, occurred_at, actor_id, action, target_id, details_json) VALUES (?, ?, ?, ?, ?, ?)',
               (str(uuid.uuid4()), datetime.now(timezone.utc).isoformat(), actor_id, action, target_id, json.dumps(details or {})))


class OperationsStore:
    def __init__(self, database_path=DATABASE_PATH):
        self.database_path = database_path

    async def initialize(self):
        await asyncio.to_thread(self._initialize)

    def _initialize(self):
        with connect_database(self.database_path) as db:
            db.execute('''CREATE TABLE IF NOT EXISTS operator_actions (
                event_id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL,
                actor_id TEXT NOT NULL, action TEXT NOT NULL,
                target_id TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}'
            )''')
            db.execute('''CREATE TABLE IF NOT EXISTS qte_outcomes (
                event_id TEXT PRIMARY KEY, room_code TEXT NOT NULL,
                occurred_at TEXT NOT NULL, timed_out INTEGER NOT NULL DEFAULT 0
            )''')
            db.commit()

    async def audit(self, actor_id, action, target_id, details=None):
        await asyncio.to_thread(self._audit, actor_id, action, target_id, details or {})

    def _audit(self, actor_id, action, target_id, details):
        with connect_database(self.database_path) as db:
            insert_action(db, actor_id, action, target_id, details)
            db.commit()

    async def set_pause(self, actor_id, paused):
        await asyncio.to_thread(self._set_pause, actor_id, paused)

    def _set_pause(self, actor_id, paused):
        with connect_database(self.database_path) as db:
            db.execute("UPDATE ai_controls SET paused = ? WHERE control_id = 'global'", (int(paused),))
            insert_action(db, actor_id, 'ai_pause' if paused else 'ai_resume', 'global')
            db.commit()

    async def set_account_active(self, actor_id, user_id, enabled):
        await asyncio.to_thread(self._set_account_active, actor_id, user_id, enabled)

    def _set_account_active(self, actor_id, user_id, enabled):
        with connect_database(self.database_path) as db:
            if db.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,)).fetchone() is None:
                raise LookupError('User not found.')
            if db.execute("SELECT user_id FROM user_permissions WHERE user_id = ? AND permission = 'admin'", (user_id,)).fetchone():
                raise PermissionError('Administrator accounts cannot be disabled here.')
            db.execute('UPDATE users SET is_active = ? WHERE user_id = ?', (int(enabled), user_id))
            if not enabled:
                db.execute('DELETE FROM auth_sessions WHERE user_id = ?', (user_id,))
            insert_action(db, actor_id, 'account_enable' if enabled else 'account_disable', user_id)
            db.commit()

    async def record_qte(self, room_code, event):
        event_id = str(event.get('id') or '')
        if not event_id:
            return
        timed_out = any(value == '__timeout__' for value in event.get('responses', {}).values())
        await asyncio.to_thread(self._record_qte, room_code, event_id, timed_out)

    def _record_qte(self, room_code, event_id, timed_out):
        with connect_database(self.database_path) as db:
            db.execute('''INSERT INTO qte_outcomes (event_id, room_code, occurred_at, timed_out) VALUES (?, ?, ?, ?)
                ON CONFLICT(event_id) DO NOTHING''', (f'{room_code}:{event_id}', room_code, datetime.now(timezone.utc).isoformat(), int(timed_out)))
            db.commit()

    async def snapshot(self):
        return await asyncio.to_thread(self._snapshot)

    def _snapshot(self):
        now = datetime.now(timezone.utc)
        month, day = now.strftime('%Y-%m'), now.strftime('%Y-%m-%d')
        with connect_database(self.database_path) as db:
            controls = db.execute("SELECT paused FROM ai_controls WHERE control_id = 'global'").fetchone()
            totals = db.execute('''SELECT COUNT(*) AS requests,
                COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
                COALESCE(SUM(CASE WHEN operation LIKE '%repair%' THEN 1 ELSE 0 END), 0) AS repairs,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
                COALESCE(AVG(CASE WHEN latency_ms > 0 THEN latency_ms ELSE NULL END), 0) AS latency_ms
                FROM ai_usage_events WHERE period_key = ?''', (month,)).fetchone()
            retry_rows = db.execute("SELECT metadata_json FROM ai_usage_events WHERE period_key = ?", (month,)).fetchall()
            retry_calls = 0
            retry_sample_calls = 0
            for row in retry_rows:
                try:
                    marker = json.loads(row['metadata_json']).get('retry_attempt')
                    if isinstance(marker, bool):
                        retry_sample_calls += 1
                        retry_calls += int(marker)
                except (ValueError, TypeError, AttributeError):
                    pass
            today = db.execute('''SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN reserved_cost_microusd ELSE 0 END), 0) AS reserved
                FROM ai_usage_events WHERE day_key = ?''', (day,)).fetchone()
            adventures = db.execute('''SELECT adventure_id, room_code, COUNT(*) AS requests,
                COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(SUM(estimated_cost_microusd), 0) AS cost,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN reserved_cost_microusd ELSE 0 END), 0) AS reserved,
                COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
                FROM ai_usage_events WHERE period_key = ? GROUP BY adventure_id, room_code
                ORDER BY cost DESC, requests DESC LIMIT 40''', (month,)).fetchall()
            failures = db.execute('''SELECT event_id, occurred_at, room_code, adventure_id, user_id,
                operation, model, error_type, latency_ms FROM ai_usage_events
                WHERE status = 'failed' AND period_key = ? ORDER BY occurred_at DESC LIMIT 40''', (month,)).fetchall()
            actions = db.execute('''SELECT event_id, occurred_at, actor_id, action, target_id, details_json,
                COALESCE(actor.username, actor_id) AS actor_label, COALESCE(target.username, target_id) AS target_label
                FROM operator_actions LEFT JOIN users AS actor ON actor.user_id = actor_id
                LEFT JOIN users AS target ON target.user_id = target_id
                ORDER BY occurred_at DESC LIMIT 40''').fetchall()
            qte = db.execute('SELECT COUNT(*) AS resolved, COALESCE(SUM(timed_out), 0) AS timed_out FROM qte_outcomes').fetchone()
            completed = int(db.execute('SELECT COUNT(*) AS count FROM adventure_history').fetchone()['count'])
            abandoned = int(db.execute('SELECT COUNT(DISTINCT room_code) AS count FROM abandoned_adventures').fetchone()['count'])
            rows = db.execute('SELECT room_code, payload FROM room_snapshots').fetchall()
            active, lobbies, started = 0, 0, set()
            for row in rows:
                try:
                    game = json.loads(row['payload'])['game']
                except (ValueError, KeyError, TypeError):
                    continue
                if game.get('started', True): started.add(row['room_code'])
                if not game.get('completed'):
                    if game.get('started', True): active += 1
                    else: lobbies += 1
            # Union retained records by room code: avoids counting completed snapshots twice.
            for row in db.execute('SELECT room_code FROM adventure_history').fetchall(): started.add(row['room_code'])
            for row in db.execute('SELECT room_code, payload FROM abandoned_adventures').fetchall():
                payload = json.loads(row['payload'])
                if payload.get('started', int(payload.get('turn_count', 0)) > 1): started.add(row['room_code'])
        requests = int(totals['requests'])
        return {
            'generated_at': now.isoformat(), 'period_key': month, 'ai_paused': bool(controls and controls['paused']),
            'metrics': {'requests': requests, 'failed': int(totals['failed']), 'repairs': int(totals['repairs']),
                'retry_calls': retry_calls, 'retry_sample_calls': retry_sample_calls,
                'retry_call_share': round(retry_calls / retry_sample_calls * 100, 1) if retry_sample_calls else None,
                'pending': int(totals['pending']), 'average_latency_ms': round(float(totals['latency_ms'])),
                'failure_rate': round(int(totals['failed']) / requests * 100, 1) if requests else 0,
                'repair_call_share': round(int(totals['repairs']) / requests * 100, 1) if requests else 0,
                'reserved_today_usd': int(today['reserved']) / 1_000_000},
            'lifecycle': {'started_retained': len(started), 'active': active, 'lobbies': lobbies, 'completed': completed, 'abandoned': abandoned},
            'qte': {'resolved': int(qte['resolved']), 'timed_out': int(qte['timed_out']),
                'timeout_rate': round(int(qte['timed_out']) / int(qte['resolved']) * 100, 1) if qte['resolved'] else None},
            'adventures': [dict(row, estimated_cost_usd=int(row['cost']) / 1_000_000, reserved_usd=int(row['reserved']) / 1_000_000) for row in adventures],
            'failures': [dict(row) for row in failures],
            'actions': [dict(row, details=json.loads(row['details_json'])) for row in actions],
        }

operations_store = OperationsStore()
