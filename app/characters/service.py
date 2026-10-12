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
    # RETIRE / RESTORE / BURY
    # =====================================================

    @staticmethod
    def ensure_not_in_active_room(character_id: str) -> None:
        # Room membership must be checked on the server, never trusted to the UI.
        from app import main
        room = main.rooms.room_for_character(character_id)
        if room is None:
            return
        session = main.game_sessions.get(room.code)
        if session is not None and bool(getattr(session, "completed", False)):
            return  # Completed adventures retain their chronicle, not an active lock.
        raise CharacterValidationError(
            "Leave or finish the active adventure before managing this Hero."
        )

    async def change_disposition(
        self, owner_user_id: str, character_id: str, *, action: str, epitaph: str = ""
    ) -> Character:
        character = await self.get_owned_character(owner_user_id, character_id)
        self.ensure_not_in_active_room(character_id)
        if action == "retire":
            if character.hero_status != "active" or not character.is_alive:
                raise CharacterValidationError("Only a living, active Hero can retire.")
            character.hero_status = "retired"
            character.retired_at = utc_now().isoformat()
        elif action == "restore":
            if character.hero_status != "retired" or not character.is_alive:
                raise CharacterValidationError("Only a living, retired Hero can return.")
            character.hero_status = "active"
            character.retired_at = None
        elif action == "bury":
            if character.is_alive:
                raise CharacterValidationError("Only a fallen Hero may be buried.")
            if character.hero_status == "buried":
                raise CharacterValidationError("This Hero is already laid to rest.")
            if character.hero_status != "active":
                raise CharacterValidationError("This Hero cannot be buried in this state.")
            character.hero_status = "buried"
            character.buried_at = utc_now().isoformat()
            character.epitaph = str(epitaph or "").strip()[:160]
        else:
            raise CharacterValidationError("Unknown Hero action.")
        return await self.save_owned_character(owner_user_id, character)

    async def list_graveyard(self) -> list[dict]:
        buried = await character_store.list_memorials()
        return [
            {
                "character_id": item.character_id,
                "name": item.name,
                "level": item.level,
                "experience": item.experience,
                "epitaph": item.epitaph,
                "cause": str((item.death_record or {}).get("cause", "") or "")[:160],
                "buried_at": item.buried_at,
            }
            for item in buried
        ]

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


        self.ensure_not_in_active_room(character.character_id)

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