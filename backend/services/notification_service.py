"""Notification service."""
import uuid
from datetime import datetime, timezone

from core.db import get_db, serialize


async def push(*, user_id: str, type: str, title: str, body: str | None = None,
               link: str | None = None, source_type: str | None = None,
               source_id: str | None = None) -> dict:
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "link": link,
        "source_type": source_type,
        "source_id": source_id,
        "read_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)
    return serialize(doc)


async def list_for(user_id: str, *, unread_only: bool = False, page: int = 1, per_page: int = 20):
    db = get_db()
    q: dict = {"user_id": user_id}
    if unread_only:
        q["read_at"] = None
    skip = (max(1, page) - 1) * per_page
    items = await db.notifications.find(q).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.notifications.count_documents(q)
    unread = await db.notifications.count_documents({"user_id": user_id, "read_at": None})
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total, "unread": unread}


async def mark_read(user_id: str, notif_id: str) -> None:
    db = get_db()
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user_id},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}},
    )


async def mark_all_read(user_id: str) -> int:
    db = get_db()
    res = await db.notifications.update_many(
        {"user_id": user_id, "read_at": None},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return res.modified_count
