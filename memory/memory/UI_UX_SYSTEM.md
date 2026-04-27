# 🎨 UI/UX SYSTEM — Aurora F&B (Glassmorphism Design Language)
**Companion to:** PRD.md → Section 8  
**Reference image:** Light glassmorphic dashboard (SugarCRM-style) provided by user  
**Version:** 1.0

This document is the **single source of truth for all visual & interaction decisions**. Every screen must adhere unless an exception is documented.

---

## 1. Design Philosophy

### Visual Identity
Aurora is **calm, premium, and human**. Like the inside of an Apple Store crossed with a private banking app: airy, soft, confident.

**Three principles:**
1. **Glassmorphism, not cluttermorphism** — frosted glass panels stack with depth, but each panel breathes (generous padding)
2. **Black accent for action** — light overall, but **CTAs and active states are solid black/charcoal pills** for crisp contrast
3. **Soft motion, never frantic** — transitions are 200–400ms cubic-bezier easing; nothing bounces unless deliberate

### Anti-patterns to AVOID
- ❌ Heavy borders, harsh shadows
- ❌ More than 3 typography weights per screen
- ❌ Charts with > 5 visible series at once
- ❌ Modal stacking (max 1 modal at a time; use side drawer instead)
- ❌ Tooltips that block content
- ❌ Loading spinners without skeleton
- ❌ Forms longer than 1 viewport without progress indicator

---

## 2. Design Tokens

### Color Palette

#### Light Theme (default)
```css
--bg-canvas:        #F2F4F8;        /* page bg */
--bg-canvas-tint:   linear-gradient(160deg, #F4F6FA 0%, #EAEEF6 100%);
--surface-glass:    rgba(255,255,255,0.55);  /* primary glass card */
--surface-glass-2:  rgba(255,255,255,0.35);  /* nested card */
--surface-solid:    #FFFFFF;
--border-glass:     rgba(255,255,255,0.65);  /* inner highlight */
--border-soft:      rgba(15,23,42,0.06);     /* subtle outer */

--ink-primary:      #0B1220;        /* near-black */
--ink-secondary:    #4A5568;
--ink-tertiary:     #94A3B8;
--ink-inverse:      #FFFFFF;

--accent-black:     #0B1220;        /* solid black pills */
--accent-aurora:    #5B5FE3;        /* primary brand (calm indigo) */
--accent-aurora-2:  #8B5CF6;        /* gradient pair */
--accent-aurora-grad: linear-gradient(135deg,#5B5FE3 0%, #8B5CF6 100%);

--success:          #10B981;
--warning:          #F59E0B;
--danger:           #EF4444;
--info:             #3B82F6;

--shadow-sm:        0 1px 2px rgba(15,23,42,0.04);
--shadow-md:        0 4px 16px rgba(15,23,42,0.06);
--shadow-lg:        0 12px 32px rgba(15,23,42,0.08);
--shadow-glow:      0 0 0 1px rgba(91,95,227,0.15), 0 8px 24px rgba(91,95,227,0.12);

--blur-glass:       16px;
--blur-glass-strong:24px;
```

#### Dark Theme
```css
--bg-canvas:        #0B0F19;
--bg-canvas-tint:   linear-gradient(160deg, #0B0F19 0%, #131A2A 100%);
--surface-glass:    rgba(255,255,255,0.06);
--surface-glass-2:  rgba(255,255,255,0.03);
--surface-solid:    #131A2A;
--border-glass:     rgba(255,255,255,0.08);
--border-soft:      rgba(255,255,255,0.04);

--ink-primary:      #F1F5F9;
--ink-secondary:    #CBD5E1;
--ink-tertiary:     #64748B;
--ink-inverse:      #0B1220;

--accent-black:     #F1F5F9;        /* invert in dark; pill goes light */
--accent-aurora:    #818CF8;
--accent-aurora-2:  #C084FC;
```

### Typography
```
Font family:  "Inter", "Plus Jakarta Sans" (Latin), system-ui fallback
Display:      48/56  weight 700  letter-spacing -0.02em
H1:           32/40  weight 700  -0.015em
H2:           24/32  weight 600  -0.01em
H3:           20/28  weight 600
Body-lg:      16/24  weight 400
Body:         14/22  weight 400
Body-sm:      13/20  weight 400
Caption:      12/18  weight 500  letter-spacing 0.02em uppercase
Mono (codes): "JetBrains Mono" 13/18
```

### Spacing Scale
```
0: 0      1: 4px    2: 8px    3: 12px   4: 16px   5: 20px
6: 24px   8: 32px   10: 40px  12: 48px  16: 64px  20: 80px
```

### Radius
```
--r-sm:  8px       (chips, small inputs)
--r-md:  12px      (buttons, inputs)
--r-lg:  16px      (cards small)
--r-xl:  24px      (primary glass cards)
--r-2xl: 32px      (hero panels)
--r-pill: 999px    (status pills, nav active)
```

### Motion Tokens
```
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)

--dur-fast:    150ms
--dur-base:    250ms
--dur-slow:    400ms
--dur-slower:  600ms
```

---

## 3. Glassmorphism Recipe

### Base Glass Card (use everywhere as primary surface)
```css
.glass-card {
  background: var(--surface-glass);
  backdrop-filter: blur(var(--blur-glass)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--blur-glass)) saturate(150%);
  border: 1px solid var(--border-glass);
  box-shadow: 
    inset 0 1px 0 rgba(255,255,255,0.5),    /* inner top highlight */
    var(--shadow-md);
  border-radius: var(--r-xl);
}
```

### Hover State
```css
.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: 
    inset 0 1px 0 rgba(255,255,255,0.6),
    var(--shadow-lg);
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out);
}
```

### Backdrop Pattern (page bg)
- Soft animated gradient blobs (pseudo-elements positioned, blurred 80px+)
- Subtle grain texture overlay (`background-image: url(noise.svg); opacity: 0.04`)
- Reference: like Apple's product pages — ambient color blobs barely moving

---

## 4. Layout System

### App Shell (matches reference image)
```
┌─────────────────────────────────────────────────────────────┐
│ 💫 Aurora     [Executive] [Outlet] [Procurement] [Inventory] [Finance] [HR] [Admin]      🔍🔔📅 ( )  │  ← TopNav
├─────────────────────────────────────────────────────────────┤
│ ┌────┐                                                                                      │  
│ │∀  │     Sub-page nav (tabs/breadcrumb)                                                  │
│ │📤 │   ----------------------------------------------------------------------------------- │
│ │📊 │     [Page Title]                                                                      │
│ │📁 │     [Filter chips]   [Sort]   [Action button (black)]                                 │
│ │➕ │   ----------------------------------------------------------------------------------- │
│ │  │     <Glass Card>                                                                      │
│ │  │     <Glass Card>                                                                      │
│ │🌙 │     <Glass Card>                                                                      │
│ └────┘                                                                                      │
└─────────────────────────────────────────────────────────────┘
 SideRail (icons): home, share, fav, add, recent, calendar, send, theme-toggle
```

### TopNav Spec
- Height: 72px
- Logo at far left (24px icon + wordmark, hides on mobile)
- Portal switcher: horizontal pill row, **active = solid black pill with white text**, inactive = no bg, ink-secondary
- Far right: Global search icon, Notification bell (with badge), Calendar quick, User avatar dropdown
- Glass card style with `backdrop-filter`

### SideRail Spec
- Width: 64px (collapsed default), expandable on hover → 240px with labels
- Vertical icon stack:
  - `∀` Quick "Add" (most common action context-aware: in Outlet → Add Sales; in Finance → Add Journal)
  - `↑` Export
  - `☆` Favorites
  - `+` New (context)
  - `⏱` Recent activity
  - `📅` Calendar/Tasks
  - `📤` Inbox
  - `✈` Send (export to email/WA)
  - Spacer
  - `🌙` Theme toggle (bottom)
  - `☀` Light/dark mode
  - `⚠` Help/Support
- Active icon: white circle bg with ink-primary; hover: glass tint
- Tooltip on hover (right side, glass)

### Sub-Page Nav (per portal)
- Tabs row: pill-style, active = subtle aurora gradient underline + bold text
- Breadcrumb above page title: `Outlet / Sari Sudirman / Daily Sales / 2026-04-25`

### Content Area
- Max-width 1440px center; gutters 32px desktop, 16px mobile
- Page title size: H1 32/40
- Filter+action bar below title (sticky on scroll)

---

## 5. Component Catalog

### 5.1 Button

#### Primary (action) — black pill
```
background: var(--accent-black)
color: var(--ink-inverse)
padding: 12px 24px
radius: var(--r-pill)
shadow: var(--shadow-md)
hover: scale(1.02), shadow-lg
active: scale(0.98)
```

#### Secondary — glass
```
background: var(--surface-glass)
border: 1px solid var(--border-glass)
color: var(--ink-primary)
hover: surface-glass-2 + shadow-md
```

#### Ghost
```
transparent
color: var(--ink-primary)
hover: bg rgba(0,0,0,0.04)
```

#### Icon-only
```
40x40 circle, glass bg, hover ring (aurora 12% alpha)
```

### 5.2 Input
```
height: 44px
radius: var(--r-md)
bg: rgba(255,255,255,0.7)
border: 1px solid var(--border-soft)
focus: border var(--accent-aurora), ring 3px rgba(91,95,227,0.15)
placeholder: var(--ink-tertiary)
```

### 5.3 Select / Combobox
Same as input + dropdown with glass panel + animated open (scale 0.97 → 1, opacity 0 → 1, 200ms).

### 5.4 Chip / Tag
```
height: 28px
padding: 4px 12px
radius: var(--r-pill)
font: caption
```
Variants:
- Filter chip: glass bg, when active = aurora gradient bg + white text
- Status chip: colored bg with matching text (e.g., success bg-success/15 text-success)

### 5.5 KPI Card
```
Glass card
Layout:
  - Caption (label uppercase tracked)
  - Big number (Display, animated counter)
  - Delta indicator (↗ +5.2% green or ↘ -3% red)
  - Mini sparkline (12 weeks)
  - Hover: shadow-lg + cursor pointer
  - Click: drill-down
```

### 5.6 Chart Card
Glass wrapper. Header: title + period selector + export icon. Body: chart. Footer: legend + drill hint.

### 5.7 Data Table
```
Glass surface
Header: sticky, ink-secondary, sortable (caret animates)
Row: 56px height, hover bg rgba(91,95,227,0.04)
Selected: bg rgba(91,95,227,0.08)
Row click: navigate or drawer (configurable)
Pagination: bottom right, ghost buttons
Empty state: centered illustration + message + CTA
```
Features:
- Column visibility toggle
- Resize columns
- Filter row (collapsible)
- Bulk select checkbox
- Sticky first/last columns
- Inline edit (double-click)
- Export menu

### 5.8 Form (multi-step)
- Step indicator at top: numbered pills connected by line, active step bold
- Auto-save indicator: "Draft saved 3s ago" small caption ink-tertiary
- Sticky bottom bar: "Cancel | Save Draft | Continue→"
- Field validation: inline below field, danger color, icon

### 5.9 Modal
```
backdrop: rgba(15,23,42,0.4) + backdrop-filter blur 8px
panel: glass-card, max-w-2xl, slide+fade in from y-8
close: top-right ghost icon
footer: action row right-aligned
```

### 5.10 Drawer (preferred over modal for forms)
- Slide from right, 480px width (640 on detail), full height
- Animation: translateX 100% → 0%, 300ms ease-out
- Header sticky, body scroll

### 5.11 Toast / Alert
- Top-right stacked, glass card, auto-dismiss 4s for success, persist for danger until X
- Animation: slide+fade from y-2

### 5.12 Tooltip
- Glass mini card, ink-primary text, arrow, 200ms fade in delay 400ms

### 5.13 Avatar / Avatar Group
- 40px circle, gradient bg with initials if no image
- Group: overlap -8px, +N pill at end

### 5.14 Status Pill
```
draft:      gray (ink-tertiary)
submitted:  blue
validated:  aurora gradient
approved:   green
rejected:   red
locked:     dark with lock icon
posted:     filled green check
```

### 5.15 Skeleton Loader
- Shimmering gradient (aurora subtle), respects shape of incoming content
- Always show skeleton if load > 250ms

---

## 6. Dashboard Components (Advanced & Interactive)

All dashboards use this pattern. Reference image is exemplar.

### 6.1 KPI Strip (Hero)
- 5 cards horizontal, equal width
- **Animated number counter** on mount (count up from 0 in 800ms)
- Sparkline animates draw (svg stroke-dashoffset 0 → length)
- Hover → scale 1.02, shadow-glow, cursor pointer
- Click → drill-down dialog

### 6.2 4-Quadrant Grid
- Grid: 2 cols x 2 rows
- Each cell: ChartCard with specific chart type
- Charts auto-resize on container; ResizeObserver hooked

### 6.3 Chart Types & Behaviors

| Chart | Library | Features |
|---|---|---|
| **Line (multi-series)** | Recharts | Hover tooltip rich, area gradient fill, dotted projected line, click point → drill |
| **Bar (stacked horizontal)** | Recharts | Hover segment highlight, click → filter list view |
| **Donut/Pie** | Recharts | Hover slice expand 4px, center text shows hovered %, click → drill |
| **Heatmap** (Phase 6 — e.g., outlet x day sales) | Custom D3 | Cell hover tooltip, color scale legend |
| **Funnel** (PR→PO→GR→Paid) | Custom | Hover stage shows conv rate, click → list at that stage |
| **Treemap** (expense categories) | Recharts/D3 | Hover label, click → drill |
| **Sparkline** (in cards) | Custom SVG | Animate draw, end-dot pulse |

### 6.4 Chart Aesthetics
- Colors: aurora gradient primary; secondary palette: indigo/violet/teal/coral (defined in color tokens)
- Grid lines: 1px ink-tertiary @ 10% alpha, dashed
- Axis labels: caption style ink-secondary
- Hover line: aurora dashed across full chart
- Tooltip: glass card, rich content (label + value + delta + comparison if filter applied)
- Animation on enter: 600ms stagger per series

### 6.5 Drill-Down Pattern
- Always click on data point → modal/drawer with:
  - Title: "What's behind [data]"
  - Filter context summary chips
  - Either: list of underlying transactions OR sub-chart (next level)
  - "Open in [Module]" button

---

## 7. Navigation Pattern

### Primary Navigation (TopNav)
- 7 portal pills, active state black pill
- On mobile: hamburger → slide-out drawer with portal list
- Portal switching saves last-visited sub-page per portal

### Secondary Navigation (Sub-Pages)
- Tab pills below title, max 6 visible, overflow scroll horizontal on mobile
- Active tab: aurora gradient underline + bold
- Optionally segmented control (e.g., Today/Week/Month switch)

### Tertiary (in detail pages)
- Breadcrumb at top: clickable each level
- "Back" button always visible

### Mobile Adaptation
- TopNav becomes: logo + center page title + right hamburger
- SideRail becomes: bottom nav bar (5 most-used quick actions)
- All forms become single-column stack
- Tables become cards (one card per row)

---

## 8. Notification System

### Notification Bell (TopNav)
- Icon with badge:
  - Number badge if count ≤ 9, else "9+"
  - **Pulsing aurora ring** if any urgent (red category) unread
- Click → panel slide from right (480px)

### Notification Panel
- Tabs: All / Unread / Urgent / Tasks
- Each notification:
  - Left: category icon (red/amber/blue/green circle)
  - Title (bold), body (1 line clip)
  - Timestamp relative ("2 jam lalu")
  - Unread: aurora dot
  - Hover: bg tint, action menu (mark read, dismiss, snooze)
  - Click: navigate to source
- Bottom: "Mark all read" + Settings

### Toast (live notifications)
- Top-right, max 3 stacked
- Auto-dismiss success 4s, info 6s, warning 8s, danger persistent (X to close)
- Click toast → navigate
- Animation: slide from x+8, fade in

### Alert Banner (page-level, contextual)
- Top of page, full width if blocking action
- E.g., "Period April is locked. Read-only mode."
- Color-coded

### Notification Categories
| Category | Color | Examples |
|---|---|---|
| Urgent | Red `--danger` | Period close overdue, AP > 90 days, daily sales missing |
| Warning | Amber `--warning` | Low stock, approval pending > 24h |
| Info | Blue `--info` | Daily summary, system update |
| Done | Green `--success` | Approval granted, payment posted, sales validated |

---

## 9. Search System

### Global Search (Cmd+K)
- Trigger: top-nav search icon OR Cmd/Ctrl+K
- Modal: top-aligned, 720px wide, glass card
- Input: large, autofocus
- Results grouped:
  - **Quick Actions** (e.g., "Create Daily Sales", matches verbs)
  - **Items** (with category, image)
  - **Vendors**
  - **Employees**
  - **Documents** (PR/PO/PAY/JAE by doc_no)
  - **Pages** ("Profit & Loss")
  - **Recent** (last 5)
- Keyboard: arrow up/down, enter to navigate, Esc close
- Debounce 200ms; loading state inline

### List/Page Search
- Each list page has search input top-right of filter bar
- Filters by: typing matches doc_no, name, description
- Highlights match in result rows

### Filter Bar (per list page)
- Chip-based filters: "Outlet: Sari Sudirman" (X to remove), "Date: April 2026"
- "+ Add filter" button → popover with field selection
- Saved filter presets (dropdown: "My Active Vendors" etc.)
- "Clear all" link if any filter applied

### Sort
- Sort dropdown next to filters: "Date ↓", "Amount ↓", custom
- Or click table column header (caret indicator)

---

## 10. Form Patterns

### Field Types
- Text, Number, Currency (Rp prefix, comma separators), Date (Jakarta TZ), DateRange, Select, MultiSelect, Combobox (autocomplete), File (drag-drop), Image (camera + gallery), Switch, Checkbox, Radio, Textarea

### Field Layout
- Label above (caption, weight 500)
- Input full-width
- Helper text below (ink-tertiary, body-sm)
- Error: replaces helper, danger color, icon
- Required: red asterisk after label

### Smart Inputs (AI-powered)
- **ItemAutocomplete** — type 2 chars → dropdown with item name, last vendor, last price, unit
- **VendorAutocomplete** — same, with NPWP/contact preview
- **GLAccountSuggestion** — description input → AI suggests COA below

### Multi-step Form
- Step 1 of 5 — visible progress
- Save draft auto every 5s
- Each step "Continue" validates that step only
- Final step shows summary, edit pencil per section

### Form Actions
- Bottom sticky bar: Cancel (ghost) | Save Draft (secondary) | Submit (primary black)
- For destructive: confirm dialog with text-input verification ("type DELETE")

---

## 11. Empty / Loading / Error States

### Empty State
- Centered illustration (custom svg, aurora gradient)
- Heading: "No daily sales yet for today"
- Body: short helpful instruction
- CTA: primary action button

### Loading
- Skeleton always preferred over spinner
- Skeleton matches expected layout
- For dashboards: shimmer KPI cards + chart placeholders
- For tables: shimmer rows (10)
- Top loading bar (aurora gradient) for full-page loads

### Error
- Inline (per widget): card with red icon + retry button
- Full page: 500/404 illustration + back home + report bug link
- Network offline: bottom banner

### Auto-save Indicator
- Tiny text "Saving..." → "Saved 2s ago" with subtle check icon
- Position: top-right of form

---

## 12. Micro-interactions & Animations

### Page Transitions
- Route change: fade + tiny y-translate (8px), 250ms
- Sub-tab switch: cross-fade content, 200ms

### List Item Add
- New row slides in from top with subtle highlight (aurora bg fade out 800ms)

### Number Counters (KPIs)
- Tween from 0 to value over 800ms with ease-out
- Format on the fly (Rp formatting)

### Button Press
- scale(0.98) on active for 100ms
- Ripple effect on primary button (subtle, 300ms)

### Hover Card Lift
- translateY(-2px) + shadow grow, 250ms

### Modal/Drawer Open
- Backdrop fade 200ms
- Panel slide+scale (0.97 → 1) + fade 300ms cubic-bezier(0.16, 1, 0.3, 1)

### Notification Toast
- Slide-in from right + bounce subtle (spring)
- Dismiss: slide-out + fade 200ms

### Chart Hover
- Vertical guide line: fade in 100ms
- Tooltip: scale-fade 150ms

### Loading Bar (top of page on route)
- Aurora gradient, indeterminate progress, fades out when done

### Theme Toggle
- Icon morph (sun → moon) 400ms
- Page bg cross-fade 600ms (avoid jarring)

---

## 13. Accessibility

- All interactive elements: minimum 44px touch target
- Focus ring: aurora 3px outline, offset 2px
- Color contrast: WCAG AA (text on glass min 4.5:1 — verify with tool)
- Semantic HTML: nav, main, aside, section
- ARIA labels on icon-only buttons
- Keyboard: every action reachable, no traps
- Screen reader: live regions for toasts, loading states announced
- Reduce motion: respect `prefers-reduced-motion: reduce`

---

## 14. Responsive Breakpoints

```
xs: 0–640    (mobile portrait)
sm: 641–768  (mobile landscape, small tablet)
md: 769–1024 (tablet)
lg: 1025–1280 (laptop)
xl: 1281+    (desktop)
```

### Mobile Behaviors
- TopNav: collapse to hamburger
- SideRail: become bottom nav (5 actions)
- Tables: convert to cards
- 4-quadrant dashboard: stack 1 column
- Forms: single column
- Drawer: full screen
- Modal: full screen sheet

---

## 15. Iconography

- Library: **lucide-react**
- Size standard: 16, 20, 24px
- Stroke width: 1.5
- Color: inherit from text by default
- Special: portal switcher icons subtly different per portal (gives instant recognition)

---

## 16. Brand Voice in UI Copy

- Friendly, professional, never patronizing
- Use "Anda" (formal Indonesian) for outlet/finance
- Use Title Case for buttons ("Kirim Penjualan")
- Concise: error 1 sentence, action 2-3 words
- Examples:
  - ✅ "Penjualan berhasil disimpan. Tim Finance akan validasi."
  - ❌ "Terdapat ketidakcocokan total payment dengan grand total."
  - ⚠ "Stok susu UHT mendekati batas minimum (5 unit). Mau buat PR?"

---

## 17. Print / PDF Templates

- Document templates (PR/PO/KB/Receipt) use **printable** stylesheet (no glass effects)
- Header: logo + group name + doc title + doc no
- Footer: page number + signature blocks
- Pure white bg, sans-serif (Inter), table format for line items
- Generate via `jsPDF` + `html2canvas` from a hidden printable div

---

## 18. Onboarding & Tours

- First login: short tour overlay (5 steps max) per portal
- Step: highlighted element + tooltip with arrow + Next/Skip
- Replayable from user menu → Help → Show Tour

---

## 19. Component Library Map (Dev Reference)

| Logical | Implementation | File |
|---|---|---|
| AppShell | shadcn + custom | `components/layout/AppShell.jsx` |
| TopNav | custom | `components/layout/TopNav.jsx` |
| SideRail | custom | `components/layout/SideRail.jsx` |
| GlassCard | tailwind utility | `styles/glassmorphism.css` (.glass-card) |
| Button | shadcn Button + variant | `components/ui/button.jsx` |
| Input | shadcn Input | `components/ui/input.jsx` |
| Combobox | shadcn Command | `components/ui/command.jsx` |
| Modal | shadcn Dialog | `components/ui/dialog.jsx` |
| Drawer | shadcn Sheet | `components/ui/sheet.jsx` |
| Toast | shadcn Sonner / Toast | `components/ui/sonner.jsx` |
| Tooltip | shadcn Tooltip | `components/ui/tooltip.jsx` |
| Chart | Recharts | `components/shared/ChartCard.jsx` |
| DataTable | TanStack Table | `components/shared/DataTable.jsx` |
| KpiCard | custom | `components/shared/KpiCard.jsx` |
| GlobalSearch | shadcn Command + custom | `components/shared/GlobalSearch.jsx` |
| NotificationCenter | custom Sheet | `components/shared/NotificationCenter.jsx` |
| Form | React Hook Form + Zod | various |
| Animation | Framer Motion | various |

---

## 20. Design Adherence Checklist (per page)

Before any page is marked DONE:

- [ ] All cards use `.glass-card` style or documented exception
- [ ] Primary CTA is **black pill**
- [ ] Active nav state is **black pill** (top) or **filled circle** (rail)
- [ ] All numbers Rupiah-formatted with thousands separator
- [ ] All dates DD MMM YYYY (Jakarta)
- [ ] Empty/Loading/Error states all designed
- [ ] Hover states visible on all interactive elements
- [ ] Focus ring visible on tab navigation
- [ ] Mobile layout tested (≤ 768)
- [ ] Skeleton matches content shape
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Charts: hover tooltip rich, click drills, animation on enter
- [ ] Form: auto-save indicator, sticky action bar, multi-step indicator if > 5 fields
