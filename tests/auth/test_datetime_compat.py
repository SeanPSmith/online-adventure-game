from datetime import datetime, timezone

from app.auth.store import SQLiteAuthStore, _coerce_datetime


def test_coerce_datetime_accepts_iso_text():
    parsed = _coerce_datetime("2026-09-30T23:58:34+00:00")

    assert parsed == datetime(
        2026,
        9,
        30,
        23,
        58,
        34,
        tzinfo=timezone.utc,
    )


def test_coerce_datetime_accepts_postgres_datetime():
    value = datetime(
        2026,
        9,
        30,
        23,
        58,
        34,
        tzinfo=timezone.utc,
    )

    assert _coerce_datetime(value) is value


def test_row_to_user_accepts_postgres_datetime():
    created_at = datetime(
        2026,
        9,
        30,
        23,
        58,
        34,
        tzinfo=timezone.utc,
    )

    user = SQLiteAuthStore._row_to_user(
        {
            "user_id": "user-1",
            "email": "test@example.com",
            "username": "tester",
            "password_hash": "hash",
            "created_at": created_at,
            "is_active": 1,
            "permissions": "author,publish",
        }
    )

    assert user is not None
    assert user.created_at == created_at
    assert user.permissions == ("author", "publish")


def test_row_to_session_accepts_postgres_datetimes():
    created_at = datetime(2026, 9, 30, 23, 0, tzinfo=timezone.utc)
    expires_at = datetime(2026, 10, 30, 23, 0, tzinfo=timezone.utc)
    last_seen_at = datetime(2026, 9, 30, 23, 5, tzinfo=timezone.utc)

    session = SQLiteAuthStore._row_to_session(
        {
            "session_id": "session-1",
            "user_id": "user-1",
            "token_hash": "token-hash",
            "created_at": created_at,
            "expires_at": expires_at,
            "last_seen_at": last_seen_at,
        }
    )

    assert session is not None
    assert session.created_at == created_at
    assert session.expires_at == expires_at
    assert session.last_seen_at == last_seen_at
