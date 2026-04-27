"""/api/procurement router."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import procurement_service

router = APIRouter(prefix="/api/procurement", tags=["procurement"])


# Purchase Requests
@router.get("/prs")
async def list_prs(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.pr.read")),
):
    perms = user.get("permissions", []) if False else None  # not used
    # Outlet managers see only own outlets; procurement+ see all
    from core.security import get_user_permissions
    user_perms = await get_user_permissions(user)
    outlet_ids = None
    if "*" not in user_perms and "procurement.pr.approve" not in user_perms:
        outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    elif outlet_id:
        outlet_ids = [outlet_id]
    items, meta = await procurement_service.list_prs(
        outlet_ids=outlet_ids, status=status, source=source,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/prs")
async def create_pr(payload: dict = Body(...),
                    user: dict = Depends(require_perm("procurement.pr.create"))):
    return ok_envelope(await procurement_service.create_pr(payload, user=user))


@router.post("/prs/{id_}/approve")
async def approve_pr(id_: str, payload: dict = Body(default={}),
                      user: dict = Depends(current_user)):
    # Permission enforced by approval engine (multi-tier)
    return ok_envelope(await procurement_service.approve_pr(
        id_, user=user, note=payload.get("note")))


@router.post("/prs/{id_}/reject")
async def reject_pr(id_: str, payload: dict = Body(...),
                     user: dict = Depends(current_user)):
    # Permission enforced by approval engine
    return ok_envelope(await procurement_service.reject_pr(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/prs/{id_}/approval-state")
async def pr_approval_state(id_: str,
                             user: dict = Depends(current_user)):
    return ok_envelope(await procurement_service.get_pr_approval_state(id_))


# Purchase Orders
@router.get("/pos")
async def list_pos(
    status: Optional[str] = None, vendor_id: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.po.create")),
):
    items, meta = await procurement_service.list_pos(
        status=status, vendor_id=vendor_id, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/pos")
async def create_po(payload: dict = Body(...),
                    user: dict = Depends(require_perm("procurement.po.create"))):
    return ok_envelope(await procurement_service.create_po(payload, user=user))


@router.post("/pos/{id_}/submit")
async def submit_po(id_: str, user: dict = Depends(require_perm("procurement.po.create"))):
    return ok_envelope(await procurement_service.submit_po_for_approval(id_, user=user))


@router.post("/pos/{id_}/approve")
async def approve_po(id_: str, payload: dict = Body(default={}),
                      user: dict = Depends(current_user)):
    # Permission enforced by approval engine
    return ok_envelope(await procurement_service.approve_po(
        id_, user=user, note=payload.get("note")))


@router.post("/pos/{id_}/reject")
async def reject_po(id_: str, payload: dict = Body(...),
                     user: dict = Depends(current_user)):
    # Permission enforced by approval engine
    return ok_envelope(await procurement_service.reject_po(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/pos/{id_}/approval-state")
async def po_approval_state(id_: str,
                             user: dict = Depends(current_user)):
    return ok_envelope(await procurement_service.get_po_approval_state(id_))


@router.post("/pos/{id_}/send")
async def send_po(id_: str, user: dict = Depends(require_perm("procurement.po.send"))):
    return ok_envelope(await procurement_service.send_po(id_, user=user))


@router.post("/pos/{id_}/cancel")
async def cancel_po(id_: str, payload: dict = Body(...),
                     user: dict = Depends(require_perm("procurement.po.cancel"))):
    return ok_envelope(await procurement_service.cancel_po(
        id_, user=user, reason=payload.get("reason", "")))


# Goods Receipts
@router.get("/grs")
async def list_grs(
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.gr.create")),
):
    items, meta = await procurement_service.list_grs(
        status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/grs")
async def post_gr(payload: dict = Body(...),
                   user: dict = Depends(require_perm("procurement.gr.post"))):
    return ok_envelope(await procurement_service.post_gr(payload, user=user))
