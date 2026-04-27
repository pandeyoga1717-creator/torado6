"""Inventory portal services: balance, movements, transfer, adjustment, opname."""
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


# =================== BALANCE & MOVEMENT ===================

async def stock_balance(
    *, outlet_id: Optional[str] = None, item_id: Optional[str] = None,
    page: int = 1, per_page: int = 100,
) -> tuple[list[dict], dict]:
    """Aggregate signed qty per (item, outlet) from inventory_movements."""
    db = get_db()
    match: dict = {"deleted_at": None}
    if outlet_id:
        match["outlet_id"] = outlet_id
    if item_id:
        match["item_id"] = item_id
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"item_id": "$item_id", "outlet_id": "$outlet_id"},
            "qty": {"$sum": "$qty"},
            "total_value": {"$sum": "$total_cost"},
            "last_movement_at": {"$max": "$movement_date"},
            "item_name": {"$last": "$item_name"},
            "unit": {"$last": "$unit"},
            "last_unit_cost": {"$last": "$unit_cost"},
        }},
        {"$sort": {"_id.item_id": 1}},
    ]
    cursor = db.inventory_movements.aggregate(pipeline)
    rows = []
    async for r in cursor:
        rows.append({
            "item_id": r["_id"]["item_id"],
            "outlet_id": r["_id"]["outlet_id"],
            "qty": float(r["qty"] or 0),
            "total_value": float(r["total_value"] or 0),
            "last_movement_at": r.get("last_movement_at"),
            "item_name": r.get("item_name"),
            "unit": r.get("unit"),
            "last_unit_cost": float(r.get("last_unit_cost") or 0),
        })
    # Manual pagination
    total = len(rows)
    skip = (page - 1) * per_page
    return rows[skip:skip + per_page], {"page": page, "per_page": per_page, "total": total}


async def list_movements(
    *, outlet_ids: Optional[list[str]] = None, item_id: Optional[str] = None,
    movement_type: Optional[str] = None, date_from: Optional[str] = None,
    page: int = 1, per_page: int = 50,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    if item_id:
        q["item_id"] = item_id
    if movement_type:
        q["movement_type"] = movement_type
    if date_from:
        q["movement_date"] = {"$gte": date_from}
    skip = (page - 1) * per_page
    items = await db.inventory_movements.find(q).sort([("movement_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.inventory_movements.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def valuation(*, outlet_id: Optional[str] = None) -> dict:
    rows, _ = await stock_balance(outlet_id=outlet_id, per_page=10000)
    total_value = sum(r["total_value"] for r in rows if r["qty"] > 0)
    by_outlet: dict[str, float] = {}
    for r in rows:
        if r["qty"] > 0:
            by_outlet[r["outlet_id"]] = by_outlet.get(r["outlet_id"], 0) + r["total_value"]
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "total_value": round(total_value, 2),
        "item_count": len([r for r in rows if r["qty"] > 0]),
        "by_outlet": {k: round(v, 2) for k, v in by_outlet.items()},
    }


# =================== TRANSFER ===================

async def list_transfers(
    *, outlet_ids: Optional[list[str]] = None, status: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None:
        q["$or"] = [
            {"from_outlet_id": {"$in": outlet_ids}},
            {"to_outlet_id": {"$in": outlet_ids}},
        ]
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.transfers.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.transfers.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_transfer(payload: dict, *, user: dict) -> dict:
    db = get_db()
    if not payload.get("lines"):
        raise ValidationError("Minimal 1 item")
    if payload.get("from_outlet_id") == payload.get("to_outlet_id"):
        raise ValidationError("From dan To outlet harus berbeda")
    doc_no = await next_doc_no("TRF")
    total = 0.0
    for ln in payload["lines"]:
        ln["total_cost"] = float(ln.get("qty", 0) or 0) * float(ln.get("unit_cost", 0) or 0)
        total += ln["total_cost"]
    doc = {
        "id": str(uuid.uuid4()), "doc_no": doc_no,
        "from_outlet_id": payload["from_outlet_id"],
        "to_outlet_id": payload["to_outlet_id"],
        "transfer_date": payload.get("transfer_date")
            or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "lines": payload["lines"],
        "total_value": round(total, 2),
        "notes": payload.get("notes"),
        "status": "draft",
        "movement_out_ids": [], "movement_in_ids": [],
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.transfers.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="transfer",
                    entity_id=doc["id"], action="create")
    return serialize(doc)


async def send_transfer(id_: str, *, user: dict) -> dict:
    db = get_db()
    t = await db.transfers.find_one({"id": id_, "deleted_at": None})
    if not t:
        raise NotFoundError("Transfer")
    if t["status"] != "draft":
        raise ValidationError(f"Status saat ini: {t['status']}")
    movement_out_ids: list[str] = []
    for ln in t["lines"]:
        mov_id = str(uuid.uuid4())
        await db.inventory_movements.insert_one({
            "id": mov_id, "item_id": ln["item_id"],
            "item_name": ln.get("item_name"),
            "outlet_id": t["from_outlet_id"],
            "movement_date": t["transfer_date"],
            "movement_type": "transfer_out",
            "qty": -float(ln.get("qty", 0)), "unit": ln.get("unit"),
            "unit_cost": ln.get("unit_cost", 0),
            "total_cost": -float(ln.get("total_cost", 0)),
            "ref_type": "transfer", "ref_id": id_,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        })
        movement_out_ids.append(mov_id)
    await db.transfers.update_one(
        {"id": id_},
        {"$set": {"status": "sent", "sent_at": _now(),
                 "movement_out_ids": movement_out_ids, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="transfer", entity_id=id_, action="send")
    return serialize(await db.transfers.find_one({"id": id_}))


async def receive_transfer(id_: str, *, user: dict) -> dict:
    db = get_db()
    t = await db.transfers.find_one({"id": id_, "deleted_at": None})
    if not t:
        raise NotFoundError("Transfer")
    if t["status"] != "sent":
        raise ValidationError(f"Status saat ini: {t['status']}")
    movement_in_ids: list[str] = []
    for ln in t["lines"]:
        mov_id = str(uuid.uuid4())
        await db.inventory_movements.insert_one({
            "id": mov_id, "item_id": ln["item_id"],
            "item_name": ln.get("item_name"),
            "outlet_id": t["to_outlet_id"],
            "movement_date": t["transfer_date"],
            "movement_type": "transfer_in",
            "qty": float(ln.get("qty", 0)), "unit": ln.get("unit"),
            "unit_cost": ln.get("unit_cost", 0),
            "total_cost": float(ln.get("total_cost", 0)),
            "ref_type": "transfer", "ref_id": id_,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        })
        movement_in_ids.append(mov_id)
    await db.transfers.update_one(
        {"id": id_},
        {"$set": {"status": "received", "received_at": _now(),
                 "received_by": user["id"],
                 "movement_in_ids": movement_in_ids, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="transfer", entity_id=id_, action="receive")
    return serialize(await db.transfers.find_one({"id": id_}))


# =================== ADJUSTMENT ===================

async def list_adjustments(
    *, outlet_ids: Optional[list[str]] = None, status: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.adjustments.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.adjustments.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_adjustment(payload: dict, *, user: dict, auto_approve: bool = False) -> dict:
    db = get_db()
    if not payload.get("lines"):
        raise ValidationError("Minimal 1 line")
    if not payload.get("reason"):
        raise ValidationError("Reason wajib", field="reason")
    doc_no = await next_doc_no("ADJ")
    total = 0.0
    for ln in payload["lines"]:
        delta = float(ln.get("qty_delta", 0) or 0)
        cost = float(ln.get("unit_cost", 0) or 0)
        ln["total_cost"] = round(delta * cost, 2)
        total += ln["total_cost"]
    doc = {
        "id": str(uuid.uuid4()), "doc_no": doc_no,
        "outlet_id": payload["outlet_id"],
        "adjustment_date": payload.get("adjustment_date")
            or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "reason": payload["reason"],
        "lines": payload["lines"],
        "total_value": round(total, 2),
        "notes": payload.get("notes"),
        "status": "approved" if auto_approve else "submitted",
        "approved_by": user["id"] if auto_approve else None,
        "approved_at": _now() if auto_approve else None,
        "journal_entry_id": None, "movement_ids": [],
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.adjustments.insert_one(doc)
    if auto_approve:
        doc = await _post_adjustment_movements(doc, user=user)
    await audit_log(user_id=user["id"], entity_type="adjustment",
                    entity_id=doc["id"], action="create")
    if doc.get("status") in ("submitted", "awaiting_approval"):
        try:
            state = await approval_service.evaluate("stock_adjustment", serialize(doc))
            await approval_service.notify_pending_approvers(
                "stock_adjustment", serialize(doc), state=state, triggered_by=user,
            )
        except Exception:  # noqa: BLE001
            pass
    return serialize(doc)


async def approve_adjustment(id_: str, *, user: dict, note: str | None = None) -> dict:
    """Approve via multi-tier engine. When engine completes, post movements & JE."""
    db = get_db()
    adj = await db.adjustments.find_one({"id": id_, "deleted_at": None})
    if not adj:
        raise NotFoundError("Adjustment")
    if adj["status"] not in ("submitted", "awaiting_approval", "draft"):
        raise ValidationError(f"Status saat ini: {adj['status']}")
    res = await approval_service.approve("stock_adjustment", id_, user=user, note=note)
    entity = res["entity"]
    # If engine just completed (status == approved), post side-effects
    if entity.get("status") == "approved" and not entity.get("journal_entry_id"):
        entity = await _post_adjustment_movements(entity, user=user)
    await audit_log(user_id=user["id"], entity_type="adjustment", entity_id=id_, action="approve_step")
    return serialize(entity)


async def reject_adjustment(id_: str, *, user: dict, reason: str) -> dict:
    res = await approval_service.reject("stock_adjustment", id_, user=user, reason=reason)
    return res["entity"]


async def get_adjustment_approval_state(id_: str) -> dict:
    db = get_db()
    adj = await db.adjustments.find_one({"id": id_, "deleted_at": None})
    if not adj:
        raise NotFoundError("Adjustment")
    return await approval_service.evaluate("stock_adjustment", serialize(adj))


async def _post_adjustment_movements(adj: dict, *, user: dict) -> dict:
    db = get_db()
    movement_ids: list[str] = []
    for ln in adj["lines"]:
        mov_id = str(uuid.uuid4())
        delta = float(ln.get("qty_delta", 0))
        await db.inventory_movements.insert_one({
            "id": mov_id, "item_id": ln["item_id"],
            "item_name": ln.get("item_name"),
            "outlet_id": adj["outlet_id"], "movement_date": adj["adjustment_date"],
            "movement_type": "adjustment",
            "qty": delta, "unit": ln.get("unit"),
            "unit_cost": ln.get("unit_cost", 0),
            "total_cost": ln.get("total_cost", 0),
            "ref_type": "adjustment", "ref_id": adj["id"],
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        })
        movement_ids.append(mov_id)
    je = await journal_service.post_for_adjustment(adj, user_id=user["id"])
    await db.adjustments.update_one(
        {"id": adj["id"]},
        {"$set": {"status": "approved", "approved_by": user["id"],
                 "approved_at": _now(),
                 "movement_ids": movement_ids,
                 "journal_entry_id": je["id"], "updated_at": _now()}},
    )
    return await db.adjustments.find_one({"id": adj["id"]})


# =================== OPNAME ===================

async def list_opname(*, outlet_ids: Optional[list[str]] = None,
                       status: Optional[str] = None,
                       page: int = 1, per_page: int = 20):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.opname_sessions.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.opname_sessions.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def start_opname(payload: dict, *, user: dict) -> dict:
    db = get_db()
    outlet_id = payload["outlet_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    period = payload.get("period") or today[:7]
    # Snapshot system stock for this outlet
    rows, _ = await stock_balance(outlet_id=outlet_id, per_page=10000)
    lines = []
    for r in rows:
        if not r["item_id"]:
            continue
        lines.append({
            "item_id": r["item_id"], "item_name": r.get("item_name"),
            "system_qty": r["qty"], "counted_qty": None,
            "variance": 0, "unit": r.get("unit"),
            "unit_cost": r.get("last_unit_cost", 0),
            "variance_value": 0, "notes": None, "counted_at": None,
        })
    doc_no = await next_doc_no("OPN")
    doc = {
        "id": str(uuid.uuid4()), "doc_no": doc_no,
        "outlet_id": outlet_id, "period": period,
        "opname_date": today,
        "status": "in_progress",
        "counted_by_user_ids": [user["id"]],
        "lines": lines,
        "total_variance_value": 0,
        "total_items": len(lines), "counted_items": 0,
        "notes": payload.get("notes"),
        "submitted_at": None, "submitted_by": None,
        "approved_at": None, "approved_by": None,
        "journal_entry_id": None, "movement_ids": [],
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.opname_sessions.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="opname",
                    entity_id=doc["id"], action="start")
    return serialize(doc)


async def update_opname_lines(id_: str, lines: list[dict], *, user: dict) -> dict:
    db = get_db()
    sess = await db.opname_sessions.find_one({"id": id_, "deleted_at": None})
    if not sess:
        raise NotFoundError("Opname")
    if sess["status"] != "in_progress":
        raise ValidationError(f"Status: {sess['status']}")
    # Merge updates by item_id
    by_item = {ln["item_id"]: ln for ln in sess["lines"]}
    for upd in lines:
        if upd["item_id"] in by_item:
            cur = by_item[upd["item_id"]]
            counted = upd.get("counted_qty")
            if counted is not None:
                cur["counted_qty"] = float(counted)
                cur["variance"] = cur["counted_qty"] - float(cur["system_qty"])
                cur["variance_value"] = round(cur["variance"] * float(cur.get("unit_cost", 0)), 2)
                cur["counted_at"] = _now()
            if "notes" in upd:
                cur["notes"] = upd["notes"]
    new_lines = list(by_item.values())
    counted = sum(1 for l in new_lines if l.get("counted_qty") is not None)
    total_var_value = round(sum(l.get("variance_value", 0) for l in new_lines), 2)
    await db.opname_sessions.update_one(
        {"id": id_},
        {"$set": {"lines": new_lines, "counted_items": counted,
                 "total_variance_value": total_var_value, "updated_at": _now()}},
    )
    return serialize(await db.opname_sessions.find_one({"id": id_}))


async def submit_opname(id_: str, *, user: dict) -> dict:
    db = get_db()
    sess = await db.opname_sessions.find_one({"id": id_, "deleted_at": None})
    if not sess:
        raise NotFoundError("Opname")
    if sess["status"] != "in_progress":
        raise ValidationError(f"Status: {sess['status']}")
    # Create variance movements + journal
    movement_ids: list[str] = []
    for ln in sess["lines"]:
        if ln.get("counted_qty") is None or abs(ln.get("variance", 0)) < 0.001:
            continue
        mov_id = str(uuid.uuid4())
        await db.inventory_movements.insert_one({
            "id": mov_id, "item_id": ln["item_id"],
            "item_name": ln.get("item_name"),
            "outlet_id": sess["outlet_id"],
            "movement_date": sess["opname_date"],
            "movement_type": "opname_diff",
            "qty": ln["variance"], "unit": ln.get("unit"),
            "unit_cost": ln.get("unit_cost", 0),
            "total_cost": ln.get("variance_value", 0),
            "ref_type": "opname", "ref_id": id_,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        })
        movement_ids.append(mov_id)
    je = await journal_service.post_for_opname(sess, user_id=user["id"])
    await db.opname_sessions.update_one(
        {"id": id_},
        {"$set": {"status": "submitted", "submitted_at": _now(),
                 "submitted_by": user["id"],
                 "movement_ids": movement_ids,
                 "journal_entry_id": (je["id"] if je else None),
                 "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="opname", entity_id=id_, action="submit")
    return serialize(await db.opname_sessions.find_one({"id": id_}))
