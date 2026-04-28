"""Business Rules service — generalized CRUD for non-approval rule types.

Phase 7A introduces self-service editors for these rule types:
  - sales_input_schema
  - petty_cash_policy
  - service_charge_policy
  - incentive_policy

The legacy `approval_workflow` rule_type is still owned by `approval_service`
(its own seed/active-archive semantics differ).

All rules share the same `business_rules` collection and base shape:
  {
    id, scope_type, scope_id, rule_type, rule_data,
    active, version,
    effective_from, effective_to,
    created_at, updated_at, deleted_at,
    created_by, updated_by,
  }

This service adds:
  - version auto-increment per (scope_type, scope_id, rule_type)
  - effective-date overlap detection
  - duplicate-as-new-version
  - timeline query (versions ordered by effective_from)
  - light validation per rule_type
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError

logger = logging.getLogger("aurora.business_rules")


SUPPORTED_RULE_TYPES: list[str] = [
    "sales_input_schema",
    "petty_cash_policy",
    "service_charge_policy",
    "incentive_policy",
    "anomaly_threshold_policy",
]

# Rule types managed by THIS service (excludes approval_workflow which has its own service)
RULE_TYPE_LABELS: dict[str, str] = {
    "sales_input_schema": "Skema Penjualan",
    "petty_cash_policy": "Kebijakan Kas Kecil",
    "service_charge_policy": "Service Charge",
    "incentive_policy": "Skema Insentif",
    "anomaly_threshold_policy": "Threshold Deteksi Anomali",
}

VALID_SCOPE_TYPES: tuple[str, ...] = ("group", "brand", "outlet")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# VALIDATION
# ============================================================


def _validate_scope(scope_type: str, scope_id: str) -> None:
    if scope_type not in VALID_SCOPE_TYPES:
        raise ValidationError(
            f"scope_type tidak valid. Pilihan: {', '.join(VALID_SCOPE_TYPES)}",
            field="scope_type",
        )
    if not scope_id:
        raise ValidationError("scope_id wajib", field="scope_id")


def _validate_rule_type(rule_type: str) -> None:
    if rule_type not in SUPPORTED_RULE_TYPES:
        raise ValidationError(
            f"rule_type tidak didukung. Pilihan: {', '.join(SUPPORTED_RULE_TYPES)}",
            field="rule_type",
        )


def _validate_dates(effective_from: Optional[str], effective_to: Optional[str]) -> None:
    if effective_from and effective_to and effective_from > effective_to:
        raise ValidationError(
            "effective_from tidak boleh lebih besar dari effective_to",
            field="effective_to",
        )


def _validate_rule_data(rule_type: str, rule_data: dict) -> None:
    """Rule-type specific light validation. Editors enforce most constraints
    on the FE; backend keeps these guard rails minimal so payloads stay flexible.
    """
    if not isinstance(rule_data, dict):
        raise ValidationError("rule_data harus berupa object", field="rule_data")

    if rule_type == "sales_input_schema":
        # channels required (array of {code,name,active?})
        channels = rule_data.get("channels", [])
        if not isinstance(channels, list):
            raise ValidationError("rule_data.channels harus berupa list", field="rule_data.channels")
        for i, c in enumerate(channels):
            if not isinstance(c, dict) or not c.get("code"):
                raise ValidationError(
                    f"channels[{i}].code wajib", field=f"rule_data.channels[{i}].code"
                )
        payment_methods = rule_data.get("payment_methods", [])
        if not isinstance(payment_methods, list):
            raise ValidationError(
                "rule_data.payment_methods harus berupa list", field="rule_data.payment_methods"
            )
        revenue_buckets = rule_data.get("revenue_buckets", [])
        if not isinstance(revenue_buckets, list):
            raise ValidationError(
                "rule_data.revenue_buckets harus berupa list", field="rule_data.revenue_buckets"
            )

    elif rule_type == "petty_cash_policy":
        for f in ("monthly_limit", "max_per_txn", "approval_threshold"):
            v = rule_data.get(f)
            if v is None:
                continue
            try:
                v_num = float(v)
            except (TypeError, ValueError):
                raise ValidationError(f"{f} harus angka", field=f"rule_data.{f}")
            if v_num < 0:
                raise ValidationError(f"{f} tidak boleh negatif", field=f"rule_data.{f}")
        freq = rule_data.get("replenish_frequency")
        if freq is not None and freq not in ("daily", "weekly", "monthly", "manual"):
            raise ValidationError(
                "replenish_frequency tidak valid (daily|weekly|monthly|manual)",
                field="rule_data.replenish_frequency",
            )

    elif rule_type == "service_charge_policy":
        for f in ("service_charge_pct", "lb_pct", "ld_pct"):
            v = rule_data.get(f)
            if v is None:
                continue
            try:
                v_num = float(v)
            except (TypeError, ValueError):
                raise ValidationError(f"{f} harus angka", field=f"rule_data.{f}")
            if v_num < 0 or v_num > 1:
                raise ValidationError(
                    f"{f} harus di rentang 0..1 (rasio, bukan persen)",
                    field=f"rule_data.{f}",
                )
        method = rule_data.get("allocation_method")
        if method is not None and method not in (
            "by_days_worked",
            "equal",
            "by_role_multiplier",
        ):
            raise ValidationError(
                "allocation_method tidak valid (by_days_worked|equal|by_role_multiplier)",
                field="rule_data.allocation_method",
            )
        # Sum sanity
        sc = float(rule_data.get("service_charge_pct") or 0)
        lb = float(rule_data.get("lb_pct") or 0)
        ld = float(rule_data.get("ld_pct") or 0)
        if (lb + ld) > sc and sc > 0:
            # Not blocking, but log a warning hint via field metadata: keep as soft validation.
            # Editors will surface a UI warning.
            pass

    elif rule_type == "incentive_policy":
        rt = rule_data.get("rule_type")
        if rt not in (None, "pct_of_sales", "flat_per_target", "tiered_sales"):
            raise ValidationError(
                "rule_data.rule_type tidak valid (pct_of_sales|flat_per_target|tiered_sales)",
                field="rule_data.rule_type",
            )
        if rt == "tiered_sales":
            tiers = rule_data.get("tiers") or []
            if not isinstance(tiers, list) or not tiers:
                raise ValidationError(
                    "tiered_sales harus punya minimal 1 tier", field="rule_data.tiers"
                )
            for i, t in enumerate(tiers):
                if not isinstance(t, dict):
                    raise ValidationError(
                        f"tiers[{i}] harus object", field=f"rule_data.tiers[{i}]"
                    )

    elif rule_type == "anomaly_threshold_policy":
        # Each sub-detector is optional but if present must be well-formed.
        # Allowed keys: sales_deviation, vendor_price_spike, vendor_leadtime, ap_cash_spike.
        valid_keys = {"sales_deviation", "vendor_price_spike", "vendor_leadtime", "ap_cash_spike"}
        for k, v in rule_data.items():
            if k not in valid_keys:
                # Tolerate unknown keys (forward compatibility) but warn in logs.
                logger.warning("Unknown anomaly_threshold_policy key: %s", k)
                continue
            if not isinstance(v, dict):
                raise ValidationError(
                    f"{k} harus berupa object", field=f"rule_data.{k}"
                )
            # Numeric guards (negative/huge rejected)
            for nf in ("sigma_mild", "sigma_severe", "pct_mild", "pct_severe",
                       "days_mild", "days_severe", "window_days", "min_points",
                       "rolling_window_days"):
                val = v.get(nf)
                if val is None:
                    continue
                try:
                    num = float(val)
                except (TypeError, ValueError):
                    raise ValidationError(
                        f"{k}.{nf} harus angka", field=f"rule_data.{k}.{nf}"
                    )
                if num < 0:
                    raise ValidationError(
                        f"{k}.{nf} tidak boleh negatif", field=f"rule_data.{k}.{nf}"
                    )
                if nf.startswith("window") and num > 365:
                    raise ValidationError(
                        f"{k}.{nf} maksimal 365", field=f"rule_data.{k}.{nf}"
                    )


# ============================================================
# OVERLAP DETECTION
# ============================================================


def _ranges_overlap(
    a_from: Optional[str],
    a_to: Optional[str],
    b_from: Optional[str],
    b_to: Optional[str],
) -> bool:
    """Treat None on a_from as -inf, None on a_to as +inf (same for b)."""
    a1 = a_from or "0000-01-01"
    a2 = a_to or "9999-12-31"
    b1 = b_from or "0000-01-01"
    b2 = b_to or "9999-12-31"
    return a1 <= b2 and b1 <= a2


async def detect_overlaps(
    *,
    rule_type: str,
    scope_type: str,
    scope_id: str,
    effective_from: Optional[str],
    effective_to: Optional[str],
    exclude_id: Optional[str] = None,
) -> list[dict]:
    """Return list of existing rules that overlap with the given range."""
    db = get_db()
    q: dict = {
        "deleted_at": None,
        "active": True,
        "rule_type": rule_type,
        "scope_type": scope_type,
        "scope_id": scope_id,
    }
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    docs = await db.business_rules.find(q).to_list(200)
    return [
        serialize(d)
        for d in docs
        if _ranges_overlap(effective_from, effective_to, d.get("effective_from"), d.get("effective_to"))
    ]


# ============================================================
# READ / LIST / TIMELINE
# ============================================================


async def list_rules(
    *,
    rule_type: Optional[str] = None,
    scope_type: Optional[str] = None,
    scope_id: Optional[str] = None,
    active: Optional[bool] = None,
    effective_on: Optional[str] = None,
) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if rule_type:
        q["rule_type"] = rule_type
    if scope_type:
        q["scope_type"] = scope_type
    if scope_id:
        q["scope_id"] = scope_id
    if active is not None:
        q["active"] = bool(active)
    items = await db.business_rules.find(q).sort(
        [("scope_type", 1), ("scope_id", 1), ("rule_type", 1), ("version", -1)]
    ).to_list(500)
    out = [serialize(d) for d in items]
    if effective_on:
        out = [
            r
            for r in out
            if (not r.get("effective_from") or r["effective_from"] <= effective_on)
            and (not r.get("effective_to") or r["effective_to"] >= effective_on)
        ]
    return out


async def get_rule(rule_id: str) -> dict:
    db = get_db()
    doc = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Rule")
    return serialize(doc)


async def get_active_rule(
    *,
    rule_type: str,
    scope_type: str,
    scope_id: str,
    on_date: Optional[str] = None,
) -> Optional[dict]:
    """Return the currently effective rule for a (scope, rule_type), or None.
    Used by services that consume rules at runtime (e.g., service charge calc).
    """
    db = get_db()
    on_date = on_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q: dict = {
        "deleted_at": None,
        "active": True,
        "rule_type": rule_type,
        "scope_type": scope_type,
        "scope_id": scope_id,
    }
    docs = await db.business_rules.find(q).sort([("version", -1)]).to_list(50)
    for d in docs:
        if (not d.get("effective_from") or d["effective_from"] <= on_date) and (
            not d.get("effective_to") or d["effective_to"] >= on_date
        ):
            return serialize(d)
    return None


async def resolve_rule(
    *,
    rule_type: str,
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    on_date: Optional[str] = None,
) -> Optional[dict]:
    """Walk scope hierarchy outlet → brand → group and return the active rule.
    """
    if outlet_id:
        r = await get_active_rule(
            rule_type=rule_type, scope_type="outlet", scope_id=outlet_id, on_date=on_date
        )
        if r:
            return r
    if brand_id:
        r = await get_active_rule(
            rule_type=rule_type, scope_type="brand", scope_id=brand_id, on_date=on_date
        )
        if r:
            return r
    # Group fallback (scope_id="*" by convention)
    r = await get_active_rule(
        rule_type=rule_type, scope_type="group", scope_id="*", on_date=on_date
    )
    return r


async def get_timeline(
    *,
    rule_type: Optional[str] = None,
    scope_type: Optional[str] = None,
    scope_id: Optional[str] = None,
) -> list[dict]:
    """Return all versions of rules grouped by (scope, rule_type) for timeline UI.
    Each entry is enriched with `overlaps_with: [rule_id, ...]` when active ranges collide.
    """
    rows = await list_rules(
        rule_type=rule_type, scope_type=scope_type, scope_id=scope_id
    )
    # Compute overlaps among active rows of same (scope_type, scope_id, rule_type)
    by_key: dict[tuple, list[dict]] = {}
    for r in rows:
        if not r.get("active"):
            continue
        key = (r["rule_type"], r.get("scope_type"), r.get("scope_id"))
        by_key.setdefault(key, []).append(r)

    overlaps_map: dict[str, list[str]] = {}
    for arr in by_key.values():
        for i, a in enumerate(arr):
            for j in range(i + 1, len(arr)):
                b = arr[j]
                if _ranges_overlap(
                    a.get("effective_from"),
                    a.get("effective_to"),
                    b.get("effective_from"),
                    b.get("effective_to"),
                ):
                    overlaps_map.setdefault(a["id"], []).append(b["id"])
                    overlaps_map.setdefault(b["id"], []).append(a["id"])
    for r in rows:
        r["overlaps_with"] = overlaps_map.get(r["id"], [])
    return rows


# ============================================================
# CREATE / UPDATE / DUPLICATE / ARCHIVE
# ============================================================


async def _next_version(*, scope_type: str, scope_id: str, rule_type: str) -> int:
    db = get_db()
    doc = await db.business_rules.find_one(
        {
            "deleted_at": None,
            "scope_type": scope_type,
            "scope_id": scope_id,
            "rule_type": rule_type,
        },
        sort=[("version", -1)],
    )
    return int((doc or {}).get("version", 0)) + 1


async def create_rule(payload: dict, *, user: dict) -> dict:
    db = get_db()
    rule_type = payload.get("rule_type")
    scope_type = payload.get("scope_type") or "group"
    scope_id = payload.get("scope_id") or "*"
    rule_data = payload.get("rule_data") or {}
    effective_from = payload.get("effective_from")
    effective_to = payload.get("effective_to")
    active = payload.get("active", True)

    _validate_rule_type(rule_type)
    _validate_scope(scope_type, scope_id)
    _validate_dates(effective_from, effective_to)
    _validate_rule_data(rule_type, rule_data)

    version = int(payload.get("version") or await _next_version(
        scope_type=scope_type, scope_id=scope_id, rule_type=rule_type
    ))

    overlaps: list[dict] = []
    if active:
        overlaps = await detect_overlaps(
            rule_type=rule_type,
            scope_type=scope_type,
            scope_id=scope_id,
            effective_from=effective_from,
            effective_to=effective_to,
        )

    doc = {
        "id": str(uuid.uuid4()),
        "scope_type": scope_type,
        "scope_id": scope_id,
        "rule_type": rule_type,
        "rule_data": rule_data,
        "active": bool(active),
        "version": version,
        "effective_from": effective_from,
        "effective_to": effective_to,
        "name": payload.get("name") or RULE_TYPE_LABELS.get(rule_type, rule_type),
        "description": payload.get("description"),
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
        "created_by": user["id"],
        "updated_by": user["id"],
    }
    await db.business_rules.insert_one(doc)
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=doc["id"],
        action="create",
        after=serialize(doc),
    )
    out = serialize(doc)
    out["overlaps_with"] = [o["id"] for o in overlaps]
    return out


async def update_rule(rule_id: str, patch: dict, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")

    rule_type = patch.get("rule_type", before.get("rule_type"))
    _validate_rule_type(rule_type)

    scope_type = patch.get("scope_type", before.get("scope_type"))
    scope_id = patch.get("scope_id", before.get("scope_id"))
    _validate_scope(scope_type, scope_id)

    effective_from = patch.get("effective_from", before.get("effective_from"))
    effective_to = patch.get("effective_to", before.get("effective_to"))
    _validate_dates(effective_from, effective_to)

    rule_data = patch.get("rule_data", before.get("rule_data") or {})
    _validate_rule_data(rule_type, rule_data)

    update: dict[str, Any] = {
        "scope_type": scope_type,
        "scope_id": scope_id,
        "rule_type": rule_type,
        "rule_data": rule_data,
        "active": bool(patch.get("active", before.get("active", True))),
        "effective_from": effective_from,
        "effective_to": effective_to,
        "updated_at": _now(),
        "updated_by": user["id"],
    }
    if "name" in patch:
        update["name"] = patch["name"]
    if "description" in patch:
        update["description"] = patch["description"]

    await db.business_rules.update_one({"id": rule_id}, {"$set": update})
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="update",
        before=serialize(before),
        after=serialize(after),
    )
    out = serialize(after)
    if out.get("active"):
        overlaps = await detect_overlaps(
            rule_type=rule_type,
            scope_type=scope_type,
            scope_id=scope_id,
            effective_from=effective_from,
            effective_to=effective_to,
            exclude_id=rule_id,
        )
        out["overlaps_with"] = [o["id"] for o in overlaps]
    return out


async def duplicate_rule(rule_id: str, overrides: dict, *, user: dict) -> dict:
    """Create a new draft version cloned from an existing rule.
    Caller can override scope, effective dates, or rule_data. By default new copy
    starts as active=False (draft) so it can be reviewed before scheduling.
    """
    src = await get_rule(rule_id)
    payload = {
        "rule_type": overrides.get("rule_type", src["rule_type"]),
        "scope_type": overrides.get("scope_type", src.get("scope_type")),
        "scope_id": overrides.get("scope_id", src.get("scope_id")),
        "rule_data": overrides.get("rule_data", src.get("rule_data") or {}),
        "effective_from": overrides.get("effective_from"),
        "effective_to": overrides.get("effective_to"),
        "active": bool(overrides.get("active", False)),
        "name": overrides.get("name") or (src.get("name") or "") + " (Salinan)",
        "description": overrides.get("description") or src.get("description"),
    }
    return await create_rule(payload, user=user)


async def archive_rule(rule_id: str, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"active": False, "updated_at": _now(), "updated_by": user["id"]}},
    )
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="archive",
        before=serialize(before),
        after=serialize(after),
    )
    return serialize(after)


async def activate_rule(rule_id: str, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"active": True, "updated_at": _now(), "updated_by": user["id"]}},
    )
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="activate",
        before=serialize(before),
        after=serialize(after),
    )
    out = serialize(after)
    overlaps = await detect_overlaps(
        rule_type=after["rule_type"],
        scope_type=after.get("scope_type"),
        scope_id=after.get("scope_id"),
        effective_from=after.get("effective_from"),
        effective_to=after.get("effective_to"),
        exclude_id=rule_id,
    )
    out["overlaps_with"] = [o["id"] for o in overlaps]
    return out


async def delete_rule(rule_id: str, *, user: dict) -> None:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"deleted_at": _now(), "active": False, "updated_at": _now()}},
    )
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="delete",
        before=serialize(before),
    )


# ============================================================
# DEFAULT SEEDS — used by Admin "Seed Defaults" button
# ============================================================

DEFAULT_RULES: dict[str, dict] = {
    "sales_input_schema": {
        "name": "Skema Penjualan Standar",
        "description": "Channel, metode pembayaran, dan bucket pendapatan default untuk outlet F&B.",
        "rule_data": {
            "channels": [
                {"code": "DINEIN", "name": "Dine-in", "active": True},
                {"code": "TAKEAWAY", "name": "Takeaway", "active": True},
                {"code": "GOFOOD", "name": "GoFood", "active": True},
                {"code": "GRABFOOD", "name": "GrabFood", "active": True},
                {"code": "SHOPEEFOOD", "name": "ShopeeFood", "active": False},
            ],
            "payment_methods": [
                {"code": "CASH", "name": "Cash", "active": True},
                {"code": "DEBIT", "name": "Debit Card", "active": True},
                {"code": "CREDIT", "name": "Credit Card", "active": True},
                {"code": "QRIS", "name": "QRIS", "active": True},
                {"code": "GOPAY", "name": "GoPay", "active": True},
                {"code": "OVO", "name": "OVO", "active": False},
            ],
            "revenue_buckets": [
                {"code": "FOOD", "name": "Food", "required": True},
                {"code": "BEVERAGE", "name": "Beverage", "required": True},
                {"code": "BAR", "name": "Bar", "required": False},
                {"code": "OTHER", "name": "Other", "required": False},
            ],
            "validation_rules": [
                {"id": "payment_total_match", "label": "Total pembayaran harus sama dengan grand total", "severity": "error", "active": True},
                {"id": "transaction_count_positive", "label": "Jumlah transaksi harus > 0", "severity": "warning", "active": True},
            ],
        },
    },
    "petty_cash_policy": {
        "name": "Kebijakan Kas Kecil Standar",
        "description": "Limit, threshold approval, dan akun GL yang diizinkan.",
        "rule_data": {
            "monthly_limit": 5_000_000,
            "max_per_txn": 500_000,
            "approval_threshold": 250_000,
            "replenish_frequency": "weekly",
            "allowed_gl_accounts": [],
            "require_receipt": True,
        },
    },
    "service_charge_policy": {
        "name": "Service Charge Standar",
        "description": "5% service charge dengan potongan L&B 1%, alokasi by days worked.",
        "rule_data": {
            "service_charge_pct": 0.05,
            "lb_pct": 0.01,
            "ld_pct": 0.0,
            "allocation_method": "by_days_worked",
            "default_working_days": 22,
        },
    },
    "incentive_policy": {
        "name": "Skema Insentif Standar",
        "description": "Insentif % dari penjualan dengan target bulanan.",
        "rule_data": {
            "rule_type": "pct_of_sales",
            "target_amount": 100_000_000,
            "incentive_pct": 0.01,
            "eligibility": {
                "roles": [],
                "min_days_worked": 22,
                "exclude_probation": True,
            },
            "tiers": [],
        },
    },
    "anomaly_threshold_policy": {
        "name": "Threshold Deteksi Anomali Standar",
        "description": "Default thresholds untuk deteksi anomali real-time (sales, vendor, AP/cash).",
        "rule_data": {
            "sales_deviation": {
                "enabled": True,
                "sigma_mild": 1.5,
                "sigma_severe": 2.5,
                "window_days": 14,
                "min_points": 7,
            },
            "vendor_price_spike": {
                "enabled": True,
                "pct_mild": 15,
                "pct_severe": 30,
                "window_days": 90,
            },
            "vendor_leadtime": {
                "enabled": True,
                "days_mild": 3,
                "days_severe": 7,
                "window_days": 90,
            },
            "ap_cash_spike": {
                "enabled": True,
                "pct_mild": 15,
                "pct_severe": 30,
            },
        },
    },
}


async def seed_defaults(*, user: dict, overwrite: bool = False) -> int:
    """Insert one default rule per supported rule_type at scope=group/* if missing.
    Returns the number of rules inserted.
    """
    db = get_db()
    inserted = 0
    for rt, tpl in DEFAULT_RULES.items():
        existing = await db.business_rules.find_one(
            {
                "deleted_at": None,
                "rule_type": rt,
                "scope_type": "group",
                "scope_id": "*",
            }
        )
        if existing and not overwrite:
            continue
        if existing and overwrite:
            await db.business_rules.update_one(
                {"id": existing["id"]},
                {"$set": {"active": False, "updated_at": _now()}},
            )
        await create_rule(
            {
                "rule_type": rt,
                "scope_type": "group",
                "scope_id": "*",
                "rule_data": tpl["rule_data"],
                "name": tpl["name"],
                "description": tpl["description"],
                "active": True,
                "effective_from": None,
                "effective_to": None,
            },
            user=user,
        )
        inserted += 1
    return inserted
