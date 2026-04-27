{
  "meta": {
    "product": "Aurora F&B ERP — Admin Portal",
    "phase": "7A — Self-Service Configuration UI",
    "locale": "id-ID",
    "tech": {
      "frontend": ["React (JS)", "Tailwind", "shadcn/ui", "Framer Motion", "lucide-react"],
      "backend": ["FastAPI", "MongoDB"],
      "data_shape": "business_rules: {scope_type, scope_id, rule_type, rule_data, active, version, effective_from, effective_to}"
    },
    "non_negotiables": [
      "Keep existing Aurora glassmorphism + grad-aurora / grad-aurora-soft classes",
      "Keep admin subnav pill animation: motion.div layoutId=admin-subnav-pill",
      "No new palette; keep status colors mapping",
      "All interactive + key info elements must include data-testid (kebab-case)"
    ]
  },

  "information_architecture": {
    "route": "/admin/configuration",
    "subnav_pattern": {
      "placement": "Inside AdminPortal header area, same as existing SubNav (horizontal scroll pill tabs)",
      "behavior": [
        "Use same Link + motion.div layoutId='admin-subnav-pill' for active tab",
        "Tabs are horizontally scrollable on smaller widths; keep -mx-2 px-2 pattern",
        "Each tab label in Bahasa; short + scannable"
      ],
      "tabs": [
        {
          "path": "sales-schemas",
          "label": "Skema Penjualan",
          "description": "Channel, metode bayar, bucket revenue, validasi"
        },
        {
          "path": "petty-cash-policies",
          "label": "Kebijakan Kas Kecil",
          "description": "Limit, approval threshold, akun GL"
        },
        {
          "path": "service-charge-policies",
          "label": "Service Charge",
          "description": "Formula %, potongan L&B/L&D, alokasi"
        },
        {
          "path": "incentive-schemes",
          "label": "Skema Insentif",
          "description": "Rule builder target + tier"
        },
        {
          "path": "effective-dating",
          "label": "Versi & Jadwal",
          "description": "Timeline effective_from/to per scope"
        }
      ],
      "top_scope_picker": {
        "placement": "Sticky row under page title, above list/table",
        "controls": [
          "ScopeType segmented control: Group / Brand / Outlet",
          "ScopeId selector: searchable select (brand/outlet list)",
          "Quick chips: 'Semua Outlet' (if supported), 'Favorit' (optional)"
        ],
        "notes": [
          "Scope picker is shared across all 4 editors + effective dating page",
          "Persist selection in URL query (?scope_type=brand&scope_id=xxx) for shareability"
        ]
      }
    },
    "page_header": {
      "pattern": "Icon square (h-10 w-10 rounded-xl grad-aurora) + H1 + helper text (text-sm muted)",
      "actions": [
        "Primary: 'Buat Aturan' / 'Tambah Skema' (pill-active rounded-full)",
        "Secondary: 'Import/Export' (outline rounded-full) — optional Phase 7B",
        "Tertiary: 'Lihat Workflow Approval' deep-link to /admin/workflows (ghost)"
      ]
    }
  },

  "list_view_layout_pattern": {
    "goal": "Reusable list + version awareness across all rule types; optimized for non-technical power users.",
    "layout": {
      "grid": "Desktop: 12-col container (max-w-7xl mx-auto). Content uses 8/4 split when history panel is visible.",
      "structure": [
        "Row 1: Page header + actions",
        "Row 2 (sticky): Scope picker + search/filter",
        "Row 3: Main content area: left list/table + right 'Riwayat Aturan' panel (collapsible)"
      ],
      "main_left": {
        "default": "Table-first for dense admin data; card-group for grouped-by-scope",
        "recommended": "Use shadcn Table for list; each row opens editor drawer/dialog"
      },
      "right_panel": {
        "type": "glass-card",
        "title": "Riwayat Aturan",
        "content": [
          "Version list (latest first) with StatusPill + effective range",
          "Quick actions: 'Bandingkan' (optional), 'Duplikasi', 'Jadwalkan'",
          "Mini timeline sparkline (optional)"
        ],
        "behavior": [
          "Hidden on <lg; becomes a Sheet/Drawer triggered by 'Riwayat' button",
          "On desktop: sticky top offset under scope picker"
        ]
      }
    },
    "filters": {
      "controls": [
        "Search input (glass-input) placeholder: 'Cari nama / channel / metode bayar…'",
        "Status filter (Select): Aktif / Draft / Diarsipkan",
        "Date filter (Popover + Calendar): 'Berlaku pada tanggal…'",
        "Sort (Dropdown): Terbaru, Nama A–Z, Effective date"
      ],
      "microcopy": "Filter membantu menemukan versi yang sedang berlaku untuk outlet tertentu."
    },
    "row_design": {
      "primary_text": "Rule name / label",
      "secondary": "Scope badge + version chip (mono) + effective range",
      "right_actions": [
        "Edit (icon button)",
        "Duplikasi",
        "Arsipkan",
        "Aktifkan (if draft)"
      ],
      "states": {
        "active": "StatusPill status-active",
        "draft": "StatusPill status-draft",
        "archived": "StatusPill status-disabled + line-through label"
      }
    },
    "recommended_shadcn_components": {
      "table": "/app/frontend/src/components/ui/table.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "popover": "/app/frontend/src/components/ui/popover.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "button": "/app/frontend/src/components/ui/button.jsx",
      "sheet_or_drawer": [
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/drawer.jsx"
      ],
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx"
    }
  },

  "editor_dialog_drawer_pattern": {
    "decision": {
      "desktop": "Use Dialog for quick edits (<= 2 sections) and Sheet for complex builders (sales schema + incentive tier).",
      "mobile": "Prefer Drawer/Sheet full-height; avoid cramped Dialog."
    },
    "shell": {
      "container_class": "glass-card",
      "max_height": "max-h-[88vh] overflow-y-auto",
      "header": {
        "title": "Buat / Edit <RuleType>",
        "description": "Jelaskan dampak aturan + kapan berlaku",
        "right_meta": [
          "Version chip: v{version}",
          "StatusPill",
          "Scope summary: 'Brand: Aurora Coffee'"
        ]
      },
      "footer": {
        "left": [
          "Secondary: 'Batal'",
          "Ghost: 'Reset Perubahan' (optional)"
        ],
        "right": [
          "Outline: 'Simpan Draft'",
          "Primary pill-active: 'Simpan & Jadwalkan'"
        ],
        "optimistic_ui": [
          "On save: disable buttons, show inline spinner",
          "On success: toast.success + update list immediately (optimistic), then reconcile",
          "On error: toast.error + keep dialog open"
        ]
      }
    },
    "form_structure": {
      "layout": "Two-column on lg: left form (7/12) + right live preview (5/12). On md and below: stacked.",
      "sections": [
        {
          "id": "scope",
          "title": "Scope",
          "fields": ["scope_type", "scope_id"],
          "notes": "Scope biasanya mengikuti scope picker halaman; di dialog hanya tampil sebagai ringkasan + tombol 'Ubah' jika user punya izin."
        },
        {
          "id": "effective",
          "title": "Periode Berlaku",
          "fields": ["effective_from", "effective_to"],
          "ui": [
            "DateRange: Popover + Calendar (range) OR two date inputs",
            "Helper: 'Kosongkan effective_to untuk berlaku tanpa batas'"
          ]
        },
        {
          "id": "rule_data",
          "title": "Konfigurasi",
          "fields": "Rule-type specific",
          "ui": "Builder components (chips, sliders, tables)"
        },
        {
          "id": "validation",
          "title": "Validasi",
          "ui": [
            "Inline errors under fields (text-xs text-destructive)",
            "Top summary alert if multiple errors"
          ]
        }
      ],
      "live_preview": {
        "pattern": "Right panel glass-card with subtle grad-border; shows human-readable summary",
        "content": [
          "Preview title: 'Preview Aturan'",
          "Bulleted explanation in Bahasa",
          "Example calculation (service charge / incentive)",
          "Warnings: if overlaps with existing effective range"
        ]
      }
    },
    "micro_interactions": [
      "Dialog open within 300ms: precompute derived preview text before open; lazy-load heavy lists (GL accounts) after open",
      "Hover on icon buttons: hover:bg-foreground/5; destructive hover:bg-destructive/10",
      "Drag handles appear on hover for reorder lists",
      "Use Framer Motion for subtle section expand/collapse (height + opacity), respect prefers-reduced-motion"
    ]
  },

  "editor_type_patterns": {
    "sales_input_schema_editor": {
      "purpose": "Outlet-specific schema for Daily Sales input: channels, payment methods, revenue buckets, validation rules.",
      "layout": "Sheet (right) with 3 builder blocks + preview of Daily Sales form fields.",
      "builder_blocks": [
        {
          "id": "channels",
          "title": "Channel Penjualan",
          "ui": [
            "Reorderable list with drag handle",
            "Each item as chip-row: name + code + active toggle",
            "Quick add input + 'Tambah' button"
          ],
          "chip_style": {
            "class": "inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-foreground/[0.03] border border-border/50",
            "active_dot": "h-2 w-2 rounded-full bg-emerald-500/70",
            "inactive_dot": "h-2 w-2 rounded-full bg-zinc-400/60"
          },
          "empty": "Belum ada channel. Tambahkan 'Dine-in' atau 'GoFood'."
        },
        {
          "id": "payment_methods",
          "title": "Metode Pembayaran",
          "ui": [
            "ToggleGroup for common methods (Cash, Debit, Credit, QRIS) + 'Lainnya'",
            "Advanced: per-method fee % (optional)"
          ]
        },
        {
          "id": "revenue_buckets",
          "title": "Bucket Pendapatan",
          "ui": [
            "Small table: Bucket name | GL mapping (Select) | Required (Switch)",
            "Add row button"
          ]
        },
        {
          "id": "validation_rules",
          "title": "Aturan Validasi",
          "ui": [
            "Accordion of rules (e.g., 'Total pembayaran harus = total penjualan')",
            "Each rule: Switch enable + severity Select (warning/error)",
            "Inline preview of error message"
          ]
        }
      ],
      "recommended_components": {
        "sheet": "/app/frontend/src/components/ui/sheet.jsx",
        "toggle_group": "/app/frontend/src/components/ui/toggle-group.jsx",
        "switch": "/app/frontend/src/components/ui/switch.jsx",
        "accordion": "/app/frontend/src/components/ui/accordion.jsx",
        "table": "/app/frontend/src/components/ui/table.jsx",
        "select": "/app/frontend/src/components/ui/select.jsx",
        "input": "/app/frontend/src/components/ui/input.jsx",
        "button": "/app/frontend/src/components/ui/button.jsx"
      },
      "drag_and_drop": {
        "library": "Use native HTML5 drag events or lightweight dnd-kit (preferred) if already allowed; keep performance snappy.",
        "guidance": [
          "Drag handle icon (GripVertical from lucide-react)",
          "Drop indicator: thin grad-aurora line between rows",
          "On drop: toast.success('Urutan diperbarui') (optional)"
        ]
      }
    },

    "petty_cash_policy_editor": {
      "purpose": "Define petty cash limits, max per transaction, replenish frequency, approval threshold, valid GL accounts.",
      "layout": "Dialog (max-w-3xl) with numeric controls + sliders + GL list.",
      "visual_controls": {
        "threshold_sliders": [
          {
            "field": "max_per_txn",
            "label": "Maksimal per Transaksi",
            "component": "Slider",
            "display": "Show formatted Rp value (tabular-nums) to the right"
          },
          {
            "field": "approval_threshold",
            "label": "Butuh Approval Jika >",
            "component": "Slider",
            "display": "Show Status hint: 'Di atas ini akan masuk workflow approval'"
          }
        ],
        "limits": [
          "Monthly limit (Input number)",
          "Replenish frequency (Select): Harian / Mingguan / Bulanan / Manual"
        ],
        "gl_accounts": {
          "pattern": "Command (search) + Checkbox list inside ScrollArea",
          "chips": "Selected accounts appear as removable badges"
        }
      },
      "recommended_components": {
        "slider": "/app/frontend/src/components/ui/slider.jsx",
        "command": "/app/frontend/src/components/ui/command.jsx",
        "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
        "checkbox": "/app/frontend/src/components/ui/checkbox.jsx",
        "badge": "/app/frontend/src/components/ui/badge.jsx",
        "dialog": "/app/frontend/src/components/ui/dialog.jsx"
      },
      "preview": {
        "content": [
          "Summary card: 'Kas kecil: limit Rp X/bulan'",
          "Callout: 'Transaksi > Rp Y perlu approval'",
          "List: GL accounts allowed (first 5 + '+n lainnya')"
        ]
      }
    },

    "service_charge_formula_editor": {
      "purpose": "Configure service charge %, L&B/L&D deductions, allocation method, default working days.",
      "layout": "Dialog (max-w-4xl) with formula builder + live calculation preview.",
      "formula_ui": {
        "inputs": [
          "service_charge_pct (Input + Slider optional)",
          "lb_deduction_pct (Input)",
          "ld_deduction_pct (Input)",
          "allocation_method (RadioGroup): by-days-worked / equal / by-role-multiplier",
          "default_working_days (Input number, default 22)"
        ],
        "live_preview": {
          "pattern": "Right preview panel shows equation + example numbers",
          "example_block": [
            "Penjualan: Rp 100.000.000",
            "SC: 5% = Rp 5.000.000",
            "Potongan L&B 1% + L&D 0.5%",
            "Net pool + allocation explanation"
          ],
          "visual": "Use monospace equation chip rows with subtle bg-foreground/[0.03]"
        }
      },
      "recommended_components": {
        "radio_group": "/app/frontend/src/components/ui/radio-group.jsx",
        "separator": "/app/frontend/src/components/ui/separator.jsx",
        "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
        "progress": "/app/frontend/src/components/ui/progress.jsx"
      },
      "micro_interactions": [
        "As user types %, animate preview number change with small spring (Framer Motion)",
        "Show warning badge if total deductions exceed service charge %"
      ]
    },

    "incentive_scheme_builder": {
      "purpose": "Build incentive rules: pct_of_sales / flat_per_target / tiered_sales with eligibility + date range.",
      "layout": "Sheet (right) with stepper-like sections; tier table for tiered_sales.",
      "sections": [
        {
          "id": "rule_type",
          "ui": "Tabs or RadioGroup with 3 options; each shows contextual fields"
        },
        {
          "id": "target",
          "ui": [
            "Target amount (Rp) input",
            "Valid date range (effective_from/to already covers scheduling; this is eligibility window if needed)"
          ]
        },
        {
          "id": "eligibility",
          "ui": [
            "Role/department multi-select (Command)",
            "Minimum days worked (Input)",
            "Exclude probation (Switch)"
          ]
        },
        {
          "id": "tier_table",
          "when": "rule_type=tiered_sales",
          "ui": [
            "Editable table: Min sales | Max sales | Incentive (Rp or %) | Notes",
            "Row add/remove",
            "Auto-validate contiguous ranges"
          ]
        }
      ],
      "tier_table_visual": {
        "table": "shadcn Table with sticky header",
        "row_state": [
          "Valid row: subtle bg",
          "Invalid overlap: bg-destructive/10 + inline error"
        ]
      },
      "recommended_components": {
        "tabs": "/app/frontend/src/components/ui/tabs.jsx",
        "table": "/app/frontend/src/components/ui/table.jsx",
        "textarea": "/app/frontend/src/components/ui/textarea.jsx",
        "collapsible": "/app/frontend/src/components/ui/collapsible.jsx"
      },
      "preview": {
        "content": [
          "Human-readable rule summary",
          "Example payout for 3 sales scenarios",
          "Eligibility checklist"
        ]
      }
    }
  },

  "effective_dating_timeline": {
    "purpose": "Show versions per scope and rule_type; allow scheduling future changes and detecting overlaps.",
    "layout": {
      "top": [
        "Scope picker",
        "Rule type filter chips (Skema Penjualan / Kas Kecil / Service Charge / Insentif)",
        "Date cursor: 'Lihat tanggal' (Calendar)"
      ],
      "main": "Timeline list grouped by rule_type; each group shows horizontal time bars for versions.",
      "right": "Details panel: selected version summary + actions"
    },
    "timeline_visual": {
      "axis": "Monthly ticks; show 'Hari ini' vertical line",
      "bars": {
        "active": "grad-aurora-soft border grad-border",
        "draft": "bg-muted border-border/60",
        "archived": "bg-zinc-200/60 dark:bg-zinc-800/40"
      },
      "overlap_detection": "If two bars overlap for same scope+rule_type, show red outline + tooltip 'Periode bentrok'"
    },
    "interaction": [
      "Click bar selects version and opens side panel",
      "Drag edges to adjust effective_from/to (optional later); for now use edit dialog",
      "Keyboard: arrow keys move selection between bars; Enter opens edit"
    ],
    "recommended_components": {
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "popover_calendar": [
        "/app/frontend/src/components/ui/popover.jsx",
        "/app/frontend/src/components/ui/calendar.jsx"
      ]
    },
    "implementation_note": "Keep timeline rendering lightweight: virtualize long lists (optional). Use CSS grid for axis + bars; avoid heavy chart libs unless needed."
  },

  "empty_loading_error_states": {
    "empty": {
      "pattern": "Use existing shared EmptyState component (as in ApprovalWorkflows) inside glass-card",
      "copy_examples": {
        "sales": {
          "title": "Belum ada skema penjualan",
          "description": "Buat skema untuk mengatur channel, metode bayar, dan bucket pendapatan per outlet."
        },
        "petty_cash": {
          "title": "Belum ada kebijakan kas kecil",
          "description": "Atur limit dan threshold approval agar transaksi kas kecil konsisten."
        },
        "service_charge": {
          "title": "Belum ada aturan service charge",
          "description": "Tentukan % service charge dan metode alokasi untuk payroll."
        },
        "incentive": {
          "title": "Belum ada skema insentif",
          "description": "Buat skema untuk target penjualan dan perhitungan insentif."
        }
      },
      "cta": "Primary pill-active: 'Buat Aturan'"
    },
    "loading": {
      "pattern": "Use shared LoadingState rows + skeleton utility; keep layout stable",
      "skeletons": [
        "Header skeleton: 2 lines",
        "Table skeleton: 6–10 rows",
        "Right panel skeleton: 3 cards"
      ]
    },
    "error": {
      "pattern": "Inline Alert (shadcn Alert) with retry button",
      "copy": {
        "title": "Gagal memuat data",
        "description": "Periksa koneksi atau coba lagi. Jika berulang, hubungi admin sistem."
      },
      "actions": [
        "Button outline: 'Coba Lagi'",
        "Link ghost: 'Lihat Audit Log' (optional)"
      ]
    }
  },

  "test_id_conventions": {
    "rules": [
      "kebab-case only",
      "Prefer role-based naming (what it does), not appearance",
      "Include identifiers at the end when needed (rule id, index)",
      "Apply to: buttons, links, inputs, selects, tabs, timeline bars, status text, error messages"
    ],
    "page_level": {
      "configuration_root": "admin-configuration-page",
      "scope_picker": {
        "scope-type": "config-scope-type-toggle",
        "scope-id": "config-scope-id-select",
        "scope-summary": "config-scope-summary"
      },
      "list": {
        "search": "config-list-search-input",
        "status-filter": "config-list-status-filter",
        "create": "config-create-rule-button",
        "row": "config-rule-row-{rule-id}",
        "edit": "config-rule-edit-{rule-id}",
        "duplicate": "config-rule-duplicate-{rule-id}",
        "archive": "config-rule-archive-{rule-id}"
      },
      "editor": {
        "dialog": "config-editor-dialog",
        "save-draft": "config-editor-save-draft-button",
        "save-schedule": "config-editor-save-schedule-button",
        "effective-from": "config-editor-effective-from-input",
        "effective-to": "config-editor-effective-to-input",
        "preview": "config-editor-preview-panel"
      },
      "timeline": {
        "page": "config-effective-dating-page",
        "rule-type-filter": "config-timeline-rule-type-filter",
        "bar": "config-timeline-version-bar-{rule-id}",
        "today-marker": "config-timeline-today-marker",
        "overlap-warning": "config-timeline-overlap-warning"
      }
    }
  },

  "typography": {
    "fonts": {
      "current": "Inter (already set in index.css)",
      "guidance": "Do not change global font to keep consistency across portals. Use font-mono for version chips/equations only."
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl (only for marketing pages; admin uses smaller)",
      "admin_h1": "text-2xl lg:text-3xl font-bold tracking-tight (matches AdminPortal)",
      "h2": "text-base md:text-lg font-semibold",
      "body": "text-sm md:text-base",
      "meta": "text-xs text-muted-foreground",
      "numbers": "tabular-nums for currency/percent"
    }
  },

  "color_and_tokens": {
    "use_existing": true,
    "notes": [
      "Keep grad-aurora and grad-aurora-soft usage limited to accents (pill background, icon squares, thin borders).",
      "Do not introduce new gradients beyond existing aurora tokens.",
      "Status colors: green=active, gray=inactive, amber=draft, red=archived (map to existing StatusPill)."
    ],
    "component_tokens": {
      "surfaces": {
        "page_bg": "linear-gradient(160deg, canvas-1 -> canvas-2) (already in index.css)",
        "card": "glass-card",
        "input": "glass-input"
      },
      "borders": {
        "default": "border-border/50",
        "accent": "grad-border"
      }
    }
  },

  "motion": {
    "principles": [
      "Use Framer Motion for nav pill + subtle panel transitions",
      "No universal transition: never transition: all",
      "Respect prefers-reduced-motion"
    ],
    "recommended": {
      "subnav": "layoutId='admin-subnav-pill' spring duration 0.4",
      "drawer_open": "opacity 0->1 + x 12->0 (200–260ms)",
      "list_row_hover": "translateY(-1px) only on glass-card-hover cards; tables use bg change only"
    }
  },

  "accessibility": {
    "requirements": [
      "All inputs have Label + aria-label when label is visually hidden",
      "ESC closes Dialog/Sheet",
      "Tab order: scope picker -> filters -> list -> actions -> history panel",
      "Focus-visible ring uses existing :focus-visible styles",
      "Color contrast: ensure muted text still readable on glass surfaces"
    ]
  },

  "performance": {
    "targets": [
      "Dialog open <= 300ms",
      "Optimistic UI on save",
      "Avoid rendering huge option lists until needed"
    ],
    "tactics": [
      "Memoize derived preview text",
      "Use ScrollArea for long lists",
      "Debounce search input (150–250ms)",
      "Prefer lightweight timeline (CSS grid) over chart libs"
    ]
  },

  "image_urls": {
    "note": "Admin portal does not require stock imagery. Keep UI icon-driven. If needed for empty states, use lucide icons only.",
    "items": []
  },

  "component_path": {
    "shadcn_ui": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "popover": "/app/frontend/src/components/ui/popover.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "slider": "/app/frontend/src/components/ui/slider.jsx",
      "accordion": "/app/frontend/src/components/ui/accordion.jsx",
      "command": "/app/frontend/src/components/ui/command.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "alert": "/app/frontend/src/components/ui/alert.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
      "sonner": "/app/frontend/src/components/ui/sonner.jsx"
    },
    "shared_components_reference": {
      "status_pill": "/app/frontend/src/components/shared/StatusPill",
      "empty_state": "/app/frontend/src/components/shared/EmptyState",
      "loading_state": "/app/frontend/src/components/shared/LoadingState"
    },
    "admin_reference_pages": {
      "admin_portal": "/app/frontend/src/portals/admin/AdminPortal.jsx",
      "approval_workflows": "/app/frontend/src/portals/admin/ApprovalWorkflows.jsx"
    }
  },

  "instructions_to_main_agent": [
    "Add new Admin sub-route '/admin/configuration' and extend AdminPortal SUB_ROUTES with a new tab 'Configuration' (Konfigurasi) OR add nested subnav inside configuration page using same pill pattern.",
    "Implement shared ScopePicker component used across all configuration subpages; persist in URL query.",
    "Implement reusable RuleListLayout: header + filters + table + right history panel (Sheet on small screens).",
    "For editors: use Sheet for Sales Schema + Incentive Scheme; Dialog for Petty Cash + Service Charge.",
    "Ensure every interactive element and key info text has data-testid per conventions.",
    "Keep Indonesian microcopy consistent with existing Admin pages.",
    "Do not change global tokens/palette; reuse glass-card, glass-input, grad-aurora-soft, pill-active.",
    "Timeline page: implement lightweight CSS-grid timeline with selectable bars; show overlap warnings."
  ],

  "general_ui_ux_design_guidelines_appendix": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
