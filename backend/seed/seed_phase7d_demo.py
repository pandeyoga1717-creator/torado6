"""Seed Phase 7D — Inject anomalous patterns into existing demo data + run scan.

Run after seed_demo.py + seed_phase7b_demo.py to ensure base data exists.

Usage:  python3 -m seed.seed_phase7d_demo
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from services import anomaly_service, business_rules_service  # noqa: E402


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed():
    await init_db()
    db = get_db()

    # 1. Ensure default anomaly_threshold_policy rule exists
    print("1) Ensuring default anomaly_threshold_policy rule...")
    admin = await db.users.find_one({"email": "admin@torado.id"})
    if not admin:
        print("  SKIP — no admin user. Run seed_demo.py first.")
        await close_db()
        return
    n = await business_rules_service.seed_defaults(user=admin, overwrite=False)
    print(f"  Seeded {n} default config rule(s) (idempotent)")

    # 2. Clear old anomaly_events to avoid confusion
    print("2) Clearing existing anomaly_events...")
    await db.anomaly_events.delete_many({})
    await db.system_settings.delete_many({"key": "last_anomaly_scan"})

    # 3. Inject one synthetic-anomalous daily_sales entry (force severity=severe)
    # Find Altero outlet + the latest validated DS
    alt = await db.outlets.find_one({"code": "ALT", "deleted_at": None})
    if alt:
        # Find baseline avg
        cursor = db.daily_sales.find({
            "deleted_at": None, "status": "validated", "outlet_id": alt["id"],
        }).sort([("sales_date", -1)]).limit(14)
        hist = [float(d.get("grand_total", 0) or 0) async for d in cursor]
        mean = sum(hist) / len(hist) if hist else 10_000_000
        # Target a 3.2σ deviation (definitely severe)
        spike = mean * 1.70  # +70% — definitely > 2.5σ
        inject_date = (datetime.now(timezone.utc).date() - timedelta(days=0)).isoformat()
        # Check if an entry for today exists
        existing = await db.daily_sales.find_one({
            "outlet_id": alt["id"], "sales_date": inject_date, "deleted_at": None,
        })
        if not existing:
            ds_id = str(uuid.uuid4())
            await db.daily_sales.insert_one({
                "id": ds_id,
                "doc_no": f"DS-DEMO-{inject_date}",
                "outlet_id": alt["id"], "brand_id": alt.get("brand_id"),
                "sales_date": inject_date,
                "status": "validated",
                "channels": [{"channel": "DINEIN", "gross": spike, "discount": 0, "net": spike}],
                "payment_breakdown": [{"payment_method_id": "cash", "amount": spike}],
                "revenue_buckets": [{"bucket": "FOOD", "amount": spike * 0.6},
                                   {"bucket": "BEVERAGE", "amount": spike * 0.4}],
                "service_charge": 0, "tax_amount": 0, "grand_total": round(spike, 2),
                "transaction_count": 120,
                "validated_at": now_iso(), "validated_by": admin["id"],
                "submitted_at": now_iso(), "submitted_by": admin["id"],
                "journal_entry_id": None,
                "created_at": now_iso(), "updated_at": now_iso(), "deleted_at": None,
                "created_by": admin["id"], "notes": "Phase 7D demo — injected anomalous spike",
            })
            print(f"  Injected anomalous sales for Altero on {inject_date}: {spike:,.0f} (baseline {mean:,.0f})")
        else:
            print(f"  Sales entry for Altero on {inject_date} already exists — skipping injection")

    # 4. Trigger full scan
    print("3) Running anomaly_service.scan_all()...")
    res = await anomaly_service.scan_all(days=14, user_id=admin["id"])
    print(f"  Scan complete. Counts: {res['counts']}")

    # 5. Report summary
    print("4) Summary (last 30 days):")
    summ = await anomaly_service.summary(days=30)
    c = summ["counts"]
    print(f"   Total: {c['total']} | Severe: {c['severe']} | Mild: {c['mild']} | Open: {c['open']}")
    print(f"   By type: {[(t['type'], t['total']) for t in summ['by_type']]}")
    print(f"   By outlet: {[(o['outlet_name'], o['total']) for o in summ['by_outlet']]}")

    print("\n============================================================")
    print("Phase 7D demo data seeded.")
    print("============================================================")
    print(f"Anomaly events: {c['total']} (severe={c['severe']}, mild={c['mild']})")
    print("Visit: /finance/anomalies to view the feed")
    print("============================================================")

    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
