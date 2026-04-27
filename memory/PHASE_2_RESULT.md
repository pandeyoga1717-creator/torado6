# Phase 2 (Foundation) — Result Report
**Date:** 2026-04-26  
**Status:** ✅ **COMPLETE**

## Summary

Phase 2 Foundation built end-to-end and tested. All backend & frontend infrastructure for Auth, RBAC, Master Data, Admin Portal, and Glassmorphism App Shell is live.

## Deliverables

### Backend (`/app/backend/`)
- **Core**: `config.py`, `db.py` (with partial unique indexes), `security.py` (JWT+bcrypt+RBAC), `audit.py`, `exceptions.py`, `perms_catalog.py` (~100 permissions)
- **Models**: `master.py` (Group, Brand, Outlet, User, Role, Item, Vendor, Employee, COA, TaxCode, PaymentMethod, BankAccount, NumberSeries, BusinessRule, AuditLogEntry, Notification)
- **Repositories**: Generic `Repo` with soft-delete + pagination
- **Services**: `auth_service.py`, `notification_service.py`, `search_service.py`
- **Routers**: `/api/auth`, `/api/admin`, `/api/master`, `/api/notifications`, `/api/search`
- **Utils**: `number_series.py` (atomic doc-no generator)
- **Seed**: `seed_demo.py` — Torado Group + 4 brands & outlets + 15 system roles + 64 COA + 13 items + 6 vendors + 20 employees + 8 demo users + 12 number series

### Frontend (`/app/frontend/src/`)
- **Design system**: `index.css` (glassmorphism tokens, light+dark themes, animation tokens, status pills, ambient blob background)
- **Lib**: `api.js` (axios + auto-refresh), `auth.js` (AuthContext + can()), `format.js` (Rp/date/relative), `theme.js`, `portals.js`, `queryClient.js`
- **Layout**: `AppShell` (top-nav + side-rail + main + Cmd+K + notif drawer + toast), `TopNav` (portal switcher with animated black pill), `SideRail` (icon rail with hover labels)
- **Shared**: `GlobalSearch` (Cmd+K), `NotificationBell`/`Drawer`, `UserMenu`, `ThemeToggle`, `KpiCard`, `EmptyState`, `LoadingState`, `ErrorState`, `PortalGuard`
- **Pages**: `Login` (with demo chips), `NotFound`, `HomeRedirect`, `NoAccess`
- **Admin Portal**: `AdminPortal` (sub-nav), `AdminHome` (KPIs + master tiles), `Users`, `Roles` (with permission catalog), `MasterData` (10 entity tabs CRUD), `AuditLog`, `NumberSeries`
- **Portal placeholders**: Executive, Outlet, Procurement, Inventory, Finance, HR (each shows "Coming Soon Phase X")

## Test Results

### Iteration 1 (initial regression)
- Backend: 96.8% pass
- Frontend: 75% pass
- 4 issues found:
  1. HIGH: Outlet manager could see Admin portal UI but API calls 403 → **fixed with PortalGuard**
  2. MEDIUM: Theme toggle — bg shift not visible → **fixed with explicit transition + html bg**
  3. MEDIUM: Global search — debounce timing → **fixed: 200→150ms + Esc key handler**
  4. MEDIUM: Notification drawer — exit overlay blocking subsequent clicks → **fixed: pointer-events:none on exit**
  Bonus: `/api/auth/logout` now accepts null body (`Body(default=None)`)

### Iteration 2 (after fixes)
- Backend: 81.8% (only because new test scenario uncovered duplicate-key bug)
- Frontend: 92% pass
- All 4 original fixes verified ✅
- 1 new issue found: 500 Internal Server Error on `POST /api/master/items` and `POST /api/admin/roles` when re-creating a code that has a soft-deleted record
  - **Root cause**: Mongo unique index was global; soft-deleted record with same code triggered `DuplicateKeyError` because the explicit `find_one({"deleted_at": None})` check passed but Mongo index didn't allow it.
  - **Fix**: 
    - Made all `code`/`email` unique indexes **partial** (only enforced where `deleted_at: None`)
    - Migration logic in `ensure_indexes()` drops legacy non-partial unique indexes & recreates as partial
    - Added defensive `try/except DuplicateKeyError` in routes returning clean 409 ConflictError
- Verified post-fix: 
  - Create new code: 200 ✅
  - Duplicate active: 409 ✅
  - Soft-delete then re-create same code: 200 ✅ (works because partial index excludes soft-deleted)
  - Roles same flow: 200 ✅

## Architecture Patterns Validated

1. **Soft-delete + partial unique index** — for safe `code` reuse after deletion
2. **JWT access (24h) + refresh (7d)** with revocable refresh tokens stored hashed
3. **bcrypt cost=12** + lockout after 5 fails (15 min)
4. **Audit log in-band** — every mutation tagged
5. **Permission codes** `<module>.<resource>.<action>` + `*` super
6. **Generic CRUD router** for master entities with per-entity uniq field config
7. **Frontend `PortalGuard`** for route-level access enforcement (not just rendering)
8. **Auto-refresh interceptor** on 401 TOKEN_EXPIRED (single-flight via promise)

## What Phase 2 Does NOT Include

- Daily sales (Phase 3 — Outlet)
- PR/PO/GR (Phase 3 — Procurement)
- Stock movements / opname (Phase 3 — Inventory)
- Journal entries / AP / payments (Phase 4 — Finance)
- HR transactions (Phase 5)
- Executive dashboard / AI assistant (Phase 6)

## Next Steps (Phase 3)

Build Outlet Portal, Procurement, and Inventory in one phase since they overlap heavily (PR from Outlet → Procurement consolidation → GR creates inventory movement). Test scope: complete daily ops cycle.

User stories for Phase 3 from `MODULES.md`:
- OU-US-1..6 (outlet)
- PR-US-1..6 (procurement)
- IN-US-1..4 (inventory)
- Plus AI smart autocomplete in forms (item/vendor) — already POC'd

## Files Touched / Created in Phase 2

```
Backend:
  /app/backend/server.py                      (rewrite)
  /app/backend/core/{config,db,security,audit,exceptions,perms_catalog}.py
  /app/backend/models/master.py
  /app/backend/repositories/base.py
  /app/backend/services/{auth,notification,search}_service.py
  /app/backend/routers/{auth,admin,master,notifications,search}.py
  /app/backend/utils/number_series.py
  /app/backend/seed/seed_demo.py

Frontend:
  /app/frontend/src/{App.js,App.css,index.css}
  /app/frontend/src/lib/{api,auth,format,theme,portals,queryClient}.js
  /app/frontend/src/components/layout/{AppShell,TopNav,SideRail}.jsx
  /app/frontend/src/components/shared/{GlobalSearch,NotificationBell,NotificationDrawer,UserMenu,ThemeToggle,KpiCard,EmptyState,LoadingState,ErrorState,PortalGuard,RequirePermission}.jsx
  /app/frontend/src/pages/{Login,NotFound,HomeRedirect,NoAccess}.jsx
  /app/frontend/src/portals/{Executive,Outlet,Procurement,Inventory,Finance,HR}Portal.jsx
  /app/frontend/src/portals/PortalPlaceholder.jsx
  /app/frontend/src/portals/admin/{AdminPortal,AdminHome,Users,Roles,MasterData,AuditLog,NumberSeries}.jsx
  /app/frontend/src/components/ui/sonner.jsx (rewrite — drop next-themes dep)
```

Test artifacts:
- `/app/test_reports/iteration_1.json` — initial regression
- `/app/test_reports/iteration_2.json` — post-fix regression (87% overall, 100% fixes verified)

## Demo Credentials (all `Torado@2026`)

```
admin@torado.id          → Super Admin (full *)
executive@torado.id      → Executive / Owner
finance@torado.id        → Finance Manager
procurement@torado.id    → Procurement Manager
alt.manager@torado.id    → Outlet Manager (Altero only)
dls.manager@torado.id    → Outlet Manager (De La Sol only)
cal.manager@torado.id    → Outlet Manager (Calluna only)
rkp.manager@torado.id    → Outlet Manager (Rucker Park only)
```

⚠️ **Production note**: Before deployment, remove demo users via Admin Portal or seed script, and force admin password reset.
