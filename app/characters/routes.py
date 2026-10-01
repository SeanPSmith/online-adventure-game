from __future__ import annotations

from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    status,
)

from app.auth.service import (
    auth_service,
)

from app.auth.sessions import (
    SESSION_COOKIE_NAME,
)

from app.characters.creation import (
    creation_rules_public_data,
)

from app.characters.progression import (
    progression_public_data,
)

from app.characters.schemas import (
    AdvanceCharacterRequest,
    CharacterCreationRulesResponse,
    CharacterDeleteResponse,
    CharacterListResponse,
    CharacterResponse,
    CreateCharacterRequest,
)

from app.characters.service import (
    CharacterNotFoundError,
    CharacterOwnershipError,
    CharacterValidationError,
    character_service,
)

from app.persistence.store import (
    store,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix=
        "/api/characters",

    tags=[
        "characters",
    ],
)


# =========================================================
# AUTH
# =========================================================

async def require_user(
    session_token: str | None,
):

    user = (
        await auth_service
        .authenticate_session(
            session_token
        )
    )


    if user is None:

        raise HTTPException(
            status_code=
                status.HTTP_401_UNAUTHORIZED,

            detail=
                "Authentication required.",
        )


    return user


# =========================================================
# SERIALIZATION
# =========================================================

def character_response(
    character,
) -> CharacterResponse:

    data = (
        character.to_dict()
    )

    data.update(
        progression_public_data(
            character.level,
            character.experience,
        )
    )


    return CharacterResponse(
        **data
    )


# =========================================================
# CREATION RULES
# =========================================================

@router.get(
    "/creation-rules",
    response_model=
        CharacterCreationRulesResponse,
)
async def get_creation_rules(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    await require_user(
        session_token
    )


    return CharacterCreationRulesResponse(
        **creation_rules_public_data()
    )


# =========================================================
# LIST
# =========================================================

@router.get(
    "",
    response_model=
        CharacterListResponse,
)
async def list_characters(
    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await require_user(
        session_token
    )


    characters = (
        await character_service.list_characters(
            user.user_id
        )
    )


    return CharacterListResponse(
        characters=[
            character_response(
                character
            )

            for character
            in characters
        ]
    )


# =========================================================
# CREATE
# =========================================================

@router.post(
    "",
    response_model=
        CharacterResponse,

    status_code=
        status.HTTP_201_CREATED,
)
async def create_character(
    payload: CreateCharacterRequest,

    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await require_user(
        session_token
    )


    try:

        character = (
            await character_service.create_character(

                owner_user_id=
                    user.user_id,

                name=
                    payload.name,

                stats=
                    payload.stats,

                skills=
                    payload.skills,
            )
        )

    except CharacterValidationError as error:

        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                str(error),
        ) from error


    return character_response(
        character
    )


# =========================================================
# ADVANCE
# =========================================================

@router.post(
    "/{character_id}/advance",
    response_model=CharacterResponse,
)
async def advance_character(
    character_id: str,
    payload: AdvanceCharacterRequest,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    try:
        character = await character_service.advance_character(
            user.user_id,
            character_id,
            stats=payload.stats,
            skills=payload.skills,
        )
    except (CharacterNotFoundError, CharacterOwnershipError) as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character does not exist.") from error
    except CharacterValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return character_response(character)


# =========================================================
# GET
# =========================================================

@router.get(
    "/{character_id}",
    response_model=
        CharacterResponse,
)
async def get_character(
    character_id: str,

    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await require_user(
        session_token
    )


    try:

        character = (
            await character_service.get_owned_character(

                owner_user_id=
                    user.user_id,

                character_id=
                    character_id,
            )
        )

    except (
        CharacterNotFoundError,
        CharacterOwnershipError,
    ) as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Character does not exist.",
        ) from error


    return character_response(
        character
    )


# =========================================================
# COMPLETED STORIES
# =========================================================

@router.get(
    "/{character_id}/stories",
)
async def list_character_stories(
    character_id: str,

    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await require_user(
        session_token
    )


    try:

        await character_service.get_owned_character(

            owner_user_id=
                user.user_id,

            character_id=
                character_id,
        )

    except (
        CharacterNotFoundError,
        CharacterOwnershipError,
    ) as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Character does not exist.",
        ) from error


    return {
        "stories":
            await store.list_completed_adventures(

                user_id=
                    user.user_id,

                character_id=
                    character_id,
            ),
    }


# =========================================================
# DELETE
# =========================================================

@router.delete(
    "/{character_id}",
    response_model=
        CharacterDeleteResponse,
)
async def delete_character(
    character_id: str,

    session_token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
):

    user = await require_user(
        session_token
    )


    try:

        await character_service.delete_character(

            owner_user_id=
                user.user_id,

            character_id=
                character_id,
        )

    except (
        CharacterNotFoundError,
        CharacterOwnershipError,
    ) as error:

        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,

            detail=
                "Character does not exist.",
        ) from error


    return CharacterDeleteResponse(
        message=
            "Character deleted."
    )