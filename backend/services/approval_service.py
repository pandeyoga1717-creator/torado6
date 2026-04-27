"""Approval Engine — multi-tier approval workflow.

Stores rules in `business_rules` (rule_type='approval_workflow').

Rule shape (rule_data):
{
  "entity_type": "purchase_request",  # or purchase_order, stock_adjustment
  "amount_field": "total_estimated",  # auto-computed if absent
  "tiers": [
    {
      "min_amount": 0,
      "max_amount": 1000000,
      "label": "Tier 1: <1jt",
      "steps": [
        { "label": "Outlet Manager", "any_of_perms": ["procurement.pr.approve"] }
      ]
    },
    {
      "min_amount": 1000000, "max_amount": 10000000, "label": "Tier 2: 1-10jt",
      "steps": [
        { "label": "Procurement Manager", "any_of_perms": ["procurement.pr.approve"] },
        { "label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"] }
      ]
    }
  ]
}

Behaviour:
- compute_amount(entity_type, entity) → numeric total
- get_workflow(entity_type) → most recent active approval_workflow rule for entity_type
- evaluate(entity_type, entity) → {tier, total_steps, current_step_idx, is_complete, next_step}
- approve(entity_type, entity, user, note) → appends a chain entry; advances; returns updated chain + completion flag
- reject(entity_type, entity, user, reason) → appends a rejected entry; terminal

Notifications:
- On approval start (entity moves into awaiting_approval) → notify_pending_approvers()
- After approve_step (intermediate) → notify next-step approvers
- After approve_step (final)        → notify creator (done)
- After reject                      → notify creator (urgent)
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ForbiddenError, NotFoundError, ValidationError
from core.security import get_user_permissions
from services import notification_service

logger = logging.getLogger("aurora.approval")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Map entity_type → mongo collection
ENTITY_COLLECTIONS: dict[str, str] = {
    "purchase_request":  "purchase_requests",
    "purchase_order":    "purchase_orders",
    "stock_adjustment":  "adjustments",
    "payment_request":   "payment_requests",
    "employee_advance":  "employee_advances",
}


# ============================================================
# WORKFLOW RESOLVER
# ============================================================

async def get_workflow(entity_type: str) -> Optional[dict]:
    """Return the active approval_workflow rule for the entity_type, or None.
    Latest version wins.
    """
    db = get_db()
    doc = await db.business_rules.find_one(
        {
            "deleted_at": None, "active": True,
            "rule_type": "approval_workflow",
            "rule_data.entity_type": entity_type,
        },
        sort=[("version", -1), ("updated_at", -1)],
    )
    return serialize(doc) if doc else None


async def list_workflows(*, entity_type: Optional[str] = None) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None, "rule_type": "approval_workflow"}
    if entity_type:
        q["rule_data.entity_type"] = entity_type
    items = await db.business_rules.find(q).sort([("rule_data.entity_type", 1), ("version", -1)]).to_list(200)
    return [serialize(d) for d in items]


# ============================================================
# AMOUNT COMPUTATION
# ============================================================

def compute_amount(entity_type: str, entity: dict, amount_field: Optional[str] = None) -> float:
    """Try amount_field first; fallback to standard field per entity type."""
    if amount_field and entity.get(amount_field) is not None:
        try:
            return float(entity[amount_field])
        except Exception:  # noqa: BLE001
            pass
    if entity_type == "purchase_request":
        # Sum qty * est_cost over lines
        return sum(
            float(ln.get("qty", 0) or 0) * float(ln.get("est_cost", 0) or 0)
            for ln in (entity.get("lines") or [])
        )
    if entity_type == "purchase_order":
        return float(entity.get("grand_total", 0) or 0)
    if entity_type == "stock_adjustment":
        return abs(float(entity.get("total_value", 0) or 0))
    if entity_type == "payment_request":
        return float(entity.get("amount", 0) or 0)
    if entity_type == "employee_advance":
        return float(entity.get("amount", 0) or 0)
    return 0.0


def _tier_for_amount(workflow: dict, amount: float) -> Optional[dict]:
    tiers = (workflow.get("rule_data") or {}).get("tiers") or []
    for t in tiers:
        lo = float(t.get("min_amount", 0) or 0)
        hi = t.get("max_amount")
        hi_f = float(hi) if hi is not None else None
        if amount >= lo and (hi_f is None or amount < hi_f):
            return t
    # Fallback: last tier
    return tiers[-1] if tiers else None


# ============================================================
# EVALUATION
# ============================================================

async def evaluate(entity_type: str, entity: dict) -> dict:
    """Inspect entity.approval_chain vs workflow tier; return state for UI/engine."""
    wf = await get_workflow(entity_type)
    chain: list[dict] = entity.get("approval_chain") or []
    # Pre-existing rejection terminates flow
    if any(s.get("action") == "rejected" for s in chain):
        return {
            "has_workflow": bool(wf), "tier": None, "amount": 0.0,
            "steps": [], "current_step_idx": None,
            "is_complete": False, "is_rejected": True,
            "executed_steps": chain,
        }
    if not wf:
        # No workflow configured → single-step (legacy single approve)
        executed = [s for s in chain if s.get("action") == "approved"]
        return {
            "has_workflow": False, "tier": None, "amount": 0.0,
            "steps": [{"label": "Approve", "any_of_perms": []}],
            "current_step_idx": 0 if not executed else None,
            "is_complete": bool(executed),
            "is_rejected": False,
            "executed_steps": chain,
        }
    amount_field = (wf.get("rule_data") or {}).get("amount_field")
    amount = compute_amount(entity_type, entity, amount_field)
    tier = _tier_for_amount(wf, amount)
    steps = (tier or {}).get("steps") or []
    executed_count = sum(1 for s in chain if s.get("action") == "approved")
    is_complete = executed_count >= len(steps) and len(steps) > 0
    current_step_idx = None if is_complete else executed_count if executed_count < len(steps) else None
    return {
        "has_workflow": True,
        "workflow_id": wf.get("id"),
        "tier": tier,
        "amount": round(amount, 2),
        "steps": steps,
        "current_step_idx": current_step_idx,
        "is_complete": is_complete,
        "is_rejected": False,
        "executed_steps": chain,
    }


# ============================================================
# DB HELPERS
# ============================================================

def _collection_for(entity_type: str) -> str:
    col = ENTITY_COLLECTIONS.get(entity_type)
    if not col:
        raise ValidationError(f"Tipe entity tidak didukung: {entity_type}")
    return col


async def _get_entity(entity_type: str, entity_id: str) -> dict:
    db = get_db()
    col = _collection_for(entity_type)
    doc = await db[col].find_one({"id": entity_id, "deleted_at": None})
    if not doc:
        raise NotFoundError(f"{entity_type} tidak ditemukan")
    return serialize(doc)


async def _user_has_any_perm(user: dict, any_of_perms: list[str]) -> bool:
    if not any_of_perms:
        return True  # No requirement
    perms = await get_user_permissions(user)
    if "*" in perms:
        return True
    return any(p in perms for p in any_of_perms)


# ============================================================
# APPROVER RESOLUTION + NOTIFICATIONS
# ============================================================

ENTITY_LABELS = {
    "purchase_request":  "Purchase Request",
    "purchase_order":    "Purchase Order",
    "stock_adjustment":  "Stock Adjustment",
    "payment_request":   "Payment Request",
    "employee_advance":  "Employee Advance",
}

ENTITY_LINK_BUILDERS = {
    "purchase_request":  lambda eid: f"/procurement/pr/{eid}",
    "purchase_order":    lambda eid: f"/procurement/po/{eid}",
    "stock_adjustment":  lambda _eid: "/inventory/adjustments",
    "payment_request":   lambda eid: f"/finance/payment-requests/{eid}",
    "employee_advance":  lambda _eid: "/hr/advances",
}


def _entity_label(entity_type: str) -> str:
    return ENTITY_LABELS.get(entity_type, entity_type.replace("_", " ").title())


def _entity_link(entity_type: str, entity_id: str) -> str:
    builder = ENTITY_LINK_BUILDERS.get(entity_type)
    return builder(entity_id) if builder else f"/{entity_type}/{entity_id}"


def _doc_descriptor(entity_type: str, entity: dict) -> str:
    """Short human-readable doc title for notifications."""
    doc_no = entity.get("doc_no")
    base = f"{_entity_label(entity_type)} {doc_no or entity.get('id', '')[:8]}"
    return base


async def _resolve_eligible_approvers(any_of_perms: list[str], *,
                                       outlet_id: Optional[str] = None) -> list[dict]:
    """Find active users whose effective permissions include any of `any_of_perms`.
    Optional outlet scoping: prefer users whose outlet_ids contain the entity's outlet.
    Falls back to global eligible users when none match the outlet.
    """
    if not any_of_perms:
        return []
    db = get_db()
    # 1) roles that grant any of the required perms (or "*" superuser)
    role_query = {
        "$or": [
            {"permissions": {"$in": any_of_perms}},
            {"permissions": "*"},
        ],
    }
    role_ids: list[str] = []
    async for r in db.roles.find(role_query, {"id": 1}):
        role_ids.append(r["id"])
    if not role_ids:
        return []
    # 2) active users with any of those roles
    user_q: dict = {
        "deleted_at": None,
        "status": "active",
        "role_ids": {"$in": role_ids},
    }
    candidates: list[dict] = []
    async for u in db.users.find(user_q, {"id": 1, "full_name": 1, "outlet_ids": 1}):
        candidates.append(u)
    if outlet_id:
        scoped = [u for u in candidates if outlet_id in (u.get("outlet_ids") or [])]
        if scoped:
            return scoped
    return candidates


async def _push_approval_notif(*, user_id: str, type_: str, title: str, body: str | None,
                                entity_type: str, entity_id: str, link: str) -> None:
    try:
        await notification_service.push(
            user_id=user_id, type=type_, title=title, body=body,
            link=link, source_type=entity_type, source_id=entity_id,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Failed to push approval notification: {e}")


async def notify_pending_approvers(entity_type: str, entity: dict, *, state: dict | None = None,
                                    triggered_by: Optional[dict] = None) -> int:
    """Notify all eligible users for the current step that an item awaits their approval.
    Returns number of notifications sent. Safe to call multiple times (idempotency is best-effort
    via dedupe in caller — here we always send).
    """
    if not state:
        state = await evaluate(entity_type, entity)
    if not state.get("has_workflow") or state.get("is_complete") or state.get("is_rejected"):
        return 0
    step_idx = state.get("current_step_idx")
    if step_idx is None:
        return 0
    step = (state.get("steps") or [])[step_idx]
    required = step.get("any_of_perms") or []
    outlet_id = entity.get("outlet_id")
    approvers = await _resolve_eligible_approvers(required, outlet_id=outlet_id)
    title = f"Approval needed: {_doc_descriptor(entity_type, entity)}"
    body_parts = [step.get("label") or f"Step {step_idx + 1}"]
    if state.get("amount"):
        body_parts.append(f"Rp {float(state['amount']):,.0f}".replace(",", "."))
    if triggered_by and triggered_by.get("full_name"):
        body_parts.append(f"oleh {triggered_by['full_name']}")
    body = " · ".join(body_parts)
    link = _entity_link(entity_type, entity.get("id"))
    sent = 0
    for u in approvers:
        # Don't notify the user that just acted
        if triggered_by and u.get("id") == triggered_by.get("id"):
            continue
        await _push_approval_notif(
            user_id=u["id"], type_="warn", title=title, body=body,
            entity_type=entity_type, entity_id=entity.get("id"), link=link,
        )
        sent += 1
    return sent


async def notify_creator(entity_type: str, entity: dict, *, kind: str,
                          actor: Optional[dict] = None, reason: Optional[str] = None) -> bool:
    """kind: 'approved' | 'rejected'. Notifies entity.created_by if any."""
    creator_id = entity.get("created_by")
    if not creator_id:
        return False
    if actor and actor.get("id") == creator_id:
        return False
    title_pref = "Approved" if kind == "approved" else "Rejected"
    title = f"{title_pref}: {_doc_descriptor(entity_type, entity)}"
    body = reason if kind == "rejected" else (
        f"Disetujui oleh {actor.get('full_name')}" if actor and actor.get("full_name") else "Approval selesai"
    )
    type_ = "done" if kind == "approved" else "urgent"
    link = _entity_link(entity_type, entity.get("id"))
    await _push_approval_notif(
        user_id=creator_id, type_=type_, title=title, body=body,
        entity_type=entity_type, entity_id=entity.get("id"), link=link,
    )
    return True


# ============================================================
# APPROVE / REJECT
# ============================================================

async def approve(
    entity_type: str, entity_id: str, *, user: dict, note: Optional[str] = None,
) -> dict:
    """Append a step approval; advance status to approved when all steps are done."""
    db = get_db()
    col = _collection_for(entity_type)
    entity = await _get_entity(entity_type, entity_id)

    # Status must be approvable: submitted | awaiting_approval | draft (for some)
    cur_status = entity.get("status")
    if cur_status not in ("submitted", "awaiting_approval", "draft"):
        raise ValidationError(f"Status saat ini tidak dapat di-approve: {cur_status}")

    state = await evaluate(entity_type, entity)
    if state["is_rejected"]:
        raise ValidationError("Entity sudah ditolak")
    if state["is_complete"]:
        raise ValidationError("Approval sudah selesai")
    step_idx = state["current_step_idx"]
    if step_idx is None:
        raise ValidationError("Tidak ada step approval yang dibutuhkan")
    step = (state["steps"] or [])[step_idx]
    required = step.get("any_of_perms") or []

    if not await _user_has_any_perm(user, required):
        raise ForbiddenError(
            f"Anda tidak memiliki permission untuk step '{step.get('label')}'. "
            f"Diperlukan salah satu: {', '.join(required) or '(tidak terdefinisi)'}",
            code="APPROVAL_PERM_MISSING",
        )

    chain = entity.get("approval_chain") or []
    user_perms = await get_user_permissions(user)
    if "*" in user_perms:
        matched = "*"
    else:
        matched = next((p for p in required if p in user_perms), None)
    chain.append({
        "level": len(chain) + 1,
        "step_idx": step_idx,
        "step_label": step.get("label"),
        "action": "approved",
        "approver_id": user["id"],
        "approver_name": user.get("full_name"),
        "matched_perm": matched,
        "at": _now(),
        "note": note,
    })

    # Re-evaluate after appending
    new_state = await evaluate(entity_type, {**entity, "approval_chain": chain})
    final_status = "approved" if new_state["is_complete"] else "awaiting_approval"

    update = {
        "approval_chain": chain,
        "status": final_status,
        "updated_at": _now(),
    }
    if final_status == "approved":
        update["approved_at"] = _now()

    await db[col].update_one({"id": entity_id}, {"$set": update})
    await audit_log(
        user_id=user["id"], entity_type=entity_type, entity_id=entity_id,
        action="approve_step", reason=note,
    )

    after = await db[col].find_one({"id": entity_id})
    after_serialized = serialize(after)
    new_eval = await evaluate(entity_type, after_serialized)

    # ---- Notifications ----
    try:
        if new_state["is_complete"]:
            # Final approval → notify creator
            await notify_creator(entity_type, after_serialized, kind="approved", actor=user)
        else:
            # Intermediate → notify next-step approvers
            await notify_pending_approvers(entity_type, after_serialized, state=new_eval, triggered_by=user)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Approval notification dispatch failed: {e}")

    return {
        "entity": after_serialized,
        "state": new_eval,
        "completed": new_state["is_complete"],
    }


async def reject(
    entity_type: str, entity_id: str, *, user: dict, reason: str,
) -> dict:
    if not reason or not reason.strip():
        raise ValidationError("Alasan reject wajib")
    db = get_db()
    col = _collection_for(entity_type)
    entity = await _get_entity(entity_type, entity_id)

    cur_status = entity.get("status")
    if cur_status not in ("submitted", "awaiting_approval", "draft"):
        raise ValidationError(f"Status saat ini tidak dapat di-reject: {cur_status}")

    state = await evaluate(entity_type, entity)
    step_idx = state["current_step_idx"] if state["current_step_idx"] is not None else 0
    steps = state["steps"] or []
    step = steps[step_idx] if 0 <= step_idx < len(steps) else {"label": "Reject", "any_of_perms": []}
    required = step.get("any_of_perms") or []
    if not await _user_has_any_perm(user, required):
        raise ForbiddenError(
            f"Anda tidak memiliki permission untuk reject di step '{step.get('label')}'. "
            f"Diperlukan salah satu: {', '.join(required) or '(tidak terdefinisi)'}",
            code="APPROVAL_PERM_MISSING",
        )

    chain = entity.get("approval_chain") or []
    chain.append({
        "level": len(chain) + 1,
        "step_idx": step_idx,
        "step_label": step.get("label"),
        "action": "rejected",
        "approver_id": user["id"],
        "approver_name": user.get("full_name"),
        "at": _now(),
        "note": reason,
    })

    update = {
        "approval_chain": chain,
        "status": "rejected",
        "rejected_reason": reason,
        "updated_at": _now(),
    }
    await db[col].update_one({"id": entity_id}, {"$set": update})
    await audit_log(
        user_id=user["id"], entity_type=entity_type, entity_id=entity_id,
        action="reject_step", reason=reason,
    )

    after = await db[col].find_one({"id": entity_id})
    after_serialized = serialize(after)

    # ---- Notification ----
    try:
        await notify_creator(entity_type, after_serialized, kind="rejected", actor=user, reason=reason)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Reject notification dispatch failed: {e}")

    return {
        "entity": after_serialized,
        "state": await evaluate(entity_type, after_serialized),
    }


# ============================================================
# BUSINESS_RULES CRUD (approval workflows)
# ============================================================

async def create_workflow(payload: dict, *, user: dict) -> dict:
    db = get_db()
    rule_data = payload.get("rule_data") or {}
    if not rule_data.get("entity_type"):
        raise ValidationError("rule_data.entity_type wajib", field="rule_data.entity_type")
    if rule_data["entity_type"] not in ENTITY_COLLECTIONS:
        raise ValidationError(
            f"entity_type tidak didukung. Pilihan: {','.join(ENTITY_COLLECTIONS)}",
            field="rule_data.entity_type",
        )
    tiers = rule_data.get("tiers") or []
    if not tiers:
        raise ValidationError("rule_data.tiers minimal 1", field="rule_data.tiers")
    for t in tiers:
        if not (t.get("steps") or []):
            raise ValidationError("Setiap tier harus punya steps", field="rule_data.tiers")
    # Soft-archive any active workflow for the same entity_type
    await db.business_rules.update_many(
        {
            "rule_type": "approval_workflow",
            "rule_data.entity_type": rule_data["entity_type"],
            "active": True, "deleted_at": None,
        },
        {"$set": {"active": False, "updated_at": _now()}},
    )
    doc = {
        "id": str(uuid.uuid4()),
        "scope_type": payload.get("scope_type", "group"),
        "scope_id": payload.get("scope_id", "*"),
        "rule_type": "approval_workflow",
        "rule_data": rule_data,
        "active": True,
        "version": int(payload.get("version", 1)),
        "effective_from": payload.get("effective_from"),
        "effective_to": payload.get("effective_to"),
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.business_rules.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="business_rule",
                    entity_id=doc["id"], action="create", after=serialize(doc))
    return serialize(doc)


async def update_workflow(rule_id: str, patch: dict, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    update = {k: v for k, v in patch.items() if v is not None}
    update["updated_at"] = _now()
    update["version"] = int(before.get("version", 1)) + 1
    await db.business_rules.update_one({"id": rule_id}, {"$set": update})
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(user_id=user["id"], entity_type="business_rule",
                    entity_id=rule_id, action="update",
                    before=serialize(before), after=serialize(after))
    return serialize(after)


async def delete_workflow(rule_id: str, *, user: dict) -> None:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"deleted_at": _now(), "active": False, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="business_rule",
                    entity_id=rule_id, action="delete", before=serialize(before))


# ============================================================
# DEFAULT WORKFLOWS (used by seed and admin "Reset to default")
# ============================================================

DEFAULT_WORKFLOWS: dict[str, dict] = {
    "purchase_request": {
        "entity_type": "purchase_request",
        "amount_field": None,
        "tiers": [
            {
                "min_amount": 0, "max_amount": 1000000, "label": "Tier 1 (<Rp 1jt)",
                "steps": [
                    {"label": "Procurement", "any_of_perms": ["procurement.pr.approve"]},
                ],
            },
            {
                "min_amount": 1000000, "max_amount": 10000000, "label": "Tier 2 (Rp 1jt – 10jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.pr.approve"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                ],
            },
            {
                "min_amount": 10000000, "max_amount": None, "label": "Tier 3 (>Rp 10jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.pr.approve"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                    {"label": "Executive / GM",      "any_of_perms": ["executive.dashboard.read", "*"]},
                ],
            },
        ],
    },
    "purchase_order": {
        "entity_type": "purchase_order",
        "amount_field": "grand_total",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 5000000, "label": "Tier 1 (<Rp 5jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.po.send", "procurement.po.create"]},
                ],
            },
            {
                "min_amount": 5000000, "max_amount": 50000000, "label": "Tier 2 (Rp 5jt – 50jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.po.send"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                ],
            },
            {
                "min_amount": 50000000, "max_amount": None, "label": "Tier 3 (>Rp 50jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.po.send"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                    {"label": "Executive / GM",      "any_of_perms": ["executive.dashboard.read", "*"]},
                ],
            },
        ],
    },
    "stock_adjustment": {
        "entity_type": "stock_adjustment",
        "amount_field": "total_value",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 500000, "label": "Tier 1 (<Rp 500rb)",
                "steps": [
                    {"label": "Inventory Approver", "any_of_perms": ["inventory.adjustment.approve"]},
                ],
            },
            {
                "min_amount": 500000, "max_amount": None, "label": "Tier 2 (≥Rp 500rb)",
                "steps": [
                    {"label": "Inventory Approver", "any_of_perms": ["inventory.adjustment.approve"]},
                    {"label": "Finance Manager",    "any_of_perms": ["finance.payment.approve"]},
                ],
            },
        ],
    },
}


async def seed_defaults(*, user_id: str = "system", overwrite: bool = False) -> int:
    """Seed default approval workflows. Returns count inserted."""
    db = get_db()
    inserted = 0
    for entity_type, rule_data in DEFAULT_WORKFLOWS.items():
        existing = await db.business_rules.find_one({
            "rule_type": "approval_workflow",
            "rule_data.entity_type": entity_type,
            "deleted_at": None,
        })
        if existing and not overwrite:
            continue
        if existing and overwrite:
            await db.business_rules.update_one(
                {"id": existing["id"]},
                {"$set": {"active": False, "deleted_at": _now(), "updated_at": _now()}},
            )
        doc = {
            "id": str(uuid.uuid4()),
            "scope_type": "group",
            "scope_id": "*",
            "rule_type": "approval_workflow",
            "rule_data": rule_data,
            "active": True,
            "version": 1,
            "effective_from": None,
            "effective_to": None,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user_id,
        }
        await db.business_rules.insert_one(doc)
        inserted += 1
    return inserted
