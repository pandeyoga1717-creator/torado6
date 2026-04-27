# 📘 PRD — Aurora F&B (Integrated F&B Group ERP)
**Version:** 1.0 (Master)  
**Status:** Planning — Pre-Development  
**Owner:** Product + Engineering  
**Last Updated:** Phase 0 (Discovery)

---

## 0. Tentang Dokumen Ini

Dokumen ini adalah **single source of truth** untuk pengembangan sistem Aurora F&B — sebuah ERP terintegrasi untuk satu group F&B dengan banyak brand & banyak outlet. Dokumen ini disusun berlapis (modular) supaya konteks tetap konsisten meskipun development memakan banyak fase dan iterasi.

Gunakan dokumen ini sebagai **referensi mutlak**. Jika ada konflik antara dokumen ini dan kode, dokumen yang menang — kecuali jika konflik tersebut disetujui untuk di-update di sini terlebih dahulu.

---

## 1. Daftar Dokumen (Modular Reference)

| # | File | Isi | Audience Utama |
|---|---|---|---|
| 0 | `PRD.md` (file ini) | Visi, goals, success criteria, navigasi dokumen | Semua |
| 1 | `ARCHITECTURE.md` | Tech stack, system architecture, infra, API contract, data model lengkap (semua entity) | Engineering |
| 2 | `MODULES.md` | 7 Portal lengkap — feature, screen, user story, acceptance criteria per modul | Engineering + Product |
| 3 | `UI_UX_SYSTEM.md` | Design system glassmorphism, design tokens, komponen, navigasi, dashboard interaktif, notifikasi, global search, filter/sort, micro-interactions | Frontend + Designer |
| 4 | `AI_FEATURES.md` | 6 AI features — prompt template, model, integration point, guardrails | AI Engineer |
| 5 | `PHASE_PLAN.md` | 8 Fase development + sub-fase + DoD per fase | Project Manager + Engineering |
| 6 | `EXCEL_MAPPING.md` | Mapping setiap kolom Excel existing → tabel sistem (schema baru) | Data Engineer + Migration |
| 7 | `JOURNAL_MAPPING.md` | Mapping setiap event bisnis → journal entry (Dr/Cr) untuk akuntansi | Finance + Backend |
| 8 | `RBAC_MATRIX.md` | Role × Portal × Permission grid lengkap | Security + Backend |

---

## 2. Visi & Mission Statement

### Visi
> **"Mengubah Excel-driven F&B operations menjadi platform digital yang membimbing user, bukan membebaninya — sehingga setiap orang dari outlet sampai executive bisa membuat keputusan terbaik tanpa perlu jadi expert akuntansi."**

### Mission
Membangun sistem ERP F&B terintegrasi yang:
1. **Menggantikan Excel** sebagai sistem operasional & finansial utama
2. **Membimbing** (bukan sekadar mencatat) — setiap user dipandu lewat task & SOP
3. **Mengakomodir multi-brand & multi-outlet** dengan business rules yang configurable
4. **Memberikan real-time insight** ke executive lewat dashboard & AI assistant
5. **Audit-trail by default** — setiap perubahan tercatat, dapat ditelusuri

### What This System Is NOT
- ❌ **Bukan POS / kasir** (no real-time order taking, no kitchen display in-shift) — sales dimasukkan **manual harian** per outlet
- ❌ **Bukan recipe-driven inventory** — valuation pakai **stock opname & movement actual**, bukan auto-deduct dari recipe BOM
- ❌ **Bukan multi-tenant SaaS** — single-tenant, self-hosted, untuk 1 group perusahaan
- ❌ **Bukan replacement payroll software** — kami handle incentive, service charge, advance, tapi payroll utama tetap external (kami integrate hasilnya saja)

---

## 3. Success Criteria (KPI Sistem)

| Kategori | KPI | Target |
|---|---|---|
| **Adoption** | % outlet yang submit daily sales harian | ≥ 95% dalam 30 hari setelah go-live |
| **Adoption** | Waktu rata-rata input sales harian per outlet | ≤ 5 menit |
| **Data Quality** | % entry yang lolos validasi tanpa exception | ≥ 90% |
| **Data Quality** | Trial balance closing diff | Rp 0 |
| **Speed** | Closing bulanan (dari hari kerja terakhir) | ≤ 5 hari kerja |
| **Insight** | Executive dashboard refresh latency | ≤ 3 detik |
| **Insight** | AI assistant response time | ≤ 8 detik |
| **Reliability** | Uptime | ≥ 99.5% (jam operasional) |
| **Audit** | % transaksi finansial dengan source document linked | 100% |

---

## 4. Stakeholder & User Personas

### Primary Personas

#### 1. **Bu Sari — Outlet Manager** (Field)
- **Konteks:** Pegang 1–2 outlet, sibuk, multitasking (operasional + admin)
- **Pain Points:** Excel terlalu banyak sheet, takut salah formula, tidak tahu kapan harus laporan
- **Need:** Aplikasi yang **bilang "hari ini Anda harus melakukan X, Y, Z"** — bukan menu menumpuk
- **Devices:** Smartphone + laptop kantor outlet
- **Frequency:** Harian (sales entry, petty cash, urgent purchase)

#### 2. **Pak Budi — Finance & Accounting Staff** (HQ)
- **Konteks:** Validasi sales, AP, jurnal, closing
- **Pain Points:** Excel rentan typo, IMPORTRANGE rusak, tidak ada audit trail
- **Need:** Workflow approval, jurnal otomatis dari event, drill-down dari laporan ke source
- **Devices:** Desktop
- **Frequency:** Harian (validasi) + mingguan (PR/PAY) + bulanan (closing)

#### 3. **Bu Dewi — Purchasing Staff** (HQ)
- **Konteks:** Konsolidasi request dari outlet, negotiate ke vendor, control PO
- **Pain Points:** Request datang lewat WA terpisah, tidak ada vendor history terpadu
- **Need:** Konsolidasi otomatis, vendor comparison, PO status tracking
- **Devices:** Desktop
- **Frequency:** Harian

#### 4. **Pak Rudi — Warehouse / Inventory Controller**
- **Konteks:** Receiving, transfer antar outlet, stock opname
- **Pain Points:** Stock opname bulanan masih kertas, variance tidak tertelusur
- **Need:** Mobile-friendly stock count, scanner barcode (future), variance auto-calculated
- **Devices:** Tablet di gudang + desktop
- **Frequency:** Harian (receiving, transfer) + periodik (opname)

#### 5. **Bu Linda — HR & Incentive Officer**
- **Konteks:** Hitung incentive bulanan, allocate service charge, track employee advance
- **Pain Points:** Hitung manual rentan salah, employee advance bocor
- **Need:** Formula configurable per outlet, auto-calculate, audit trail
- **Devices:** Desktop
- **Frequency:** Mingguan + bulanan

#### 6. **Pak Andi — GM / Regional Manager**
- **Konteks:** Monitor 5–10 outlet, compare performance, intervene jika ada masalah
- **Pain Points:** Data tersebar, laporan terlambat, tidak tahu akar masalah
- **Need:** Dashboard multi-outlet dengan drill-down, exception alerts
- **Devices:** Laptop + smartphone
- **Frequency:** Harian

#### 7. **Pak Hadi — Executive / Owner**
- **Konteks:** Strategic view, profit, cash position, make/break decisions
- **Pain Points:** Laporan sebulan sekali, tidak tahu detail, tidak punya "second opinion"
- **Need:** **Real-time KPI** + **AI assistant** yang bisa jawab "kenapa profit Brand X turun?"
- **Devices:** Tablet + smartphone
- **Frequency:** Mingguan (deep) + harian (glance)

#### 8. **Bu Maya — System Admin** (Tech-Savvy Internal)
- **Konteks:** Atur user, role, master data, business rules, integrasi
- **Pain Points:** Setiap perubahan policy harus minta IT
- **Need:** Self-service config UI untuk rules, RBAC, master data
- **Devices:** Desktop
- **Frequency:** Mingguan (config) + ad-hoc

---

## 5. Top-Level Functional Scope

Detail per modul ada di `MODULES.md`. Ini ringkasan:

| Portal | Fungsi Utama | Excel Source |
|---|---|---|
| **Executive Portal** | Dashboard konsolidasi, KPI, AI assistant | PL, all summaries |
| **Outlet Portal** | Daily sales, petty cash, urgent purchase, opname, daily close | Master, KDO, BDO, Summary PC |
| **Procurement Portal** | PR → PO → Receiving, vendor comparison, planned buying | Master, KDO/BDO, ML |
| **Inventory Portal** | Movement, transfer, adjustment, opname, valuation, variance | (new — currently Excel manual) |
| **Finance & Accounting** | Sales validation, AP (KB), petty cash settlement, JAE journal, PAY payment, tax, closing, PL/BS | ACC, JAE, PAY, KB, PL, Tax Details |
| **HR & Incentive** | Service charge allocation, incentive scheme, employee advance (EA), L&B fund | EA, L&B, Service 5%, Incentive, Travel Incentive |
| **Admin Platform** | Master data (item, vendor, employee, COA), users, roles, business rules config, audit log | (new — replaces "manually edit Excel") |

---

## 6. Top-Level Non-Functional Requirements (NFR)

| Kategori | Requirement |
|---|---|
| **Performance** | API p95 ≤ 500ms; dashboard load ≤ 3s; bulk opname load 1000 items ≤ 5s |
| **Concurrency** | Support 50 concurrent users without degradation |
| **Security** | RBAC scoped by outlet/brand; audit log immutable; password hash bcrypt; JWT 24h; refresh token 7d |
| **Availability** | 99.5% during operational hours (06:00–24:00 WIB) |
| **Backup** | Daily MongoDB backup, 30-day retention |
| **Localization** | Bahasa Indonesia + English; format Rupiah, tanggal Indonesia (DD MMM YYYY); timezone Asia/Jakarta |
| **Mobile** | Outlet portal must be **mobile-responsive** (smartphone-first untuk daily entry) |
| **Accessibility** | WCAG AA contrast; keyboard nav; screen reader friendly labels |
| **Browser** | Latest Chrome, Edge, Safari, Firefox |
| **Audit** | Every CRUD on transactional/financial entity logs: user, timestamp, before, after, reason (where applicable) |
| **Period Lock** | Closed accounting periods are write-locked except for adjustments by Finance Manager |

---

## 7. Tech Stack (Final)

| Layer | Tech | Reasoning |
|---|---|---|
| **Frontend** | React 19 + Vite + Tailwind + shadcn/ui + Framer Motion + Recharts | Modern, fast, glassmorphism-friendly |
| **Backend** | FastAPI (Python 3.11) | Mature, async, OpenAPI-first |
| **Database** | MongoDB (single-node, can shard later) | Flexible schema; matches our document-style data |
| **Auth** | JWT (access+refresh), bcrypt | Self-hosted, simple |
| **AI** | Emergent Universal LLM Key (GPT/Claude/Gemini) via emergentintegrations | Single key, multiple providers |
| **Charts** | Recharts + custom D3 where needed | Interactive, hoverable |
| **State** | React Context + TanStack Query | Server state separation |
| **Forms** | React Hook Form + Zod | Type-safe validation |
| **Routing** | React Router v6 | Standard |
| **Icons** | lucide-react | Modern, consistent |
| **Date** | dayjs (Asia/Jakarta) | Lightweight, timezone-aware |
| **PDF/Print** | jsPDF + html2canvas (form prints) | Client-side print preview |
| **File Upload** | Backend → local /app/uploads (Phase 1) → object storage if scaling (Phase 7) | Pragmatic |

Detail lengkap di `ARCHITECTURE.md`.

---

## 8. Design Philosophy (UI/UX)

Detail lengkap di `UI_UX_SYSTEM.md`. Highlights:

- **Glassmorphism modern** — frosted glass surfaces, soft shadow, rounded-2xl, subtle gradient backgrounds
- **Light theme primary** + dark theme toggle
- **Top-nav (portal) + left-rail (utilities)** — like reference image (SugarCRM-style)
- **Active state = black/dark pill** untuk kontras tinggi
- **Dashboard interaktif** — every chart clickable → drill, hover tooltip rich, animation on enter
- **Global search (Cmd+K)** — search across items, vendors, transactions, employees
- **Notification center** — badge di top-nav, panel slide-in dari kanan, kategori (urgent/info/done)
- **Filter & sort** — chip-based filter, multi-select, save preset
- **Empty/Loading/Error states** — semua punya design yang konsisten
- **Micro-interactions** — Framer Motion untuk transitions, button press, modal open
- **Task-driven home** — bukan menu list, tapi "Today: 3 tasks for you"

---

## 9. AI Features Overview

Detail di `AI_FEATURES.md`. 6 feature:

1. **Executive AI Assistant** (chat) — natural Q&A on data
2. **Smart Data Entry** — auto-suggest item/vendor; OCR receipt → fill form
3. **Daily Anomaly Detection** — flag outlet outliers (sales/expense)
4. **Forecasting** — sales, inventory needs, cashflow
5. **AI Categorization** — auto-classify expense → COA/GL
6. **Conversational Q&A on Reports** — "profit Brand X bulan lalu?"

---

## 10. Development Approach

Detail di `PHASE_PLAN.md`. 8 Phase:

| Phase | Title | Duration |
|---|---|---|
| 0 | Discovery & Foundation Setup | (this) |
| 1 | Platform Foundation (Auth, RBAC, Master Data, Shell UI) | Weeks 1–2 |
| 2 | Outlet Portal MVP (Daily Sales, Petty Cash, Urgent Purchase) | Weeks 3–4 |
| 3 | Procurement & Inventory Core (PR→PO→Receiving, Movement, Opname) | Weeks 5–6 |
| 4 | Finance & Accounting Core (COA, JAE, PAY, KB, Tax, Closing, PL) | Weeks 7–8 |
| 5 | HR & Incentive (EA, Service Charge, Incentive, Voucher, FOC) | Week 9 |
| 6 | Executive Dashboard & AI Assistant | Week 10 |
| 7 | Configurability, Reports, Performance, Polish | Week 11 |
| 8 | Hardening, Migration, UAT, Go-Live Prep | Week 12 |

---

## 11. Quality Gates (per Phase)

Setiap fase **HARUS lewat** semua gate ini sebelum lanjut:

- ✅ Acceptance Criteria semua user story tercentang
- ✅ `testing_agent_v3` dipanggil dengan user-story scenarios; semua green
- ✅ Lint hijau (ruff backend, eslint frontend)
- ✅ No critical/high bugs open
- ✅ Design system adherence ≥ 95% (visual check)
- ✅ Backward compatibility — Phase N+1 tidak break Phase N
- ✅ Documentation di file ini di-update jika ada perubahan kontrak

---

## 12. Glossary (Istilah Konsisten)

| Istilah | Arti |
|---|---|
| **Group** | Perusahaan induk (entitas legal tunggal yang dimiliki user) |
| **Brand** | Nama bisnis di dalam group (mis. "Lusi Pakan Coffee", "Kantin Sari") |
| **Outlet** | Lokasi fisik tempat operasi (1 brand bisa punya banyak outlet) |
| **PR** | Purchase Request — permintaan beli dari outlet |
| **PO** | Purchase Order — order ke vendor |
| **GR/Receiving** | Goods Receipt — terima barang |
| **PR doc** dalam JAE | Payment Request (di Finance, beda dengan Purchase Request) — pakai istilah **PayReq** untuk hindari konfusi |
| **JAE** | Journal Adjustment Entry — entry jurnal manual |
| **PAY** | Payment Ledger — catatan pembayaran |
| **KB** | Kontra Bon (AP Ledger) — utang ke vendor |
| **EA** | Employee Advance — kasbon karyawan |
| **L&B** | Loss & Breakage fund |
| **L&D** | Learning & Development fund |
| **SHU** | Sisa Hasil Usaha — profit-sharing periodik |
| **FOC** | Free of Charge — kompensasi/marketing/promo gratis |
| **PC** | Petty Cash — kas kecil outlet |
| **KDO** | Kitchen Daily Order — request bahan dapur |
| **BDO** | Bar Daily Order — request bahan bar |
| **ML** | Market List — master item & price history |
| **Opname** | Stock count fisik |
| **COA** | Chart of Accounts |

---

## 13. Master Data Awal (Confirmed)

**Group:** Torado

**Brand & Outlet (4 brand × 1 outlet masing-masing):**
| Brand | Outlet | Note |
|---|---|---|
| Altero | Altero | |
| De La Sol | De La Sol | |
| Calluna | Calluna | |
| Rucker Park | Rucker Park | |

**Default Settings (Confirmed):**
- **Currency:** IDR only (Phase 1–8); multi-currency in backlog
- **Bank reconciliation:** manual CSV upload (Phase 4); H2H integration in backlog
- **Notifications:** in-app + email (Phase 1); WhatsApp Cloud API in backlog
- **Receipt printing:** PDF preview + manual print; thermal printer not in scope
- **Approval tiers:** default per `RBAC_MATRIX.md` §6 — **MUST be configurable via Admin Portal "Business Rules" editor (Phase 7)**, with rule effective dating

## 14. Open Questions (akan diisi seiring development)

- [ ] Vendor master — NPWP integration to e-Faktur (backlog)
- [ ] Pilot outlet untuk early V1 testing — pilih 1 outlet untuk pilot setelah Phase 4? (decision deferred)
- [ ] AI cost budget per user/month default value (decision: Phase 6)

---

## 14. Sign-off

Dokumen ini akan di-update setiap fase selesai. Setiap update wajib:
1. Bump versi di header
2. Tambah changelog di section bawah
3. Update file modular yang terkait (ARCHITECTURE/MODULES/etc)

### Changelog
- **v1.0** (Pre-development): Initial PRD created from CTO Plan + Excel Analysis + User clarifications
- **v1.7B** (Phase 7B Complete — Jan 2026): **Advanced Reports** module landed.
  - **What's Built:**
    - Vendor Performance Scorecard (composite score = on-time × 0.40 + price stability × 0.25 + (100-defect) × 0.20 + lead-time × 0.15)
    - Report Builder lite — 5 dimensions (outlet/brand/vendor/category/month) × 8 metrics (sales/transactions/cogs/gross-profit/ap-exposure/po-count/gr-count/purchase-value)
    - Pivot Matrix (2D heat-mapped) with row/col/grand totals + CSV export
    - MoM/YoY Comparatives with rolling 12m sparkline
    - Saved Reports CRUD (per-user definitions)
  - **API:** 10 new endpoints under `/api/reports/*` (catalog, vendor-scorecard×2, builder/run, pivot, comparatives, saved CRUD)
  - **Frontend:** 4 new pages under `/finance/*` (vendor-scorecard, report-builder, pivot, comparatives)
  - **Demo data:** `seed_phase7b_demo.py` produces 240 daily_sales + 45 PO + 38 GR + 480 JE for realistic reports
  - **Test results (iteration_2):** Backend 18/23 → 23/23 after 422→400 ValidationError fix; frontend 4/4 pages render with proper data-testid coverage. Regression on Phase 4–7A passed.
  - **Bug Fix:** Aurora `ValidationError` now returns HTTP **400** (was 422) — better REST semantics for business validation; FastAPI body-parse 422 unchanged.
  - **Next (Phase 7C):** Forecasting (3-month sales/expense trend) + Real-time anomaly detection (notification when daily_sales deviates >X% from rolling avg).

- **v1.7C** (Phase 7C Complete — Jan 2026): **3-Month Forecasting** module landed.
  - **What's Built:** Linear Regression + EWMA + Hybrid (50/50 blend) forecasting algorithms (pure Python, no extra deps); MAPE backtest accuracy on 30-day holdout; ±2σ confidence band.
  - **API:** 4 new endpoints under `/api/forecasting/*` (methods, sales, expense, dashboard).
  - **Frontend:** New `/finance/forecasting` page — KPI cards, SVG chart with history/forecast/CI band + 'today' marker, monthly bar chart, method comparison panel, per-outlet table with growth & MAPE badges.
  - **Test results (iteration_3):** Backend 21/21 (100%); frontend 100% after fixing one React duplicate-key warning in MonthlyBars.
  - **Next (Phase 7D):** Real-time anomaly detection (sales deviation, vendor price/lead-time anomalies, AP/Cash spikes) → notification feed.

- **v1.7C+** (Forecast Guard Enhancement — Jan 2026): **Forecast-aware guardrails** wired into expense submission.
  - **What's Built:** New `forecast_guard_service.check_expense()` — classifies a proposed amount vs forecast (severity: none/mild/severe). New `POST /api/forecasting/guard/check` endpoint. Reusable `<ForecastGuardBanner>` React component with 600ms debounce, severity-colored states, MTD/Proposed/Projected/Forecast stats grid.
  - **Integration:** Manual Journal Form aggregates expense Dr lines per (outlet, brand) scope → renders one banner per scope; Save button requires justification reason if ANY scope is mild/severe; reason merged into JE description for audit trail.
  - **UX value:** Converts forecasts from passive analytics into proactive operational nudge — managers see "this expense is 35% above April forecast Rp 438M" before they post, with auditable reason capture.
  - **Test results (iteration_4):** Backend 11/11 (100%); frontend 100% across severe / mild / none / multi-scope flows.
  - **Next:** Extend the same `<ForecastGuardBanner>` into Petty Cash submission, Urgent Purchase form, and the My-Approvals queue (read-only verdict display for approvers).

- **v1.7C++** (Forecast Guard Persistence + Executive Widget — Jan 2026):
  - **Persistence layer:** New `forecast_guard_logs` collection + helpers `log_verdict()`, `get_verdict_for_source()`, `list_logs()`, `activity_summary()`. Idempotent: re-submitting same source updates not duplicates. Pre-check happens **before** `_post_journal` so MTD doesn't double-count in-flight amounts.
  - **3 new endpoints:** `GET /api/forecasting/guard/source/{type}/{id}`, `/guard/logs`, `/guard/activity` (auth + perm gated to `executive.dashboard.read` or `finance.report.profit_loss`).
  - **Wired into:** Manual Journal POST + Urgent Purchase create — both now persist verdict log with reason on submission.
  - **Executive Dashboard widget** (`<ForecastGuardWidget>`) — auto-counts forecast-busting submissions in last 7/14/30 days. Shows: 3 summary tiles (Severe / Mild / At-Risk Rp), By-Outlet ranked list with severity pills + max deviation %, Recent transactions list with click-through links to JE/UP details, "clean state" mode when zero. Replaces gut-feel governance with data-driven oversight for the CFO/Owner.
  - **My-Approvals enhancement:** Queue rows now show forecast-guard badge (red for severe, amber for mild) with deviation % + reason snippet, ringing the entire row in the relevant color.
  - **Bug fix in `post_manual_journal`:** Pre-check moved BEFORE `_post_journal` (was after — caused MTD double-counting drift; verdict severity could shift from `mild` to `severe` due to in-flight amount being included in MTD). Now pre-check verdict matches exactly what user sees in the form.
  - **Test results (iteration_5):** Backend 15/15 (100%); frontend 95% — Executive widget renders perfectly with 8 logs across 5 outlets, range toggles, Show More expand. UP dialog banner+reason gating verified. MyApprovals badge code path verified (visual not testable on demo seed since no pending approvals).
