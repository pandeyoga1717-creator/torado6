"""/api/hr router — Phase 5: advances, service charge, incentive, voucher, FOC, LB fund, payroll."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm, require_perm
from services import hr_service

router = APIRouter(prefix="/api/hr", tags=["hr"])


# ============================================================
# DASHBOARD
# ============================================================
@router.get("/dashboard")
async def hr_dashboard(user: dict = Depends(require_any_perm(
    "hr.advance.read", "hr.lb_fund.read",
    "finance.report.profit_loss", "executive.dashboard.read",
))):
    return ok_envelope(await hr_service.hr_dashboard())


# ============================================================
# EMPLOYEE ADVANCES
# ============================================================
@router.get("/advances")
async def list_advances(
    employee_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.advance.read")),
):
    items, meta = await hr_service.list_advances(
        employee_id=employee_id, outlet_id=outlet_id, status=status,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/advances/{adv_id}")
async def get_advance(adv_id: str,
                      user: dict = Depends(require_perm("hr.advance.read"))):
    return ok_envelope(await hr_service.get_advance(adv_id))


@router.post("/advances")
async def create_advance(payload: dict = Body(...),
                         user: dict = Depends(require_perm("hr.advance.create"))):
    return ok_envelope(await hr_service.create_advance(payload, user=user))


@router.post("/advances/{adv_id}/submit")
async def submit_advance(adv_id: str,
                         user: dict = Depends(require_perm("hr.advance.create"))):
    return ok_envelope(await hr_service.submit_advance_for_approval(adv_id, user=user))


@router.post("/advances/{adv_id}/approve")
async def approve_advance(adv_id: str, payload: dict = Body(default={}),
                          user: dict = Depends(current_user)):
    # Permission enforced by approval engine when workflow exists; legacy fallback uses creator-by-default
    return ok_envelope(await hr_service.approve_advance(
        adv_id, user=user, note=payload.get("note")))


@router.post("/advances/{adv_id}/reject")
async def reject_advance(adv_id: str, payload: dict = Body(...),
                         user: dict = Depends(current_user)):
    return ok_envelope(await hr_service.reject_advance(
        adv_id, user=user, reason=payload.get("reason", "")))


@router.get("/advances/{adv_id}/approval-state")
async def advance_approval_state(adv_id: str, user: dict = Depends(current_user)):
    return ok_envelope(await hr_service.get_advance_approval_state(adv_id))


@router.post("/advances/{adv_id}/installments/{period}/mark-paid")
async def mark_advance_installment_paid(
    adv_id: str, period: str,
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    return ok_envelope(await hr_service.mark_advance_installment_paid(adv_id, period, user=user))


# ============================================================
# SERVICE CHARGE
# ============================================================
@router.get("/service-charges")
async def list_service_charge(
    period: Optional[str] = None, outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.service_charge.calculate")),
):
    items, meta = await hr_service.list_service_charge(
        period=period, outlet_id=outlet_id, status=status,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/service-charges/{sc_id}")
async def get_service_charge(sc_id: str,
                              user: dict = Depends(require_perm("hr.service_charge.calculate"))):
    return ok_envelope(await hr_service.get_service_charge(sc_id))


@router.post("/service-charges/calculate")
async def calculate_service_charge(payload: dict = Body(...),
                                    user: dict = Depends(require_perm("hr.service_charge.calculate"))):
    return ok_envelope(await hr_service.calculate_service_charge(payload, user=user))


@router.post("/service-charges/{sc_id}/approve")
async def approve_service_charge(sc_id: str,
                                  user: dict = Depends(require_perm("hr.service_charge.post"))):
    return ok_envelope(await hr_service.approve_service_charge(sc_id, user=user))


@router.post("/service-charges/{sc_id}/post")
async def post_service_charge(sc_id: str,
                               user: dict = Depends(require_perm("hr.service_charge.post"))):
    return ok_envelope(await hr_service.post_service_charge(sc_id, user=user))


# ============================================================
# INCENTIVE
# ============================================================
@router.get("/incentive-schemes")
async def list_schemes(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("hr.incentive.calculate")),
):
    items, meta = await hr_service.list_schemes(page=page, per_page=per_page)
    return ok_envelope(items, meta)


@router.post("/incentive-schemes")
async def create_scheme(payload: dict = Body(...),
                         user: dict = Depends(require_perm("hr.incentive.calculate"))):
    return ok_envelope(await hr_service.create_scheme(payload, user=user))


@router.get("/incentive-runs")
async def list_runs(
    scheme_id: Optional[str] = None, period: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.incentive.calculate")),
):
    items, meta = await hr_service.list_runs(
        scheme_id=scheme_id, period=period, status=status,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/incentive-runs/{run_id}")
async def get_run(run_id: str,
                   user: dict = Depends(require_perm("hr.incentive.calculate"))):
    return ok_envelope(await hr_service.get_run(run_id))


@router.post("/incentive-runs/calculate")
async def calculate_incentive(payload: dict = Body(...),
                                user: dict = Depends(require_perm("hr.incentive.calculate"))):
    return ok_envelope(await hr_service.calculate_incentive(payload, user=user))


@router.post("/incentive-runs/{run_id}/approve")
async def approve_incentive(run_id: str,
                              user: dict = Depends(require_perm("hr.incentive.approve"))):
    return ok_envelope(await hr_service.approve_incentive(run_id, user=user))


@router.post("/incentive-runs/{run_id}/post")
async def post_incentive(run_id: str,
                          user: dict = Depends(require_perm("hr.incentive.approve"))):
    return ok_envelope(await hr_service.post_incentive(run_id, user=user))


# ============================================================
# VOUCHER
# ============================================================
@router.get("/vouchers")
async def list_vouchers(
    status: Optional[str] = None, batch_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("hr.voucher.issue")),
):
    items, meta = await hr_service.list_vouchers(
        status=status, batch_id=batch_id, search=search,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/vouchers/issue")
async def issue_voucher_batch(payload: dict = Body(...),
                                user: dict = Depends(require_perm("hr.voucher.issue"))):
    return ok_envelope(await hr_service.issue_vouchers(payload, user=user))


@router.post("/vouchers/{code}/redeem")
async def redeem_voucher(code: str, payload: dict = Body(default={}),
                          user: dict = Depends(require_perm("hr.voucher.redeem"))):
    return ok_envelope(await hr_service.redeem_voucher(code, payload, user=user))


# ============================================================
# FOC
# ============================================================
@router.get("/foc")
async def list_foc(
    outlet_id: Optional[str] = None, foc_type: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.foc.create")),
):
    outlet_ids = [outlet_id] if outlet_id else None
    items, meta = await hr_service.list_foc(
        outlet_ids=outlet_ids, foc_type=foc_type,
        date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/foc")
async def create_foc(payload: dict = Body(...),
                      user: dict = Depends(require_perm("hr.foc.create"))):
    return ok_envelope(await hr_service.create_foc(payload, user=user))


# ============================================================
# LB FUND
# ============================================================
@router.get("/lb-fund")
async def list_lb_fund(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("hr.lb_fund.read")),
):
    items, meta = await hr_service.list_lb_fund(page=page, per_page=per_page)
    return ok_envelope(items, meta)


# ============================================================
# PAYROLL
# ============================================================
@router.get("/payroll")
async def list_payroll(
    period: Optional[str] = None, status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    items, meta = await hr_service.list_payroll(
        period=period, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/payroll/{p_id}")
async def get_payroll(p_id: str,
                       user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.get_payroll(p_id))


@router.post("/payroll")
async def create_payroll(payload: dict = Body(...),
                          user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.create_payroll(payload, user=user))


@router.post("/payroll/{p_id}/approve")
async def approve_payroll(p_id: str,
                           user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.approve_payroll(p_id, user=user))


@router.post("/payroll/{p_id}/post")
async def post_payroll(p_id: str,
                        user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.post_payroll(p_id, user=user))
