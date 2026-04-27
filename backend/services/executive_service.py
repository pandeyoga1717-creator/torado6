"""Executive services: KPI dashboards, drill-down, sales trend."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db, serialize
from services import executive_service as _self_module  # noqa: F401  # for self ref
from services import inventory_service

logger = logging.getLogger("aurora.executive")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def kpis(*, period: Optional[str] = None) -> dict:
    """Top-level executive KPIs:
    - sales MTD / WTD (validated daily sales grand_total)
    - inventory_value (latest valuation)
    - ap_exposure (sum unpaid GR)
    - opname_pending (in_progress sessions)
    - submitted_validations
    - top outlets by sales MTD
    """
    db = get_db()
    today = datetime.now(timezone.utc).date()
    period = period or today.strftime("%Y-%m")
    period_start = f"{period}-01"
    next_period = _next_period(period)
    next_start = f"{next_period}-01"

    # Sales MTD (validated)
    pipeline = [
        {"$match": {
            "deleted_at": None,
            "status": "validated",
            "sales_date": {"$gte": period_start, "$lt": next_start},
        }},
        {"$group": {
            "_id": "$outlet_id",
            "total": {"$sum": {"$ifNull": ["$grand_total", 0]}},
            "trx": {"$sum": {"$ifNull": ["$transaction_count", 0]}},
            "days": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    by_outlet: list[dict] = []
    async for d in db.daily_sales.aggregate(pipeline):
        by_outlet.append({
            "outlet_id": d["_id"],
            "total": round(d["total"], 2),
            "trx": d["trx"], "days": d["days"],
        })
    sales_mtd = sum(r["total"] for r in by_outlet)

    # Sales WTD (Mon–today)
    weekday = today.weekday()  # 0=Mon
    week_start = (today - timedelta(days=weekday)).isoformat()
    week_end = today.isoformat()
    wtd_total = 0.0
    async for d in db.daily_sales.aggregate([
        {"$match": {
            "deleted_at": None, "status": "validated",
            "sales_date": {"$gte": week_start, "$lte": week_end},
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$grand_total", 0]}}}},
    ]):
        wtd_total = float(d["total"])

    # Today
    today_total = 0.0
    async for d in db.daily_sales.aggregate([
        {"$match": {
            "deleted_at": None, "status": "validated",
            "sales_date": today.isoformat(),
        }},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$grand_total", 0]}}}},
    ]):
        today_total = float(d["total"])

    # Inventory value (use shared inventory_service.valuation for correctness)
    val = await inventory_service.valuation()
    inv_value = float(val.get("total_value", 0))
    inv_count = int(val.get("item_count", 0))

    # AP exposure
    grs = await db.goods_receipts.find({"deleted_at": None}).to_list(10000)
    ap_total = sum(float(g.get("grand_total", 0)) for g in grs
                   if not g.get("paid_at") and g.get("payment_status") != "paid")

    # Pending sales validation
    pending_validations = await db.daily_sales.count_documents({
        "deleted_at": None, "status": "submitted",
    })

    # Opname pending
    opname_pending = await db.opname_sessions.count_documents({
        "deleted_at": None, "status": "in_progress",
    })

    # Outlet name resolve
    outlets_by_id = {}
    async for o in db.outlets.find({}):
        outlets_by_id[o["id"]] = o.get("name", o["id"])
    for r in by_outlet:
        r["outlet_name"] = outlets_by_id.get(r["outlet_id"], r["outlet_id"])

    return {
        "period": period,
        "today_iso": today.isoformat(),
        "week_start": week_start,
        "sales_today": round(today_total, 2),
        "sales_wtd": round(wtd_total, 2),
        "sales_mtd": round(sales_mtd, 2),
        "top_outlets": by_outlet[:5],
        "inventory_value": round(inv_value, 2),
        "inventory_item_count": inv_count,
        "ap_exposure": round(ap_total, 2),
        "pending_validations": pending_validations,
        "opname_pending": opname_pending,
    }


async def sales_trend(*, days: int = 30, dim_outlet: Optional[str] = None) -> dict:
    """Daily sales trend, last `days` days. Returns {dates:[], totals:[]}."""
    db = get_db()
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    match: dict = {
        "deleted_at": None,
        "status": "validated",
        "sales_date": {"$gte": start.isoformat(), "$lte": today.isoformat()},
    }
    if dim_outlet:
        match["outlet_id"] = dim_outlet
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$sales_date",
            "total": {"$sum": {"$ifNull": ["$grand_total", 0]}},
            "trx": {"$sum": {"$ifNull": ["$transaction_count", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    by_date = {}
    async for d in db.daily_sales.aggregate(pipeline):
        by_date[d["_id"]] = {"total": round(float(d["total"]), 2), "trx": int(d["trx"] or 0)}
    series = []
    cursor_date = start
    while cursor_date <= today:
        iso = cursor_date.isoformat()
        rec = by_date.get(iso, {"total": 0.0, "trx": 0})
        series.append({"date": iso, "total": rec["total"], "trx": rec["trx"]})
        cursor_date += timedelta(days=1)
    total = sum(s["total"] for s in series)
    avg = total / len(series) if series else 0
    return {
        "days": days,
        "start": start.isoformat(),
        "end": today.isoformat(),
        "series": series,
        "total": round(total, 2),
        "avg_daily": round(avg, 2),
    }


def _next_period(period: str) -> str:
    y, m = [int(x) for x in period.split("-")]
    m += 1
    if m > 12:
        m = 1; y += 1
    return f"{y:04d}-{m:02d}"
