"""Master list of permission codes used by RBAC.
Syncronize with /app/memory/RBAC_MATRIX.md.
"""
PERMISSIONS_CATALOG: list[dict] = [
    # Special
    {"code": "*", "category": "Special", "label": "Super (everything)"},

    # Outlet
    {"code": "outlet.daily_sales.read", "category": "Outlet", "label": "Read daily sales"},
    {"code": "outlet.daily_sales.create", "category": "Outlet", "label": "Create daily sales"},
    {"code": "outlet.daily_sales.submit", "category": "Outlet", "label": "Submit daily sales"},
    {"code": "outlet.daily_sales.update", "category": "Outlet", "label": "Update daily sales draft"},
    {"code": "outlet.petty_cash.read", "category": "Outlet", "label": "Read petty cash"},
    {"code": "outlet.petty_cash.create", "category": "Outlet", "label": "Create petty cash txn"},
    {"code": "outlet.petty_cash.replenish_request", "category": "Outlet", "label": "Replenish request"},
    {"code": "outlet.urgent_purchase.create", "category": "Outlet", "label": "Urgent purchase"},
    {"code": "outlet.kdo.create", "category": "Outlet", "label": "KDO request"},
    {"code": "outlet.bdo.create", "category": "Outlet", "label": "BDO request"},
    {"code": "outlet.daily_close.execute", "category": "Outlet", "label": "Daily close"},
    {"code": "outlet.opname.execute", "category": "Outlet", "label": "Stock opname"},

    # Procurement
    {"code": "procurement.pr.read", "category": "Procurement", "label": "Read PR"},
    {"code": "procurement.pr.create", "category": "Procurement", "label": "Create PR"},
    {"code": "procurement.pr.approve", "category": "Procurement", "label": "Approve PR"},
    {"code": "procurement.pr.reject", "category": "Procurement", "label": "Reject PR"},
    {"code": "procurement.pr.consolidate", "category": "Procurement", "label": "Consolidate PRs"},
    {"code": "procurement.po.create", "category": "Procurement", "label": "Create PO"},
    {"code": "procurement.po.send", "category": "Procurement", "label": "Send PO"},
    {"code": "procurement.po.approve", "category": "Procurement", "label": "Approve PO"},
    {"code": "procurement.po.cancel", "category": "Procurement", "label": "Cancel PO"},
    {"code": "procurement.gr.create", "category": "Procurement", "label": "Create GR"},
    {"code": "procurement.gr.post", "category": "Procurement", "label": "Post GR"},
    {"code": "procurement.vendor.read", "category": "Procurement", "label": "Read vendor"},
    {"code": "procurement.vendor.scorecard", "category": "Procurement", "label": "Vendor scorecard"},

    # Inventory
    {"code": "inventory.balance.read", "category": "Inventory", "label": "Read stock balance"},
    {"code": "inventory.movement.read", "category": "Inventory", "label": "Read movements"},
    {"code": "inventory.transfer.create", "category": "Inventory", "label": "Create transfer"},
    {"code": "inventory.transfer.send", "category": "Inventory", "label": "Send transfer"},
    {"code": "inventory.transfer.receive", "category": "Inventory", "label": "Receive transfer"},
    {"code": "inventory.adjustment.create", "category": "Inventory", "label": "Create adjustment"},
    {"code": "inventory.adjustment.approve", "category": "Inventory", "label": "Approve adjustment"},
    {"code": "inventory.opname.start", "category": "Inventory", "label": "Start opname"},
    {"code": "inventory.opname.submit", "category": "Inventory", "label": "Submit opname"},
    {"code": "inventory.opname.approve", "category": "Inventory", "label": "Approve opname"},
    {"code": "inventory.valuation.read", "category": "Inventory", "label": "Read valuation"},

    # Finance
    {"code": "finance.sales.validate", "category": "Finance", "label": "Validate sales"},
    {"code": "finance.sales.request_fix", "category": "Finance", "label": "Request fix"},
    {"code": "finance.ap.read", "category": "Finance", "label": "Read AP"},
    {"code": "finance.payment.create", "category": "Finance", "label": "Create payment"},
    {"code": "finance.payment.approve", "category": "Finance", "label": "Approve payment"},
    {"code": "finance.payment.mark_paid", "category": "Finance", "label": "Mark paid"},
    {"code": "finance.journal_entry.read", "category": "Finance", "label": "Read journals"},
    {"code": "finance.journal_entry.create", "category": "Finance", "label": "Create journal"},
    {"code": "finance.journal_entry.post", "category": "Finance", "label": "Post journal"},
    {"code": "finance.journal_entry.reverse", "category": "Finance", "label": "Reverse journal"},
    {"code": "finance.tax.manage", "category": "Finance", "label": "Manage tax"},
    {"code": "finance.period.close_step", "category": "Finance", "label": "Period close step"},
    {"code": "finance.period.lock", "category": "Finance", "label": "Lock period"},
    {"code": "finance.period.unlock", "category": "Finance", "label": "Unlock period"},
    {"code": "finance.period.write_to_locked", "category": "Finance", "label": "Write to locked period"},
    {"code": "finance.report.profit_loss", "category": "Finance", "label": "PL report"},
    {"code": "finance.report.balance_sheet", "category": "Finance", "label": "BS report"},
    {"code": "finance.report.cashflow", "category": "Finance", "label": "Cashflow report"},
    {"code": "finance.bank_reconciliation", "category": "Finance", "label": "Bank reconciliation"},

    # HR
    {"code": "hr.advance.read", "category": "HR", "label": "Read advances"},
    {"code": "hr.advance.create", "category": "HR", "label": "Create advance"},
    {"code": "hr.advance.approve", "category": "HR", "label": "Approve advance"},
    {"code": "hr.service_charge.calculate", "category": "HR", "label": "Calculate service"},
    {"code": "hr.service_charge.post", "category": "HR", "label": "Post service"},
    {"code": "hr.incentive.calculate", "category": "HR", "label": "Calculate incentive"},
    {"code": "hr.incentive.approve", "category": "HR", "label": "Approve incentive"},
    {"code": "hr.voucher.issue", "category": "HR", "label": "Issue voucher"},
    {"code": "hr.voucher.redeem", "category": "HR", "label": "Redeem voucher"},
    {"code": "hr.foc.create", "category": "HR", "label": "Create FOC"},
    {"code": "hr.travel_incentive.manage", "category": "HR", "label": "Manage travel incentive"},
    {"code": "hr.lb_fund.read", "category": "HR", "label": "Read LB fund"},
    {"code": "hr.lb_fund.use", "category": "HR", "label": "Use LB fund"},

    # Admin
    {"code": "admin.user.read", "category": "Admin", "label": "Read users"},
    {"code": "admin.user.create", "category": "Admin", "label": "Create users"},
    {"code": "admin.user.update", "category": "Admin", "label": "Update users"},
    {"code": "admin.user.disable", "category": "Admin", "label": "Disable users"},
    {"code": "admin.user.reset_password", "category": "Admin", "label": "Reset password"},
    {"code": "admin.user.impersonate", "category": "Admin", "label": "Impersonate user"},
    {"code": "admin.role.manage", "category": "Admin", "label": "Manage roles"},
    {"code": "admin.master_data.manage", "category": "Admin", "label": "Manage master data"},
    {"code": "admin.master_data.bulk_import", "category": "Admin", "label": "Bulk import"},
    {"code": "admin.business_rules.manage", "category": "Admin", "label": "Business rules"},
    {"code": "admin.workflow.manage", "category": "Admin", "label": "Workflows"},
    {"code": "admin.number_series.manage", "category": "Admin", "label": "Number series"},
    {"code": "admin.audit_log.read", "category": "Admin", "label": "Audit log read"},
    {"code": "admin.audit_log.export", "category": "Admin", "label": "Audit log export"},
    {"code": "admin.system_settings.manage", "category": "Admin", "label": "System settings"},

    # Executive
    {"code": "executive.dashboard.read", "category": "Executive", "label": "Dashboard read"},
    {"code": "executive.drilldown.read", "category": "Executive", "label": "Drilldown"},
    {"code": "executive.export", "category": "Executive", "label": "Export dashboard"},
    {"code": "executive.dashboard_view.save", "category": "Executive", "label": "Save view"},

    # AI
    {"code": "ai.chat.use", "category": "AI", "label": "Use AI chat"},
    {"code": "ai.autocomplete.use", "category": "AI", "label": "Smart autocomplete"},
    {"code": "ai.ocr.use", "category": "AI", "label": "Receipt OCR"},
    {"code": "ai.categorize.use", "category": "AI", "label": "GL categorization"},
    {"code": "ai.forecast.read", "category": "AI", "label": "Forecast read"},
    {"code": "ai.anomaly.read", "category": "AI", "label": "Anomaly read"},

    # Anomaly (Phase 7D)
    {"code": "anomaly.feed.read", "category": "Anomaly", "label": "Read anomaly feed"},
    {"code": "anomaly.triage", "category": "Anomaly", "label": "Triage anomaly (ack/resolve/fp)"},
    {"code": "anomaly.scan.trigger", "category": "Anomaly", "label": "Trigger manual anomaly scan"},

    # Search
    {"code": "search.global.use", "category": "Search", "label": "Global search"},
]
