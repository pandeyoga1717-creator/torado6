# 🗺️ PHASE PLAN — Aurora F&B (8 Phases, Detailed)
**Companion to:** PRD.md → Section 10  
**Version:** 1.0

Every phase has: **Goal, Sub-phases, Deliverables, User Stories Covered, Acceptance Criteria, Definition of Done, Test Strategy.**

No phase is "complete" until DoD is 100% met.

---

## 🌰 PHASE 0 — Discovery & Foundation Setup
**Status:** ✅ Complete (this document = output)

### Goal
Finalize requirements, design system, data model, and project plan.

### Deliverables
- [x] PRD.md
- [x] ARCHITECTURE.md
- [x] MODULES.md
- [x] UI_UX_SYSTEM.md
- [x] AI_FEATURES.md
- [x] PHASE_PLAN.md (this)
- [x] EXCEL_MAPPING.md
- [x] JOURNAL_MAPPING.md
- [x] RBAC_MATRIX.md
- [x] User clarifications captured

---

## 🏗️ PHASE 1 — Platform Foundation
**Duration:** Weeks 1–2  
**Goal:** Auth, RBAC, Master Data, App Shell with glassmorphism design system, foundational UX patterns.

### 1A — Backend Foundation
- Project structure (folders per ARCHITECTURE.md)
- Mongo connection, helpers
- Auth: register/login/refresh/logout endpoints
- JWT + RBAC dependency
- User & Role CRUD
- Audit log helper (sync, in-band)
- Number series engine
- Notification model + dispatcher (in-app only Phase 1)
- Health check, error envelope, pagination utils

### 1B — Master Data
- CRUD: Group, Brand, Outlet, Item, ItemPriceHistory, Category, Vendor, Employee, COA, TaxCode, PaymentMethod, BankAccount
- Bulk Excel import endpoint (items, vendors, employees, COA)
- Search endpoint per master

### 1C — Frontend App Shell (Design System Implementation)
- Tailwind config with design tokens (colors, typography, spacing, radius from UI_UX_SYSTEM.md)
- Theme provider (light/dark/auto)
- AppShell with TopNav + SideRail + Content (matches reference image)
- Login page with glass card, illustration
- 404, 500 pages
- Component library scaffolding: Button, Input, Card (.glass-card), Modal, Drawer, Toast, Tooltip, Avatar, ChipFilter, KpiCard, ChartCard wrapper, DataTable, EmptyState, LoadingState, ErrorState
- Global Search (Cmd+K) with master data sources
- Notification Center (drawer)
- User menu, theme toggle
- Onboarding tour scaffolding
- Animation tokens & Framer Motion setup

### 1D — Admin Portal Skeleton
- Users CRUD UI
- Roles CRUD UI
- Master Data tabbed UI (Items, Vendors, Employees, COA, etc.)
- Audit Log viewer
- Number Series settings

### Deliverables
- Working login → land on Admin (for super admin)
- Bu Maya can manage users, roles, master data via UI
- Glass design language live; theme toggle works
- Cmd+K finds items/vendors
- Notification panel works (manually triggered)

### User Stories Covered
- AD-US-1, AD-US-3, AD-US-4 (admin onboarding)
- All cross-portal CP-1 (search), CP-2 (notif), CP-3 (theme), CP-7 (export bulk import)

### Acceptance Criteria
- [ ] Login works, JWT issued, refresh works
- [ ] User logout invalidates refresh token
- [ ] Bcrypt password (cost=12)
- [ ] Wrong password 5x → lockout 15min
- [ ] RBAC: admin sees admin portal; non-admin redirected
- [ ] All masters: create, edit, soft-delete, list with search
- [ ] Bulk import: 500 items in CSV/Excel ≤ 20s, errors per row reported
- [ ] Audit log records all CRUD on masters
- [ ] Glass cards visually match reference image (visual review)
- [ ] Light/dark theme switch works without page reload
- [ ] Cmd+K opens within 100ms; debounced search; keyboard nav
- [ ] Notification badge updates in real-time (poll every 30s phase 1)
- [ ] All buttons primary = black pill; secondary = glass
- [ ] All KPI cards animate number on mount
- [ ] Mobile responsive: AppShell collapses to hamburger

### DoD
- [ ] Lint clean (ruff + eslint)
- [ ] `testing_agent_v3` E2E: login, create user, create item, theme toggle, Cmd+K — all pass
- [ ] No console errors in browser
- [ ] Dark theme visual review pass
- [ ] Document any deviation from PRD/UI_UX in CHANGELOG

---

## 🏪 PHASE 2 — Outlet Portal MVP
**Duration:** Weeks 3–4  
**Goal:** Daily sales, petty cash, urgent purchase — the high-frequency outlet operations.

### 2A — Backend
- DailySales model + endpoints (CRUD, submit, validate)
- PettyCashTransaction CRUD + replenish request
- UrgentPurchase CRUD + approve
- BusinessRules: SalesInputSchema (per outlet), PettyCashPolicy
- Sales validation queue endpoint (for finance)
- Auto-suggest items/vendors (local fuzzy + AI fallback) endpoint

### 2B — AI Features
- Item/Vendor smart autocomplete (Feature #2A) — LLM fallback when fuzzy fails

### 2C — Frontend Outlet Portal
- OutletHome with task-driven layout ("Today's Tasks")
- DailySales multi-step form with auto-save
- PettyCash ledger + add transaction
- UrgentPurchase form with vendor autocomplete
- KDO/BDO request form (creates PR — to be received in Phase 3)
- DailyClose checklist (functional but PR/opname checks come Phase 3)
- Mobile responsive forms

### 2D — Cross-cutting
- File upload (receipt photos) → local /app/uploads
- Camera capture button (web getUserMedia API)
- Status pill component

### User Stories Covered
- OU-US-1, OU-US-2, OU-US-4 (basic flows)
- AD-US-2 (rule edit — sales schema)

### Acceptance Criteria
- [ ] Outlet manager can submit daily sales for any outlet they have access to
- [ ] Validation: payment total = grand total ± Rp1
- [ ] Schema configurable: outlet A has 4 channels, outlet B has 6
- [ ] Multi-step form auto-save every 5s; resume if browser closes
- [ ] Petty cash ledger updates in real-time after each transaction
- [ ] Item autocomplete: type 2 chars → matches in 200ms; AI fallback in 1.5s
- [ ] OutletHome tasks ordered by priority; statuses correct
- [ ] Receipt photo: max 10MB, compressed client-side; works on mobile camera
- [ ] Audit log on every submit/update
- [ ] Permissions: outlet manager A cannot see outlet B data

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: full outlet flow scenarios pass (US-1, US-2, US-4)
- [ ] Mobile viewport testing pass
- [ ] AI autocomplete works on real data

---

## 🛒 PHASE 3 — Procurement & Inventory Core
**Duration:** Weeks 5–6  
**Goal:** PR → PO → Receiving flow, inventory movement & opname, valuation.

### 3A — Backend Procurement
- PR endpoints (create from KDO/BDO/manual, approval, reject)
- PO endpoints (create from PR consolidation, send, receive partial/full, cancel)
- GR endpoints (post receipt, generate KB, link invoice)
- Vendor scorecard calculation
- Approval workflow engine (amount-tiered)
- PDF PO generator (jsPDF on backend with WeasyPrint OR generate on frontend)

### 3B — Backend Inventory
- InventoryMovement (every receipt, issue, transfer, adjustment, opname posts here)
- StockBalance projection (denormalized for fast read)
- Transfer endpoints (draft, send, receive, discrepancy)
- Adjustment endpoints (with approval if > threshold)
- OpnameSession endpoints (start, lines bulk update, submit)
- Valuation calculation (moving average + latest cost)
- Stock alert engine (low stock based on par)

### 3C — Frontend Procurement Portal
- Procurement workboard (kanban)
- PR list + detail + approve/reject
- PO draft + send + receive + cancel
- Vendor comparison tool
- Receiving queue
- PO PDF preview & email simulation

### 3D — Frontend Inventory Portal
- Inventory home dashboard
- Stock balance matrix (item x outlet)
- Movement journal with filters
- Transfer list & form
- Adjustment list & form
- Opname dashboard + session view (also accessible from outlet portal)
- Valuation report

### User Stories Covered
- PR-US-1 to PR-US-6 (procurement)
- IN-US-1 to IN-US-4 (inventory)
- OU-US-5 (opname)
- OU-US-4 (KDO completion: PR feeds back here)

### Acceptance Criteria
- [ ] PR → PO consolidation: 5 PRs same item from different outlets → single PO with merged qty
- [ ] Vendor recommendation AI provides 3 suggestions with price comparison
- [ ] PO sent generates PDF with logo, line items, terms
- [ ] GR posting: creates inventory_movement (receipt), creates KB (AP), updates stock balance
- [ ] Three-way match flag triggers if PO total ≠ GR total ≠ invoice total
- [ ] Transfer outgoing reduces source stock, incoming increases dest stock atomically
- [ ] Opname submission: variance journal posted, requires approval if > Rp X
- [ ] Stock balance always non-negative (validation)
- [ ] Valuation: moving average correct vs hand calc on test data
- [ ] Low stock alert generates notification to outlet manager + procurement

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: full procurement flow + inventory flow scenarios pass
- [ ] Trial balance maintained: every business event has corresponding journal
- [ ] Performance: opname session with 500 items loads ≤ 5s

---

## 💰 PHASE 4 — Finance & Accounting Core
**Duration:** Weeks 7–8  
**Goal:** COA-driven ledger, JAE, PAY, KB, tax, period closing, PL/BS reports.

### 4A — Backend Finance Core
- JournalEntry model & service (manual + auto from events)
- Journal mapping engine (maps business events → journal entries per JOURNAL_MAPPING.md)
- PaymentRequest (PAY) endpoints with approval chain
- AP Ledger (KB) endpoints, aging calculation
- TaxDetail endpoints
- Period management (open/close/lock)
- Period-lock enforcement on writes
- ProfitLoss generation (monthly matrix + YTD)
- BalanceSheet generation
- Cashflow report (direct method)
- Bank reconciliation (CSV upload + fuzzy match) — lite version
- Reversing journal endpoint

### 4B — Backend Petty Cash Settlement
- Settlement workflow: outlet submits PC week → finance reviews → approve replenish → journal posted

### 4C — AI Categorization
- AI suggestion in JAE manual entry, urgent purchase, petty cash form
- Local rule engine + LLM fallback
- Rule learning when accepted

### 4D — Frontend Finance Portal
- Finance home workboard
- Sales validation queue + detail
- AP Ledger with aging buckets visualization
- Payment Request form & approval chain visualization
- Journal Entries list + manual JAE creator (Dr/Cr balanced enforced)
- Tax Details list
- Petty Cash Settlement screen
- Period Closing wizard (8 steps)
- Profit & Loss report (matrix, drill-down)
- Balance Sheet
- Cashflow report (calendar view)
- Bank Reconciliation upload & match UI

### User Stories Covered
- FN-US-1 to FN-US-7 (full finance)

### Acceptance Criteria
- [ ] Every business event from Phase 2/3 generates correct journal per JOURNAL_MAPPING.md
- [ ] Trial balance always Dr=Cr (verified continuously)
- [ ] PAY approval chain: 3-tier with notification at each step
- [ ] AP aging accurate (compared to manual calc on test data)
- [ ] Period close wizard blocks if any precondition fails
- [ ] Once locked, period writes blocked except adjustment-with-reason by Finance Manager (audit)
- [ ] PL drill-down works: click any cell → transaction list
- [ ] BS balances: Asset = Liability + Equity
- [ ] Bank rec: upload CSV → 80%+ auto-match
- [ ] AI categorization: GL suggestion appears ≤ 1.5s, accuracy validated

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: finance flows pass
- [ ] Manual: full month closing simulation succeeds
- [ ] Performance: PL for 12 months loads ≤ 3s

---

## 👥 PHASE 5 — HR & Incentive
**Duration:** Week 9  
**Goal:** Employee comp — advance, service charge, incentive, voucher, FOC, travel.

### 5A — Backend HR
- EmployeeAdvance with amortization schedule
- ServiceChargePeriod with auto-calc from sales
- LBFundLedger
- Incentive scheme engine (configurable formula)
- Voucher (issue, redeem, COGS calc)
- FOC entry
- TravelIncentive
- All with auto-journal

### 5B — OCR Feature
- Receipt OCR endpoint (Gemini multimodal)
- Integration into Petty Cash, Urgent Purchase forms

### 5C — Frontend HR Portal
- HR home
- Employee Advances list & form
- Service Charge calculator + allocation review
- Incentive scheme manager + run calculation
- LB Fund ledger
- Voucher manager (bulk issue, redeem)
- FOC entry log
- Travel Incentive log

### User Stories Covered
- HR-US-1 to HR-US-4
- OU-US-3 (OCR receipt for outlet)

### Acceptance Criteria
- [ ] Employee advance: monthly amortization auto-calculated; reminders sent
- [ ] Service charge: pulls correct sales total; deducts L&B/L&D %; allocates by days; preview before post
- [ ] Voucher: bulk issue 50 codes; redeem partial; tracks remaining
- [ ] OCR: take photo → fields auto-fill in ≤ 5s with confidence
- [ ] All HR txns generate correct journal entries

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: HR flows pass
- [ ] OCR accuracy validated on sample receipts (manual review 10 photos)

---

## 📊 PHASE 6 — Executive Dashboard & AI Assistant
**Duration:** Week 10  
**Goal:** Real-time consolidated dashboards + AI features (#1, #3, #4-MVP, #6).

### 6A — Backend Reporting
- Executive aggregation services (revenue trend, brand mix, top outlets, AP aging, exceptions)
- Caching layer (Mongo TTL) for expensive aggregations
- Anomaly detection scheduled job (daily 06:00)
- Sales forecasting (Prophet) — MVP

### 6B — AI Service
- Tool catalog implementation (all tools per AI_FEATURES.md §2)
- Chat session management (history, context)
- Anomaly explainer (Claude Sonnet)
- Sales forecast endpoint

### 6C — Frontend Executive Portal
- ExecutiveHome with 5-KPI strip + 4-quadrant grid + exception feed + AI insight card
- BrandDrilldown
- OutletDrilldown
- AiAssistantPage (full screen + drawer variant)
- Drill-down dialogs everywhere
- Save dashboard view
- Live mode (auto-refresh)
- Compare period overlay
- Export PDF

### 6D — Conversational Q&A on Reports
- "Ask AI about this" button on PL, BS, AP Aging, Inventory Valuation
- Embedded chat drawer with report context

### User Stories Covered
- EX-US-1 to EX-US-6

### Acceptance Criteria
- [ ] ExecutiveHome loads ≤ 3s with 30 days of data, 5 brands, 20 outlets
- [ ] All charts: hover tooltip rich, click drills, animation on enter
- [ ] AI chat answers "profit Brand Lusi April?" with cited sources, latency ≤ 8s
- [ ] AI cannot access data outside user's scope (RBAC enforced)
- [ ] Anomaly job runs daily, generates notifications
- [ ] Sales forecast: chart visible with confidence band, accurate to ±15% on test data
- [ ] AI streaming response works (token-by-token)
- [ ] Period selector + multi-brand/outlet filter URL-encoded (deep-linkable)
- [ ] Export PDF includes all visible widgets + filter context

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: executive scenarios + AI scenarios pass
- [ ] AI cost tracked per session (logged)
- [ ] Performance under 50 concurrent users tested

---

## 🔧 PHASE 7 — Configurability, Reports, Performance & Polish
**Duration:** Week 11  
**Goal:** Self-service config UI, advanced reports, perf optimization, polish.

### 7A — Self-Service Config
- BusinessRules editor UI (per type with helper UI, not raw JSON):
  - Sales schema editor (drag channels, payment methods, buckets)
  - Petty cash policy (limits, thresholds)
  - Service charge formula
  - Incentive scheme builder
  - Approval workflow designer (visual chain)
- Rule effective dating (changes apply from date X)

### 7B — Advanced Reports
- Customizable report builder (Phase 7 lite: pick dimensions + metrics + filter, save)
- Multi-dimensional Pivot (outlet x brand x category)
- Comparative reports (YoY, MoM)
- Inventory aging
- Vendor performance scorecard
- Employee performance dashboard
- Indirect cashflow

### 7C — Forecasting Full
- Inventory reorder forecast
- Cashflow forecast
- LLM-enhanced contextual layer

### 7D — Anomaly Detection Real-time
- Webhook on data submission → anomaly check inline
- More categories (z-score per category, ML-light)

### 7E — Performance & Polish
- Index optimization
- Query profiling
- Image lazy load
- Skeleton states verified everywhere
- Animation polish (motion review)
- Empty/error states verified
- Mobile UX pass (every page tested mobile)
- Dark mode pass (every page tested dark)
- A11y audit (axe-core)

### 7F — Optional features
- Offline-tolerant outlet form (queue + sync) — Phase 7 stretch
- Voice note attachment
- Print thermal receipt (if needed)
- WhatsApp notifications (BKL stretch)

### Acceptance Criteria
- [ ] Bu Maya can change service charge formula via UI without dev help
- [ ] All reports drillable, exportable
- [ ] Mobile UX rated ≥ 4/5 in informal review
- [ ] Dark mode passes visual review on all pages
- [ ] A11y: axe scan ≤ 5 minor issues
- [ ] p95 API ≤ 500ms; dashboard ≤ 3s

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: full regression pass
- [ ] Load test 50 concurrent users: no errors
- [ ] Lighthouse score ≥ 90 on dashboard pages

---

## 🔒 PHASE 8 — Hardening, Migration & Go-Live Prep
**Duration:** Week 12  
**Goal:** Security harden, Excel data migration, UAT, ops readiness.

### 8A — Security Hardening
- MFA (TOTP) for finance & admin roles
- Rate limiting all endpoints
- Security audit (input validation, XSS, SSRF, auth bypass)
- Secrets rotation procedure
- Penetration test smoke (basic)

### 8B — Excel Migration Tool
- Upload-and-validate UI for each Excel workbook
- Migration mapper (Excel column → system field per EXCEL_MAPPING.md)
- Generate retroactive journal entries for historical data
- Migration audit report

### 8C — Ops & Runbook
- Backup automation (daily mongodump, 30d retention)
- Restore procedure tested
- Incident runbook ("if backend down, do X")
- Health endpoint enriched (db, llm, scheduler status)
- Logging structured (loguru → file rotation)
- Optional: Sentry, Prometheus exporter

### 8D — UAT
- UAT script per persona
- Train champion users
- Bug bash
- Final acceptance signoff

### 8E — Documentation
- User manual per persona (PDF + in-app help)
- API reference (Swagger UI at /api/docs)
- Deployment doc
- Maintenance guide

### Acceptance Criteria
- [ ] MFA mandatory for finance manager+
- [ ] All endpoints rate-limited
- [ ] No critical security findings
- [ ] Excel data fully migrated; trial balance Rp 0 diff vs Excel
- [ ] Backup runs daily; restore tested
- [ ] User manual covers all 8 personas
- [ ] Champion users approve UAT

### DoD
- [ ] Lint clean
- [ ] `testing_agent_v3`: full regression + security scenarios
- [ ] Migration tested with full year of historical data
- [ ] Manual final acceptance by stakeholder

---

## 📦 BACKLOG (Post Go-Live)

Low priority / future:
- BKL-01 WhatsApp Cloud API for outlet notifications
- BKL-02 Bank H2H integration
- BKL-03 Scheduled reports (email/WA delivery)
- BKL-04 Multi-currency (if vendor luar negeri appears)
- BKL-05 Mobile native app (PWA first; React Native later)
- BKL-06 Advanced ML forecasting (custom models)
- BKL-07 Customer loyalty (if needed)
- BKL-08 POS integration (if business decides POS later)
- BKL-09 Two-way sync with payroll software
- BKL-10 Tax reporting (e-Faktur / e-Bupot)
- BKL-11 Procurement RFQ flow
- BKL-12 Recipe/BOM (if business decides)
- BKL-13 Voice command ("Hey Aurora, sales today?")
- BKL-14 Public API for partners
- BKL-15 Fine-grained dashboard layout per user

---

## 📊 Phase Tracking Table (Live — update as we go)

| Phase | Status | Start | End | Notes |
|---|---|---|---|---|
| 0 — Discovery | ✅ Complete | — | — | Plan docs created |
| 1 — POC AI | ✅ Complete | 2026-04-26 | 2026-04-26 | All 5 tests passed; see PHASE_1_POC_RESULT.md |
| 2 — Foundation | ✅ Complete | 2026-04-26 | 2026-04-26 | Auth+RBAC+Master+Admin Portal; see PHASE_2_RESULT.md |
| 3 — Procurement+Inventory | ⏳ Pending | | | |
| 4 — Finance | ⏳ Pending | | | |
| 5 — HR | ⏳ Pending | | | |
| 6 — Executive+AI | ⏳ Pending | | | |
| 7 — Polish | ⏳ Pending | | | |
| 8 — Hardening | ⏳ Pending | | | |

---

## 🔄 Phase Completion Protocol

For each phase, this checklist MUST be done before moving on:

1. ✅ All sub-phases delivered
2. ✅ All user stories acceptance criteria met
3. ✅ `testing_agent_v3` invoked with full user story scenarios
4. ✅ All bugs from testing agent fixed (no high/critical open)
5. ✅ Lint hijau
6. ✅ Visual review (design adherence ≥ 95%)
7. ✅ Performance budget met
8. ✅ PRD/MODULES/UI_UX docs updated if any deviation
9. ✅ CHANGELOG entry written
10. ✅ Stakeholder demo & signoff
