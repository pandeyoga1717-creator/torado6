"""/api/search — global search."""
from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user
from services import search_service

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(..., min_length=2),
    user: dict = Depends(current_user),
):
    return ok_envelope(await search_service.global_search(q))
