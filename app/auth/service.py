from __future__ import annotations

import os

from dataclasses import dataclass
from uuid import uuid4

from app.auth.models import (
    AuthSession,
    User,
)

from app.auth.providers.base import (
    AuthProvider,
)

from app.auth.providers.local import (
    local_auth_provider,
)

from app.auth.sessions import (
    generate_session_token,
    hash_session_token,
    utc_now,
)

from app.auth.store import (
    auth_store,
)


def _env_csv(
    name: str,
) -> tuple[str, ...]:

    return tuple(
        value.strip()
        for value in os.getenv(name, "").split(",")
        if value.strip()
    )


# =========================================================
# LOGIN RESULT
# =========================================================

@dataclass(
    frozen=True
)
class LoginResult:

    user: User

    session: AuthSession

    session_token: str


# =========================================================
# AUTH SERVICE
# =========================================================

class AuthService:

    def __init__(
        self,
        provider: AuthProvider,
    ) -> None:

        self.provider = provider


    # =====================================================
    # INITIALIZE
    # =====================================================

    async def initialize(
        self,
    ) -> None:

        await auth_store.initialize()

        await auth_store.purge_expired_sessions(
            utc_now()
        )


        # One-way migration from the old shell allowlist into durable account
        # permissions. Once granted, author access survives terminal/server
        # restarts even if those environment variables disappear.
        for raw_user_id in (
            os.getenv(
                "TOT_AUTHOR_USER_IDS",
                "",
            )
            .split(",")
        ):

            user_id = raw_user_id.strip()


            if user_id:

                await auth_store.grant_permission(
                    user_id,
                    "author",
                )


                await auth_store.grant_permission(
                    user_id,
                    "publish",
                )


        for raw_username in (
            os.getenv(
                "TOT_AUTHOR_USERNAMES",
                "",
            )
            .split(",")
        ):

            username = raw_username.strip()


            if username:

                await auth_store.grant_permission_by_username(
                    username,
                    "author",
                )


                await auth_store.grant_permission_by_username(
                    username,
                    "publish",
                )


        # Administrator bootstraps are intentionally one-way into durable
        # database permissions. Admin implies Author + Publish, but the admin
        # portal never grants the admin permission itself.
        for raw_user_id in _env_csv(
            "TOT_ADMIN_USER_IDS"
        ):

            for permission in (
                "admin",
                "author",
                "publish",
            ):

                await auth_store.grant_permission(
                    raw_user_id,
                    permission,
                )


        for raw_username in _env_csv(
            "TOT_ADMIN_USERNAMES"
        ):

            for permission in (
                "admin",
                "author",
                "publish",
            ):

                await auth_store.grant_permission_by_username(
                    raw_username,
                    permission,
                )


    async def _apply_configured_permissions(
        self,
        user: User,
    ) -> User:

        username_key = user.username.casefold()
        user_id = str(user.user_id)

        author_match = (
            user_id in _env_csv("TOT_AUTHOR_USER_IDS")
            or any(
                username_key == candidate.casefold()
                for candidate in _env_csv("TOT_AUTHOR_USERNAMES")
            )
        )

        admin_match = (
            user_id in _env_csv("TOT_ADMIN_USER_IDS")
            or any(
                username_key == candidate.casefold()
                for candidate in _env_csv("TOT_ADMIN_USERNAMES")
            )
        )

        permissions: tuple[str, ...] = ()

        if author_match:
            permissions += ("author", "publish")

        if admin_match:
            permissions += ("admin", "author", "publish")

        for permission in dict.fromkeys(permissions):
            await auth_store.grant_permission(
                user_id,
                permission,
            )

        refreshed = await auth_store.get_user_by_id(
            user_id
        )

        return (
            refreshed.to_user()
            if refreshed is not None
            else user
        )


    # =====================================================
    # REGISTER
    # =====================================================

    async def register(
        self,
        email: str,
        username: str,
        password: str,
    ) -> User:

        stored_user = (
            await self.provider.register(
                email=
                    email,

                username=
                    username,

                password=
                    password,
            )
        )


        user = (
            stored_user.to_user()
        )


        user = await self._apply_configured_permissions(
            user
        )


        print(
            f"[AUTH REGISTER] "
            f"{user.username} | "
            f"{user.user_id}"
        )


        return user


    # =====================================================
    # LOGIN
    # =====================================================

    async def login(
        self,
        identifier: str,
        password: str,
    ) -> LoginResult:

        stored_user = (
            await self.provider.authenticate(
                identifier=
                    identifier,

                password=
                    password,
            )
        )


        token = (
            generate_session_token()
        )


        session = AuthSession(

            session_id=
                str(
                    uuid4()
                ),

            user_id=
                stored_user.user_id,

            token_hash=
                token.token_hash,

            created_at=
                token.created_at,

            expires_at=
                token.expires_at,

            last_seen_at=
                token.created_at,
        )


        await auth_store.create_session(
            session
        )


        user = (
            stored_user.to_user()
        )


        print(
            f"[AUTH LOGIN] "
            f"{user.username} | "
            f"{user.user_id}"
        )


        return LoginResult(

            user=
                user,

            session=
                session,

            session_token=
                token.plain_token,
        )


    # =====================================================
    # AUTHENTICATE SESSION
    # =====================================================

    async def authenticate_session(
        self,
        session_token: str | None,
    ) -> User | None:

        if not session_token:

            return None


        token_hash = (
            hash_session_token(
                session_token
            )
        )


        session = (
            await auth_store
            .get_session_by_token_hash(
                token_hash
            )
        )


        if session is None:

            return None


        now = utc_now()


        if session.is_expired:

            await auth_store.delete_session(
                session.session_id
            )

            return None


        stored_user = (
            await auth_store.get_user_by_id(
                session.user_id
            )
        )


        if stored_user is None:

            await auth_store.delete_session(
                session.session_id
            )

            return None


        if not stored_user.is_active:

            await auth_store.delete_session(
                session.session_id
            )

            return None


        await auth_store.update_session_last_seen(
            session.session_id,
            now,
        )


        return stored_user.to_user()


    # =====================================================
    # LOGOUT
    # =====================================================

    async def logout(
        self,
        session_token: str | None,
    ) -> None:

        if not session_token:

            return


        token_hash = (
            hash_session_token(
                session_token
            )
        )


        session = (
            await auth_store
            .get_session_by_token_hash(
                token_hash
            )
        )


        if session is None:

            return


        await auth_store.delete_session(
            session.session_id
        )


    # =====================================================
    # LOGOUT ALL
    # =====================================================

    async def logout_all(
        self,
        user_id: str,
    ) -> None:

        await auth_store.delete_user_sessions(
            user_id
        )


# =========================================================
# GLOBAL SERVICE
# =========================================================

auth_service = AuthService(
    provider=
        local_auth_provider
)