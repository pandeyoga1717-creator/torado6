"""Phase 7D — Anomaly Detection Service.

Detects anomalies across:
1. sales_deviation     — daily sales vs rolling 14-day outlet baseline
2. vendor_price_spike  — GR unit_cost vs vendor 90-day item price baseline
3. vendor_leadtime     — PO→GR actual lead time vs vendor 90-day baseline
4. ap_cash_spike       — AP/cash outflow spike vs forecast/baseline

Design:
- Pure Python math (statistics stdlib) — no external ML libs.
- Idempotent upsert keyed by (type, source_type, source_id) so repeated scans
  update instead of duplicating.
- Thresholds resolved via business_rules_service (outlet → brand → group).
- Notifications dispatched to role-based recipients via notification_service.
- Live hooks callable best-effort (exception-safe) from other services.
- Batch scan entrypoint: scan_all(as_of_date).

Storage: MongoDB collection `anomaly_events`:
  { id, type, severity (none|mild|severe), status (open|acknowledged|investigating|resolved|false_positive),
    source_type, source_id, source_doc_no,
    outlet_id, brand_id, vendor_id, item_id,
    observed_value, baseline_value, baseline_stddev, deviation_pct, z_score,
    excess_days, threshold_snapshot,
    period, scan_date,
    title, message, context,
    acknowledged_by, acknowledged_at, acknowledged_note,
    resolved_by, resolved_at, resolution_note,
    created_at, updated_at, deleted_at }
"""
from __future__ import annotations

import logging
import statistics
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from core.db import get_db, serialize
from services import business_rules_service, notification_service

logger = logging.getLogger("aurora.anomaly")


# ============================================================
# CONSTANTS
# ============================================================

ANOMALY_TYPES: list[str] = [
    "sales_deviation",
    "vendor_price_spike",
    "vendor_leadtime",
    "ap_cash_spike",
]

ANOMALY_TYPE_LABELS: dict[str, str] = {
    "sales_deviation": "Deviasi Penjualan Harian",
    "vendor_price_spike": "Lonjakan Harga Vendor",
    "vendor_leadtime": "Lead Time Vendor Memburuk",
    "ap_cash_spike": "Lonjakan Pengeluaran Kas/AP",
}

VALID_STATUSES = ("open", "acknowledged", "investigating", "resolved", "false_positive")

DEFAULT_THRESHOLDS: dict[str, dict] = {
    "sales_deviation": {
        "enabled": True, "sigma_mild": 1.5, "sigma_severe": 2.5,
        "window_days": 14, "min_points": 7,
    },
    "vendor_price_spike": {
        "enabled": True, "pct_mild": 15, "pct_severe": 30, "window_days": 90,
    },
    "vendor_leadtime": {
        "enabled": True, "days_mild": 3, "days_severe": 7, "window_days": 90,
    },
    "ap_cash_spike": {
        "enabled": True, "pct_mild": 15, "pct_severe": 30,
    },
}


# ============================================================
# HELPERS
# ============================================================


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _format_rp(n: float) -> str:
    sign = "-" if n < 0 else ""
    s = f"{int(abs(round(n))):,}".replace(",", ".")
    return f"{sign}Rp {s}"


def _classify_sigma(z: float, mild: float, severe: float) -> str:
    a = abs(z)
    if a >= severe:
        return "severe"
    if a >= mild:
        return "mild"
    return "none"


def _classify_pct(pct: float, mild: float, severe: float) -> str:
    a = abs(pct)
    if a >= severe:
        return "severe"
    if a >= mild:
        return "mild"
    return "none"


def _classify_excess_days(excess: float, mild: float, severe: float) -> str:
    if excess >= severe:
        return "severe"
    if excess >= mild:
        return "mild"
    return "none"


def _rolling_stats(values: list[float]) -> dict:
    n = len(values)
    if n == 0:
        return {"mean": 0.0, "stddev": 0.0, "count": 0}
    mean = sum(values) / n
    if n < 2:
        return {"mean": mean, "stddev": 0.0, "count": n}
    variance = sum((v - mean) ** 2 for v in values) / n
    return {"mean": mean, "stddev": variance ** 0.5, "count": n}


# ============================================================
# THRESHOLD RESOLUTION (via business_rules)
# ============================================================


async def resolve_thresholds(
    *, outlet_id: Optional[str] = None, brand_id: Optional[str] = None,
    on_date: Optional[str] = None,
) -> dict:
    """Resolve effective anomaly thresholds per scope (outlet → brand → group).

    Returns a fully-populated threshold dict with defaults merged in for any
    missing sub-detector.
    """
    on_date = on_date or _today_iso()
    rule = await business_rules_service.resolve_rule(
        rule_type="anomaly_threshold_policy",
        outlet_id=outlet_id, brand_id=brand_id, on_date=on_date,
    )
    merged = {k: dict(v) for k, v in DEFAULT_THRESHOLDS.items()}
    if rule:
        data = rule.get("rule_data") or {}
        for k, v in data.items():
            if k in merged and isinstance(v, dict):
                merged[k].update(v)
        merged["_rule_id"] = rule.get("id")
        merged["_rule_scope_type"] = rule.get("scope_type")
        merged["_rule_scope_id"] = rule.get("scope_id")
        merged["_rule_version"] = rule.get("version")
    else:
        merged["_rule_id"] = None
    return merged


# ============================================================
# CORE DETECTORS
# ============================================================


async def detect_sales_deviation(
    *, outlet_id: str, sales_date: str, amount: float,
    thresholds: Optional[dict] = None,
) -> dict:
    """Compare `amount` to rolling window mean/stddev of validated sales."""
    th = (thresholds or DEFAULT_THRESHOLDS["sales_deviation"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}

    window_days = int(th.get("window_days", 14))
    min_points = int(th.get("min_points", 7))
    mild = float(th.get("sigma_mild", 1.5))
    severe = float(th.get("sigma_severe", 2.5))

    db = get_db()
    date_obj = datetime.strptime(sales_date, "%Y-%m-%d").date()
    start = (date_obj - timedelta(days=window_days)).isoformat()
    end = (date_obj - timedelta(days=1)).isoformat()

    cursor = db.daily_sales.find({
        "deleted_at": None, "status": "validated", "outlet_id": outlet_id,
        "sales_date": {"$gte": start, "$lte": end},
    })
    hist: list[float] = []
    async for d in cursor:
        hist.append(float(d.get("grand_total", 0) or 0))

    stats = _rolling_stats(hist)
    if stats["count"] < min_points or stats["stddev"] <= 0:
        return {
            "severity": "none", "reason": "insufficient_data",
            "baseline_count": stats["count"], "observed": amount,
            "baseline_mean": round(stats["mean"], 2),
        }

    z = (amount - stats["mean"]) / stats["stddev"]
    sev = _classify_sigma(z, mild, severe)
    dev_pct = (amount - stats["mean"]) / stats["mean"] * 100 if stats["mean"] > 0 else 0.0
    return {
        "severity": sev,
        "z_score": round(z, 3),
        "deviation_pct": round(dev_pct, 2),
        "observed": round(amount, 2),
        "baseline_mean": round(stats["mean"], 2),
        "baseline_stddev": round(stats["stddev"], 2),
        "baseline_count": stats["count"],
        "window_days": window_days,
    }


async def detect_vendor_price_spike(
    *, vendor_id: str, item_id: str, unit_cost: float, as_of_date: str,
    thresholds: Optional[dict] = None,
) -> dict:
    th = (thresholds or DEFAULT_THRESHOLDS["vendor_price_spike"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}

    window_days = int(th.get("window_days", 90))
    pct_mild = float(th.get("pct_mild", 15))
    pct_severe = float(th.get("pct_severe", 30))

    db = get_db()
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (date_obj - timedelta(days=window_days)).isoformat()
    end = (date_obj - timedelta(days=1)).isoformat()

    prices: list[float] = []
    cursor = db.goods_receipts.find({
        "deleted_at": None, "vendor_id": vendor_id,
        "receive_date": {"$gte": start, "$lte": end},
    })
    async for gr in cursor:
        for ln in gr.get("lines", []):
            if ln.get("item_id") == item_id:
                uc = float(ln.get("unit_cost", 0) or 0)
                if uc > 0:
                    prices.append(uc)

    if not prices:
        return {"severity": "none", "reason": "no_history", "observed": unit_cost}
    avg = statistics.mean(prices)
    if avg <= 0:
        return {"severity": "none", "reason": "zero_baseline", "observed": unit_cost}

    pct = (unit_cost - avg) / avg * 100
    sev = _classify_pct(pct, pct_mild, pct_severe)
    # Only flag spikes UPWARD by default (cost shouldn't trigger for drops)
    if sev != "none" and pct < 0:
        sev = "none"
    return {
        "severity": sev, "deviation_pct": round(pct, 2),
        "observed": round(unit_cost, 2), "baseline_mean": round(avg, 2),
        "baseline_count": len(prices), "window_days": window_days,
    }


async def detect_vendor_leadtime(
    *, vendor_id: str, actual_days: float, as_of_date: str,
    thresholds: Optional[dict] = None,
) -> dict:
    th = (thresholds or DEFAULT_THRESHOLDS["vendor_leadtime"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}

    window_days = int(th.get("window_days", 90))
    days_mild = float(th.get("days_mild", 3))
    days_severe = float(th.get("days_severe", 7))

    db = get_db()
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (date_obj - timedelta(days=window_days)).isoformat()
    end = (date_obj - timedelta(days=1)).isoformat()

    baselines: list[float] = []
    cursor = db.goods_receipts.find({
        "deleted_at": None, "vendor_id": vendor_id,
        "receive_date": {"$gte": start, "$lte": end},
    })
    async for gr in cursor:
        po_id = gr.get("po_id")
        if not po_id:
            continue
        po = await db.purchase_orders.find_one({"id": po_id})
        if not po:
            continue
        order_date = po.get("order_date") or (po.get("sent_at") or "")[:10]
        if not order_date:
            continue
        try:
            od = datetime.strptime(order_date[:10], "%Y-%m-%d").date()
            rd = datetime.strptime(gr["receive_date"], "%Y-%m-%d").date()
            baselines.append((rd - od).days)
        except Exception:  # noqa: BLE001
            continue

    if not baselines:
        return {"severity": "none", "reason": "no_history", "observed": actual_days}
    avg = statistics.mean(baselines)
    excess = actual_days - avg
    sev = _classify_excess_days(excess, days_mild, days_severe)
    return {
        "severity": sev, "excess_days": round(excess, 2),
        "observed": round(actual_days, 2), "baseline_mean": round(avg, 2),
        "baseline_count": len(baselines), "window_days": window_days,
    }


async def detect_ap_cash_spike(
    *, outlet_id: Optional[str] = None, brand_id: Optional[str] = None,
    period: Optional[str] = None, thresholds: Optional[dict] = None,
) -> dict:
    """AP/cash outflow spike vs forecast. Reuses forecast_guard_service math.

    Compares month-to-date cash outflow (Cr on cash/bank COA accounts) vs a forecast
    value derived from last-3-months average of the same metric.
    """
    th = (thresholds or DEFAULT_THRESHOLDS["ap_cash_spike"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}
    pct_mild = float(th.get("pct_mild", 15))
    pct_severe = float(th.get("pct_severe", 30))

    db = get_db()
    now = datetime.now(timezone.utc).date()
    period = period or now.strftime("%Y-%m")
    try:
        y, m = [int(x) for x in period.split("-")]
    except Exception:  # noqa: BLE001
        return {"severity": "none", "reason": "bad_period"}

    start = f"{y:04d}-{m:02d}-01"
    cap = now.isoformat()

    # Resolve bank/cash COA ids
    cash_ids: list[str] = []
    async for c in db.chart_of_accounts.find(
        {"deleted_at": None, "is_postable": True,
         "$or": [
             {"type": "asset"},
         ]},
    ):
        name = (c.get("name") or "").lower() + " " + (c.get("name_id") or "").lower()
        if any(tok in name for tok in ("cash", "kas", "bank")):
            cash_ids.append(c["id"])
    if not cash_ids:
        return {"severity": "none", "reason": "no_cash_accounts"}

    # Sum MTD cash outflow (Cr on cash accounts)
    mtd_outflow = 0.0
    async for je in db.journal_entries.find({
        "deleted_at": None, "status": "posted",
        "entry_date": {"$gte": start, "$lte": cap},
    }):
        for ln in je.get("lines", []):
            if ln.get("coa_id") not in cash_ids:
                continue
            if outlet_id and ln.get("dim_outlet") != outlet_id:
                continue
            if brand_id and ln.get("dim_brand") != brand_id:
                continue
            mtd_outflow += float(ln.get("cr", 0) or 0)

    # Baseline: avg outflow over last 3 complete months (same metric)
    baselines: list[float] = []
    for back in (1, 2, 3):
        by = y
        bm = m - back
        while bm <= 0:
            bm += 12
            by -= 1
        b_start = f"{by:04d}-{bm:02d}-01"
        if bm == 12:
            b_end = f"{by + 1:04d}-01-01"
        else:
            b_end = f"{by:04d}-{bm + 1:02d}-01"
        tot = 0.0
        async for je in db.journal_entries.find({
            "deleted_at": None, "status": "posted",
            "entry_date": {"$gte": b_start, "$lt": b_end},
        }):
            for ln in je.get("lines", []):
                if ln.get("coa_id") not in cash_ids:
                    continue
                if outlet_id and ln.get("dim_outlet") != outlet_id:
                    continue
                if brand_id and ln.get("dim_brand") != brand_id:
                    continue
                tot += float(ln.get("cr", 0) or 0)
        if tot > 0:
            baselines.append(tot)

    if not baselines:
        return {"severity": "none", "reason": "no_baseline", "observed": mtd_outflow}

    # Project MTD to full-month based on day-of-month ratio
    day_of_month = now.day
    import calendar
    days_in_month = calendar.monthrange(y, m)[1]
    projected_full = mtd_outflow / max(1, day_of_month) * days_in_month if day_of_month > 0 else mtd_outflow
    avg_baseline = statistics.mean(baselines)
    if avg_baseline <= 0:
        return {"severity": "none", "reason": "zero_baseline"}

    pct = (projected_full - avg_baseline) / avg_baseline * 100
    sev = _classify_pct(pct, pct_mild, pct_severe)
    if sev != "none" and pct < 0:
        sev = "none"
    return {
        "severity": sev, "deviation_pct": round(pct, 2),
        "observed": round(projected_full, 2),
        "mtd": round(mtd_outflow, 2),
        "baseline_mean": round(avg_baseline, 2),
        "baseline_count": len(baselines), "period": period,
    }


# ============================================================
# STORAGE — idempotent upsert
# ============================================================


async def upsert_event(payload: dict, *, user_id: Optional[str] = None) -> dict:
    """Insert or update an anomaly_event row keyed by (type, source_type, source_id).

    If the same source is scanned again, row is UPDATED (not duplicated) so severity
    stays current. Status/resolution fields are preserved unless explicitly changed.
    """
    db = get_db()
    now = _now_iso()
    key = {
        "type": payload["type"],
        "source_type": payload["source_type"],
        "source_id": payload["source_id"],
        "deleted_at": None,
    }
    existing = await db.anomaly_events.find_one(key)
    if existing:
        update = {
            **{k: v for k, v in payload.items() if k not in (
                "id", "created_at", "status", "acknowledged_by", "acknowledged_at",
                "acknowledged_note", "resolved_by", "resolved_at", "resolution_note",
            )},
            "updated_at": now,
        }
        await db.anomaly_events.update_one({"id": existing["id"]}, {"$set": update})
        fresh = await db.anomaly_events.find_one({"id": existing["id"]})
        return serialize(fresh)

    doc = {
        "id": str(uuid.uuid4()),
        "status": payload.get("status", "open"),
        "scan_date": payload.get("scan_date", _today_iso()),
        "acknowledged_by": None, "acknowledged_at": None, "acknowledged_note": None,
        "resolved_by": None, "resolved_at": None, "resolution_note": None,
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": user_id,
        **payload,
    }
    await db.anomaly_events.insert_one(doc)
    return serialize(doc)


# ============================================================
# NOTIFICATION DISPATCH
# ============================================================


RECIPIENT_PERMS = {
    "sales_deviation": ["finance.sales.validate", "executive.dashboard.read"],
    "vendor_price_spike": ["procurement.po.approve", "procurement.pr.approve"],
    "vendor_leadtime": ["procurement.po.approve", "procurement.pr.approve"],
    "ap_cash_spike": ["finance.payment.approve", "finance.report.cashflow"],
}


async def _users_with_any_perm(perms: list[str]) -> list[dict]:
    """Find active users whose role permissions include any of `perms` OR '*'."""
    db = get_db()
    role_ids: set[str] = set()
    async for r in db.roles.find({"deleted_at": None, "permissions": {"$in": perms + ["*"]}}):
        role_ids.add(r["id"])
    if not role_ids:
        return []
    users: list[dict] = []
    async for u in db.users.find({
        "deleted_at": None, "status": "active", "role_ids": {"$in": list(role_ids)},
    }):
        users.append(u)
    return users


async def dispatch_event_notification(event: dict) -> int:
    """Create notifications for all relevant recipients."""
    if event.get("severity") == "none":
        return 0
    etype = event.get("type")
    perms = RECIPIENT_PERMS.get(etype, ["*"])
    recipients = await _users_with_any_perm(perms)
    count = 0
    link = f"/finance/anomalies?id={event['id']}"
    title = event.get("title") or ANOMALY_TYPE_LABELS.get(etype, "Anomaly")
    body = event.get("message", "")
    ntype = "urgent" if event.get("severity") == "severe" else "warn"
    for u in recipients:
        # Respect outlet scope for sales anomalies — only notify users who have access
        # to the outlet (or super users with no scope restriction).
        if etype == "sales_deviation" and event.get("outlet_id"):
            if u.get("outlet_ids") and event["outlet_id"] not in u.get("outlet_ids", []):
                # Check if user is super (role has '*')
                is_super_user = await _is_super(u)
                if not is_super_user:
                    continue
        try:
            await notification_service.push(
                user_id=u["id"], type=ntype, title=title, body=body,
                link=link, source_type="anomaly_event", source_id=event["id"],
            )
            count += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("Notif dispatch failed for user %s: %s", u["id"], e)
    return count


async def _is_super(user: dict) -> bool:
    db = get_db()
    role_ids = user.get("role_ids") or []
    if not role_ids:
        return False
    async for r in db.roles.find({"id": {"$in": role_ids}}):
        if "*" in (r.get("permissions") or []):
            return True
    return False


# ============================================================
# LIVE HOOKS — called best-effort from other services
# ============================================================


async def check_sales_live(daily_sales_doc: dict, *, user_id: Optional[str] = None) -> Optional[dict]:
    """Called after a daily_sales is validated. Creates anomaly_event + notification
    if severity ≥ mild. Exception-safe (logs + returns None on failure).
    """
    try:
        outlet_id = daily_sales_doc.get("outlet_id")
        brand_id = daily_sales_doc.get("brand_id")
        sales_date = daily_sales_doc.get("sales_date")
        amount = float(daily_sales_doc.get("grand_total", 0) or 0)
        if not outlet_id or not sales_date:
            return None

        thresholds = await resolve_thresholds(outlet_id=outlet_id, brand_id=brand_id, on_date=sales_date)
        d = await detect_sales_deviation(
            outlet_id=outlet_id, sales_date=sales_date, amount=amount,
            thresholds=thresholds["sales_deviation"],
        )
        if d.get("severity", "none") == "none":
            return None

        # Resolve outlet/brand labels
        db = get_db()
        outlet = await db.outlets.find_one({"id": outlet_id}) or {}
        title = f"{outlet.get('name', 'Outlet')} — Sales {'naik' if d.get('deviation_pct', 0) > 0 else 'turun'} {abs(d.get('deviation_pct', 0)):.1f}%"
        direction = "naik" if d.get("deviation_pct", 0) > 0 else "turun"
        message = (
            f"Sales tervalidasi {sales_date} = {_format_rp(amount)}. "
            f"Baseline 14-hari: {_format_rp(d.get('baseline_mean', 0))} "
            f"(σ={_format_rp(d.get('baseline_stddev', 0))}, n={d.get('baseline_count', 0)}). "
            f"Z-score: {d.get('z_score', 0):.2f} — {direction} {abs(d.get('deviation_pct', 0)):.1f}% dari rata-rata."
        )
        event = await upsert_event({
            "type": "sales_deviation",
            "severity": d["severity"],
            "source_type": "daily_sales",
            "source_id": daily_sales_doc.get("id"),
            "source_doc_no": daily_sales_doc.get("doc_no") or sales_date,
            "outlet_id": outlet_id, "brand_id": brand_id,
            "observed_value": amount,
            "baseline_value": d.get("baseline_mean"),
            "baseline_stddev": d.get("baseline_stddev"),
            "baseline_count": d.get("baseline_count"),
            "deviation_pct": d.get("deviation_pct"),
            "z_score": d.get("z_score"),
            "period": sales_date[:7],
            "scan_date": _today_iso(),
            "threshold_snapshot": thresholds.get("sales_deviation"),
            "title": title, "message": message,
            "context": {
                "window_days": d.get("window_days"),
                "rule_id": thresholds.get("_rule_id"),
                "rule_scope_type": thresholds.get("_rule_scope_type"),
                "rule_scope_id": thresholds.get("_rule_scope_id"),
            },
        }, user_id=user_id)
        await dispatch_event_notification(event)
        return event
    except Exception as e:  # noqa: BLE001
        logger.exception("check_sales_live failed: %s", e)
        return None


async def check_gr_live(gr_doc: dict, *, user_id: Optional[str] = None) -> list[dict]:
    """Called after a GR is posted. Runs vendor_price_spike for every line +
    vendor_leadtime once per GR. Returns created anomaly events.
    """
    results: list[dict] = []
    try:
        vendor_id = gr_doc.get("vendor_id")
        receive_date = gr_doc.get("receive_date")
        gr_id = gr_doc.get("id")
        if not vendor_id or not receive_date:
            return results

        thresholds = await resolve_thresholds(
            outlet_id=gr_doc.get("outlet_id"), brand_id=None, on_date=receive_date,
        )

        # Price spike per line
        db = get_db()
        vendor = await db.vendors.find_one({"id": vendor_id}) or {}
        for idx, ln in enumerate(gr_doc.get("lines", [])):
            item_id = ln.get("item_id")
            unit_cost = float(ln.get("unit_cost", 0) or 0)
            if not item_id or unit_cost <= 0:
                continue
            d = await detect_vendor_price_spike(
                vendor_id=vendor_id, item_id=item_id, unit_cost=unit_cost,
                as_of_date=receive_date,
                thresholds=thresholds["vendor_price_spike"],
            )
            if d.get("severity", "none") == "none":
                continue
            title = f"Harga vendor {vendor.get('name', vendor_id)}: {ln.get('item_name', item_id)} +{d.get('deviation_pct', 0):.1f}%"
            message = (
                f"Unit cost {_format_rp(unit_cost)} — "
                f"baseline 90 hari: {_format_rp(d.get('baseline_mean', 0))} "
                f"(n={d.get('baseline_count', 0)})."
            )
            event = await upsert_event({
                "type": "vendor_price_spike",
                "severity": d["severity"],
                "source_type": "goods_receipt_line",
                "source_id": f"{gr_id}::{idx}",
                "source_doc_no": gr_doc.get("doc_no"),
                "vendor_id": vendor_id, "item_id": item_id,
                "outlet_id": gr_doc.get("outlet_id"),
                "observed_value": unit_cost,
                "baseline_value": d.get("baseline_mean"),
                "baseline_count": d.get("baseline_count"),
                "deviation_pct": d.get("deviation_pct"),
                "period": receive_date[:7],
                "scan_date": _today_iso(),
                "threshold_snapshot": thresholds.get("vendor_price_spike"),
                "title": title, "message": message,
                "context": {"item_name": ln.get("item_name"),
                           "vendor_name": vendor.get("name"),
                           "window_days": d.get("window_days")},
            }, user_id=user_id)
            await dispatch_event_notification(event)
            results.append(event)

        # Lead time (once per GR)
        po_id = gr_doc.get("po_id")
        if po_id:
            po = await db.purchase_orders.find_one({"id": po_id}) or {}
            order_date = po.get("order_date") or (po.get("sent_at") or "")[:10]
            if order_date:
                try:
                    od = datetime.strptime(order_date[:10], "%Y-%m-%d").date()
                    rd = datetime.strptime(receive_date, "%Y-%m-%d").date()
                    actual_days = (rd - od).days
                    d = await detect_vendor_leadtime(
                        vendor_id=vendor_id, actual_days=float(actual_days),
                        as_of_date=receive_date,
                        thresholds=thresholds["vendor_leadtime"],
                    )
                    if d.get("severity", "none") != "none":
                        title = f"Lead time {vendor.get('name', vendor_id)}: +{d.get('excess_days', 0):.1f} hari"
                        message = (
                            f"Aktual {actual_days} hari vs baseline {d.get('baseline_mean', 0):.1f} hari "
                            f"(n={d.get('baseline_count', 0)}). Terlambat {d.get('excess_days', 0):.1f} hari."
                        )
                        event = await upsert_event({
                            "type": "vendor_leadtime", "severity": d["severity"],
                            "source_type": "goods_receipt", "source_id": gr_id,
                            "source_doc_no": gr_doc.get("doc_no"),
                            "vendor_id": vendor_id,
                            "outlet_id": gr_doc.get("outlet_id"),
                            "observed_value": actual_days,
                            "baseline_value": d.get("baseline_mean"),
                            "baseline_count": d.get("baseline_count"),
                            "excess_days": d.get("excess_days"),
                            "period": receive_date[:7], "scan_date": _today_iso(),
                            "threshold_snapshot": thresholds.get("vendor_leadtime"),
                            "title": title, "message": message,
                            "context": {"po_id": po_id, "po_doc_no": po.get("doc_no"),
                                        "order_date": order_date,
                                        "vendor_name": vendor.get("name"),
                                        "window_days": d.get("window_days")},
                        }, user_id=user_id)
                        await dispatch_event_notification(event)
                        results.append(event)
                except Exception as e:  # noqa: BLE001
                    logger.warning("Leadtime calc failed: %s", e)
    except Exception as e:  # noqa: BLE001
        logger.exception("check_gr_live failed: %s", e)
    return results


# ============================================================
# BATCH SCAN
# ============================================================


async def scan_sales(as_of_date: Optional[str] = None, *, days: int = 1,
                     user_id: Optional[str] = None) -> list[dict]:
    """Batch scan daily_sales validated in the last N days for anomalies.
    Idempotent — re-running updates existing events.
    """
    as_of_date = as_of_date or _today_iso()
    end = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (end - timedelta(days=days)).isoformat()

    db = get_db()
    events: list[dict] = []
    async for ds in db.daily_sales.find({
        "deleted_at": None, "status": "validated",
        "sales_date": {"$gte": start, "$lte": as_of_date},
    }):
        ev = await check_sales_live(ds, user_id=user_id)
        if ev:
            events.append(ev)
    return events


async def scan_vendors(as_of_date: Optional[str] = None, *, days: int = 1,
                       user_id: Optional[str] = None) -> list[dict]:
    """Batch scan GRs posted in the last N days for price spikes + lead-time anomalies."""
    as_of_date = as_of_date or _today_iso()
    end = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (end - timedelta(days=days)).isoformat()

    db = get_db()
    events: list[dict] = []
    async for gr in db.goods_receipts.find({
        "deleted_at": None, "status": "posted",
        "receive_date": {"$gte": start, "$lte": as_of_date},
    }):
        ev_list = await check_gr_live(gr, user_id=user_id)
        events.extend(ev_list)
    return events


async def scan_ap_cash(*, period: Optional[str] = None,
                       user_id: Optional[str] = None) -> list[dict]:
    """Scan AP/cash outflow spike for current month per-outlet + consolidated."""
    period = period or datetime.now(timezone.utc).strftime("%Y-%m")
    db = get_db()
    events: list[dict] = []

    async def _scan_scope(outlet_id: Optional[str], brand_id: Optional[str],
                         label: str, src_id: str):
        thresholds = await resolve_thresholds(
            outlet_id=outlet_id, brand_id=brand_id, on_date=period + "-01",
        )
        d = await detect_ap_cash_spike(
            outlet_id=outlet_id, brand_id=brand_id, period=period,
            thresholds=thresholds["ap_cash_spike"],
        )
        if d.get("severity", "none") == "none":
            return
        title = f"Kas/AP {label} — proyeksi +{d.get('deviation_pct', 0):.1f}% vs baseline"
        message = (
            f"Proyeksi bulan {period}: {_format_rp(d.get('observed', 0))} — "
            f"MTD: {_format_rp(d.get('mtd', 0))}, baseline 3-bulan: {_format_rp(d.get('baseline_mean', 0))}."
        )
        event = await upsert_event({
            "type": "ap_cash_spike", "severity": d["severity"],
            "source_type": "period_scan", "source_id": src_id,
            "outlet_id": outlet_id, "brand_id": brand_id,
            "observed_value": d.get("observed"),
            "baseline_value": d.get("baseline_mean"),
            "deviation_pct": d.get("deviation_pct"),
            "period": period, "scan_date": _today_iso(),
            "threshold_snapshot": thresholds.get("ap_cash_spike"),
            "title": title, "message": message,
            "context": {"scope_label": label, "mtd": d.get("mtd"),
                        "baseline_count": d.get("baseline_count")},
        }, user_id=user_id)
        await dispatch_event_notification(event)
        events.append(event)

    # Consolidated + per outlet
    await _scan_scope(None, None, "Konsolidasi", f"consolidated::{period}")
    async for o in db.outlets.find({"deleted_at": None}):
        await _scan_scope(o["id"], None, o.get("name", o["id"]), f"outlet::{o['id']}::{period}")

    return events


async def scan_all(as_of_date: Optional[str] = None, *, days: int = 7,
                   period: Optional[str] = None,
                   user_id: Optional[str] = None) -> dict:
    """Orchestrate full scan. Returns counts by type."""
    as_of_date = as_of_date or _today_iso()
    period = period or as_of_date[:7]

    sales_events = await scan_sales(as_of_date, days=days, user_id=user_id)
    vendor_events = await scan_vendors(as_of_date, days=days, user_id=user_id)
    ap_events = await scan_ap_cash(period=period, user_id=user_id)

    # Record last scan timestamp
    db = get_db()
    await db.system_settings.update_one(
        {"key": "last_anomaly_scan"},
        {"$set": {
            "key": "last_anomaly_scan",
            "value": _now_iso(),
            "counts": {
                "sales_deviation": len(sales_events),
                "vendor": len(vendor_events),
                "ap_cash_spike": len(ap_events),
            },
            "updated_at": _now_iso(),
        }},
        upsert=True,
    )

    return {
        "as_of_date": as_of_date,
        "period": period,
        "counts": {
            "sales_deviation": len(sales_events),
            "vendor": len(vendor_events),
            "ap_cash_spike": len(ap_events),
            "total": len(sales_events) + len(vendor_events) + len(ap_events),
        },
        "events": {
            "sales": sales_events,
            "vendor": vendor_events,
            "ap_cash": ap_events,
        },
    }


# ============================================================
# QUERY / LIST / DETAIL / TRIAGE
# ============================================================


async def list_events(
    *,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1, per_page: int = 50,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if type:
        q["type"] = type
    if severity:
        q["severity"] = severity
    if status:
        q["status"] = status
    if outlet_id:
        q["outlet_id"] = outlet_id
    if vendor_id:
        q["vendor_id"] = vendor_id
    if date_from:
        q.setdefault("scan_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("scan_date", {})["$lte"] = date_to

    skip = max(0, (page - 1) * per_page)
    cursor = db.anomaly_events.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page)
    items = [serialize(d) async for d in cursor]
    total = await db.anomaly_events.count_documents(q)
    return items, {"page": page, "per_page": per_page, "total": total}


async def get_event(event_id: str) -> Optional[dict]:
    db = get_db()
    d = await db.anomaly_events.find_one({"id": event_id, "deleted_at": None})
    if not d:
        return None
    return serialize(d)


async def triage_event(
    event_id: str, *, new_status: str, note: Optional[str] = None,
    user: dict,
) -> dict:
    if new_status not in VALID_STATUSES:
        from core.exceptions import ValidationError
        raise ValidationError(f"status tidak valid. Pilih: {', '.join(VALID_STATUSES)}")
    db = get_db()
    d = await db.anomaly_events.find_one({"id": event_id, "deleted_at": None})
    if not d:
        from core.exceptions import NotFoundError
        raise NotFoundError("Anomaly event")

    now = _now_iso()
    update: dict[str, Any] = {"status": new_status, "updated_at": now}
    if new_status == "acknowledged":
        update.update({"acknowledged_by": user["id"], "acknowledged_at": now,
                       "acknowledged_note": note})
    elif new_status in ("resolved", "false_positive"):
        update.update({"resolved_by": user["id"], "resolved_at": now,
                       "resolution_note": note})
    elif new_status == "investigating":
        if not d.get("acknowledged_at"):
            update.update({"acknowledged_by": user["id"], "acknowledged_at": now,
                           "acknowledged_note": note})
    # Soft-delete if false_positive (keeps in DB, hides from feed optionally)
    # Note: we keep `deleted_at=None` so it remains visible in history with status filter

    await db.anomaly_events.update_one({"id": event_id}, {"$set": update})
    fresh = await db.anomaly_events.find_one({"id": event_id})
    return serialize(fresh)


async def summary(days: int = 7) -> dict:
    """Executive dashboard overview — counts by type/severity for last N days."""
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"deleted_at": None, "created_at": {"$gte": cutoff}}

    counts = {"severe": 0, "mild": 0, "open": 0, "total": 0, "resolved": 0}
    by_type: dict[str, dict] = {}
    by_outlet: dict[str, dict] = {}
    recent: list[dict] = []

    outlets_map: dict[str, dict] = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlets_map[o["id"]] = {"name": o.get("name", o["id"]), "code": o.get("code", "")}

    async for d in db.anomaly_events.find(q).sort([("created_at", -1)]):
        sev = d.get("severity", "none")
        status = d.get("status", "open")
        counts["total"] += 1
        if sev == "severe":
            counts["severe"] += 1
        elif sev == "mild":
            counts["mild"] += 1
        if status in ("open", "acknowledged", "investigating"):
            counts["open"] += 1
        elif status in ("resolved", "false_positive"):
            counts["resolved"] += 1

        t = d.get("type", "other")
        bt = by_type.setdefault(t, {"type": t, "label": ANOMALY_TYPE_LABELS.get(t, t),
                                    "severe": 0, "mild": 0, "total": 0})
        bt["total"] += 1
        if sev == "severe":
            bt["severe"] += 1
        elif sev == "mild":
            bt["mild"] += 1

        oid = d.get("outlet_id")
        if oid:
            bo = by_outlet.setdefault(oid, {
                "outlet_id": oid,
                "outlet_name": outlets_map.get(oid, {}).get("name", oid),
                "outlet_code": outlets_map.get(oid, {}).get("code", ""),
                "severe": 0, "mild": 0, "total": 0,
            })
            bo["total"] += 1
            if sev == "severe":
                bo["severe"] += 1
            elif sev == "mild":
                bo["mild"] += 1

        if len(recent) < 10:
            recent.append({
                "id": d.get("id"),
                "type": t, "type_label": ANOMALY_TYPE_LABELS.get(t, t),
                "severity": sev, "status": status,
                "title": d.get("title"),
                "deviation_pct": d.get("deviation_pct"),
                "outlet_id": oid,
                "outlet_name": outlets_map.get(oid, {}).get("name") if oid else None,
                "created_at": d.get("created_at"),
                "link": f"/finance/anomalies?id={d.get('id')}",
            })

    # Last scan metadata
    last_scan_doc = await db.system_settings.find_one({"key": "last_anomaly_scan"})
    last_scan = None
    if last_scan_doc:
        last_scan = {
            "updated_at": last_scan_doc.get("updated_at"),
            "counts": last_scan_doc.get("counts", {}),
        }

    return {
        "days": days,
        "counts": counts,
        "by_type": list(by_type.values()),
        "by_outlet": sorted(by_outlet.values(), key=lambda x: x["total"], reverse=True)[:10],
        "recent": recent,
        "last_scan": last_scan,
    }
