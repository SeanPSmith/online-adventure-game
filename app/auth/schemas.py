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
# ACCOUNT SELF-SERVICE
# =========================================================

class ProfileUpdateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    username: str = Field(min_length=3, max_length=24)
    current_password: str = Field(min_length=1, max_length=256)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=10, max_length=256)


class AccountDeleteRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    confirmation: str = Field(min_length=1, max_length=64)


class SecurityResponse(BaseModel):
    provider: str = "local"
    active_sessions: int
    current_session_id: str
    current_session_created_at: str
    current_session_last_seen_at: str
    current_session_expires_at: str


class SessionMutationResponse(BaseModel):
    message: str
    revoked_sessions: int = 0


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
