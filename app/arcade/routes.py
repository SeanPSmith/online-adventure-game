from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.arcade.store import arcade_publication_store
from app.auth.routes import require_admin_write

router = APIRouter(prefix="/api/arcade", tags=["arcade"])

class ArcadePublicationRequest(BaseModel):
    is_live: bool

@router.get("/catalog")
async def arcade_catalog():
    publication = await arcade_publication_store.list_publication()
    return {"games": [entry.public_data() for entry in publication]}

@router.put("/admin/games/{game_id}")
async def set_arcade_game_publication(
    game_id: str,
    payload: ArcadePublicationRequest,
    admin=Depends(require_admin_write),
):
    try:
        entry = await arcade_publication_store.set_live(
            game_id=game_id,
            is_live=payload.is_live,
            updated_by=str(admin.username),
        )
    except KeyError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown arcade game.",
        ) from error
    return {"game": entry.public_data()}
