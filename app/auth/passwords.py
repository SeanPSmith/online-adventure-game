from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)


_hasher = PasswordHasher()


def hash_password(
    password: str,
) -> str:

    password = str(
        password
    )

    if not password:
        raise ValueError(
            "Password cannot be empty."
        )

    return _hasher.hash(
        password
    )


def verify_password(
    password: str,
    password_hash: str,
) -> bool:

    try:
        return _hasher.verify(
            password_hash,
            password,
        )

    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHashError,
    ):
        return False


def password_needs_rehash(
    password_hash: str,
) -> bool:

    try:
        return _hasher.check_needs_rehash(
            password_hash
        )

    except InvalidHashError:
        return True