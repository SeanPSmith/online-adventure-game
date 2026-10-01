from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
)

from fastapi.responses import (
    FileResponse,
    RedirectResponse,
)

from app.auth.service import (
    auth_service,
)

from app.auth.sessions import (
    SESSION_COOKIE_NAME,
)

from app.authoring.schemas import (
    ArchiveAdventureRequest,
    AuthorAssistRequest,
    CreateAdventureRequest,
    DuplicateAdventureRequest,
    PreviewAdventureRequest,
    SaveAdventureRequest,
)

from app.authoring.ai_assist import (
    author_assist_service,
)

from app.generation.provider import (
    AdventureGenerationConfigurationError,
    AdventureGenerationResponseError,
)

from app.authoring.service import (
    assess_document_strength,
    author_access_policy,
    compile_source_document,
    render_design_document,
)

from app.authoring.store import (
    AuthoringConflictError,
    authoring_store,
)


router = APIRouter(
    tags=[
        "authoring",
    ],
)


AUTHOR_WEB_DIR = (
    Path(__file__)
    .resolve()
    .parents[1]
    / "web"
    / "author"
)


AUTHOR_PAGE_HEADERS = {
    "Cache-Control":
        "no-store",

    "X-Frame-Options":
        "DENY",

    "X-Content-Type-Options":
        "nosniff",

    "Referrer-Policy":
        "same-origin",

    "Content-Security-Policy":
        (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'none'; "
            "form-action 'self'"
        ),
}


async def user_can_access_author_console(
    user,
) -> bool:

    if user is None:
        return False


    if (
        hasattr(user, "has_permission")
        and user.has_permission("author_denied")
    ):
        return False


    if (
        author_access_policy
        .allows(
            user
        )
    ):
        return True


    # Authored-content ownership is itself durable proof that this account
    # belongs in the private author workspace. This must remain true even
    # when a shell allowlist is configured; otherwise an existing creator
    # can authenticate successfully yet lose access to their own work merely
    # because another account was added to TOT_AUTHOR_* environment values.
    return await authoring_store.user_has_authored_documents(
        str(
            user.user_id
        )
    )


async def require_author_user(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = (
        await auth_service
        .authenticate_session(
            session_token
        )
    )


    if not await user_can_access_author_console(
        user
    ):

        # Conceal the private console.
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Not found.",
        )


    return user


def _request_is_same_origin(
    request: Request,
) -> bool:

    fetch_site = (
        request.headers.get(
            "sec-fetch-site",
            "",
        )
        .strip()
        .lower()
    )


    if fetch_site in {
        "none",
        "same-origin",
        "same-site",
    }:
        return True


    origin = (
        request.headers.get(
            "origin"
        )
    )


    if not origin:
        return True


    parsed = urlparse(
        origin
    )


    host = (
        request.headers.get(
            "host",
            "",
        )
        .casefold()
    )


    return (
        parsed.netloc.casefold()
        == host
    )


async def require_author_write(
    request: Request,
    user=Depends(
        require_author_user
    ),
):

    if (
        request.headers.get(
            "X-TOT-Author-Request"
        )
        != "1"
    ):

        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,

            detail=
                "Write request rejected.",
        )


    if not _request_is_same_origin(
        request
    ):

        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,

            detail=
                "Origin rejected.",
        )


    return user


@router.get(
    "/author-console",
    include_in_schema=False,
)
@router.get(
    "/author-console/",
    include_in_schema=False,
)
@router.get(
    "/author",
    include_in_schema=False,
)
@router.get(
    "/author/",
    include_in_schema=False,
)
async def author_page(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = (
        await auth_service
        .authenticate_session(
            session_token
        )
    )


    if not await user_can_access_author_console(
        user
    ):

        return RedirectResponse(
            url="/",
            status_code=
                status.HTTP_303_SEE_OTHER,
        )


    return FileResponse(
        AUTHOR_WEB_DIR
        / "index.html",

        headers=
            AUTHOR_PAGE_HEADERS,
    )


@router.get(
    "/api/author/me"
)
async def author_me(
    user=Depends(
        require_author_user
    ),
):

    return {
        "authorized":
            True,

        "user": {
            "user_id":
                user.user_id,

            "username":
                user.username,

            "email":
                user.email,
        },
    }


@router.get(
    "/api/author/adventures"
)
async def list_adventures(
    include_archived: bool = Query(
        default=False
    ),
    user=Depends(
        require_author_user
    ),
):

    return {
        "adventures":
            await authoring_store
            .list_documents(
                include_archived=
                    include_archived
            )
    }


@router.post(
    "/api/author/adventures",
    status_code=
        status.HTTP_201_CREATED,
)
async def create_adventure(
    payload: CreateAdventureRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await authoring_store
            .create_document(

                title=
                    payload.title,

                slug=
                    payload.slug,

                document_kind=
                    payload.document_kind,

                parent_document_id=
                    payload.parent_document_id,

                user_id=
                    user.user_id,
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(
                    error
                ),
        ) from error


@router.post(
    "/api/author/preview"
)
async def preview_source(
    payload: PreviewAdventureRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        return {
            "strength":
                assess_document_strength(
                    payload.source
                ),

            "compiled":
                compile_source_document(
                    payload.source
                ),

            "design_document":
                render_design_document(
                    payload.source
                ),
        }

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_422_UNPROCESSABLE_ENTITY,

            detail=
                str(
                    error
                ),
        ) from error


@router.post(
    "/api/author/assist"
)
async def assist_author_source(
    payload: AuthorAssistRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await author_assist_service
            .assist(

                source=
                    payload.source,

                instruction=
                    payload.instruction,

                section=
                    payload.section,

                item_index=
                    payload.item_index,

                field_path=
                    payload.field_path,
            )
        )

    except AdventureGenerationConfigurationError as error:

        raise HTTPException(
            status_code=
                status.HTTP_503_SERVICE_UNAVAILABLE,

            detail=
                str(
                    error
                ),
        ) from error

    except AdventureGenerationResponseError as error:

        raise HTTPException(
            status_code=
                status.HTTP_502_BAD_GATEWAY,

            detail=
                str(
                    error
                ),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_422_UNPROCESSABLE_ENTITY,

            detail=
                str(
                    error
                ),
        ) from error


@router.get(
    "/api/author/adventures/{document_id}/versions"
)
async def list_versions(
    document_id: str,
    user=Depends(
        require_author_user
    ),
):

    versions = (
        await authoring_store
        .list_versions(
            document_id
        )
    )


    if not versions:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Source document not found.",
        )


    return {
        "versions":
            versions
    }


@router.get(
    "/api/author/adventures/{document_id}/versions/{version_number}"
)
async def get_version(
    document_id: str,
    version_number: int,
    user=Depends(
        require_author_user
    ),
):

    version = (
        await authoring_store
        .get_version(
            document_id,
            version_number,
        )
    )


    if version is None:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Source version not found.",
        )


    return version


@router.put(
    "/api/author/adventures/{document_id}/versions/{version_number}"
)
async def save_version(
    document_id: str,
    version_number: int,
    payload: SaveAdventureRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await authoring_store
            .save_draft(

                document_id=
                    document_id,

                version_number=
                    version_number,

                source=
                    payload.source,

                expected_updated_at=
                    payload.expected_updated_at,
            )
        )

    except LookupError as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                str(
                    error
                ),
        ) from error

    except AuthoringConflictError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(
                    error
                ),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(
                    error
                ),
        ) from error


@router.post(
    "/api/author/adventures/{document_id}/versions/{version_number}/publish"
)
async def publish_version(
    document_id: str,
    version_number: int,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await authoring_store
            .publish_version(

                document_id=
                    document_id,

                version_number=
                    version_number,
            )
        )

    except LookupError as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                str(
                    error
                ),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(
                    error
                ),
        ) from error


@router.post(
    "/api/author/adventures/{document_id}/new-version",
    status_code=
        status.HTTP_201_CREATED,
)
async def new_version(
    document_id: str,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await authoring_store
            .create_new_version(

                document_id=
                    document_id,

                user_id=
                    user.user_id,
            )
        )

    except LookupError as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                str(
                    error
                ),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(
                    error
                ),
        ) from error


@router.post(
    "/api/author/adventures/{document_id}/duplicate",
    status_code=
        status.HTTP_201_CREATED,
)
async def duplicate_document(
    document_id: str,
    payload: DuplicateAdventureRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await authoring_store
            .duplicate_document(

                document_id=
                    document_id,

                title=
                    payload.title,

                slug=
                    payload.slug,

                user_id=
                    user.user_id,
            )
        )

    except LookupError as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                str(
                    error
                ),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,

            detail=
                str(
                    error
                ),
        ) from error


@router.post(
    "/api/author/adventures/{document_id}/archive"
)
async def archive_document(
    document_id: str,
    payload: ArchiveAdventureRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        await authoring_store.archive_document(

            document_id=
                document_id,

            archived=
                payload.archived,
        )

    except LookupError as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                str(
                    error
                ),
        ) from error


    return {
        "document_id":
            document_id,

        "archived":
            payload.archived,
    }


@router.get(
    "/api/author/security-status"
)
async def security_status(
    user=Depends(
        require_author_user
    ),
):

    return {
        "author_allowlist_configured":
            author_access_policy
            .configured(),

        "write_csrf_guard":
            True,

        "published_versions_immutable":
            True,

        "optimistic_edit_conflicts":
            True,

        "document_types": [
            "world",
            "brief",
        ],
    }
