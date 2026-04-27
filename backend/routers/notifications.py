"""/api/notifications router."""
from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user
from services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    items, meta = await notification_service.list_for(
        user["id"], unread_only=unread_only, page=page, per_page=per_page
    )
    return ok_envelope(items, meta)


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(current_user)):
    await notification_service.mark_read(user["id"], notif_id)
    return ok_envelope({"message": "Marked read"})


@router.post("/mark-all-read")
async def mark_all_read(user: dict = Depends(current_user)):
    n = await notification_service.mark_all_read(user["id"])
    return ok_envelope({"updated": n})
