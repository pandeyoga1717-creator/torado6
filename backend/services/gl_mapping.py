"""GL Mapping resolver — logical account name → actual coa_id.
Mapping stored in `system_settings` doc with key='gl_mapping'.
Missing keys raise so the issue is loud-and-early at journal time.
"""
import logging
from typing import Optional

from core.db import get_db
from core.exceptions import AuroraException

logger = logging.getLogger("aurora.gl_mapping")

_cache: dict | None = None


async def get_mapping() -> dict:
    """Returns flat dict logical_name → coa_id (cached)."""
    global _cache
    if _cache is not None:
        return _cache
    db = get_db()
    s = await db.system_settings.find_one({"key": "gl_mapping"})
    if not s or not s.get("value"):
        raise AuroraException(
            "GL mapping belum dikonfigurasi. Jalankan seed atau setup di Admin > System Settings.",
            code="GL_MAPPING_MISSING", status_code=500,
        )
    _cache = s["value"]
    return _cache


async def resolve(logical: str, *, scope_outlet_id: Optional[str] = None) -> str:
    """Get coa_id for logical name. Supports per-outlet maps like inventory.{outlet_id}."""
    m = await get_mapping()
    # Check scoped first
    if scope_outlet_id:
        scoped = m.get(f"{logical}.{scope_outlet_id}")
        if scoped:
            return scoped
    # Check direct
    val = m.get(logical)
    if isinstance(val, dict) and scope_outlet_id:
        val = val.get(scope_outlet_id) or val.get("default")
    if not val:
        raise AuroraException(
            f"GL mapping untuk '{logical}' belum diset",
            code="GL_MAPPING_MISSING", status_code=500,
        )
    return val


def invalidate_cache():
    global _cache
    _cache = None
