"""/api/forecasting — Phase 7C 3-month sales/expense forecasting.

Endpoints:
- GET  /api/forecasting/methods           — catalog of methods + targets
- GET  /api/forecasting/sales             — sales forecast (per outlet/brand or consolidated)
- GET  /api/forecasting/expense           — expense forecast (per outlet, optional COA filter)
- GET  /api/forecasting/dashboard         — summary across all outlets (executive view)
- POST /api/forecasting/guard/check       — pre-submit guardrail (forecast vs proposed amount)
"""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm
from services import forecast_guard_service, forecasting_service

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


@router.post("/guard/check")
async def guard_check(
    payload: dict = Body(...),
    user: dict = Depends(current_user),
):
    """Pre-submit forecast guard. Lightweight — auth required but no specific perm gate.

    Body:
      {
        "amount": float,            # required, ≥0
        "outlet_id": str,           # optional
        "brand_id": str,            # optional
        "kind": "expense"|"revenue",# default "expense"
        "period": "YYYY-MM",        # default current month
        "method": "hybrid"          # forecast method
      }
    """
    return ok_envelope(await forecast_guard_service.check_expense(
        amount=payload.get("amount", 0),
        outlet_id=payload.get("outlet_id"),
        brand_id=payload.get("brand_id"),
        kind=payload.get("kind", "expense"),
        period=payload.get("period"),
        method=payload.get("method", "hybrid"),
    ))


@router.get("/guard/source/{source_type}/{source_id}")
async def guard_for_source(
    source_type: str,
    source_id: str,
    user: dict = Depends(current_user),
):
    """Look up a previously-persisted guard verdict for a given entity (e.g., on approval detail)."""
    return ok_envelope(await forecast_guard_service.get_verdict_for_source(source_type, source_id))


@router.get("/guard/logs")
async def guard_logs(
    days: int = Query(7, ge=1, le=180),
    severity: Optional[str] = None,
    outlet_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_any_perm(*_FORECAST_PERMS)),
):
    return ok_envelope(await forecast_guard_service.list_logs(
        days=days, severity=severity, outlet_id=outlet_id, limit=limit,
    ))


@router.get("/guard/activity")
async def guard_activity(
    days: int = Query(7, ge=1, le=90),
    user: dict = Depends(require_any_perm(*_FORECAST_PERMS)),
):
    """Aggregated forecast-guard activity for the executive dashboard widget."""
    return ok_envelope(await forecast_guard_service.activity_summary(days=days))
