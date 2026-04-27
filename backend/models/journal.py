"""Journal entry model (Phase 4 main use, but Phase 3 already creates them)."""
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class JournalLine(BaseModel):
    coa_id: str
    coa_code: Optional[str] = None
    coa_name: Optional[str] = None
    dr: float = 0
    cr: float = 0
    memo: Optional[str] = None
    dim_outlet: Optional[str] = None
    dim_brand: Optional[str] = None
    dim_employee: Optional[str] = None
    dim_vendor: Optional[str] = None


class JournalEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doc_no: Optional[str] = None
    entry_date: str
    period: str  # YYYY-MM
    source_type: str  # manual / sales / po_gr / payment / opname / adjustment / hr_alloc
    source_id: Optional[str] = None
    description: str
    status: str = "posted"  # draft / posted / reversed
    lines: list[dict] = Field(default_factory=list)
    total_dr: float = 0
    total_cr: float = 0
    posted_by: Optional[str] = None
    posted_at: Optional[str] = None
    reversal_of: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None


class AccountingPeriod(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    period: str  # YYYY-MM (unique)
    fiscal_year: int
    status: str = "open"  # open / closing / closed / locked
    closed_by: Optional[str] = None
    closed_at: Optional[str] = None
    locked_at: Optional[str] = None
    locked_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
