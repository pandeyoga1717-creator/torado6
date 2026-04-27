"""AI Receipt OCR Service \u2014 Phase 5.

Uses emergentintegrations.LlmChat with Gemini 2.5 Flash (vision) to extract
structured data from receipt images. Non-blocking: callers should handle
empty/error responses gracefully (manual entry fallback).
"""
import json
import logging
import re
import uuid
from typing import Optional

from core.config import settings

logger = logging.getLogger("aurora.ai_ocr")


# Strict prompt; model returns JSON only.
SYSTEM_PROMPT = """You extract structured data from F&B receipt photos (typically Indonesian).
Return STRICT JSON ONLY \u2014 no prose, no code fences. Schema:
{
  "vendor_name": "<string or null>",
  "vendor_npwp": "<string or null>",
  "receipt_no": "<string or null>",
  "receipt_date": "<YYYY-MM-DD or null>",
  "subtotal": <number or 0>,
  "tax": <number or 0>,
  "service": <number or 0>,
  "total": <number or 0>,
  "items": [
    {"name": "<string>", "qty": <number>, "unit": "<string or null>",
     "price": <number>, "total": <number>}
  ],
  "currency": "IDR",
  "confidence_overall": <0..1>,
  "confidence_per_field": {
    "vendor_name": <0..1>, "receipt_date": <0..1>, "total": <0..1>, "items": <0..1>
  }
}
Notes:
- Use Indonesian Rupiah (no decimals usually).
- If unsure, set fields null/0 and lower confidence.
- Output ONLY the JSON object, nothing else.
"""


async def extract_receipt(*, image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """Send image to Gemini 2.5 Flash, parse response, return normalized dict.

    On any failure → returns {} (caller falls back to manual).
    """
    if not settings.feature_ai_enabled or not settings.emergent_llm_key:
        logger.warning("AI not enabled or key missing \u2014 skipping OCR")
        return {}
    if not image_base64:
        return {}
    # Sanity: limit huge payloads (>4MB base64) to avoid runaway latency
    if len(image_base64) > 6_000_000:
        logger.warning("Receipt image too large for OCR (>6MB base64)")
        return {"error": "Image too large; please attach a smaller photo (<4MB)."}
    if mime_type not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
        return {"error": f"MIME type {mime_type} not supported. Use JPEG/PNG/WEBP."}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=settings.emergent_llm_key,
            session_id=f"ocr-{uuid.uuid4().hex[:12]}",
            system_message=SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-2.5-flash")
        image_content = ImageContent(image_base64=image_base64)
        message = UserMessage(
            text="Extract the structured fields from this receipt. Output JSON only.",
            file_contents=[image_content],
        )
        resp = await chat.send_message(message)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"LLM vision call failed: {e}")
        return {"error": f"OCR failed: {str(e)[:200]}"}

    if not resp:
        return {}

    # Parse JSON \u2014 model is instructed to return raw json
    raw = str(resp).strip()
    # Strip code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    # Find first { ... last }
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        logger.warning(f"No JSON detected in OCR response: {raw[:200]}")
        return {"error": "AI response could not be parsed", "raw": raw[:300]}
    try:
        parsed = json.loads(m.group(0))
    except json.JSONDecodeError as e:
        logger.warning(f"OCR JSON parse failed: {e}")
        return {"error": "AI response not valid JSON", "raw": m.group(0)[:300]}

    # Normalize floats safely
    def _f(v) -> float:
        try:
            if v is None:
                return 0.0
            if isinstance(v, (int, float)):
                return float(v)
            return float(str(v).replace(",", "").replace(".", ""))
        except Exception:  # noqa: BLE001
            return 0.0

    items_norm = []
    for it in parsed.get("items", []) or []:
        items_norm.append({
            "name": (it.get("name") or "").strip() or None,
            "qty": _f(it.get("qty")),
            "unit": it.get("unit") or None,
            "price": _f(it.get("price")),
            "total": _f(it.get("total")),
        })

    return {
        "vendor_name": parsed.get("vendor_name") or None,
        "vendor_npwp": parsed.get("vendor_npwp") or None,
        "receipt_no": parsed.get("receipt_no") or None,
        "receipt_date": parsed.get("receipt_date") or None,
        "subtotal": _f(parsed.get("subtotal")),
        "tax": _f(parsed.get("tax")),
        "service": _f(parsed.get("service")),
        "total": _f(parsed.get("total")),
        "currency": parsed.get("currency") or "IDR",
        "items": items_norm,
        "confidence_overall": float(parsed.get("confidence_overall") or 0),
        "confidence_per_field": parsed.get("confidence_per_field") or {},
    }
