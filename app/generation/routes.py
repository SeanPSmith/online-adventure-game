from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from app.authoring.routes import (
    require_author_user,
    require_author_write,
)

from app.generation.provider import (
    AdventureGenerationConfigurationError,
    AdventureGenerationResponseError,
)

from app.generation.schemas import (
    GenerateAdventureRequest,
)

from app.generation.service import (
    generation_service,
)

from app.generation.store import (
    generated_adventure_store,
)


router = APIRouter(
    prefix="/api/author/generated",
    tags=[
        "generation",
    ],
)


@router.get(
    "/provider"
)
async def generation_provider_status(
    user=Depends(
        require_author_user
    ),
):

    return (
        generation_service
        .provider_status()
    )


@router.get(
    ""
)
async def list_generated(
    user=Depends(
        require_author_user
    ),
):

    return {
        "generated_adventures":
            await generated_adventure_store
            .list_all()
    }


@router.post(
    "",
    status_code=
        status.HTTP_201_CREATED,
)
async def generate_adventure(
    payload: GenerateAdventureRequest,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await generation_service
            .generate(

                world_document_id=
                    payload.world_document_id,

                world_version_number=
                    payload.world_version_number,

                brief_document_id=
                    payload.brief_document_id,

                brief_version_number=
                    payload.brief_version_number,

                special_request=
                    payload.special_request,

                quality_tier=
                    payload.quality_tier,

                user_id=
                    user.user_id,
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
    "/{generated_adventure_id}/approve"
)
async def approve_generated(
    generated_adventure_id: str,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await generation_service
            .approve(
                generated_adventure_id
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
    "/{generated_adventure_id}/reject"
)
async def reject_generated(
    generated_adventure_id: str,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await generation_service
            .reject(
                generated_adventure_id
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


@router.post(
    "/{generated_adventure_id}/retire"
)
async def retire_generated(
    generated_adventure_id: str,
    user=Depends(
        require_author_write
    ),
):

    try:

        return (
            await generation_service
            .retire(
                generated_adventure_id
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


@router.get(
    "/{generated_adventure_id}"
)
async def get_generated(
    generated_adventure_id: str,
    user=Depends(
        require_author_user
    ),
):

    generated = (
        await generated_adventure_store
        .get(
            generated_adventure_id
        )
    )


    if generated is None:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Generated adventure not found.",
        )


    return generated
