# 🧱 MODULES — Aurora F&B (7 Portals Detail)
**Companion to:** PRD.md → Section 5  
**Version:** 1.0

Untuk setiap portal: **Tujuan → Persona → Screens → Features → User Stories → Acceptance Criteria → API Endpoints → Edge Cases**.

---

## 🌟 Portal 1: EXECUTIVE PORTAL

### Tujuan
Memberi pemilik & top management **real-time consolidated view** dengan kemampuan drill-down dan **AI assistant** untuk menjawab pertanyaan strategis.

### Persona Utama
- Pak Hadi (Executive/Owner)
- Pak Andi (GM/Regional Manager)

### Screens

#### 1.1 `ExecutiveHome` — Landing
Layout: Hero KPI strip (5 cards) + 4-quadrant glass grid + AI chat drawer trigger.

**KPI Strip (top, animated number counters):**
- Revenue Today / This Month (with delta vs last period)
- Operating Margin %
- Cash on Hand (sum bank accounts)
- Open AP
- Top Anomaly Count (red badge)

**4-Quadrant Grid (interactive charts, hoverable, clickable):**
- Quadrant 1: **Revenue Trend** — multi-line per brand, last 30 days, click → drill ke brand detail
- Quadrant 2: **Brand Mix** — donut chart % revenue per brand, hover → absolute number
- Quadrant 3: **Top 10 Outlets by Profit** — horizontal bar, click → outlet drilldown
- Quadrant 4: **AP Aging Buckets** — stacked bar (current/30/60/90+), click → AP ledger filter

**Bottom Strip:**
- Exception Feed (real-time notifications): "Outlet Sari Sudirman missing daily sales for 2 days" / "Brand Lusi expense spike +35% vs avg"
- AI Insights Card: "AI noticed margin Brand Kantin Sari turun 5% bulan ini, klik untuk explanation"

#### 1.2 `BrandDrilldown`
Filter by brand. Tabs: Overview / Outlets / Cost Structure / Trends.

#### 1.3 `OutletDrilldown`
Filter by outlet. Tabs: Daily Operations / P&L / Inventory Health / Staff Performance.

#### 1.4 `AiAssistantPage` (full screen chat)
- Left: chat history
- Center: chat
- Right: "sources" panel (which entities AI used to answer)
- Suggested questions chips (auto-generated based on time of day)

### Features
- F-EX-1: **Period selector** (Today/Week/Month/Quarter/YTD/Custom range)
- F-EX-2: **Brand & Outlet multi-select filter** (chip-based)
- F-EX-3: **Compare** — vs previous period overlay on charts
- F-EX-4: **Drill-down** anywhere — click chart segment → modal with detail rows
- F-EX-5: **Export** — PDF/PNG snapshot of dashboard
- F-EX-6: **AI Chat** — inline drawer + full page
- F-EX-7: **Save Dashboard View** — user-favorite filter combos
- F-EX-8: **Live mode** — dashboard auto-refreshes every 60s with subtle highlight on changes

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| EX-US-1 | Sebagai Executive, saya buka aplikasi pagi hari dan langsung lihat KPI hari sebelumnya. | Login → home loads ≤ 3s. KPI strip tampil. Last refresh time visible. |
| EX-US-2 | Sebagai GM, saya filter ke brand A saja & lihat performance outlet-nya. | Filter chip apply … charts re-render ≤ 1s. URL deep-link reflects filter. |
| EX-US-3 | Saya lihat "Operating Margin -5%" dan klik untuk tahu kenapa. | Click KPI → modal drill: top expense categories naik, with link to source docs. |
| EX-US-4 | Saya tanya AI: "Outlet mana yang paling boros bulan ini?" | AI menjawab dengan ranked list 3 outlet, sumber data ditampilkan, dapat diklik. |
| EX-US-5 | Saya export dashboard ke PDF untuk meeting. | Export PDF berisi all visible widgets, filter info, timestamp. |
| EX-US-6 | Saya lihat anomaly badge merah, klik → paham detailnya. | Click → anomaly list with explanation + recommended action. |

### API Endpoints
```
GET  /api/executive/kpi-strip              ?period=...&brand_ids=...&outlet_ids=...
GET  /api/executive/revenue-trend
GET  /api/executive/brand-mix
GET  /api/executive/top-outlets
GET  /api/executive/ap-aging
GET  /api/executive/exceptions
GET  /api/executive/ai-insights
POST /api/executive/dashboard-views        (save filter)
GET  /api/executive/dashboard-views
GET  /api/executive/export?format=pdf
```

### Edge Cases
- Empty data day — show graceful "No data yet, expected at 22:00" with placeholder
- Period crosses fiscal year — show fiscal year boundary marker
- One brand has 0 revenue — still show in donut as thin slice with tooltip

---

## 🏪 Portal 2: OUTLET PORTAL

### Tujuan
Guide outlet manager & staff melalui daily operations dengan **task-driven home** — bukan menu, tapi "Today's Tasks for You".

### Persona Utama
- Bu Sari (Outlet Manager)
- Pak Rudi (Inventory Controller)
- Kitchen/Bar staff (limited access)

### Screens

#### 2.1 `OutletHome` — Today's Workbench
Layout: "Today, [date]" header → Status pill (Open/In Progress/Closed) → Task cards.

**Task Cards** (auto-ordered by priority):
- ✅/⏳ "Submit Daily Sales" — tile with last day's amount, click → form
- ✅/⏳ "Reconcile Petty Cash" — tile with current balance, click → ledger
- ⏳ "Review 3 KDO requests pending kitchen confirm"
- ⏳ "5 items low stock — raise PR?" (with quick action)
- ⏳ "Stock opname due in 2 days"
- ✅ "Daily close (when all green)"

**Quick Stats Strip:**
- Today sales (live), Yesterday's sales, MTD vs target
- Petty cash balance
- Open PRs
- Stock alerts count

#### 2.2 `DailySales`
Guided form (multi-step, save-as-draft):
- Step 1: **Channel breakdown** — dynamic schema per outlet (Dine-in / Take-away / GoFood / GrabFood / Talangin)
- Step 2: **Payment breakdown** — Cash / Transfer / QRIS / Card
- Step 3: **Revenue buckets** — Food / Beverage / Retail / Other
- Step 4: **Service & Tax** — auto-calculated, editable with reason
- Step 5: **Review & Submit** — reconciliation: payment total = grand total? if not, show diff

#### 2.3 `PettyCash`
Ledger view + quick-add purchase. Each row: date, item/desc, amount, balance after, receipt thumbnail.
Button: "Replenish" → form to request finance.

#### 2.4 `UrgentPurchase`
Form with line items, vendor (free text + autocomplete from past), payment method, receipt upload (camera-friendly).

#### 2.5 `StockOpname`
- Session-based: "Start opname April 30"
- List of items grouped by category
- Each row: system qty | counted (input) | variance (auto) | unit cost | variance Rp
- Filter: pending count / counted / variance > 5%
- Action: "Save & Continue" / "Submit Final"
- After submit → variance summary modal → if approval needed, route to manager

#### 2.6 `KDO/BDO Request` (sub-page within Outlet)
- Quick-pick list (favorites items + categories)
- Add item, qty, unit, notes (e.g. "butuh hari ini")
- Submit → becomes Purchase Request to Procurement

#### 2.7 `DailyClose`
- Checklist: Sales submitted ✅ / PC reconciled ✅ / All approvals done ✅ / Cash deposit slip uploaded
- Submit → status outlet today = closed

### Features
- F-OU-1: **Mobile-first responsive** — forms work on smartphone
- F-OU-2: **AI smart entry** — type "susu" → suggest "Susu UHT 1L" + last vendor + last price
- F-OU-3: **OCR receipt** — take photo of struk → AI extract amount, vendor, date, suggest GL
- F-OU-4: **Auto-save draft** every 5s
- F-OU-5: **Offline tolerant** — queue submission if no network (Phase 7)
- F-OU-6: **Receipt camera capture** — access device camera
- F-OU-7: **Voice note** on transactions (Phase 7)
- F-OU-8: **Notification when validated** — finance approves → outlet sees green check

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| OU-US-1 | Bu Sari buka aplikasi pagi, lihat task hari ini, langsung tahu apa yang harus dikerjakan. | Home shows ordered task list with statuses, ETA each task. |
| OU-US-2 | Saya input sales kemarin Rp 8.5jt dengan breakdown channel & payment. | Form multi-step, save draft, validation: payment total = grand total ±Rp1. |
| OU-US-3 | Saya foto struk beli tisu di Indomaret, otomatis terisi. | OCR extract: amount, vendor, date ≥ 80% accurate. User confirms before submit. |
| OU-US-4 | Saya request bahan dapur (KDO) untuk besok. | Item suggestion AI works (typed 3 chars → dropdown). PR auto-created. |
| OU-US-5 | Saya lakukan opname akhir bulan, 200+ items. | Bulk-edit support, save mid-way, variance auto-calculated, slow network OK. |
| OU-US-6 | Saya tutup outlet hari ini. | Daily close blocked if any task incomplete; clear error message. |

### API Endpoints
```
GET    /api/outlet/home                     (today's tasks)
GET    /api/outlet/daily-sales              ?date=...&outlet_id=...
POST   /api/outlet/daily-sales              (create draft)
PATCH  /api/outlet/daily-sales/{id}
POST   /api/outlet/daily-sales/{id}/submit
GET    /api/outlet/petty-cash               ?outlet_id=...
POST   /api/outlet/petty-cash/transactions
POST   /api/outlet/petty-cash/replenish-request
POST   /api/outlet/urgent-purchases
GET    /api/outlet/opname/{id}
POST   /api/outlet/opname/start
PATCH  /api/outlet/opname/{id}/lines
POST   /api/outlet/opname/{id}/submit
POST   /api/outlet/kdo                      (creates PR)
POST   /api/outlet/bdo                      (creates PR)
POST   /api/outlet/daily-close
POST   /api/outlet/ocr-receipt              (multipart upload)
```

### Edge Cases
- Multi-day backlog (didn't submit Friday) — show queue of pending dates
- Sales for today entered before day ends — "draft for today" allowed
- Negative payment delta (overpaid?) — force note
- Photo too large (>10MB) — client compress before upload

---

## 🛒 Portal 3: PROCUREMENT PORTAL

### Tujuan
Konsolidasi request dari outlet, manage vendor, kontrol PO end-to-end.

### Persona Utama
- Bu Dewi (Purchasing Staff)
- Procurement Manager (approver)

### Screens

#### 3.1 `ProcurementHome` — Workboard
Kanban view: New PRs → Awaiting Approval → Ready to PO → PO Sent → Receiving Pending.

#### 3.2 `PRList`
Filter: outlet, brand, date, status, source. Table: doc_no, requester, outlet, items count, est total, status, age.
Bulk actions: "Consolidate selected into single PO".

#### 3.3 `PRDetail`
- Header info
- Lines: item, qty, unit, est cost, vendor suggestion (from history)
- Approval chain visualization (timeline)
- Action: Approve / Reject / Request Edit

#### 3.4 `PODraft`
Edit lines, set vendor, set delivery date, payment terms.
- Vendor comparison panel (right): last 3 prices from each vendor for these items
- Auto-suggest vendor based on history & price (AI)
- Submit for approval / Send directly (depending on rule)

#### 3.5 `POList`
Status filter, search, table with quick actions: Send, Mark Received, Cancel.

#### 3.6 `VendorComparison` (standalone tool)
Select items → query last N prices across vendors → visualize.

#### 3.7 `ReceivingQueue`
List of POs with status `sent` or `partial`. Click → receiving form (qty per line, variance, invoice info, upload invoice).

#### 3.8 `VendorMaster` (within procurement, also in admin)
List & detail. Performance stats: on-time %, price stability, defect rate.

### Features
- F-PR-1: **Smart consolidation** — auto-group same item from multiple PRs across outlets into single PO
- F-PR-2: **Vendor recommendation AI** — "Best vendor for this PO based on price + history"
- F-PR-3: **Approval chain** with multi-tier (amount-based)
- F-PR-4: **PDF PO generation** — send via email/WA
- F-PR-5: **Receiving variance handling** — short delivery → partial PO
- F-PR-6: **Three-way match** — PO vs GR vs Invoice (auto-flag mismatch)
- F-PR-7: **Vendor performance scorecard**

### User Stories

| ID | Story | AC |
|---|---|---|
| PR-US-1 | Pagi hari saya lihat 12 PR baru dari 5 outlet. | Workboard kanban; sort by urgency. |
| PR-US-2 | Saya konsolidasi 8 PR untuk item "susu UHT" jadi 1 PO ke vendor termurah. | Bulk select → "Consolidate" → line items merged with qty summed; vendor AI-suggest. |
| PR-US-3 | Saya bandingkan harga 3 vendor untuk 5 items. | Comparison view: matrix vendor x item, highlight best. |
| PR-US-4 | Saya kirim PO via email vendor langsung dari sistem. | PDF attached + body templated; sent log recorded. |
| PR-US-5 | Saya terima barang — input qty actual, beberapa kurang. | Variance auto-calculated; option "Mark as partial" or "Close with credit memo". |
| PR-US-6 | Saya cek vendor mana yang sering telat delivery. | Vendor scorecard: on-time %, avg lead time, displayed. |

### API Endpoints
```
GET    /api/procurement/dashboard
GET    /api/procurement/prs                ?status=...&outlet_id=...
POST   /api/procurement/prs                (manual create)
PATCH  /api/procurement/prs/{id}/approve
PATCH  /api/procurement/prs/{id}/reject
POST   /api/procurement/prs/consolidate    (→ PO draft)
GET    /api/procurement/pos
POST   /api/procurement/pos
PATCH  /api/procurement/pos/{id}
POST   /api/procurement/pos/{id}/send
POST   /api/procurement/pos/{id}/cancel
GET    /api/procurement/vendor-comparison?item_ids=...
POST   /api/procurement/grs                (goods receipt)
GET    /api/procurement/vendors/{id}/scorecard
```

### Edge Cases
- PR partial-fulfilled (some items rejected) — split into approved + rejected
- PO cancellation after partial receive — require reversal of GR + KB entry
- Vendor temporarily inactive — block new PO

---

## 📦 Portal 4: INVENTORY PORTAL

### Tujuan
Full stock visibility & valuation by **opname + movement actual** (not BOM).

### Persona Utama
- Pak Rudi (Inventory Controller)
- Outlet Manager (read + opname participant)

### Screens

#### 4.1 `InventoryHome`
- Card: total stock value (sum across outlets)
- Card: low stock alerts count
- Card: pending transfers
- Card: opname schedule (next due)
- Mini chart: stock value trend last 30d

#### 4.2 `StockBalance`
Matrix: rows = items, cols = outlets, cells = qty. Filter by category, search by item.
Click cell → movement history modal.

#### 4.3 `MovementJournal`
Timeline of all in/out per outlet/item. Filter by type (receipt/issue/transfer/adjustment/opname).

#### 4.4 `Transfers`
List & form. Source outlet → destination outlet. Items, qty. Status: draft/sent/received/discrepancy.

#### 4.5 `Adjustments`
Log reason (waste/damage/correction) per line. Approval required > threshold.

#### 4.6 `OpnameDashboard`
List of all opname sessions across outlets. Status, completion %, variance value.

#### 4.7 `OpnameSession` (drill-down)
Detailed opname session view (also accessible from outlet portal).

#### 4.8 `ValuationReport`
Per outlet, per category. Methods: Moving average (default), Latest cost (alt). Compare months.

### Features
- F-IN-1: **Real-time stock balance projection** (denormalized, updated on each movement)
- F-IN-2: **Variance analysis** — expected vs actual per opname
- F-IN-3: **AI explainer** — "Variance besar di item susu, kemungkinan: ___" (pattern detection)
- F-IN-4: **Transfer approval flow**
- F-IN-5: **Print labels** for opname (Phase 7)
- F-IN-6: **Barcode scan** during opname (Phase 7)
- F-IN-7: **Stock alert** when below par level (configurable per item per outlet)

### User Stories

| ID | Story | AC |
|---|---|---|
| IN-US-1 | Saya lihat semua outlet stock minim hari ini. | Low stock list; sort by urgency; one-click create PR. |
| IN-US-2 | Saya transfer 50pcs gula dari outlet A ke B. | Transfer flow: draft → send → receive; movements posted both sides; cost preserved. |
| IN-US-3 | Saya bikin opname akhir bulan, ada variance Rp 2jt. | Variance summary; AI suggests reason; require approval > threshold; journal posted. |
| IN-US-4 | Saya generate valuation report April. | Report shows total value per outlet/category; export Excel/PDF. |

### API Endpoints
```
GET    /api/inventory/dashboard
GET    /api/inventory/balance              ?outlet_id=...&category_id=...
GET    /api/inventory/movements            ?item_id=...&date_from=...
POST   /api/inventory/transfers
PATCH  /api/inventory/transfers/{id}/send
PATCH  /api/inventory/transfers/{id}/receive
POST   /api/inventory/adjustments
PATCH  /api/inventory/adjustments/{id}/approve
GET    /api/inventory/opname               (list sessions)
POST   /api/inventory/opname               (start)
PATCH  /api/inventory/opname/{id}/lines
POST   /api/inventory/opname/{id}/submit
GET    /api/inventory/valuation            ?outlet_id=...&period=...
```

### Edge Cases
- Negative stock from race condition — lock by item+outlet during write
- Item without cost (first ever) — use estimated, flag for review
- Opname with new item never registered — redirect to add to ML first

---

## 💰 Portal 5: FINANCE & ACCOUNTING PORTAL

### Tujuan
Full control finansial: validasi sales, manage AP, cashflow, journal, tax, closing, reporting.

### Persona Utama
- Pak Budi (Finance Staff)
- Finance Manager (approver, closer)

### Screens

#### 5.1 `FinanceHome`
Workboard:
- Pending sales validations (count, oldest)
- Overdue AP (count, total)
- Pending PAY approvals
- Pending JAE drafts
- Period status (April: open / closing / closed)
- Cash position widget (sum bank accounts)

#### 5.2 `SalesValidationQueue`
List of submitted daily_sales pending validation.
Filter outlet, date. Click → detail with: breakdown, anomaly flags (AI), validate / request-fix actions.

#### 5.3 `APLedger` (KB)
List all open AP. Aging buckets (current / 30 / 60 / 90+).
Click vendor row → vendor AP detail with all open invoices.
Quick action: "Create Payment Request".

#### 5.4 `PaymentRequest` (PAY)
- Form: payee, amount, GL debit, payment method, invoice link
- Approval chain (amount-tiered)
- Once approved → Marked "Ready to Pay"
- After payment recorded → KB closed/decreased + journal posted

#### 5.5 `JournalEntries` (JAE)
List all journals (auto + manual). Filter source, period, status.
Manual JAE creator: "Add Line" with COA picker, Dr/Cr, dimensions (outlet/brand/employee).
Validation: Dr total = Cr total before submit.

#### 5.6 `TaxDetails`
List tax lines per period. Filter PPN-In / PPN-Out / Other. Status: open/paid/reported.

#### 5.7 `PettyCashSettlement`
Review outlet petty cash submissions weekly/biweekly. Approve replenishment, post settle journal.

#### 5.8 `PeriodClosing`
Step-by-step wizard:
1. ✅ Verify all daily_sales validated
2. ✅ Verify all GR posted
3. ✅ Verify all opname submitted
4. ✅ Reconcile bank accounts
5. ✅ Review AP aging
6. ✅ Run trial balance check (Dr=Cr)
7. ✅ Review accruals
8. 🔴 Lock period

#### 5.9 `ProfitLoss`
Matrix: rows = COA structure (revenue, COGS, operating expenses), cols = months Jan–Dec + YTD.
Drill-down: click cell → transaction list for that account/month.

#### 5.10 `BalanceSheet` (Phase 4 polished)
Assets / Liabilities / Equity. Period selector. Comparative.

#### 5.11 `CashflowReport`
Direct method (Phase 4) — by category. Indirect (Phase 7).

#### 5.12 `BankReconciliation` (Phase 4 lite, Phase 7 full)
Upload bank mutation CSV → match to PAY entries.

### Features
- F-FN-1: **Auto-journal** for every business event (sales, GR, payment, opname, etc.) — see `JOURNAL_MAPPING.md`
- F-FN-2: **Approval chain configurable** by amount tier
- F-FN-3: **Period lock** — immutable after close
- F-FN-4: **Reversing journal** — create reversal of any posted JE with audit reason
- F-FN-5: **AI categorization** — type expense description → suggest COA
- F-FN-6: **Drill from report to transaction** — every report figure clickable
- F-FN-7: **Trial balance built-in** — always Dr=Cr enforced
- F-FN-8: **Multi-dimensional reporting** — outlet, brand, employee, vendor

### User Stories

| ID | Story | AC |
|---|---|---|
| FN-US-1 | Saya validasi 8 sales submissions hari ini. | Queue → detail → validate; AI flag anomaly; bulk validate option. |
| FN-US-2 | Saya lihat AP aging, ada vendor X overdue 90+ hari Rp 5jt. | AP aging chart; click → detail; quick PAY create. |
| FN-US-3 | Saya buat PAY untuk vendor X amount Rp 5jt; butuh approval > Rp 1jt. | Form → chain triggered → manager notif → manager approve → ready to pay. |
| FN-US-4 | Saya post JAE manual untuk koreksi typo. | Manual JE → Dr/Cr balanced → post; reversal supported. |
| FN-US-5 | Saya tutup period April — wizard guides me. | Wizard 8 steps; cannot skip; trial balance verified Rp 0 diff; lock applied. |
| FN-US-6 | Saya buat PL Q1 untuk meeting. | PL matrix; drill-down works; export PDF/Excel. |
| FN-US-7 | Saya rekonsiliasi bank BCA April. | Upload CSV → fuzzy match to PAY → unmatched flagged → reconcile. |

### API Endpoints
```
GET    /api/finance/dashboard
GET    /api/finance/sales-queue
PATCH  /api/finance/sales/{id}/validate
PATCH  /api/finance/sales/{id}/request-fix
GET    /api/finance/ap-ledger
GET    /api/finance/ap-aging
GET    /api/finance/payments
POST   /api/finance/payments
PATCH  /api/finance/payments/{id}/approve
PATCH  /api/finance/payments/{id}/mark-paid
GET    /api/finance/journals
POST   /api/finance/journals               (manual JAE)
POST   /api/finance/journals/{id}/post
POST   /api/finance/journals/{id}/reverse
GET    /api/finance/tax-details
GET    /api/finance/petty-cash-settlement
POST   /api/finance/petty-cash/replenish/{request_id}/approve
GET    /api/finance/period/{period}/status
POST   /api/finance/period/{period}/close-step/{step}
POST   /api/finance/period/{period}/lock
GET    /api/finance/reports/profit-loss
GET    /api/finance/reports/balance-sheet
GET    /api/finance/reports/cashflow
POST   /api/finance/bank-reconciliation/upload
```

### Edge Cases
- Sales without payment match (Cash short) — flag as exception, allow validate-with-note
- Late submission for closed period — require re-open by Finance Manager (audit)
- Vendor invoice received before PO created — allow standalone KB with later PO link
- FX adjustment — not in scope Phase 1 (IDR only)

---

## 👥 Portal 6: HR & INCENTIVE PORTAL

### Tujuan
Kelola employee compensation: advance, service charge, incentive, voucher, FOC, travel.

### Persona Utama
- Bu Linda (HR Officer)
- HR Manager (approver)

### Screens

#### 6.1 `HRHome`
Cards: Active employees, pending advances, service charge to allocate, monthly incentive total.

#### 6.2 `EmployeeAdvances` (EA)
List. Form: amount, terms (months), schedule preview. Status tracking with monthly amortization.

#### 6.3 `ServiceCharge` (Service 5%)
List of periods. Per period:
- Total service revenue (auto-pulled from sales)
- L&B fund deduction (configurable %)
- L&D fund deduction (configurable %)
- Distributable amount
- Allocation: per employee by service days
- Action: Calculate → Review → Approve → Post to JAE

#### 6.4 `IncentiveScheme`
Define schemes (rule). Per outlet/role.
Run calculation per period → result list per employee → approval → post journal.

#### 6.5 `LBFund` (Loss & Breakage Fund Ledger)
Ledger: in (deductions), out (compensation paid). Balance running.

#### 6.6 `Voucher`
Issue vouchers (code, value, expire). Track redemption. Link to revenue when redeemed.

#### 6.7 `FOC` (Free of Charge)
Log complimentary/marketing/staff meal entries. Auto journal to expense category.

#### 6.8 `TravelIncentive`
Log driver/sales travel. Calculate fee. Auto journal.

### Features
- F-HR-1: **Configurable formulas** per outlet (service %, incentive)
- F-HR-2: **Auto-amortization** schedule for EA
- F-HR-3: **Service charge auto-calc** from sales data
- F-HR-4: **Voucher tracking** with COGS calc
- F-HR-5: **Approval chain** for amounts > threshold

### User Stories

| ID | Story | AC |
|---|---|---|
| HR-US-1 | Saya beri kasbon Rp 2jt ke karyawan, cicil 4 bulan. | EA form, schedule auto, journal posted, monthly remind. |
| HR-US-2 | Saya hitung service April outlet Sari, alokasi 12 karyawan. | Auto-pull service revenue; deduct L&B/L&D; allocate by days; preview before post. |
| HR-US-3 | Saya isue voucher promosi Rp 100rb x 50pcs. | Bulk generate codes; issued list; track redemption. |
| HR-US-4 | Saya catat staff meal harian outlet A. | FOC entry per day; auto journal to staff meal expense. |

### API Endpoints
```
GET    /api/hr/dashboard
GET    /api/hr/advances
POST   /api/hr/advances
GET    /api/hr/service-charges/{period}
POST   /api/hr/service-charges/{period}/calculate
POST   /api/hr/service-charges/{period}/post
GET    /api/hr/incentives
POST   /api/hr/incentives/calculate
POST   /api/hr/incentives/{id}/post
GET    /api/hr/lb-fund
GET    /api/hr/vouchers
POST   /api/hr/vouchers/issue
POST   /api/hr/vouchers/{code}/redeem
GET    /api/hr/foc
POST   /api/hr/foc
GET    /api/hr/travel-incentives
POST   /api/hr/travel-incentives
```

### Edge Cases
- Employee terminated mid-month — prorate service
- Voucher partial redeem — track remaining
- Advance not paid back at termination — flag, allow write-off (with approval)

---

## ⚙️ Portal 7: ADMIN PLATFORM

### Tujuan
Master data, RBAC, business rules, workflows, system config.

### Persona Utama
- Bu Maya (System Admin)

### Screens

#### 7.1 `AdminHome`
- System health (DB, services)
- Recent audit log entries
- Pending workflow requests
- User count, active sessions

#### 7.2 `Users`
CRUD users. Bulk import. Reset password. Disable. Assign roles & outlet scope.

#### 7.3 `Roles`
CRUD roles. Permission picker (categorized list of all permissions).

#### 7.4 `MasterData`
Tabbed CRUD:
- Items (with bulk Excel import)
- Categories
- Vendors
- Employees
- Chart of Accounts
- Tax Codes
- Payment Methods
- Bank Accounts

#### 7.5 `BusinessRules`
List rules grouped by type. Edit JSON-form (with helper UI per rule type).

#### 7.6 `Workflows`
Define approval chains: "PR > 5jt requires Procurement Manager + Finance Manager".

#### 7.7 `NumberSeries`
Manage doc number formats per type.

#### 7.8 `AuditLog`
Filter by user, date, entity, action. Export.

#### 7.9 `Notifications` (config)
Who gets which notification (user/role/event).

#### 7.10 `Backup` (Phase 8)
Manual backup trigger. Backup history.

### Features
- F-AD-1: **Self-service rule config** — no code change
- F-AD-2: **Bulk Excel import** of master data
- F-AD-3: **Permission-aware** — only super admin sees everything
- F-AD-4: **Audit log search** with full text
- F-AD-5: **Impersonate user** (super admin) for support — full audit trail

### User Stories

| ID | Story | AC |
|---|---|---|
| AD-US-1 | Saya tambah user baru, role outlet manager, scope 2 outlet. | Form → select role → multi-select outlets → invite email. |
| AD-US-2 | Saya ubah service charge formula outlet Sari dari 5% jadi 7%. | Business rule edit → save → effective from next period. |
| AD-US-3 | Saya import 500 item dari Excel. | Upload → preview → validation errors flagged → import. |
| AD-US-4 | Saya cek siapa yang ubah harga item X minggu lalu. | Audit log search by entity_id; full diff shown. |

### API Endpoints
```
GET    /api/admin/dashboard
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/{id}
POST   /api/admin/users/{id}/reset-password
GET    /api/admin/roles
POST   /api/admin/roles
GET    /api/admin/permissions               (catalog)
GET    /api/admin/master/items
POST   /api/admin/master/items/bulk-import
... (per master entity)
GET    /api/admin/business-rules
POST   /api/admin/business-rules
GET    /api/admin/workflows
POST   /api/admin/workflows
GET    /api/admin/number-series
GET    /api/admin/audit-log
GET    /api/admin/audit-log/export
POST   /api/admin/impersonate/{user_id}
```

### Edge Cases
- Import file >10MB — chunk + progress
- Role being deleted but assigned to users — prevent or migrate
- Business rule conflict (outlet + brand) — outlet wins (more specific)

---

## 🌐 Cross-Portal Features (every portal benefits)

### CP-1: Global Search (Cmd+K)
- Search items, vendors, employees, transactions (PR/PO/PAY/JAE doc_no)
- Group results by type
- Recent searches saved per user
- Keyboard navigation

### CP-2: Notification Center
- Bell icon badge in top-nav
- Click → panel slide from right
- Categories: Urgent (red) / Warning (amber) / Info (blue) / Done (green)
- Mark read / mark all / filter
- Click notification → navigate to source

### CP-3: Theme Toggle
- Light (default) / Dark / Auto (system)
- Persisted per user

### CP-4: AI Chat Drawer (anywhere)
- Floating button bottom-right (executive-permitted)
- Opens drawer with chat
- Context-aware: knows current portal/page

### CP-5: Saved Filters / Views
- Any list page can save current filter as named view
- Quick-switch dropdown

### CP-6: Bulk Actions
- Wherever possible (validate, approve, export)

### CP-7: Print/Export
- Tables: CSV, Excel, PDF
- Forms (PO, KB, Refund): PDF preview & print

### CP-8: Keyboard Shortcuts
- `Cmd+K` global search
- `Cmd+/` open AI chat
- `n` new (in list pages)
- `Esc` close modal
- `?` show shortcuts overlay

### CP-9: Onboarding Tour
- First login: portal-specific tour (3-5 steps)
- Dismissable, replayable

---

## Cross-Reference

- For UI/UX details (components, animation, states): see `UI_UX_SYSTEM.md`
- For exact data shapes: see `ARCHITECTURE.md` Section 4–7
- For who can do what: see `RBAC_MATRIX.md`
- For phase-by-phase delivery: see `PHASE_PLAN.md`
