# Plan — Phase 7: Configurability, Reports, Performance & Polish (Aurora F&B ERP)

## 1) Objectives

- ✅ **Phase 7 sequence confirmed**: **7A → 7B → 7E → 7C/7D**, defer **7F**.
- ✅ **Phase 6 + 6D are complete** (regression verified):
  - period locking + closing wizard
  - multi-tier approval engine + workflow UI
  - notification hooks for approvals
  - `/my-approvals` inbox + TopNav badge

- ✅ **Phase 7A — Self-Service Configuration UI — COMPLETED**
  - Deliver non-technical configuration editors (no raw JSON) backed by `business_rules` with effective dating/versioning.
  - New rule types supported:
    - `sales_input_schema`
    - `petty_cash_policy`
    - `service_charge_policy`
    - `incentive_policy`
  - New Admin UI sub-portal: `/admin/configuration/*` (Aurora glass style + full `data-testid` coverage).
  - First consumer wired: **HR service charge calculation** defaults from `service_charge_policy` with outlet→brand→group resolution and persisted policy metadata.

- 🎯 **Phase 7B — Advanced Reports — NEXT**
  - Ship “Phase 7 lite” report builder and high-value advanced reports.
  - Keep performance snappy and UX consistent with existing reporting pages.

**Status:** Phase 7A ✅ complete; **Phase 7B = starting now**.

---

## 2) Implementation Steps

### Phase 1 — Phase 7A Backend Foundation (BusinessRules Generalization)
**Goal:** Extend backend CRUD to support all Phase 7A rule types with scope + effective-dating + history.

**Status:** ✅ Completed

**Delivered**
1) **Generalized Admin Business Rules endpoints**
   - Updated `routers/admin.py` to support `rule_type` including:
     - approvals: `approval_workflow` (preserved)
     - configuration: `sales_input_schema`, `petty_cash_policy`, `service_charge_policy`, `incentive_policy`
   - Permission dispatch:
     - `admin.workflow.manage` for `approval_workflow`
     - `admin.business_rules.manage` for new configuration rule types

2) **CRUD + query support**
   - `GET /api/admin/business-rules` supports filters: `rule_type`, `scope_type`, `scope_id`, `active`, `effective_on`.
   - `POST /api/admin/business-rules` creates rules with auto-version (per scope+rule_type).
   - `PATCH /api/admin/business-rules/{id}` updates rule fields.

3) **Versioning & effective dating**
   - Added `services/business_rules_service.py`:
     - next-version increment
     - overlap detection (returns `overlaps_with`)
     - duplicate-as-draft
     - timeline query + overlap flags
     - scope-hierarchy resolver outlet → brand → group

4) **Timeline endpoint**
   - Added `GET /api/admin/business-rules/timeline` returning enriched `overlaps_with`.

5) **Seed defaults**
   - Extended `POST /api/admin/business-rules/seed-defaults` to support `{ rule_type: "config" }` seeding 4 baseline policies.

**Exit criteria Phase 1:** ✅ Met

---

### Phase 2 — Phase 7A Frontend: `/admin/configuration/*` (Self-Service Editors)
**Goal:** Deliver admin configuration pages and editors per `/app/design_guidelines.md`.

**Status:** ✅ Completed

**Delivered**
1) **Admin IA / routing**
   - Added Admin nav tab: **Konfigurasi**
   - Added nested routes:
     - `/admin/configuration/sales-schemas`
     - `/admin/configuration/petty-cash-policies`
     - `/admin/configuration/service-charge-policies`
     - `/admin/configuration/incentive-schemes`
     - `/admin/configuration/effective-dating`
   - Config section has its own pill subnav (`layoutId="config-subnav-pill"`).

2) **Shared components**
   - `ScopePicker` with URL persistence (`?scope_type=...&scope_id=...`)
   - `RuleListPage` table + filters
   - `RuleHistoryPanel` right-side version list
   - `RuleEditorShell` for consistent editor UX

3) **Editors delivered**
   - **Sales schemas** editor (Sheet)
   - **Petty cash policy** editor (Dialog)
   - **Service charge policy** editor (Dialog) + live preview
   - **Incentive schemes** editor (Sheet) + tier overlap validation + live preview

4) **Effective dating timeline**
   - `EffectiveDatingTimelinePage` with month axis, version bars, and overlap warning banner.

**Exit criteria Phase 2:** ✅ Met

---

### Phase 3 — Phase 7A Service Integration (First policy consumers)
**Goal:** Start using configuration rules in operational logic.

**Status:** ✅ Completed

**Delivered**
1) **Service Charge calculation defaults**
   - Updated `services/hr_service.py::calculate_service_charge`:
     - resolves `service_charge_policy` via outlet→brand→group when payload omits `lb_pct/ld_pct`
     - preserves payload overrides
     - stores `policy_id`, `policy_version`, and `policy_scope` on the service charge record

2) **Follow-on wiring points (planned for later)**
   - Daily sales should load `sales_input_schema` by outlet policy linkage or scope fallback
   - Petty cash should enforce `petty_cash_policy`
   - Incentive computation should read `incentive_policy`

**Exit criteria Phase 3:** ✅ Met

---

### Phase 4 — Testing + Regression (Phase 7A)
**Goal:** Ensure Phase 7A doesn’t break Phase 6 and earlier modules.

**Status:** ✅ Completed

**Testing notes**
- Testing agent run completed:
  - Backend success: **84.6%** (no critical bugs; remaining items were test-harness/env limitations)
  - Frontend success: **90%** (all 5 pages load, editor flows validated)
- Phase 6 regressions: ✅ Passed
  - finance periods + lock enforcement
  - approvals queue
  - approval workflow CRUD

**Known non-blockers (tracked for Phase 7E / test harness)**
- Non-admin test credentials (`outlet@torado.id`) not available/working for RBAC negative tests in automation.
- API returns 422 for validation errors (FastAPI standard) vs test expectation 400.

**Exit criteria Phase 4:** ✅ Met

---

## 3) Next Actions (immediate)

### Phase 7B — Advanced Reports (start now)
**Goal:** Advanced reporting capabilities (Phase 7 lite) with saved configs.

**Proposed 7B scope (MVP-lite first):**
1) **Report Builder (lite)**
   - Pick:
     - dimensions (brand/outlet/category/vendor)
     - metrics (sales, COGS, gross profit, AP exposure)
     - filters (period, status, scope)
   - Save report definitions to DB; load/edit/delete
   - Export CSV (Excel export can be 7E+)

2) **Pivot / Multi-dimensional view**
   - Outlet × Brand × Category matrix (interactive drill-down)

3) **Comparatives**
   - MoM / YoY toggle for key KPIs (where data exists)

4) **One high-value advanced report** (choose 1 first)
   - Inventory aging OR vendor performance scorecard (recommend: vendor scorecard if procurement stakeholders prioritize)

**Deliver incrementally:** builder + one advanced report → demo → next.

### Phase 7E — Performance & Polish (after 7B)
- Index profiling, mobile/dark-mode/A11y pass, skeleton/empty/error state audit, lint cleanup.

### Phase 7C/7D — Forecasting + Real-time Anomaly Detection (after 7E)
- Forecasting (inventory reorder + cashflow)
- Real-time anomaly checks on submissions

### Defer Phase 7F
- Offline mode, voice notes, thermal print, WhatsApp notifications.

---

## 4) Success Criteria

### Phase 7A Success Criteria (final)
- ✅ Admin can manage **4 new rule types** via UI
- ✅ Rules support **scope (group/brand/outlet)** and **effective_from/to**
- ✅ Version history visible; overlap conditions flagged
- ✅ Policy consumption implemented: **HR service charge** defaults from `service_charge_policy` and persists policy metadata
- ✅ UX consistency: Aurora glass style + pill nav + Indonesian copy
- ✅ QA readiness: key interactions have `data-testid`

### Phase 7B Success Criteria (next)
- [ ] Report builder MVP-lite shipped (dims+metrics+filters+save)
- [ ] At least one advanced report delivered (pivot/comparatives/vendor scorecard/inventory aging)
- [ ] Export available (CSV at minimum)
- [ ] Drill-down navigation works where applicable

### Overall Phase 7 (rolling) Success Criteria
- 7E: p95 API ≤ 500ms for key report endpoints; Lighthouse ≥ 90 on dashboard pages; A11y issues minimized
- 7C/7D: forecasts + anomalies add value without blocking core workflows
