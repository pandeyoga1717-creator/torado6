"""/api/anomalies router — Phase 7D Real-Time Anomaly Detection."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import NotFoundError, ok_envelope
from core.security import current_user, require_any_perm, require_perm
from services import anomaly_service

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


# Users who can READ the feed: finance team + procurement team + executive + admin
READ_PERMS = [
    "anomaly.feed.read",
    "finance.sales.validate",
    "finance.report.profit_loss",
    "finance.report.cashflow",
    "executive.dashboard.read",
    "procurement.pr.approve",
    "procurement.po.approve",
]


TRIAGE_PERMS = [
    "anomaly.triage",
    "finance.sales.validate",
    "finance.report.profit_loss",
    "procurement.po.approve",
]


@router.get("")
async def list_anomalies(
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    items, meta = await anomaly_service.list_events(
        type=type, severity=severity, status=status,
        outlet_id=outlet_id, vendor_id=vendor_id,
        date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/summary")
async def anomaly_summary(
    days: int = Query(7, ge=1, le=90),
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    data = await anomaly_service.summary(days=days)
    return ok_envelope(data)


@router.get("/types")
async def list_anomaly_types(user: dict = Depends(current_user)):
    """Catalog of anomaly types for frontend filter dropdowns."""
    return ok_envelope([
        {"value": t, "label": anomaly_service.ANOMALY_TYPE_LABELS.get(t, t)}
        for t in anomaly_service.ANOMALY_TYPES
    ])


@router.get("/thresholds/resolve")
async def resolve_thresholds_endpoint(
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    on_date: Optional[str] = None,
    user: dict = Depends(require_any_perm(*READ_PERMS, "admin.business_rules.manage")),
):
    """Resolve the currently-effective thresholds for a scope — debug/admin helper."""
    th = await anomaly_service.resolve_thresholds(
        outlet_id=outlet_id, brand_id=brand_id, on_date=on_date,
    )
    return ok_envelope(th)


@router.post("/scan")
async def manual_scan(
    payload: dict = Body(default={}),
    user: dict = Depends(require_any_perm(
        "anomaly.scan.trigger",
        "admin.business_rules.manage",
        "finance.sales.validate",
        "finance.report.profit_loss",
    )),
):
    """Trigger a full anomaly scan (admin/finance manager only).
    Body: { as_of_date?: "YYYY-MM-DD", days?: 7, period?: "YYYY-MM" }
    """
    res = await anomaly_service.scan_all(
        as_of_date=payload.get("as_of_date"),
        days=int(payload.get("days", 7)),
        period=payload.get("period"),
        user_id=user["id"],
    )
    # Don't dump all events in response (could be huge) — only return counts + scan meta
    return ok_envelope({
        "as_of_date": res["as_of_date"],
        "period": res["period"],
        "counts": res["counts"],
    })


@router.get("/{anomaly_id}")
async def get_anomaly(
    anomaly_id: str,
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    ev = await anomaly_service.get_event(anomaly_id)
    if not ev:
        raise NotFoundError("Anomaly event")
    return ok_envelope(ev)


@router.post("/{anomaly_id}/triage")
async def triage_anomaly(
    anomaly_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_any_perm(*TRIAGE_PERMS)),
):
    """Acknowledge / mark investigating / resolve / mark false-positive.
    Body: { status: "acknowledged|investigating|resolved|false_positive", note?: "..." }
    """
    ev = await anomaly_service.triage_event(
        anomaly_id,
        new_status=payload.get("status", "acknowledged"),
        note=payload.get("note"),
        user=user,
    )
    return ok_envelope(ev)
