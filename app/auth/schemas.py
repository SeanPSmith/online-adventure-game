from __future__ import annotations

from pydantic import (
    BaseModel,
    Field,
)


# =========================================================
# REGISTER
# =========================================================

class RegisterRequest(
    BaseModel,
):

    email: str = Field(
        min_length=3,
        max_length=254,
    )

    username: str = Field(
        min_length=3,
        max_length=24,
    )

    password: str = Field(
        min_length=10,
        max_length=256,
    )


# =========================================================
# LOGIN
# =========================================================

class LoginRequest(
    BaseModel,
):

    identifier: str = Field(
        min_length=1,
        max_length=254,
    )

    password: str = Field(
        min_length=1,
        max_length=256,
    )


# =========================================================
# RESPONSE
# =========================================================

class UserResponse(
    BaseModel,
):

    user_id: str

    email: str

    username: str

    created_at: str

    is_active: bool

    permissions: list[
        str
    ] = Field(
        default_factory=list,
    )


class AuthResponse(
    BaseModel,
):

    authenticated: bool

    user: UserResponse | None = None


class MessageResponse(
    BaseModel,
):

    message: str