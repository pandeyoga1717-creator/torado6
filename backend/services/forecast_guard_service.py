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

from datetime import datetime, timezone
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
