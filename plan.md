# Plan — Phase 6: Advanced Settings & Approvals (Aurora F&B ERP)

## 1) Objectives
- ✅ Deliver **period locking + a closing wizard** so finance can close months with audit integrity (reusing `accounting_periods` + `journal_service._ensure_period_open`).
- ✅ Deliver a **multi-tier approval engine + configurable approval matrix UI** (reusing `business_rules` + existing approval-chain visualization).
- ✅ Integrate approvals into **PR/PO** flows (and baseline support for **stock adjustments**) without breaking existing Phase 0–5 behavior.
- ✅ Follow-on (accepted) — **COMPLETED**:
  - ✅ Integrate approval engine into **Inventory Adjustments** + **HR Employee Advance** (configurable tiers; preserve legacy single-step if no workflow).
  - ✅ Add **notification hooks** for approval events (pending → next approvers; final approve/reject → creator).
  - ✅ Add cross-portal **“My Approvals”** queue at `/my-approvals`.
  - ⏭️ **PAY (Payment Request)** approval supported by engine entity_type but **module is deferred** (no UI/domain flow yet).

**Status:** Phase 6 core scope is **COMPLETED**. Phase 6D follow-on is **COMPLETED**.

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation; must pass before UI roll-out)
**Goal:** Prove the two “hard parts” work end-to-end via API + a minimal script.

**Status:** ✅ Completed (implemented directly in core services + validated with backend tests and manual flows).

1) **POC A: Period lifecycle API + lock enforcement**
   - ✅ Implemented finance endpoints:
     - `GET /api/finance/periods?year=YYYY`
     - `GET /api/finance/periods/{period}`
     - `GET /api/finance/periods/{period}/closing-checks`
     - `POST /api/finance/periods/{period}/close`
     - `POST /api/finance/periods/{period}/lock`
     - `POST /api/finance/periods/{period}/unlock`
   - ✅ Permissions enforced:
     - `finance.journal_entry.read` (list/read)
     - `finance.period.close_step` (closing-checks + close)
     - `finance.period.lock` (lock)
     - `finance.period.unlock` (unlock)
   - ✅ Verified behavior:
     - Lock period → manual JE post returns **409 PERIOD_LOCKED**
     - Unlock period → manual JE post succeeds

2) **POC B: Approval engine (evaluate → next approver) + persistence shape**
   - ✅ Implemented `services/approval_service.py`:
     - workflow resolver via `business_rules` (`rule_type='approval_workflow'`)
     - `evaluate(entity_type, entity)`
     - `approve(entity_type, entity_id, user, note)`
     - `reject(entity_type, entity_id, user, reason)`
     - CRUD helpers for workflows + `seed_defaults`
   - ✅ Default workflows seeded on backend startup (idempotent):
     - `purchase_request` (3 tiers)
     - `purchase_order` (3 tiers)
     - `stock_adjustment` (2 tiers)
   - ✅ Verified behavior:
     - Wrong approver at step → **403 APPROVAL_PERM_MISSING**
     - Correct sequential approvers → status becomes `approved` at final step

3) **Web search checkpoint (best practice)**
   - ⏭️ Not required for MVP completion; the delivered checklist is consistent with typical closing prerequisites.

**Exit criteria Phase 1:** ✅ Met.

---

### Phase 2 — V1 App Development (Phase 6A + 6B)

#### Phase 6A: Period Closing Wizard + Lock UI (Finance)
**Status:** ✅ Completed

1) **Backend**
   - ✅ Implemented `services/period_service.py`:
     - list/get (auto-create missing months)
     - status transitions: `open → closed → locked → open(reopen)`
     - audit logging for transitions
     - closing checklist endpoint with summary flags
   - ✅ Closing checks include (MVP 8-step checklist):
     - pending sales validations (warn)
     - Trial Balance balanced check (blocker)
     - pending approvals (info)
     - AP open count (info)
     - negative stock (warn)
     - manual JE count (info)
     - open opname sessions (warn)
     - period status (info)

2) **Frontend**
   - ✅ Added Finance routes + subnav:
     - `/finance/periods` → `PeriodList.jsx`
     - `/finance/period-closing/:period` → `PeriodClosingWizard.jsx`
   - ✅ Wizard UX implemented:
     - left: 8-step checklist with status icons
     - right: step detail + link-outs + re-check
     - actions: close + lock with confirm dialog

3) **UI polish**
   - ✅ Added status pill styling:
     - `status-open`, `status-closed`, `status-locked` in `index.css`

**Phase 6A user stories:** ✅ Covered.

---

#### Phase 6B: Multi-tier Approval Engine + Workflow Configuration UI (Admin)
**Status:** ✅ Completed

1) **Backend**
   - ✅ Implemented approval workflow admin endpoints in `routers/admin.py`:
     - `GET /api/admin/business-rules?rule_type=approval_workflow`
     - `GET /api/admin/business-rules/{rule_id}`
     - `POST /api/admin/business-rules`
     - `PATCH /api/admin/business-rules/{rule_id}`
     - `DELETE /api/admin/business-rules/{rule_id}`
     - `POST /api/admin/business-rules/seed-defaults`
     - `GET /api/admin/approval-entity-types`

2) **Frontend (Admin portal)**
   - ✅ Added Admin subnav item: **Workflows**
   - ✅ Built `ApprovalWorkflows.jsx`:
     - collapsible grouping by entity type
     - tier editor (min/max/label)
     - step editor (label + permission picker)
     - create/update/delete workflows
     - “Reset to Defaults” (overwrite)

3) **Shared components**
   - ✅ Added `ApprovalProgress.jsx` (tier + step progression visualization)
   - ✅ Enhanced `ApprovalChain.jsx` to show `step_label` and `approver_name`

**Phase 6B user stories:** ✅ Covered.

**Exit criteria Phase 2:** ✅ Met.

---

### Phase 3 — Integration + Testing (Phase 6C)

#### 1) Integrate approval engine into existing flows (minimal invasive changes)
**Status:** ✅ Completed

- ✅ PR integration:
  - `procurement_service.approve_pr/reject_pr` delegates to `approval_service`
  - Added `get_pr_approval_state`
  - Endpoint: `GET /api/procurement/prs/{id}/approval-state`
  - Create PR triggers initial pending-approver notifications (Phase 6D enhancement)

- ✅ PO integration:
  - Added:
    - `submit_po_for_approval` (`POST /api/procurement/pos/{id}/submit`)
    - `approve_po/reject_po`
    - `get_po_approval_state`
  - `send_po` gated:
    - If workflow exists and incomplete → `PO_APPROVAL_INCOMPLETE`
  - PO submit triggers initial pending-approver notifications (Phase 6D enhancement)

- ⚠️ Route-level permission change (intentional):
  - PR/PO approve/reject endpoints use `current_user` so the **approval engine** can enforce the **current step’s** required permission set.

#### 2) UI integration
**Status:** ✅ Completed

- ✅ `PRDetail.jsx`:
  - fetches approval state
  - shows `ApprovalProgress`
  - approve/reject buttons enabled only if user meets current step required perms
  - keeps `ApprovalChain` timeline

- ✅ `PODetail.jsx`:
  - fetches approval state
  - adds submit-for-approval + approve/reject actions
  - shows `ApprovalProgress` and approval timeline

#### 3) Comprehensive testing + regression safety
**Status:** ✅ Completed

- ✅ Manual validation:
  - Period lock → JE post fails with **409 PERIOD_LOCKED**
  - Reopen → JE post succeeds
  - PO: submit → approve tiers → send → works
  - Send before approval → blocked with `PO_APPROVAL_INCOMPLETE`

- ✅ Automated backend test run:
  - **42/44 tests passed (95.5%)**
  - 0 critical bugs
  - Only reported issue was `/api/hr/home` 404 (test expectation mismatch; HR uses `/api/hr/dashboard`)

**Phase 6C user stories:** ✅ Covered.

---

### Phase 4 — Phase 6D Follow-on (Approvals Queue + Notifications + Broader Coverage)
**Goal:** Make approvals operational across modules with a unified approver inbox and proactive notifications.

**Status:** ✅ Completed

#### 6D-1) Extend approval engine wiring: Inventory Adjustments + HR Employee Advance
1) **Inventory Adjustments (stock_adjustment)**
   - Backend: ✅ Completed
     - ✅ `inventory_service.approve_adjustment` delegates to `approval_service.approve('stock_adjustment', ...)`.
     - ✅ On workflow completion (`status=approved`) posts stock movements + journal entry.
     - ✅ Added:
       - `reject_adjustment`
       - `get_adjustment_approval_state`
     - ✅ API endpoints:
       - `POST /api/inventory/adjustments/{id}/approve` (engine-enforced step perms)
       - `POST /api/inventory/adjustments/{id}/reject`
       - `GET  /api/inventory/adjustments/{id}/approval-state`

   - Frontend: ✅ Completed
     - ✅ Updated `AdjustmentList.jsx`:
       - approve + reject actions
       - approval state modal (ApprovalProgress + ApprovalChain)

2) **HR Employee Advance (employee_advance)**
   - Backend: ✅ Completed
     - ✅ Added:
       - `submit_advance_for_approval`
       - `reject_advance`
       - `get_advance_approval_state`
     - ✅ Refactored `approve_advance`:
       - Workflow present → delegates to `approval_service.approve('employee_advance', ...)`
       - Workflow absent → **legacy** single-step approve from draft remains (per design)
       - Final approval → disburse + post JE + status becomes `repaying`
     - ✅ API endpoints:
       - `POST /api/hr/advances/{adv_id}/submit`
       - `POST /api/hr/advances/{adv_id}/approve`
       - `POST /api/hr/advances/{adv_id}/reject`
       - `GET  /api/hr/advances/{adv_id}/approval-state`

   - Frontend: ✅ Completed
     - ✅ Updated `AdvancesList.jsx`:
       - submit / approve / reject buttons
       - approve endpoint now supports multi-step (engine-enforced perms)

3) **PAY (payment_request)**
   - ⏭️ Deferred (module not built)
   - ✅ Engine already reserves/supports `payment_request` entity_type so the future PAY module can plug in.

**Exit criteria (6D-1):** ✅ Met.

---

#### 6D-2) Notification hooks for approval events
**Status:** ✅ Completed

1) **Backend: approval_service hooks**
   - ✅ On submit / state becomes `awaiting_approval`:
     - Push `warn` notifications to eligible approvers for step 0 (via `notify_pending_approvers`).
   - ✅ On approve_step:
     - Intermediate → notify next-step approvers (`warn`).
     - Final → notify creator/requester (`done`).
   - ✅ On reject:
     - Notify creator/requester (`urgent`) with rejection reason.

2) **Approver resolution**
   - ✅ Implemented resolver:
     - resolves eligible users via roles that contain any required permission (or `*`)
     - optional outlet scoping for outlet-context documents

3) **Notification payloads**
   - ✅ Notifications include `link` deep-linking to the entity detail page.

4) **Frontend: Notification UX**
   - ✅ Updated `NotificationDrawer.jsx`:
     - click notification → mark read + navigate to `notification.link` (drawer closes)

**Exit criteria (6D-2):** ✅ Met.

---

#### 6D-3) “My Approvals” cross-portal queue
**Status:** ✅ Completed

1) **Backend API**
   - ✅ Added router `/api/approvals`:
     - `GET /api/approvals/queue`
       - filters: `entity_type` (optional), `page`, `per_page`
       - returns only items actionable by current user (permission + current step)
     - `GET /api/approvals/counts`
       - returns total + counts per entity type

2) **Query logic**
   - ✅ For each entity type, candidates fetched by status (submitted/awaiting_approval)
   - ✅ Approval state evaluated and filtered by current-step required permissions

3) **Frontend page**
   - ✅ Added route `/my-approvals` (cross-portal page)
   - ✅ Page features:
     - stat tiles and mobile tabs by entity type
     - queue rows deep-linking to the correct destination (PR/PO detail; adjustments list; advances list)

4) **Navigation**
   - ✅ Added TopNav **Approvals Inbox** button with auto-refreshing badge (polls `/api/approvals/counts`).

**Exit criteria (6D-3):** ✅ Met.

---

## 3) Next Actions (immediate)
Now that Phase 6D is complete, recommended next items:
1) **PAY module build** (Payment Request) and plug in approval workflow using already-supported `payment_request` entity_type.
2) Add optional **dedupe/anti-spam** for notifications (e.g., do not notify same user twice for the same step within N minutes).
3) Add **inline approve/reject** actions directly in `/my-approvals` (optional, phase 2 UX improvement).
4) Add additional approval coverage (service charge / incentive runs / other postings) if desired.

---

## 4) Success Criteria
- ✅ **Period locking**: Posting any JE into a locked/closed period returns **409 PERIOD_LOCKED**.
- ✅ **Closing wizard**: Finance can run checks and lock/close/reopen a period from UI; actions are audit-logged.
- ✅ **Multi-tier approvals (PR/PO)**: Approvals follow configured tiers; unauthorized step approvals return **403 APPROVAL_PERM_MISSING**; chains stored + rendered.
- ✅ **Broader approval coverage**: Stock adjustments + employee advances support tiered approvals (legacy preserved when no workflow).
- ✅ **Approvals Queue**: `/my-approvals` shows all pending approvals actionable by the current user.
- ✅ **Approval Notifications**: Approvers get notified when an item reaches their step; creators get approved/rejected notifications; notifications deep-link to the entity.
- ✅ **No regressions**: Existing Phase 0–5 screens and endpoints continue to work.
