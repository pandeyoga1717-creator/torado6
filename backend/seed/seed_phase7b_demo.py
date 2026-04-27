"""Seed Phase 7B demo transactional data — daily_sales, PO/GR, validated journals.

Generates realistic patterns to make:
- Vendor scorecards meaningful (varying on-time%, price stability, lead times)
- Daily Sales Trend across 60 days
- MoM/YoY comparisons (for current and previous period)
- Pivot Outlet × Brand × Category populated

Run: python3 -m seed.seed_phase7b_demo
"""
from __future__ import annotations

import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from services import journal_service  # noqa: E402

random.seed(42)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def doc_base() -> dict:
    return {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "deleted_at": None,
    }


async def seed():
    await init_db()
    db = get_db()

    # Clear transactional data only (not master)
    print("Clearing transactional data...")
    for col in (
        "daily_sales", "purchase_requests", "purchase_orders",
        "goods_receipts", "inventory_movements", "journal_entries",
        "accounting_periods", "ap_ledger",
    ):
        await db[col].delete_many({})

    # Get masters
    outlets = await db.outlets.find({}).to_list(10)
    brands = await db.brands.find({}).to_list(10)
    vendors = await db.vendors.find({}).to_list(20)
    items = await db.items.find({}).to_list(50)

    if not outlets or not vendors or not items:
        print("Master data missing. Run seed_demo first.")
        await close_db()
        return

    today = datetime.now(timezone.utc).date()
    admin = await db.users.find_one({"email": "admin@torado.id"})
    admin_id = admin["id"] if admin else "system"

    # ============================================================
    # 1. DAILY SALES — 60 days × 4 outlets, with realistic variance
    # ============================================================
    print("Seeding daily_sales (60 days × 4 outlets)...")
    sales_count = 0
    for outlet in outlets:
        # Each outlet has its own baseline + weekly pattern
        baseline = random.choice([7_000_000, 9_500_000, 12_000_000, 6_500_000])
        weekend_boost = 1.4
        for d in range(60, 0, -1):
            sales_date = (today - timedelta(days=d)).isoformat()
            wk = (today - timedelta(days=d)).weekday()
            multiplier = (weekend_boost if wk in (4, 5) else 1.0) * random.uniform(0.7, 1.3)
            grand = round(baseline * multiplier, -3)
            food = round(grand * 0.55, -3)
            beverage = round(grand * 0.30, -3)
            other = round(grand - food - beverage, -3)
            cash = round(grand * 0.40, -3)
            qris = round(grand * 0.30, -3)
            transfer = round(grand * 0.20, -3)
            card = round(grand - cash - qris - transfer, -3)

            ds = {
                **doc_base(),
                "outlet_id": outlet["id"],
                "brand_id": outlet["brand_id"],
                "sales_date": sales_date,
                "status": "validated",
                "schema_version": 1,
                "transaction_count": int(random.uniform(50, 220)),
                "channels": [
                    {"channel": "Dine-in", "gross": grand * 0.7, "discount": 0, "net": grand * 0.7},
                    {"channel": "Take-Away", "gross": grand * 0.2, "discount": 0, "net": grand * 0.2},
                    {"channel": "Delivery", "gross": grand * 0.1, "discount": 0, "net": grand * 0.1},
                ],
                "revenue_buckets": [
                    {"bucket": "food", "amount": food},
                    {"bucket": "beverage", "amount": beverage},
                    {"bucket": "other", "amount": other},
                ],
                "payment_breakdown": [
                    {"payment_method": "CASH", "amount": cash},
                    {"payment_method": "QRIS", "amount": qris},
                    {"payment_method": "BCA-TRF", "amount": transfer},
                    {"payment_method": "CARD", "amount": card},
                ],
                "service_charge": 0,
                "tax_amount": 0,
                "grand_total": grand,
                "submitted_at": sales_date + "T18:00:00+00:00",
                "submitted_by": admin_id,
                "validated_at": sales_date + "T19:00:00+00:00",
                "validated_by": admin_id,
            }
            # Post sales journal (for COGS/Gross Profit calc, simulate COGS = 35% of revenue via JE)
            await db.daily_sales.insert_one(ds)
            sales_count += 1

            # Post journal entry (sales + COGS)
            try:
                # Sales JE
                from services import gl_mapping
                gl = await gl_mapping.get_mapping()
                outlet_id = outlet["id"]
                lines: list[dict] = []
                # Dr Cash + Bank, Cr Revenue
                if cash > 0:
                    lines.append({"coa_id": gl["cash_on_hand"], "dr": cash, "cr": 0,
                                  "memo": "Sales Cash", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]})
                if qris > 0 or transfer > 0:
                    lines.append({"coa_id": gl["bank_default"], "dr": qris + transfer, "cr": 0,
                                  "memo": "Sales Bank", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]})
                if card > 0:
                    lines.append({"coa_id": gl["cards_receivable"], "dr": card, "cr": 0,
                                  "memo": "Sales Card", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]})
                if food > 0:
                    lines.append({"coa_id": gl["revenue_food"], "dr": 0, "cr": food,
                                  "memo": "Revenue Food", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]})
                if beverage > 0:
                    lines.append({"coa_id": gl["revenue_beverage"], "dr": 0, "cr": beverage,
                                  "memo": "Revenue Beverage", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]})
                if other > 0:
                    lines.append({"coa_id": gl["revenue_other"], "dr": 0, "cr": other,
                                  "memo": "Revenue Other", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]})

                await journal_service._post_journal(  # type: ignore[attr-defined]
                    entry_date=sales_date,
                    description=f"Daily sales {outlet['name']} {sales_date}",
                    source_type="sales",
                    source_id=ds["id"],
                    lines=lines,
                    user_id=admin_id,
                )

                # COGS JE = 35% of revenue
                cogs_amt = round(grand * 0.35, -3)
                if cogs_amt > 0:
                    cogs_lines = [
                        {"coa_id": gl["cogs"], "dr": cogs_amt, "cr": 0,
                         "memo": "COGS", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]},
                        {"coa_id": gl["inventory"][outlet_id], "dr": 0, "cr": cogs_amt,
                         "memo": "Inventory consumed", "dim_outlet": outlet_id, "dim_brand": outlet["brand_id"]},
                    ]
                    await journal_service._post_journal(  # type: ignore[attr-defined]
                        entry_date=sales_date,
                        description=f"COGS {outlet['name']} {sales_date}",
                        source_type="manual",
                        source_id=str(uuid.uuid4()),
                        lines=cogs_lines,
                        user_id=admin_id,
                    )
            except Exception as e:  # noqa: BLE001
                print(f"  WARN: failed posting JE for sales {sales_date} {outlet['name']}: {e}")

    print(f"  Created {sales_count} daily_sales (with auto-journal)")

    # ============================================================
    # 2. PURCHASE ORDERS + GOODS RECEIPTS — for vendor scorecard
    # ============================================================
    print("Seeding PO + GR (varied lead time, on-time/late, price variation)...")
    po_count = 0
    gr_count = 0

    # Vendor profiles (some good, some less reliable)
    vendor_profiles = []
    for i, v in enumerate(vendors):
        vendor_profiles.append({
            "vendor": v,
            "lead_time_avg": [3, 5, 7, 10, 14, 6][i % 6],
            "on_time_prob": [0.95, 0.85, 0.70, 0.60, 0.40, 0.80][i % 6],
            "price_variance": [0.02, 0.05, 0.10, 0.15, 0.25, 0.08][i % 6],
        })

    for d in range(45, 0, -3):  # PO every 3 days
        order_date = (today - timedelta(days=d)).isoformat()
        for prof in random.sample(vendor_profiles, k=min(3, len(vendor_profiles))):
            vendor = prof["vendor"]
            outlet = random.choice(outlets)
            # Build PO lines (1-3 items)
            picked_items = random.sample(items, k=random.randint(1, 3))
            lines = []
            subtotal = 0.0
            for it in picked_items:
                qty = random.randint(5, 50)
                base_cost = {"kg": 60_000, "liter": 25_000, "pack": 35_000, "btl": 15_000, "pcs": 8_000}.get(it.get("unit_default", "pcs"), 10_000)
                # Price variance
                cost = round(base_cost * (1 + random.uniform(-prof["price_variance"], prof["price_variance"])), -2)
                total = qty * cost
                lines.append({
                    "item_id": it["id"], "item_name": it["name"],
                    "qty": qty, "unit": it.get("unit_default", "pcs"),
                    "unit_cost": cost, "discount": 0, "tax_pct": 0, "total": total,
                })
                subtotal += total

            po = {
                **doc_base(),
                "doc_no": f"PO-DEMO-{po_count + 1:04d}",
                "vendor_id": vendor["id"],
                "outlet_id": outlet["id"],
                "order_date": order_date,
                "expected_delivery_date": (datetime.fromisoformat(order_date) + timedelta(days=prof["lead_time_avg"])).date().isoformat(),
                "lines": lines,
                "subtotal": subtotal,
                "tax_total": 0,
                "grand_total": subtotal,
                "payment_terms_days": vendor.get("default_payment_terms_days", 30),
                "status": "received",
                "sent_at": order_date + "T10:00:00+00:00",
            }
            await db.purchase_orders.insert_one(po)
            po_count += 1

            # GR (random on-time/late based on profile)
            on_time = random.random() < prof["on_time_prob"]
            actual_lead = prof["lead_time_avg"] if on_time else prof["lead_time_avg"] + random.randint(2, 6)
            recv_date = (datetime.fromisoformat(order_date) + timedelta(days=actual_lead)).date()
            if recv_date > today:
                continue  # skip future
            gr_lines = []
            for ln in lines:
                # Defect: 0-5% chance some qty short
                short_pct = random.uniform(0, 0.05) if random.random() < 0.2 else 0
                qty_recv = round(ln["qty"] * (1 - short_pct))
                gr_lines.append({
                    "po_line_id": ln.get("item_id"),
                    "item_id": ln["item_id"], "item_name": ln["item_name"],
                    "qty_ordered": ln["qty"], "qty_received": qty_recv,
                    "qty_variance": qty_recv - ln["qty"],
                    "unit": ln["unit"], "unit_cost": ln["unit_cost"],
                    "total": qty_recv * ln["unit_cost"],
                })
            gr_grand = sum(g["total"] for g in gr_lines)
            gr = {
                **doc_base(),
                "doc_no": f"GR-DEMO-{gr_count + 1:04d}",
                "po_id": po["id"],
                "vendor_id": vendor["id"],
                "outlet_id": outlet["id"],
                "receive_date": recv_date.isoformat(),
                "lines": gr_lines,
                "subtotal": gr_grand,
                "tax_total": 0,
                "grand_total": gr_grand,
                "invoice_no": f"INV-{po_count:04d}",
                "invoice_date": recv_date.isoformat(),
                "payment_terms_days": vendor.get("default_payment_terms_days", 30),
                "status": "posted",
                "received_by": admin_id,
            }
            await db.goods_receipts.insert_one(gr)
            gr_count += 1

    print(f"  Created {po_count} POs and {gr_count} GRs")

    # Verify
    je_count = await db.journal_entries.count_documents({})
    print(f"  Total journal entries: {je_count}")

    # Stats
    print()
    print("=" * 60)
    print("Phase 7B demo data seeded.")
    print("=" * 60)
    print(f"Daily Sales : {sales_count} ({len(outlets)} outlets × 60 days)")
    print(f"POs         : {po_count}")
    print(f"GRs         : {gr_count}")
    print(f"JE postings : {je_count}")
    print()

    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
