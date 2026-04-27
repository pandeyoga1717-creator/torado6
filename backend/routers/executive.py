"""/api/executive router — KPIs, trends, drill-down hooks."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import executive_service, ai_insights_service

router = APIRouter(prefix="/api/executive", tags=["executive"])


@router.get("/kpis")
async def kpis(
    period: Optional[str] = None,
    user: dict = Depends(require_perm("executive.dashboard.read")),
):
    return ok_envelope(await executive_service.kpis(period=period))


@router.get("/sales-trend")
async def sales_trend(
    days: int = Query(30, ge=1, le=180),
    outlet_id: Optional[str] = None,
    user: dict = Depends(require_perm("executive.dashboard.read")),
):
    return ok_envelope(await executive_service.sales_trend(
        days=days, dim_outlet=outlet_id))


@router.get("/insights")
async def insights(
    user: dict = Depends(require_perm("executive.dashboard.read")),
):
    return ok_envelope(await ai_insights_service.insights_pack())


@router.post("/qa")
async def conversational_qa(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("ai.chat.use")),
):
    return ok_envelope(await ai_insights_service.conversational_qa(
        payload.get("question", ""), user=user))
