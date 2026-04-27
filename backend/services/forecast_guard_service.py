"""Forecast Guard — checks a proposed expense vs forecast and returns a verdict.

Used as pre-submit guardrail in:
- Manual Journal Form
- Urgent Purchase form
- (Optional) PR/PO submission, Petty Cash bulk top-up

Algorithm:
1. Determine target period (default = current calendar month YYYY-MM)
2. Compute MTD (month-to-date) actual spent on expense COA accounts for outlet/brand
   - For "expense" kind: sum JE postings on expense+cogs COA (Dr - Cr)
   - For "revenue" kind: sum daily_sales grand_total (validated) within the month
3. Get forecast value for that month from forecasting_service
4. Compute projected_total = MTD + new_amount
5. Compare projected_total vs (forecast_value + ci_band)
   - >20% above (forecast + band) → severity = "severe"
   - >10% above forecast            → severity = "mild"
   - within forecast or below       → severity = "none"
6. Return verdict for UI to display
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from core.db import get_db
from core.exceptions import ValidationError
from services import forecasting_service


def _current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _period_bounds(period: str) -> tuple[str, str]:
    """Return (start_date_iso, end_date_iso) for a YYYY-MM period."""
    try:
        y, m = [int(x) for x in period.split("-")]
        start = f"{y:04d}-{m:02d}-01"
        if m == 12:
            ny, nm = y + 1, 1
        else:
            ny, nm = y, m + 1
        # last day of month = (next month start - 1 day) — keep as inclusive end
        end = f"{ny:04d}-{nm:02d}-01"
        return start, end
    except Exception as e:
        raise ValidationError(f"Period harus YYYY-MM: {period}") from e


async def _mtd_expense(
    outlet_id: Optional[str], brand_id: Optional[str],
    period: str,
) -> float:
    """Sum expense (Dr - Cr) on expense+cogs COA for the period [start, today]."""
    db = get_db()
    start, period_end = _period_bounds(period)
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Use today as the cap so MTD doesn't double-count future
    cap = min(today_iso, period_end)

    # Resolve expense COA ids
    exp_ids: list[str] = []
    async for c in db.chart_of_accounts.find(
        {"type": {"$in": ["expense", "cogs"]}, "is_postable": True, "deleted_at": None},
    ):
        exp_ids.append(c["id"])
    if not exp_ids:
        return 0.0

    je_match: dict[str, Any] = {
        "deleted_at": None, "status": "posted",
        "entry_date": {"$gte": start, "$lte": cap},
    }
    total = 0.0
    async for je in db.journal_entries.find(je_match):
        for ln in je.get("lines", []):
            if ln.get("coa_id") not in exp_ids:
                continue
            if outlet_id and ln.get("dim_outlet") != outlet_id:
                continue
            if brand_id and ln.get("dim_brand") != brand_id:
                continue
            total += float(ln.get("dr", 0) or 0) - float(ln.get("cr", 0) or 0)
    return round(total, 2)


async def _mtd_revenue(
    outlet_id: Optional[str], brand_id: Optional[str], period: str,
) -> float:
    """Sum validated daily_sales grand_total for the period [start, today]."""
    db = get_db()
    start, period_end = _period_bounds(period)
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cap = min(today_iso, period_end)
    match: dict[str, Any] = {
        "deleted_at": None, "status": "validated",
        "sales_date": {"$gte": start, "$lte": cap},
    }
    if outlet_id:
        match["outlet_id"] = outlet_id
    if brand_id:
        match["brand_id"] = brand_id
    total = 0.0
    async for d in db.daily_sales.find(match):
        total += float(d.get("grand_total", 0) or 0)
    return round(total, 2)


async def _forecast_for_period(
    target: str,  # "expense" or "sales"
    outlet_id: Optional[str], brand_id: Optional[str], period: str,
    method: str = "hybrid",
) -> dict[str, Any]:
    """Pull the FULL-month forecast for the specific period.

    For the current month, the forecast = MTD (already in monthly_history) + remaining-days
    forecast (in monthly_forecast). For past/future months, monthly_history or
    monthly_forecast gives the value directly.
    """
    fc = await forecasting_service.forecast_series(
        target="sales" if target == "revenue" else "expense",
        outlet_id=outlet_id, brand_id=brand_id,
        months=3, method=method,
    )
    history_row = next(
        (r for r in (fc.get("monthly_history") or []) if r.get("period") == period), None,
    )
    forecast_row = next(
        (r for r in (fc.get("monthly_forecast") or []) if r.get("period") == period), None,
    )
    history_val = float(history_row.get("value", 0)) if history_row else 0.0
    forecast_val = float(forecast_row.get("value", 0)) if forecast_row else 0.0

    # For current month: combine partial-MTD-history + remaining-days-forecast
    # For past months: use history only (forecast = 0 or missing)
    # For future months: use forecast only (history = 0 or missing)
    forecast_value = history_val + forecast_val
    return {
        "forecast_value": forecast_value,
        "ci_band": float(fc.get("confidence_band", 0) or 0),
        "method": fc.get("method"),
        "history_avg_daily": float(fc.get("totals", {}).get("history_avg_daily", 0) or 0),
        "found_in_period": (history_row is not None) or (forecast_row is not None),
        "history_portion": history_val,
        "forecast_portion": forecast_val,
    }


def _classify(projected: float, forecast: float, band: float) -> tuple[str, float]:
    """Return (severity, deviation_pct)."""
    if forecast <= 0:
        # No forecast available → can't classify; "info" only
        return ("none", 0.0)
    deviation = projected - forecast
    deviation_pct = round((deviation / forecast) * 100, 2) if forecast > 0 else 0.0
    upper_bound = forecast + band
    if projected > upper_bound * 1.20:  # >20% above the upper band
        return ("severe", deviation_pct)
    if projected > forecast * 1.10:  # >10% above the forecast (regardless of band)
        return ("mild", deviation_pct)
    return ("none", deviation_pct)


def _format_rp(n: float) -> str:
    """Indonesia-style Rupiah formatter, e.g., 1234567 -> 'Rp 1.234.567'."""
    sign = "-" if n < 0 else ""
    s = f"{int(abs(round(n))):,}".replace(",", ".")
    return f"{sign}Rp {s}"


def _build_message(
    severity: str, kind: str, deviation_pct: float,
    forecast_value: float, projected: float, period: str,
) -> str:
    if severity == "none":
        if forecast_value <= 0:
            return (
                f"Belum ada forecast untuk periode {period}. "
                f"Pastikan pengeluaran wajar untuk jenis transaksi ini."
            )
        return (
            f"Pengeluaran ini berada dalam range forecast untuk {period} "
            f"({_format_rp(forecast_value)})."
        )
    direction = "di atas" if deviation_pct >= 0 else "di bawah"
    if severity == "mild":
        return (
            f"Pengeluaran ini akan membawa total {kind} {period} ke "
            f"{_format_rp(projected)} — sekitar {abs(deviation_pct):.1f}% {direction} forecast "
            f"({_format_rp(forecast_value)}). Harap konfirmasi alasan kenaikan."
        )
    return (
        f"Pengeluaran ini akan membuat total {kind} {period} mencapai "
        f"{_format_rp(projected)} — {abs(deviation_pct):.1f}% {direction} forecast "
        f"({_format_rp(forecast_value)}). Sangat di luar pola normal — review wajib sebelum approve."
    )


async def check_expense(
    *,
    amount: float,
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    kind: str = "expense",  # expense | revenue
    period: Optional[str] = None,
    method: str = "hybrid",
) -> dict[str, Any]:
    """Main entry point. Returns verdict dict suitable for UI banner."""
    if amount is None:
        raise ValidationError("amount wajib")
    try:
        amount = float(amount)
    except Exception as e:
        raise ValidationError("amount harus angka") from e
    if amount < 0:
        raise ValidationError("amount harus ≥ 0")
    if kind not in ("expense", "revenue"):
        raise ValidationError("kind harus 'expense' atau 'revenue'")

    period = period or _current_period()
    # Validate format
    _period_bounds(period)

    # MTD actual
    if kind == "expense":
        mtd = await _mtd_expense(outlet_id, brand_id, period)
    else:
        mtd = await _mtd_revenue(outlet_id, brand_id, period)

    # Forecast for the period
    fc = await _forecast_for_period(kind, outlet_id, brand_id, period, method=method)
    forecast_value = fc["forecast_value"]
    ci_band = fc["ci_band"]

    # If amount alone is huge but forecast is for the full month,
    # we compare projected total (mtd + amount) vs forecast.
    projected = round(mtd + amount, 2)
    severity, deviation_pct = _classify(projected, forecast_value, ci_band)

    # Build human-readable message
    message = _build_message(severity, kind, deviation_pct, forecast_value, projected, period)

    return {
        "severity": severity,                 # none | mild | severe
        "deviation_pct": deviation_pct,
        "amount": amount,
        "kind": kind,
        "period": period,
        "outlet_id": outlet_id,
        "brand_id": brand_id,
        "mtd_amount": mtd,
        "projected": projected,
        "forecast_value": forecast_value,
        "ci_band": ci_band,
        "exceeds_forecast": projected > forecast_value if forecast_value > 0 else False,
        "exceeds_band": projected > (forecast_value + ci_band) if forecast_value > 0 else False,
        "method": fc["method"],
        "message": message,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# Persistence — guard logs (audit trail + dashboard widget)
# ============================================================

async def log_verdict(
    *,
    verdict: dict[str, Any],
    source_type: str,         # "journal_entry" | "urgent_purchase" | "petty_cash" | etc.
    source_id: str,
    source_doc_no: Optional[str] = None,
    reason: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Persist a guard verdict log row IF severity is mild or severe.

    Idempotent: a log already exists for (source_type, source_id) is updated, not duplicated.
    Returns the persisted row, or None if severity was 'none' (nothing logged).
    """
    if not verdict or verdict.get("severity") == "none":
        return None
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "source_type": source_type,
        "source_id": source_id,
        "source_doc_no": source_doc_no,
        "severity": verdict.get("severity"),
        "deviation_pct": verdict.get("deviation_pct"),
        "amount": verdict.get("amount"),
        "kind": verdict.get("kind"),
        "period": verdict.get("period"),
        "outlet_id": verdict.get("outlet_id"),
        "brand_id": verdict.get("brand_id"),
        "mtd_amount": verdict.get("mtd_amount"),
        "projected": verdict.get("projected"),
        "forecast_value": verdict.get("forecast_value"),
        "ci_band": verdict.get("ci_band"),
        "method": verdict.get("method"),
        "message": verdict.get("message"),
        "reason": (reason or "").strip() or None,
        "updated_at": now,
        "updated_by": user_id,
    }

    existing = await db.forecast_guard_logs.find_one({
        "source_type": source_type, "source_id": source_id, "deleted_at": None,
    })
    if existing:
        await db.forecast_guard_logs.update_one(
            {"id": existing["id"]}, {"$set": payload},
        )
        merged = {**existing, **payload}
        return {k: v for k, v in merged.items() if k != "_id"}

    import uuid as _uuid
    doc = {
        "id": str(_uuid.uuid4()),
        **payload,
        "created_at": now,
        "created_by": user_id,
        "deleted_at": None,
    }
    await db.forecast_guard_logs.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


async def get_verdict_for_source(source_type: str, source_id: str) -> Optional[dict[str, Any]]:
    """Look up a previously-logged verdict for a given entity (used in approval UI)."""
    db = get_db()
    d = await db.forecast_guard_logs.find_one({
        "source_type": source_type, "source_id": source_id, "deleted_at": None,
    })
    if not d:
        return None
    return {k: v for k, v in d.items() if k != "_id"}


async def list_logs(
    *,
    days: int = 7,
    severity: Optional[str] = None,
    outlet_id: Optional[str] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    match: dict[str, Any] = {"deleted_at": None, "created_at": {"$gte": cutoff}}
    if severity:
        match["severity"] = severity
    if outlet_id:
        match["outlet_id"] = outlet_id
    items = await db.forecast_guard_logs.find(match).sort([("created_at", -1)]).to_list(limit)
    return [{k: v for k, v in d.items() if k != "_id"} for d in items]


async def activity_summary(
    *,
    days: int = 7,
) -> dict[str, Any]:
    """Aggregate forecast-guard activity for executive dashboard widget."""
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Load outlet names for labels
    outlets_map: dict[str, dict] = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlets_map[o["id"]] = {"name": o.get("name", o["id"]), "code": o.get("code", "")}

    by_outlet: dict[str, dict[str, Any]] = {}
    severe_count = 0
    mild_count = 0
    total_amount_at_risk = 0.0
    recent: list[dict[str, Any]] = []

    async for d in db.forecast_guard_logs.find(
        {"deleted_at": None, "created_at": {"$gte": cutoff}},
    ).sort([("created_at", -1)]):
        sev = d.get("severity")
        if sev == "severe":
            severe_count += 1
        elif sev == "mild":
            mild_count += 1
        amt = float(d.get("amount", 0) or 0)
        total_amount_at_risk += amt
        oid = d.get("outlet_id") or "_none"
        ot_label = outlets_map.get(d.get("outlet_id") or "", {}).get("name") if oid != "_none" else "Konsolidasi"
        ot_code = outlets_map.get(d.get("outlet_id") or "", {}).get("code") if oid != "_none" else ""
        if oid not in by_outlet:
            by_outlet[oid] = {
                "outlet_id": d.get("outlet_id"),
                "outlet_name": ot_label or "—",
                "outlet_code": ot_code or "",
                "count": 0, "severe": 0, "mild": 0, "total_amount": 0.0,
                "max_deviation_pct": 0.0,
            }
        b = by_outlet[oid]
        b["count"] += 1
        b["total_amount"] += amt
        if sev == "severe":
            b["severe"] += 1
        elif sev == "mild":
            b["mild"] += 1
        dev = abs(float(d.get("deviation_pct", 0) or 0))
        if dev > b["max_deviation_pct"]:
            b["max_deviation_pct"] = dev

        if len(recent) < 20:
            recent.append({
                "id": d.get("id"),
                "source_type": d.get("source_type"),
                "source_id": d.get("source_id"),
                "source_doc_no": d.get("source_doc_no"),
                "severity": sev,
                "amount": amt,
                "deviation_pct": d.get("deviation_pct"),
                "period": d.get("period"),
                "reason": d.get("reason"),
                "message": d.get("message"),
                "outlet_id": d.get("outlet_id"),
                "outlet_name": ot_label or "—",
                "created_at": d.get("created_at"),
                "link": _build_link(d.get("source_type"), d.get("source_id")),
            })

    # Round totals
    for b in by_outlet.values():
        b["total_amount"] = round(b["total_amount"], 2)
        b["max_deviation_pct"] = round(b["max_deviation_pct"], 2)

    by_outlet_list = sorted(by_outlet.values(), key=lambda x: x["count"], reverse=True)

    return {
        "days": days,
        "total": severe_count + mild_count,
        "severe_count": severe_count,
        "mild_count": mild_count,
        "total_amount_at_risk": round(total_amount_at_risk, 2),
        "by_outlet": by_outlet_list,
        "recent": recent,
    }


def _build_link(source_type: Optional[str], source_id: Optional[str]) -> Optional[str]:
    """Best-effort frontend deep-link for a guarded entity."""
    if not source_type or not source_id:
        return None
    if source_type == "journal_entry" or source_type == "manual":
        return f"/finance/journals/{source_id}"
    if source_type == "urgent_purchase":
        return f"/outlet/urgent-purchase?id={source_id}"
    if source_type == "petty_cash":
        return f"/outlet/petty-cash?id={source_id}"
    return None
