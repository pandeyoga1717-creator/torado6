"""Seed Aurora F&B demo data for Torado Group.

Creates:
- 1 Group (Torado)
- 4 Brands (Altero, De La Sol, Calluna, Rucker Park) — 1 outlet each
- Standard Indonesian COA (~50 accounts)
- Tax codes (PPN-11, PPN-In/Out)
- Payment methods (Cash, Transfer BCA/Mandiri, QRIS, Card)
- Internal bank accounts
- Number series (PR/PO/GR/JAE/PAY/KB/EA/ADJ/OPN)
- 16 system roles per RBAC_MATRIX.md
- 1 Super Admin user (admin@torado.id / Torado@2026)
- 4 sample outlet manager users (one per outlet)
- Some sample items, vendors, employees

Run: python3 -m seed.seed_demo
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from core.security import hash_password  # noqa: E402


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def doc(extra: dict | None = None) -> dict:
    base = {
        "id": str(uuid.uuid4()),
        "created_at": now(), "updated_at": now(),
        "deleted_at": None, "active": True,
    }
    if extra:
        base.update(extra)
    return base


# ------------- ROLES -------------
ROLES = [
    {"code": "SUPER_ADMIN", "name": "Super Admin",
     "description": "Full access — system administrators",
     "permissions": ["*"], "is_system": True},
    {"code": "EXECUTIVE", "name": "Executive / Owner",
     "description": "Read all dashboards & AI",
     "permissions": [
         "executive.dashboard.read", "executive.drilldown.read", "executive.export",
         "executive.dashboard_view.save",
         "ai.chat.use", "ai.autocomplete.use", "ai.forecast.read", "ai.anomaly.read",
         "search.global.use",
         "outlet.daily_sales.read", "outlet.petty_cash.read",
         "procurement.pr.read", "procurement.vendor.read", "procurement.vendor.scorecard",
         "inventory.balance.read", "inventory.movement.read", "inventory.valuation.read",
         "finance.ap.read", "finance.journal_entry.read",
         "finance.report.profit_loss", "finance.report.balance_sheet", "finance.report.cashflow",
         "hr.advance.read", "hr.lb_fund.read",
     ], "is_system": True},
    {"code": "GM", "name": "General Manager",
     "permissions": [
         "executive.dashboard.read", "executive.drilldown.read", "executive.export",
         "executive.dashboard_view.save",
         "procurement.pr.read", "procurement.pr.approve", "procurement.pr.reject",
         "procurement.po.approve",
         "ai.chat.use", "ai.autocomplete.use", "ai.forecast.read", "ai.anomaly.read",
         "search.global.use",
         "finance.payment.approve", "finance.report.profit_loss", "finance.report.balance_sheet",
         "inventory.adjustment.approve",
     ], "is_system": True},
    {"code": "FINANCE_MANAGER", "name": "Finance Manager",
     "permissions": [
         "finance.sales.validate", "finance.sales.request_fix",
         "finance.ap.read", "finance.payment.create", "finance.payment.approve",
         "finance.payment.mark_paid",
         "finance.journal_entry.read", "finance.journal_entry.create",
         "finance.journal_entry.post", "finance.journal_entry.reverse",
         "finance.tax.manage", "finance.period.close_step", "finance.period.lock",
         "finance.period.unlock", "finance.period.write_to_locked",
         "finance.report.profit_loss", "finance.report.balance_sheet",
         "finance.report.cashflow", "finance.bank_reconciliation",
         "inventory.adjustment.approve", "inventory.opname.approve",
         "ai.chat.use", "ai.autocomplete.use", "ai.categorize.use", "ai.ocr.use",
         "ai.forecast.read", "ai.anomaly.read",
         "search.global.use",
     ], "is_system": True},
    {"code": "FINANCE_STAFF", "name": "Finance Staff",
     "permissions": [
         "finance.sales.validate", "finance.sales.request_fix",
         "finance.ap.read", "finance.payment.create", "finance.payment.mark_paid",
         "finance.journal_entry.read", "finance.journal_entry.create",
         "finance.tax.manage", "finance.bank_reconciliation",
         "ai.autocomplete.use", "ai.categorize.use", "ai.ocr.use",
         "search.global.use",
     ], "is_system": True},
    {"code": "PROCUREMENT_MANAGER", "name": "Procurement Manager",
     "permissions": [
         "procurement.pr.read", "procurement.pr.approve", "procurement.pr.reject",
         "procurement.pr.consolidate",
         "procurement.po.create", "procurement.po.send", "procurement.po.approve",
         "procurement.po.cancel", "procurement.gr.create", "procurement.gr.post",
         "procurement.vendor.read", "procurement.vendor.scorecard",
         "ai.autocomplete.use", "ai.chat.use",
         "search.global.use",
     ], "is_system": True},
    {"code": "PROCUREMENT_STAFF", "name": "Procurement Staff",
     "permissions": [
         "procurement.pr.read", "procurement.pr.create", "procurement.pr.consolidate",
         "procurement.po.create", "procurement.po.send",
         "procurement.gr.create", "procurement.gr.post",
         "procurement.vendor.read",
         "ai.autocomplete.use", "search.global.use",
     ], "is_system": True},
    {"code": "INVENTORY_MANAGER", "name": "Inventory Manager",
     "permissions": [
         "inventory.balance.read", "inventory.movement.read",
         "inventory.transfer.create", "inventory.transfer.send", "inventory.transfer.receive",
         "inventory.adjustment.create", "inventory.adjustment.approve",
         "inventory.opname.start", "inventory.opname.submit", "inventory.opname.approve",
         "inventory.valuation.read",
         "ai.autocomplete.use", "search.global.use",
     ], "is_system": True},
    {"code": "INVENTORY_STAFF", "name": "Inventory Staff",
     "permissions": [
         "inventory.balance.read", "inventory.movement.read",
         "inventory.transfer.create", "inventory.transfer.send", "inventory.transfer.receive",
         "inventory.adjustment.create", "inventory.opname.start", "inventory.opname.submit",
         "inventory.valuation.read",
         "ai.autocomplete.use", "search.global.use",
     ], "is_system": True},
    {"code": "OUTLET_MANAGER", "name": "Outlet Manager",
     "permissions": [
         "outlet.daily_sales.read", "outlet.daily_sales.create", "outlet.daily_sales.submit",
         "outlet.daily_sales.update",
         "outlet.petty_cash.read", "outlet.petty_cash.create",
         "outlet.petty_cash.replenish_request", "outlet.urgent_purchase.create",
         "outlet.kdo.create", "outlet.bdo.create",
         "outlet.daily_close.execute", "outlet.opname.execute",
         "inventory.balance.read", "inventory.movement.read", "inventory.valuation.read",
         "procurement.pr.read", "procurement.pr.create",
         "ai.autocomplete.use", "ai.categorize.use", "ai.ocr.use",
         "ai.forecast.read", "ai.anomaly.read", "ai.chat.use",
         "search.global.use",
     ], "is_system": True},
    {"code": "OUTLET_STAFF", "name": "Outlet Staff",
     "permissions": [
         "outlet.daily_sales.read", "outlet.petty_cash.read",
         "outlet.petty_cash.create", "outlet.kdo.create", "outlet.bdo.create",
         "outlet.opname.execute",
         "inventory.balance.read",
         "ai.autocomplete.use", "search.global.use",
     ], "is_system": True},
    {"code": "KITCHEN_STAFF", "name": "Kitchen Staff",
     "permissions": ["outlet.kdo.create", "ai.autocomplete.use", "search.global.use"],
     "is_system": True},
    {"code": "BAR_STAFF", "name": "Bar Staff",
     "permissions": ["outlet.bdo.create", "ai.autocomplete.use", "search.global.use"],
     "is_system": True},
    {"code": "HR_OFFICER", "name": "HR Officer",
     "permissions": [
         "hr.advance.read", "hr.advance.create",
         "hr.service_charge.calculate", "hr.incentive.calculate",
         "hr.voucher.issue", "hr.voucher.redeem",
         "hr.foc.create", "hr.travel_incentive.manage", "hr.lb_fund.read",
         "ai.autocomplete.use", "ai.categorize.use", "search.global.use",
     ], "is_system": True},
    {"code": "HR_MANAGER", "name": "HR Manager",
     "permissions": [
         "hr.advance.read", "hr.advance.create", "hr.advance.approve",
         "hr.service_charge.calculate", "hr.service_charge.post",
         "hr.incentive.calculate", "hr.incentive.approve",
         "hr.voucher.issue", "hr.voucher.redeem",
         "hr.foc.create", "hr.travel_incentive.manage",
         "hr.lb_fund.read", "hr.lb_fund.use",
         "ai.chat.use", "ai.autocomplete.use", "ai.categorize.use",
         "search.global.use",
     ], "is_system": True},
]


# ------------- COA (Indonesian standard) -------------
COA_TREE = [
    # Asset
    ("1000", "Aset", "asset", "Dr", False, None),
    ("1100", "Kas & Setara Kas", "asset", "Dr", False, "1000"),
    ("1101", "Kas di Tangan", "asset", "Dr", True, "1100"),
    ("1102", "Petty Cash - Outlet", "asset", "Dr", True, "1100"),
    ("1110", "Bank BCA", "asset", "Dr", True, "1100"),
    ("1111", "Bank Mandiri", "asset", "Dr", True, "1100"),
    ("1120", "Cards Receivable", "asset", "Dr", True, "1100"),
    ("1200", "Piutang", "asset", "Dr", False, "1000"),
    ("1201", "Piutang Usaha", "asset", "Dr", True, "1200"),
    ("1210", "Employee Advance Receivable", "asset", "Dr", True, "1200"),
    ("1300", "Persediaan", "asset", "Dr", False, "1000"),
    ("1301", "Inventory - Bahan Baku", "asset", "Dr", True, "1300"),
    ("1302", "Inventory - Minuman/Bar", "asset", "Dr", True, "1300"),
    ("1303", "Inventory - Habis Pakai", "asset", "Dr", True, "1300"),
    ("1310", "Inventory in Transit", "asset", "Dr", True, "1300"),
    ("1320", "Voucher Inventory", "asset", "Dr", True, "1300"),
    ("1400", "Pajak Dibayar di Muka", "asset", "Dr", False, "1000"),
    ("1401", "Input VAT (PPN Masukan)", "asset", "Dr", True, "1400"),
    ("1500", "Aset Tetap", "asset", "Dr", False, "1000"),
    ("1501", "Peralatan", "asset", "Dr", True, "1500"),
    # Liability
    ("2000", "Kewajiban", "liability", "Cr", False, None),
    ("2100", "Kewajiban Lancar", "liability", "Cr", False, "2000"),
    ("2101", "Accounts Payable", "liability", "Cr", True, "2100"),
    ("2102", "Goods Received Not Invoiced", "liability", "Cr", True, "2100"),
    ("2110", "Output VAT (PPN Keluaran)", "liability", "Cr", True, "2100"),
    ("2111", "VAT Payable", "liability", "Cr", True, "2100"),
    ("2120", "Service Charge Liability", "liability", "Cr", True, "2100"),
    ("2121", "L&B Fund Liability", "liability", "Cr", True, "2100"),
    ("2122", "L&D Fund Liability", "liability", "Cr", True, "2100"),
    ("2130", "Salary Payable", "liability", "Cr", True, "2100"),
    ("2140", "Voucher Liability", "liability", "Cr", True, "2100"),
    ("2150", "Accrued Expenses", "liability", "Cr", True, "2100"),
    ("2160", "SHU Payable", "liability", "Cr", True, "2100"),
    # Equity
    ("3000", "Ekuitas", "equity", "Cr", False, None),
    ("3001", "Modal Disetor", "equity", "Cr", True, "3000"),
    ("3002", "Retained Earnings", "equity", "Cr", True, "3000"),
    ("3003", "Income Summary", "equity", "Cr", True, "3000"),
    # Revenue
    ("4000", "Pendapatan", "revenue", "Cr", False, None),
    ("4001", "Revenue - Food", "revenue", "Cr", True, "4000"),
    ("4002", "Revenue - Beverage", "revenue", "Cr", True, "4000"),
    ("4003", "Revenue - Other", "revenue", "Cr", True, "4000"),
    ("4010", "Discount Expense", "revenue", "Dr", True, "4000"),
    ("4020", "Other Income - Voucher Breakage", "revenue", "Cr", True, "4000"),
    ("4030", "Adjustment Income", "revenue", "Cr", True, "4000"),
    # COGS
    ("5000", "Cost of Goods Sold", "cogs", "Dr", False, None),
    ("5001", "COGS", "cogs", "Dr", True, "5000"),
    # Expense
    ("5100", "Bahan Baku", "expense", "Dr", False, "5000"),
    ("5101", "Bahan Baku - Dapur", "expense", "Dr", True, "5100"),
    ("5102", "Bahan Baku - Bar", "expense", "Dr", True, "5100"),
    ("5300", "Operasional Outlet", "expense", "Dr", False, "5000"),
    ("5301", "Bahan Habis Pakai", "expense", "Dr", True, "5300"),
    ("5302", "Listrik & Air", "expense", "Dr", True, "5300"),
    ("5303", "Gas & BBM", "expense", "Dr", True, "5300"),
    ("5304", "Perbaikan & Pemeliharaan", "expense", "Dr", True, "5300"),
    ("5400", "Marketing & SDM", "expense", "Dr", False, "5000"),
    ("5401", "Marketing & Promosi", "expense", "Dr", True, "5400"),
    ("5402", "Staff Meal", "expense", "Dr", True, "5400"),
    ("5410", "Salary Expense", "expense", "Dr", True, "5400"),
    ("5411", "Incentive Expense", "expense", "Dr", True, "5400"),
    ("5412", "Travel Incentive Expense", "expense", "Dr", True, "5400"),
    ("5420", "Loss & Breakage", "expense", "Dr", True, "5400"),
    ("5421", "Customer Compensation", "expense", "Dr", True, "5400"),
    ("5430", "Card Processing Fee", "expense", "Dr", True, "5400"),
    ("5440", "Tax Penalty Expense", "expense", "Dr", True, "5400"),
]


async def seed():
    await init_db()
    db = get_db()

    # Wipe transactional collections, keep nothing — fresh seed
    print("Clearing existing data…")
    for col in (
        "groups", "brands", "outlets", "users", "roles",
        "items", "categories", "vendors", "employees",
        "chart_of_accounts", "tax_codes", "payment_methods", "bank_accounts",
        "number_series", "business_rules", "audit_log", "notifications",
        "refresh_tokens",
        "daily_sales", "petty_cash_transactions", "urgent_purchases",
        "purchase_requests", "purchase_orders", "goods_receipts",
        "inventory_movements", "transfers", "adjustments", "opname_sessions",
        "ap_ledger", "journal_entries", "accounting_periods",
        "system_settings", "categorization_rules",
    ):
        await db[col].delete_many({})

    # 1. Group
    print("Creating Group: Torado…")
    group = doc({
        "name": "Torado", "legal_name": "PT Torado Indonesia",
        "currency_default": "IDR",
        "settings": {"timezone": "Asia/Jakarta", "date_format": "DD MMM YYYY"},
    })
    await db.groups.insert_one(group)
    group_id = group["id"]

    # 2. Brands + Outlets
    print("Creating 4 Brands & Outlets…")
    brand_outlets = [
        ("ALT", "Altero",      "#5B5FE3"),
        ("DLS", "De La Sol",   "#F59E0B"),
        ("CAL", "Calluna",     "#10B981"),
        ("RKP", "Rucker Park", "#EF4444"),
    ]
    brands_map: dict[str, str] = {}
    outlets_map: dict[str, str] = {}
    for code, name, color in brand_outlets:
        brand = doc({"group_id": group_id, "code": code, "name": name, "color": color})
        await db.brands.insert_one(brand)
        brands_map[code] = brand["id"]

        outlet = doc({
            "brand_id": brand["id"], "code": code, "name": name,
            "address": f"Jl. Demo {name}, Jakarta",
            "phone": "+62-21-555-0000",
            "open_time": "08:00", "close_time": "23:00",
        })
        await db.outlets.insert_one(outlet)
        outlets_map[code] = outlet["id"]

    # 3. Roles
    print(f"Creating {len(ROLES)} Roles…")
    role_ids: dict[str, str] = {}
    for r in ROLES:
        rec = doc(r)
        await db.roles.insert_one(rec)
        role_ids[r["code"]] = rec["id"]

    # 4. COA
    print(f"Creating {len(COA_TREE)} COA accounts…")
    coa_by_code: dict[str, str] = {}
    for code, name, type_, normal, postable, parent_code in COA_TREE:
        rec = doc({
            "code": code, "name": name, "type": type_,
            "normal_balance": normal, "is_postable": postable,
            "parent_id": coa_by_code.get(parent_code) if parent_code else None,
            "level": (parent_code.count(".") + 1) if parent_code else 1,
        })
        await db.chart_of_accounts.insert_one(rec)
        coa_by_code[code] = rec["id"]

    # 5. Tax codes
    print("Creating Tax Codes…")
    tax_ppn = doc({
        "code": "PPN-11", "name": "PPN 11%", "rate": 0.11,
        "gl_account_payable_id": coa_by_code["2110"],
        "gl_account_receivable_id": coa_by_code["1401"],
    })
    await db.tax_codes.insert_one(tax_ppn)

    # 6. Bank accounts
    print("Creating Bank Accounts…")
    for code, name, bank, acc_no, gl_code in [
        ("BCA-MAIN", "Bank BCA Utama",      "BCA",     "1234567890", "1110"),
        ("MDR-MAIN", "Bank Mandiri Utama",  "Mandiri", "9876543210", "1111"),
    ]:
        await db.bank_accounts.insert_one(doc({
            "code": code, "name": name, "bank": bank, "account_number": acc_no,
            "gl_account_id": coa_by_code[gl_code], "currency": "IDR",
        }))

    # 7. Payment methods
    print("Creating Payment Methods…")
    bca_id = (await db.bank_accounts.find_one({"code": "BCA-MAIN"}))["id"]
    mdr_id = (await db.bank_accounts.find_one({"code": "MDR-MAIN"}))["id"]
    pms = [
        ("CASH",     "Tunai",          "cash",     None),
        ("BCA-TRF",  "Transfer BCA",   "transfer", bca_id),
        ("MDR-TRF",  "Transfer Mandiri", "transfer", mdr_id),
        ("QRIS",     "QRIS",           "qris",     bca_id),
        ("CARD",     "Debit/Kredit",   "card",     bca_id),
        ("PETTY",    "Petty Cash",     "cash",     None),
    ]
    for code, name, type_, ba in pms:
        await db.payment_methods.insert_one(doc({
            "code": code, "name": name, "type": type_, "bank_account_id": ba,
        }))

    # 8. Number series
    print("Creating Number Series…")
    series = [
        ("PR",  "PR",  4, "PR-{YY}{MM}-{0000}"),
        ("PO",  "PO",  4, "PO-{YY}{MM}-{0000}"),
        ("GR",  "GR",  4, "GR-{YY}{MM}-{0000}"),
        ("JAE", "JAE", 5, "JAE-{YY}{MM}-{0000}"),
        ("PAY", "PAY", 5, "PAY-{YY}{MM}-{0000}"),
        ("KB",  "KB",  5, "KB-{YY}{MM}-{0000}"),
        ("EA",  "EA",  4, "EA-{YY}{MM}-{0000}"),
        ("ADJ", "ADJ", 4, "ADJ-{YY}{MM}-{0000}"),
        ("OPN", "OPN", 4, "OPN-{YY}{MM}-{0000}"),
        ("TRF", "TRF", 4, "TRF-{YY}{MM}-{0000}"),
        ("VOC", "VOC", 5, "VOC-{0000}"),
        ("FOC", "FOC", 5, "FOC-{YY}{MM}-{0000}"),
    ]
    for code, prefix, padding, fmt in series:
        await db.number_series.insert_one(doc({
            "code": code, "prefix": prefix, "padding": padding,
            "reset": "monthly" if "{MM}" in fmt else "yearly",
            "current_value": 0, "format": fmt,
        }))

    # 9. Categories (item)
    print("Creating Categories…")
    cats = [
        ("BAHAN-DAPUR",   "Bahan Baku Dapur",  "item",    "5101"),
        ("BAHAN-BAR",     "Bahan Baku Bar",    "item",    "5102"),
        ("CONSUMABLE",    "Bahan Habis Pakai", "item",    "5301"),
        ("GAS-BBM",       "Gas & BBM",         "expense", "5303"),
        ("LISTRIK-AIR",   "Listrik & Air",     "expense", "5302"),
        ("MARKETING",     "Marketing",         "expense", "5401"),
        ("MAINTENANCE",   "Pemeliharaan",      "expense", "5304"),
    ]
    for code, name, type_, gl_code in cats:
        await db.categories.insert_one(doc({
            "code": code, "name": name, "type": type_,
            "gl_account_id": coa_by_code[gl_code],
        }))

    # 10. Sample Items
    print("Creating sample Items…")
    cat_dapur_id = (await db.categories.find_one({"code": "BAHAN-DAPUR"}))["id"]
    cat_bar_id = (await db.categories.find_one({"code": "BAHAN-BAR"}))["id"]
    cat_consum_id = (await db.categories.find_one({"code": "CONSUMABLE"}))["id"]
    items_seed = [
        ("ITM-001", "Daging Sapi Has Dalam", "kg",    cat_dapur_id),
        ("ITM-002", "Ayam Fillet Dada",      "kg",    cat_dapur_id),
        ("ITM-003", "Bawang Putih",          "kg",    cat_dapur_id),
        ("ITM-004", "Susu UHT 1 Liter",      "liter", cat_dapur_id),
        ("ITM-005", "Telur Ayam Negeri",     "kg",    cat_dapur_id),
        ("ITM-006", "Beras Premium",         "kg",    cat_dapur_id),
        ("ITM-101", "Kopi Arabica Bali",     "kg",    cat_bar_id),
        ("ITM-102", "Teh Hitam Premium",     "pack",  cat_bar_id),
        ("ITM-103", "Sirup Vanilla 1L",      "liter", cat_bar_id),
        ("ITM-104", "Susu Full Cream",       "liter", cat_bar_id),
        ("ITM-201", "Tisu Paseo 250 Ply",    "pcs",   cat_consum_id),
        ("ITM-202", "Sedotan Plastik Pack",  "pack",  cat_consum_id),
        ("ITM-203", "Sabun Cuci Sunlight",   "btl",   cat_consum_id),
    ]
    for code, name, unit, cat_id in items_seed:
        await db.items.insert_one(doc({
            "code": code, "name": name, "unit_default": unit, "category_id": cat_id,
        }))

    # 11. Sample Vendors
    print("Creating sample Vendors…")
    vendors_seed = [
        ("VND-001", "PT Sumber Pangan Sejati",  "081234567890"),
        ("VND-002", "CV Daging Berkah",         "082345678901"),
        ("VND-003", "Toko Sayur Pasar Induk",   "083456789012"),
        ("VND-004", "PT Sinar Kopi Indonesia",  "084567890123"),
        ("VND-005", "Indomaret Kopo Indah",     "022-5430123"),
        ("VND-006", "PT Gas Sentosa",           "085678901234"),
    ]
    for code, name, phone in vendors_seed:
        await db.vendors.insert_one(doc({
            "code": code, "name": name, "phone": phone,
            "default_payment_terms_days": 30,
        }))

    # 12. Sample Employees (per outlet)
    print("Creating sample Employees…")
    emp_idx = 1
    for outlet_code in ("ALT", "DLS", "CAL", "RKP"):
        for role_pos in ("Outlet Manager", "Senior Chef", "Bartender",
                         "Server", "Server"):
            await db.employees.insert_one(doc({
                "code": f"EMP-{emp_idx:04d}",
                "full_name": f"Karyawan {emp_idx} ({outlet_code})",
                "position": role_pos,
                "outlet_id": outlets_map[outlet_code],
                "brand_id": brands_map[outlet_code],
                "status": "active",
                "join_date": "2025-01-01",
                "gross_salary": 5_000_000 if "Manager" in role_pos else 3_500_000,
                "basic_salary": 4_000_000 if "Manager" in role_pos else 3_000_000,
            }))
            emp_idx += 1

    # 13. Users
    print("Creating Users…")
    # 12.5 GL Mapping (system_settings) — required for journal_service
    print("Creating GL Mapping…")
    gl_mapping = {
        "cash_on_hand": coa_by_code["1101"],
        "petty_cash": {oid: coa_by_code["1102"] for oid in outlets_map.values()},
        "bank_default": coa_by_code["1110"],
        "cards_receivable": coa_by_code["1120"],
        "accounts_payable": coa_by_code["2101"],
        "goods_received_not_invoiced": coa_by_code["2102"],
        "employee_advance_receivable": coa_by_code["1210"],
        "output_vat": coa_by_code["2110"],
        "input_vat": coa_by_code["1401"],
        "vat_payable": coa_by_code["2111"],
        "service_charge_liability": coa_by_code["2120"],
        "lb_fund_liability": coa_by_code["2121"],
        "ld_fund_liability": coa_by_code["2122"],
        "salary_payable": coa_by_code["2130"],
        "voucher_liability": coa_by_code["2140"],
        "accrued_expenses": coa_by_code["2150"],
        "shu_payable": coa_by_code["2160"],
        "retained_earnings": coa_by_code["3002"],
        "income_summary": coa_by_code["3003"],
        "revenue_food": coa_by_code["4001"],
        "revenue_beverage": coa_by_code["4002"],
        "revenue_other": coa_by_code["4003"],
        "discount_expense": coa_by_code["4010"],
        "voucher_breakage_income": coa_by_code["4020"],
        "adjustment_income": coa_by_code["4030"],
        "cogs": coa_by_code["5001"],
        "inventory": {oid: coa_by_code["1301"] for oid in outlets_map.values()},
        "inventory_in_transit": coa_by_code["1310"],
        "voucher_inventory": coa_by_code["1320"],
        "loss_breakage": coa_by_code["5420"],
        "customer_compensation": coa_by_code["5421"],
        "card_processing_fee": coa_by_code["5430"],
        "tax_penalty_expense": coa_by_code["5440"],
        "staff_meal_expense": coa_by_code["5402"],
        "marketing_expense": coa_by_code["5401"],
        "salary_expense": coa_by_code["5410"],
        "incentive_expense": coa_by_code["5411"],
        "travel_incentive_expense": coa_by_code["5412"],
    }
    await db.system_settings.delete_many({"key": "gl_mapping"})
    await db.system_settings.insert_one({
        "id": str(uuid.uuid4()),
        "key": "gl_mapping",
        "value": gl_mapping,
        "updated_at": now(),
    })
    # Super admin
    super_admin = doc({
        "email": "admin@torado.id",
        "password_hash": hash_password("Torado@2026"),
        "full_name": "Super Admin",
        "phone": "+62-811-0000-0000",
        "status": "active",
        "role_ids": [role_ids["SUPER_ADMIN"]],
        "outlet_ids": list(outlets_map.values()),
        "brand_ids": list(brands_map.values()),
        "default_portal": "admin",
        "failed_login_count": 0, "locked_until": None,
        "mfa_enabled": False,
    })
    await db.users.insert_one(super_admin)

    # Executive (Pak Hadi)
    await db.users.insert_one(doc({
        "email": "executive@torado.id",
        "password_hash": hash_password("Torado@2026"),
        "full_name": "Pak Hadi (Executive)",
        "status": "active",
        "role_ids": [role_ids["EXECUTIVE"]],
        "outlet_ids": list(outlets_map.values()),
        "brand_ids": list(brands_map.values()),
        "default_portal": "executive",
        "failed_login_count": 0, "locked_until": None,
        "mfa_enabled": False,
    }))

    # Finance Manager (Pak Budi)
    await db.users.insert_one(doc({
        "email": "finance@torado.id",
        "password_hash": hash_password("Torado@2026"),
        "full_name": "Pak Budi (Finance Manager)",
        "status": "active",
        "role_ids": [role_ids["FINANCE_MANAGER"]],
        "outlet_ids": list(outlets_map.values()),
        "brand_ids": list(brands_map.values()),
        "default_portal": "finance",
        "failed_login_count": 0, "locked_until": None,
        "mfa_enabled": False,
    }))

    # Procurement Manager (Bu Dewi)
    await db.users.insert_one(doc({
        "email": "procurement@torado.id",
        "password_hash": hash_password("Torado@2026"),
        "full_name": "Bu Dewi (Procurement Manager)",
        "status": "active",
        "role_ids": [role_ids["PROCUREMENT_MANAGER"]],
        "outlet_ids": list(outlets_map.values()),
        "brand_ids": list(brands_map.values()),
        "default_portal": "procurement",
        "failed_login_count": 0, "locked_until": None,
        "mfa_enabled": False,
    }))

    # Outlet managers (one per outlet)
    for code, name in [("ALT", "Altero"), ("DLS", "De La Sol"),
                        ("CAL", "Calluna"), ("RKP", "Rucker Park")]:
        await db.users.insert_one(doc({
            "email": f"{code.lower()}.manager@torado.id",
            "password_hash": hash_password("Torado@2026"),
            "full_name": f"Manager {name}",
            "status": "active",
            "role_ids": [role_ids["OUTLET_MANAGER"]],
            "outlet_ids": [outlets_map[code]],
            "brand_ids": [brands_map[code]],
            "default_portal": "outlet",
            "failed_login_count": 0, "locked_until": None,
            "mfa_enabled": False,
        }))

    print()
    print("=" * 60)
    print("Seed complete.")
    print("=" * 60)
    print("Login URL: <preview>/login")
    print()
    print("CREDENTIALS (all password: Torado@2026):")
    print("  admin@torado.id          — Super Admin (full access)")
    print("  executive@torado.id      — Executive / Owner")
    print("  finance@torado.id        — Finance Manager")
    print("  procurement@torado.id    — Procurement Manager")
    print("  alt.manager@torado.id    — Altero Outlet Manager")
    print("  dls.manager@torado.id    — De La Sol Outlet Manager")
    print("  cal.manager@torado.id    — Calluna Outlet Manager")
    print("  rkp.manager@torado.id    — Rucker Park Outlet Manager")
    print()
    print(f"Group: Torado | Brands: 4 | Outlets: 4")
    print(f"Roles: {len(ROLES)} | COA: {len(COA_TREE)} | "
          f"Items: {len(items_seed)} | Vendors: {len(vendors_seed)} | "
          f"Employees: {emp_idx-1}")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
