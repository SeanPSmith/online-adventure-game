from __future__ import annotations

import re

from uuid import uuid4

from app.auth.models import StoredUser

from app.database import DatabaseIntegrityError

from app.auth.passwords import (
    hash_password,
    password_needs_rehash,
    verify_password,
)

from app.auth.sessions import utc_now

from app.auth.store import auth_store

from app.auth.providers.base import (
    AuthProvider,
    InactiveUserError,
    InvalidCredentialsError,
    RegistrationError,
)


# =========================================================
# BASIC VALIDATION
# =========================================================

EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
)

USERNAME_PATTERN = re.compile(
    r"^[A-Za-z0-9_-]+$"
)

MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 256

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 24

MAX_EMAIL_LENGTH = 254


# =========================================================
# LOCAL AUTH PROVIDER
# =========================================================

class LocalAuthProvider(
    AuthProvider,
):

    provider_name = "local"

    # -----------------------------------------------------
    # NORMALIZATION
    # -----------------------------------------------------

    @staticmethod
    def normalize_email(
        email: str,
    ) -> str:

        return str(
            email or ""
        ).strip().lower()

    @staticmethod
    def normalize_username(
        username: str,
    ) -> str:

        return str(
            username or ""
        ).strip()

    @staticmethod
    def normalize_identifier(
        identifier: str,
    ) -> str:

        return str(
            identifier or ""
        ).strip()

    # -----------------------------------------------------
    # ACCOUNT VALIDATION
    # -----------------------------------------------------

    def validate_identity(
        self,
        email: str,
        username: str,
    ) -> tuple[str, str]:

        email = self.normalize_email(email)
        username = self.normalize_username(username)

        if not email:
            raise RegistrationError("Email is required.")

        if len(email) > MAX_EMAIL_LENGTH:
            raise RegistrationError("Email address is too long.")

        if not EMAIL_PATTERN.match(email):
            raise RegistrationError("Enter a valid email address.")

        if not username:
            raise RegistrationError("Username is required.")

        if len(username) < MIN_USERNAME_LENGTH:
            raise RegistrationError(
                f"Username must be at least {MIN_USERNAME_LENGTH} characters."
            )

        if len(username) > MAX_USERNAME_LENGTH:
            raise RegistrationError(
                f"Username cannot exceed {MAX_USERNAME_LENGTH} characters."
            )

        if not USERNAME_PATTERN.match(username):
            raise RegistrationError(
                "Username may contain only letters, numbers, underscores, and hyphens."
            )

        return email, username

    def validate_password(
        self,
        password: str,
    ) -> str:

        password = str(password or "")

        if len(password) < MIN_PASSWORD_LENGTH:
            raise RegistrationError(
                f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
            )

        if len(password) > MAX_PASSWORD_LENGTH:
            raise RegistrationError("Password is too long.")

        return password

    def validate_registration(
        self,
        email: str,
        username: str,
        password: str,
    ) -> tuple[str, str, str]:

        email, username = self.validate_identity(email, username)
        password = self.validate_password(password)

        return email, username, password

    # -----------------------------------------------------
    # REGISTER
    # -----------------------------------------------------

    async def register(
        self,
        email: str,
        username: str,
        password: str,
    ) -> StoredUser:

        (
            email,
            username,
            password,
        ) = self.validate_registration(
            email,
            username,
            password,
        )

        # Friendly duplicate checks first.

        existing_email = (
            await auth_store.get_user_by_email(
                email
            )
        )

        if existing_email is not None:

            raise RegistrationError(
                "An account already exists "
                "with that email address."
            )

        existing_username = (
            await auth_store.get_user_by_username(
                username
            )
        )

        if existing_username is not None:

            raise RegistrationError(
                "That username is already in use."
            )

        user = StoredUser(
            user_id=str(
                uuid4()
            ),

            email=email,

            username=username,

            password_hash=hash_password(
                password
            ),

            created_at=utc_now(),

            is_active=True,
        )

        try:

            await auth_store.create_user(
                user
            )

        except DatabaseIntegrityError:

            # Protect against a race where another request
            # registers the same identity after our checks.

            raise RegistrationError(
                "Email or username is already registered."
            )

        return user

    # -----------------------------------------------------
    # AUTHENTICATE
    # -----------------------------------------------------

    async def authenticate(
        self,
        identifier: str,
        password: str,
    ) -> StoredUser:

        identifier = (
            self.normalize_identifier(
                identifier
            )
        )

        password = str(
            password or ""
        )

        if (
            not identifier
            or not password
        ):

            raise InvalidCredentialsError(
                "Invalid username/email or password."
            )

        user = (
            await auth_store.get_user_by_identifier(
                identifier
            )
        )

        if user is None:

            # Deliberately generic.
            #
            # We do not tell a login request whether an
            # account exists for a particular email.

            raise InvalidCredentialsError(
                "Invalid username/email or password."
            )

        if not verify_password(
            password,
            user.password_hash,
        ):

            raise InvalidCredentialsError(
                "Invalid username/email or password."
            )

        if not user.is_active:

            raise InactiveUserError(
                "This account is disabled."
            )

        # Argon2 parameters can evolve over time.
        #
        # Successful login gives us an opportunity to upgrade
        # old password hashes transparently.

        if password_needs_rehash(
            user.password_hash
        ):

            new_hash = hash_password(
                password
            )

            await auth_store.update_password_hash(
                user.user_id,
                new_hash,
            )

            refreshed_user = (
                await auth_store.get_user_by_id(
                    user.user_id
                )
            )

            if refreshed_user is not None:

                user = refreshed_user

        return user


local_auth_provider = LocalAuthProvider()