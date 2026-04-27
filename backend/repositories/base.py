"""Generic Mongo repo with soft-delete & pagination."""
from datetime import datetime, timezone
from typing import Any

from core.db import get_db, serialize
from core.exceptions import NotFoundError


class Repo:
    def __init__(self, collection: str):
        self.collection = collection

    @property
    def col(self):
        return get_db()[self.collection]

    async def insert(self, doc: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        doc.setdefault("created_at", now)
        doc.setdefault("updated_at", now)
        doc.setdefault("deleted_at", None)
        await self.col.insert_one(doc)
        return serialize(doc)

    async def get(self, id_: str, *, include_deleted: bool = False) -> dict | None:
        q: dict = {"id": id_}
        if not include_deleted:
            q["deleted_at"] = None
        d = await self.col.find_one(q)
        return serialize(d)

    async def get_or_404(self, id_: str) -> dict:
        d = await self.get(id_)
        if not d:
            raise NotFoundError(f"{self.collection} {id_} not found")
        return d

    async def find_one(self, query: dict, *, include_deleted: bool = False) -> dict | None:
        if not include_deleted:
            query = {"deleted_at": None, **query}
        return serialize(await self.col.find_one(query))

    async def list(
        self,
        query: dict | None = None,
        *,
        page: int = 1,
        per_page: int = 20,
        sort: list[tuple[str, int]] | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[dict], dict]:
        query = dict(query or {})
        if not include_deleted:
            query.setdefault("deleted_at", None)
        per_page = min(max(1, per_page), 100)
        skip = (max(1, page) - 1) * per_page
        cursor = self.col.find(query)
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.skip(skip).limit(per_page)
        items = [serialize(d) async for d in cursor]
        total = await self.col.count_documents(query)
        return items, {"page": page, "per_page": per_page, "total": total}

    async def update(self, id_: str, patch: dict) -> dict:
        patch = dict(patch)
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = await self.col.find_one_and_update(
            {"id": id_, "deleted_at": None},
            {"$set": patch},
            return_document=True,
        )
        if not result:
            raise NotFoundError(f"{self.collection} {id_} not found")
        return serialize(result)

    async def soft_delete(self, id_: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        result = await self.col.update_one(
            {"id": id_, "deleted_at": None},
            {"$set": {"deleted_at": now, "updated_at": now}},
        )
        if result.matched_count == 0:
            raise NotFoundError(f"{self.collection} {id_} not found")

    async def count(self, query: dict | None = None, *, include_deleted: bool = False) -> int:
        query = dict(query or {})
        if not include_deleted:
            query.setdefault("deleted_at", None)
        return await self.col.count_documents(query)
