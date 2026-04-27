# 🧠 AI FEATURES — Aurora F&B
**Companion to:** PRD.md → Section 9  
**LLM Provider:** Emergent Universal LLM Key (GPT/Claude/Gemini)  
**Library:** `emergentintegrations`  
**Version:** 1.0

---

## 0. Design Principles

1. **Augment, don't replace.** AI suggests, human confirms. No AI auto-posts journals.
2. **Source-cited.** Every AI answer references the data rows it used. User can click to verify.
3. **RBAC-scoped.** AI sees only what the user is allowed to see.
4. **Period-aware.** AI respects closed periods (read-only on closed).
5. **Cost-conscious.** Cache deterministic queries; choose model by task complexity.
6. **Failsafe.** AI failure never blocks core workflow; UI degrades gracefully.
7. **Auditable.** Every AI interaction logged: user, prompt, tools called, response, tokens.

---

## 1. Feature: Executive AI Assistant

### Persona
Executive/GM asks natural language questions about business performance.

### Use Cases
- "Berapa profit Brand Lusi bulan lalu?"
- "Outlet mana yang paling boros bulan ini?"
- "Kenapa COGS naik 5%?"
- "Compare revenue Brand A vs B di Q1."
- "Apa yang harus saya khawatirkan minggu ini?"

### Flow
1. User opens AI chat (drawer or full page)
2. User types question
3. Backend: build system prompt with: user role, accessible scope, current date, available tools
4. LLM (Claude Sonnet) reasons → calls tool(s) (e.g. `get_pl_breakdown`, `get_outlet_ranking`)
5. Tool returns structured data
6. LLM synthesizes answer in Indonesian + English mix as preferred
7. UI shows answer + "Sources" panel (clickable refs to data)

### Tool Catalog (function-callable by LLM)
```python
# All tools auto-scoped to user's permissions
@ai_tool
def get_revenue_trend(period: str, brand_ids: list[str]=None, outlet_ids: list[str]=None,
                      group_by: Literal["day","week","month","brand","outlet"]="day")

@ai_tool
def get_pl_breakdown(period: str, brand_id: str=None, outlet_id: str=None,
                     dimension: Literal["category","outlet","brand"]="category")

@ai_tool
def get_outlet_ranking(metric: Literal["revenue","profit","margin","cogs_pct"],
                       period: str, top_n: int=10)

@ai_tool
def get_anomalies(period: str, severity: Literal["all","high"]="high")

@ai_tool
def get_ap_aging(as_of: date, vendor_id: str=None)

@ai_tool
def get_inventory_value(as_of: date, outlet_id: str=None, category_id: str=None)

@ai_tool
def compare_periods(metric: str, period_a: str, period_b: str, dim: str=None)

@ai_tool
def get_transaction_detail(doc_no: str)
```

### Sample System Prompt (excerpt)
```
You are Aurora AI, the executive assistant for {group_name}. 
Today is {date_today_jakarta}. The user is {user_full_name} with role {role}, 
scoped to brands [{brand_codes}] and outlets [{outlet_codes}].
Closed periods (read-only): {closed_periods}.

Rules:
- Answer in same language as question (Indonesian preferred).
- Always cite data sources (use citation format [doc:DocNo] or [report:type/period]).
- Numbers: format as Rp 1.234.567 (Indonesian thousands).
- If unsure or out of scope, say so. Don't fabricate.
- For "why" questions, dig: get top contributors then explain.
- Be concise but specific.

Available tools: [list with signatures]
```

### Model Routing
- Default: **Claude Sonnet** (best multi-step reasoning)
- Fallback: GPT-5
- Token limit: 8K context, response 1.5K

### UI
- Chat drawer (right) or full page
- Message bubbles glass cards
- Streaming response (token-by-token typewriter)
- Tool call indicator: "Querying revenue data…"
- Sources panel right side: clickable cards of data used
- Suggested questions chips at start
- Save chat to history; retrieve later

### Guardrails
- No write operations
- No financial advice ("investing in X")
- Period lock respected
- Token budget per session: 50K (fail open with warning)

---

## 2. Feature: Smart Data Entry

### Two sub-features:

### 2A. Item / Vendor / GL Autocomplete (AI-enhanced)

When user types in fields like "Item", "Vendor", "Description", "GL Account":

- After 2+ chars, fuzzy-match local DB (fast, deterministic)
- After 4+ chars with no exact match, **call AI** to:
  - Suggest plausible matches (e.g., user types "telur ayam" → AI suggests "Telur Ayam Negeri 1kg")
  - Suggest **last vendor** + **last price** from history (transparent: "Last bought from Toko Sumber, Rp 25.000/kg, 3 days ago")
  - Suggest **GL account** based on description+context ("This looks like a 'Bahan Baku - Dapur' expense, GL 5101")

### 2B. OCR Receipt / Invoice

Upload photo of struk/invoice → AI extracts:
- Vendor name (matched to vendor master if possible)
- Date
- Line items (item name, qty, unit price, total) — best-effort
- Total amount
- Tax amount (if visible)
- Suggested GL category

UI flow:
1. Camera button on Petty Cash / Urgent Purchase form
2. Capture/upload
3. Loading state "AI sedang membaca struk…"
4. Form fields auto-filled with **confidence indicator** per field (✅ high, ⚠ verify)
5. User reviews, edits, submits
6. Original image saved as attachment

### Backend
- `POST /api/ai/extract-receipt` (multipart upload)
- Pipeline:
  1. Image preprocessing (resize, contrast)
  2. **Gemini 2.0 Flash** (multimodal, fast, cheap) for vision OCR
  3. Structured output via JSON schema
  4. Match vendor/item against local masters (fuzzy)
  5. Return structured payload + confidence per field

### Sample Prompt
```
Extract from this receipt image:
- vendor_name (string)
- date (YYYY-MM-DD)
- items: [{name, qty, unit_price, total}]
- subtotal, tax, total (numbers)
- payment_method (if visible)
- confidence_per_field (low/medium/high)
Output strict JSON. Receipts are typically Indonesian; numbers may use "." or "," 
as thousand or decimal separator. Total in Rupiah.
```

### Model Routing
- OCR: **Gemini 2.0 Flash** (multimodal, cheap)
- GL suggestion: **GPT-5 mini** (cheap, fast classification)
- Item/Vendor match: local fuzzy + LLM only when ambiguous

### Edge Cases
- Blurry image → "Gambar kurang jelas, silakan retake" with retry
- Non-Indonesian receipt → still works, may have lower confidence
- Multiple receipts → detect & ask user to crop

---

## 3. Feature: Daily Anomaly Detection

### Purpose
Deteksi otomatis transaksi atau hari yang "tidak biasa" — lalu beri notifikasi ke user yang relevan dengan **explanation**.

### Trigger
- Daily batch job (06:00 WIB) scans yesterday's data
- Real-time on data submission (Phase 7)

### Anomaly Categories
| Type | Detection Method | Example |
|---|---|---|
| **Sales drop** | z-score > 2 vs trailing 30d avg per outlet | "Sari Sudirman sales kemarin Rp 3jt, biasanya Rp 8jt" |
| **Sales spike** | z-score > 2 (positive) | "Outlet X sales 200% above normal" |
| **Expense spike** | z-score > 2 on expense category | "Bahan Baku outlet Y +40% MoM" |
| **Missing daily sales** | No submission for X days | "Outlet Z belum submit sales 2 hari" |
| **Petty cash imbalance** | Replenish lebih dari 2x normal | "PC outlet A request top-up 3x bulan ini" |
| **Inventory variance** | Opname variance > 5% by value | "Variance opname Rp 2jt outlet X" |
| **AP overdue** | invoice past due 30+ | "5 invoices vendor X overdue 30+" |
| **Approval bottleneck** | item pending > 48h | "PR-XXX waiting approval 3 days" |
| **Unusual transaction** | LLM classification | "PAY of Rp 50jt larger than typical, no PO link" |

### Architecture
```
[Scheduler 06:00] → [AnomalyService] → 
    [Statistical Pass] → candidates
    → [LLM Explainer] (only for top-N candidates)
    → [Notification Dispatcher]
```

### Statistical Pass (no LLM, fast)
- Per outlet+metric: rolling 30d mean & std
- Z-score > 2 = anomaly candidate
- Configurable threshold per metric (admin tunable)

### LLM Explainer (top 10 anomalies/day)
Prompt:
```
Context: Outlet {outlet} had {metric} of {value}, but rolling 30d avg is {avg} ± {std}.
Recent context: 
- Last 7 days values: [...]
- Recent transactions in this outlet/metric: [...]
- Same period last year: [...]
Provide:
1. Plausible reasons (top 3)
2. Recommended action for the manager
3. Severity (low/medium/high)
Keep concise, max 3 sentences per reason.
```

### UI
- Notification badge on Executive dashboard
- "Anomalies Today" card with top 5
- Click → detail with chart + explanation + linked transactions
- Action buttons: "Acknowledge" / "Investigate" / "Escalate"

### Model Routing
- Statistical: pure Python (no LLM)
- Explainer: **Claude Sonnet** (best at causal reasoning)

---

## 4. Feature: Forecasting

### Forecasts Supported
1. **Sales forecast** — next 7/14/30 days per outlet/brand
2. **Inventory needs forecast** — reorder point per item
3. **Cashflow forecast** — next 30 days inflow/outflow projection

### Approach (hybrid)
- **Statistical baseline**: Prophet or simple ARIMA-like (configurable, on-prem in Python)
- **LLM enhancement**: contextual factors (events, seasons, anomalies) layered over baseline
- **Confidence interval** always reported (low/mid/high)

### Architecture
```
[Weekly job] → [Time series load 90d] → [Prophet model] → baseline
         → [LLM context inject] (holidays, weather hints, manual notes) → adjusted forecast
         → [Store in ai_predictions]
[On dashboard load] → fetch latest predictions
```

### Sales Forecast Output
```json
{
  "period": "2026-05",
  "outlet_id": "...",
  "daily_forecast": [
    {"date": "2026-05-01", "value": 8500000, "low": 7200000, "high": 9800000, "factors": ["weekday", "end of month"]},
    ...
  ],
  "monthly_total_forecast": 250000000,
  "confidence": "medium",
  "notes": "Lebaran period assumed 5 days lower revenue"
}
```

### Inventory Reorder Forecast
For each item per outlet:
- Avg daily consumption (from issues last 30d)
- Lead time (vendor avg, from PO history)
- Safety stock factor (configurable)
- **Reorder point** = (lead time × avg daily) + safety stock
- **Recommended order qty** = consumption forecast next 14d - current stock + safety

### Cashflow Forecast
- Inflow: forecasted sales × cash collection % (deferred 0–3d)
- Outflow:
  - Known: KB due dates, payroll dates, recurring expenses
  - Forecasted: estimated procurement based on stock forecast
- Output: 30-day calendar with projected balance per day

### UI
- Forecast widget on Executive dashboard (line chart with confidence band)
- Inventory portal: "Reorder Suggestions" page
- Finance: "Cashflow Forecast" report with calendar view

### Model Routing
- Time series: Prophet (statsmodels) — local Python
- Context inject: **GPT-5** (function-calling for clean JSON)
- Anomaly check: existing anomaly service

### Phase
- MVP forecast (sales only, statistical) in Phase 6
- Full multi-target with LLM context in Phase 7

---

## 5. Feature: AI Categorization

### Purpose
Auto-suggest **GL account / category** for new expense/transaction based on description + context.

### Use Cases
- Petty cash: user types "beli tisu Indomaret 50k" → suggest GL 5301 "Bahan Habis Pakai"
- Urgent purchase: vendor + items → suggest GL
- Manual JAE: description → suggest counter account

### Architecture
```
User types description + amount + outlet/brand context
→ Local rule check (regex/keyword → GL mapping if known)
→ If no rule match → LLM categorization (GPT-5 mini)
→ Return: {gl_id, gl_code, gl_name, confidence, reason}
→ Show as suggestion below input field
→ User accepts (1 click) or selects manually
→ If accepted, update local rule for future (learning)
```

### Local Rule Engine
DB collection `categorization_rules`:
```
{ id, pattern (regex/keyword), gl_account_id, confidence, hit_count, created_by, created_at }
```
Grows over time as users accept suggestions.

### LLM Prompt (when rule misses)
```
Classify the following expense into the correct GL account.

Context:
- Group: {group_name}
- Outlet: {outlet_name}, brand: {brand_name}
- Recent expenses (10 examples) of similar outlets categorized by humans: [...]

Expense:
- Description: "{description}"
- Amount: Rp {amount}
- Vendor: "{vendor}"

Available GL accounts (only postable): 
[{ "id": "...", "code": "5101", "name": "Bahan Baku - Dapur", "description": "..." }, ...]

Return JSON: { gl_id, code, name, confidence (0-1), reason (short) }
```

### Model Routing
- **GPT-5 mini** (cheap, fast classification)

### UI
In-form dropdown labeled "AI suggestion":
```
✨ AI Suggestion
   GL 5301 — Bahan Habis Pakai (95% confident)
   Reason: "tisu" matches consumable category
   [Accept] [Choose other]
```

### Edge Cases
- Multiple plausible categories — show top 3
- Unknown new GL — fall back to "Suspense" with flag

---

## 6. Feature: Conversational Q&A on Reports

### Difference from #1 (Executive Assistant)
While #1 is open-ended chat, #6 is **embedded in report views** — contextual to the current report.

### Use Cases
- On PL view: ask "why did COGS go up?"
- On AP Aging: ask "which vendors are most concerning?"
- On Inventory Valuation: ask "which items are stuck?"

### Flow
- Each report page has "Ask AI about this" button (top-right)
- Click → small chat drawer with context preloaded:
  ```
  System: User is viewing {report_name} for {period}, filtered by {filters}.
           Visible data: [serialized table/chart data].
           Available drill tools: ...
  ```
- User asks about what they see
- AI answers with reference to specific rows/cells (which UI highlights)

### Implementation
- Reuses tool catalog from feature #1
- Additional tool: `highlight_cells(cell_refs: list[str])` — UI listens & visually highlights

### Model Routing
- Same as #1: **Claude Sonnet**

---

## 7. Cross-Feature Concerns

### Cost Management
- Per-user daily token budget (configurable, default 100K)
- Cache responses to identical queries (Redis-like in Mongo TTL collection) for 5 min
- Use cheapest model for the task
- Streaming preferred (lower perceived latency)

### Privacy
- Never send PII to LLM beyond what's needed
- Vendor/employee names OK (business data)
- No customer phone/email/personal data in prompts (we don't store much customer data anyway)

### Observability
- All AI calls logged: user, prompt hash, model, tokens in/out, latency, success
- Daily aggregate report on AI usage

### Failure Modes
- LLM timeout / error → graceful UI: "AI tidak tersedia saat ini, silakan coba lagi"
- Tool execution error → LLM retries once, then admits: "Saya tidak bisa mengakses data tersebut"
- Schema mismatch (LLM bad JSON) → retry with corrective prompt; if still fail → show raw text

### Versioning
- Prompt templates stored in DB collection `prompt_versions`, can A/B test
- Schema for tool inputs/outputs validated by Pydantic

---

## 8. AI Service Module Layout

```
backend/services/ai/
├── __init__.py
├── client.py              # emergentintegrations wrapper, model routing
├── chat.py                # Executive Assistant (#1, #6)
├── ocr.py                 # Receipt OCR (#2B)
├── autocomplete.py        # Item/Vendor/GL suggestions (#2A, #5)
├── anomaly.py             # Anomaly explainer (#3)
├── forecast.py            # Forecasting (#4)
├── categorize.py          # GL categorization (#5)
├── tools.py               # Tool catalog (function-callable)
├── prompts.py             # Prompt templates (versioned)
├── cache.py               # Mongo TTL cache
└── schemas.py             # Pydantic schemas for I/O
```

---

## 9. Feature × Phase Mapping

| Feature | Phase Introduced | Phase Polished |
|---|---|---|
| Smart Autocomplete (Item/Vendor) | Phase 2 | Phase 6 |
| GL Categorization | Phase 4 | Phase 6 |
| OCR Receipt | Phase 5 | Phase 7 |
| Anomaly Detection | Phase 6 | Phase 7 |
| Executive AI Chat | Phase 6 | Phase 7 |
| Conversational Q&A on Reports | Phase 6 | Phase 7 |
| Sales Forecasting | Phase 6 | Phase 7 |
| Inventory Reorder Forecast | Phase 7 | Phase 8 |
| Cashflow Forecast | Phase 7 | Phase 8 |

---

## 10. UX Promises (what user always experiences)

- AI features feel **fast** (streaming, optimistic UI)
- AI is **transparent** (sources shown)
- AI is **dismissable** (always have manual override)
- AI **never blocks** core action
- AI **learns** from user choice (categorization rules grow)
- AI **failures are silent** (no scary error walls)
