"""Phase 7C — Forecasting Service.

Provides 3-month (or N-month) forecasts for:
- Daily/Monthly sales (per outlet, per brand, or consolidated)
- Daily/Monthly expense (filtered by COA account or category)

Methods:
- linear : least-squares linear regression (trend extrapolation)
- ewma   : exponentially weighted moving average (recency-biased flat forecast)
- hybrid : weighted blend (default 50/50) — usually more robust

Outputs include:
- history[]            (per-day actual values, last N days)
- forecast[]           (per-day predicted values, next N days)
- monthly_history[]    (aggregated per month, last 6 months)
- monthly_forecast[]   (aggregated per month, next 3 months)
- confidence_band      (±2σ residual on daily series)
- accuracy_mape        (Mean Absolute Percentage Error on last 30-day holdout)
- method, params       (metadata for transparency)
"""
from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from core.db import get_db
from core.exceptions import ValidationError

# ----------------------------- Algorithms -----------------------------

def _linear_regression(values: list[float]) -> dict[str, float]:
    """Least squares y = a + b*t with t=0..n-1. Returns {a, b, rmse, r2}."""
    n = len(values)
    if n < 2:
        return {"a": values[0] if values else 0.0, "b": 0.0, "rmse": 0.0, "r2": 0.0}
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values))
    den = sum((x - mean_x) ** 2 for x in xs)
    b = num / den if den != 0 else 0.0
    a = mean_y - b * mean_x
    # residuals
    preds = [a + b * x for x in xs]
    residuals = [y - p for y, p in zip(values, preds)]
    rmse = math.sqrt(sum(r ** 2 for r in residuals) / n) if n else 0.0
    ss_res = sum(r ** 2 for r in residuals)
    ss_tot = sum((y - mean_y) ** 2 for y in values)
    r2 = (1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
    return {"a": a, "b": b, "rmse": rmse, "r2": round(r2, 3)}


def _linear_predict(model: dict, n_history: int, steps: int) -> list[float]:
    """Predict steps ahead given linear model and how many history points were used."""
    return [model["a"] + model["b"] * (n_history + i) for i in range(steps)]


def _ewma(values: list[float], alpha: float = 0.3) -> dict[str, float]:
    """Returns {level: last EWMA, residual_std: stddev of residuals}."""
    if not values:
        return {"level": 0.0, "residual_std": 0.0}
    level = values[0]
    residuals: list[float] = []
    for v in values[1:]:
        residuals.append(v - level)
        level = alpha * v + (1 - alpha) * level
    rstd = statistics.pstdev(residuals) if len(residuals) > 1 else 0.0
    return {"level": level, "residual_std": rstd}


def _ewma_predict(model: dict, steps: int) -> list[float]:
    """EWMA forecast is flat at the last level."""
    return [model["level"]] * steps


def _hybrid_predict(linear_pred: list[float], ewma_pred: list[float], weight: float = 0.5) -> list[float]:
    """Weighted blend of linear and EWMA forecasts."""
    return [weight * a + (1 - weight) * b for a, b in zip(linear_pred, ewma_pred)]


def _mape(actual: list[float], predicted: list[float]) -> Optional[float]:
    """Mean Absolute Percentage Error. Returns % (0-100+). None if all-zero actuals."""
    pairs = [(a, p) for a, p in zip(actual, predicted) if a != 0]
    if not pairs:
        return None
    return round(
        sum(abs(a - p) / abs(a) for a, p in pairs) / len(pairs) * 100, 2,
    )


# ----------------------------- Data Loaders -----------------------------

async def _load_daily_sales(
    outlet_id: Optional[str], brand_id: Optional[str],
    date_from: str, date_to: str,
) -> dict[str, float]:
    """Return {date_iso: total_sales} for the given filters, only validated."""
    db = get_db()
    match: dict[str, Any] = {
        "deleted_at": None, "status": "validated",
        "sales_date": {"$gte": date_from, "$lte": date_to},
    }
    if outlet_id:
        match["outlet_id"] = outlet_id
    if brand_id:
        match["brand_id"] = brand_id
    out: dict[str, float] = {}
    async for d in db.daily_sales.find(match):
        date = d.get("sales_date")
        out[date] = out.get(date, 0.0) + float(d.get("grand_total", 0) or 0)
    return out


async def _load_daily_expense(
    outlet_id: Optional[str], coa_ids: Optional[list[str]],
    date_from: str, date_to: str,
) -> dict[str, float]:
    """Sum expense (Dr - Cr on expense/cogs accounts) per day."""
    db = get_db()
    # Resolve expense account IDs if not given
    if not coa_ids:
        coa_ids = []
        async for c in db.chart_of_accounts.find(
            {"type": {"$in": ["expense", "cogs"]}, "is_postable": True, "deleted_at": None},
        ):
            coa_ids.append(c["id"])
    if not coa_ids:
        return {}
    je_match: dict[str, Any] = {
        "deleted_at": None, "status": "posted",
        "entry_date": {"$gte": date_from, "$lte": date_to},
    }
    out: dict[str, float] = {}
    async for je in db.journal_entries.find(je_match):
        date = je.get("entry_date")
        for ln in je.get("lines", []):
            if ln.get("coa_id") not in coa_ids:
                continue
            if outlet_id and ln.get("dim_outlet") != outlet_id:
                continue
            amt = float(ln.get("dr", 0) or 0) - float(ln.get("cr", 0) or 0)
            if amt == 0:
                continue
            out[date] = out.get(date, 0.0) + amt
    return out


def _fill_missing_dates(series: dict[str, float], from_date: str, to_date: str) -> list[tuple[str, float]]:
    """Return list of (date, value) for every day in [from, to], filling missing with 0."""
    out: list[tuple[str, float]] = []
    cur = datetime.strptime(from_date, "%Y-%m-%d").date()
    end = datetime.strptime(to_date, "%Y-%m-%d").date()
    while cur <= end:
        iso = cur.isoformat()
        out.append((iso, series.get(iso, 0.0)))
        cur += timedelta(days=1)
    return out


def _aggregate_monthly(daily: list[tuple[str, float]]) -> list[dict[str, Any]]:
    """Aggregate daily series → monthly. Returns [{period:'YYYY-MM', value:..., days:...}]."""
    months: dict[str, dict[str, Any]] = {}
    for date, v in daily:
        m = date[:7]
        if m not in months:
            months[m] = {"period": m, "value": 0.0, "days": 0}
        months[m]["value"] += v
        months[m]["days"] += 1
    out = sorted(months.values(), key=lambda r: r["period"])
    for r in out:
        r["value"] = round(r["value"], 2)
    return out


# ----------------------------- Public API -----------------------------

async def forecast_series(
    *,
    target: str,  # "sales" | "expense"
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    coa_ids: Optional[list[str]] = None,
    months: int = 3,
    method: str = "hybrid",  # linear | ewma | hybrid
    history_days: int = 90,
    backtest_days: int = 30,
    ewma_alpha: float = 0.3,
    hybrid_weight: float = 0.5,
) -> dict[str, Any]:
    """Run a forecast on the chosen target and return full payload for UI."""
    if method not in ("linear", "ewma", "hybrid"):
        raise ValidationError("Method harus 'linear', 'ewma', atau 'hybrid'")
    if months <= 0 or months > 12:
        raise ValidationError("months harus 1..12")
    if target not in ("sales", "expense"):
        raise ValidationError("target harus 'sales' atau 'expense'")

    today = datetime.now(timezone.utc).date()
    start = (today - timedelta(days=history_days)).isoformat()
    end = today.isoformat()

    # Load data
    if target == "sales":
        raw = await _load_daily_sales(outlet_id, brand_id, start, end)
    else:
        raw = await _load_daily_expense(outlet_id, coa_ids, start, end)

    daily = _fill_missing_dates(raw, start, end)
    values = [v for _, v in daily]

    # Forecast horizon (days)
    forecast_days = months * 31  # approx; we'll trim by month end

    # Backtest: train on first (n-backtest), predict last `backtest_days`, compute MAPE
    accuracy_mape: Optional[float] = None
    if len(values) > backtest_days + 7:
        train = values[:-backtest_days]
        actual = values[-backtest_days:]
        try:
            if method == "linear":
                m = _linear_regression(train)
                pred = _linear_predict(m, len(train), backtest_days)
            elif method == "ewma":
                m = _ewma(train, alpha=ewma_alpha)
                pred = _ewma_predict(m, backtest_days)
            else:  # hybrid
                ml = _linear_regression(train)
                pl = _linear_predict(ml, len(train), backtest_days)
                me = _ewma(train, alpha=ewma_alpha)
                pe = _ewma_predict(me, backtest_days)
                pred = _hybrid_predict(pl, pe, weight=hybrid_weight)
            accuracy_mape = _mape(actual, pred)
        except Exception:  # noqa: BLE001
            accuracy_mape = None

    # Final fit on full data
    linear_model = _linear_regression(values)
    ewma_model = _ewma(values, alpha=ewma_alpha)

    if method == "linear":
        forecast_vals = _linear_predict(linear_model, len(values), forecast_days)
        residual_std = linear_model["rmse"]
        params = {"a": linear_model["a"], "b": linear_model["b"], "r2": linear_model["r2"]}
    elif method == "ewma":
        forecast_vals = _ewma_predict(ewma_model, forecast_days)
        residual_std = ewma_model["residual_std"]
        params = {"alpha": ewma_alpha, "level": ewma_model["level"]}
    else:  # hybrid
        lp = _linear_predict(linear_model, len(values), forecast_days)
        ep = _ewma_predict(ewma_model, forecast_days)
        forecast_vals = _hybrid_predict(lp, ep, weight=hybrid_weight)
        # Combined residual ≈ avg of the two (rough)
        residual_std = (linear_model["rmse"] * hybrid_weight
                        + ewma_model["residual_std"] * (1 - hybrid_weight))
        params = {
            "alpha": ewma_alpha, "weight": hybrid_weight,
            "linear_a": linear_model["a"], "linear_b": linear_model["b"],
            "ewma_level": ewma_model["level"], "r2": linear_model["r2"],
        }

    # Clamp negative forecasts to 0 (sales/expense can't be negative for our purposes)
    forecast_vals = [max(0.0, v) for v in forecast_vals]

    # Build forecast daily list with dates
    forecast_daily: list[tuple[str, float]] = []
    for i, v in enumerate(forecast_vals, start=1):
        d = (today + timedelta(days=i)).isoformat()
        forecast_daily.append((d, round(v, 2)))

    # Monthly aggregations
    monthly_history = _aggregate_monthly(daily)
    monthly_forecast_full = _aggregate_monthly(forecast_daily)
    # Take only the next `months` complete months
    monthly_forecast = monthly_forecast_full[:months]

    # Confidence band (±2σ residual_std)
    band = round(2 * residual_std, 2)

    # Method comparison (always include all 3 for UI side-by-side)
    comparison: dict[str, list[dict[str, Any]]] = {}
    for mname in ("linear", "ewma", "hybrid"):
        if mname == "linear":
            preds = _linear_predict(linear_model, len(values), forecast_days)
        elif mname == "ewma":
            preds = _ewma_predict(ewma_model, forecast_days)
        else:
            preds = _hybrid_predict(
                _linear_predict(linear_model, len(values), forecast_days),
                _ewma_predict(ewma_model, forecast_days),
                weight=hybrid_weight,
            )
        preds = [max(0.0, p) for p in preds]
        m_daily = [
            ((today + timedelta(days=i + 1)).isoformat(), p) for i, p in enumerate(preds)
        ]
        comparison[mname] = _aggregate_monthly(m_daily)[:months]

    return {
        "target": target,
        "method": method,
        "params": params,
        "filters": {
            "outlet_id": outlet_id, "brand_id": brand_id,
            "history_days": history_days, "months_ahead": months,
        },
        "history_daily": [{"date": d, "value": round(v, 2)} for d, v in daily],
        "forecast_daily": [{"date": d, "value": v} for d, v in forecast_daily],
        "monthly_history": monthly_history[-6:],   # last 6 months
        "monthly_forecast": monthly_forecast,       # next N months
        "confidence_band": band,
        "accuracy_mape": accuracy_mape,
        "totals": {
            "history_total": round(sum(values), 2),
            "history_avg_daily": round(statistics.mean(values), 2) if values else 0.0,
            "forecast_total": round(sum(forecast_vals), 2),
            "forecast_avg_daily": round(statistics.mean(forecast_vals), 2) if forecast_vals else 0.0,
            "growth_pct": (
                round((sum(forecast_vals) - sum(values)) / sum(values) * 100, 2)
                if sum(values) > 0 else None
            ),
        },
        "comparison_methods": comparison,
    }


async def forecast_dashboard(*, months: int = 3, method: str = "hybrid") -> dict[str, Any]:
    """Run forecast for all 4 outlets + group consolidated, return summary cards data."""
    db = get_db()
    outlets = await db.outlets.find({"deleted_at": None}).to_list(20)

    rows: list[dict[str, Any]] = []
    # Per outlet sales
    for o in outlets:
        try:
            r = await forecast_series(
                target="sales", outlet_id=o["id"], months=months, method=method,
            )
            rows.append({
                "outlet_id": o["id"],
                "outlet_name": o.get("name", o["id"]),
                "outlet_code": o.get("code", ""),
                "history_total": r["totals"]["history_total"],
                "forecast_total": r["totals"]["forecast_total"],
                "growth_pct": r["totals"]["growth_pct"],
                "accuracy_mape": r["accuracy_mape"],
                "monthly_forecast": r["monthly_forecast"],
                "confidence_band": r["confidence_band"],
            })
        except Exception:  # noqa: BLE001
            continue

    # Group consolidated
    consolidated = await forecast_series(
        target="sales", outlet_id=None, months=months, method=method,
    )

    return {
        "method": method,
        "months_ahead": months,
        "consolidated": {
            "history_total": consolidated["totals"]["history_total"],
            "forecast_total": consolidated["totals"]["forecast_total"],
            "growth_pct": consolidated["totals"]["growth_pct"],
            "accuracy_mape": consolidated["accuracy_mape"],
            "monthly_forecast": consolidated["monthly_forecast"],
            "confidence_band": consolidated["confidence_band"],
        },
        "outlets": rows,
    }


def get_methods_catalog() -> dict[str, Any]:
    return {
        "methods": [
            {"key": "linear", "label": "Linear Regression",
             "description": "Trend extrapolation by least squares — bagus untuk data dengan tren konsisten"},
            {"key": "ewma", "label": "EWMA",
             "description": "Exponentially Weighted Moving Average — bagus untuk data volatil dengan emphasis pada nilai terbaru"},
            {"key": "hybrid", "label": "Hybrid (Linear + EWMA)",
             "description": "Blend 50/50 — biasanya lebih robust di rentang 60-90 hari data"},
        ],
        "targets": [
            {"key": "sales", "label": "Sales (validated daily_sales)"},
            {"key": "expense", "label": "Expense (JE postings ke COA expense/cogs)"},
        ],
    }
