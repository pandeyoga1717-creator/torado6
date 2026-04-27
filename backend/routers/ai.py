"""/api/ai router — autocomplete + categorization (Phase 3 integration)."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/items/suggest")
async def items_suggest(q: str = Query(..., min_length=1),
                         limit: int = Query(8, ge=1, le=20),
                         user: dict = Depends(require_perm("ai.autocomplete.use"))):
    return ok_envelope(await ai_service.suggest_items(q, limit=limit))


@router.get("/vendors/suggest")
async def vendors_suggest(q: str = Query(..., min_length=1),
                           limit: int = Query(8, ge=1, le=20),
                           user: dict = Depends(require_perm("ai.autocomplete.use"))):
    return ok_envelope(await ai_service.suggest_vendors(q, limit=limit))


@router.post("/categorize")
async def categorize(payload: dict = Body(...),
                      user: dict = Depends(require_perm("ai.categorize.use"))):
    desc = payload.get("description", "")
    amount = float(payload.get("amount", 0) or 0)
    outlet_id = payload.get("outlet_id")
    suggestion = await ai_service.categorize_expense(desc, amount, outlet_id)
    return ok_envelope(suggestion)


@router.post("/categorize/learn")
async def categorize_learn(payload: dict = Body(...),
                            user: dict = Depends(require_perm("ai.categorize.use"))):
    await ai_service.learn_categorization(
        payload.get("description", ""),
        payload["gl_account_id"],
        user_id=user["id"],
    )
    return ok_envelope({"message": "Learned"})


# =================== OCR (Phase 5) ===================
@router.post("/extract-receipt")
async def extract_receipt(payload: dict = Body(...),
                           user: dict = Depends(require_perm("ai.ocr.use"))):
    """Extract structured fields from a receipt image (base64).

    Body:
      {
        "image_base64": "<base64 string, NO data: prefix>",
        "mime_type":    "image/jpeg" | "image/png" | "image/webp"
      }

    Returns parsed receipt dict (or {error: ...} on failure).
    Non-blocking: caller should always allow manual override.
    """
    from services import ai_ocr_service
    image_b64 = payload.get("image_base64") or ""
    if not image_b64:
        return ok_envelope({"error": "image_base64 required"})
    # Strip data URL prefix if user accidentally included it
    if image_b64.startswith("data:"):
        comma = image_b64.find(",")
        if comma > 0:
            image_b64 = image_b64[comma + 1:]
    mime_type = (payload.get("mime_type") or "image/jpeg").lower()
    result = await ai_ocr_service.extract_receipt(
        image_base64=image_b64, mime_type=mime_type,
    )
    return ok_envelope(result)
