"""Generate next document number per series code (atomic)."""
from datetime import datetime
from typing import Tuple

from core.db import get_db
from core.exceptions import NotFoundError


async def next_doc_no(code: str) -> str:
    """Atomically increment & format. Returns formatted doc no.
    Resets per format pattern (yearly/monthly automatically by including {YY}/{MM}).
    """
    db = get_db()
    # Atomic find_one_and_update with $inc
    series = await db.number_series.find_one_and_update(
        {"code": code},
        {"$inc": {"current_value": 1}},
        return_document=True,
    )
    if not series:
        raise NotFoundError(f"Number series '{code}' not configured")
    fmt = series.get("format", f"{code}-{{0000}}")
    padding = int(series.get("padding", 4))
    now = datetime.now()
    formatted = (
        fmt.replace("{YY}", now.strftime("%y"))
           .replace("{YYYY}", now.strftime("%Y"))
           .replace("{MM}", now.strftime("%m"))
           .replace("{0000}", str(series["current_value"]).zfill(padding))
    )
    return formatted
