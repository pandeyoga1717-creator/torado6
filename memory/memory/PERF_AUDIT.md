# Aurora F&B ERP — Performance Audit & Optimization Plan
**Date:** 2026-04-27 (Post-Phase 5)
**Scope:** Full-stack audit — Backend (FastAPI + MongoDB), Frontend (React + esbuild)
**Auditor:** Neo (AI Engineer)

---

## 0) Executive Summary

| Area | Status | Severity | Quick Win? |
|---|---|---|---|
| **DB Indexes (transactional collections)** | ❌ Missing on hot paths | 🔴 HIGH | ✅ Yes |
| **Auth re-fetch per request** (user + roles) | ❌ DB hit per protected endpoint | 🟡 MED | ✅ Yes |
| **GZip compression** | ❌ Not enabled | 🟡 MED | ✅ Yes |
| **Code splitting (React.lazy)** | ❌ Single 1.0 MB bundle (277 KB gz) | 🟡 MED | ✅ Yes |
| **react-query** | ⚠️ Installed but **0 useQuery calls** | 🟡 MED | ⚠️ Refactor |
| **Memoization** (React.memo / useMemo) | ⚠️ Only 34 useMemo, 0 React.memo | 🟢 LOW | ⚠️ Refactor |
| **Pagination on lists** | ✅ 41/53 pages — mostly OK | 🟢 LOW | n/a |
| **Search debouncing** (autocomplete) | ✅ Manual setTimeout works | 🟢 LOW | n/a |
| **In-memory pagination** (inventory.stock_balance) | ❌ Aggregates ALL then slices | 🟡 MED | ✅ Yes |
| **`to_list(10000)`** loaders | ❌ Finance + Executive | 🟡 MED | ✅ Yes |
| **GL mapping caching** | ✅ Cached (single-process) | 🟢 LOW | n/a |
| **Production build** | ❌ Frontend runs dev server (`yarn start`) | 🔴 HIGH | ✅ Yes (deploy-time) |
| **uvicorn workers** | ❌ Single `--workers 1` | 🟡 MED | ✅ Yes (deploy-time) |

**Bottom line:** App is **functionally complete** but **not production-tuned**. Top 5 wins (≤2 days work) will dramatically improve perceived speed:
1. Add MongoDB indexes for transactional collections
2. Cache user permissions per-request (request-scoped)
3. Enable GZip middleware
4. Code-split portals via `React.lazy`
5. Replace 2-3 hottest imperative `api.get` calls with `useQuery` for instant cached navigation

---

## 1) Backend Findings

### 1.1 🔴 HIGH — Missing MongoDB Indexes on Transactional Collections

**Current state** (`backend/core/db.py:ensure_indexes`): only the following have indexes beyond `id`:
- `users.email`, `roles.code`, master CRUD codes (`brands.code`, `outlets.code`, etc.)
- `audit_log` (entity, user, timestamp)
- `notifications` (user, read_at, created_at)
- `refresh_tokens` (jti + TTL)

**Missing indexes** (hot paths):

| Collection | Query Pattern | Recommended Index | Used By |
|---|---|---|---|
| `daily_sales` | `{outlet_id, status, sales_date}` | `[(outlet_id,1),(status,1),(sales_date,-1)]` | finance validation queue, executive trends, HR service charge |
| `petty_cash_transactions` | `{outlet_id, txn_date, status}` | `[(outlet_id,1),(txn_date,-1)]` | outlet portal lists |
| `urgent_purchases` | `{status, purchase_date}` | `[(status,1),(purchase_date,-1)]` | finance approvals |
| `purchase_requests` | `{status, outlet_id, created_at}` | `[(status,1),(created_at,-1)]` | procurement dashboard |
| `purchase_orders` | `{status, vendor_id, created_at}` | `[(status,1),(created_at,-1)]` | procurement list |
| `goods_receipts` | `{deleted_at, vendor_id, gr_date}` | `[(deleted_at,1),(gr_date,-1)]` | AP aging, executive AP exposure |
| `inventory_movements` | `{outlet_id, item_id, movement_date}` | `[(outlet_id,1),(item_id,1),(movement_date,-1)]` | stock balance aggregation, movements list |
| `transfers` | `{status, created_at}` | `[(status,1),(created_at,-1)]` | inventory portal |
| `adjustments` | `{outlet_id, adjustment_date}` | `[(outlet_id,1),(adjustment_date,-1)]` | inventory portal |
| `opname_sessions` | `{outlet_id, opname_date, status}` | `[(outlet_id,1),(opname_date,-1)]` | inventory portal |
| `journal_entries` | `{entry_date, source_type, source_id}` | compound + unique partial on `(source_type, source_id)` for idempotency | finance journals, all auto-posting |
| `journal_lines` | `{journal_id, coa_id}` | `[(journal_id,1)]` and `[(coa_id,1),(entry_date,-1)]` | TB / PL aggregations |
| `employee_advances` | `{employee_id, status, advance_date}` | `[(employee_id,1),(status,1)]` | HR list, payroll consolidation |
| `service_charge_periods` | `{period, outlet_id, status}` | unique partial `[(period,1),(outlet_id,1)]` | HR + payroll lookup |
| `incentive_runs` | `{scheme_id, period, status}` | `[(period,1),(status,1)]` | payroll consolidation |
| `vouchers` | `{code, status}` | unique partial on `code`, secondary on `(status,1)` | redemption lookup |
| `foc_entries` | `{outlet_id, foc_type, foc_date}` | `[(outlet_id,1),(foc_date,-1)]` | HR FOC list |
| `lb_fund_ledger` | `{entry_date, source_type}` | `[(entry_date,-1)]` | running balance |
| `payroll_cycles` | `{period, outlet_id, status}` | unique partial `[(period,1),(outlet_id,1)]` for in-progress lock | HR payroll |

**Impact estimate:** With 10K rows per collection, query latency drops from ~500–1500 ms (COLLSCAN) to <50 ms (IXSCAN). Aggregations (`stock_balance`, `executive.kpis`, `hr.dashboard`) may improve 5–20×.

---

### 1.2 🟡 MED — Auth Re-fetches User + Roles on Every Request

**Current state** (`core/security.py`):
- `current_user`: `db.users.find_one()` per request (line 79).
- `require_perm` / `require_any_perm`: calls `get_user_permissions(user)` → `db.roles.find()` per request (line 94).

So every protected endpoint = **2 DB roundtrips before the handler even starts**.

**Recommendation:**
- Embed `permissions` directly in the JWT payload at login time (eagerly resolved). Refresh on role change.
- OR cache `(user_id → user_dict, perms_set)` with TTL=5 minutes via in-memory LRU (e.g., `cachetools.TTLCache`).

**Impact:** Saves ~10–30 ms per API call. With dashboard pages making 5–10 parallel requests, this is 100–300 ms perceived improvement.

---

### 1.3 🟡 MED — `to_list(10000)` and `find({})` Loaders

| Location | Issue | Suggested Fix |
|---|---|---|
| `services/finance_service.py:419, 518` | `db.goods_receipts.find({"deleted_at": None}).to_list(10000)` for AP aging | Use `aggregate` pipeline that groups+sums **on DB side**; never load all docs to Python |
| `services/finance_service.py:421, 495` & `executive_service.py:104` | `async for v in db.vendors.find({})` to build name dict | Cache vendor/outlet name maps per-request (or 5-min TTL) |
| `services/executive_service.py:88` | `db.goods_receipts.find({}).to_list(10000)` | Same fix as above |
| `services/hr_service.py:1150` | `db.employee_advances.find({...}).to_list(1000)` (during payroll post) | Add index + reduce limit to actual need (per-employee already filtered) |
| `services/inventory_service.py:43` | `stock_balance` aggregates ALL movements then `rows[skip:skip+per_page]` | Push `$skip` + `$limit` into pipeline, use `$facet` for total count in single round-trip |

**Impact:** AP aging + Executive KPI may go from 1–3 s to <300 ms with 5K+ GR rows.

---

### 1.4 🟡 MED — No GZip Compression

`server.py` only registers `CORSMiddleware`. Large JSON responses (TB report, journal list, HR payroll detail) are sent uncompressed.

**Fix:**
```python
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1024)
```

**Impact:** ~60–70% bandwidth reduction on JSON > 1 KB. Faster mobile/slow-network UX.

---

### 1.5 🟢 LOW — Other Findings

- **GL mapping cache** is module-level global. Works for single-worker but won't propagate invalidation across workers when scaled. Switch to TTLCache or Redis later.
- **Idempotency guard** for journal posting uses `find_one({source_type, source_id})` — needs unique partial index `journal_entries(source_type, source_id)` to avoid race conditions.
- **Pagination meta**: `count_documents` runs separately from list query (2 roundtrips). For large collections consider `$facet` aggregation.
- **`uvicorn --workers 1 --reload`**: dev mode only. Production needs `--workers ${CPU_COUNT}` or run via gunicorn + uvicorn.workers.

---

## 2) Frontend Findings

### 2.1 🟡 MED — No Code Splitting (Single 1.0 MB Bundle)

**Current state** (`src/App.js`):
- All 7 portals (Executive, Outlet, Procurement, Inventory, Finance, HR, Admin) imported eagerly.
- Bundle: **1.0 MB minified** (277 KB gzipped).
- Even a Finance Manager who never visits HR downloads HR code.

**Fix:**
```jsx
import { lazy, Suspense } from "react";
const HRPortal = lazy(() => import("@/portals/HRPortal"));
// ...
<Suspense fallback={<PageSkeleton />}>
  <Route path="hr/*" element={<PortalGuard portalId="hr"><HRPortal/></PortalGuard>} />
</Suspense>
```

**Impact:** Initial bundle drops to ~300–400 KB (90–120 KB gz). Each portal lazy-loads on first visit (~30–80 KB per chunk).

---

### 2.2 🟡 MED — react-query Installed but UNUSED

**Current state**:
- `@tanstack/react-query` is installed (`queryClient.js` configured with `staleTime: 30s`).
- BUT **0 `useQuery` calls** anywhere in `/src`.
- All 159 data fetches use imperative `api.get` inside `useEffect`, refetching on every navigation.

**Symptoms** (user-visible):
- Returning to a page = full reload, no cached display.
- Notification drawer / KPI counters re-fetch on every open.
- Same `/api/master/outlets` call repeated 3–5× per page load (each list page fetches outlet dropdown data).

**Fix (incremental, not a big-bang refactor):**
1. Create `src/hooks/useApiQuery.js` thin wrapper:
   ```js
   import { useQuery } from "@tanstack/react-query";
   import api, { unwrap } from "@/lib/api";
   export function useApiQuery(key, url, params, options) {
     return useQuery({
       queryKey: [url, params],
       queryFn: async () => unwrap(await api.get(url, { params })),
       ...options,
     });
   }
   ```
2. Migrate **3 highest-traffic endpoints first**:
   - `/api/master/outlets` (used in 18+ pages — highest dedup win)
   - `/api/master/employees` (used in 12+ pages)
   - `/api/master/payment-methods` (used in 8+ pages)
3. Migrate dashboards (`HRHome`, `FinanceHome`, `ExecutiveHome`) for "instant return" UX.
4. Use `staleTime: 5 * 60 * 1000` for master data (rarely changes).

**Impact:** Returning to a page after navigation = instant render from cache while background refresh. ~20–40% reduction in API calls overall.

---

### 2.3 🟢 LOW — Missing React.memo on Heavy Tables

**Current state**: 0 `React.memo` wrappers. Heavy lists (HR Advances rows, Journal lines, Stock Balance, Daily Sales) re-render the entire table on parent state change (e.g., typing in a filter).

**Fix:** Wrap row sub-components:
```jsx
const AdvanceRow = React.memo(function AdvanceRow({ it, ...handlers }) { ... });
```

**Impact:** Frame-rate during typing/filter improves on lists with >50 rows.

---

### 2.4 🟢 LOW — Production Build Not in Use

`supervisord.conf`:
```
[program:frontend]
command=yarn start
```

This runs **`react-scripts start`** (development server with HMR + sourcemaps). Production should serve built static via nginx or `serve`. CRA's dev server is ~3× slower than production build.

**Note:** This is a *deployment* concern, not a code change. Will be handled at deployment time.

---

### 2.5 🟢 LOW — Other Observations

- **Tree-shaking is OK**: lucide-react uses named imports.
- **Pagination**: 41/53 pages have pagination wired. The 12 without are dashboards/detail views (legitimate).
- **Autocomplete debounce**: ItemAutocomplete + VendorAutocomplete use 300 ms `setTimeout` debounce ✅
- **No image optimization needed yet**: only icons (vector) + receipt thumbnails (data URLs, small).
- **Bundle size by category** (estimated):
  - React + Router + react-query: ~150 KB gz
  - shadcn/radix UI: ~80 KB gz
  - lucide-react (tree-shaken): ~20 KB gz
  - dayjs + framer-motion + recharts: ~50 KB gz
  - Application code: ~50 KB gz
  - **Total ~277 KB gz** — large for a single SPA chunk; code splitting recommended.

---

## 3) Quick Wins Summary (Recommended Order)

### 🚀 Sprint 1 — "1-Day Wins" (target: ship in 1 dev day)

| # | Item | Effort | Files Touched | Expected Impact |
|---|---|---|---|---|
| 1 | Add MongoDB indexes for HR + transactional collections | 2 h | `core/db.py:ensure_indexes` + 1 patch script | List queries 5–20× faster |
| 2 | Enable GZipMiddleware | 5 min | `server.py` | 60–70% bandwidth saved |
| 3 | Cache user perms per request (request-scoped) | 1 h | `core/security.py` | -10–30 ms per API call |
| 4 | Fix `inventory.stock_balance` to paginate at DB level | 1 h | `services/inventory_service.py` | 5–10× faster on big inventories |
| 5 | Replace `to_list(10000)` GR loaders in finance + executive with aggregation | 2 h | `services/finance_service.py`, `services/executive_service.py` | AP aging 3–5× faster |
| 6 | Add `journal_entries(source_type, source_id)` unique partial index | 30 min | `core/db.py` | Hardens idempotency under concurrency |

**Total:** ~6.5 hours dev, **0 visible UI changes**, **major perceived speed-up**.

---

### ⚡ Sprint 2 — "Frontend Speed" (target: ship in 1–2 dev days)

| # | Item | Effort | Files Touched | Expected Impact |
|---|---|---|---|---|
| 7 | Code-split portals via `React.lazy` | 2 h | `src/App.js` + add `<Suspense>` | Initial load ~3× lighter |
| 8 | Add `useApiQuery` wrapper + migrate top 3 endpoints (outlets/employees/payment-methods) | 4 h | new hook + 18+ list pages (1-line change each) | Cached navigation, fewer API calls |
| 9 | Migrate dashboards (`HRHome`, `FinanceHome`, `ExecutiveHome`) to react-query | 2 h | 3 files | Instant return-to-dashboard UX |
| 10 | Add `React.memo` to heavy table rows (advances, journals, opname allocations) | 2 h | ~6 files | Smoother typing in filters |

**Total:** ~10 hours dev, **noticeable UX improvement** (instant nav, smaller initial download).

---

### 🏗️ Sprint 3 — "Strategic / Production-Readiness"

| # | Item | Effort | Notes |
|---|---|---|---|
| 11 | Embed permissions in JWT (eager resolution at login) | 4 h | Reduces auth roundtrip to **1** per request |
| 12 | Add Redis cache layer for `gl_mapping`, `vendors_map`, `outlets_map` | 1 day | Required if scaling beyond single worker |
| 13 | Migrate ALL portal pages to `useApiQuery` + create `useApiMutation` for invalidation | 1.5 days | Full caching consistency |
| 14 | Add response-payload size budget alerts (e.g., journal listing >500 KB) | 1 day | Catch regressions early |
| 15 | Production deploy config: gunicorn + multi-worker + nginx serving built React | 0.5 day | Deploy-time, blocked on infra |
| 16 | Add OpenTelemetry traces + slow-query logging (>200 ms) | 1 day | Long-term observability |

---

## 4) Proposed Phase 6 (NEW) — Performance Hardening

> **Recommendation:** Insert a **Phase 6 — Performance Hardening** before continuing with originally planned Phase 6 (Period Locking + Approval Matrix). This phase is short (~3 dev days) and pays off across all subsequent phases.

### Phase 6 — Performance Hardening (PROPOSED, ~3 days)
**Goal:** zero functional regression, measurable speed gains, lower API cost.

**6A — DB & Backend Hot-Path Optimizations (Day 1)**
- 6A.1 Index ensure script for transactional + HR collections (`core/db.py`)
- 6A.2 Idempotency-strict unique index on `journal_entries(source_type, source_id)`
- 6A.3 GZipMiddleware
- 6A.4 Request-scoped permission cache (rewrite `current_user` + `require_perm` deps)
- 6A.5 `inventory.stock_balance` push pagination into pipeline
- 6A.6 Replace `to_list(10000)` with aggregations in finance/executive services

**6B — Frontend Boot & Cache Wins (Day 2)**
- 6B.1 Code-split portals via `React.lazy` + Suspense skeleton
- 6B.2 New `useApiQuery` hook + `useApiMutation` helper
- 6B.3 Migrate master data fetches (outlets/employees/payment-methods) → react-query
- 6B.4 Migrate 3 dashboards (HR, Finance, Executive) → react-query
- 6B.5 Add `React.memo` to top 6 heavy-row table components

**6C — Verification (Day 3)**
- 6C.1 Lighthouse performance score (target: >85 on Performance)
- 6C.2 API latency benchmarks (curl + ApacheBench): list endpoints <300 ms p95
- 6C.3 Bundle analysis (esbuild --metafile + bundle-buddy): main chunk <120 KB gz, no portal >80 KB gz
- 6C.4 testing_agent_v3 full regression — must pass with no functional change

**Renumber existing roadmap accordingly:**
- Phase 7 (was Phase 6) — Period Locking + Approval Matrix
- Phase 8 (was Phase 7) — Advanced AI features
- Phase 9 (was Phase 8) — Final polish, audit, UAT

---

## 5) What's Already Good (Keep Doing)

✅ **Pagination is wired correctly** on most lists.
✅ **`gl_mapping` is cached** (single-process).
✅ **Aggregations used** for KPI counters (executive_service).
✅ **Soft-delete uses partial indexes** (smart approach).
✅ **Autocomplete debouncing** implemented manually.
✅ **API envelope is consistent** — `{success, data, errors, meta}` everywhere.
✅ **Lucide icons tree-shaken** via named imports.
✅ **No N+1 in HR list endpoints** — `find({"id": {"$in": ids}})` batch lookups used.
✅ **Service charge / incentive properly transparent** — `journal_skipped` flag added in Phase 5.
✅ **Idempotency guard exists** for journal posting (`find_one` source_type+source_id) — just needs DB-level enforcement (Sprint 1 #6).

---

## 6) Decision Required

Pilih lanjutkan ke yang mana setelah ini:

- **(A)** Eksekusi **Phase 6 Performance Hardening** dulu (3 hari kerja, zero functional regression, big speed win sebelum tambah fitur baru).
- **(B)** Skip optimasi, lanjut ke **Phase 6 original** (Period Locking + Approval Matrix); kembali optimasi nanti.
- **(C)** Pilih hanya **Sprint 1 (Quick Wins, 1 hari)** dari Phase 6, lalu lanjut ke Period Locking.
- **(D)** Custom — sebutkan urutan/scope yang diinginkan.

> **Rekomendasi Neo:** **Opsi C** — eksekusi Sprint 1 saja (1 hari). Manfaatnya besar (5–20× speed-up pada query inti) tanpa menunda phase fitur, dan tidak menyentuh UI/business logic. Sprint 2 dan 3 dapat ditangani saat polishing pass (Phase 9).
