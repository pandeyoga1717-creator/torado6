"""/api/finance router — JE, manual journal, reversal, TB, P&L, AP aging, validation queue, periods."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import finance_service, period_service

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("/home")
async def home(user: dict = Depends(require_perm("finance.journal_entry.read"))):
    return ok_envelope(await finance_service.finance_home())


# ---------------- JOURNAL ENTRIES ----------------
@router.get("/journals")
async def list_je(
    period: Optional[str] = None,
    source_type: Optional[str] = None,
    coa_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    items, meta = await finance_service.list_journals(
        period=period, source_type=source_type, coa_id=coa_id, dim_outlet=dim_outlet,
        date_from=date_from, date_to=date_to, status=status, search=search,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/journals/{je_id}")
async def get_je(je_id: str, user: dict = Depends(require_perm("finance.journal_entry.read"))):
    return ok_envelope(await finance_service.get_journal(je_id))


@router.post("/journals/manual")
async def post_manual(payload: dict = Body(...),
                       user: dict = Depends(require_perm("finance.journal_entry.create"))):
    return ok_envelope(await finance_service.post_manual_journal(payload, user=user))


@router.post("/journals/{je_id}/reverse")
async def reverse_je(je_id: str, payload: dict = Body(...),
                       user: dict = Depends(require_perm("finance.journal_entry.reverse"))):
    return ok_envelope(await finance_service.reverse_journal(
        je_id, user=user, reason=payload.get("reason", "")))


# ---------------- REPORTS ----------------
@router.get("/trial-balance")
async def trial_balance(
    period: str,
    dim_outlet: Optional[str] = None,
    user: dict = Depends(require_perm("finance.report.profit_loss")),
):
    return ok_envelope(await finance_service.trial_balance(
        period=period, dim_outlet=dim_outlet))


@router.get("/profit-loss")
async def profit_loss(
    period: str,
    dim_outlet: Optional[str] = None,
    compare_prev: bool = True,
    user: dict = Depends(require_perm("finance.report.profit_loss")),
):
    return ok_envelope(await finance_service.profit_loss(
        period=period, dim_outlet=dim_outlet, compare_prev=compare_prev))


@router.get("/ap-aging")
async def ap_aging(
    as_of: Optional[str] = None,
    user: dict = Depends(require_perm("finance.ap.read")),
):
    return ok_envelope(await finance_service.ap_aging(as_of=as_of))


# ---------------- VALIDATION QUEUE ----------------
@router.get("/validation-queue")
async def validation_queue(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("finance.sales.validate")),
):
    items, meta = await finance_service.sales_validation_queue(page=page, per_page=per_page)
    return ok_envelope(items, meta)


# ---------------- ACCOUNTING PERIODS ----------------
@router.get("/periods")
async def list_periods(
    year: Optional[int] = None,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    items = await period_service.list_periods(year=year)
    return ok_envelope(items)


@router.get("/periods/{period}")
async def get_period(
    period: str,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    return ok_envelope(await period_service.get_period(period))


@router.get("/periods/{period}/closing-checks")
async def closing_checks(
    period: str,
    user: dict = Depends(require_perm("finance.period.close_step")),
):
    return ok_envelope(await period_service.closing_checks(period))


@router.post("/periods/{period}/close")
async def close_period(
    period: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("finance.period.close_step")),
):
    return ok_envelope(await period_service.close_period(
        period, user=user, reason=payload.get("reason"),
    ))


@router.post("/periods/{period}/lock")
async def lock_period(
    period: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("finance.period.lock")),
):
    return ok_envelope(await period_service.lock_period(
        period, user=user, reason=payload.get("reason"),
    ))


@router.post("/periods/{period}/unlock")
async def unlock_period(
    period: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.period.unlock")),
):
    return ok_envelope(await period_service.reopen_period(
        period, user=user, reason=payload.get("reason", ""),
    ))
