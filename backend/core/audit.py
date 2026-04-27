"""Audit log helper (sync, in-band)."""
import uuid
from datetime import datetime, timezone
from typing import Any

from .db import get_db


async def log(
    *,
    user_id: str | None,
    entity_type: str,
    entity_id: str | None,
    action: str,
    before: Any = None,
    after: Any = None,
    reason: str | None = None,
) -> None:
    """Write an audit entry. Failures are swallowed (defensive) but logged."""
    try:
        db = get_db()
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "before": before,
            "after": after,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await db.audit_log.insert_one(doc)
    except Exception:  # noqa: BLE001
        import logging
        logging.getLogger("aurora.audit").exception("Audit log write failed")
