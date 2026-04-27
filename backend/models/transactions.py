"""Pydantic models for transactional entities (Phase 3+).
All docs share BaseDoc shape (id, created_at, updated_at, deleted_at, by-fields).
"""
import uuid
from datetime import datetime
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


# ========== OUTLET ==========

class DailySales(BaseDoc):
    outlet_id: str
    brand_id: Optional[str] = None
    sales_date: str  # YYYY-MM-DD
    status: str = "draft"  # draft / submitted / validated / locked / rejected
    schema_version: int = 1
    channels: list[dict] = Field(default_factory=list)
    # [{channel: "dine_in", gross: 0, discount: 0, net: 0}]
    payment_breakdown: list[dict] = Field(default_factory=list)
    # [{payment_method_id, payment_method_name, amount}]
    revenue_buckets: list[dict] = Field(default_factory=list)
    # [{bucket: "food"|"beverage"|"other", amount}]
    service_charge: float = 0
    tax_amount: float = 0
    grand_total: float = 0
    transaction_count: int = 0
    notes: Optional[str] = None
    submitted_at: Optional[str] = None
    submitted_by: Optional[str] = None
    validated_at: Optional[str] = None
    validated_by: Optional[str] = None
    rejected_reason: Optional[str] = None
    journal_entry_id: Optional[str] = None


class PettyCashTransaction(BaseDoc):
    doc_no: Optional[str] = None
    outlet_id: str
    txn_date: str
    type: str  # purchase / replenish / adjustment
    amount: float
    description: str
    item_text: Optional[str] = None  # free text item or vendor
    item_id: Optional[str] = None
    vendor_text: Optional[str] = None
    vendor_id: Optional[str] = None
    category_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "posted"  # posted / cancelled
    balance_after: float = 0
    journal_entry_id: Optional[str] = None


class UrgentPurchase(BaseDoc):
    doc_no: Optional[str] = None
    outlet_id: str
    purchase_date: str
    vendor_id: Optional[str] = None
    vendor_text: Optional[str] = None
    items: list[dict] = Field(default_factory=list)
    # [{name, qty, unit, cost, total, gl_account_id}]
    total: float = 0
    payment_method_id: Optional[str] = None
    paid_by: Optional[str] = None  # employee_id or text
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "submitted"  # submitted / approved / rejected
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    journal_entry_id: Optional[str] = None


# ========== PROCUREMENT ==========

class PRLine(BaseModel):
    item_id: Optional[str] = None
    item_name: str
    qty: float
    unit: str
    est_cost: Optional[float] = None
    notes: Optional[str] = None


class PurchaseRequest(BaseDoc):
    doc_no: Optional[str] = None
    requester_user_id: Optional[str] = None
    outlet_id: str
    brand_id: Optional[str] = None
    request_date: str
    needed_by: Optional[str] = None
    source: str = "manual"  # KDO / BDO / manual
    lines: list[dict] = Field(default_factory=list)
    notes: Optional[str] = None
    status: str = "draft"  # draft / submitted / approved / rejected / converted / partial
    approval_chain: list[dict] = Field(default_factory=list)
    # [{level, approver_role, approver_id, action, at, note}]
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_reason: Optional[str] = None
    converted_to_po_ids: list[str] = Field(default_factory=list)


class POLine(BaseModel):
    item_id: Optional[str] = None
    item_name: str
    qty: float
    unit: str
    unit_cost: float
    discount: float = 0
    tax_rate: float = 0
    total: float = 0
    notes: Optional[str] = None


class PurchaseOrder(BaseDoc):
    doc_no: Optional[str] = None
    vendor_id: str
    outlet_id: Optional[str] = None  # delivery target (or null=central)
    pr_ids: list[str] = Field(default_factory=list)
    order_date: str
    expected_delivery_date: Optional[str] = None
    lines: list[dict] = Field(default_factory=list)
    subtotal: float = 0
    tax_total: float = 0
    discount_total: float = 0
    grand_total: float = 0
    payment_terms_days: int = 30
    status: str = "draft"  # draft / awaiting_approval / sent / partial / received / closed / cancelled
    approval_chain: list[dict] = Field(default_factory=list)
    sent_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    cancelled_reason: Optional[str] = None
    notes: Optional[str] = None


class GRLine(BaseModel):
    po_line_index: Optional[int] = None
    item_id: Optional[str] = None
    item_name: str
    qty_ordered: float = 0
    qty_received: float
    qty_variance: float = 0
    unit: str
    unit_cost: float
    total_cost: float = 0
    condition_note: Optional[str] = None


class GoodsReceipt(BaseDoc):
    doc_no: Optional[str] = None
    po_id: Optional[str] = None
    vendor_id: str
    outlet_id: str  # destination
    receive_date: str
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_url: Optional[str] = None
    lines: list[dict] = Field(default_factory=list)
    subtotal: float = 0
    tax_total: float = 0
    grand_total: float = 0
    notes: Optional[str] = None
    status: str = "draft"  # draft / posted / reversed
    posted_at: Optional[str] = None
    received_by: Optional[str] = None
    inventory_movement_ids: list[str] = Field(default_factory=list)
    ap_id: Optional[str] = None  # link to KB / AP ledger
    journal_entry_id: Optional[str] = None


# ========== INVENTORY ==========

class InventoryMovement(BaseDoc):
    item_id: str
    item_name: Optional[str] = None
    outlet_id: str
    movement_date: str
    movement_type: str  # receipt / issue / transfer_out / transfer_in / adjustment / opname_diff
    qty: float  # signed: positive = in, negative = out
    unit: str
    unit_cost: float = 0
    total_cost: float = 0
    ref_type: Optional[str] = None  # gr | adjustment | opname_session | transfer
    ref_id: Optional[str] = None
    balance_after: Optional[float] = None  # snapshot at insert time (best-effort)
    notes: Optional[str] = None


class Transfer(BaseDoc):
    doc_no: Optional[str] = None
    from_outlet_id: str
    to_outlet_id: str
    transfer_date: str
    lines: list[dict] = Field(default_factory=list)
    # [{item_id, item_name, qty, unit, unit_cost, total_cost, qty_received (on receive)}]
    total_value: float = 0
    notes: Optional[str] = None
    status: str = "draft"  # draft / sent / received / discrepancy
    sent_at: Optional[str] = None
    received_at: Optional[str] = None
    received_by: Optional[str] = None
    discrepancy_reason: Optional[str] = None
    movement_out_ids: list[str] = Field(default_factory=list)
    movement_in_ids: list[str] = Field(default_factory=list)


class Adjustment(BaseDoc):
    doc_no: Optional[str] = None
    outlet_id: str
    adjustment_date: str
    reason: str  # waste / damage / correction / other
    lines: list[dict] = Field(default_factory=list)
    # [{item_id, qty_delta, unit_cost, total_cost, notes}]
    total_value: float = 0
    notes: Optional[str] = None
    status: str = "draft"  # draft / submitted / approved / rejected
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    journal_entry_id: Optional[str] = None
    movement_ids: list[str] = Field(default_factory=list)


class OpnameSession(BaseDoc):
    doc_no: Optional[str] = None
    outlet_id: str
    period: str  # YYYY-MM
    opname_date: str
    status: str = "in_progress"  # in_progress / submitted / approved
    counted_by_user_ids: list[str] = Field(default_factory=list)
    lines: list[dict] = Field(default_factory=list)
    # [{item_id, item_name, system_qty, counted_qty, variance, unit, unit_cost, variance_value, notes, counted_at}]
    total_variance_value: float = 0
    total_items: int = 0
    counted_items: int = 0
    notes: Optional[str] = None
    submitted_at: Optional[str] = None
    submitted_by: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    journal_entry_id: Optional[str] = None
    movement_ids: list[str] = Field(default_factory=list)


# ========== AP LEDGER (created by GR — used in Finance Phase 4 too) ==========

class APLedger(BaseDoc):
    vendor_id: str
    gr_id: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    amount: float
    balance: float
    currency: str = "IDR"
    status: str = "open"  # open / partial / paid / overdue / cancelled
    payments: list[dict] = Field(default_factory=list)
    posted_at: str = ""
