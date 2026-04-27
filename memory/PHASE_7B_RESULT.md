# Phase 7B — Advanced Reports — RESULT

**Status:** ✅ Complete  
**Date:** Jan 2026  
**Iteration test:** `/app/test_reports/iteration_2.json` (23/23 after fix)

---

## Scope Delivered

### 1. Vendor Performance Scorecard
- **Endpoints:** `GET /api/reports/vendor-scorecard` (ranked list) + `GET /api/reports/vendor-scorecard/{id}` (detail)
- **Metrics computed per vendor:**
  - On-Time % (GR.receive_date ≤ PO.expected_delivery_date)
  - Avg Lead Time (days, GR.receive_date − PO.sent_at)
  - Price Stability % (1 − stddev/mean of unit_cost per item, averaged)
  - Defect Rate % (qty_ordered − qty_received) / qty_ordered
  - Total Spend (Σ GR.grand_total)
  - **Composite Score** (0-100): `on_time × 0.40 + price_stab × 0.25 + (100−defect) × 0.20 + lead_score × 0.15`
- **Color-coded grading:** ≥85 emerald, ≥70 amber, <70 red
- **Drill-down:** detail panel shows per-PO breakdown (doc_no, order_date, on-time/late badge, grand_total)

### 2. Report Builder (lite)
- **Endpoint:** `POST /api/reports/builder/run`
- **Dimensions** (5): outlet, brand, vendor, category, month
- **Metrics** (8): sales, transaction_count, cogs, gross_profit, ap_exposure, po_count, gr_count, purchase_value
- **Filters:** date range, multi-select outlet/brand/vendor/category
- **Output:** rows[] keyed by `dim_*` + per-metric values, totals dict, row_count
- **CSV export** in frontend

### 3. Pivot Matrix
- **Endpoint:** `GET /api/reports/pivot?dim_x&dim_y&metric&period_from&period_to`
- **Output:** x_labels[], y_labels[], cells[][], row_totals[], col_totals[], grand_total
- **Frontend:** heat-mapped cells (intensity ∝ value/max), sticky row labels, CSV export

### 4. Comparatives (MoM / YoY)
- **Endpoint:** `GET /api/reports/comparatives?metric&period&compare_to=mom|yoy`
- **Output:** current, previous, previous_period, delta, delta_pct, rolling_12m[]
- **Frontend:** 3 KPI cards (current/previous/Δ%) + 12-month sparkline (current period highlighted purple)

### 5. Saved Reports CRUD
- **Endpoints:** `GET/POST/PATCH/DELETE /api/reports/saved`
- Per-user definitions stored in `saved_reports` collection
- Soft-delete via `deleted_at`
- Owner check on edit/delete; `public` flag allows shared visibility (read-only)

---

## Files Added/Modified

### Backend
- ✅ NEW `services/reports_service.py` (791 lines) — all 5 features
- ✅ NEW `routers/reports.py` (10 endpoints)
- ✅ NEW `seed/seed_phase7b_demo.py` — 240 daily_sales + 45 PO + 38 GR
- ✅ MOD `server.py` — register reports router
- ✅ MOD `core/exceptions.py` — `ValidationError.status_code` 422 → 400 (REST semantics)
- ✅ MOD `.env` — added `EMERGENT_LLM_KEY` + `JWT_SECRET`

### Frontend
- ✅ NEW `portals/finance/VendorScorecard.jsx` — ranked list + detail drilldown
- ✅ NEW `portals/finance/ReportBuilder.jsx` — pill-based dim/metric selector + saved reports
- ✅ NEW `portals/finance/PivotReport.jsx` — heat-mapped 2D matrix
- ✅ NEW `portals/finance/Comparatives.jsx` — MoM/YoY + sparkline
- ✅ MOD `portals/finance/FinancePortal.jsx` — added 4 sub-nav tabs

---

## Test Outcomes

| Layer | Pass | Fail | Notes |
|---|---|---|---|
| Backend | 23/23 (100%) | 0 | After 422→400 fix; covers all 10 endpoints, RBAC, regression |
| Frontend | 4/4 pages | 0 | Login + nav + render + drilldown verified; data-testid coverage complete after fix |

### Regression (Phase 4-7A) — all 200 OK
- `/api/finance/profit-loss`, `/trial-balance`, `/ap-aging`, `/journals`, `/periods`
- `/api/approvals/queue`, `/my`
- `/api/hr/advances`, `/payroll`

---

## Demo Data
After running both seeds, the system has:
- 240 validated daily_sales (60 days × 4 outlets) → Σ Rp 2.58 B sales
- 45 POs + 38 GRs across 6 vendors with realistic on-time%/lead-time/defect distributions
- 480 journal entries (sales + COGS auto-posted)
- Grade-A vendors (≥85): 3 of 6
- Sample MoM delta: April vs March = -17.47%

---

## Next Up — Phase 7C (Forecasting + Anomaly)
Per `/app/memory/PHASE_PLAN.md`:
1. 3-month sales forecast per outlet (linear regression / EWMA)
2. AP/Cash forecast for cash-flow planning
3. Real-time anomaly detection on daily_sales (deviation > 2σ from rolling 14-day average) → notification feed
4. Vendor anomaly (price spike, lead time degradation) → procurement alert
