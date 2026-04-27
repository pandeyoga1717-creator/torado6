# 🔍 MODULE ENHANCEMENT PLAN — Aurora F&B
**Audit Date:** 2026-04-27 (after Phase 4 completion)
**Auditor:** Neo (Engineering)
**Phases Reviewed:** Phase 0 (Discovery) → Phase 4 (Finance & Executive)
**Source of Truth:** `PRD.md`, `MODULES.md`, `AI_FEATURES.md`, `RBAC_MATRIX.md`, `JOURNAL_MAPPING.md`, `PHASE_PLAN.md`

---

## 0. Executive Summary

**Status:** ⚙️ **Functional MVP, polish gaps significant**.

| Area | What's Built | Coverage vs PRD |
|---|---|---|
| Foundation (Auth, RBAC, Admin) | Phase 2 complete | **85%** — workflow & impersonation pending |
| Operasional (Outlet/Proc/Inventory) | Phase 3 complete | **70%** — multi-step wizards, AI smart-entry, kanban view pending |
| Finance & Executive | Phase 4 complete | **65%** — BS, Cashflow, Period Lock, Bank Recon, PAY workflow pending |
| AI Features | 2 of 6 truly functional | **35%** — OCR, Forecast, Tools-callable AI, Anomaly batch pending |
| HR & Incentive | Phase 5 not started | **0%** |
| Polish (responsive, PDF, accessibility) | Not addressed | **20%** |

**Overall completeness vs full PRD: ~55%.** Phase 5–8 will get us to ~95%; remaining polish is enhancement scope.

**Top 3 Critical Gaps requiring decision:**
1. **No Period Locking** — backdated entries possible, breaks audit integrity for closing
2. **No Multi-tier Approval Engine** — RBAC defines tiers but code uses single-tier hardcoded
3. **Daily Sales is single-form, not 5-step wizard** — UX gap vs PRD (but functionally complete)

**Top 3 Quick Wins (high value, low effort, ≤1 day each):**
1. Add OCR receipt component → reuse existing `LlmVision` integration  
2. Add "Last vendor & last price" hint to ItemAutocomplete  
3. Add brand-mix donut + period selector on Executive Dashboard

---

## 1. Module-by-Module Audit

### 1.1 EXECUTIVE PORTAL

#### Built ✅
- 8 KPI cards (Sales today/WTD/MTD, Inventory Value, AP Exposure, Pending Validation, Opname Pending, Buka P&L)
- SVG sales trend chart with day-range pills (7/14/30/60)
- AI Insights card (statistical anomaly + trend bullets)
- Conversational Q&A dialog with 4 suggested prompts
- Top Outlets bar visualization
- Onclick drill-down: AP→AP Aging, Pending→Validation, Inventory→Valuation

#### Gap vs MODULES.md §1 ⚠️
| Feature | Status | Severity |
|---|---|---|
| **Brand Drilldown page** (Overview / Outlets / Cost Structure / Trends tabs) | ❌ Not built | **HIGH** — core executive use case |
| **Outlet Drilldown page** (Daily Ops / P&L / Inventory Health / Staff Performance) | ❌ Not built | **HIGH** — core executive use case |
| **Brand Mix donut** chart on dashboard | ❌ Not built | MEDIUM |
| **AP Aging stacked bar** widget | ❌ Not built (only KPI tile) | MEDIUM |
| **Period selector** (Today/Week/Month/Quarter/YTD/Custom range) | ❌ Only chart days | MEDIUM |
| **Compare period overlay** (vs prev period) | ❌ Not built | MEDIUM |
| **Brand & Outlet multi-select filter** chips | ❌ Not built | HIGH |
| **Save Dashboard View** | ❌ Not built | LOW |
| **Live mode auto-refresh 60s** | ❌ Not built | LOW |
| **Export to PDF/PNG snapshot** | ❌ Not built | MEDIUM |
| **Full-screen AI Assistant** with sources panel right side, streaming, save history | ❌ Dialog only | MEDIUM |
| **Suggested questions auto-generated based on time of day / context** | ❌ 4 hardcoded | LOW |

#### Recommended Enhancement (Phase 7-aligned)
1. Add `BrandDrilldown.jsx` and `OutletDrilldown.jsx` pages with tab pattern (reuse Tabs from shadcn).
2. Replace hardcoded day pills with global `PeriodPicker` shared component (Today/Week/Month/Quarter/YTD/Custom).
3. Implement `MultiSelectFilter` chip component (brand_ids[] + outlet_ids[]) and pass to all `/api/executive/*` endpoints.
4. Add brand-mix donut using SVG (composition `<DonutChart series={byBrand} />`).
5. Backend: add `GET /api/executive/brand-mix?period=...` aggregating by `dim_brand` from `journal_entries.lines`.
6. Add `live` mode toggle that triggers `setInterval(load, 60000)` with subtle highlight on changed values.
7. Add PDF export via `html2canvas` + `jsPDF` on dashboard root.
8. Streaming LLM responses (use `LlmChat.send_message_stream` from emergentintegrations).

---

### 1.2 OUTLET PORTAL

#### Built ✅
- Today workbench (Outlet Home with task cards, KPIs, PC balance)
- Daily Sales (List + single-page Form + Detail with validate/reject by Finance)
- Petty Cash (List + dialog with type pills + AI GL Suggestion)
- Urgent Purchase (List + create dialog + finance approve)
- Stock opname trigger (delegated to Inventory)

#### Gap vs MODULES.md §2 ⚠️
| Feature | Status | Severity |
|---|---|---|
| **Daily Sales 5-step wizard** (Channel → Payment → Revenue → Service&Tax → Review) | ❌ Single form | MEDIUM — UX, not functional |
| **Step 5 reconciliation modal** with diff highlight | ❌ Inline alert only | LOW |
| **KDO sub-page** (kitchen daily order with quick-pick favorites) | ❌ Not built | **HIGH** — primary kitchen flow |
| **BDO sub-page** (bar daily order) | ❌ Not built | **HIGH** — primary bar flow |
| **Daily Close page** with checklist (sales submitted ✅, PC reconciled ✅, deposit slip uploaded) | ❌ Not built | **HIGH** — closes the daily loop |
| **AI Smart Entry** "type susu → suggest item + last vendor + last price" | ⚠️ Item autocomplete only | MEDIUM |
| **OCR receipt camera capture** for petty cash & urgent purchase | ❌ Not built | **HIGH** — top AI feature in PRD |
| **Auto-save draft every 5s** | ❌ Not built | LOW |
| **Photo upload + receipt attachment** (any txn) | ❌ No upload pipeline | **HIGH** — audit trail per PRD §6 NFR |
| **Notification when validated** (outlet sees green) | ⚠️ Partial — bell exists, dispatch incomplete | MEDIUM |
| **Multi-day backlog UI** (queue for Friday, Saturday submissions) | ❌ Not built | LOW |
| **Negative payment delta force note** | ❌ Not built (just toast error) | LOW |
| **Mobile responsive verification** | ❌ Not formally tested | **HIGH** — Outlet manager uses smartphone |
| **Offline tolerant queue** | ❌ Not built (Phase 7) | LOW |

#### Recommended Enhancement
1. **Refactor DailySalesForm into 5-step wizard** using stepper pattern (reuse PortalSubNav style):
   ```
   <Stepper steps={[Channel, Payment, Revenue, ServiceTax, Review]} />
   ```
   Each step validates locally; final Review step shows Reconciliation diff card.
2. **Build `KDORequest.jsx` and `BDORequest.jsx`** as child of Outlet portal — uses ItemAutocomplete with category filter (kitchen items vs bar items), submits as PR with `source="KDO"|"BDO"`.
3. **Build `DailyClose.jsx`** with checklist component:
   - ✅ Sales submitted (status='validated' for today)
   - ✅ PC reconciled (no pending replenishments)
   - ✅ All KDO/BDO acknowledged
   - 📎 Cash deposit slip upload (file)
   - Submit → set `outlet_status[outlet_id+date]='closed'`
4. **Build OCR Receipt component** `<ReceiptCapture onExtracted={...} />`:
   - Camera + file upload
   - Backend `POST /api/ai/extract-receipt` → uses `LlmVision` (Gemini 2.0 Flash) → returns `{vendor_name, date, total, items[], confidence_per_field}`
   - Form auto-fills with confidence indicators (✅/⚠/❌)
   - Image saved to `/app/uploads/receipts/{txn_id}.jpg` and linked
5. **Enhance ItemAutocomplete** to show:
   ```
   Susu UHT 1L
   Last: Toko Sumber, Rp 25.000/kg, 3 days ago
   ```
   Backend: `/api/ai/items/suggest` already returns suggestions; add `last_vendor_id`, `last_unit_cost`, `last_purchase_date` from goods_receipts aggregation.
6. **Mobile responsive audit pass** — test all outlet pages at 375px width; fix grid breakpoints and table → card transformation.
7. **Auto-save draft**: useEffect polling form state, debounce 5s, POST to `/outlet/daily-sales/draft` with same id.
8. **Notification dispatcher**: when finance validates/rejects DS → emit notification to outlet manager via `notification_service.create({user_id, type, title, link})`.

---

### 1.3 PROCUREMENT PORTAL

#### Built ✅
- Home with KPIs (Pending PR, Open PO, GR Today, AP Due) + Recent PR/PO lists
- PR (List + Form with ItemAutocomplete + Detail with ApprovalChain + Approve/Reject)
- PO (List + Form prefilled from PR via URL param + Send/Cancel)
- GR (List + Form prefilled from PO + variance highlight + AP journal posting)

#### Gap vs MODULES.md §3 ⚠️
| Feature | Status | Severity |
|---|---|---|
| **Kanban Workboard** (New PR → Awaiting Approval → Ready to PO → PO Sent → Receiving Pending) | ❌ Not built | **HIGH** — primary daily view per PRD |
| **Bulk Consolidate** (select multiple PRs → single PO with grouped lines) | ❌ Not built | **HIGH** — efficiency core |
| **Vendor Comparison panel** (last 3 prices per vendor for items in PO) | ❌ Not built | **HIGH** — core procurement feature |
| **AI Vendor Recommendation** (best vendor for PO based on price+history+performance) | ❌ Not built | **HIGH** — top AI feature |
| **Standalone Vendor Comparison tool** (`/procurement/vendor-comparison`) | ❌ Not built | MEDIUM |
| **PDF PO generation** + email/WA send button | ❌ Not built | **HIGH** — operational gap |
| **3-Way Match dashboard** (PO vs GR vs Invoice variance flag) | ⚠️ Variance highlight in GR only, no dashboard | MEDIUM |
| **Vendor Performance Scorecard** (on-time %, price stability, defect rate) | ❌ Not built | **HIGH** — strategic |
| **Multi-tier amount-based Approval Chain** (configurable per RBAC §6) | ⚠️ Single-tier hardcoded `procurement.pr.approve` | **HIGH** — RBAC compliance |
| **Reverse GR + KB on cancellation after partial receive** | ❌ Not built | MEDIUM |
| **Vendor Master Detail page** (with performance graphs) | ⚠️ CRUD only in Admin | MEDIUM |

#### Recommended Enhancement
1. **Replace ProcurementHome with Kanban Workboard**:
   ```
   <KanbanBoard
     columns={['New', 'Awaiting Approval', 'Ready to PO', 'Sent', 'Receiving']}
     cards={prs + pos}
     onDrag={(card, toCol) => updateStatus(card.id, toCol)}
   />
   ```
   Use `@dnd-kit` library OR simple pure-CSS columns with action buttons.
2. **Build `BulkConsolidate.jsx`**:
   - PR list with checkbox per row
   - "Consolidate (3 selected)" button → opens PO Form prefilled with merged lines (group by item_id, sum qty, weighted-avg est_cost).
3. **Add `VendorComparison.jsx` shared component** (used in PO Form right panel + standalone page):
   ```
   GET /api/procurement/vendor-comparison?item_ids[]=...&periods=last_90d
   → returns matrix: vendors × items with last 3 prices each
   ```
4. **AI Vendor Recommendation** endpoint:
   ```
   POST /api/ai/procurement/suggest-vendor
   body: {item_ids, qty_needed_each}
   → calls LLM with vendor history + scorecard data → returns ranked list with reason
   ```
5. **PDF PO generation**:
   - Backend: use `weasyprint` or `reportlab` to render HTML template → PDF
   - `GET /api/procurement/pos/{id}/pdf` → returns binary
   - Frontend: download button + email button (server-side SMTP — Phase 7)
6. **Vendor Scorecard `/procurement/vendors/{id}/scorecard`**:
   - On-time delivery % (GR.receive_date vs PO.expected_delivery_date)
   - Price stability (stddev of unit_cost across GRs)
   - Defect rate (sum of qty_ordered - qty_received)
   - Lead time avg (days between PO.sent_at and GR.receive_date)
7. **Multi-tier Approval Engine** (cross-cutting, see §3 below).
8. **3-Way Match alert** on Procurement Home: count of GRs where invoice_total > PO.grand_total or qty_received > qty_ordered.

---

### 1.4 INVENTORY PORTAL

#### Built ✅
- Home with KPIs (Inventory Value, Item Count, Outlets, Opname Active) + Recent Movements + Per-Outlet Valuation
- Stock Balance list (filter outlet + search)
- Movements (filter type/outlet/date)
- Transfers (List + create dialog + send/receive lifecycle)
- Adjustments (List + create dialog + approve action with auto-journal)
- Opname (List + Start dialog + Counting workbench with variance live calc + submit)
- Valuation (per-outlet bar chart with %)

#### Gap vs MODULES.md §4 ⚠️
| Feature | Status | Severity |
|---|---|---|
| **Stock Balance MATRIX** (rows=items × cols=outlets, single grid) | ❌ List view only | **HIGH** — PRD specifically says matrix |
| **Movement history modal** on cell click | ❌ Not built | MEDIUM |
| **Low Stock Alert UI** (par level threshold per item per outlet) | ❌ Model has `par_levels` field, no UI | **HIGH** — core procurement trigger |
| **Stock Alert Dashboard** widget | ❌ Not built | MEDIUM |
| **AI Variance Explainer** ("variance besar di susu, kemungkinan: ...") | ❌ Not built | MEDIUM |
| **Transfer Detail proper page** | ⚠️ Placeholder stub | MEDIUM |
| **Transfer Approval flow** (>threshold → manager approve before send) | ❌ Not built | MEDIUM |
| **Adjustment Approval Threshold** (auto-route based on amount) | ⚠️ Manual approve, no threshold logic | MEDIUM |
| **Item-without-cost handling** (estimated cost flag) | ❌ Not built | LOW |
| **Negative stock prevention via row-lock** | ❌ Not built | MEDIUM — race condition risk |
| **Print labels for opname** | ❌ Phase 7 deferred | LOW |
| **Barcode scan during opname** | ❌ Phase 7 deferred | LOW |

#### Recommended Enhancement
1. **Add `StockBalanceMatrix.jsx` view toggle** (List ↔ Matrix):
   - Matrix: pivot data by item × outlet (using existing `/api/inventory/balance`)
   - Cell click → modal with last 30 movements for that item+outlet
   - Heatmap coloring: red=below par, green=above par, gray=zero
2. **Low Stock Alert**:
   - New endpoint `GET /api/inventory/low-stock` → join `stock_balance` with `items.par_levels` → return items where qty < par
   - Inventory Home widget: "5 items below par level"
   - Quick action: "Buat PR dari list ini" → seed PR Form with these items.
3. **AI Variance Explainer** (Phase 7):
   ```
   POST /api/ai/inventory/explain-variance
   body: {opname_session_id}
   → LLM analyzes movement history + sales pattern → returns top 3 plausible reasons per outlier item
   ```
4. **Transfer Detail page**: read-only view with line items, status timeline, action buttons (send/receive/cancel), linked JE.
5. **Adjustment Threshold**: per `business_rules.adjustment_approval_threshold` (default Rp 500,000). If `total_value > threshold` → status=`submitted` (needs INV_MGR approve). Else auto-approve.
6. **Optimistic Concurrency**: add `version` field to `stock_balance` doc → check on update, retry once on conflict.

---

### 1.5 FINANCE PORTAL

#### Built ✅
- Home (counters: Pending Validation, JE Period, AP Exposure, Rejected DS)
- Validation Queue (validate/reject with reason)
- Journals (filter by period/source/COA/outlet/search, paginated)
- Journal Detail (lines + source link drill-down + reverse with reason)
- Manual JE Form (live balance check, multi-line, dim_outlet/dim_brand)
- Trial Balance (period+outlet filter, balanced indicator, CSV export)
- P&L (sections + summary cards + prev-period compare + CSV)
- AP Aging (5 buckets + per-vendor expandable rows + CSV)
- COA Browser (read-only with filters)

#### Gap vs MODULES.md §5 ⚠️ (and JOURNAL_MAPPING.md)
| Feature | Status | Severity |
|---|---|---|
| **Period Closing Wizard** (8 steps) | ❌ Deferred to Phase 6 | **HIGH** — accounting integrity |
| **Period Lock / Unlock** UI + enforcement | ⚠️ Backend has `_ensure_period_open` but creates as open; no UI to lock | **HIGH** |
| **Balance Sheet** report | ❌ Not built | **HIGH** — PRD §11 KPI |
| **Cashflow Report** (direct method) | ❌ Not built | **HIGH** — PRD §11 KPI |
| **Bank Reconciliation** (CSV upload, fuzzy match) | ❌ Not built | **HIGH** — PRD §13 confirmed Phase 4 |
| **Tax Details page** (PPN-In/Out/Other per period) | ❌ Not built | **HIGH** — Indonesian compliance |
| **Periodic VAT Settlement journal** auto-trigger | ❌ Not built | MEDIUM |
| **Petty Cash Settlement page** (weekly/biweekly review + replenish) | ❌ Not built | **HIGH** — outlet+finance loop |
| **Payment Request (PAY) form + workflow** | ❌ Not built | **HIGH** — closes AP loop |
| **Card Settlement journal** (when bank confirms card receipts) | ❌ Not built | MEDIUM |
| **Refund journal** | ❌ Not built | MEDIUM |
| **GR-Without-Invoice (Goods Received Not Invoiced)** accrual | ❌ Not built | MEDIUM |
| **Reversing Accruals** (period-end + period-start) | ❌ Not built | MEDIUM |
| **Multi-dimensional report filters** (by employee, vendor, brand) | ⚠️ Dimension stored, no UI filter | MEDIUM |
| **Bulk Validate** option in Validation Queue | ❌ Not built | LOW |
| **AI anomaly flag during validation** (sales anomaly badge) | ❌ Not built | MEDIUM |
| **AI categorize in Manual JE** (description → suggest counter account) | ❌ Not built | MEDIUM |
| **PL drill to transaction** (click PL row → JE filtered) | ⚠️ Link generated but JE filter by `coa_id` not yet wired in URL | LOW |
| **Three-way match flag dashboard** | ❌ Not built | MEDIUM |
| **Year-end Closing Entries** (Income Summary, Retained Earnings) | ❌ Not built | LOW (year-end) |

#### Recommended Enhancement
1. **Period Closing Wizard** (`/finance/period-closing/{period}`):
   - 8-step wizard with progress bar
   - Each step has API check + status (✅/⚠/❌) + recommended action
   - Final step: lock period (only Finance Manager)
   - Backend: `POST /api/finance/period/{period}/lock` updates `accounting_periods.status='locked'`
2. **Balance Sheet** `/finance/balance-sheet?as_of=YYYY-MM-DD`:
   - Group COA by type: Asset / Liability / Equity
   - Calculate ending balance per COA up to as_of date
   - Validate: Total Assets = Total Liabilities + Equity (with diff alert)
3. **Cashflow Report** (direct method):
   - Filter JE lines touching cash/bank COAs
   - Classify by `source_type`: Operating (sales, payment, petty_cash, payroll), Investing, Financing
   - 30-day calendar view with running balance
4. **Bank Reconciliation** `/finance/bank-recon`:
   - Upload CSV (bank mutation: date, amount, description)
   - Backend: parse + fuzzy match to PAY entries by date+amount±tolerance
   - UI: matched (auto-tick) vs unmatched (manual reconcile)
   - Submit → mark all as reconciled
5. **PAY Form & Workflow** `/finance/payments/new`:
   - Select vendor → list open AP invoices → select to pay
   - Or manual: payee, amount, GL debit, payment method
   - Approval chain (amount-tier driven by `business_rules.payment_approval_chain`)
   - On `mark_paid` → post journal Dr AP, Cr Bank/Cash
6. **Tax Details page** `/finance/tax`:
   - Per period: list all JE lines with COA in `[output_vat, input_vat]`
   - Summary card: PPN-Out – PPN-In = PPN-Payable
   - "Generate Settlement JE" button → posts Dr Output VAT, Cr Input VAT, Cr VAT Payable
7. **Petty Cash Settlement** `/finance/petty-cash-settlement`:
   - List of outlets needing PC replenishment (balance < threshold OR oldest unreplenished txn > N days)
   - Per outlet: review accumulated PC purchases → approve replenish amount → post journal Dr Petty Cash, Cr Bank
8. **AI Categorize integration** in `ManualJournalForm.jsx`:
   - When user types description on a line → call `/api/ai/categorize/suggest` → show top-3 COA suggestions inline
   - "Accept" → fills COA + creates rule (POST `/categorize/learn`)
9. **AI Anomaly during validation**: in ValidationQueue, fetch `/api/ai/insights/anomalies` and badge any DS with z-score > 1.6.

---

### 1.6 HR & INCENTIVE PORTAL — **Phase 5 (Not Started)**

Refer to `MODULES.md §6`. Will be addressed in Phase 5 kickoff. Key MVP scope:
- Employee Master CRUD (currently model exists, no UI)
- Employee Advance (EA) + auto-amortization schedule + journal
- Service Charge calculator (5% from sales × period × deduct L&B/L&D × allocate by service days)
- Incentive Scheme (configurable formula per outlet/role) + auto-calc
- L&B Fund Ledger
- Voucher (issue/redeem/expire) with deferred recognition journal
- FOC (staff meal, marketing comp, customer compensation)
- Travel Incentive

**Estimated effort:** ~4–5 days (similar to Phase 3 since most is form + journal)

---

### 1.7 ADMIN PLATFORM

#### Built ✅
- Users CRUD (with role + outlet scope)
- Roles CRUD (with permission picker)
- MasterData tabbed CRUD (Items, Vendors, Employees, COA, Categories, Tax Codes, Payment Methods, Bank Accounts)
- AuditLog (filter by user/entity/action/date)
- NumberSeries (CRUD)

#### Gap vs MODULES.md §7 ⚠️
| Feature | Status | Severity |
|---|---|---|
| **Bulk Excel Import** for master data | ❌ Not built | **HIGH** — primary onboarding flow |
| **BusinessRules editor** (per rule type with helper UI) | ❌ Model exists, no UI | **HIGH** — needed for approval chains, sales schema, etc |
| **Workflows / Approval Chain UI** | ❌ Not built | **HIGH** — RBAC §6 says configurable |
| **Notifications config** (which event → which user/role) | ❌ Not built | MEDIUM |
| **Impersonate User** (super admin only) | ❌ Not built | MEDIUM |
| **AuditLog full-text search** | ⚠️ Filter only | LOW |
| **AuditLog export** | ⚠️ No export | LOW |
| **System Settings** (gl_mapping editor, currency, fiscal year) | ⚠️ Backend reads from DB but no UI | MEDIUM |
| **Backup management** | ❌ Phase 8 | LOW |

#### Recommended Enhancement
1. **Bulk Excel Import** `/admin/master-data?import=items`:
   - Drop-zone for `.xlsx`
   - Backend: parse via `openpyxl` → validate row by row → preview table with errors highlighted → "Confirm Import"
   - For Items: required cols code/name/category_code/unit_default; optional sku/par_levels/etc.
2. **BusinessRules editor**:
   - List view grouped by `rule_type`
   - Per type: dedicated form (e.g., approval_workflow → tier table editor)
   - JSON-form fallback for unknown types
   - Effective dating (effective_from / effective_to)
3. **Workflows** (specific BusinessRule type):
   - Visual chain builder: amount tier → required role(s) → notify role(s)
   - Default seeded per RBAC §6
4. **System Settings UI** `/admin/system-settings`:
   - Tab 1: GL Mapping (editor with COA picker per logical name) — currently seeded but no UI
   - Tab 2: General (fiscal_year_start, currency_default, timezone)
   - Tab 3: Notifications config
5. **Impersonate**: super-admin clicks "Login as user X" → token swap → all subsequent actions tagged `impersonated_by`. Audit-trailed.

---

## 2. CROSS-PORTAL FEATURES — Audit

| Feature | Status | Gap |
|---|---|---|
| **Global Search (Cmd+K)** | ✅ Built | OK |
| **Notification Center** | ⚠️ Bell + drawer built, but auto-creation on events incomplete | Wire dispatcher in services |
| **Theme Toggle** | ✅ Built | OK |
| **AI Chat Drawer (anywhere)** | ⚠️ Only in Executive | Promote to global floating button (FAB) |
| **Saved Filters / Views** | ❌ Not built | |
| **Bulk Actions** | ❌ Not built (no list page has bulk select) | Add bulk validate, bulk approve, bulk export |
| **Print/Export PDF** | ⚠️ CSV on TB/PL/AP only; no PDF | Add `html2canvas + jsPDF` or backend PDF |
| **Excel Export** | ❌ CSV only | Add `xlsx` library |
| **Keyboard Shortcuts** (`n`, `Esc`, `?`) | ⚠️ Only Cmd+K | Add shortcut overlay (`?` shows list) |
| **Onboarding Tour** (first login) | ❌ Not built | Use `react-joyride` or similar |
| **URL deep-link with filters** | ⚠️ Partial — some filters in URL, some in state | Standardize via `useSearchParams` |
| **Breadcrumbs** | ❌ Not built | Add for multi-level paths |

---

## 3. ARCHITECTURAL & CROSS-CUTTING GAPS

### 3.1 🔴 Period Locking — CRITICAL
- **Problem**: `accounting_periods` collection auto-creates period as `open` when first JE posts, but **no UI to transition `open → closed → locked`**. Backdated entries possible indefinitely.
- **Impact**: Closing period is meaningless; audit can fail.
- **Fix**: Phase 4M follow-up OR Phase 6 priority 1.
  - Add `accounting_periods` CRUD endpoint
  - Add `/finance/periods` page with status, lock/unlock action
  - Enforce in `_ensure_period_open` (already done) + add `finance.period.write_to_locked` permission for exceptions

### 3.2 🔴 Multi-Tier Approval Engine — CRITICAL
- **Problem**: RBAC matrix §6 defines amount-based tiers (e.g., PR <1jt self-approve, 1–10jt → PROC_MGR, 10–50jt → PROC_MGR + FN_MGR, >50jt → +GM). Currently every approve endpoint uses **single permission check**. No chain.
- **Impact**: Cannot enforce dual-approval; configurability promise broken.
- **Fix**: Build approval engine in Phase 6:
  - Collection `approval_chains` with steps `[{role, condition_amount, status, approved_by, approved_at}]`
  - Service `approval_service.evaluate(entity_type, entity, action)` → returns next required role(s) or `complete`
  - All approve endpoints route through this
  - UI: ApprovalChain.jsx already has visualization → just needs the engine

### 3.3 🟡 File Upload & Attachment Service — HIGH
- **Problem**: PRD requires **receipt photo upload** (audit trail), **deposit slip upload** (daily close), **bank CSV upload** (recon). Currently no upload pipeline.
- **Impact**: No way to attach evidence to transactions.
- **Fix**:
  - Backend `POST /api/uploads` (multipart/form-data, virus scan placeholder, save to `/app/uploads/{type}/{yyyy-mm}/{uuid}.{ext}`)
  - Return `{file_id, url}` for client linking
  - Add `attachments[]` field to PettyCashTxn, UrgentPurchase, GR, BankRecon, DailyClose
  - UI shared `<FileDrop accept="image/*,application/pdf" />` component

### 3.4 🟡 Email Notification — HIGH
- **Problem**: PRD §13 says "in-app + email (Phase 1)". Only in-app done.
- **Impact**: Approvers don't get alerts; outlet manager misses validation rejection.
- **Fix**: Add SMTP integration (e.g., SendGrid via EMERGENT_LLM_KEY pattern? or BYO).
  - `notification_service.create()` async → send email if user.notify_email_on_event
  - Templates per event type

### 3.5 🟡 Background Job Scheduler — MEDIUM
- **Problem**: Daily anomaly batch (06:00 WIB), period closing reminders, low-stock alerts, EA amortization → **no scheduler**. Currently AI insights computed on-demand.
- **Impact**: AI insights are slow (5-15s wait); no proactive notifications.
- **Fix**: Add `apscheduler` (already in Python ecosystem) or background `asyncio.create_task` with cron-like patterns. Persist last-run.

### 3.6 🟡 Audit Log Coverage — MEDIUM
- **Problem**: `core/audit.py` exists but only called for high-impact actions (JE post, user CRUD). PRD §6 NFR says **every CRUD on transactional/financial entity**.
- **Impact**: Compliance gap.
- **Fix**: Add audit decorator/middleware for all `POST/PUT/PATCH/DELETE` on transactional collections (sales, PR, PO, GR, transfer, adj, opname, payment).

### 3.7 🟢 AI Service Module Layout — MEDIUM
- **Problem**: AI_FEATURES.md §8 prescribes structured layout `services/ai/{client,chat,ocr,autocomplete,anomaly,forecast,categorize,tools,prompts,cache,schemas}.py`. Currently we have flat `ai_service.py` + `ai_insights_service.py`.
- **Impact**: Becomes harder as AI features grow (Phase 7).
- **Fix**: Refactor in Phase 7 kickoff.

### 3.8 🟢 LLM Tool-Calling — MEDIUM
- **Problem**: Conversational Q&A currently does **prompt-grounded synthesis** (passes JSON context to LLM). PRD AI_FEATURES.md §1 specifies **function-callable tools** (LLM dynamically chooses `get_pl_breakdown`, `get_outlet_ranking`, etc).
- **Impact**: Less flexible; can't answer questions outside KPI/trend snapshot.
- **Fix**: Use `LlmChat` with `tools=[tool_definitions]`. Already supported by emergentintegrations.

### 3.9 🟢 Mobile Responsiveness Audit — HIGH (especially Outlet Portal)
- **Problem**: PRD says outlet portal MUST be smartphone-first. Current builds at 1920×800; tables don't stack on mobile; some forms have narrow inputs.
- **Fix**: Run accessibility + responsive audit. Add `lg:` Tailwind breakpoints; transform tables → cards on `<md`. Test on iPhone 12 (390px) and Galaxy S20 (360px).

### 3.10 🟢 PDF/Excel Export — MEDIUM
- **Problem**: CSV only. PRD §13 requires Excel; PO needs PDF.
- **Fix**: Add `xlsx` (SheetJS) for Excel. Add backend `weasyprint` for PDF.

---

## 4. AI FEATURES — Detailed Audit vs AI_FEATURES.md

| # | Feature | Built | Coverage | Gap |
|---|---|---|---|---|
| 1 | **Executive AI Assistant** | ⚠️ Q&A dialog only | 30% | Tool-calling, sources panel right-side, streaming, save history, suggested questions auto-generated, full-screen page |
| 2A | **Item/Vendor Autocomplete** | ⚠️ Item only | 50% | Last vendor/price hint, vendor autocomplete uses local fuzzy only |
| 2A | **GL Suggestion** | ⚠️ Petty cash only | 40% | Manual JE form, urgent purchase, learning rule persistence |
| 2B | **OCR Receipt** | ❌ | 0% | Build component + backend `/api/ai/extract-receipt` (Gemini Vision) |
| 3 | **Daily Anomaly Detection** | ⚠️ z-score on sales only | 25% | Daily batch job, all 8 anomaly categories (expense spike, missing DS, PC imbalance, opname variance, AP overdue, approval bottleneck, unusual PAY), LLM Explainer per anomaly, notification dispatch, "Acknowledge/Investigate/Escalate" actions |
| 4 | **Forecasting** (sales/inventory/cashflow) | ❌ | 0% | Build Prophet baseline + LLM context inject |
| 5 | **AI Categorization** | ⚠️ Single suggestion only | 40% | Local rule engine (regex/keyword grow over time), top-3 candidates, confidence-driven UX |
| 6 | **Conversational Q&A on Reports** | ❌ | 0% | "Ask AI about this" button per report; report data preloaded as context; highlight cell tool |

**Recommended AI Roadmap (post-Phase 5):**
- **Phase 6 sprint 1**: OCR Receipt (#2B), AI Categorize learning (#5), all anomaly categories (#3)
- **Phase 6 sprint 2**: Tool-calling executive AI (#1), Q&A on reports (#6)
- **Phase 7**: Forecasting (#4), inventory variance explainer

---

## 5. NON-FUNCTIONAL REQUIREMENTS — Audit

| NFR (PRD §6) | Target | Current | Status |
|---|---|---|---|
| API p95 ≤ 500ms | 500ms | Untested | ⚠️ Need k6 / Apache Bench load test |
| Dashboard load ≤ 3s | 3s | Executive ~5–15s (AI blocking) | ⚠️ AI Insights blocks render — make truly async |
| Bulk opname load 1000 items | ≤ 5s | Untested at scale | ⚠️ Need stress test |
| 50 concurrent users | No degradation | Untested | ⚠️ |
| RBAC scoped by outlet/brand | Required | Partial — most endpoints check user.outlet_ids; some bypass | ⚠️ Audit each endpoint |
| Audit log immutable | Required | ⚠️ Soft delete fields exist on collection | OK |
| Password hash bcrypt | bcrypt | ✅ | OK |
| JWT 24h + refresh 7d | Yes | ✅ | OK |
| Backup MongoDB daily 30d | Yes | ❌ | Phase 8 |
| Localization id+en | Yes | id only (UI strings) | ⚠️ Add i18n layer (react-i18next) |
| Format Rupiah, DD MMM YYYY, Asia/Jakarta | Yes | ✅ via `format.js` | OK |
| Mobile responsive (Outlet) | Yes | ⚠️ Untested | Audit needed |
| WCAG AA contrast | Yes | ⚠️ Glass elements may fail | Need contrast checker |
| Keyboard nav | Yes | ⚠️ Modals OK, tables not optimized | Audit |
| Period Lock write protection | Yes | ❌ Not enforced | Phase 6 |

---

## 6. IMPLEMENTATION PRIORITY MATRIX

### 🔴 P0 — Must-Have for Production (do BEFORE Go-Live)
| # | Item | Effort | Phase |
|---|---|---|---|
| 1 | Period Locking + Closing Wizard | 2d | 6 |
| 2 | Multi-Tier Approval Engine | 3d | 6 |
| 3 | Payment Request (PAY) Form + workflow | 2d | 4-extend |
| 4 | Balance Sheet + Cashflow Reports | 2d | 4-extend |
| 5 | Bank Reconciliation (CSV upload) | 2d | 4-extend |
| 6 | Tax Details + Settlement JE | 1d | 4-extend |
| 7 | File Upload Service + Receipt attachment | 1.5d | cross |
| 8 | Daily Close page (outlet) | 1d | 2-extend |
| 9 | KDO/BDO sub-pages | 1d | 2-extend |
| 10 | Mobile Responsive Audit + Fixes | 2d | cross |
| 11 | Bulk Master Data Import (Excel) | 1.5d | 7 |
| 12 | Email Notification | 1d | cross |

**Total P0 effort: ~20 days**

### 🟡 P1 — High Value Polish
| # | Item | Effort |
|---|---|---|
| 13 | OCR Receipt (Petty Cash + Urgent Purchase) | 1d (vision API ready) |
| 14 | Last Vendor/Price hint in ItemAutocomplete | 0.5d |
| 15 | Brand/Outlet Drilldown pages (Executive) | 2d |
| 16 | Brand Mix donut + Period Selector | 1d |
| 17 | Vendor Comparison panel + Standalone tool | 2d |
| 18 | Vendor Performance Scorecard | 1.5d |
| 19 | Stock Balance Matrix view | 1d |
| 20 | Low Stock Alert + Quick PR | 1d |
| 21 | Procurement Kanban Workboard | 2d |
| 22 | PO PDF generation + email | 1.5d |
| 23 | AI Categorize in Manual JE + Urgent | 0.5d |
| 24 | All 8 Anomaly Categories + LLM Explainer | 2d |
| 25 | LLM Tool-Calling executive Q&A | 2d |
| 26 | Daily Sales 5-step Wizard refactor | 1.5d |

**Total P1 effort: ~20 days**

### 🟢 P2 — Polish / Nice-to-have
| # | Item | Effort |
|---|---|---|
| 27 | Saved Filters / Views | 1d |
| 28 | Bulk Actions on lists | 1d |
| 29 | PDF/Excel export everywhere | 1.5d |
| 30 | Onboarding Tour | 1d |
| 31 | Live mode auto-refresh dashboard | 0.5d |
| 32 | i18n (Indonesian + English) | 2d |
| 33 | Keyboard shortcuts overlay | 0.5d |
| 34 | Impersonate User | 1d |
| 35 | Background scheduler (anomaly batch, EA reminders) | 1.5d |
| 36 | Forecasting (sales/inventory/cashflow) | 4d |
| 37 | AI Service module restructure | 1d |

**Total P2 effort: ~15 days**

**Grand Total Enhancement Effort: ~55 days (~11 weeks)**

---

## 7. PROPOSED INCORPORATION INTO ROADMAP

### Suggested Re-arrangement of Remaining Phases:

```
Phase 5 (originally HR) → "Phase 5A: HR Core + P0 Finance/Outlet Extensions"
  • Employee Master CRUD
  • EA + Service Charge + Incentive
  • Voucher / FOC / Travel
  • + Daily Close page (P0-#8)
  • + KDO/BDO (P0-#9)
  • + Payment Request form (P0-#3)
  Duration: ~7 days

Phase 5B: Finance & Reporting Completion
  • Period Locking + Closing Wizard (P0-#1)
  • Multi-Tier Approval Engine (P0-#2)
  • Balance Sheet + Cashflow (P0-#4)
  • Bank Reconciliation (P0-#5)
  • Tax Details + Settlement (P0-#6)
  Duration: ~10 days

Phase 6: AI Productization + Cross-cutting
  • OCR Receipt (P1-#13)
  • All Anomaly Categories + LLM (P1-#24)
  • LLM Tool-Calling Executive (P1-#25)
  • AI Categorize in Manual JE (P1-#23)
  • Last Vendor/Price hints (P1-#14)
  • File Upload Service (P0-#7)
  • Email Notification (P0-#12)
  • Background Scheduler
  Duration: ~12 days

Phase 7: Procurement & Inventory Polish
  • Procurement Kanban (P1-#21)
  • Bulk Consolidate (P1)
  • Vendor Comparison + Scorecard (P1-#17, #18)
  • PO PDF + email (P1-#22)
  • Stock Matrix + Low Stock Alert (P1-#19, #20)
  • Mobile Responsive Audit (P0-#10)
  • Daily Sales 5-step Wizard (P1-#26)
  Duration: ~12 days

Phase 8: UAT, Polish, Hardening
  • Bulk Excel Import (P0-#11)
  • Brand/Outlet Drilldown (P1-#15)
  • Brand Mix + Period Selector (P1-#16)
  • Saved Views, Bulk Actions, PDF Export (P2)
  • Onboarding Tour, i18n (P2)
  • Forecasting (P2-#36)
  • Backup automation
  • Performance load test (NFR)
  • Accessibility audit
  Duration: ~14 days
```

**Total Remaining: ~55 days = 11 working weeks**

---

## 8. RECOMMENDED IMMEDIATE NEXT STEPS

Based on user dependency & blocking risk:

### 🎯 Sprint 1 (next 2–3 days): Phase 5A — HR Core
Focus on user-needed HR module since requested per original roadmap.
- Employee Master CRUD (UI for existing model)
- Employee Advance + amortization
- Service Charge calc + journal
- Voucher issue/redeem
- FOC entries

### 🎯 Sprint 2 (after HR): Phase 5B — P0 Finance Completion (parallel-able)
Critical for "real" production use:
- Period closing wizard + lock
- PAY workflow
- Balance Sheet + Cashflow

### 🎯 Sprint 3: Phase 6 — AI Productization
The "wow" factor:
- OCR Receipt (huge UX win, almost free with existing LlmVision)
- All anomaly categories
- Tool-calling executive AI

---

## 9. KEY DECISIONS NEEDED FROM USER

Before next phase starts, confirm:

1. **HR Phase 5 scope**: Build full Phase 5 first, OR mix with P0 Finance items? (recommend mix per Sprint 1+2)
2. **Period Locking**: Add to Phase 5B (immediately after HR), OR wait until Phase 6? (recommend 5B)
3. **Mobile responsive priority**: Critical (Bu Sari uses smartphone) — schedule Sprint pass before Phase 7?
4. **OCR Receipt**: User mentioned wanting Phase 7, but it's an easy win with current Gemini Vision integration — do in Phase 6?
5. **Bulk Excel import**: Necessary for go-live (otherwise 500 items entered one-by-one). Schedule Phase 7 or earlier?

---

## 10. APPENDIX — File-by-File Diff vs PRD

### Backend Coverage
| Component | PRD Spec | Built | File |
|---|---|---|---|
| Auth | JWT + refresh + RBAC | ✅ | `auth.py`, `security.py` |
| Master Data | 8 entities + business rules | ⚠️ 7 entities, no business_rules | `master.py` |
| Outlet API | 13 endpoints | ✅ 12, missing daily-close | `outlet.py` |
| Procurement API | 13 endpoints | ✅ 9, missing consolidate, scorecard, vendor-comparison, three-way match dashboard | `procurement.py` |
| Inventory API | 13 endpoints | ✅ 12 | `inventory.py` |
| Finance API | 22 endpoints | ⚠️ 9, missing PAY workflow, period close-step, bank-recon, BS, cashflow, tax | `finance.py` |
| HR API | 17 endpoints | ❌ 0 | (Phase 5) |
| Admin API | 20+ endpoints | ✅ 8 (users, roles, master, audit, number_series), missing business_rules, workflows, bulk_import, impersonate, system_settings | `admin.py` |
| Executive API | 10 endpoints | ⚠️ 4 (kpis, trend, insights, qa), missing brand-drilldown, outlet-drilldown, brand-mix, ap-aging stacked, dashboard-views, export | `executive.py` |
| AI API | 6 features × multiple endpoints | ⚠️ 3 endpoints (suggest, categorize, learn), missing OCR, forecast, tools-callable | `ai.py` |

### Frontend Coverage  
| Portal | Pages per PRD | Built | Coverage |
|---|---|---|---|
| Executive | 4 (Home, BrandDrill, OutletDrill, AiAssistantPage) | 1 | 25% |
| Outlet | 7 (Home, Sales, PC, UrgentPurchase, Opname, KDO/BDO, DailyClose) | 5 | 71% |
| Procurement | 8 (Workboard, PRList, PRDetail, PODraft, POList, VendorComp, Receiving, VendorMaster) | 6 (Home+PR/PO/GR list/form/detail) | 75% but missing kanban/comparison/scorecard |
| Inventory | 8 (Home, Balance, Movement, Transfer, Adjustment, OpnameDash, OpnameSession, Valuation) | 8 | 88% (matrix view & detail polish needed) |
| Finance | 12 (Home, SalesQueue, AP, PAY, JAE, Tax, PCSettle, PeriodClose, PL, BS, Cashflow, BankRecon) | 9 (no PAY, BS, Cashflow, BankRecon, Tax, PCSettle) | 50% |
| HR | 8 | 0 | 0% |
| Admin | 10 (Home, Users, Roles, Master, BusinessRules, Workflows, NumberSeries, AuditLog, Notifications, Backup) | 6 | 60% |

---

## 11. SIGN-OFF

This audit is informational and does not change current code. It informs decisions on:
- Re-prioritization of remaining phases
- Quick wins to schedule into next sprint
- Critical gaps that block "production-ready" status
- Realistic effort to reach 95% PRD coverage (~11 weeks)

**Recommended action:** Discuss this document with stakeholder, agree on Phase 5A/5B/6/7/8 sequencing, then resume implementation.

— End of Module Enhancement Plan v1.0
