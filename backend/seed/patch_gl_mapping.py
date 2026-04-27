"""Patch the live system_settings.gl_mapping to add new HR keys without reseeding."""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from core.db import init_db, get_db, close_db


async def main():
    await init_db()
    db = get_db()
    s = await db.system_settings.find_one({"key": "gl_mapping"})
    if not s:
        print("ERROR: gl_mapping not found, please reseed first.")
        return
    mapping = s.get("value") or {}
    # Find COA codes
    coa_by_code = {}
    async for c in db.chart_of_accounts.find({}):
        coa_by_code[c.get("code")] = c["id"]
    needed = {
        "employee_advance_receivable": "1210",
    }
    changed = False
    for key, code in needed.items():
        if key not in mapping:
            if code in coa_by_code:
                mapping[key] = coa_by_code[code]
                changed = True
                print(f"  + Added: {key} → {code}")
            else:
                print(f"  ! COA code {code} not found, skipping {key}")
    if changed:
        from datetime import datetime, timezone
        await db.system_settings.update_one(
            {"key": "gl_mapping"},
            {"$set": {"value": mapping,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        print("GL mapping updated.")
    else:
        print("No changes needed.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
