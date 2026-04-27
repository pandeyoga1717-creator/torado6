# Plan — Phase 7: Configurability, Reports, Performance & Polish (Aurora F&B ERP)

## 1) Objectives

- ⏭️ **Start Phase 7** using the agreed sequence: **7A → 7B → 7E → 7C/7D**, defer **7F**.
- ✅ Acknowledge **Phase 6 + 6D are fully complete**:
  - period locking + closing wizard
  - multi-tier approval engine + workflow UI
  - notification hooks for approvals
  - `/my-approvals` inbox + TopNav badge
- 🎯 **Phase 7A (current focus): Self-Service Configuration UI**
  - Deliver **non-technical configuration editors** (no raw JSON) backed by `business_rules` with **effective dating/versioning**.
  - Expand rules beyond approvals:
    - `sales_input_schema`
    - `petty_cash_policy`
    - `service_charge_policy`
    - `incentive_policy`
  - Provide Admin UI at `/admin/configuration/*` with consistent Aurora glass design and full test-id coverage.
  - Wire policies into business logic where relevant (first integration: service charge calculation defaulting to policy values).

**Status:** Phase 7 kicked off; **7A = In Progress**.

---

## 2) Implementation Steps

### Phase 1 — Phase 7A Backend Foundation (BusinessRules Generalization)
**Goal:** Extend backend CRUD to support all Phase 7A rule types with scope + effective-dating + history.

**Status:** ⏳ Planned

1) **Generalize Admin Business Rules endpoints** (currently approval_workflow-only)
   - Update `routers/admin.py` to support rule_type ∈ {
     `approval_workflow`, `sales_input_schema`, `petty_cash_policy`, `service_charge_policy`, `incentive_policy`
     }.
   - Keep permission gating consistent with Phase 6:
     - `admin.workflow.manage` for `approval_workflow`
     - introduce/confirm `admin.business_rules.manage` for non-approval rules (per `core/perms_catalog.py`).

2) **CRUD + query features required by UI**
   - `GET /api/admin/business-rules` additions:
     - filter by `rule_type`, `scope_type`, `scope_id`, `active`, and “effective_on” (date cursor)
     - sorting: newest version first
   - `POST /api/admin/business-rules`:
     - validate required base fields: `scope_type`, `scope_id`, `rule_type`, `rule_data`
     - server sets `version` if not provided (auto-increment per scope+rule_type)
   - `PATCH /api/admin/business-rules/{id}`:
     - allow editing `rule_data`, `active`, `effective_from`, `effective_to`
     - strongly prefer “create new version” semantics for impactful rule_data edits (see next)

3) **Versioning & effective dating rules**
   - Add service helpers (new `services/business_rules_service.py` or extend existing patterns) to:
     - compute next version
     - detect effective date overlaps for same `scope_type+scope_id+rule_type`
     - support “duplicate as new version”
   - Ensure soft-delete behavior consistent (`deleted_at`).

4) **Timeline support endpoint (optional but recommended for 7A UI)**
   - `GET /api/admin/business-rules/timeline?scope_type=...&scope_id=...&rule_type=...`
     - returns all versions in date order + overlap flags

5) **Seed default non-approval policies (demo-friendly)**
   - Add seed routine in backend startup or `POST /api/admin/business-rules/seed-defaults` extension:
     - create baseline `sales_input_schema` / `petty_cash_policy` / `service_charge_policy` / `incentive_policy` for group or a demo brand/outlet

**Exit criteria Phase 1:**
- Admin endpoints can create/list/update/delete all 4 new rule types
- Effective dating overlap checks enforced (at least warning-level response)
- Seed creates at least 1 policy per type

---

### Phase 2 — Phase 7A Frontend: `/admin/configuration/*` (Self-Service Editors)
**Goal:** Deliver admin configuration pages and editors per `/app/design_guidelines.md`.

**Status:** ⏳ Planned

1) **Admin IA / routing**
   - Add new Admin portal entry point and routes:
     - `/admin/configuration/sales-schemas`
     - `/admin/configuration/petty-cash-policies`
     - `/admin/configuration/service-charge-policies`
     - `/admin/configuration/incentive-schemes`
     - `/admin/configuration/effective-dating`
   - Follow existing Admin subnav pill pattern (Framer Motion `layoutId="admin-subnav-pill"`).

2) **Shared components (used by all configuration tabs)**
   - `ScopePicker` (Group/Brand/Outlet + scope_id select)
     - persists in URL query (e.g., `?scope_type=brand&scope_id=...`)
   - `RuleListLayout` (header + filters + table + right history panel)
   - `RuleHistoryPanel` (desktop sticky panel; mobile Sheet)

3) **Rule editors (UI patterns per design guidelines)**
   - **Sales schemas** (Sheet editor):
     - channels reorder list (drag handle)
     - payment methods toggles
     - revenue buckets table
     - validation rules accordion
   - **Petty cash policy** (Dialog editor):
     - limit/threshold sliders + GL accounts Command multi-select
   - **Service charge policy** (Dialog editor):
     - % fields + allocation method radio group
     - live preview panel with sample calculation
   - **Incentive schemes** (Sheet editor):
     - rule_type tabs (pct/flat/tiered)
     - tier table with overlap validation
     - eligibility controls

4) **Effective dating timeline page**
   - Lightweight CSS-grid timeline
   - rule_type filter chips
   - overlap warnings with tooltips

5) **UX requirements**
   - Indonesian copy throughout
   - Empty/loading/error states use shared components (EmptyState/LoadingState)
   - Full `data-testid` coverage per `/app/design_guidelines.md`

**Exit criteria Phase 2:**
- All 5 tabs render and operate end-to-end against backend
- Create/edit/duplicate/archive works for each rule type
- Timeline page shows versions and warns on overlaps
- Visual review: matches existing Aurora admin style

---

### Phase 3 — Phase 7A Service Integration (First policy consumers)
**Goal:** Start using configuration rules in operational logic.

**Status:** ⏳ Planned

1) **Wire Service Charge calculation defaults**
   - Update `services/hr_service.py::calculate_service_charge`:
     - when `lb_pct`/`ld_pct` not provided in payload, load from applicable `service_charge_policy` based on outlet scope (prefer outlet → brand → group fallback)
     - keep payload override behavior (manual override still possible)

2) **Prepare follow-on wiring points (non-blocking for 7A completion)**
   - Daily sales input should eventually load schema from `sales_input_schema` via outlet’s `sales_schema_id` or scope fallback
   - Petty cash posting should eventually enforce policy thresholds
   - Incentive computation should eventually read incentive policy

**Exit criteria Phase 3:**
- Service charge calculation produces same results when explicit values provided
- When values omitted, policy is applied and logged/audited

---

### Phase 4 — Testing + Regression (Phase 7A)
**Goal:** Ensure Phase 7A doesn’t break Phase 6 and earlier modules.

**Status:** ⏳ Planned

1) **Backend tests**
   - CRUD tests for each rule_type
   - overlap validation tests
   - service charge default-from-policy test

2) **Frontend checks**
   - Smoke flows:
     - open configuration pages
     - create draft → schedule effective dates
     - edit → new version/duplicate
     - archive/unarchive

3) **Regression focus**
   - Verify Phase 6 features unchanged:
     - period lock enforcement still returns `409 PERIOD_LOCKED`
     - approvals engine still enforces `403 APPROVAL_PERM_MISSING`
     - `/my-approvals` badge and queue still work

**Exit criteria Phase 4:**
- No console errors
- Key admin + finance flows still function
- Basic rule CRUD + timeline validated

---

## 3) Next Actions (immediate)

After Phase 7A ships:
1) **Phase 7B — Advanced Reports**
   - MVP-lite report builder (dims + metrics + filters + save)
   - pivot view and comparative reports (MoM/YoY)
2) **Phase 7E — Performance & Polish**
   - index/query profiling, skeleton/empty-state audit, mobile/dark-mode pass, a11y scan
3) **Phase 7C/7D — Forecasting + Real-time Anomaly Detection**
   - implement after core UX/config foundations are stable
4) **Defer Phase 7F**
   - offline mode, voice notes, thermal print, WhatsApp notifications

---

## 4) Success Criteria

### Phase 7A Success Criteria
- ✅ Admin can manage **4 new rule types** via UI (no raw JSON required)
- ✅ Rules support **scope (group/brand/outlet)** and **effective_from/to**
- ✅ Version history is visible and overlap conditions are flagged
- ✅ At least one real service consumes rules: **service charge calculation** defaults from `service_charge_policy`
- ✅ UX consistency: Aurora glass style + admin pill subnav + Indonesian copy
- ✅ QA readiness: `data-testid` coverage per design guidelines

### Overall Phase 7 (rolling) Success Criteria
- 7B: reports drillable/exportable; saved views work
- 7E: performance budgets improved + a11y issues minimized
- 7C/7D: forecasts/anomaly checks add value without blocking core workflows
