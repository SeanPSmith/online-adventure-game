from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class User:
    user_id: str
    email: str
    username: str
    created_at: datetime
    is_active: bool = True
    permissions: tuple[str, ...] = ()

    def has_permission(
        self,
        permission: str,
    ) -> bool:

        return (
            str(
                permission
            ).strip()
            in self.permissions
        )

    def public_data(self) -> dict:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "username": self.username,
            "created_at": self.created_at.isoformat(),
            "is_active": self.is_active,
            "permissions": list(
                self.permissions
            ),
        }


@dataclass(frozen=True)
class StoredUser:
    user_id: str
    email: str
    username: str
    password_hash: str
    created_at: datetime
    is_active: bool = True
    permissions: tuple[str, ...] = ()

    def to_user(self) -> User:
        return User(
            user_id=self.user_id,
            email=self.email,
            username=self.username,
            created_at=self.created_at,
            is_active=self.is_active,
            permissions=self.permissions,
        )


@dataclass(frozen=True)
class AuthSession:
    session_id: str
    user_id: str
    token_hash: str
    created_at: datetime
    expires_at: datetime
    last_seen_at: datetime

    @property
    def is_expired(self) -> bool:
        now = datetime.now(
            tz=self.expires_at.tzinfo
        )

        return now >= self.expires_at