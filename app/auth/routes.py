from __future__ import annotations

import os

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)

from pydantic import (
    BaseModel,
)

from app.auth.providers.base import (
    InactiveUserError,
    InvalidCredentialsError,
    RegistrationError,
)

from app.auth.schemas import (
    AccountDeleteRequest,
    AuthResponse,
    LoginRequest,
    MessageResponse,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    SecurityResponse,
    SessionMutationResponse,
    UserResponse,
)

from app.auth.service import (
    auth_service,
)

from app.auth.store import (
    auth_store,
)

from app.admin.content_portability import (
    ContentImportError,
    import_author_content_bundle,
)

from app.admin.operations import operations_store

from app.admin.analytics import (
    admin_analytics_service,
)

from app.admin.project_docs import (
    load_project_documentation,
)

from app.auth.sessions import (
    SESSION_COOKIE_NAME,
    SESSION_LIFETIME,
)

from app.usage import (
    ai_usage_store,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/auth",
    tags=[
        "authentication",
    ],
)


# =========================================================
# COOKIE CONFIGURATION
# =========================================================

def _env_flag(
    name: str,
    default: bool = False,
) -> bool:

    value = os.getenv(
        name
    )

    if value is None:
        return default

    return (
        value
        .strip()
        .lower()
        in {
            "1",
            "true",
            "yes",
            "on",
        }
    )


COOKIE_SECURE = _env_flag(
    "AUTH_COOKIE_SECURE",
    default=False,
)

COOKIE_SAMESITE = "lax"

COOKIE_PATH = "/"


# =========================================================
# RESPONSE HELPERS
# =========================================================

def user_response(
    user,
) -> UserResponse:

    return UserResponse(
        user_id=
            user.user_id,

        email=
            user.email,

        username=
            user.username,

        created_at=
            user.created_at.isoformat(),

        is_active=
            user.is_active,

        permissions=
            list(
                user.permissions
            ),
    )


def set_session_cookie(
    response: Response,
    session_token: str,
) -> None:

    max_age = int(
        SESSION_LIFETIME.total_seconds()
    )

    response.set_cookie(
        key=
            SESSION_COOKIE_NAME,

        value=
            session_token,

        max_age=
            max_age,

        httponly=
            True,

        secure=
            COOKIE_SECURE,

        samesite=
            COOKIE_SAMESITE,

        path=
            COOKIE_PATH,
    )


def clear_session_cookie(
    response: Response,
) -> None:

    response.delete_cookie(
        key=
            SESSION_COOKIE_NAME,

        httponly=
            True,

        secure=
            COOKIE_SECURE,

        samesite=
            COOKIE_SAMESITE,

        path=
            COOKIE_PATH,
    )


def _request_is_safe_account_write(
    request: Request,
) -> bool:

    if request.headers.get("X-TOT-Account-Request") != "1":
        return False

    fetch_site = (
        request.headers.get("sec-fetch-site", "")
        .strip()
        .lower()
    )

    return fetch_site in {
        "",
        "none",
        "same-origin",
        "same-site",
    }


async def require_current_user(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await auth_service.authenticate_session(session_token)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    return user


async def require_account_write(
    request: Request,
    user=Depends(require_current_user),
):

    if not _request_is_safe_account_write(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account write request rejected.",
        )

    return user


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
):

    try:

        user = await auth_service.register(
            email=
                payload.email,

            username=
                payload.username,

            password=
                payload.password,
        )

    except RegistrationError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(error),
        ) from error


    return AuthResponse(
        authenticated=
            False,

        user=
            user_response(
                user
            ),
    )


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=AuthResponse,
)
async def login(
    payload: LoginRequest,
    response: Response,
):

    try:

        result = await auth_service.login(
            identifier=
                payload.identifier,

            password=
                payload.password,
        )

    except (
        InvalidCredentialsError,
        InactiveUserError,
    ) as error:

        raise HTTPException(
            status_code=
                status.HTTP_401_UNAUTHORIZED,

            detail=
                str(error),
        ) from error


    set_session_cookie(
        response,
        result.session_token,
    )


    return AuthResponse(
        authenticated=
            True,

        user=
            user_response(
                result.user
            ),
    )


# =========================================================
# CURRENT USER
# =========================================================

@router.get(
    "/me",
    response_model=AuthResponse,
)
async def me(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await auth_service.authenticate_session(
        session_token
    )


    if user is None:

        return AuthResponse(
            authenticated=
                False,

            user=
                None,
        )


    return AuthResponse(
        authenticated=
            True,

        user=
            user_response(
                user
            ),
    )


# =========================================================
# LOGOUT
# =========================================================

@router.post(
    "/logout",
    response_model=MessageResponse,
)
async def logout(
    response: Response,

    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    await auth_service.logout(
        session_token
    )


    clear_session_cookie(
        response
    )


    return MessageResponse(
        message=
            "Logged out."
    )


# =========================================================
# ACCOUNT SELF-SERVICE
# =========================================================

@router.patch(
    "/profile",
    response_model=AuthResponse,
)
async def update_profile(
    payload: ProfileUpdateRequest,
    user=Depends(require_account_write),
):

    try:
        updated = await auth_service.update_profile(
            user_id=str(user.user_id),
            current_password=payload.current_password,
            email=payload.email,
            username=payload.username,
        )
    except InvalidCredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error
    except RegistrationError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    return AuthResponse(
        authenticated=True,
        user=user_response(updated),
    )


@router.post(
    "/password",
    response_model=MessageResponse,
)
async def change_password(
    payload: PasswordChangeRequest,
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    user=Depends(require_account_write),
):

    try:
        await auth_service.change_password(
            user_id=str(user.user_id),
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except InvalidCredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error
    except RegistrationError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    current = await auth_service.current_session(session_token)

    if current is not None:
        await auth_service.logout_other_sessions(
            user_id=str(user.user_id),
            current_session_id=current.session_id,
        )

    return MessageResponse(
        message="Password updated. Other signed-in devices were disconnected."
    )


@router.get(
    "/security",
    response_model=SecurityResponse,
)
async def account_security(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    user=Depends(require_current_user),
):

    current = await auth_service.current_session(session_token)

    if current is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired.",
        )

    sessions = [
        session
        for session in await auth_store.list_user_sessions(str(user.user_id))
        if not session.is_expired
    ]

    return SecurityResponse(
        provider="local",
        active_sessions=len(sessions),
        current_session_id=current.session_id,
        current_session_created_at=current.created_at.isoformat(),
        current_session_last_seen_at=current.last_seen_at.isoformat(),
        current_session_expires_at=current.expires_at.isoformat(),
    )


@router.post(
    "/sessions/logout-others",
    response_model=SessionMutationResponse,
)
async def logout_other_sessions(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    user=Depends(require_account_write),
):

    current = await auth_service.current_session(session_token)

    if current is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired.",
        )

    revoked = await auth_service.logout_other_sessions(
        user_id=str(user.user_id),
        current_session_id=current.session_id,
    )

    return SessionMutationResponse(
        message="Other sessions signed out.",
        revoked_sessions=revoked,
    )


@router.delete(
    "/account",
    response_model=MessageResponse,
)
async def delete_account(
    payload: AccountDeleteRequest,
    response: Response,
    user=Depends(require_account_write),
):

    try:
        await auth_service.delete_account(
            user_id=str(user.user_id),
            current_password=payload.current_password,
            confirmation=payload.confirmation,
        )
    except InvalidCredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error
    except RegistrationError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    clear_session_cookie(response)

    return MessageResponse(
        message="Account deleted."
    )


# =========================================================
# AI USAGE / PLAYTEST ALLOWANCE
# =========================================================

@router.get("/usage")
async def account_ai_usage(
    user=Depends(require_current_user),
):
    return await ai_usage_store.user_snapshot(user.user_id)


# =========================================================
# ADMIN CONTROL ROOM
# =========================================================

class AdminAuthorAccessRequest(BaseModel):
    enabled: bool


class AdminEntitlementRequest(BaseModel):
    plan_id: str = "playtester"
    monthly_budget_usd: float = 5.0
    monthly_request_limit: int = 500
    is_unlimited: bool = False


async def require_admin_user(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):
    user = await auth_service.authenticate_session(
        session_token
    )

    if user is None or not user.has_permission("admin"):
        # Conceal the administrative surface from ordinary accounts.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found.",
        )

    return user


def _request_is_safe_admin_write(
    request: Request,
) -> bool:
    # A custom request header makes cross-site form CSRF impossible without a
    # CORS preflight. Sec-Fetch-Site survives the CloudFront -> ALB hop even
    # though CloudFront intentionally replaces Host with the ALB hostname.
    if request.headers.get("X-TOT-Admin-Request") != "1":
        return False

    fetch_site = (
        request.headers.get("sec-fetch-site", "")
        .strip()
        .lower()
    )

    return fetch_site in {
        "",
        "none",
        "same-origin",
        "same-site",
    }


async def require_admin_write(
    request: Request,
    user=Depends(require_admin_user),
):
    if not _request_is_safe_admin_write(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative write request rejected.",
        )

    return user


@router.get("/admin/me")
async def admin_me(
    user=Depends(require_admin_user),
):
    return {
        "authorized": True,
        "user": user_response(user).model_dump(),
    }


@router.get("/admin/analytics")
async def admin_analytics(
    user=Depends(require_admin_user),
):
    return await admin_analytics_service.snapshot()


@router.get("/admin/usage")
async def admin_ai_usage(
    user=Depends(require_admin_user),
):
    return await ai_usage_store.admin_snapshot(limit=40)


class AdminActiveRequest(BaseModel):
    enabled: bool


class AdminPauseRequest(BaseModel):
    paused: bool


class AdminTerminateRequest(BaseModel):
    confirmation: str


@router.get("/admin/operations")
async def admin_operations(user=Depends(require_admin_user)):
    from app import main
    snapshot = await operations_store.snapshot()
    live, _ = admin_analytics_service._live_snapshot()
    for room in live:
        session = main.game_sessions.get(room["room_code"])
        room["state"] = ("WRITING" if room["room_code"] in main._director_active_rooms
                         else "RECOVERY REQUIRED" if session and session.pending_turn_facts else room["state"])
        room["started"] = bool(session and session.started)
        room["pending_qte"] = bool(session and session.pending_micro_event)
    snapshot["rooms"] = live
    return snapshot


@router.put("/admin/ai-pause")
async def admin_ai_pause(payload: AdminPauseRequest, admin=Depends(require_admin_write)):
    await operations_store.set_pause(admin.user_id, payload.paused)
    return {"paused": payload.paused}


@router.put("/admin/users/{user_id}/active")
async def admin_account_active(user_id: str, payload: AdminActiveRequest, admin=Depends(require_admin_write)):
    try:
        await operations_store.set_account_active(admin.user_id, user_id, payload.enabled)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if not payload.enabled:
        from app.main import disconnect_account_sockets
        await disconnect_account_sockets(user_id)
    return {"user_id": user_id, "is_active": payload.enabled}


@router.post("/admin/rooms/{room_code}/terminate")
async def admin_terminate_room(room_code: str, payload: AdminTerminateRequest, admin=Depends(require_admin_write)):
    from app.main import terminate_operator_room
    room_code = room_code.strip().upper()
    if payload.confirmation.strip().upper() != room_code:
        raise HTTPException(status_code=400, detail="Type the room code to end this room.")
    await terminate_operator_room(room_code, admin.user_id)
    return {"terminated": room_code}


@router.get("/admin/project-docs")
async def admin_project_docs(
    user=Depends(require_admin_user),
):
    try:
        return load_project_documentation()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Project documentation is not packaged with this backend build.",
        ) from error


@router.get("/admin/users")
async def admin_list_users(
    search: str = Query(
        default="",
        max_length=100,
    ),
    user=Depends(require_admin_user),
):
    users = await auth_store.list_users(
        search=search,
        limit=200,
    )

    return {
        "users": [
            user_response(stored.to_user()).model_dump()
            for stored in users
        ]
    }


@router.put("/admin/users/{user_id}/entitlement")
async def admin_set_entitlement(
    user_id: str,
    payload: AdminEntitlementRequest,
    admin=Depends(require_admin_write),
):
    target = await auth_store.get_user_by_id(user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    plan_id = str(payload.plan_id or "playtester").strip()[:64] or "playtester"
    budget = max(0.0, min(10_000.0, float(payload.monthly_budget_usd)))
    request_limit = max(0, min(1_000_000, int(payload.monthly_request_limit)))
    entitlement = await ai_usage_store.set_entitlement(
        user_id=user_id,
        plan_id=plan_id,
        monthly_budget_microusd=int(round(budget * 1_000_000)),
        monthly_request_limit=request_limit,
        is_unlimited=bool(payload.is_unlimited),
        updated_by=admin.user_id,
    )
    await operations_store.audit(admin.user_id, "entitlement_set", user_id, {key: value for key, value in entitlement.public_data().items() if key != "user_id"})
    return {
        "updated_by": admin.username,
        "entitlement": entitlement.public_data(),
        "usage": await ai_usage_store.user_snapshot(user_id),
    }


@router.put("/admin/users/{user_id}/author-access")
async def admin_set_author_access(
    user_id: str,
    payload: AdminAuthorAccessRequest,
    admin=Depends(require_admin_write),
):
    target = await auth_store.get_user_by_id(
        user_id
    )

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if "admin" in target.permissions and not payload.enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Administrator author access cannot be revoked here.",
        )

    if payload.enabled:
        await auth_store.revoke_permission(user_id, "author_denied")
        await auth_store.grant_permission(user_id, "author")
        await auth_store.grant_permission(user_id, "publish")
    else:
        await auth_store.revoke_permission(user_id, "author")
        await auth_store.revoke_permission(user_id, "publish")
        await auth_store.grant_permission(user_id, "author_denied")

    await operations_store.audit(admin.user_id, "author_access_set", user_id, {"enabled": payload.enabled})

    refreshed = await auth_store.get_user_by_id(
        user_id
    )

    return {
        "updated_by": admin.username,
        "user": user_response(refreshed.to_user()).model_dump()
        if refreshed is not None
        else None,
    }


@router.post("/admin/content/import")
async def admin_import_author_content(
    payload: dict,
    admin=Depends(require_admin_write),
):
    bundle = payload.get("bundle", payload)
    author_map = payload.get("author_map", {})

    try:
        return import_author_content_bundle(
            bundle,
            importing_user_id=str(admin.user_id),
            author_map=author_map
            if isinstance(author_map, dict)
            else {},
        )
    except ContentImportError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(error),
                "missing_usernames": error.missing_usernames,
                "conflicts": error.conflicts,
            },
        ) from error

