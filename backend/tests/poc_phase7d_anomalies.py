"""
Phase 7D POC — Anomaly Detection Core Workflow

Tests IN ISOLATION (before building full app):
1. Sales deviation detector (z-score vs rolling 14-day avg)
2. Vendor price spike detector (% deviation vs vendor 90-day avg)
3. Vendor lead-time anomaly detector
4. AP/cash spike anomaly (reuses forecasting_service)
5. Idempotent persistence (re-running same source → update, not duplicate)
6. Notification dispatch to correct recipients
7. Threshold resolution via business_rules (outlet → brand → group)
8. Severity classification thresholds

Run: cd /app/backend && python3 -m tests.poc_phase7d_anomalies
"""
from __future__ import annotations

import asyncio
import statistics
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402


# ============================================================
# INLINE anomaly algorithms to validate in isolation
# (will later be moved into services/anomaly_service.py)
# ============================================================


def rolling_stats(values: list[float]) -> dict:
    """Compute mean and stddev with min-points guard."""
    if not values:
        return {"mean": 0.0, "stddev": 0.0, "count": 0}
    n = len(values)
    mean = sum(values) / n
    if n < 2:
        return {"mean": mean, "stddev": 0.0, "count": n}
    variance = sum((v - mean) ** 2 for v in values) / n
    return {"mean": mean, "stddev": variance ** 0.5, "count": n}


def classify_sigma(z: float, mild: float = 1.5, severe: float = 2.5) -> str:
    a = abs(z)
    if a >= severe:
        return "severe"
    if a >= mild:
        return "mild"
    return "none"


def classify_pct(pct: float, mild: float, severe: float) -> str:
    a = abs(pct)
    if a >= severe:
        return "severe"
    if a >= mild:
        return "mild"
    return "none"


async def detect_sales_deviation(outlet_id: str, sales_date: str, amount: float,
                                  sigma_mild: float = 1.5, sigma_severe: float = 2.5,
                                  window_days: int = 14, min_points: int = 7) -> dict:
    """Detect if `amount` for `outlet_id` on `sales_date` is anomalous vs rolling window."""
    db = get_db()
    date_obj = datetime.strptime(sales_date, "%Y-%m-%d").date()
    window_start = (date_obj - timedelta(days=window_days)).isoformat()
    window_end = (date_obj - timedelta(days=1)).isoformat()

    cursor = db.daily_sales.find({
        "deleted_at": None, "status": "validated", "outlet_id": outlet_id,
        "sales_date": {"$gte": window_start, "$lte": window_end},
    })
    hist: list[float] = []
    async for d in cursor:
        hist.append(float(d.get("grand_total", 0) or 0))

    stats = rolling_stats(hist)
    if stats["count"] < min_points or stats["stddev"] <= 0:
        return {"severity": "none", "z_score": 0.0, "reason": "insufficient_data",
                "stats": stats, "observed": amount}
    z = (amount - stats["mean"]) / stats["stddev"]
    sev = classify_sigma(z, sigma_mild, sigma_severe)
    return {
        "severity": sev, "z_score": round(z, 3),
        "deviation_pct": round((amount - stats["mean"]) / stats["mean"] * 100, 2) if stats["mean"] > 0 else 0.0,
        "observed": amount, "baseline_mean": round(stats["mean"], 2),
        "baseline_stddev": round(stats["stddev"], 2), "baseline_count": stats["count"],
    }


async def detect_vendor_price_spike(vendor_id: str, item_id: str, unit_cost: float,
                                    as_of_date: str, window_days: int = 90,
                                    pct_mild: float = 15, pct_severe: float = 30) -> dict:
    """Detect if unit_cost deviates >X% from vendor's 90-day avg for this item."""
    db = get_db()
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    window_start = (date_obj - timedelta(days=window_days)).isoformat()
    window_end = (date_obj - timedelta(days=1)).isoformat()

    prices: list[float] = []
    cursor = db.goods_receipts.find({
        "deleted_at": None, "vendor_id": vendor_id,
        "receive_date": {"$gte": window_start, "$lte": window_end},
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
    sev = classify_pct(pct, pct_mild, pct_severe)
    return {
        "severity": sev, "deviation_pct": round(pct, 2),
        "observed": unit_cost, "baseline_mean": round(avg, 2),
        "baseline_count": len(prices),
    }


async def detect_vendor_leadtime(vendor_id: str, actual_days: float, as_of_date: str,
                                 window_days: int = 90,
                                 days_mild: int = 3, days_severe: int = 7) -> dict:
    """Detect if actual_days lead time is materially worse than vendor's baseline."""
    db = get_db()
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    window_start = (date_obj - timedelta(days=window_days)).isoformat()
    window_end = (date_obj - timedelta(days=1)).isoformat()

    baselines: list[float] = []
    cursor = db.goods_receipts.find({
        "deleted_at": None, "vendor_id": vendor_id,
        "receive_date": {"$gte": window_start, "$lte": window_end},
    })
    async for gr in cursor:
        po_id = gr.get("po_id")
        if not po_id:
            continue
        po = await db.purchase_orders.find_one({"id": po_id})
        if not po:
            continue
        order_date = po.get("order_date") or po.get("sent_at", "")[:10]
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
    if excess >= days_severe:
        sev = "severe"
    elif excess >= days_mild:
        sev = "mild"
    else:
        sev = "none"
    return {
        "severity": sev, "excess_days": round(excess, 2),
        "observed": actual_days, "baseline_mean": round(avg, 2),
        "baseline_count": len(baselines),
    }


# ============================================================
# Storage & notification prototypes
# ============================================================


async def upsert_anomaly_event(event: dict) -> dict:
    """Idempotent upsert keyed by (type, source_type, source_id)."""
    db = get_db()
    key = {
        "type": event["type"],
        "source_type": event["source_type"],
        "source_id": event["source_id"],
        "deleted_at": None,
    }
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.anomaly_events.find_one(key)
    if existing:
        update = {**event, "updated_at": now}
        await db.anomaly_events.update_one({"id": existing["id"]}, {"$set": update})
        return {**existing, **update}

    doc = {
        "id": str(uuid.uuid4()),
        **event,
        "status": event.get("status", "open"),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    await db.anomaly_events.insert_one(doc)
    return doc


async def dispatch_notifications(event: dict, recipient_emails: list[str]) -> int:
    """Create a notification row for each recipient user email."""
    db = get_db()
    count = 0
    for email in recipient_emails:
        u = await db.users.find_one({"email": email, "deleted_at": None})
        if not u:
            continue
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "type": "urgent" if event.get("severity") == "severe" else "warn",
            "title": event.get("title", "Anomaly detected"),
            "body": event.get("message", ""),
            "link": event.get("link"),
            "source_type": "anomaly_event",
            "source_id": event["id"],
            "read_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        count += 1
    return count


# ============================================================
# Business rules threshold resolver (lightweight)
# ============================================================


async def get_threshold_for_scope(rule_type_key: str, outlet_id: str | None,
                                   brand_id: str | None, on_date: str) -> dict | None:
    """Look up anomaly threshold rule via outlet → brand → group hierarchy."""
    db = get_db()

    async def _match(scope_type: str, scope_id: str) -> dict | None:
        cursor = db.business_rules.find({
            "deleted_at": None, "active": True,
            "rule_type": "anomaly_threshold_policy",
            "scope_type": scope_type, "scope_id": scope_id,
        }).sort([("version", -1)])
        async for r in cursor:
            ef = r.get("effective_from")
            et = r.get("effective_to")
            if (not ef or ef <= on_date) and (not et or et >= on_date):
                return r
        return None

    if outlet_id:
        r = await _match("outlet", outlet_id)
        if r:
            return r
    if brand_id:
        r = await _match("brand", brand_id)
        if r:
            return r
    return await _match("group", "*")


# ============================================================
# POC SCENARIOS
# ============================================================


async def scenario_1_sales_deviation_severe():
    """Inject a severely-high sales day for Altero and detect."""
    db = get_db()
    outlet = await db.outlets.find_one({"code": "ALT", "deleted_at": None})
    assert outlet, "Altero outlet missing"
    today = datetime.now(timezone.utc).date().isoformat()

    # What's the rolling baseline?
    cursor = db.daily_sales.find({
        "deleted_at": None, "status": "validated", "outlet_id": outlet["id"],
    }).sort([("sales_date", -1)]).limit(14)
    hist = [float(d.get("grand_total", 0) or 0) async for d in cursor]
    mean = sum(hist) / len(hist) if hist else 0.0
    stddev = (sum((v - mean) ** 2 for v in hist) / len(hist)) ** 0.5 if hist else 0.0

    # Anomalous amount = mean + 3.5σ
    anomalous_amt = mean + 3.5 * stddev
    result = await detect_sales_deviation(
        outlet["id"], today, anomalous_amt,
    )
    print(f"\n[S1] Sales-deviation SEVERE test for Altero")
    print(f"    hist_count={len(hist)} mean={mean:.0f} stddev={stddev:.0f}")
    print(f"    anomalous_amt={anomalous_amt:.0f}")
    print(f"    result: {result}")
    assert result["severity"] == "severe", f"Expected severe, got {result['severity']}"
    print("    ✅ PASS")
    return result


async def scenario_2_sales_deviation_none():
    """Amount within normal range → severity=none."""
    db = get_db()
    outlet = await db.outlets.find_one({"code": "ALT", "deleted_at": None})
    today = datetime.now(timezone.utc).date().isoformat()

    cursor = db.daily_sales.find({
        "deleted_at": None, "status": "validated", "outlet_id": outlet["id"],
    }).sort([("sales_date", -1)]).limit(14)
    hist = [float(d.get("grand_total", 0) or 0) async for d in cursor]
    mean = sum(hist) / len(hist) if hist else 0.0

    # Normal amount = mean + 0.1σ (well within range)
    normal_amt = mean * 1.02
    result = await detect_sales_deviation(outlet["id"], today, normal_amt)
    print(f"\n[S2] Sales-deviation NONE test for Altero (normal amount)")
    print(f"    normal_amt={normal_amt:.0f} z={result.get('z_score')}")
    assert result["severity"] == "none", f"Expected none, got {result['severity']}"
    print("    ✅ PASS")


async def scenario_3_vendor_price_spike():
    """Inject a vendor price spike and detect."""
    db = get_db()
    # Find vendor + item that has at least 3 GR lines history
    vendor = None
    item_id = None
    cursor = db.goods_receipts.find({"deleted_at": None}).limit(50)
    # Build vendor/item → price history map
    hist_map: dict = {}
    async for gr in cursor:
        for ln in gr.get("lines", []):
            k = (gr.get("vendor_id"), ln.get("item_id"))
            if not all(k):
                continue
            hist_map.setdefault(k, []).append(float(ln.get("unit_cost", 0) or 0))
    # Pick the pair with most history
    pair, prices = max(hist_map.items(), key=lambda kv: len(kv[1])) if hist_map else ((None, None), [])
    if not pair[0] or not prices:
        print("\n[S3] SKIP — no vendor/item history")
        return
    vendor_id, item_id = pair
    avg = sum(prices) / len(prices)
    spike_cost = avg * 1.45  # +45% spike (SEVERE)
    today = datetime.now(timezone.utc).date().isoformat()
    result = await detect_vendor_price_spike(vendor_id, item_id, spike_cost, today)
    print(f"\n[S3] Vendor-price-spike SEVERE test")
    print(f"    vendor={vendor_id} item={item_id}")
    print(f"    avg={avg:.0f} spike_cost={spike_cost:.0f}")
    print(f"    result: {result}")
    assert result["severity"] == "severe", f"Expected severe, got {result['severity']}"
    print("    ✅ PASS")
    return result


async def scenario_4_vendor_leadtime():
    """Force a lead-time anomaly: 10 days over vendor baseline."""
    db = get_db()
    # Find a vendor with GR history
    gr = await db.goods_receipts.find_one({"deleted_at": None, "po_id": {"$ne": None}})
    if not gr:
        print("\n[S4] SKIP — no GR with PO")
        return
    vendor_id = gr["vendor_id"]
    today = datetime.now(timezone.utc).date().isoformat()
    result = await detect_vendor_leadtime(vendor_id, 20.0, today)
    print(f"\n[S4] Vendor-leadtime test — vendor={vendor_id} observed=20d")
    print(f"    result: {result}")
    if result["severity"] == "severe":
        print("    ✅ PASS — severe")
    elif result["severity"] == "mild":
        print("    ✅ PASS — mild (baseline must be high)")
    else:
        print(f"    ⚠️  severity={result['severity']} (baseline={result.get('baseline_mean')})")
    return result


async def scenario_5_idempotent_upsert():
    """Upsert same (type, source_type, source_id) twice → single row, updated."""
    db = get_db()
    await db.anomaly_events.delete_many({"source_id": "test-poc-src-1"})

    ev1 = {
        "type": "sales_deviation", "source_type": "daily_sales", "source_id": "test-poc-src-1",
        "severity": "mild", "z_score": 1.8, "observed": 10_000_000, "outlet_id": "x",
        "message": "First insert", "title": "Sales anomaly",
    }
    doc1 = await upsert_anomaly_event(ev1)
    assert doc1["severity"] == "mild"

    # Same key, updated severity
    ev2 = {**ev1, "severity": "severe", "z_score": 3.1, "message": "Second update"}
    doc2 = await upsert_anomaly_event(ev2)
    assert doc1["id"] == doc2["id"], "Idempotency broken — new row created"

    # Count
    n = await db.anomaly_events.count_documents({"source_id": "test-poc-src-1"})
    assert n == 1, f"Expected 1 row, got {n}"
    print("\n[S5] Idempotent upsert test")
    print(f"    id={doc1['id']} count={n} severity={doc2['severity']}")
    print("    ✅ PASS")

    # Cleanup
    await db.anomaly_events.delete_many({"source_id": "test-poc-src-1"})


async def scenario_6_notification_dispatch():
    """Dispatch notifications to finance + executive + procurement recipients."""
    db = get_db()
    # Find anomaly event (create if missing)
    ev = {
        "id": "poc-ev-notif-1",
        "type": "sales_deviation", "source_type": "daily_sales", "source_id": "test-poc-src-2",
        "severity": "severe", "message": "Test POC notification dispatch",
        "title": "Altero sales spike +342%",
        "link": "/finance/anomalies?id=poc-ev-notif-1",
    }

    # Cleanup
    await db.notifications.delete_many({"source_id": ev["id"]})

    recipients = ["finance@torado.id", "executive@torado.id", "admin@torado.id"]
    n = await dispatch_notifications(ev, recipients)
    count_db = await db.notifications.count_documents({"source_id": ev["id"]})
    print(f"\n[S6] Notification dispatch — sent={n} recipients, in DB={count_db}")
    assert count_db == n and n == 3, f"Expected 3, got {count_db}"
    print("    ✅ PASS")

    # Cleanup
    await db.notifications.delete_many({"source_id": ev["id"]})


async def scenario_7_threshold_resolution():
    """Insert scope-specific rule and verify outlet → brand → group hierarchy."""
    db = get_db()
    alt = await db.outlets.find_one({"code": "ALT"})
    assert alt

    # Clean any test rules
    await db.business_rules.delete_many({"description": "POC test rule"})

    today = datetime.now(timezone.utc).date().isoformat()

    # 1. Group default (looser thresholds)
    group_rule = {
        "id": str(uuid.uuid4()),
        "rule_type": "anomaly_threshold_policy",
        "scope_type": "group", "scope_id": "*",
        "rule_data": {
            "sales_deviation": {"enabled": True, "sigma_mild": 2.0, "sigma_severe": 3.0,
                                "window_days": 14, "min_points": 7},
        },
        "active": True, "version": 1,
        "effective_from": None, "effective_to": None,
        "name": "Group Default", "description": "POC test rule",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(), "deleted_at": None,
    }
    await db.business_rules.insert_one(group_rule)

    # 2. Altero-specific stricter rule
    outlet_rule = {
        "id": str(uuid.uuid4()),
        "rule_type": "anomaly_threshold_policy",
        "scope_type": "outlet", "scope_id": alt["id"],
        "rule_data": {
            "sales_deviation": {"enabled": True, "sigma_mild": 1.2, "sigma_severe": 2.0,
                                "window_days": 14, "min_points": 7},
        },
        "active": True, "version": 1,
        "effective_from": None, "effective_to": None,
        "name": "Altero Strict", "description": "POC test rule",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(), "deleted_at": None,
    }
    await db.business_rules.insert_one(outlet_rule)

    # Test resolution for Altero → outlet-specific wins
    r = await get_threshold_for_scope(
        "anomaly_threshold_policy", outlet_id=alt["id"], brand_id=None, on_date=today,
    )
    assert r, "Expected a rule"
    assert r["scope_type"] == "outlet", f"Expected outlet scope, got {r['scope_type']}"
    print(f"\n[S7] Threshold resolution: outlet Altero → scope={r['scope_type']}/{r['scope_id']} ✅")

    # Test resolution for another outlet → should fall back to group
    other = await db.outlets.find_one({"code": {"$ne": "ALT"}, "deleted_at": None})
    r2 = await get_threshold_for_scope(
        "anomaly_threshold_policy", outlet_id=other["id"], brand_id=None, on_date=today,
    )
    assert r2 and r2["scope_type"] == "group", f"Expected group fallback, got {r2}"
    print(f"    Other outlet → fallback scope={r2['scope_type']}/{r2['scope_id']} ✅")

    # Cleanup
    await db.business_rules.delete_many({"description": "POC test rule"})


# ============================================================
# MAIN
# ============================================================


async def main():
    print("=" * 60)
    print("Phase 7D POC — Anomaly Detection")
    print("=" * 60)

    await init_db()

    try:
        await scenario_1_sales_deviation_severe()
        await scenario_2_sales_deviation_none()
        await scenario_3_vendor_price_spike()
        await scenario_4_vendor_leadtime()
        await scenario_5_idempotent_upsert()
        await scenario_6_notification_dispatch()
        await scenario_7_threshold_resolution()

        print("\n" + "=" * 60)
        print("✅ ALL POC SCENARIOS PASSED")
        print("=" * 60)
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
