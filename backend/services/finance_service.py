"""Finance services: JE list/detail/manual JE/reversal, Trial Balance, P&L, AP Aging.
Reuses /app/backend/services/journal_service.py for JE creation/reversal.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError
from services import journal_service

logger = logging.getLogger("aurora.finance")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ====================== JOURNAL ENTRIES ======================

async def list_journals(
    *, period: Optional[str] = None, source_type: Optional[str] = None,
    coa_id: Optional[str] = None, dim_outlet: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    status: Optional[str] = None, search: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["period"] = period
    if source_type:
        q["source_type"] = source_type
    if status:
        q["status"] = status
    if date_from:
        q.setdefault("entry_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("entry_date", {})["$lte"] = date_to
    if coa_id:
        q["lines.coa_id"] = coa_id
    if dim_outlet:
        q["lines.dim_outlet"] = dim_outlet
    if search:
        q["$or"] = [
            {"doc_no": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * per_page
    items = await db.journal_entries.find(q).sort([("entry_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.journal_entries.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def get_journal(je_id: str) -> dict:
    db = get_db()
    je = await db.journal_entries.find_one({"id": je_id, "deleted_at": None})
    if not je:
        raise NotFoundError("Journal entry tidak ditemukan")
    return await _enrich_journal(serialize(je))


async def _enrich_journal(je: dict) -> dict:
    """Add COA names and source link summary."""
    db = get_db()
    coa_ids = list({ln["coa_id"] for ln in je.get("lines", []) if ln.get("coa_id")})
    coas = {}
    if coa_ids:
        async for c in db.chart_of_accounts.find({"id": {"$in": coa_ids}}):
            coas[c["id"]] = {"code": c.get("code"), "name": c.get("name"), "type": c.get("type")}
    for ln in je.get("lines", []):
        coa = coas.get(ln.get("coa_id"), {})
        ln["coa_code"] = ln.get("coa_code") or coa.get("code")
        ln["coa_name"] = ln.get("coa_name") or coa.get("name")

    # Source enrichment (best-effort)
    src_type = je.get("source_type")
    src_id = je.get("source_id")
    src_link = None
    if src_type and src_id:
        col_map = {
            "sales": ("daily_sales", "/outlet/daily-sales"),
            "petty_cash": ("petty_cash_transactions", "/outlet/petty-cash"),
            "urgent_purchase": ("urgent_purchases", "/outlet/urgent-purchase"),
            "goods_receipt": ("goods_receipts", "/procurement/gr"),
            "adjustment": ("stock_adjustments", "/inventory/adjustments"),
            "opname": ("opname_sessions", "/inventory/opname"),
            "manual": (None, None),
            "reversal": (None, None),
        }
        col, route = col_map.get(src_type, (None, None))
        if col:
            doc = await db[col].find_one({"id": src_id})
            if doc:
                src_link = {
                    "type": src_type,
                    "id": src_id,
                    "doc_no": doc.get("doc_no"),
                    "date": doc.get("sales_date") or doc.get("txn_date")
                            or doc.get("purchase_date") or doc.get("receive_date")
                            or doc.get("adjustment_date") or doc.get("opname_date"),
                    "route": route,
                }
    je["source_link"] = src_link
    return je


async def post_manual_journal(payload: dict, *, user: dict) -> dict:
    """Create a manual JE. Validates Dr=Cr server-side via journal_service._post_journal."""
    entry_date = payload.get("entry_date")
    description = (payload.get("description") or "").strip()
    lines = payload.get("lines", [])
    if not entry_date:
        raise ValidationError("entry_date wajib (YYYY-MM-DD)")
    if not description:
        raise ValidationError("description wajib")
    if not lines or len(lines) < 2:
        raise ValidationError("Minimal 2 line items")
    # Enrich each line with COA code/name (helpful for downstream display)
    db = get_db()
    coa_ids = list({ln.get("coa_id") for ln in lines if ln.get("coa_id")})
    coa_map = {}
    if coa_ids:
        async for c in db.chart_of_accounts.find({"id": {"$in": coa_ids}}):
            coa_map[c["id"]] = c
    enriched = []
    for ln in lines:
        coa = coa_map.get(ln.get("coa_id"))
        if not coa:
            raise ValidationError(f"COA tidak ditemukan: {ln.get('coa_id')}")
        if not coa.get("is_postable"):
            raise ValidationError(f"COA {coa.get('code')} bukan postable")
        enriched.append({
            **ln,
            "coa_code": coa.get("code"),
            "coa_name": coa.get("name"),
        })
    import uuid
    source_id = payload.get("source_id") or str(uuid.uuid4())
    return await journal_service._post_journal(  # type: ignore[attr-defined]
        entry_date=entry_date,
        description=description,
        source_type="manual",
        source_id=source_id,
        lines=enriched,
        user_id=user["id"],
    )


async def reverse_journal(je_id: str, *, user: dict, reason: str) -> dict:
    if not reason or not reason.strip():
        raise ValidationError("Alasan reversal wajib")
    return await journal_service.reverse_journal(je_id, user_id=user["id"], reason=reason.strip())


# ====================== TRIAL BALANCE ======================

async def trial_balance(*, period: str, dim_outlet: Optional[str] = None) -> dict:
    """Compute TB for a period (YYYY-MM).

    Returns:
      {
        period, opening: { coa_id: balance },
        period_dr, period_cr per coa,
        closing,
        rows: [ {coa_id, code, name, type, normal_balance, opening, period_dr, period_cr, closing} ],
        totals,
      }
    Strategy:
      - opening = sum across periods < this period
      - period_dr / period_cr from this period only.
      - closing = opening + (dr - cr) for Dr-normal, opening + (cr - dr) for Cr-normal
    """
    db = get_db()
    base_match: dict = {"deleted_at": None, "status": {"$in": ["posted", "reversed"]}}
    if dim_outlet:
        base_match["lines.dim_outlet"] = dim_outlet

    # Opening balances (all periods < period)
    opening_map = await _aggregate_balance(
        match={**base_match, "period": {"$lt": period}},
        dim_outlet=dim_outlet,
    )
    # Period activity
    period_map = await _aggregate_balance(
        match={**base_match, "period": period},
        dim_outlet=dim_outlet,
        keep_dr_cr=True,
    )

    # Load all COAs
    coas: list[dict] = []
    async for c in db.chart_of_accounts.find({"deleted_at": None}):
        coas.append(c)
    coas_by_id = {c["id"]: c for c in coas}

    rows = []
    sum_open_dr = sum_open_cr = sum_period_dr = sum_period_cr = sum_close_dr = sum_close_cr = 0.0
    # Include all postable COAs even if zero (helpful)
    relevant_ids = set(opening_map.keys()) | {coa_id for coa_id, v in period_map.items()}
    # Add postable coas with non-zero parents tree etc — keep simple: include only coas with activity
    for coa_id in relevant_ids:
        coa = coas_by_id.get(coa_id)
        if not coa:
            continue
        op = opening_map.get(coa_id, {"signed": 0, "dr": 0, "cr": 0})
        per = period_map.get(coa_id, {"signed": 0, "dr": 0, "cr": 0})
        opening = round(op["signed"], 2)
        period_dr = round(per["dr"], 2)
        period_cr = round(per["cr"], 2)
        normal = coa.get("normal_balance", "Dr")
        if normal == "Dr":
            closing = opening + period_dr - period_cr
        else:
            closing = opening + period_cr - period_dr
        closing = round(closing, 2)

        rows.append({
            "coa_id": coa_id,
            "code": coa.get("code"),
            "name": coa.get("name"),
            "type": coa.get("type"),
            "normal_balance": normal,
            "opening": opening,
            "period_dr": period_dr,
            "period_cr": period_cr,
            "closing": closing,
        })
        sum_period_dr += period_dr
        sum_period_cr += period_cr
        if closing >= 0 and normal == "Dr":
            sum_close_dr += closing
        elif closing < 0 and normal == "Dr":
            sum_close_cr += -closing
        elif closing >= 0 and normal == "Cr":
            sum_close_cr += closing
        else:
            sum_close_dr += -closing
        if opening >= 0 and normal == "Dr":
            sum_open_dr += opening
        elif opening < 0 and normal == "Dr":
            sum_open_cr += -opening
        elif opening >= 0 and normal == "Cr":
            sum_open_cr += opening
        else:
            sum_open_dr += -opening

    rows.sort(key=lambda r: (r.get("code") or ""))
    return {
        "period": period,
        "dim_outlet": dim_outlet,
        "rows": rows,
        "totals": {
            "opening_dr": round(sum_open_dr, 2),
            "opening_cr": round(sum_open_cr, 2),
            "period_dr": round(sum_period_dr, 2),
            "period_cr": round(sum_period_cr, 2),
            "closing_dr": round(sum_close_dr, 2),
            "closing_cr": round(sum_close_cr, 2),
            "is_balanced_period": abs(sum_period_dr - sum_period_cr) < 0.5,
            "is_balanced_closing": abs(sum_close_dr - sum_close_cr) < 0.5,
        },
    }


async def _aggregate_balance(*, match: dict, dim_outlet: Optional[str] = None, keep_dr_cr: bool = False) -> dict:
    """Aggregates JE lines into per-coa signed balance (and optionally raw dr/cr).
    Returns: {coa_id: {signed, dr, cr}}.
    Note: 'reversed' JEs already have a counter-JE posted (reversal), so keeping them in math is correct.
    Actually we should EXCLUDE reversed because the reversal entry counters them. Keep posted-only.
    """
    db = get_db()
    # Restrict to posted only (reversed source JE has already been counter-posted via reversal entry which is itself 'posted')
    match = {**match, "status": "posted"}
    pipeline: list[dict] = [
        {"$match": match},
        {"$unwind": "$lines"},
    ]
    if dim_outlet:
        pipeline.append({"$match": {"lines.dim_outlet": dim_outlet}})
    pipeline.append({
        "$group": {
            "_id": "$lines.coa_id",
            "dr": {"$sum": {"$ifNull": ["$lines.dr", 0]}},
            "cr": {"$sum": {"$ifNull": ["$lines.cr", 0]}},
        },
    })
    out: dict = {}
    async for d in db.journal_entries.aggregate(pipeline):
        coa_id = d["_id"]
        if not coa_id:
            continue
        out[coa_id] = {
            "signed": float(d["dr"]) - float(d["cr"]),
            "dr": float(d["dr"]),
            "cr": float(d["cr"]),
        }
    return out


# ====================== PROFIT & LOSS ======================

async def profit_loss(*, period: str, dim_outlet: Optional[str] = None,
                       compare_prev: bool = True) -> dict:
    """P&L for a period.
    Revenue (cr-normal) - COGS (dr-normal) - Expense (dr-normal) = Net Income.
    Returns sections + totals + optional prev-period compare.
    """
    base_match = {"deleted_at": None, "status": "posted"}
    db = get_db()

    # Activity for the period
    period_map = await _aggregate_balance(
        match={**base_match, "period": period}, dim_outlet=dim_outlet,
    )
    # COA list
    coas: list[dict] = []
    async for c in db.chart_of_accounts.find({"deleted_at": None,
                                              "type": {"$in": ["revenue", "cogs", "expense"]}}):
        coas.append(c)
    coas_by_id = {c["id"]: c for c in coas}

    # Build sections
    sections = {
        "revenue": [],
        "cogs": [],
        "expense": [],
    }
    totals = {"revenue": 0.0, "cogs": 0.0, "expense": 0.0}
    for coa_id, v in period_map.items():
        coa = coas_by_id.get(coa_id)
        if not coa:
            continue
        amt = float(v["cr"]) - float(v["dr"]) if coa["normal_balance"] == "Cr" else float(v["dr"]) - float(v["cr"])
        amt = round(amt, 2)
        if amt == 0:
            continue
        sections[coa["type"]].append({
            "coa_id": coa_id, "code": coa["code"], "name": coa["name"], "amount": amt,
        })
        totals[coa["type"]] += amt

    for k in sections:
        sections[k].sort(key=lambda r: r["code"])

    gross_profit = round(totals["revenue"] - totals["cogs"], 2)
    net_income = round(gross_profit - totals["expense"], 2)

    out = {
        "period": period,
        "dim_outlet": dim_outlet,
        "sections": sections,
        "totals": {
            "revenue": round(totals["revenue"], 2),
            "cogs": round(totals["cogs"], 2),
            "expense": round(totals["expense"], 2),
            "gross_profit": gross_profit,
            "gross_margin_pct": round(gross_profit / totals["revenue"] * 100, 2) if totals["revenue"] else 0,
            "net_income": net_income,
            "net_margin_pct": round(net_income / totals["revenue"] * 100, 2) if totals["revenue"] else 0,
        },
    }

    # Prev period compare
    if compare_prev:
        prev = _prev_period(period)
        prev_map = await _aggregate_balance(
            match={**base_match, "period": prev}, dim_outlet=dim_outlet,
        )
        prev_totals = {"revenue": 0.0, "cogs": 0.0, "expense": 0.0}
        for coa_id, v in prev_map.items():
            coa = coas_by_id.get(coa_id)
            if not coa:
                continue
            amt = float(v["cr"]) - float(v["dr"]) if coa["normal_balance"] == "Cr" else float(v["dr"]) - float(v["cr"])
            prev_totals[coa["type"]] += amt
        prev_gross = prev_totals["revenue"] - prev_totals["cogs"]
        prev_net = prev_gross - prev_totals["expense"]
        out["compare"] = {
            "prev_period": prev,
            "revenue": round(prev_totals["revenue"], 2),
            "cogs": round(prev_totals["cogs"], 2),
            "expense": round(prev_totals["expense"], 2),
            "gross_profit": round(prev_gross, 2),
            "net_income": round(prev_net, 2),
            "revenue_delta_pct": round((totals["revenue"] - prev_totals["revenue"]) / prev_totals["revenue"] * 100, 2) if prev_totals["revenue"] else None,
            "net_delta_pct": round((net_income - prev_net) / abs(prev_net) * 100, 2) if prev_net else None,
        }
    return out


def _prev_period(period: str) -> str:
    """YYYY-MM minus 1 month."""
    y, m = [int(x) for x in period.split("-")]
    if m == 1:
        y -= 1
        m = 12
    else:
        m -= 1
    return f"{y:04d}-{m:02d}"


# ====================== AP AGING ======================

async def ap_aging(*, as_of: Optional[str] = None) -> dict:
    """AP aging based on goods_receipts not yet paid.
    MVP: assume all GR are unpaid (payment module Phase 5+). Aging by receive_date + payment_terms_days.
    Buckets: 0-30 / 31-60 / 61-90 / 90+ days overdue.
    """
    db = get_db()
    today = datetime.now(timezone.utc).date()
    if as_of:
        try:
            today = datetime.strptime(as_of, "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError("as_of harus YYYY-MM-DD")

    # Pull all GR (paid_at not yet supported — Phase 5)
    grs = await db.goods_receipts.find({"deleted_at": None}).to_list(10000)
    vendors_by_id = {}
    async for v in db.vendors.find({}):
        vendors_by_id[v["id"]] = v

    by_vendor: dict = {}
    buckets_total = {"current": 0.0, "d_30": 0.0, "d_60": 0.0, "d_90": 0.0, "d_90p": 0.0}
    for gr in grs:
        amount = float(gr.get("grand_total", 0))
        if amount <= 0:
            continue
        # Skip if a payment was registered (future-proof)
        if gr.get("paid_at") or gr.get("payment_status") == "paid":
            continue
        try:
            recv = datetime.strptime(gr["receive_date"], "%Y-%m-%d").date()
        except Exception:
            continue
        terms = int(gr.get("payment_terms_days", 30) or 30)
        due = recv + timedelta(days=terms)
        days_overdue = (today - due).days
        if days_overdue <= 0:
            bucket = "current"
        elif days_overdue <= 30:
            bucket = "d_30"
        elif days_overdue <= 60:
            bucket = "d_60"
        elif days_overdue <= 90:
            bucket = "d_90"
        else:
            bucket = "d_90p"
        v_id = gr["vendor_id"]
        v_row = by_vendor.setdefault(v_id, {
            "vendor_id": v_id,
            "vendor_name": vendors_by_id.get(v_id, {}).get("name", v_id),
            "current": 0.0, "d_30": 0.0, "d_60": 0.0, "d_90": 0.0, "d_90p": 0.0,
            "total": 0.0, "items": [],
        })
        v_row[bucket] += amount
        v_row["total"] += amount
        v_row["items"].append({
            "gr_id": gr["id"],
            "doc_no": gr.get("doc_no"),
            "invoice_no": gr.get("invoice_no"),
            "receive_date": gr.get("receive_date"),
            "due_date": due.isoformat(),
            "days_overdue": days_overdue,
            "amount": amount,
            "bucket": bucket,
        })
        buckets_total[bucket] += amount

    rows = sorted(by_vendor.values(), key=lambda r: r["total"], reverse=True)
    grand_total = sum(buckets_total.values())
    return {
        "as_of": today.isoformat(),
        "buckets": {k: round(v, 2) for k, v in buckets_total.items()},
        "grand_total": round(grand_total, 2),
        "rows": [
            {**r, **{k: round(r[k], 2) for k in ["current", "d_30", "d_60", "d_90", "d_90p", "total"]}}
            for r in rows
        ],
    }


# ====================== SALES VALIDATION QUEUE ======================

async def sales_validation_queue(*, page: int = 1, per_page: int = 50) -> tuple[list[dict], dict]:
    """List daily_sales status=submitted across outlets, oldest first."""
    db = get_db()
    q = {"deleted_at": None, "status": "submitted"}
    skip = (page - 1) * per_page
    items = await db.daily_sales.find(q).sort([("submitted_at", 1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.daily_sales.count_documents(q)
    # Enrich outlet name
    outlets = {}
    async for o in db.outlets.find({}):
        outlets[o["id"]] = o.get("name", o["id"])
    enriched = []
    for d in items:
        d_s = serialize(d)
        d_s["outlet_name"] = outlets.get(d_s["outlet_id"], d_s["outlet_id"])
        enriched.append(d_s)
    return enriched, {"page": page, "per_page": per_page, "total": total}


# ====================== FINANCE HOME / KPI ======================

async def finance_home() -> dict:
    """Top-level finance counters & TB health."""
    db = get_db()
    submitted_count = await db.daily_sales.count_documents({"deleted_at": None, "status": "submitted"})
    rejected_count = await db.daily_sales.count_documents({"deleted_at": None, "status": "rejected"})
    je_count = await db.journal_entries.count_documents({"deleted_at": None, "status": "posted"})
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    je_period_count = await db.journal_entries.count_documents({
        "deleted_at": None, "status": "posted", "period": period,
    })
    # AP exposure (sum of all unpaid GR grand_total)
    grs = await db.goods_receipts.find({"deleted_at": None}).to_list(10000)
    ap_total = sum(float(g.get("grand_total", 0)) for g in grs
                   if not g.get("paid_at") and g.get("payment_status") != "paid")
    return {
        "period": period,
        "submitted_validations": submitted_count,
        "rejected_count": rejected_count,
        "je_total": je_count,
        "je_this_period": je_period_count,
        "ap_exposure": round(ap_total, 2),
    }
