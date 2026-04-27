"""Journal Service — generates JournalEntry docs from business events.
Follows /app/memory/JOURNAL_MAPPING.md exactly.
All calls are idempotent via source_type+source_id check.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import AuroraException, ValidationError
from services import gl_mapping
from utils.number_series import next_doc_no

logger = logging.getLogger("aurora.journal")


async def _ensure_period_open(period: str) -> None:
    """Auto-create period if missing, but if locked → reject."""
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        # Auto-create open period
        await db.accounting_periods.insert_one({
            "id": str(uuid.uuid4()),
            "period": period,
            "fiscal_year": int(period.split("-")[0]),
            "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        return
    if p["status"] in ("locked", "closed"):
        raise AuroraException(
            f"Period {period} sudah {p['status']}, tidak bisa post journal",
            code="PERIOD_LOCKED", status_code=409,
        )


def _period_of(date_str: str) -> str:
    return date_str[:7]  # YYYY-MM


async def _post_journal(
    *,
    entry_date: str,
    description: str,
    source_type: str,
    source_id: str,
    lines: list[dict],
    user_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    dim_brand: Optional[str] = None,
) -> dict:
    """Generic JE poster. Validates Dr=Cr, opens period, idempotent."""
    db = get_db()
    period = _period_of(entry_date)
    await _ensure_period_open(period)

    # Idempotency: if a posted JE already exists for this source, skip
    existing = await db.journal_entries.find_one({
        "source_type": source_type, "source_id": source_id,
        "status": "posted", "deleted_at": None,
    })
    if existing:
        return serialize(existing)

    # Filter zero-amount lines, total
    filtered = []
    total_dr = 0.0
    total_cr = 0.0
    for ln in lines:
        dr = float(ln.get("dr", 0) or 0)
        cr = float(ln.get("cr", 0) or 0)
        if dr == 0 and cr == 0:
            continue
        filtered.append({
            "coa_id": ln["coa_id"],
            "coa_code": ln.get("coa_code"),
            "coa_name": ln.get("coa_name"),
            "dr": round(dr, 2),
            "cr": round(cr, 2),
            "memo": ln.get("memo"),
            "dim_outlet": ln.get("dim_outlet") or dim_outlet,
            "dim_brand": ln.get("dim_brand") or dim_brand,
            "dim_employee": ln.get("dim_employee"),
            "dim_vendor": ln.get("dim_vendor"),
        })
        total_dr += dr
        total_cr += cr

    if abs(total_dr - total_cr) > 0.5:
        raise ValidationError(
            f"Journal tidak balance: Dr={total_dr}, Cr={total_cr} (diff={total_dr-total_cr})"
        )

    doc_no = await next_doc_no("JAE")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "entry_date": entry_date,
        "period": period,
        "source_type": source_type,
        "source_id": source_id,
        "description": description,
        "status": "posted",
        "lines": filtered,
        "total_dr": round(total_dr, 2),
        "total_cr": round(total_cr, 2),
        "posted_by": user_id,
        "posted_at": now,
        "reversal_of": None,
        "created_at": now, "updated_at": now, "deleted_at": None,
    }
    await db.journal_entries.insert_one(doc)
    await audit_log(
        user_id=user_id, entity_type="journal_entry", entity_id=doc["id"],
        action="post", after={"source_type": source_type, "source_id": source_id, "doc_no": doc_no},
    )
    return serialize(doc)


async def reverse_journal(je_id: str, *, user_id: str, reason: str) -> dict:
    db = get_db()
    orig = await db.journal_entries.find_one({"id": je_id, "deleted_at": None})
    if not orig:
        raise ValidationError("Journal entry tidak ditemukan")
    if orig["status"] != "posted":
        raise ValidationError("Hanya JE posted yang dapat direverse")
    # Generate reversal
    reversed_lines = [
        {**ln, "dr": ln.get("cr", 0), "cr": ln.get("dr", 0)} for ln in orig["lines"]
    ]
    rev = await _post_journal(
        entry_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        description=f"Reversal of {orig['doc_no']}: {reason}",
        source_type="reversal",
        source_id=orig["id"],
        lines=reversed_lines,
        user_id=user_id,
    )
    await db.journal_entries.update_one(
        {"id": je_id}, {"$set": {"status": "reversed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.journal_entries.update_one(
        {"id": rev["id"]}, {"$set": {"reversal_of": je_id}}
    )
    return rev


# =================== EVENT HANDLERS ===================

async def post_for_daily_sales(sales: dict, *, user_id: str) -> dict:
    """On daily_sales validated:
       Dr Cash/Bank/Card per payment method, Dr Discount
       Cr Revenue per bucket, Cr Service Charge Liability, Cr Output VAT
    """
    outlet_id = sales["outlet_id"]
    lines: list[dict] = []

    # Debit: payment methods
    db = get_db()
    for pay in sales.get("payment_breakdown", []):
        pm_id = pay.get("payment_method_id")
        amount = float(pay.get("amount", 0) or 0)
        if amount == 0 or not pm_id:
            continue
        pm = await db.payment_methods.find_one({"id": pm_id, "deleted_at": None})
        if not pm:
            continue
        # Resolve target account: bank_account.gl_account_id else cash/petty
        target = None
        if pm.get("bank_account_id"):
            ba = await db.bank_accounts.find_one({"id": pm["bank_account_id"]})
            target = ba and ba.get("gl_account_id")
        if not target:
            if pm["type"] == "card":
                target = await gl_mapping.resolve("cards_receivable")
            elif pm["code"] == "PETTY":
                target = await gl_mapping.resolve("petty_cash", scope_outlet_id=outlet_id)
            else:
                target = await gl_mapping.resolve("cash_on_hand")
        lines.append({
            "coa_id": target, "dr": amount, "cr": 0,
            "memo": f"Sales {sales['sales_date']} via {pm['name']}",
        })

    # Credit: revenue buckets
    bucket_to_logical = {
        "food": "revenue_food",
        "beverage": "revenue_beverage",
        "other": "revenue_other",
    }
    for bucket in sales.get("revenue_buckets", []):
        bk = (bucket.get("bucket") or "other").lower()
        amount = float(bucket.get("amount", 0) or 0)
        if amount == 0:
            continue
        logical = bucket_to_logical.get(bk, "revenue_other")
        coa_id = await gl_mapping.resolve(logical)
        lines.append({"coa_id": coa_id, "dr": 0, "cr": amount, "memo": f"Revenue {bk}"})

    # Credit: service charge liability
    svc = float(sales.get("service_charge", 0) or 0)
    if svc:
        coa_id = await gl_mapping.resolve("service_charge_liability")
        lines.append({"coa_id": coa_id, "dr": 0, "cr": svc, "memo": "Service charge"})

    # Credit: output VAT
    tax = float(sales.get("tax_amount", 0) or 0)
    if tax:
        coa_id = await gl_mapping.resolve("output_vat")
        lines.append({"coa_id": coa_id, "dr": 0, "cr": tax, "memo": "PPN Keluaran"})

    return await _post_journal(
        entry_date=sales["sales_date"],
        description=f"Daily Sales {sales['sales_date']}",
        source_type="sales",
        source_id=sales["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=outlet_id,
        dim_brand=sales.get("brand_id"),
    )


async def post_for_petty_cash(txn: dict, *, user_id: str) -> Optional[dict]:
    """Petty cash purchase: Dr expense GL, Cr Petty Cash (outlet)."""
    if txn["type"] != "purchase":
        return None
    if not txn.get("gl_account_id"):
        return None
    petty_id = await gl_mapping.resolve("petty_cash", scope_outlet_id=txn["outlet_id"])
    amount = float(txn["amount"])
    return await _post_journal(
        entry_date=txn["txn_date"],
        description=f"PC: {txn['description']}",
        source_type="petty_cash",
        source_id=txn["id"],
        lines=[
            {"coa_id": txn["gl_account_id"], "dr": amount, "cr": 0, "memo": txn["description"]},
            {"coa_id": petty_id, "dr": 0, "cr": amount, "memo": "Petty cash out"},
        ],
        user_id=user_id,
        dim_outlet=txn["outlet_id"],
    )


async def post_for_urgent_purchase(up: dict, *, user_id: str) -> Optional[dict]:
    """Urgent purchase paid by petty cash: Dr [item GL], Cr Petty Cash."""
    db = get_db()
    pm_id = up.get("payment_method_id")
    pm = await db.payment_methods.find_one({"id": pm_id}) if pm_id else None
    target = None
    if pm and pm.get("code") == "PETTY":
        target = await gl_mapping.resolve("petty_cash", scope_outlet_id=up["outlet_id"])
    elif pm and pm.get("bank_account_id"):
        ba = await db.bank_accounts.find_one({"id": pm["bank_account_id"]})
        target = ba and ba.get("gl_account_id")
    if not target:
        target = await gl_mapping.resolve("cash_on_hand")

    lines = []
    for it in up.get("items", []):
        gl = it.get("gl_account_id")
        amt = float(it.get("total", 0) or 0)
        if not gl or amt == 0:
            continue
        lines.append({"coa_id": gl, "dr": amt, "cr": 0, "memo": it.get("name", "")})
    if not lines:
        return None
    total = sum(ln["dr"] for ln in lines)
    lines.append({"coa_id": target, "dr": 0, "cr": total, "memo": "Urgent purchase pay"})

    return await _post_journal(
        entry_date=up["purchase_date"],
        description=f"Urgent purchase {up.get('doc_no','')}",
        source_type="urgent_purchase",
        source_id=up["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=up["outlet_id"],
    )


async def post_for_gr(gr: dict, *, user_id: str) -> dict:
    """GR posted: Dr Inventory + Input VAT, Cr AP"""
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=gr["outlet_id"])
    ap_acc = await gl_mapping.resolve("accounts_payable")
    in_vat_acc = await gl_mapping.resolve("input_vat")
    subtotal = float(gr.get("subtotal", 0))
    tax = float(gr.get("tax_total", 0))
    grand = float(gr.get("grand_total", 0))
    lines = [
        {"coa_id": inv_acc, "dr": subtotal, "cr": 0, "memo": "GR inventory"},
    ]
    if tax:
        lines.append({"coa_id": in_vat_acc, "dr": tax, "cr": 0, "memo": "PPN Masukan"})
    lines.append({"coa_id": ap_acc, "dr": 0, "cr": grand, "memo": "AP vendor",
                  "dim_vendor": gr["vendor_id"]})
    return await _post_journal(
        entry_date=gr["receive_date"],
        description=f"Goods Receipt {gr.get('doc_no','')}",
        source_type="goods_receipt",
        source_id=gr["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=gr["outlet_id"],
    )


async def post_for_adjustment(adj: dict, *, user_id: str) -> dict:
    """Adjustment: total_value > 0 (positive correction) Dr Inv Cr Adjustment Income;
    < 0 (loss) Dr Loss/Breakage Cr Inventory."""
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=adj["outlet_id"])
    total = float(adj.get("total_value", 0))
    if total >= 0:
        # Inventory increase (rare — correction)
        income_acc = await gl_mapping.resolve("adjustment_income")
        lines = [
            {"coa_id": inv_acc, "dr": total, "cr": 0, "memo": "Adj +"},
            {"coa_id": income_acc, "dr": 0, "cr": total, "memo": "Adj income"},
        ]
    else:
        loss_acc = await gl_mapping.resolve("loss_breakage")
        amt = -total
        lines = [
            {"coa_id": loss_acc, "dr": amt, "cr": 0, "memo": f"Adj {adj.get('reason','')}"},
            {"coa_id": inv_acc, "dr": 0, "cr": amt, "memo": "Inv reduction"},
        ]
    return await _post_journal(
        entry_date=adj["adjustment_date"],
        description=f"Adjustment {adj.get('doc_no','')}: {adj.get('reason','')}",
        source_type="adjustment",
        source_id=adj["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=adj["outlet_id"],
    )


# =================== HR EVENTS (Phase 5) ===================

async def post_for_employee_advance(adv: dict, *, user_id: str) -> Optional[dict]:
    """Disbursement kasbon: Dr Employee Advance Receivable (1210), Cr Cash/Petty/Bank.

    Idempotent — keyed by (source_type=employee_advance, source_id=adv.id).
    """
    db = get_db()
    amount = float(adv.get("principal", 0) or 0)
    if amount <= 0:
        return None
    ar_acc = await gl_mapping.resolve("employee_advance_receivable")
    pm_id = adv.get("payment_method_id")
    target = None
    pm = None
    if pm_id:
        pm = await db.payment_methods.find_one({"id": pm_id})
    if pm and pm.get("code") == "PETTY":
        target = await gl_mapping.resolve("petty_cash", scope_outlet_id=adv.get("outlet_id"))
    elif pm and pm.get("bank_account_id"):
        ba = await db.bank_accounts.find_one({"id": pm["bank_account_id"]})
        target = ba and ba.get("gl_account_id")
    if not target:
        target = await gl_mapping.resolve("cash_on_hand")

    return await _post_journal(
        entry_date=adv.get("disbursed_at", "")[:10] or adv.get("advance_date"),
        description=f"EA disbursement {adv.get('doc_no','')}",
        source_type="employee_advance",
        source_id=adv["id"],
        lines=[
            {"coa_id": ar_acc, "dr": amount, "cr": 0,
             "memo": f"EA {adv.get('doc_no','')}", "dim_employee": adv.get("employee_id")},
            {"coa_id": target, "dr": 0, "cr": amount,
             "memo": "EA cash out"},
        ],
        user_id=user_id,
        dim_outlet=adv.get("outlet_id"),
    )


async def post_for_service_charge(sc: dict, *, user_id: str) -> Optional[dict]:
    """Service Charge posting:
    Dr Service Charge Liability (2120) for distributable + LB amount + LD amount
    Cr Salary Payable (2130) for distributable
    Cr LB Fund Liability (2121) for lb_amount
    Cr LD Fund Liability (2122) for ld_amount
    Net: zero-out current period service charge liability into payable + funds.
    """
    distributable = float(sc.get("distributable", 0) or 0)
    lb_amount = float(sc.get("lb_amount", 0) or 0)
    ld_amount = float(sc.get("ld_amount", 0) or 0)
    total = distributable + lb_amount + ld_amount
    if total <= 0:
        return None
    sc_liab = await gl_mapping.resolve("service_charge_liability")
    salary_payable = await gl_mapping.resolve("salary_payable")
    lines: list[dict] = [
        {"coa_id": sc_liab, "dr": total, "cr": 0,
         "memo": f"Service charge release {sc.get('period')}"},
    ]
    if distributable > 0:
        lines.append({"coa_id": salary_payable, "dr": 0, "cr": distributable,
                      "memo": "Service share to employees"})
    if lb_amount > 0:
        lb_fund = await gl_mapping.resolve("lb_fund_liability")
        lines.append({"coa_id": lb_fund, "dr": 0, "cr": lb_amount,
                      "memo": "L&B fund deduction"})
    if ld_amount > 0:
        ld_fund = await gl_mapping.resolve("ld_fund_liability")
        lines.append({"coa_id": ld_fund, "dr": 0, "cr": ld_amount,
                      "memo": "L&D fund deduction"})
    return await _post_journal(
        entry_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        description=f"Service Charge {sc.get('period')} - {sc.get('outlet_id')}",
        source_type="service_charge",
        source_id=sc["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=sc.get("outlet_id"),
        dim_brand=sc.get("brand_id"),
    )


async def post_for_incentive(run: dict, *, user_id: str) -> Optional[dict]:
    """Incentive posting: Dr Incentive Expense (5411), Cr Salary Payable (2130)."""
    total = float(run.get("total_amount", 0) or 0)
    if total <= 0:
        return None
    inc_acc = await gl_mapping.resolve("incentive_expense")
    payable = await gl_mapping.resolve("salary_payable")
    return await _post_journal(
        entry_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        description=f"Incentive {run.get('period')} - scheme {run.get('scheme_name','')}",
        source_type="incentive",
        source_id=run["id"],
        lines=[
            {"coa_id": inc_acc, "dr": total, "cr": 0,
             "memo": f"Incentive {run.get('period')}"},
            {"coa_id": payable, "dr": 0, "cr": total,
             "memo": "Incentive payable to employees"},
        ],
        user_id=user_id,
        dim_outlet=run.get("outlet_id"),
        dim_brand=run.get("brand_id"),
    )


async def post_for_voucher_issue(voucher: dict, *, user_id: str) -> Optional[dict]:
    """Voucher issuance (marketing/comp use):
    Dr Marketing Expense (or Customer Compensation), Cr Voucher Liability
    """
    value = float(voucher.get("value", 0) or 0)
    if value <= 0:
        return None
    purpose = (voucher.get("purpose") or "marketing").lower()
    if purpose == "customer_comp":
        exp_acc = await gl_mapping.resolve("customer_compensation")
    elif purpose == "staff":
        exp_acc = await gl_mapping.resolve("staff_meal_expense")
    else:
        exp_acc = await gl_mapping.resolve("marketing_expense")
    voucher_liab = await gl_mapping.resolve("voucher_liability")
    return await _post_journal(
        entry_date=voucher.get("issue_date"),
        description=f"Voucher issue {voucher.get('code')} ({purpose})",
        source_type="voucher_issue",
        source_id=voucher["id"],
        lines=[
            {"coa_id": exp_acc, "dr": value, "cr": 0,
             "memo": f"Voucher {voucher.get('code')}"},
            {"coa_id": voucher_liab, "dr": 0, "cr": value,
             "memo": "Voucher liability"},
        ],
        user_id=user_id,
        dim_outlet=voucher.get("outlet_id"),
    )


async def post_for_voucher_redeem(voucher: dict, *, user_id: str) -> Optional[dict]:
    """Voucher redemption: Dr Voucher Liability, Cr Cash/Revenue Other.

    Simplification: redemption settles the liability without adding sales (sales is
    recorded via daily_sales separately). Cr goes to Voucher Breakage Income only if
    over-redemption, else clear the liability against revenue contribution.
    Approach: Dr 2140 Voucher Liability, Cr 4020 Voucher Breakage Income.
    """
    amount = float(voucher.get("redeemed_amount", 0) or 0)
    if amount <= 0:
        return None
    voucher_liab = await gl_mapping.resolve("voucher_liability")
    breakage = await gl_mapping.resolve("voucher_breakage_income")
    return await _post_journal(
        entry_date=(voucher.get("redeemed_at") or datetime.now(timezone.utc).isoformat())[:10],
        description=f"Voucher redeem {voucher.get('code')}",
        source_type="voucher_redeem",
        source_id=voucher["id"],
        lines=[
            {"coa_id": voucher_liab, "dr": amount, "cr": 0,
             "memo": f"Redeem voucher {voucher.get('code')}"},
            {"coa_id": breakage, "dr": 0, "cr": amount,
             "memo": "Voucher cleared"},
        ],
        user_id=user_id,
        dim_outlet=voucher.get("redeemed_outlet_id") or voucher.get("outlet_id"),
    )


async def post_for_foc(foc: dict, *, user_id: str) -> Optional[dict]:
    """FOC entry: Dr expense by type, Cr Inventory (or Cash if no inventory link).

    foc_type → expense GL:
      staff_meal     → 5402 staff_meal_expense
      marketing      → 5401 marketing_expense
      customer_comp  → 5421 customer_compensation
      other          → use foc.gl_account_id if provided, else 5400
    """
    amount = float(foc.get("amount", 0) or 0)
    if amount <= 0:
        return None
    foc_type = (foc.get("foc_type") or "").lower()
    type_map = {
        "staff_meal": "staff_meal_expense",
        "marketing": "marketing_expense",
        "customer_comp": "customer_compensation",
    }
    if foc.get("gl_account_id"):
        exp_acc = foc["gl_account_id"]
    else:
        logical = type_map.get(foc_type, "marketing_expense")
        exp_acc = await gl_mapping.resolve(logical)
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=foc.get("outlet_id"))
    return await _post_journal(
        entry_date=foc.get("foc_date"),
        description=f"FOC {foc_type} {foc.get('doc_no','')}",
        source_type="foc",
        source_id=foc["id"],
        lines=[
            {"coa_id": exp_acc, "dr": amount, "cr": 0,
             "memo": foc.get("notes") or foc_type},
            {"coa_id": inv_acc, "dr": 0, "cr": amount,
             "memo": "FOC inventory release"},
        ],
        user_id=user_id,
        dim_outlet=foc.get("outlet_id"),
        dim_brand=foc.get("brand_id"),
    )


async def post_for_payroll(payroll: dict, *, user_id: str) -> Optional[dict]:
    """Payroll cycle posting (MVP): Dr Salary Expense, Cr Salary Payable.
    Advance repayment portion is offset against Employee Advance Receivable.
    """
    total_gross = float(payroll.get("total_gross", 0) or 0)
    advance_repay = float(payroll.get("total_advance_repayment", 0) or 0)
    take_home = float(payroll.get("total_take_home", 0) or 0)
    if total_gross <= 0:
        return None
    salary_expense = await gl_mapping.resolve("salary_expense")
    salary_payable = await gl_mapping.resolve("salary_payable")
    lines: list[dict] = [
        {"coa_id": salary_expense, "dr": total_gross, "cr": 0,
         "memo": f"Payroll {payroll.get('period')}"},
        {"coa_id": salary_payable, "dr": 0, "cr": take_home,
         "memo": "Net payable to employees"},
    ]
    if advance_repay > 0:
        ea_acc = await gl_mapping.resolve("employee_advance_receivable")
        lines.append({
            "coa_id": ea_acc, "dr": 0, "cr": advance_repay,
            "memo": "Advance repayment offset",
        })
    return await _post_journal(
        entry_date=payroll.get("payroll_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        description=f"Payroll {payroll.get('period')} {payroll.get('doc_no','')}",
        source_type="payroll",
        source_id=payroll["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=payroll.get("outlet_id"),
    )


async def post_for_opname(session: dict, *, user_id: str) -> Optional[dict]:
    """Opname variance:
       negative variance (less stock) → Dr COGS, Cr Inventory
       positive variance (more stock) → Dr Inventory, Cr Adjustment Income
    """
    total = float(session.get("total_variance_value", 0))
    if abs(total) < 0.01:
        return None
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=session["outlet_id"])
    if total < 0:  # less than system
        cogs_acc = await gl_mapping.resolve("cogs")
        amt = -total
        lines = [
            {"coa_id": cogs_acc, "dr": amt, "cr": 0, "memo": "Opname variance (less)"},
            {"coa_id": inv_acc, "dr": 0, "cr": amt, "memo": "Inventory reduction"},
        ]
    else:
        income_acc = await gl_mapping.resolve("adjustment_income")
        lines = [
            {"coa_id": inv_acc, "dr": total, "cr": 0, "memo": "Opname variance (more)"},
            {"coa_id": income_acc, "dr": 0, "cr": total, "memo": "Adj income"},
        ]
    return await _post_journal(
        entry_date=session["opname_date"],
        description=f"Opname {session.get('doc_no','')} period {session['period']}",
        source_type="opname",
        source_id=session["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=session["outlet_id"],
    )
