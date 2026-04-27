"""/api/reports — Phase 7B advanced reports.

Endpoints:
- GET  /api/reports/catalog                       — list of supported dims/metrics
- GET  /api/reports/vendor-scorecard              — multi-vendor ranked scorecard
- GET  /api/reports/vendor-scorecard/{vendor_id}  — single vendor detail
- POST /api/reports/builder/run                   — ad-hoc report run
- GET  /api/reports/pivot                         — 2D matrix
- GET  /api/reports/comparatives                  — MoM/YoY metric comparison
- CRUD /api/reports/saved                         — saved report definitions
"""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm, require_perm
from services import reports_service

router = APIRouter(prefix="/api/reports", tags=["reports"])

# A single permission gate for all reports — Finance / Procurement / Executive personas already
# carry one of these; reuse for simplicity.
_REPORT_READ_PERMS = (
    "finance.report.profit_loss",
    "executive.dashboard.read",
    "procurement.vendor.scorecard",
)


@router.get("/catalog")
async def catalog(user: dict = Depends(current_user)):
    """Return supported dims + metrics + comparatives. No special perm needed beyond auth."""
    return ok_envelope(reports_service.get_catalog())


# -------- Vendor Scorecard --------
@router.get("/vendor-scorecard")
async def vendor_scorecard_list(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    top: int = Query(20, ge=1, le=200),
    user: dict = Depends(require_any_perm("procurement.vendor.scorecard", *_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.vendor_scorecard(
        vendor_id=None, date_from=date_from, date_to=date_to, top=top,
    ))


@router.get("/vendor-scorecard/{vendor_id}")
async def vendor_scorecard_detail(
    vendor_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_any_perm("procurement.vendor.scorecard", *_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.vendor_scorecard(
        vendor_id=vendor_id, date_from=date_from, date_to=date_to, top=1,
    ))


# -------- Report Builder --------
@router.post("/builder/run")
async def builder_run(
    payload: dict = Body(...),
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.report_builder(
        dimensions=payload.get("dimensions", []),
        metrics=payload.get("metrics", []),
        period_from=payload.get("period_from"),
        period_to=payload.get("period_to"),
        outlet_ids=payload.get("outlet_ids"),
        brand_ids=payload.get("brand_ids"),
        vendor_ids=payload.get("vendor_ids"),
        category_ids=payload.get("category_ids"),
        sort_by=payload.get("sort_by"),
        sort_dir=payload.get("sort_dir", "desc"),
        limit=int(payload.get("limit", 100)),
    ))


# -------- Pivot --------
@router.get("/pivot")
async def pivot(
    dim_x: str,
    dim_y: str,
    metric: str,
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.pivot_matrix(
        dim_x=dim_x, dim_y=dim_y, metric=metric,
        period_from=period_from, period_to=period_to,
    ))


# -------- Comparatives --------
@router.get("/comparatives")
async def comparatives(
    metric: str,
    period: str,
    compare_to: str = "mom",
    outlet_ids: Optional[str] = None,
    brand_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    o_ids = [s for s in outlet_ids.split(",") if s] if outlet_ids else None
    b_ids = [s for s in brand_ids.split(",") if s] if brand_ids else None
    return ok_envelope(await reports_service.comparatives(
        metric=metric, period=period, compare_to=compare_to,
        outlet_ids=o_ids, brand_ids=b_ids,
    ))


# -------- Saved Reports CRUD --------
@router.get("/saved")
async def list_saved(user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.list_saved_reports(user_id=user["id"]))


@router.get("/saved/{saved_id}")
async def get_saved(saved_id: str,
                     user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.get_saved(saved_id, user_id=user["id"]))


@router.post("/saved")
async def save_report(payload: dict = Body(...),
                       user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.save_report(
        user_id=user["id"],
        name=payload.get("name", ""),
        description=payload.get("description"),
        config=payload.get("config", {}),
        saved_id=payload.get("id"),
        public=bool(payload.get("public", False)),
    ))


@router.patch("/saved/{saved_id}")
async def update_saved(saved_id: str, payload: dict = Body(...),
                        user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.save_report(
        user_id=user["id"],
        name=payload.get("name", ""),
        description=payload.get("description"),
        config=payload.get("config", {}),
        saved_id=saved_id,
        public=bool(payload.get("public", False)),
    ))


@router.delete("/saved/{saved_id}")
async def delete_saved(saved_id: str,
                        user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.delete_saved(saved_id, user_id=user["id"]))
