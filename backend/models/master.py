"""Pydantic models for master data + cross-cutting entities."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field
import uuid


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


# ---------- ORG ----------
class Group(BaseDoc):
    name: str
    legal_name: Optional[str] = None
    npwp: Optional[str] = None
    address: Optional[str] = None
    fiscal_year_start: str = "01-01"  # MM-DD
    currency_default: str = "IDR"
    logo_url: Optional[str] = None
    settings: dict = Field(default_factory=lambda: {"timezone": "Asia/Jakarta", "date_format": "DD MMM YYYY"})


class Brand(BaseDoc):
    group_id: str
    code: str
    name: str
    logo_url: Optional[str] = None
    color: Optional[str] = None
    active: bool = True


class Outlet(BaseDoc):
    brand_id: str
    code: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_user_id: Optional[str] = None
    open_time: str = "08:00"
    close_time: str = "22:00"
    sales_schema_id: Optional[str] = None
    petty_cash_policy_id: Optional[str] = None
    service_policy_id: Optional[str] = None
    incentive_policy_id: Optional[str] = None
    active: bool = True


# ---------- USERS / ROLES ----------
class Role(BaseDoc):
    code: str
    name: str
    description: Optional[str] = None
    permissions: list[str] = Field(default_factory=list)
    is_system: bool = False  # system roles cannot be edited/deleted via UI


class User(BaseDoc):
    email: EmailStr
    password_hash: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str = "active"  # active | disabled
    role_ids: list[str] = Field(default_factory=list)
    outlet_ids: list[str] = Field(default_factory=list)
    brand_ids: list[str] = Field(default_factory=list)
    default_portal: Optional[str] = None
    last_login_at: Optional[str] = None
    failed_login_count: int = 0
    locked_until: Optional[str] = None
    mfa_enabled: bool = False


# ---------- MASTER ----------
class Category(BaseDoc):
    type: str  # item | expense | revenue
    code: str
    name: str
    parent_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    active: bool = True


class Item(BaseDoc):
    code: str
    sku: Optional[str] = None
    name: str
    name_local: Optional[str] = None
    category_id: Optional[str] = None
    unit_default: str = "pcs"
    conversion_units: list[dict] = Field(default_factory=list)
    is_direct_purchase: bool = False
    contra_account_id: Optional[str] = None
    active: bool = True
    image_url: Optional[str] = None
    notes: Optional[str] = None
    par_levels: dict = Field(default_factory=dict)  # {outlet_id: par_qty}


class Vendor(BaseDoc):
    code: str
    name: str
    npwp: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    bank_account: Optional[dict] = None  # {bank, account, name}
    default_payment_terms_days: int = 30
    default_payment_method: Optional[str] = None
    active: bool = True
    notes: Optional[str] = None


class Employee(BaseDoc):
    code: str
    full_name: str
    position: Optional[str] = None
    department: Optional[str] = None
    outlet_id: Optional[str] = None
    brand_id: Optional[str] = None
    status: str = "active"  # active | leave | terminated
    join_date: Optional[str] = None
    bank_account: Optional[dict] = None
    npwp: Optional[str] = None
    gross_salary: float = 0
    basic_salary: float = 0
    user_id: Optional[str] = None  # link to user account if applicable


class COA(BaseDoc):
    code: str
    name: str
    name_id: Optional[str] = None
    type: str  # asset | liability | equity | revenue | cogs | expense
    parent_id: Optional[str] = None
    level: int = 1
    normal_balance: str = "Dr"  # Dr | Cr
    is_postable: bool = True
    tax_code_id: Optional[str] = None
    active: bool = True


class TaxCode(BaseDoc):
    code: str
    name: str
    rate: float = 0
    gl_account_payable_id: Optional[str] = None
    gl_account_receivable_id: Optional[str] = None
    active: bool = True


class PaymentMethod(BaseDoc):
    code: str
    name: str
    type: str = "cash"  # cash | transfer | qris | card | other
    bank_account_id: Optional[str] = None
    active: bool = True


class BankAccount(BaseDoc):
    code: str
    name: str
    bank: str
    account_number: str
    currency: str = "IDR"
    gl_account_id: Optional[str] = None
    active: bool = True


class NumberSeries(BaseDoc):
    code: str
    prefix: str
    padding: int = 4
    reset: str = "yearly"  # yearly | monthly | never
    current_value: int = 0
    format: str  # e.g., "PR-{YY}{MM}-{0000}"


class BusinessRule(BaseDoc):
    scope_type: str  # group | brand | outlet
    scope_id: str
    rule_type: str  # sales_input_schema | petty_cash_policy | service_charge_policy | incentive_policy | approval_workflow | etc
    rule_data: dict = Field(default_factory=dict)
    active: bool = True
    version: int = 1
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None


# ---------- CROSS-CUTTING ----------
class AuditLogEntry(BaseDoc):
    user_id: Optional[str] = None
    timestamp: str
    entity_type: str
    entity_id: Optional[str] = None
    action: str
    before: Any = None
    after: Any = None
    reason: Optional[str] = None


class Notification(BaseDoc):
    user_id: str
    type: str  # info | warn | urgent | done
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    read_at: Optional[str] = None
