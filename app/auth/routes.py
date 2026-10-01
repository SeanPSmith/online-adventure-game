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
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
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

from app.admin.analytics import (
    admin_analytics_service,
)

from app.auth.sessions import (
    SESSION_COOKIE_NAME,
    SESSION_LIFETIME,
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
# ADMIN CONTROL ROOM
# =========================================================

class AdminAuthorAccessRequest(BaseModel):
    enabled: bool


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

