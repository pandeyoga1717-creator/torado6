# 🏛️ ARCHITECTURE — Aurora F&B
**Companion to:** PRD.md → Section 7  
**Version:** 1.0

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Browser / Mobile (PWA)                     │
│  React 19 + Vite + Tailwind + shadcn/ui + Framer Motion          │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS / JWT
┌──────────────────▼──────────────────────────────────────────────┐
│                       FastAPI Backend                            │
│  - Routers: /api/{module}                                        │
│  - Services: business logic                                      │
│  - Repositories: Mongo access                                    │
│  - Background workers: anomaly, forecasting (APScheduler)        │
│  - AI Layer: emergentintegrations (LLM proxy)                    │
└──────────────────┬───────────────────┬──────────────────────────┘
                   │                   │
        ┌──────────▼─────────┐  ┌──────▼──────────┐
        │   MongoDB           │  │  Emergent LLM   │
        │  - master           │  │  (GPT/Claude/   │
        │  - transactional    │  │   Gemini)       │
        │  - audit            │  └─────────────────┘
        │  - config           │
        └─────────────────────┘
```

---

## 2. Folder Structure

### Backend (`/app/backend/`)

```
backend/
├── server.py                  # FastAPI app entrypoint
├── core/
│   ├── config.py              # env, settings
│   ├── security.py            # JWT, hash, RBAC dependency
│   ├── db.py                  # mongo client + collection helpers
│   ├── exceptions.py          # custom errors
│   └── audit.py               # audit log helper
├── models/                    # Pydantic models per domain
│   ├── master.py              # Outlet, Brand, Item, Vendor, Employee, COA
│   ├── outlet.py              # DailySales, PettyCashTxn, UrgentPurchase
│   ├── procurement.py         # PR, PO, GR
│   ├── inventory.py           # Movement, Transfer, Adjustment, Opname
│   ├── finance.py             # JAE, PAY, KB, TaxDetail, Period
│   ├── hr.py                  # EA, Incentive, ServiceAlloc, LBFund, Voucher, FOC, TravelIncentive
│   ├── config.py              # BusinessRule, Workflow, Approval
│   └── ai.py                  # AIChatSession, AIPrediction
├── services/                  # Domain logic, orchestration
│   ├── outlet_service.py
│   ├── procurement_service.py
│   ├── inventory_service.py
│   ├── finance_service.py
│   ├── hr_service.py
│   ├── journal_service.py     # event → journal entry mapping
│   ├── reporting_service.py   # PL, BS, AP aging, etc.
│   ├── anomaly_service.py     # daily anomaly detection
│   ├── forecasting_service.py
│   └── ai_service.py          # LLM orchestration
├── routers/                   # FastAPI routers (HTTP layer)
│   ├── auth.py                # /api/auth
│   ├── outlet.py              # /api/outlet
│   ├── procurement.py         # /api/procurement
│   ├── inventory.py           # /api/inventory
│   ├── finance.py             # /api/finance
│   ├── hr.py                  # /api/hr
│   ├── admin.py               # /api/admin
│   ├── executive.py           # /api/executive
│   ├── ai.py                  # /api/ai
│   └── search.py              # /api/search (global)
├── repositories/              # Mongo CRUD per collection
│   └── *_repo.py
├── workers/                   # Scheduled jobs
│   └── scheduler.py           # APScheduler init
├── tests/                     # pytest
├── seed/                      # seed scripts
│   └── seed_demo.py
├── requirements.txt
└── .env
```

### Frontend (`/app/frontend/src/`)

```
src/
├── App.js                     # router + provider tree
├── App.css
├── index.css                  # Tailwind base + custom CSS variables (design tokens)
├── lib/
│   ├── api.js                 # axios client + interceptors
│   ├── auth.js                # JWT helpers, AuthContext
│   ├── format.js              # Rupiah, date, number formatters
│   ├── queryClient.js         # TanStack Query
│   └── permissions.js         # RBAC client checks
├── components/
│   ├── ui/                    # shadcn components
│   ├── layout/
│   │   ├── AppShell.jsx       # Top-nav + side-rail + main
│   │   ├── TopNav.jsx         # portal switcher (top horizontal)
│   │   ├── SideRail.jsx       # quick actions (left vertical icons)
│   │   ├── PortalSubNav.jsx   # sub-menu for current portal
│   │   └── BreadcrumbBar.jsx
│   ├── shared/
│   │   ├── GlobalSearch.jsx   # Cmd+K
│   │   ├── NotificationCenter.jsx
│   │   ├── UserMenu.jsx
│   │   ├── ThemeToggle.jsx
│   │   ├── DataTable.jsx      # generic with filter/sort/pagination
│   │   ├── FilterChips.jsx
│   │   ├── EmptyState.jsx
│   │   ├── LoadingState.jsx
│   │   ├── ErrorState.jsx
│   │   ├── KpiCard.jsx        # animated number, sparkline
│   │   ├── ChartCard.jsx      # glass wrapper for charts
│   │   ├── DrilldownDialog.jsx
│   │   ├── ApprovalChain.jsx
│   │   ├── AuditLogPanel.jsx
│   │   └── AiChatDrawer.jsx
│   └── forms/
│       ├── DateRangePicker.jsx
│       ├── OutletSelector.jsx
│       ├── BrandSelector.jsx
│       ├── ItemAutocomplete.jsx (AI-powered)
│       ├── VendorAutocomplete.jsx
│       └── CurrencyInput.jsx
├── portals/
│   ├── executive/
│   │   ├── ExecutiveHome.jsx
│   │   ├── ConsolidatedDashboard.jsx
│   │   ├── BrandDrilldown.jsx
│   │   └── AiAssistantPage.jsx
│   ├── outlet/
│   │   ├── OutletHome.jsx     # "Today's Tasks" guided
│   │   ├── DailySales.jsx
│   │   ├── PettyCash.jsx
│   │   ├── UrgentPurchase.jsx
│   │   ├── StockOpname.jsx
│   │   └── DailyClose.jsx
│   ├── procurement/
│   │   ├── PRList.jsx
│   │   ├── PODraft.jsx
│   │   ├── VendorComparison.jsx
│   │   └── ReceivingQueue.jsx
│   ├── inventory/
│   │   ├── MovementJournal.jsx
│   │   ├── TransferList.jsx
│   │   ├── AdjustmentList.jsx
│   │   ├── OpnameSession.jsx
│   │   └── ValuationReport.jsx
│   ├── finance/
│   │   ├── SalesValidationQueue.jsx
│   │   ├── APLedger.jsx       # KB
│   │   ├── PaymentRequest.jsx # PAY
│   │   ├── JournalEntries.jsx # JAE
│   │   ├── TaxDetails.jsx
│   │   ├── PettyCashSettlement.jsx
│   │   ├── PeriodClosing.jsx
│   │   ├── ProfitLoss.jsx
│   │   └── BalanceSheet.jsx
│   ├── hr/
│   │   ├── EmployeeAdvances.jsx
│   │   ├── ServiceCharge.jsx
│   │   ├── Incentive.jsx
│   │   ├── LBFund.jsx
│   │   ├── Voucher.jsx
│   │   ├── FOC.jsx
│   │   └── TravelIncentive.jsx
│   └── admin/
│       ├── Users.jsx
│       ├── Roles.jsx
│       ├── MasterData.jsx     # Item/Vendor/Employee/COA tabs
│       ├── BusinessRules.jsx
│       ├── Workflows.jsx
│       ├── NumberSeries.jsx
│       └── AuditLog.jsx
├── pages/
│   ├── Login.jsx
│   ├── ForgotPassword.jsx
│   └── NotFound.jsx
├── hooks/
│   ├── useAuth.js
│   ├── usePermissions.js
│   ├── useNotifications.js
│   ├── useGlobalSearch.js
│   └── useTheme.js
└── styles/
    └── glassmorphism.css      # custom glass utilities
```

---

## 3. API Contract Conventions

### Routing
- All routes prefixed `/api`
- Resource-based: `/api/{module}/{resource}` (e.g. `/api/outlet/daily-sales`)
- Plural resources: `/api/finance/journal-entries`
- Standard verbs: `GET` (list/detail), `POST` (create), `PATCH` (update), `DELETE` (soft)

### Response Envelope
```json
{
  "success": true,
  "data": <payload>,
  "meta": { "page": 1, "per_page": 20, "total": 100 },
  "errors": null
}
```
On error:
```json
{
  "success": false,
  "data": null,
  "errors": [
    { "code": "VALIDATION_ERROR", "field": "qty", "message": "Qty must be positive" }
  ]
}
```

### Pagination
- `?page=1&per_page=20` (default per_page=20, max 100)
- Cursor-based for high-frequency lists in Phase 7

### Filtering
- Conventions: `?outlet_id=...&date_from=...&date_to=...&status=approved`
- Free-text search: `?q=...`

### Idempotency
- POST that creates with side-effect (PO, PAY) accepts `Idempotency-Key` header (UUID)
- Server stores key+result for 24h

### Auth
- Login: `POST /api/auth/login` → `{ access_token, refresh_token, user }`
- Refresh: `POST /api/auth/refresh`
- All other endpoints: `Authorization: Bearer <token>`
- Bearer JWT with claims: `sub` (user_id), `roles`, `outlets`, `exp`

### Versioning
- v1 inferred (no prefix). v2 only if breaking change post Phase 8.

---

## 4. Data Model — Master Entities

MongoDB collections. All documents use UUID `id` (string), not ObjectId. Each has `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` (soft).

### 4.1 `groups` (single doc usually — single tenant)
```
{
  id, name, legal_name, npwp, address, fiscal_year_start, currency_default: "IDR",
  logo_url, settings: {timezone, date_format}, created_at, ...
}
```

### 4.2 `brands`
```
{
  id, group_id, code (unique), name, logo_url, color, active, ...
}
```

### 4.3 `outlets`
```
{
  id, brand_id, code, name, address, phone, manager_user_id,
  open_time, close_time, sales_schema_id (ref business_rules), petty_cash_policy_id,
  service_policy_id, incentive_policy_id, active, ...
}
```

### 4.4 `users`
```
{
  id, email, password_hash, full_name, phone, avatar_url, status (active/disabled),
  role_ids: [], outlet_ids: [], brand_ids: [], default_portal,
  last_login_at, mfa_enabled, ...
}
```

### 4.5 `roles`
```
{
  id, code (unique), name, description,
  permissions: ["outlet.daily_sales.create", "finance.jae.approve", ...]
}
```

### 4.6 `items` (Item Master) — replaces ML
```
{
  id, code, sku, name, name_local, category_id, unit_default, conversion_units: [{unit, factor}],
  is_direct_purchase, contra_account_id, active, image_url, notes, ...
}
```

### 4.7 `item_price_history` — separated from item master (best practice)
```
{
  id, item_id, vendor_id, price, unit, valid_from, valid_to, source ("PO" or "manual"),
  recorded_by, ...
}
```

### 4.8 `categories`
```
{
  id, type ("item" / "expense" / "revenue"), code, name, parent_id, gl_account_id (default), active
}
```

### 4.9 `vendors`
```
{
  id, code, name, npwp, address, contact_name, phone, email, bank_account: {bank, account, name},
  default_payment_terms_days, default_payment_method, active, notes, ...
}
```

### 4.10 `employees`
```
{
  id, code, full_name, position, department, outlet_id, brand_id,
  status (active/leave/terminated), join_date,
  bank_account, npwp, gross_salary, basic_salary, ...
}
```

### 4.11 `chart_of_accounts` (COA) — replaces ACC
```
{
  id, code (e.g. "1100"), name (e.g. "Cash"), name_id (Bahasa),
  type (asset/liability/equity/revenue/cogs/expense),
  parent_id, level, normal_balance ("Dr"/"Cr"),
  is_postable (leaf level), tax_code_id, active, ...
}
```

### 4.12 `tax_codes`
```
{
  id, code ("PPN-11"), name, rate (0.11), gl_account_payable_id, gl_account_receivable_id, active
}
```

### 4.13 `payment_methods`
```
{
  id, code, name, type (cash/transfer/qris/card/other),
  bank_account_id (link to internal bank account), active
}
```

### 4.14 `bank_accounts` (internal)
```
{
  id, code, name, bank, account_number, currency, gl_account_id, active
}
```

### 4.15 `number_series`
```
{
  id, code ("PR", "PO", "GR", "JAE", "PAY", "KB"),
  prefix, padding (e.g. 6), reset (yearly/monthly/never),
  current_value, format ("PR-{YY}{MM}-{0000}")
}
```

### 4.16 `business_rules`
```
{
  id, scope_type (group/brand/outlet), scope_id, rule_type, rule_data: { ... }, active, version, ...
}
```
Rule types:
- `sales_input_schema` — channels, payment methods, revenue buckets per outlet
- `petty_cash_policy` — limit, approval threshold, replenishment trigger
- `service_charge_policy` — % service, allocation formula
- `incentive_policy` — formula, threshold, eligibility
- `loss_breakage_policy` — %, fund cap
- `approval_workflow` — for PR, PO, PAY, JAE per amount tier

---

## 5. Data Model — Transactional Entities

### 5.1 `daily_sales`
```
{
  id, outlet_id, brand_id, sales_date, status (draft/submitted/validated/locked),
  schema_version, channels: [{channel, gross, discount, net}],
  payment_breakdown: [{payment_method_id, amount}],
  revenue_buckets: [{bucket, amount}],   # food, beverage, retail, etc.
  service_charge, tax_amount, grand_total,
  notes, validated_by, validated_at, journal_entry_id, ...
}
```

### 5.2 `petty_cash_transactions`
```
{
  id, outlet_id, txn_date, type (purchase/replenish/adjustment),
  amount, item_id (optional), vendor_text, category_id, gl_account_id,
  receipt_url, recorded_by, status (draft/submitted/approved/posted),
  journal_entry_id, balance_after, ...
}
```

### 5.3 `urgent_purchases`
```
{
  id, outlet_id, purchase_date, vendor_text, items: [{name, qty, unit, cost, total}],
  payment_method, paid_by, total, receipt_url, notes,
  recorded_by, status (draft/approved/rejected), approved_by, journal_entry_id, ...
}
```

### 5.4 `purchase_requests` (PR)
```
{
  id, doc_no, requester_user_id, outlet_id, brand_id, request_date,
  source ("KDO"/"BDO"/"manual"),
  lines: [{item_id, qty, unit, est_cost, notes}],
  status (draft/submitted/approved/rejected/converted),
  approval_chain: [{level, approver_id, action, at, note}],
  approved_at, converted_to_po_id, ...
}
```

### 5.5 `purchase_orders` (PO)
```
{
  id, doc_no, vendor_id, outlet_id (or central), pr_ids: [],
  order_date, expected_delivery_date,
  lines: [{item_id, qty, unit, unit_cost, discount, tax, total}],
  subtotal, tax_total, grand_total,
  payment_terms_days, status (draft/sent/partial/received/closed/cancelled),
  approval_chain, sent_at, ...
}
```

### 5.6 `goods_receipts` (GR)
```
{
  id, doc_no, po_id, vendor_id, outlet_id, receive_date,
  lines: [{po_line_id, item_id, qty_received, qty_variance, unit, condition_note}],
  invoice_no, invoice_date, invoice_amount, invoice_url,
  received_by, status (draft/posted), inventory_movement_ids: [], kb_id, ...
}
```

### 5.7 `inventory_movements`
```
{
  id, item_id, outlet_id, movement_date, movement_type ("receipt"/"issue"/"transfer"/"adjustment"/"opname_diff"),
  qty, unit, unit_cost, total_cost, ref_type, ref_id, balance_after, ...
}
```

### 5.8 `transfers`
```
{
  id, doc_no, from_outlet_id, to_outlet_id, transfer_date,
  lines: [{item_id, qty, unit, unit_cost, total_cost}],
  status (draft/sent/received/discrepancy), sent_by, received_by, notes, ...
}
```

### 5.9 `adjustments`
```
{
  id, doc_no, outlet_id, adjustment_date, reason (waste/damage/correction/other),
  lines: [{item_id, qty_delta, unit_cost, total_cost}],
  approved_by, gl_account_id, journal_entry_id, ...
}
```

### 5.10 `opname_sessions`
```
{
  id, doc_no, outlet_id, period (e.g. 2026-04), opname_date, status (draft/in-progress/closed),
  counted_by_user_ids: [], lines: [{item_id, system_qty, counted_qty, variance, unit_cost, variance_value, notes}],
  total_variance_value, journal_entry_id, ...
}
```

### 5.11 `accounting_periods`
```
{
  id, period ("2026-04"), status (open/closed/locked),
  closed_by, closed_at, fiscal_year, ...
}
```

### 5.12 `journal_entries` (JAE — header)
```
{
  id, doc_no, entry_date, period, source_type ("manual"/"sales"/"po_gr"/"payment"/"opname"/"adjustment"/"hr_alloc"),
  source_id, description, status (draft/posted/reversed),
  lines: [{coa_id, dr, cr, memo, dim_outlet, dim_brand, dim_employee, dim_vendor}],
  total_dr, total_cr, posted_by, posted_at, reversal_of, ...
}
```

### 5.13 `payment_requests` (PAY — money out)
```
{
  id, doc_no, request_date, payee_type ("vendor"/"employee"/"other"), payee_id, payee_text,
  description, amount, gl_debit_id, payment_method_id, bank_account_id,
  invoice_no, invoice_date, kb_id (optional link), tax_detail_id (optional),
  status (draft/approved/paid/cancelled), approval_chain,
  payment_date, payment_ref, journal_entry_id, ...
}
```

### 5.14 `ap_ledger` (KB — Kontra Bon)
```
{
  id, vendor_id, gr_id (optional), invoice_no, invoice_date, due_date,
  amount, balance, currency: "IDR",
  status (open/partial/paid/overdue), payments: [{pay_id, amount, date}],
  posted_by, posted_at, ...
}
```

### 5.15 `tax_details`
```
{
  id, tax_period, tax_code_id, ref_type, ref_id,
  tax_base, tax_amount, dr_or_cr, status (open/paid/reported),
  invoice_no, paid_at, payment_ref, ...
}
```

---

## 6. Data Model — HR & Incentive Entities

### 6.1 `employee_advances` (EA)
```
{
  id, doc_no, employee_id, advance_date, grand_total, payment_method_id, payment_date,
  termin_count, termin_amount, schedule: [{period, amount, status}],
  outstanding_balance, notes, journal_entry_id, ...
}
```

### 6.2 `service_charge_periods`
```
{
  id, period, outlet_id, distribute_date, total_revenue_service,
  policy_snapshot: { lb_pct, ld_pct, ... },
  lb_amount, ld_amount, distributable_amount,
  allocations: [{employee_id, days_service, share_amount}],
  status (draft/posted), journal_entry_id, ...
}
```

### 6.3 `lb_fund_ledger`
```
{
  id, date, description, dr, cr, balance, ref_type, ref_id, ...
}
```

### 6.4 `incentives`
```
{
  id, period, outlet_id, scheme_id (rule), employee_id,
  target, achieved, achievement_pct, incentive_amount,
  status (calculated/approved/paid), journal_entry_id, ...
}
```

### 6.5 `vouchers`
```
{
  id, code, name, value, cogs_pct, issue_date, expire_date,
  claimed_amount, remaining_amount, status (active/redeemed/expired),
  payment_method_id, redeem_history: [{date, amount, ref}], ...
}
```

### 6.6 `foc_entries`
```
{
  id, date, outlet_id, description, amount, dr_account, cr_account,
  category (marketing/comp/staff/other), ref, journal_entry_id, ...
}
```

### 6.7 `travel_incentives`
```
{
  id, date, driver_employee_id, vehicle, passenger_count, bill_no, total_bill,
  fee_pct, fee_amount, payment_status, bank_account, journal_entry_id, ...
}
```

---

## 7. Data Model — Cross-Cutting Entities

### 7.1 `audit_log`
```
{
  id, user_id, timestamp, entity_type, entity_id, action (create/update/delete/approve/reject/post/reverse),
  before, after, reason, ip, user_agent, ...
}
```

### 7.2 `notifications`
```
{
  id, user_id, type (info/warn/urgent/done), title, body, link,
  source_type, source_id, read_at, created_at
}
```

### 7.3 `attachments`
```
{
  id, ref_type, ref_id, filename, content_type, size, url, uploaded_by, uploaded_at
}
```

### 7.4 `ai_chat_sessions`
```
{
  id, user_id, started_at, last_message_at, title (auto-summary),
  messages: [{role, content, ts, tool_calls, tool_results, sources: [{ref_type, ref_id}]}],
  context_scope: { brand_ids, outlet_ids, period }
}
```

### 7.5 `ai_predictions`
```
{
  id, type (sales_forecast/expense_forecast/anomaly/recommendation),
  target_type, target_id, period, output: { ... },
  confidence, generated_at, model_used, prompt_version
}
```

### 7.6 `approval_queues` (logical view, can be index)
- Materialized via index on transactional collections where status="submitted" and approver in chain.

### 7.7 `system_settings`
```
{ id, key, value, updated_by, updated_at }
```

---

## 8. Indexes & Performance

- `daily_sales`: compound `(outlet_id, sales_date desc)`
- `journal_entries`: `(period, status)`, `(source_type, source_id)`
- `inventory_movements`: `(item_id, outlet_id, movement_date desc)`
- `ap_ledger`: `(vendor_id, status)`, `(due_date asc)` for aging
- `audit_log`: `(entity_type, entity_id, timestamp desc)`
- `notifications`: `(user_id, read_at, created_at desc)`
- TTL index on completed `ai_chat_sessions` after 90 days

---

## 9. Security Model

### Auth Layer
- bcrypt password hashing (cost=12)
- JWT access (24h) + refresh (7d)
- Refresh token stored hashed in `refresh_tokens` collection (revocable)
- Optional MFA (TOTP) — Phase 8

### Authorization (RBAC)
- Permission code: `<module>.<resource>.<action>` (e.g., `outlet.daily_sales.validate`)
- Each route declares required permission via dependency: `Depends(require_perm("..."))`
- Scope check (outlet/brand) executed in service layer using `user.outlet_ids`

### Data Scope Enforcement
- All transactional queries filtered by user's accessible outlets
- Group/Executive role has `*` scope

### Period Lock
- Cannot create/modify entries with `entry_date` inside closed period
- Exception: Finance Manager can post adjustment with explicit reason → audit

### Rate Limiting
- Login: 5/min/IP
- AI endpoints: 30/min/user
- General: 100/min/user

### Audit
- Every write logs to `audit_log` (sync, in-band)

---

## 10. AI Integration Layer

### Module: `services/ai_service.py`
Responsibilities:
1. **Tool catalog** — wrap data services as functions LLM can call (via tool/function calling)
2. **Context builder** — assemble RBAC-scoped, period-scoped data into prompt
3. **Provider abstraction** — emergentintegrations switching GPT/Claude/Gemini per use case
4. **Output validation** — schema-check JSON outputs (Pydantic)
5. **Caching** — cache deterministic queries (5 min)
6. **Cost tracking** — log token usage per session/user

### Provider mapping (default):
- **Conversational chat** → Claude Sonnet (best reasoning)
- **Forecasting/structured** → GPT-5 (function calling)
- **Categorization** → GPT-5 mini (cheap, fast)
- **OCR receipt** → Gemini (multimodal)
- **Anomaly explanation** → Claude Sonnet

---

## 11. Background Jobs (APScheduler)

| Job | Schedule | Action |
|---|---|---|
| `daily_anomaly_scan` | 06:00 WIB | Scan yesterday's data, flag outliers, create notifications |
| `ap_aging_refresh` | hourly | Update AP aging buckets |
| `inventory_balance_recalc` | every 30min (delta-based) | Maintain `inventory_balances` projection |
| `notification_digest_email` | 17:00 WIB | Email summary to managers |
| `forecasting_weekly` | Sunday 22:00 WIB | Train/refresh forecast models |
| `period_lock_reminder` | Day 5 of month, 09:00 | Remind finance to close prev period |

---

## 12. Environment Variables

### Backend `.env`
```
MONGO_URL=...
JWT_SECRET=...
JWT_ACCESS_MINUTES=1440
JWT_REFRESH_DAYS=7
EMERGENT_LLM_KEY=...
TIMEZONE=Asia/Jakarta
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE_MB=10
FEATURE_AI_ENABLED=true
FEATURE_FORECASTING_ENABLED=false (Phase 6)
```

### Frontend `.env`
```
REACT_APP_BACKEND_URL=...
```
*(MUST NOT MODIFY pre-existing values)*

---

## 13. Migration Strategy from Excel

See `EXCEL_MAPPING.md` for column-by-column mapping.

Migration tool (Phase 8):
1. User uploads Excel file (each workbook)
2. System parses with `openpyxl`
3. Validation report (errors per row)
4. Preview & confirm
5. Insert into MongoDB (with `imported_from_excel: true` flag)
6. Generate retroactive journal entries

---

## 14. Testing Architecture

- **Unit tests** — `pytest` for services
- **Integration tests** — FastAPI TestClient for routers
- **E2E** — `testing_agent_v3` (Playwright behind the scenes) for user-story scenarios
- **Load** — locust for Phase 7 (50 concurrent users)

---

## 15. Observability

- Logs: structured JSON via `loguru` → file + stdout
- Errors: Sentry (Phase 7+)
- Metrics: Prometheus exporter (Phase 7+)
- Traces: OpenTelemetry (Phase 8+)
- Health: `/api/health` (db ping + version)

---

## 16. Deployment

- supervisor controls both services
- frontend hot-reload via Vite
- backend hot-reload via uvicorn watch
- production: same shape, behind ingress
- backup: cron-driven mongodump → `/app/backups/{YYYY-MM-DD}/`

---

## Appendix A — Complete Collection List

```
Master:           groups, brands, outlets, users, roles, items, item_price_history,
                  categories, vendors, employees, chart_of_accounts, tax_codes,
                  payment_methods, bank_accounts, number_series, business_rules
Transactional:    daily_sales, petty_cash_transactions, urgent_purchases,
                  purchase_requests, purchase_orders, goods_receipts,
                  inventory_movements, transfers, adjustments, opname_sessions,
                  accounting_periods, journal_entries, payment_requests,
                  ap_ledger, tax_details
HR:               employee_advances, service_charge_periods, lb_fund_ledger,
                  incentives, vouchers, foc_entries, travel_incentives
Cross-cutting:    audit_log, notifications, attachments, ai_chat_sessions,
                  ai_predictions, system_settings, refresh_tokens
```

Total: ~36 collections. Will scale to ~50 by Phase 8 with derived projections.
