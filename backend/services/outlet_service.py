"""Outlet portal services: daily_sales, petty_cash, urgent_purchase."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import (
    ConflictError, ForbiddenError, NotFoundError, ValidationError, ok_envelope,
)
from services import journal_service


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =================== DAILY SALES ===================

async def list_daily_sales(
    *, outlet_ids: list[str], date_from: Optional[str] = None, date_to: Optional[str] = None,
    status: Optional[str] = None, page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    if date_from:
        q.setdefault("sales_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("sales_date", {})["$lte"] = date_to
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.daily_sales.find(q).sort([("sales_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.daily_sales.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def upsert_daily_sales_draft(payload: dict, *, user: dict) -> dict:
    """Create or update DRAFT daily_sales (one per outlet+date)."""
    db = get_db()
    outlet_id = payload["outlet_id"]
    sales_date = payload["sales_date"]
    if outlet_id not in user.get("outlet_ids", []) and "*" not in await _user_perms(user):
        raise ForbiddenError("Outlet bukan dalam scope Anda")

    # Find existing DRAFT for this date+outlet
    existing = await db.daily_sales.find_one({
        "outlet_id": outlet_id, "sales_date": sales_date,
        "status": {"$in": ["draft", "rejected"]},
        "deleted_at": None,
    })

    grand_total = _calc_grand_total(payload)
    common = {
        "outlet_id": outlet_id, "brand_id": payload.get("brand_id"),
        "sales_date": sales_date,
        "channels": payload.get("channels", []),
        "payment_breakdown": payload.get("payment_breakdown", []),
        "revenue_buckets": payload.get("revenue_buckets", []),
        "service_charge": float(payload.get("service_charge", 0) or 0),
        "tax_amount": float(payload.get("tax_amount", 0) or 0),
        "grand_total": grand_total,
        "transaction_count": int(payload.get("transaction_count", 0) or 0),
        "notes": payload.get("notes"),
        "updated_at": _now(), "updated_by": user["id"],
    }
    if existing:
        common["status"] = "draft"  # back to draft on edit
        common["rejected_reason"] = None
        await db.daily_sales.update_one({"id": existing["id"]}, {"$set": common})
        result = await db.daily_sales.find_one({"id": existing["id"]})
        await audit_log(user_id=user["id"], entity_type="daily_sales",
                        entity_id=existing["id"], action="update")
        return serialize(result)
    # Create new
    doc = {
        "id": str(uuid.uuid4()), "status": "draft", "schema_version": 1,
        "created_at": _now(), "deleted_at": None,
        "created_by": user["id"],
        "submitted_at": None, "submitted_by": None,
        "validated_at": None, "validated_by": None,
        "journal_entry_id": None, "rejected_reason": None,
        **common,
    }
    await db.daily_sales.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=doc["id"],
                    action="create")
    return serialize(doc)


async def submit_daily_sales(id_: str, *, user: dict) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    if s["status"] not in ("draft", "rejected"):
        raise ValidationError(f"Status saat ini: {s['status']}, tidak bisa submit")
    # Validate payment vs grand total balance
    pay_total = sum(float(p.get("amount", 0) or 0) for p in s.get("payment_breakdown", []))
    if abs(pay_total - s["grand_total"]) > 1:
        raise ValidationError(
            f"Total pembayaran ({pay_total}) tidak cocok dengan grand total ({s['grand_total']})"
        )
    await db.daily_sales.update_one(
        {"id": id_},
        {"$set": {"status": "submitted", "submitted_at": _now(),
                 "submitted_by": user["id"], "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=id_, action="submit")
    return await get_daily_sales(id_)


async def validate_daily_sales(id_: str, *, user: dict) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    if s["status"] != "submitted":
        raise ValidationError(f"Status saat ini: {s['status']}, tidak bisa validate")
    # Generate journal entry
    je = await journal_service.post_for_daily_sales(s, user_id=user["id"])
    await db.daily_sales.update_one(
        {"id": id_},
        {"$set": {"status": "validated", "validated_at": _now(),
                 "validated_by": user["id"],
                 "journal_entry_id": je["id"], "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=id_, action="validate")
    return await get_daily_sales(id_)


async def reject_daily_sales(id_: str, *, user: dict, reason: str) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    if s["status"] != "submitted":
        raise ValidationError(f"Status saat ini: {s['status']}, tidak bisa reject")
    await db.daily_sales.update_one(
        {"id": id_},
        {"$set": {"status": "rejected", "rejected_reason": reason, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=id_,
                    action="reject", reason=reason)
    return await get_daily_sales(id_)


async def get_daily_sales(id_: str) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    return serialize(s)


def _calc_grand_total(payload: dict) -> float:
    revenue = sum(float(b.get("amount", 0) or 0) for b in payload.get("revenue_buckets", []))
    return round(revenue + float(payload.get("service_charge", 0) or 0)
                 + float(payload.get("tax_amount", 0) or 0), 2)


# =================== PETTY CASH ===================

async def list_petty_cash(
    *, outlet_ids: list[str], date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None, "outlet_id": {"$in": outlet_ids}}
    if date_from:
        q.setdefault("txn_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("txn_date", {})["$lte"] = date_to
    skip = (page - 1) * per_page
    items = await db.petty_cash_transactions.find(q).sort([("txn_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.petty_cash_transactions.count_documents(q)
    # Compute current balance per outlet (simple sum of all postings)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def petty_cash_balance(outlet_id: str) -> float:
    db = get_db()
    cursor = db.petty_cash_transactions.aggregate([
        {"$match": {"outlet_id": outlet_id, "deleted_at": None, "status": "posted"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": {
                "$cond": [
                    {"$in": ["$type", ["replenish", "adjustment"]]},
                    "$amount",
                    {"$multiply": ["$amount", -1]},
                ]
            }},
        }}
    ])
    res = await cursor.to_list(1)
    return float(res[0]["total"]) if res else 0.0


async def add_petty_cash(payload: dict, *, user: dict) -> dict:
    db = get_db()
    outlet_id = payload["outlet_id"]
    if outlet_id not in user.get("outlet_ids", []) and "*" not in await _user_perms(user):
        raise ForbiddenError("Outlet bukan dalam scope Anda")
    if payload.get("type") not in ("purchase", "replenish", "adjustment"):
        raise ValidationError("type harus purchase / replenish / adjustment")
    if float(payload.get("amount", 0) or 0) <= 0:
        raise ValidationError("Amount harus > 0")
    # Compute balance after
    cur_bal = await petty_cash_balance(outlet_id)
    delta = float(payload["amount"])
    if payload["type"] == "purchase":
        delta = -delta
    new_bal = cur_bal + delta
    if payload["type"] == "purchase" and new_bal < 0:
        raise ValidationError(
            f"Saldo PC tidak cukup. Saldo sekarang Rp {cur_bal:,.0f}, butuh Rp {-delta:,.0f}".replace(",","."),
        )
    doc = {
        "id": str(uuid.uuid4()),
        "outlet_id": outlet_id,
        "txn_date": payload["txn_date"],
        "type": payload["type"],
        "amount": float(payload["amount"]),
        "description": payload.get("description", ""),
        "item_text": payload.get("item_text"),
        "item_id": payload.get("item_id"),
        "vendor_text": payload.get("vendor_text"),
        "vendor_id": payload.get("vendor_id"),
        "category_id": payload.get("category_id"),
        "gl_account_id": payload.get("gl_account_id"),
        "receipt_url": payload.get("receipt_url"),
        "notes": payload.get("notes"),
        "status": "posted",
        "balance_after": new_bal,
        "journal_entry_id": None,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.petty_cash_transactions.insert_one(doc)
    # Auto-journal for purchase with GL
    je = await journal_service.post_for_petty_cash(doc, user_id=user["id"])
    if je:
        await db.petty_cash_transactions.update_one({"id": doc["id"]},
            {"$set": {"journal_entry_id": je["id"]}})
        doc["journal_entry_id"] = je["id"]
    await audit_log(user_id=user["id"], entity_type="petty_cash", entity_id=doc["id"], action="create")
    return serialize(doc)


# =================== URGENT PURCHASE ===================

async def list_urgent_purchases(
    *, outlet_ids: list[str], status: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None, "outlet_id": {"$in": outlet_ids}}
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.urgent_purchases.find(q).sort([("purchase_date", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.urgent_purchases.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_urgent_purchase(payload: dict, *, user: dict) -> dict:
    db = get_db()
    outlet_id = payload["outlet_id"]
    if outlet_id not in user.get("outlet_ids", []) and "*" not in await _user_perms(user):
        raise ForbiddenError("Outlet bukan dalam scope Anda")
    items = payload.get("items", [])
    if not items:
        raise ValidationError("Minimal 1 item")
    total = sum(float(it.get("total", 0) or 0) for it in items)
    forecast_guard_reason = (payload.get("forecast_guard_reason") or "").strip() or None

    # Pre-check forecast guard (urgent purchase doesn't post a JE on creation, but still
    # captures intent and prevents MTD self-counting later when admin approves)
    pre_check_verdict = None
    try:
        from services import forecast_guard_service
        pre_check_verdict = await forecast_guard_service.check_expense(
            amount=total, outlet_id=outlet_id, kind="expense",
            period=(payload["purchase_date"] or "")[:7] or None,
        )
    except Exception:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger("aurora.forecast_guard").exception("guard pre-check failed for UP")

    from utils.number_series import next_doc_no
    doc_no = await next_doc_no("PR")  # sharing PR series for now
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "outlet_id": outlet_id,
        "purchase_date": payload["purchase_date"],
        "vendor_id": payload.get("vendor_id"),
        "vendor_text": payload.get("vendor_text"),
        "items": items,
        "total": total,
        "payment_method_id": payload.get("payment_method_id"),
        "paid_by": payload.get("paid_by"),
        "receipt_url": payload.get("receipt_url"),
        "notes": payload.get("notes"),
        "forecast_guard_reason": forecast_guard_reason,
        "status": "submitted",
        "approved_by": None, "approved_at": None,
        "journal_entry_id": None,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.urgent_purchases.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="urgent_purchase",
                    entity_id=doc["id"], action="create")

    # Persist guard log if pre-check produced a verdict
    if pre_check_verdict is not None:
        try:
            from services import forecast_guard_service
            await forecast_guard_service.log_verdict(
                verdict=pre_check_verdict,
                source_type="urgent_purchase",
                source_id=doc["id"],
                source_doc_no=doc_no,
                reason=forecast_guard_reason,
                user_id=user["id"],
            )
        except Exception:  # noqa: BLE001
            import logging as _logging
            _logging.getLogger("aurora.forecast_guard").exception("guard log failed for UP")

    return serialize(doc)


async def approve_urgent_purchase(id_: str, *, user: dict) -> dict:
    db = get_db()
    up = await db.urgent_purchases.find_one({"id": id_, "deleted_at": None})
    if not up:
        raise NotFoundError("Urgent purchase")
    if up["status"] != "submitted":
        raise ValidationError(f"Status saat ini: {up['status']}")
    je = await journal_service.post_for_urgent_purchase(up, user_id=user["id"])
    await db.urgent_purchases.update_one(
        {"id": id_},
        {"$set": {"status": "approved", "approved_by": user["id"], "approved_at": _now(),
                 "journal_entry_id": je["id"] if je else None,
                 "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="urgent_purchase", entity_id=id_, action="approve")
    fresh = await db.urgent_purchases.find_one({"id": id_})
    return serialize(fresh)


# =================== HOME / TASKS ===================

async def home_tasks(*, user: dict) -> dict:
    """Return today's tasks for outlet user."""
    db = get_db()
    outlet_ids = user.get("outlet_ids", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc).date() - __import__("datetime").timedelta(days=1)).isoformat()

    # Daily sales status today + yesterday
    sales_today = await db.daily_sales.find_one({
        "outlet_id": {"$in": outlet_ids}, "sales_date": today, "deleted_at": None,
    })
    sales_yesterday = await db.daily_sales.find_one({
        "outlet_id": {"$in": outlet_ids}, "sales_date": yesterday, "deleted_at": None,
    })

    pending_pr = await db.purchase_requests.count_documents({
        "outlet_id": {"$in": outlet_ids}, "status": "submitted", "deleted_at": None,
    })

    pc_balance_per_outlet = {}
    for oid in outlet_ids:
        pc_balance_per_outlet[oid] = await petty_cash_balance(oid)

    open_up = await db.urgent_purchases.count_documents({
        "outlet_id": {"$in": outlet_ids}, "status": "submitted", "deleted_at": None,
    })

    return {
        "today": today,
        "sales_today": serialize(sales_today),
        "sales_yesterday": serialize(sales_yesterday),
        "pending_pr_count": pending_pr,
        "open_urgent_purchase_count": open_up,
        "petty_cash_balance": pc_balance_per_outlet,
        "outlet_ids": outlet_ids,
    }


async def _user_perms(user: dict) -> set:
    from core.security import get_user_permissions
    return await get_user_permissions(user)
