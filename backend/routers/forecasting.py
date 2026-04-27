"""/api/forecasting — Phase 7C 3-month sales/expense forecasting.

Endpoints:
- GET /api/forecasting/methods           — catalog of methods + targets
- GET /api/forecasting/sales             — sales forecast (per outlet/brand or consolidated)
- GET /api/forecasting/expense           — expense forecast (per outlet, optional COA filter)
- GET /api/forecasting/dashboard         — summary across all outlets (executive view)
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm
from services import forecasting_service

router = APIRouter(prefix="/api/forecasting", tags=["forecasting"])

_FORECAST_PERMS = (
    "executive.dashboard.read",
    "finance.report.profit_loss",
)


@router.get("/methods")
async def methods(user: dict = Depends(current_user)):
    return ok_envelope(forecasting_service.get_methods_catalog())


@router.get("/sales")
async def forecast_sales(
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    months: int = Query(3, ge=1, le=12),
    method: str = Query("hybrid"),
    history_days: int = Query(90, ge=14, le=365),
    user: dict = Depends(require_any_perm(*_FORECAST_PERMS)),
):
    return ok_envelope(await forecasting_service.forecast_series(
        target="sales", outlet_id=outlet_id, brand_id=brand_id,
        months=months, method=method, history_days=history_days,
    ))


@router.get("/expense")
async def forecast_expense(
    outlet_id: Optional[str] = None,
    coa_ids: Optional[str] = None,
    months: int = Query(3, ge=1, le=12),
    method: str = Query("hybrid"),
    history_days: int = Query(90, ge=14, le=365),
    user: dict = Depends(require_any_perm(*_FORECAST_PERMS)),
):
    coa_list = [c for c in coa_ids.split(",") if c] if coa_ids else None
    return ok_envelope(await forecasting_service.forecast_series(
        target="expense", outlet_id=outlet_id, coa_ids=coa_list,
        months=months, method=method, history_days=history_days,
    ))


@router.get("/dashboard")
async def forecast_dashboard(
    months: int = Query(3, ge=1, le=12),
    method: str = Query("hybrid"),
    user: dict = Depends(require_any_perm(*_FORECAST_PERMS)),
):
    return ok_envelope(await forecasting_service.forecast_dashboard(
        months=months, method=method,
    ))
