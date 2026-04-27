"""/api/inventory router."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm, get_user_permissions
from services import inventory_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/balance")
async def stock_balance(
    outlet_id: Optional[str] = None, item_id: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    items, meta = await inventory_service.stock_balance(
        outlet_id=outlet_id, item_id=item_id, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/movements")
async def list_mov(
    outlet_id: Optional[str] = None, item_id: Optional[str] = None,
    movement_type: Optional[str] = None, date_from: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("inventory.movement.read")),
):
    user_perms = await get_user_permissions(user)
    outlet_ids = None
    if "*" not in user_perms:
        outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    elif outlet_id:
        outlet_ids = [outlet_id]
    items, meta = await inventory_service.list_movements(
        outlet_ids=outlet_ids, item_id=item_id, movement_type=movement_type,
        date_from=date_from, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/valuation")
async def get_valuation(outlet_id: Optional[str] = None,
                         user: dict = Depends(require_perm("inventory.valuation.read"))):
    return ok_envelope(await inventory_service.valuation(outlet_id=outlet_id))


# Transfer
@router.get("/transfers")
async def list_t(
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    user_perms = await get_user_permissions(user)
    outlet_ids = None if "*" in user_perms else user.get("outlet_ids", [])
    items, meta = await inventory_service.list_transfers(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/transfers")
async def create_t(payload: dict = Body(...),
                    user: dict = Depends(require_perm("inventory.transfer.create"))):
    return ok_envelope(await inventory_service.create_transfer(payload, user=user))


@router.post("/transfers/{id_}/send")
async def send_t(id_: str, user: dict = Depends(require_perm("inventory.transfer.send"))):
    return ok_envelope(await inventory_service.send_transfer(id_, user=user))


@router.post("/transfers/{id_}/receive")
async def receive_t(id_: str, user: dict = Depends(require_perm("inventory.transfer.receive"))):
    return ok_envelope(await inventory_service.receive_transfer(id_, user=user))


# Adjustment
@router.get("/adjustments")
async def list_a(
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("inventory.movement.read")),
):
    user_perms = await get_user_permissions(user)
    outlet_ids = None if "*" in user_perms else user.get("outlet_ids", [])
    items, meta = await inventory_service.list_adjustments(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/adjustments")
async def create_a(payload: dict = Body(...),
                    user: dict = Depends(require_perm("inventory.adjustment.create"))):
    return ok_envelope(await inventory_service.create_adjustment(payload, user=user))


@router.post("/adjustments/{id_}/approve")
async def approve_a(id_: str, payload: dict = Body(default={}),
                     user: dict = Depends(current_user)):
    # Permission enforced by approval engine (multi-tier) — fall back to legacy check if no workflow
    return ok_envelope(await inventory_service.approve_adjustment(
        id_, user=user, note=payload.get("note")))


@router.post("/adjustments/{id_}/reject")
async def reject_a(id_: str, payload: dict = Body(...),
                    user: dict = Depends(current_user)):
    return ok_envelope(await inventory_service.reject_adjustment(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/adjustments/{id_}/approval-state")
async def adjustment_approval_state(id_: str, user: dict = Depends(current_user)):
    return ok_envelope(await inventory_service.get_adjustment_approval_state(id_))


# Opname
@router.get("/opname")
async def list_o(
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    user_perms = await get_user_permissions(user)
    outlet_ids = None if "*" in user_perms else user.get("outlet_ids", [])
    items, meta = await inventory_service.list_opname(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/opname/start")
async def start_o(payload: dict = Body(...),
                   user: dict = Depends(require_perm("outlet.opname.execute"))):
    return ok_envelope(await inventory_service.start_opname(payload, user=user))


@router.patch("/opname/{id_}/lines")
async def update_o_lines(id_: str, payload: dict = Body(...),
                          user: dict = Depends(require_perm("outlet.opname.execute"))):
    return ok_envelope(await inventory_service.update_opname_lines(
        id_, payload.get("lines", []), user=user))


@router.post("/opname/{id_}/submit")
async def submit_o(id_: str,
                    user: dict = Depends(require_perm("inventory.opname.submit"))):
    return ok_envelope(await inventory_service.submit_opname(id_, user=user))
