from __future__ import annotations

from uuid import uuid4

from app.auth.sessions import (
    utc_now,
)

from app.characters.advancement import apply_advancement_allocation, migrate_progression

from app.characters.creation import (
    CreationRulesError,
    validate_creation_build,
)

from app.characters.models import (
    Character,
)

from app.characters.store import (
    character_store,
)


# =========================================================
# ERRORS
# =========================================================

class CharacterError(
    Exception,
):
    pass


class CharacterNotFoundError(
    CharacterError,
):
    pass


class CharacterOwnershipError(
    CharacterError,
):
    pass


class CharacterValidationError(
    CharacterError,
):
    pass


# =========================================================
# CHARACTER SERVICE
# =========================================================

class CharacterService:

    # =====================================================
    # INITIALIZE
    # =====================================================

    async def initialize(
        self,
    ) -> None:

        await character_store.initialize()


    # =====================================================
    # NAME VALIDATION
    # =====================================================

    @staticmethod
    def validate_name(
        name: str,
    ) -> str:

        name = str(
            name
            or ""
        ).strip()


        if (
            len(name)
            < 2
        ):

            raise CharacterValidationError(
                "Character name must be at least 2 characters."
            )


        if (
            len(name)
            > 40
        ):

            raise CharacterValidationError(
                "Character name cannot exceed 40 characters."
            )


        return name



    @staticmethod
    def validate_bio(
        bio: str | None,
    ) -> str:
        bio = str(bio or "").strip()
        if len(bio) > 800:
            raise CharacterValidationError("Hero bio cannot exceed 800 characters.")
        return bio

    # =====================================================
    # CREATE
    # =====================================================

    async def create_character(
        self,
        owner_user_id: str,
        name: str,
        bio: str,
        stats: dict[
            str,
            int,
        ],
        skills: dict[
            str,
            int,
        ],
    ) -> Character:

        name = self.validate_name(
            name
        )
        bio = self.validate_bio(bio)


        existing = (
            await character_store
            .get_by_name_for_user(
                owner_user_id,
                name,
            )
        )


        if (
            existing
            is not None
        ):

            raise CharacterValidationError(
                "You already have a character with that name."
            )


        try:

            build = (
                validate_creation_build(
                    stats,
                    skills,
                )
            )

        except CreationRulesError as error:

            raise CharacterValidationError(
                str(
                    error
                )
            ) from error


        now = utc_now()


        character = Character(

            character_id=
                str(
                    uuid4()
                ),

            owner_user_id=
                owner_user_id,

            name=
                name,

            bio=
                bio,

            created_at=
                now,

            updated_at=
                now,

            stats=
                dict(
                    build.stats
                ),

            skills=
                dict(
                    build.skills
                ),
        )


        await character_store.save(
            character
        )


        print(
            f"[CHARACTER CREATED] "
            f"{character.name} | "
            f"owner={owner_user_id} | "
            f"{character.character_id} | "
            f"stats={build.stat_points_used} | "
            f"skills={build.skill_points_used}"
        )


        return character


    # =====================================================
    # LIST
    # =====================================================

    async def list_characters(
        self,
        owner_user_id: str,
    ) -> list[
        Character
    ]:

        characters = await character_store.list_for_user(owner_user_id)
        for character in characters:
            if migrate_progression(character):
                character.updated_at = utc_now()
                await character_store.save(character)
        return characters


    # =====================================================
    # GET OWNED CHARACTER
    # =====================================================

    async def get_owned_character(
        self,
        owner_user_id: str,
        character_id: str,
    ) -> Character:

        character = (
            await character_store.get_by_id(
                character_id
            )
        )


        if character is None:

            raise CharacterNotFoundError(
                "Character does not exist."
            )


        if (
            character.owner_user_id
            != owner_user_id
        ):

            raise CharacterOwnershipError(
                "You do not own this character."
            )


        if migrate_progression(character):
            character.updated_at = utc_now()
            await character_store.save(character)

        return character


    # =====================================================
    # SAVE OWNED CHARACTER
    # =====================================================

    async def save_owned_character(
        self,
        owner_user_id: str,
        character: Character,
    ) -> Character:

        if (
            character.owner_user_id
            != owner_user_id
        ):

            raise CharacterOwnershipError(
                "You do not own this character."
            )


        character.updated_at = (
            utc_now()
        )


        await character_store.save(
            character
        )


        return character



    # =====================================================
    # ADVANCEMENT
    # =====================================================

    async def advance_character(
        self,
        owner_user_id: str,
        character_id: str,
        *,
        stats: dict[str, int] | None = None,
        skills: dict[str, int] | None = None,
        talents: list[str] | None = None,
    ) -> Character:

        character = await self.get_owned_character(owner_user_id, character_id)

        try:
            apply_advancement_allocation(character, stats=stats, skills=skills, talents=talents)
        except ValueError as error:
            raise CharacterValidationError(str(error)) from error

        return await self.save_owned_character(owner_user_id, character)

    # =====================================================
    # PROFILE
    # =====================================================

    async def update_profile(
        self,
        owner_user_id: str,
        character_id: str,
        *,
        bio: str,
    ) -> Character:
        character = await self.get_owned_character(owner_user_id, character_id)
        character.bio = self.validate_bio(bio)
        return await self.save_owned_character(owner_user_id, character)


    # =====================================================
    # DELETE
    # =====================================================

    async def delete_character(
        self,
        owner_user_id: str,
        character_id: str,
    ) -> None:

        character = (
            await self.get_owned_character(
                owner_user_id,
                character_id,
            )
        )


        deleted = (
            await character_store.delete(
                character.character_id,
                owner_user_id,
            )
        )


        if not deleted:

            raise CharacterNotFoundError(
                "Character does not exist."
            )


        print(
            f"[CHARACTER DELETED] "
            f"{character.name} | "
            f"owner={owner_user_id} | "
            f"{character.character_id}"
        )


character_service = CharacterService()