"""/api/outlet router."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import outlet_service

router = APIRouter(prefix="/api/outlet", tags=["outlet"])


@router.get("/home")
async def home(user: dict = Depends(require_perm("outlet.daily_sales.read"))):
    return ok_envelope(await outlet_service.home_tasks(user=user))


# Daily sales
@router.get("/daily-sales")
async def list_ds(
    outlet_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    items, meta = await outlet_service.list_daily_sales(
        outlet_ids=outlet_ids, date_from=date_from, date_to=date_to,
        status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/daily-sales/draft")
async def upsert_ds_draft(payload: dict = Body(...),
                           user: dict = Depends(require_perm("outlet.daily_sales.create"))):
    return ok_envelope(await outlet_service.upsert_daily_sales_draft(payload, user=user))


@router.post("/daily-sales/{id_}/submit")
async def submit_ds(id_: str, user: dict = Depends(require_perm("outlet.daily_sales.submit"))):
    return ok_envelope(await outlet_service.submit_daily_sales(id_, user=user))


@router.post("/daily-sales/{id_}/validate")
async def validate_ds(id_: str, user: dict = Depends(require_perm("finance.sales.validate"))):
    return ok_envelope(await outlet_service.validate_daily_sales(id_, user=user))


@router.post("/daily-sales/{id_}/reject")
async def reject_ds(id_: str, payload: dict = Body(...),
                     user: dict = Depends(require_perm("finance.sales.request_fix"))):
    return ok_envelope(await outlet_service.reject_daily_sales(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/daily-sales/{id_}")
async def get_ds(id_: str, user: dict = Depends(require_perm("outlet.daily_sales.read"))):
    return ok_envelope(await outlet_service.get_daily_sales(id_))


# Petty cash
@router.get("/petty-cash")
async def list_pc(
    outlet_id: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.petty_cash.read")),
):
    outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    items, meta = await outlet_service.list_petty_cash(
        outlet_ids=outlet_ids, date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/petty-cash/balance")
async def pc_balance(outlet_id: str,
                      user: dict = Depends(require_perm("outlet.petty_cash.read"))):
    bal = await outlet_service.petty_cash_balance(outlet_id)
    return ok_envelope({"outlet_id": outlet_id, "balance": bal})


@router.post("/petty-cash")
async def create_pc(payload: dict = Body(...),
                     user: dict = Depends(require_perm("outlet.petty_cash.create"))):
    return ok_envelope(await outlet_service.add_petty_cash(payload, user=user))


# Urgent purchase
@router.get("/urgent-purchases")
async def list_up(
    outlet_id: Optional[str] = None, status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    items, meta = await outlet_service.list_urgent_purchases(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/urgent-purchases")
async def create_up(payload: dict = Body(...),
                     user: dict = Depends(require_perm("outlet.urgent_purchase.create"))):
    return ok_envelope(await outlet_service.create_urgent_purchase(payload, user=user))


@router.post("/urgent-purchases/{id_}/approve")
async def approve_up(id_: str,
                       user: dict = Depends(require_perm("finance.payment.approve"))):
    return ok_envelope(await outlet_service.approve_urgent_purchase(id_, user=user))
