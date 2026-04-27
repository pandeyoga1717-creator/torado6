# 📊 EXCEL MAPPING — Excel → Aurora F&B System
**Source:** Data Columns Classification Analysis (Excel from user)  
**Target:** Aurora F&B system (Mongo schemas in `ARCHITECTURE.md`)  
**Version:** 1.0

This is the **migration playbook** — every column in current Excel mapped to the new system, with notes on transformation, validation, and improvements.

---

## A. Workbook: Purchasing Report 2026

### A1. Sheet `¡VRA` — Helper / external link
**Status:** 🗑 **Eliminated** — was importing recipient/account references via IMPORTRANGE.  
**System replacement:** Centralized **Vendor Master** (`vendors` collection) and **Bank Accounts** (`bank_accounts` collection) accessible to all modules — no more cross-workbook links.

---

### A2. Sheet `PGL` — Filtered list of OK-status purchases
**Status:** 🗑 **Eliminated** — it was just a filtered view of `Master`.  
**System replacement:** `daily_sales` and procurement reports include built-in filtering by status. No need for a separate "sheet of approved entries."

---

### A3. Sheet `ML` — Market List (Item Master + Price History)
**Status:** 🔄 **Split into 2 collections** (best practice: separate master from history).

| Excel Column | New Collection | New Field | Type | Notes |
|---|---|---|---|---|
| `ID` | `items` | `code` | string | Unique item code; if duplicates, deduplicate during import |
| `Regist Date` | `items` | `created_at` | datetime | If null, use import date |
| `Items` | `items` | `name` | string | |
| `Items` (alias local) | `items` | `name_local` | string | Optional Bahasa Indonesia version |
| `Unit` | `items` | `unit_default` | string | E.g., "kg", "pcs", "liter" |
| `Convert Unit` | `items` | `conversion_units` | array | Parse "1 dus = 24 pcs" → `[{unit:"dus", factor:24}]` |
| `Category` | `categories` (new ref) | `category_id` (FK) | UUID | If category doesn't exist, auto-create |
| `Direct Purchase` | `items` | `is_direct_purchase` | bool | |
| `Contra` | `items` | `contra_account_id` | UUID | Reference to COA |
| `Valid` | `items` | `active` | bool | True if Valid=Y |
| `Outlet flags` | `items` | `outlet_availability` | array of outlet_id | "flag" per outlet |
| `Price periods` (multi-col) | `item_price_history` | (new doc per period) | — | One doc per (item, vendor, period) |
| Price columns | `item_price_history.price` | number | | Indonesian thousand separator handling |
| Price valid_from | `item_price_history.valid_from` | date | | |
| Price valid_to | `item_price_history.valid_to` | date | | |

**Improvement notes:**
- Split: `items` = static master (one record per item), `item_price_history` = price changes over time
- Easier to track price evolution + multi-vendor history

---

### A4. Sheet `IKDO` — External link to KDO
**Status:** 🗑 **Eliminated** — was a cross-workbook IMPORTRANGE.  
**System replacement:** All KDO data lives in `purchase_requests` (with `source="KDO"`). No cross-workbook needed.

---

### A5. Sheet `IBDO` — External link to BDO
Same as IKDO. Eliminated. Replaced by `purchase_requests` with `source="BDO"`.

---

### A6. Sheet `Master` — Main Purchasing Ledger
**Status:** 🔄 **Split into multiple collections** based on transaction type.

| Excel Column | New Collection | New Field | Notes |
|---|---|---|---|
| `ID` | varies | `doc_no` or auto-generated UUID | Per doc type |
| `Date` | varies | `entry_date` or specific date field | |
| `Request ID` | `purchase_requests` | `id` | If exists |
| `Items` | line items | `item_id` (FK) | Match by name to `items` master; flag if not found |
| `Qty` | line items | `qty` | |
| `Unit` | line items | `unit` | |
| `Cost/Unit` | line items | `unit_cost` | |
| `Total` | line items | `total` | Validate qty * unit_cost = total ± Rp 1 |
| `Supplier/Store` | `vendors` | `vendor_id` (FK) | Match by name; if free-text "Indomaret" → create vendor with type="retail" |
| `Invoice No.` | `goods_receipts` or `urgent_purchases` | `invoice_no` | |
| `Payment Method` | `payment_methods` | `payment_method_id` | |
| `Paid By` | `payment_requests` | `paid_by_user_id` | |
| `Input By` | created_by | `created_by` | |
| `Remarks` | doc | `notes` | |
| `Categories` | `categories` | `category_id` | |
| `Validation` | doc | `status` (validated/rejected) | |
| `Delivery Status` | `goods_receipts` | `status` | |
| `GL mapping` | journal lines | `coa_id` | |

**Routing logic** (during migration):
- If `Request ID` present + multi-line item with PO indication → `purchase_orders` + `goods_receipts`
- If `Payment Method = "Petty Cash"` → `petty_cash_transactions`
- If `Payment Method = "Cash" / "Transfer"` direct → `urgent_purchases`
- If marked as direct purchase pre-PO → `urgent_purchases`

**Improvement notes:**
- Excel `Master` was a god-table mixing multiple concerns. We split by **transaction nature**.
- Each split entity has **clear lifecycle** (draft → approved → received → paid).

---

### A7. Sheet `KDO` — Kitchen Daily Order
**Status:** 🔄 Becomes `purchase_requests` with `source="KDO"`.

| Excel Column | New Field | Notes |
|---|---|---|
| `KDO-ID` | `doc_no` | Format "KDO-YYMM-XXXX" |
| `Items List` | `lines[].item_id` | One row per item; expand to lines |
| `Qty` | `lines[].qty` | |
| `Unit` | `lines[].unit` | |
| `Actual Cost/Unit` | `lines[].est_cost` | (was "actual"; now "estimated" pending PO) |
| `Total Actual Cost` | `lines[].total` | |
| `Kitchen Notes` | `notes` | |
| `fulfillment fields` | `status` | New: status state machine |

---

### A8. Sheet `BDO` — Bar Daily Order
Same as KDO, with `source="BDO"`. Mapped to `purchase_requests`.

---

### A9. Sheet `Calculation` — Aggregation summary
**Status:** 🗑 **Eliminated** — it was a derived summary of KDO/BDO request totals.  
**System replacement:** Real-time computed in **Procurement portal dashboard**. No manual sheet needed.

---

### A10. Sheet `Summary (PC)` — Weekly Petty Cash Control
**Status:** 🔄 Replaced by `petty_cash_transactions` collection + computed view.

**Issue with Excel:** Used "24 repeating period blocks" (1 block per week). This is **not normalized**. We replace with a single transactional table + filterable views.

| Excel Column (per block) | New Field in `petty_cash_transactions` |
|---|---|
| `Date` | `txn_date` |
| `Items` | `description` or linked `item_id` |
| `Qty` | `qty` (in line, if applicable) |
| `Unit` | `unit` |
| `Cost/Unit` | `unit_cost` |
| `Total Purchase` | `amount` |
| `Sources` | `source` (cash/replenishment/transfer) |
| `beginning amount` | computed: prior balance |
| `purchase total` | computed: aggregate by week |
| `remaining` | computed: running balance |

**Improvement:**
- Single timeline of transactions per outlet
- Auto-aggregate to any period (week/month/custom)
- Beginning/remaining balances computed, never manually entered
- Replenishment as a typed transaction with approval flow

---

## B. Workbook: Financial Report 2026

### B1. Sheet `VRA` — Recipient/account reference
Eliminated. Replaced by `vendors` + `bank_accounts` + `employees` masters.

---

### B2. Sheet `iEMP` — Employee reference (external)
Eliminated. Replaced by `employees` master.

---

### B3. Sheet `ACC` — Chart of Accounts
**Status:** 🔄 Becomes `chart_of_accounts` collection.

| Excel | New Field | Notes |
|---|---|---|
| `Nama akun per baris` (e.g., AP, Bank, Expense, Liability) | `name` | |
| Implied type | `type` | Asset/Liability/Equity/Revenue/COGS/Expense |
| Implied code | `code` | Generated if missing (e.g., "1100" for Cash) |

**Improvement:** Add formal hierarchy (`parent_id`, `level`), `normal_balance`, `is_postable`. Excel was flat list; new is **proper tree** matching standard Indonesian COA format.

---

### B4. Sheet `PL` — Income Statement (monthly + YTD)
**Status:** 🗑 **Eliminated as data source** — PL is now a **computed report**, not a manually maintained sheet.

The historical PL columns (Jan-Dec, sales, COGS, expense sections, annual total) are reproduced in real-time by the **Profit & Loss generator** based on posted journal entries.

Migration: import historical PL Excel for visual sanity check, but actual data comes from `journal_entries`.

---

### B5. Sheet `JAE` — Journal & Adjustment Entries
**Status:** 🔄 Becomes `journal_entries` collection.

| Excel Column | New Field | Notes |
|---|---|---|
| `ID` | `doc_no` | Format "JAE-YYMM-XXXX" |
| `Date` | `entry_date` | |
| `Descriptions` | `description` | |
| `Amount` | `lines[].dr` or `cr` | Routed by sign |
| `Dr` | `lines[].dr` | Per line |
| `Cr` | `lines[].cr` | |
| `Bill Check` | `lines[].memo` or attachment | |
| `Notes` | `description` (extended) | |
| `Validation` | `status` (draft/posted) | |
| `customer/event fields` | `lines[].dim_*` | Dimensions: outlet/brand/employee/vendor |

**Improvement:**
- Strict Dr/Cr balance enforcement (sum_dr = sum_cr per JE)
- Multi-dimensional posting (every line tagged with outlet/brand for analytics)
- Reversing journal supported (audit-trailed)
- Auto-generation from business events (sales, GR, payment)

---

### B6. Sheet `PR 2026` — Weekly payment request summary
**Status:** 🗑 Eliminated. Computed from `payment_requests` filtered by week.

---

### B7. Sheet `PAY` — Payment Request & Cash-equivalent Ledger
**Status:** 🔄 Becomes `payment_requests` collection.

| Excel Column | New Field |
|---|---|
| `ID` | `doc_no` ("PAY-YYMM-XXXX") |
| `Invoice of PR Date` | `invoice_date` |
| `Descriptions` | `description` |
| `Amount` | `amount` |
| `Account(Db)` | `gl_debit_id` |
| `Pay Method(Cr)` | `payment_method_id` |
| `Payment Date` | `payment_date` |
| `Invoice No.` | `invoice_no` |
| `Recipient` | `payee_text` (or `payee_id` if matched to vendor/employee) |
| `Bank Account` | `bank_account_id` |
| `Ref ID` | `payment_ref` |
| `Remarks` | `notes` |
| `Notes` | (concat with remarks) |
| `Payment Mark` | `status` (paid/pending) |
| `Validation` | approval chain status |
| `Canceled` | `status=cancelled` |

**Improvement:**
- Approval chain (multi-tier) replaces simple validation flag
- Idempotency-key for double-prevention
- Auto-link to KB (vendor) when applicable

---

### B8. Sheet `Pay Sum` — Payment summary
Eliminated. Computed.

---

### B9. Sheet `KB` — Kontra Bon (AP Ledger)
**Status:** 🔄 Becomes `ap_ledger` collection.

| Excel | New Field |
|---|---|
| `ID` | `id` |
| `Pay-ID` | `payments[].pay_id` (when paid) |
| `Input Date` | `created_at` |
| `Invoice Date` | `invoice_date` |
| `Invoice No.` | `invoice_no` |
| `Vendor` | `vendor_id` |
| `Amount` | `amount` |
| `Due Date` | `due_date` |
| `Ending Balance` | `balance` (computed) |
| `Notes` | `notes` |
| `Status` | `status` (open/partial/paid) |
| `AP Status` | (merged into status) |
| `Payment Date` | from `payments[]` |
| `Payment ID` | from `payments[]` |

**Improvement:**
- Multiple partial payments tracked in array
- Aging calculated dynamically
- Auto-created from GR

---

### B10. Sheet `KBprint` — Print layout
**Status:** 🗑 Eliminated as data source. Becomes a **PDF print template** rendered from `ap_ledger` data on demand.

---

### B11. Sheet `EA` — Employee Advance / Salary Advance
**Status:** 🔄 Becomes `employee_advances` collection.

| Excel | New Field |
|---|---|
| `Date` | `advance_date` |
| `Descriptions` | `description` |
| `Grand Total` | `grand_total` |
| `Payment Method` | `payment_method_id` |
| `Payment Date` | `payment_date` |
| `Recipients` | `employee_id` |
| `Termin(month)` | `termin_count` |
| `Termin(qty)` | (merge into termin_count or per-month qty) |
| `Termin(Rp)` | `termin_amount` |
| `monthly amortization columns` | `schedule[]` (array of {period, amount, status}) |

**Improvement:**
- Schedule auto-generated from termin
- Each period payment tracked with status
- Notification on each due

---

### B12. Sheet `L & B` — Service distribution & L&B/L&D fund
**Status:** 🔄 Becomes `service_charge_periods` + `lb_fund_ledger`.

| Excel | New Collection.Field |
|---|---|
| `Periode Service` | `service_charge_periods.period` |
| `Tanggal Pembagian Service` | `distribute_date` |
| `Pendapatan Services` | `total_revenue_service` |
| `Loss & Breakages %` | `policy_snapshot.lb_pct` |
| `Learn & Development %` | `policy_snapshot.ld_pct` |
| `Services dibagikan` | `distributable_amount` |
| `Karyawan` | `allocations[].employee_id` |
| `Saldo Penyisihan` | `lb_fund_ledger.balance` |

**Improvement:**
- Policy snapshot frozen at calc time (audit-safe)
- LB fund as separate ledger with running balance

---

### B13. Sheet `L&B Summary`
Eliminated. Computed view.

---

### B14. Sheet `Service 5%` — Service charge allocation
**Status:** 🔄 Becomes part of `service_charge_periods.allocations[]`.

| Excel | New Field |
|---|---|
| `No.` | (auto-generated) |
| `Nama` | `employee_id` (FK) |
| `Jumlah Hari Service` | `days_service` |
| `Service Dibagikan` | `share_amount` |
| `repeated by period` | (separate doc per period) |

**Improvement:** No more repeating columns. One doc per (period, outlet). Allocation array.

---

### B15. Sheet `Refund` — Refund request form
**Status:** 🗑 Eliminated as data source. 

**Replacement:** Form workflow in Outlet Portal (Phase 5+). Refund as structured transaction:
```
{ id, refund_date, customer_name (optional), original_sale_id, amount, reason, status, journal_entry_id }
```

---

### B16. Sheet `SHU Summary` — Profit Sharing Summary
**Status:** 🔄 Becomes `shu_distributions` (new collection, Phase 5+).

| Excel | New Field |
|---|---|
| `Date` | `entry_date` |
| `Descriptions` | `description` |
| `Db` / `Cr` | journal lines |
| `Remaining` | `balance` |
| `Payment Method` | `payment_method_id` |
| `Payment Date` | `payment_date` |
| `Remarks` | `notes` |

---

### B17. Sheet `Tax Details` — Tax invoice tracking
**Status:** 🔄 Becomes `tax_details` collection.

| Excel | New Field |
|---|---|
| `DATE` | `tax_period` and `entry_date` |
| `DESCRIPTION` | `description` |
| `Invoice No.` | `invoice_no` |
| `CR(+)` | `tax_amount` (output VAT) |
| `DB(-)` | `tax_amount` (input VAT, marked) |
| `Payment Method` | `payment_method_id` |
| `Payment Date` | `paid_at` |
| `Recipients` | `payee_id` |
| `Remaining` | `balance` |
| `Remarks` | `notes` |

---

### B18. Sheet `Postpone` — Bill postpone / deferred payments
**Status:** 🔄 Becomes `deferred_payments` (new collection).

Excel had **"repeating blocks of Tanggal, Keterangan, Nominal"** — unstructured. We make it strict:
```
{ id, defer_date, description, amount, original_kb_id (link), reason, expected_pay_date, status }
```

---

### B19. Sheet `Incentive` — Employee incentive scheme
**Status:** 🔄 Becomes `incentives` collection + `incentive_schemes` (rules).

| Excel | New Field |
|---|---|
| `No` | (auto) |
| `Employee's Name` | `employee_id` |
| `Target Reach` | `achieved` |
| `%` | `achievement_pct` |
| `Incentive` | `incentive_amount` |
| `repeated by section` | (separate doc per period) |

**Improvement:**
- Schemes defined separately as `incentive_schemes` (BusinessRule)
- Calculation engine runs scheme rules per period
- Audit on rule snapshot at calc time

---

### B20. Sheet `FOC` — Free of Charge / Marketing budget
**Status:** 🔄 Becomes `foc_entries` collection.

| Excel | New Field |
|---|---|
| `Date` | `entry_date` |
| `Description` | `description` |
| `Db` | `debit_amount` |
| `Cr` | `credit_amount` |

Extended with: `outlet_id`, `category` (marketing/comp/staff_meal/other), `dr_account`, `cr_account`, auto journal.

---

### B21. Sheet `Voucher` — Voucher Issuance & Redemption
**Status:** 🔄 Becomes `vouchers` collection.

| Excel | New Field |
|---|---|
| `Voucher Code` | `code` |
| `Issued` | `issue_date` |
| `Expired` | `expire_date` |
| `Name` | `name` (purpose/recipient) |
| `Value` | `value` |
| `Claimed` | `claimed_amount` |
| `Remaining` | `remaining_amount` |
| `COGS %` | `cogs_pct` |
| `Payment Methods` | `payment_method_id` (when redeemed) |
| `Payment Date` | `redeem_history[].date` |
| `Voucher Used` | `status` |

---

### B22. Sheet `Travel Incentive`
**Status:** 🔄 Becomes `travel_incentives` collection.

| Excel | New Field |
|---|---|
| `Tanggal` | `entry_date` |
| `Driver` | `driver_employee_id` |
| `Travel` | `description` |
| `Vehicle` | `vehicle` |
| `Passenger` | `passenger_count` |
| `Bank` / `Account` | `bank_account` |
| `Bill No.` | `bill_no` |
| `Total Bill` | `total_bill` |
| `Fee 5%` | `fee_pct=0.05`, `fee_amount` |
| `Payment Status` | `payment_status` |

---

### B23. Sheet `DP Receipt` — Down Payment Receipt
**Status:** 🗑 Eliminated as data source. PDF print template rendered from related transaction.

---

## C. Cross-Workbook Master Data Consolidation

### C1. Vendor Master
Sources: `Master.Supplier/Store`, `KB.Vendor`, `PAY.Recipient`, `¡VRA`/`VRA`.
- **Action:** Dedup by name (fuzzy), normalize, create canonical `vendors` collection.
- **Quality issue:** "Indomaret" vs "INDOMARET" vs "Indomaret pojok" — manual review during migration.

### C2. Employee Master
Sources: `iEMP`, `Service 5%.Nama`, `EA.Recipients`, `Incentive.Employee's Name`, `Travel Incentive.Driver`.
- **Action:** Dedup by name + position. Create `employees` collection.

### C3. Item Master
Source: `ML` + items mentioned in `Master`/`KDO`/`BDO`.
- **Action:** Use `ML` as canonical; merge items found in transactions but missing from ML.

### C4. Chart of Accounts
Source: `ACC`.
- **Action:** Reorganize to standard hierarchical structure. Add codes if missing. Mark `is_postable`.

### C5. Payment Methods
Sources: scattered across `Master.Payment Method`, `PAY.Pay Method`, `EA.Payment Method`.
- **Action:** Canonical list: Cash, BCA Transfer, Mandiri Transfer, BRI Transfer, QRIS, Card, Petty Cash, Other.

### C6. Outlet Master
Deduce from data; user provides canonical list during onboarding.

### C7. Brand Master
Same as outlet — user provides.

---

## D. Migration Execution Plan (Phase 8)

### Step 1: Master Data Setup (Pre-Migration)
- Manual entry / Excel import: groups, brands, outlets, COA, tax codes, payment methods, bank accounts
- Bulk Excel import: items, vendors, employees, categories

### Step 2: Validation Pass
- Run report: "What's referenced in transactions but missing from masters?"
- Allow user to map or auto-create

### Step 3: Transactional Import (oldest period first)
- Per period (e.g., Jan 2026):
  - Import sales (manually entered or Excel)
  - Import procurement (Master sheet → PR/PO/GR/KB)
  - Import petty cash (Summary PC → transactions)
  - Import journal (JAE)
  - Import payment (PAY)
  - Import HR (EA, Incentive, Service Charge, etc.)
- Generate retroactive journal entries via journal_service
- Verify trial balance matches Excel manual calc

### Step 4: Reconciliation
- Trial balance Rp 0 diff vs Excel
- AP balance match
- Cash balance match
- Stock value match
- If diff: investigate, correct, re-run

### Step 5: Sign-off
- Stakeholder review
- Open period N+1
- Lock historical periods

---

## E. Issues with Existing Excel (Action Items)

| Issue | Action |
|---|---|
| `#REF!/IMPORTRANGE` broken links | Eliminated by centralized masters |
| Helper sheets mixed with data | Eliminated; print = render template |
| Repeating period blocks (24 weekly blocks) | Replaced by transactional table + computed views |
| Item master + price history mixed | Split into `items` + `item_price_history` |
| God-table `Master` purchasing | Split into PR/PO/GR/UrgentPurchase/PettyCash by nature |
| No formal COA structure | Built proper hierarchical COA |
| No audit trail | Every CRUD logged in `audit_log` |
| No approval chain | Multi-tier approval workflow engine |
| Manual PL maintenance | Auto-generated from posted journals |
| Free-text vendor (typo prone) | Vendor master with autocomplete |
| No period lock | Period management with lock + audit-overridable |
| No multi-dim analytics | Every JE line tagged with outlet/brand/employee/vendor |
