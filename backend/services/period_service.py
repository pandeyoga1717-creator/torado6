"""Accounting Period management service.
Handles list/create/transition (open → closed → locked) + closing checklist.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError, ConflictError
from services import finance_service

logger = logging.getLogger("aurora.period")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# CRUD
# ============================================================

async def list_periods(*, year: Optional[int] = None) -> list[dict]:
    """List all accounting periods, sorted by period DESC.
    Auto-fills missing months for current and prior year so UI never shows blank table.
    """
    db = get_db()
    q: dict = {}
    if year is not None:
        q["fiscal_year"] = year
    items = await db.accounting_periods.find(q).sort([("period", -1)]).to_list(500)
    existing = {p["period"] for p in items}

    # Auto-create missing periods for current year (visibility only — they remain empty until JE posts)
    today = datetime.now(timezone.utc)
    target_year = year if year is not None else today.year
    for m in range(1, 13):
        period = f"{target_year:04d}-{m:02d}"
        if period not in existing:
            doc = {
                "id": str(uuid.uuid4()),
                "period": period,
                "fiscal_year": target_year,
                "status": "open",
                "auto_created": True,
                "created_at": _now(),
                "updated_at": _now(),
            }
            try:
                await db.accounting_periods.insert_one(doc)
                items.append(doc)
            except Exception:  # noqa: BLE001
                pass
    items.sort(key=lambda p: p.get("period", ""), reverse=True)
    return [serialize(p) for p in items]


async def get_period(period: str) -> dict:
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        # Create as open (lazy)
        if not _valid_period(period):
            raise ValidationError("period harus YYYY-MM")
        doc = {
            "id": str(uuid.uuid4()),
            "period": period,
            "fiscal_year": int(period.split("-")[0]),
            "status": "open",
            "auto_created": True,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.accounting_periods.insert_one(doc)
        return serialize(doc)
    return serialize(p)


def _valid_period(period: str) -> bool:
    try:
        y, m = period.split("-")
        return len(y) == 4 and 1 <= int(m) <= 12
    except Exception:  # noqa: BLE001
        return False


# ============================================================
# CLOSING CHECKS (8-step checklist)
# ============================================================

async def closing_checks(period: str) -> dict:
    """Run all readiness checks for closing the given period.
    Returns: {period, checks: [...], ready_to_close, ready_to_lock}
    """
    if not _valid_period(period):
        raise ValidationError("period harus YYYY-MM")
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        # Lazy init for visibility
        await get_period(period)
        p = await db.accounting_periods.find_one({"period": period})

    checks: list[dict] = []

    # 1) Pending sales validations
    pending_sales = await db.daily_sales.count_documents({
        "deleted_at": None,
        "status": "submitted",
        "sales_date": {"$gte": f"{period}-01", "$lte": f"{period}-31"},
    })
    checks.append({
        "id": "pending_sales_validation",
        "label": "Sales submission yang belum divalidasi",
        "status": "ok" if pending_sales == 0 else "warn",
        "value": pending_sales,
        "detail": f"{pending_sales} daily sales status=submitted",
        "fix_link": "/finance/validation",
        "blocker": False,
    })

    # 2) Trial Balance balanced for the period
    try:
        tb = await finance_service.trial_balance(period=period)
        balanced = bool(tb.get("totals", {}).get("is_balanced_period"))
        diff = round(abs(tb["totals"]["period_dr"] - tb["totals"]["period_cr"]), 2)
        checks.append({
            "id": "tb_balanced",
            "label": "Trial Balance period seimbang (Dr = Cr)",
            "status": "ok" if balanced else "fail",
            "value": diff,
            "detail": "Selisih Dr-Cr: Rp " + f"{diff:,.0f}".replace(",", ".") if not balanced else "Period balance Dr = Cr",
            "fix_link": f"/finance/trial-balance?period={period}",
            "blocker": True,
        })
    except Exception as e:  # noqa: BLE001
        checks.append({
            "id": "tb_balanced", "label": "Trial Balance period seimbang (Dr = Cr)",
            "status": "warn", "value": 0,
            "detail": f"Tidak dapat menghitung TB: {e}",
            "fix_link": None, "blocker": False,
        })

    # 3) Pending PR/PO approvals (info)
    pending_pr = await db.purchase_requests.count_documents({
        "deleted_at": None, "status": {"$in": ["submitted", "awaiting_approval"]},
    })
    pending_po = await db.purchase_orders.count_documents({
        "deleted_at": None, "status": {"$in": ["awaiting_approval"]},
    })
    pending_total = pending_pr + pending_po
    checks.append({
        "id": "pending_approvals",
        "label": "PR/PO menunggu approval",
        "status": "ok" if pending_total == 0 else "info",
        "value": pending_total,
        "detail": f"{pending_pr} PR + {pending_po} PO menunggu",
        "fix_link": "/procurement/prs",
        "blocker": False,
    })

    # 4) AP open balance (info)
    grs = await db.goods_receipts.find({"deleted_at": None}).to_list(20000)
    ap_open_count = sum(
        1 for g in grs
        if not g.get("paid_at") and g.get("payment_status") != "paid" and float(g.get("grand_total", 0) or 0) > 0
    )
    checks.append({
        "id": "ap_open",
        "label": "AP terbuka (info)",
        "status": "info",
        "value": ap_open_count,
        "detail": f"{ap_open_count} GR open di AP ledger",
        "fix_link": "/finance/ap-aging",
        "blocker": False,
    })

    # 5) Negative stock balance count (warn if exists)
    neg_count = 0
    try:
        agg = [
            {"$match": {"deleted_at": None}},
            {"$group": {
                "_id": {"item_id": "$item_id", "outlet_id": "$outlet_id"},
                "qty": {"$sum": "$qty"},
            }},
            {"$match": {"qty": {"$lt": 0}}},
            {"$count": "n"},
        ]
        async for d in db.inventory_movements.aggregate(agg):
            neg_count = int(d.get("n", 0))
    except Exception:  # noqa: BLE001
        pass
    checks.append({
        "id": "negative_stock",
        "label": "Stock balance negatif",
        "status": "ok" if neg_count == 0 else "warn",
        "value": neg_count,
        "detail": f"{neg_count} pasangan (item × outlet) saldo negatif",
        "fix_link": "/inventory/balance",
        "blocker": False,
    })

    # 6) Manual JE this period (info)
    manual_je = await db.journal_entries.count_documents({
        "deleted_at": None, "period": period, "source_type": "manual", "status": "posted",
    })
    checks.append({
        "id": "manual_je",
        "label": "Jumlah Manual Journal di period ini",
        "status": "info",
        "value": manual_je,
        "detail": f"{manual_je} manual JE",
        "fix_link": f"/finance/journals?period={period}&source_type=manual",
        "blocker": False,
    })

    # 7) Open opname sessions (warn if exists)
    open_opname = 0
    try:
        open_opname = await db.opname_sessions.count_documents({
            "deleted_at": None, "status": {"$in": ["draft", "in_progress"]},
        })
    except Exception:  # noqa: BLE001
        pass
    checks.append({
        "id": "open_opname",
        "label": "Opname session terbuka",
        "status": "ok" if open_opname == 0 else "warn",
        "value": open_opname,
        "detail": f"{open_opname} opname session belum disubmit",
        "fix_link": "/inventory/opname",
        "blocker": False,
    })

    # 8) Period status
    cur_status = (p or {}).get("status", "open")
    checks.append({
        "id": "period_status",
        "label": "Status period saat ini",
        "status": "info",
        "value": cur_status,
        "detail": f"Period {period} sekarang berstatus '{cur_status}'",
        "fix_link": None,
        "blocker": False,
    })

    blocker_failed = any(c["status"] == "fail" and c.get("blocker") for c in checks)
    warns = [c for c in checks if c["status"] == "warn"]
    ready_to_close = (cur_status == "open") and not blocker_failed
    ready_to_lock = cur_status in ("open", "closed") and not blocker_failed

    return {
        "period": period,
        "current_status": cur_status,
        "checks": checks,
        "summary": {
            "blockers": int(blocker_failed),
            "warnings": len(warns),
            "ready_to_close": ready_to_close,
            "ready_to_lock": ready_to_lock,
        },
    }


# ============================================================
# TRANSITIONS
# ============================================================

async def _transition(period: str, *, to_status: str, user: dict, reason: Optional[str] = None,
                      allowed_from: tuple[str, ...]) -> dict:
    if not _valid_period(period):
        raise ValidationError("period harus YYYY-MM")
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        await get_period(period)
        p = await db.accounting_periods.find_one({"period": period})
    cur = p.get("status", "open")
    if cur == to_status:
        raise ConflictError(f"Period {period} sudah {to_status}")
    if cur not in allowed_from:
        raise ValidationError(
            f"Tidak dapat ke '{to_status}' dari status '{cur}' (dibolehkan: {','.join(allowed_from)})"
        )

    before = serialize(p)
    update = {
        "status": to_status,
        "updated_at": _now(),
    }
    if to_status == "closed":
        update["closed_at"] = _now()
        update["closed_by"] = user["id"]
        if reason:
            update["close_reason"] = reason
    if to_status == "locked":
        update["locked_at"] = _now()
        update["locked_by"] = user["id"]
        if reason:
            update["lock_reason"] = reason
    if to_status == "open":
        # Reopen
        update["reopened_at"] = _now()
        update["reopened_by"] = user["id"]
        update["reopen_reason"] = reason or ""
        update["closed_at"] = None
        update["locked_at"] = None
    await db.accounting_periods.update_one({"period": period}, {"$set": update})
    after = await db.accounting_periods.find_one({"period": period})
    await audit_log(
        user_id=user["id"], entity_type="accounting_period",
        entity_id=p["id"], action=f"transition_{to_status}",
        before=before, after=serialize(after),
        reason=reason,
    )
    return serialize(after)


async def close_period(period: str, *, user: dict, reason: Optional[str] = None) -> dict:
    """Set status to 'closed' (soft lock). Allowed from: open."""
    # Optional: enforce no fail blockers from closing checks
    res = await closing_checks(period)
    if res["summary"]["blockers"]:
        failures = [c for c in res["checks"] if c["status"] == "fail" and c.get("blocker")]
        names = ", ".join(c["label"] for c in failures)
        raise ValidationError(
            f"Tidak dapat close: blocker check gagal — {names}",
            code="CLOSING_BLOCKED",
        )
    return await _transition(period, to_status="closed", user=user, reason=reason,
                              allowed_from=("open",))


async def lock_period(period: str, *, user: dict, reason: Optional[str] = None) -> dict:
    """Set status to 'locked' (hard lock; blocks all writes).
    Allowed from: open or closed.
    """
    res = await closing_checks(period)
    if res["summary"]["blockers"]:
        failures = [c for c in res["checks"] if c["status"] == "fail" and c.get("blocker")]
        names = ", ".join(c["label"] for c in failures)
        raise ValidationError(
            f"Tidak dapat lock: blocker check gagal — {names}",
            code="LOCKING_BLOCKED",
        )
    return await _transition(period, to_status="locked", user=user, reason=reason,
                              allowed_from=("open", "closed"))


async def reopen_period(period: str, *, user: dict, reason: str) -> dict:
    """Reopen a closed/locked period (audit-trailed). Reason mandatory."""
    if not reason or not reason.strip():
        raise ValidationError("Alasan reopen wajib")
    return await _transition(period, to_status="open", user=user, reason=reason.strip(),
                              allowed_from=("closed", "locked"))
