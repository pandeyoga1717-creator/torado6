"""AI services for Phase 3+ — autocomplete & GL categorization (using Emergent LLM key).
Do NOT block users on AI; if LLM fails, fall back to local fuzzy.
"""
import json
import logging
import re
from typing import Optional

from core.config import settings
from core.db import get_db, serialize

logger = logging.getLogger("aurora.ai")


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower().strip())


async def suggest_items(query: str, limit: int = 8) -> list[dict]:
    """Local fuzzy match items by name/code/SKU. (LLM fallback skipped — fast UX.)"""
    if not query or len(query) < 1:
        return []
    db = get_db()
    q_norm = _normalize(query)
    rx = {"$regex": re.escape(query), "$options": "i"}
    cursor = db.items.find({
        "deleted_at": None,
        "active": True,
        "$or": [{"name": rx}, {"code": rx}, {"sku": rx}, {"name_local": rx}],
    }).limit(limit)
    results = []
    async for it in cursor:
        # Get last price/vendor from price history if exists
        last_price = None
        last_vendor_id = None
        ph = await db.item_price_history.find_one(
            {"item_id": it["id"]}, sort=[("valid_from", -1)],
        ) if "item_price_history" in await db.list_collection_names() else None
        if ph:
            last_price = ph.get("price")
            last_vendor_id = ph.get("vendor_id")
        results.append({
            "id": it["id"], "code": it.get("code"),
            "name": it.get("name"), "unit": it.get("unit_default"),
            "category_id": it.get("category_id"),
            "last_price": last_price, "last_vendor_id": last_vendor_id,
        })
    return results


async def suggest_vendors(query: str, limit: int = 8) -> list[dict]:
    if not query or len(query) < 1:
        return []
    db = get_db()
    rx = {"$regex": re.escape(query), "$options": "i"}
    cursor = db.vendors.find({
        "deleted_at": None, "active": True,
        "$or": [{"name": rx}, {"code": rx}, {"phone": rx}],
    }).limit(limit)
    return [{"id": v["id"], "code": v.get("code"), "name": v.get("name"),
             "phone": v.get("phone"),
             "default_payment_terms_days": v.get("default_payment_terms_days", 30)}
            async for v in cursor]


async def categorize_expense(description: str, amount: float = 0,
                              outlet_id: Optional[str] = None) -> dict:
    """Suggest GL account for an expense description.
    Uses local rules first, LLM if no rule matches.
    Returns {gl_id, gl_code, gl_name, confidence, reason}.
    """
    db = get_db()
    desc_lower = _normalize(description)

    # Local rules first
    rules_cursor = db.categorization_rules.find({"active": True})
    async for r in rules_cursor:
        pat = r.get("pattern", "")
        try:
            if re.search(pat, desc_lower):
                gl = await db.chart_of_accounts.find_one({"id": r["gl_account_id"]})
                if gl:
                    await db.categorization_rules.update_one(
                        {"id": r["id"]}, {"$inc": {"hit_count": 1}}
                    )
                    return {
                        "gl_id": gl["id"], "gl_code": gl["code"],
                        "gl_name": gl["name"],
                        "confidence": min(1.0, 0.7 + r.get("hit_count", 0) * 0.01),
                        "reason": f"Matches rule: {pat}", "source": "rule",
                    }
        except re.error:
            continue

    # LLM fallback
    if not settings.feature_ai_enabled or not settings.emergent_llm_key:
        return {}
    try:
        coas_cursor = db.chart_of_accounts.find(
            {"deleted_at": None, "active": True, "is_postable": True,
             "type": {"$in": ["expense", "cogs"]}}
        )
        coa_list = [{"id": c["id"], "code": c["code"],
                     "name": c["name"]} async for c in coas_cursor]
        coa_str = "\n".join(
            f"- {c['code']}: {c['name']}" for c in coa_list
        )
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        sys = f"""You classify Indonesian F&B expense descriptions into GL accounts.
Available GL accounts (only use these codes):
{coa_str}

Output STRICT JSON ONLY (no prose):
{{"gl_code":"...","confidence":0.0-1.0,"reason":"<short Indonesian>"}}"""
        chat = LlmChat(
            api_key=settings.emergent_llm_key,
            session_id=f"categ-{description[:20]}",
            system_message=sys,
        ).with_model("openai", "gpt-5-mini")
        resp = await chat.send_message(UserMessage(
            text=f'Description: "{description}"\nAmount: Rp {amount}\n\nOutput JSON.'
        ))
        m = re.search(r"\{.*\}", resp, re.DOTALL)
        if not m:
            return {}
        parsed = json.loads(m.group(0))
        gl = next((c for c in coa_list if c["code"] == parsed.get("gl_code")), None)
        if not gl:
            return {}
        return {
            "gl_id": gl["id"], "gl_code": gl["code"], "gl_name": gl["name"],
            "confidence": float(parsed.get("confidence", 0.7)),
            "reason": parsed.get("reason", ""), "source": "llm",
        }
    except Exception as e:  # noqa: BLE001
        logger.warning(f"LLM categorize failed: {e}")
        return {}


async def learn_categorization(description: str, gl_account_id: str, *, user_id: str) -> None:
    """Save user's categorization choice as a learning rule."""
    db = get_db()
    # Extract first 2-3 keywords as pattern
    desc_lower = _normalize(description)
    words = [w for w in desc_lower.split() if len(w) > 3][:3]
    if not words:
        return
    pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
    # Upsert rule
    existing = await db.categorization_rules.find_one({
        "pattern": pattern, "gl_account_id": gl_account_id,
    })
    if existing:
        await db.categorization_rules.update_one(
            {"id": existing["id"]}, {"$inc": {"hit_count": 1}}
        )
    else:
        import uuid
        from datetime import datetime, timezone
        await db.categorization_rules.insert_one({
            "id": str(uuid.uuid4()),
            "pattern": pattern, "gl_account_id": gl_account_id,
            "confidence": 0.7, "hit_count": 1, "active": True,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
