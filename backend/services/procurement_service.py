"""Procurement portal services: PR, PO, GR."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError
from services import approval_service, journal_service
from utils.number_series import next_doc_no


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =================== PURCHASE REQUEST ===================

async def list_prs(
    *, outlet_ids: Optional[list[str]] = None, status: Optional[str] = None,
    source: Optional[str] = None, page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    if status:
        q["status"] = status
    if source:
        q["source"] = source
    skip = (page - 1) * per_page
    items = await db.purchase_requests.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.purchase_requests.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_pr(payload: dict, *, user: dict) -> dict:
    db = get_db()
    if not payload.get("lines"):
        raise ValidationError("Minimal 1 line item")
    doc_no = await next_doc_no("PR")
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "requester_user_id": user["id"],
        "outlet_id": payload["outlet_id"],
        "brand_id": payload.get("brand_id"),
        "request_date": payload.get("request_date")
            or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "needed_by": payload.get("needed_by"),
        "source": payload.get("source", "manual"),
        "lines": payload["lines"],
        "notes": payload.get("notes"),
        "status": payload.get("status", "submitted"),
        "approval_chain": [],
        "submitted_at": _now() if payload.get("status") != "draft" else None,
        "converted_to_po_ids": [],
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.purchase_requests.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="purchase_request",
                    entity_id=doc["id"], action="create")
    # Notify approvers if PR is submitted
    if doc["status"] in ("submitted", "awaiting_approval"):
        try:
            state = await approval_service.evaluate("purchase_request", serialize(doc))
            await approval_service.notify_pending_approvers(
                "purchase_request", serialize(doc), state=state, triggered_by=user,
            )
        except Exception:  # noqa: BLE001
            pass
    return serialize(doc)


async def approve_pr(id_: str, *, user: dict, note: str | None = None) -> dict:
    """Approve a PR step via the multi-tier approval engine.
    Returns the updated PR doc.
    """
    res = await approval_service.approve("purchase_request", id_, user=user, note=note)
    return res["entity"]


async def reject_pr(id_: str, *, user: dict, reason: str) -> dict:
    res = await approval_service.reject("purchase_request", id_, user=user, reason=reason)
    return res["entity"]


async def get_pr_approval_state(id_: str) -> dict:
    """Return the approval state (current step, tier, completion) for a PR."""
    db = get_db()
    pr = await db.purchase_requests.find_one({"id": id_, "deleted_at": None})
    if not pr:
        raise NotFoundError("PR")
    return await approval_service.evaluate("purchase_request", serialize(pr))


# =================== PURCHASE ORDER ===================

async def list_pos(
    *, status: Optional[str] = None, vendor_id: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if vendor_id:
        q["vendor_id"] = vendor_id
    skip = (page - 1) * per_page
    items = await db.purchase_orders.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.purchase_orders.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_po(payload: dict, *, user: dict) -> dict:
    db = get_db()
    if not payload.get("lines"):
        raise ValidationError("Minimal 1 line item")
    if not payload.get("vendor_id"):
        raise ValidationError("Vendor wajib", field="vendor_id")
    doc_no = await next_doc_no("PO")
    lines = []
    subtotal = 0.0
    tax_total = 0.0
    for ln in payload["lines"]:
        qty = float(ln.get("qty", 0) or 0)
        unit_cost = float(ln.get("unit_cost", 0) or 0)
        discount = float(ln.get("discount", 0) or 0)
        tax_rate = float(ln.get("tax_rate", 0) or 0)
        line_subtotal = qty * unit_cost - discount
        line_tax = line_subtotal * tax_rate
        total = line_subtotal + line_tax
        lines.append({**ln, "qty": qty, "unit_cost": unit_cost,
                      "discount": discount, "tax_rate": tax_rate, "total": total})
        subtotal += line_subtotal
        tax_total += line_tax
    grand = subtotal + tax_total
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "vendor_id": payload["vendor_id"],
        "outlet_id": payload.get("outlet_id"),
        "pr_ids": payload.get("pr_ids", []),
        "order_date": payload.get("order_date")
            or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "expected_delivery_date": payload.get("expected_delivery_date"),
        "lines": lines,
        "subtotal": round(subtotal, 2),
        "tax_total": round(tax_total, 2),
        "discount_total": 0.0,
        "grand_total": round(grand, 2),
        "payment_terms_days": int(payload.get("payment_terms_days", 30)),
        "status": "draft",
        "approval_chain": [],
        "notes": payload.get("notes"),
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.purchase_orders.insert_one(doc)
    # Mark PRs as converted if any
    if doc["pr_ids"]:
        await db.purchase_requests.update_many(
            {"id": {"$in": doc["pr_ids"]}},
            {"$addToSet": {"converted_to_po_ids": doc["id"]}, "$set": {"status": "converted"}},
        )
    await audit_log(user_id=user["id"], entity_type="purchase_order",
                    entity_id=doc["id"], action="create")
    return serialize(doc)


async def send_po(id_: str, *, user: dict) -> dict:
    db = get_db()
    po = await db.purchase_orders.find_one({"id": id_, "deleted_at": None})
    if not po:
        raise NotFoundError("PO")
    if po["status"] not in ("draft", "awaiting_approval", "approved"):
        raise ValidationError(f"Status saat ini: {po['status']}")
    # Gate by approval engine: PO must be approved before send (if a workflow is configured)
    state = await approval_service.evaluate("purchase_order", serialize(po))
    if state.get("has_workflow") and not state.get("is_complete"):
        raise ValidationError(
            "PO belum selesai approval. Selesaikan approval chain terlebih dahulu.",
            code="PO_APPROVAL_INCOMPLETE",
        )
    await db.purchase_orders.update_one(
        {"id": id_},
        {"$set": {"status": "sent", "sent_at": _now(), "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="purchase_order",
                    entity_id=id_, action="send")
    return serialize(await db.purchase_orders.find_one({"id": id_}))


async def approve_po(id_: str, *, user: dict, note: str | None = None) -> dict:
    """Multi-tier approve via approval engine."""
    res = await approval_service.approve("purchase_order", id_, user=user, note=note)
    return res["entity"]


async def reject_po(id_: str, *, user: dict, reason: str) -> dict:
    res = await approval_service.reject("purchase_order", id_, user=user, reason=reason)
    return res["entity"]


async def submit_po_for_approval(id_: str, *, user: dict) -> dict:
    """Move PO from draft → awaiting_approval (so engine flow starts)."""
    db = get_db()
    po = await db.purchase_orders.find_one({"id": id_, "deleted_at": None})
    if not po:
        raise NotFoundError("PO")
    if po["status"] != "draft":
        raise ValidationError(f"Hanya PO draft yang dapat di-submit. Status saat ini: {po['status']}")
    await db.purchase_orders.update_one(
        {"id": id_},
        {"$set": {"status": "awaiting_approval", "submitted_at": _now(), "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="purchase_order",
                    entity_id=id_, action="submit")
    fresh = await db.purchase_orders.find_one({"id": id_})
    fresh_s = serialize(fresh)
    try:
        state = await approval_service.evaluate("purchase_order", fresh_s)
        await approval_service.notify_pending_approvers(
            "purchase_order", fresh_s, state=state, triggered_by=user,
        )
    except Exception:  # noqa: BLE001
        pass
    return fresh_s


async def get_po_approval_state(id_: str) -> dict:
    db = get_db()
    po = await db.purchase_orders.find_one({"id": id_, "deleted_at": None})
    if not po:
        raise NotFoundError("PO")
    return await approval_service.evaluate("purchase_order", serialize(po))


async def cancel_po(id_: str, *, user: dict, reason: str) -> dict:
    db = get_db()
    po = await db.purchase_orders.find_one({"id": id_, "deleted_at": None})
    if not po:
        raise NotFoundError("PO")
    if po["status"] in ("received", "closed", "cancelled"):
        raise ValidationError(f"PO sudah {po['status']}, tidak bisa dibatalkan")
    await db.purchase_orders.update_one(
        {"id": id_},
        {"$set": {"status": "cancelled", "cancelled_at": _now(),
                 "cancelled_reason": reason, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="purchase_order",
                    entity_id=id_, action="cancel", reason=reason)
    return serialize(await db.purchase_orders.find_one({"id": id_}))


# =================== GOODS RECEIPT ===================

async def list_grs(
    *, status: Optional[str] = None, page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.goods_receipts.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.goods_receipts.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def post_gr(payload: dict, *, user: dict) -> dict:
    """Post goods receipt:
    - Create GR doc with status=posted
    - Create inventory_movements (receipt) per line
    - Create AP ledger (KB) entry
    - Post journal entry (Dr Inv, Dr Input VAT, Cr AP)
    """
    db = get_db()
    if not payload.get("lines"):
        raise ValidationError("Minimal 1 line item")
    if not payload.get("vendor_id"):
        raise ValidationError("Vendor wajib", field="vendor_id")
    if not payload.get("outlet_id"):
        raise ValidationError("Outlet wajib", field="outlet_id")

    doc_no = await next_doc_no("GR")
    receive_date = payload.get("receive_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    outlet_id = payload["outlet_id"]

    lines: list[dict] = []
    subtotal = 0.0
    tax_total = 0.0
    for ln in payload["lines"]:
        qty = float(ln.get("qty_received", 0) or 0)
        unit_cost = float(ln.get("unit_cost", 0) or 0)
        line_total = qty * unit_cost
        lines.append({
            "po_line_index": ln.get("po_line_index"),
            "item_id": ln.get("item_id"),
            "item_name": ln.get("item_name", ""),
            "qty_ordered": float(ln.get("qty_ordered", 0) or 0),
            "qty_received": qty,
            "qty_variance": float(ln.get("qty_ordered", 0) or 0) - qty,
            "unit": ln.get("unit", "pcs"),
            "unit_cost": unit_cost,
            "total_cost": round(line_total, 2),
            "condition_note": ln.get("condition_note"),
        })
        subtotal += line_total
    # Tax (single rate from payload, default 0)
    tax_rate = float(payload.get("tax_rate", 0) or 0)
    tax_total = subtotal * tax_rate
    grand = subtotal + tax_total

    gr_id = str(uuid.uuid4())
    gr_doc = {
        "id": gr_id, "doc_no": doc_no,
        "po_id": payload.get("po_id"),
        "vendor_id": payload["vendor_id"],
        "outlet_id": outlet_id,
        "receive_date": receive_date,
        "invoice_no": payload.get("invoice_no"),
        "invoice_date": payload.get("invoice_date"),
        "invoice_url": payload.get("invoice_url"),
        "lines": lines,
        "subtotal": round(subtotal, 2),
        "tax_total": round(tax_total, 2),
        "grand_total": round(grand, 2),
        "notes": payload.get("notes"),
        "status": "posted",
        "posted_at": _now(),
        "received_by": user["id"],
        "inventory_movement_ids": [],
        "ap_id": None, "journal_entry_id": None,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.goods_receipts.insert_one(gr_doc)

    # Inventory movements
    movement_ids: list[str] = []
    for ln in lines:
        mov_id = str(uuid.uuid4())
        await db.inventory_movements.insert_one({
            "id": mov_id,
            "item_id": ln["item_id"], "item_name": ln["item_name"],
            "outlet_id": outlet_id, "movement_date": receive_date,
            "movement_type": "receipt",
            "qty": ln["qty_received"], "unit": ln["unit"],
            "unit_cost": ln["unit_cost"], "total_cost": ln["total_cost"],
            "ref_type": "goods_receipt", "ref_id": gr_id,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        })
        movement_ids.append(mov_id)

    # AP ledger (KB)
    ap_id = str(uuid.uuid4())
    payment_terms = int(payload.get("payment_terms_days", 30))
    from datetime import timedelta
    due_date = (datetime.fromisoformat(receive_date)
                + timedelta(days=payment_terms)).strftime("%Y-%m-%d")
    await db.ap_ledger.insert_one({
        "id": ap_id, "vendor_id": payload["vendor_id"],
        "gr_id": gr_id,
        "invoice_no": payload.get("invoice_no"),
        "invoice_date": payload.get("invoice_date") or receive_date,
        "due_date": due_date,
        "amount": round(grand, 2),
        "balance": round(grand, 2),
        "currency": "IDR",
        "status": "open",
        "payments": [],
        "posted_at": _now(),
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    })

    # Journal
    je = await journal_service.post_for_gr(gr_doc, user_id=user["id"])

    # Update GR with refs
    await db.goods_receipts.update_one(
        {"id": gr_id},
        {"$set": {
            "inventory_movement_ids": movement_ids,
            "ap_id": ap_id, "journal_entry_id": je["id"],
            "updated_at": _now(),
        }},
    )

    # Update PO status if all lines received
    if payload.get("po_id"):
        po = await db.purchase_orders.find_one({"id": payload["po_id"]})
        if po:
            ordered_qty = sum(float(l.get("qty", 0) or 0) for l in po.get("lines", []))
            received_qty = sum(float(l.get("qty_received", 0) or 0) for l in lines)
            new_status = "received" if received_qty >= ordered_qty - 0.01 else "partial"
            await db.purchase_orders.update_one(
                {"id": payload["po_id"]},
                {"$set": {"status": new_status, "updated_at": _now()}},
            )

    await audit_log(user_id=user["id"], entity_type="goods_receipt",
                    entity_id=gr_id, action="post")
    fresh = await db.goods_receipts.find_one({"id": gr_id})
    # Phase 7D — Real-time vendor anomaly check (best-effort)
    try:
        from services import anomaly_service
        await anomaly_service.check_gr_live(serialize(fresh), user_id=user["id"])
    except Exception as e:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger("aurora.procurement").warning("vendor anomaly check failed: %s", e)
    return serialize(fresh)
