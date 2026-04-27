"""Pydantic models for HR & Incentive (Phase 5).

Conventions:
- All docs share BaseDoc (id, created_at, updated_at, deleted_at, by-fields).
- ID = UUID4 string. Datetimes serialized as ISO strings (timezone-aware UTC).
- Status flows are validated server-side in services/hr_service.py.
"""
import uuid
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


# ========== EMPLOYEE ADVANCE (Kasbon) ==========

class EmployeeAdvance(BaseDoc):
    """Kasbon karyawan dengan rencana cicilan bulanan."""
    doc_no: Optional[str] = None
    employee_id: str
    outlet_id: Optional[str] = None
    advance_date: str  # YYYY-MM-DD
    principal: float
    terms_months: int = 1  # cicilan bulanan
    monthly_installment: float = 0
    schedule: list[dict] = Field(default_factory=list)
    # [{period: "YYYY-MM", due_date: "YYYY-MM-DD", amount: 0, paid: bool, paid_at: ...}]
    status: str = "draft"  # draft / approved / disbursed / repaying / settled / written_off
    reason: Optional[str] = None
    payment_method_id: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    disbursed_at: Optional[str] = None
    journal_entry_id: Optional[str] = None
    settled_at: Optional[str] = None
    notes: Optional[str] = None


# ========== SERVICE CHARGE ==========

class ServiceChargePeriod(BaseDoc):
    """Service Charge per period+outlet — alokasi ke karyawan setelah deduksi LB/LD."""
    doc_no: Optional[str] = None
    period: str  # YYYY-MM
    outlet_id: str
    brand_id: Optional[str] = None
    gross_service: float = 0  # auto-pulled from validated daily_sales
    lb_pct: float = 0  # default 5% (configurable)
    ld_pct: float = 0  # default 0%
    lb_amount: float = 0
    ld_amount: float = 0
    distributable: float = 0
    allocations: list[dict] = Field(default_factory=list)
    # [{employee_id, employee_name, days_worked, share_pct, amount}]
    status: str = "draft"  # draft / calculated / approved / posted
    calculated_at: Optional[str] = None
    calculated_by: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    posted_at: Optional[str] = None
    posted_by: Optional[str] = None
    journal_entry_id: Optional[str] = None
    notes: Optional[str] = None


# ========== INCENTIVE ==========

class IncentiveScheme(BaseDoc):
    """Aturan incentive per outlet/role/brand. Formula sederhana berbasis sales target."""
    code: str
    name: str
    scope_type: str = "outlet"  # outlet / brand / role / global
    scope_id: Optional[str] = None  # outlet_id or brand_id
    rule_type: str = "tiered_sales"  # tiered_sales / pct_of_sales / flat_per_target
    rule_data: dict = Field(default_factory=dict)
    # tiered_sales: {tiers: [{min_sales, max_sales, pct, flat}]}
    # pct_of_sales: {pct: 0.01, base: "validated_sales"}
    # flat_per_target: {target_sales, flat_amount}
    employee_ids: list[str] = Field(default_factory=list)
    active: bool = True
    notes: Optional[str] = None


class IncentiveRun(BaseDoc):
    """Eksekusi scheme untuk period tertentu — hasilnya allocations."""
    doc_no: Optional[str] = None
    scheme_id: str
    scheme_name: Optional[str] = None
    period: str  # YYYY-MM
    outlet_id: Optional[str] = None
    brand_id: Optional[str] = None
    base_sales: float = 0
    allocations: list[dict] = Field(default_factory=list)
    # [{employee_id, employee_name, base_amount, formula_detail, amount}]
    total_amount: float = 0
    status: str = "draft"  # draft / calculated / approved / posted
    calculated_at: Optional[str] = None
    calculated_by: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    posted_at: Optional[str] = None
    posted_by: Optional[str] = None
    journal_entry_id: Optional[str] = None
    notes: Optional[str] = None


# ========== VOUCHER ==========

class Voucher(BaseDoc):
    """Voucher promosi/internal — issue lalu redeem terhadap revenue."""
    code: str
    batch_id: Optional[str] = None
    value: float = 0
    issue_date: str
    expire_date: Optional[str] = None
    issued_by: Optional[str] = None  # employee_id atau user_id
    issued_to: Optional[str] = None  # employee_id / customer note
    purpose: Optional[str] = None  # marketing / staff / replacement
    outlet_id: Optional[str] = None  # restricted outlet (optional)
    status: str = "issued"  # issued / redeemed / expired / void
    redeemed_at: Optional[str] = None
    redeemed_amount: float = 0
    redeemed_outlet_id: Optional[str] = None
    redeemed_ref: Optional[str] = None  # daily_sales_id atau ref
    journal_entry_issue_id: Optional[str] = None
    journal_entry_redeem_id: Optional[str] = None
    notes: Optional[str] = None


# ========== FOC (Free of Charge) ==========

class FOCEntry(BaseDoc):
    """Pencatatan complimentary / staff meal / marketing / customer compensation."""
    doc_no: Optional[str] = None
    foc_date: str
    outlet_id: str
    brand_id: Optional[str] = None
    foc_type: str  # staff_meal / marketing / customer_comp / other
    amount: float = 0
    items: list[dict] = Field(default_factory=list)
    # [{item_id, name, qty, unit, cost, total}]
    beneficiary: Optional[str] = None  # employee_id / event name / customer
    gl_account_id: Optional[str] = None  # override expense GL
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "posted"  # posted / void
    journal_entry_id: Optional[str] = None


# ========== LB FUND LEDGER ==========

class LBFundEntry(BaseDoc):
    """Ledger Loss & Breakage Fund (komulasi dari service charge deduction + pemakaian compensation)."""
    entry_date: str
    direction: str  # in / out
    amount: float = 0
    source_type: str  # service_charge / customer_compensation / adjustment / opening
    source_id: Optional[str] = None
    outlet_id: Optional[str] = None
    description: Optional[str] = None
    balance_after: float = 0


# ========== PAYROLL CYCLE ==========

class PayrollCycle(BaseDoc):
    """Cycle payroll bulanan — draft → approve → post."""
    doc_no: Optional[str] = None
    period: str  # YYYY-MM
    outlet_id: Optional[str] = None  # null = group-wide
    payroll_date: Optional[str] = None  # rencana payment date
    employees: list[dict] = Field(default_factory=list)
    # [{employee_id, name, basic, gross, deductions[], allowances[], advance_repayment, take_home}]
    total_gross: float = 0
    total_deductions: float = 0
    total_allowances: float = 0
    total_advance_repayment: float = 0
    total_take_home: float = 0
    status: str = "draft"  # draft / approved / posted
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    posted_at: Optional[str] = None
    posted_by: Optional[str] = None
    journal_entry_id: Optional[str] = None
    notes: Optional[str] = None
