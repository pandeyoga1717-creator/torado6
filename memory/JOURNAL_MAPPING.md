# 📒 JOURNAL MAPPING — Business Event → Journal Entry
**Companion to:** ARCHITECTURE.md → Section 5.12 (journal_entries)  
**Version:** 1.0

For every business event in the system, this document specifies the **automatic journal entry** that gets generated. Critical for accountability, auditability, and report accuracy.

Format:
- **Event** — trigger
- **Dr / Cr** — standard double-entry
- **Dimensions** — outlet/brand/employee/vendor tags
- **Notes** — special cases, configurations

All account references are **logical names**; actual `coa_id` is mapped from a config table populated during setup. Standard Indonesian COA naming used.

---

## 1. SALES EVENTS

### 1.1 Daily Sales Submitted (cash + credit)
**Trigger:** outlet manager submits daily_sales; finance validates

```
Dr  Cash on Hand                     [cash portion]
Dr  Bank Account                     [transfer/QRIS portion]
Dr  Cards Receivable                 [card portion if pending settlement]
Dr  Discount Expense                 [if discount given]
  Cr  Revenue — Food                 [food bucket]
  Cr  Revenue — Beverage             [bev bucket]
  Cr  Revenue — Other                [other bucket]
  Cr  Service Charge Liability       [service portion if any]
  Cr  Output VAT (PPN Keluaran)      [tax portion]
```
Dimensions: `outlet_id`, `brand_id`, `sales_date`

**Notes:**
- Channel breakdown not in JE (analytics only)
- Service charge stored as liability until allocation period
- Auto-applies tax code from outlet config

### 1.2 Card Settlement (when bank confirms)
```
Dr  Bank Account                     [net amount received]
Dr  Card Processing Fee              [fee deducted]
  Cr  Cards Receivable               [original amount]
```

### 1.3 Refund
```
Dr  Revenue — [appropriate bucket]   [original amount]
Dr  Output VAT                       [if applicable]
  Cr  Cash on Hand / Bank            [refund method]
```

---

## 2. PROCUREMENT EVENTS

### 2.1 PO Sent
**Trigger:** PO sent to vendor  
**Journal:** **None** (memo entry only — no money movement yet)

### 2.2 Goods Received with Invoice (GR posted)
```
Dr  Inventory — [Outlet]             [GR total]
Dr  Input VAT (PPN Masukan)          [if applicable]
  Cr  Accounts Payable — [Vendor]    [invoice total inc tax]
```
Dimensions: `outlet_id`, `vendor_id`

**Notes:**
- Inventory account configurable per outlet/category
- If GR amount differs from invoice (variance), post adjustment via `inventory_movements` of type `adjustment`

### 2.3 GR without invoice yet (goods first, invoice later)
```
Dr  Inventory — [Outlet]             [estimated cost]
  Cr  Goods Received Not Invoiced    [accrual]
```
When invoice arrives:
```
Dr  Goods Received Not Invoiced       [original]
Dr  Input VAT                         [actual]
Dr/Cr Variance Account                [if invoice amount differs]
  Cr  Accounts Payable — [Vendor]    [invoice total]
```

### 2.4 PO Cancellation after partial GR
- Reverse the GR portion not received
- Audit-trailed reversal

---

## 3. PAYMENT EVENTS

### 3.1 Payment to Vendor (settle AP)
```
Dr  Accounts Payable — [Vendor]      [paid amount]
  Cr  Bank Account / Cash            [paid amount]
```
If with discount:
```
Dr  Accounts Payable                  [original]
  Cr  Bank Account                    [paid net]
  Cr  Purchase Discount               [discount]
```

### 3.2 Payment to Other (no AP, direct expense)
```
Dr  [Expense Account]                 [amount]
Dr  Input VAT                         [if applicable]
  Cr  Bank Account / Cash             [amount]
```

### 3.3 Petty Cash Replenishment
```
Dr  Petty Cash — [Outlet]            [replenish amount]
  Cr  Cash on Hand / Bank Account    [replenish amount]
```
At the time of replenishment, also post the underlying expenses:
```
Dr  [Various Expenses]                [from PC transactions accumulated]
Dr  Input VAT                         [if any]
  Cr  Petty Cash — [Outlet]          [total replenish-equivalent]
```

### 3.4 Urgent Purchase (paid by outlet, settled via PC or expense claim)
```
Dr  [Expense / Inventory Account]     [amount]
Dr  Input VAT                         [if any]
  Cr  Petty Cash / Cash / Owner Loan  [if paid by manager personally]
```

### 3.5 Tax Payment
```
Dr  Output VAT                        [accumulated for period]
Dr  Tax Penalty Expense               [if late]
  Cr  Bank Account                    [tax paid]
  Cr  Input VAT                       [credit balance]
```

---

## 4. INVENTORY EVENTS

### 4.1 Stock Issue (consumption out)
Note: Since we **don't auto-deduct from BOM**, this happens via **opname variance** OR **manual adjustment**.

### 4.2 Transfer (between outlets)
**Outgoing outlet:**
```
Dr  Inventory in Transit              [cost]
  Cr  Inventory — Outlet A           [cost]
```
**Incoming outlet (when received):**
```
Dr  Inventory — Outlet B              [cost]
  Cr  Inventory in Transit            [cost]
```
If discrepancy on receive:
```
Dr  Inventory — Outlet B              [actual qty * cost]
Dr  Loss & Breakage / Variance        [diff]
  Cr  Inventory in Transit            [original]
```

### 4.3 Stock Adjustment (waste, damage, correction)
If decrease (loss):
```
Dr  Loss & Breakage / Damaged Goods   [variance value]
  Cr  Inventory — [Outlet]            [variance value]
```
If increase (correction up):
```
Dr  Inventory — [Outlet]              [variance value]
  Cr  Adjustment Income / Variance    [variance value]
```

### 4.4 Stock Opname Variance
**At submission**, sum of all variance values:
If negative variance (less than system):
```
Dr  Cost of Goods Sold (COGS)         [variance value]   ← consumption recognized
  Cr  Inventory — [Outlet]            [variance value]
```
If positive variance (more than system):
```
Dr  Inventory — [Outlet]              [variance value]
  Cr  Adjustment Income                [variance value]
```
Material variances (> threshold) require approval.

---

## 5. HR & INCENTIVE EVENTS

### 5.1 Employee Advance Disbursed
```
Dr  Employee Advance Receivable       [amount]
  Cr  Cash / Bank Account             [amount]
```
Dimensions: `employee_id`

### 5.2 Employee Advance Repayment (per termin)
Usually deducted from salary; if monthly:
```
Dr  Salary Expense                    [gross salary]
  Cr  Employee Advance Receivable     [termin amount deducted]
  Cr  Salary Payable                  [net]
```
OR if standalone repayment:
```
Dr  Cash / Bank                       [repaid]
  Cr  Employee Advance Receivable     [repaid]
```

### 5.3 Service Charge Allocation (Service 5%)
**At distribute date:**
```
Dr  Service Charge Liability          [total service]
  Cr  L&B Fund Liability               [lb_pct portion]
  Cr  L&D Fund Liability               [ld_pct portion]
  Cr  Salary Payable / Cash            [distributable to employees]
```
Then disburse:
```
Dr  Salary Payable                    [each share]
  Cr  Cash / Bank                      [each]
```

### 5.4 L&B Fund Use (compensate breakage)
```
Dr  L&B Fund Liability                [amount]
  Cr  Cash / Inventory replacement    [amount]
```

### 5.5 Incentive Calculation & Payment
```
Dr  Incentive Expense                 [accrued]
  Cr  Salary Payable                  [accrued]
```
Then pay:
```
Dr  Salary Payable                    [paid]
  Cr  Cash / Bank                     [paid]
```

---

## 6. VOUCHER EVENTS

### 6.1 Voucher Issued (free, marketing)
```
Dr  Marketing Expense / Promo Expense [face value if expensed at issue]
  Cr  Voucher Liability                [face value]
```
Alternative (deferred recognition):
```
Dr  Voucher Inventory (Asset)         [face value]
  Cr  Voucher Liability                [face value]
```
We use the **deferred recognition** pattern (simpler accounting trail).

### 6.2 Voucher Issued (sold to customer)
```
Dr  Cash / Bank                       [sale price]
  Cr  Voucher Liability                [sale price]
```

### 6.3 Voucher Redeemed (customer uses)
```
Dr  Voucher Liability                 [redeemed value]
  Cr  Revenue — [bucket]               [redeemed value]
```
If cogs_pct configured:
```
Dr  COGS                              [cogs_pct * redeemed value]
  Cr  Inventory                        [cogs_pct * redeemed value]
```

### 6.4 Voucher Expired (unused)
```
Dr  Voucher Liability                 [remaining value]
  Cr  Other Income — Voucher Breakage [remaining value]
```

---

## 7. FOC (Free of Charge) EVENTS

### 7.1 Staff Meal
```
Dr  Staff Meal Expense                [cost]
  Cr  Inventory — [Outlet]            [cost]
```

### 7.2 Marketing Comp / Promotional FOC
```
Dr  Marketing/Promo Expense           [cost]
  Cr  Inventory — [Outlet]            [cost]
  Cr  Revenue (offset, if MAP rule)   [if applicable]
```

### 7.3 Customer Compensation (e.g., spilled drink)
```
Dr  Customer Compensation Expense     [cost]
  Cr  Inventory                       [cost]
```

---

## 8. TRAVEL INCENTIVE

### 8.1 Driver Fee Recognition
```
Dr  Travel Incentive Expense          [fee_amount]
  Cr  Salary Payable / Cash           [fee_amount]
```
Dimensions: `driver_employee_id`

---

## 9. TAX EVENTS

### 9.1 Output VAT (recorded on sale)
```
... Cr  Output VAT                    [tax portion]
```
(captured in Sales journal)

### 9.2 Input VAT (recorded on purchase)
```
Dr  Input VAT                         [tax portion]
```
(captured in Procurement / Payment journal)

### 9.3 Periodic VAT Settlement (monthly)
```
Dr  Output VAT                        [accumulated period]
  Cr  Input VAT                       [accumulated period]
  Cr  VAT Payable                     [net positive]
```
If input > output (refund/carry-forward):
```
Dr  VAT Receivable                    [excess input]
```

---

## 10. PERIOD CLOSING ENTRIES

### 10.1 Accruals (pre-close)
For expenses incurred but not invoiced:
```
Dr  [Expense Account]                 [accrued]
  Cr  Accrued Expenses                [accrued]
```
Next period (reversing):
```
Dr  Accrued Expenses
  Cr  [Expense Account]
```

### 10.2 Closing Revenue & Expense to Income Summary (yearly)
*(Year-end only, not monthly)*
```
Dr  All Revenue Accounts (zero out)
  Cr  Income Summary                  [profit if positive]
```
Then:
```
Dr  Income Summary                    [if profit]
  Cr  Retained Earnings
```

### 10.3 SHU (Profit Sharing) Distribution
```
Dr  Retained Earnings                 [SHU amount]
  Cr  SHU Payable                     [allocated to recipients]
```
Then on payment, settle.

---

## 11. DEFERRED PAYMENT / POSTPONE

### 11.1 Postponed Bill (defer recognition not allowed; defer payment)
The **expense recognition** stays in original period; only the **payment** is deferred. So no special journal at postpone time. Payment journal happens when actually paid (per Section 3).

For visibility, `deferred_payments` collection tracks status, but the underlying KB stays "open" with an extended due date.

---

## 12. CORRECTIONS / REVERSALS

### 12.1 Reverse a Posted Journal
A new journal entry with **opposite Dr/Cr** of original, linked via `reversal_of`. Audit-trailed with reason.

### 12.2 Correction (different from reversal)
If only one line wrong:
- Reverse original (full)
- Post corrected version (full)
This preserves audit trail rather than "editing" original.

---

## 13. Configuration Mapping (COA Codes)

This logical mapping needs to be translated to actual COA IDs at setup. Stored in `system_settings`:

```json
{
  "gl_mapping": {
    "cash_on_hand": "<coa_id>",
    "bank_default": "<coa_id>",
    "cards_receivable": "<coa_id>",
    "revenue_food": "<coa_id>",
    "revenue_beverage": "<coa_id>",
    "revenue_other": "<coa_id>",
    "output_vat": "<coa_id>",
    "input_vat": "<coa_id>",
    "vat_payable": "<coa_id>",
    "accounts_payable": "<coa_id>",
    "inventory": { "<outlet_id>": "<coa_id>" },
    "inventory_in_transit": "<coa_id>",
    "cogs": "<coa_id>",
    "loss_breakage": "<coa_id>",
    "staff_meal_expense": "<coa_id>",
    "marketing_expense": "<coa_id>",
    "service_charge_liability": "<coa_id>",
    "lb_fund_liability": "<coa_id>",
    "ld_fund_liability": "<coa_id>",
    "salary_payable": "<coa_id>",
    "salary_expense": "<coa_id>",
    "employee_advance_receivable": "<coa_id>",
    "incentive_expense": "<coa_id>",
    "voucher_inventory": "<coa_id>",
    "voucher_liability": "<coa_id>",
    "travel_incentive_expense": "<coa_id>",
    "petty_cash": { "<outlet_id>": "<coa_id>" },
    "discount_expense": "<coa_id>",
    "purchase_discount": "<coa_id>",
    "goods_received_not_invoiced": "<coa_id>",
    "adjustment_income": "<coa_id>",
    "customer_compensation": "<coa_id>",
    "voucher_breakage_income": "<coa_id>",
    "retained_earnings": "<coa_id>",
    "income_summary": "<coa_id>",
    "shu_payable": "<coa_id>",
    "accrued_expenses": "<coa_id>",
    "tax_penalty_expense": "<coa_id>"
  }
}
```

---

## 14. Validation Rules

For every journal entry generated:
- [ ] sum(dr) === sum(cr)
- [ ] no postable to non-leaf COA
- [ ] entry_date within open period
- [ ] all required dimensions present (e.g., outlet_id for outlet-scoped events)
- [ ] source_type + source_id refer to existing record

---

## 15. Service Module: `journal_service`

Responsibilities:
1. Subscribe to business events (sales validated, GR posted, PAY paid, opname submitted, etc.)
2. Use mapping from this doc to construct JE
3. Resolve logical names to actual coa_id via `gl_mapping`
4. Validate (Dr=Cr)
5. Post journal entry (status=posted)
6. Link source_type/source_id
7. Trigger audit log entry

Pattern: Pub-sub or direct call (Phase 1: direct call from each service)

---

## 16. Test Scenarios (per phase)

Each phase that introduces new events MUST include test cases to verify journal correctness:

- Phase 2: Daily sales JE; petty cash purchase JE
- Phase 3: GR JE; transfer JE; opname variance JE
- Phase 4: Payment JE; tax JE; reversal JE
- Phase 5: EA JE; service charge JE; voucher JE; FOC JE; travel JE
- Phase 6: Anomaly detection should flag JE imbalance (should never happen but defensive)

---

## 17. Reporting Implications

**P&L** is built from JE lines tagged with revenue/COGS/expense COA types.
**Balance Sheet** from asset/liability/equity COA.
**Cashflow** (direct method) from JE lines touching cash/bank accounts, classified by source_type:
- `sales` → Operating inflow
- `payment` → Operating outflow (mostly)
- `transfer` (capital injection) → Financing
- etc.

Dimensions allow filtering reports by outlet/brand/employee/vendor without re-running the data layer.
