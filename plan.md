# Aurora F&B (Torado Group ERP) — Development Plan

**Repo:** `pandekomangyogaswastika-dot/torado5` (continuation)
**Preview URL:** https://torado-staging.preview.emergentagent.com
**Stack:** FastAPI · MongoDB · React 19 · Tailwind · shadcn/ui · Framer Motion

---

## Phase Tracker

| Phase | Scope | Status | Result Doc |
|---|---|---|---|
| 0 | Discovery & Planning (PRD / ARCHITECTURE / RBAC / ERD / 10+ docs) | ✅ Complete | `memory/PRD.md` |
| 1 | AI POC (chat / autocomplete / categorize / OCR / forecast) | ✅ Complete | `PHASE_1_POC_RESULT.md` |
| 2 | Foundation (Auth / RBAC / Master Data) | ✅ Complete | |
| 3 | Procurement + Inventory | ✅ Complete | `PHASE_3_RESULT.md` |
| 4 | Finance Core (COA / JE / TB / P&L / AP) | ✅ Complete (core)¹ | `PHASE_4_RESULT.md` |
| 5 | HR (employees / payroll / incentive engine) | ✅ Complete (core)² | `PHASE_5_RESULT.md` |
| 6 | Executive + AI Integration | ✅ Complete | `PHASE_6_RESULT.md` |
| 6D | Multi-tier Approvals + Period Locking | ✅ Complete | `PHASE_6_PART_D_RESULT.md` |
| 7A | Self-Service Configuration | ✅ Complete | `PHASE_7A_RESULT.md` |
| 7B | Advanced Reporting (Builder / Pivot / Vendor Scorecard / Comparatives) | ✅ Complete | `PHASE_7B_RESULT.md` |
| 7C | 3-Month Forecasting + Guard Persistence | ✅ Complete | `PHASE_7C_RESULT.md` |
| **7D** | **Real-Time Anomaly Detection** | **✅ Complete** | **`PHASE_7D_RESULT.md`** |
| 7E | Performance & Polish (mobile/dark/A11y/SEO) | ⏳ Pending | |
| 8 | Hardening & Go-Live | ⏳ Pending | |

¹ Deferred from Phase 4: Balance Sheet, Cashflow Report, Bank Reconciliation, PAY workflow.
² Deferred from Phase 5: Appraisal module.

---

## Phase 7D — Real-Time Anomaly Detection — ✅ SHIPPED

### Delivered

**Backend** (7 files new/modified):
- `services/anomaly_service.py` — 4 detectors + idempotent upsert + notification dispatch (724 LoC)
- `routers/anomalies.py` — 8 endpoints
- `services/business_rules_service.py` — new `anomaly_threshold_policy` rule type + default seed
- `services/outlet_service.py` — live hook in `validate_daily_sales`
- `services/procurement_service.py` — live hook in `post_gr`
- `core/perms_catalog.py` — 3 new permissions
- `seed/seed_phase7d_demo.py` — demo seed (14 anomalies / 53 notifications)
- `tests/poc_phase7d_anomalies.py` — POC isolation (7/7 passed)

**Frontend** (9 files new/modified):
- `portals/finance/AnomalyFeed.jsx` — main feed + filter + detail sheet + triage
- `components/shared/AnomalyOverviewWidget.jsx` — Executive dashboard widget
- `portals/admin/configuration/AnomalyThresholdsPage.jsx` — rule list page
- `portals/admin/configuration/AnomalyThresholdEditor.jsx` — 4-section editor
- `portals/finance/FinancePortal.jsx` — registered `/finance/anomalies`
- `portals/admin/AdminPortal.jsx` — registered `/admin/configuration/anomaly-thresholds`
- `portals/admin/configuration/ConfigurationLayout.jsx` — added sub-tab
- `portals/admin/configuration/configHelpers.js` — added label
- `portals/executive/ExecutivePortal.jsx` — wired widget next to Forecast Guard

### Detectors
| Type | Algorithm | Default Thresholds |
|---|---|---|
| sales_deviation | Z-score vs rolling 14-day outlet baseline | mild≥1.5σ · severe≥2.5σ |
| vendor_price_spike | % deviation vs vendor 90-day item avg | mild≥15% · severe≥30% |
| vendor_leadtime | Excess days vs vendor 90-day baseline | mild≥+3d · severe≥+7d |
| ap_cash_spike | Projected-monthly vs 3-month baseline | mild≥15% · severe≥30% |

### Test Result
- POC: **7/7 passed** (test_core.py equivalent)
- testing_agent_v3: **93.5% backend / 100% frontend** (iteration_6.json)

### User Stories — All ✅
US-7D-1 through US-7D-6 all delivered (see `PHASE_7D_RESULT.md` for details).

---

## Next Phase Options

1. **Phase 7E — Performance & Polish**
   - Mobile responsive audit across all 7 portals
   - Dark mode theme fixes
   - Accessibility (keyboard nav, ARIA, color contrast)
   - Skeleton state audit
   - Lint cleanup
   - SEO meta

2. **Backfill P0 gaps from MODULE_ENHANCEMENT_PLAN.md**
   - Balance Sheet report
   - Cashflow Report
   - Bank Reconciliation
   - PAY workflow
   - KDO/BDO sub-pages
   - Daily Close page
   - File upload / OCR

3. **Phase 8 — Hardening & Go-Live**
   - Load/stress testing
   - Security review
   - Backup/restore
   - Onboarding docs
   - Deployment runbook

**Direction awaiting user confirmation after Phase 7D delivery.**
