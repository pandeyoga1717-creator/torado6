"""/api/master — master data CRUD per entity.
Generic pattern but each has its own validation.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ok_envelope, ValidationError
from core.security import current_user, require_perm
from repositories.base import Repo

router = APIRouter(prefix="/api/master", tags=["master"])

# Map URL slug → Mongo collection + uniq field for code
_ENTITIES: dict[str, dict] = {
    "groups":           {"col": "groups",            "uniq": None},
    "brands":           {"col": "brands",            "uniq": "code"},
    "outlets":          {"col": "outlets",           "uniq": "code"},
    "items":            {"col": "items",             "uniq": "code"},
    "categories":       {"col": "categories",        "uniq": "code"},
    "vendors":          {"col": "vendors",           "uniq": "code"},
    "employees":        {"col": "employees",         "uniq": "code"},
    "chart-of-accounts": {"col": "chart_of_accounts", "uniq": "code"},
    "tax-codes":        {"col": "tax_codes",         "uniq": "code"},
    "payment-methods":  {"col": "payment_methods",   "uniq": "code"},
    "bank-accounts":    {"col": "bank_accounts",     "uniq": "code"},
    "number-series":    {"col": "number_series",     "uniq": "code"},
}

_NAME_FIELDS: dict[str, str] = {
    "employees": "full_name",
}


def _get_entity(slug: str) -> dict:
    cfg = _ENTITIES.get(slug)
    if not cfg:
        raise NotFoundError(f"Entity '{slug}' not supported")
    return cfg


@router.get("/{entity}")
async def list_entity(
    entity: str,
    q: Optional[str] = None,
    active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    """Master data list — readable by any authenticated user.
    Outlet managers etc. need to see vendors, items, GL accounts, etc."""
    cfg = _get_entity(entity)
    db = get_db()
    query: dict = {"deleted_at": None}
    if active is not None:
        query["active"] = active
    if q:
        rx = {"$regex": q, "$options": "i"}
        name_field = _NAME_FIELDS.get(cfg["col"], "name")
        or_clauses = [{name_field: rx}]
        if cfg["uniq"]:
            or_clauses.append({cfg["uniq"]: rx})
        query["$or"] = or_clauses
    skip = (page - 1) * per_page
    sort_field = _NAME_FIELDS.get(cfg["col"], "name")
    cursor = db[cfg["col"]].find(query).sort(sort_field, 1).skip(skip).limit(per_page)
    items = await cursor.to_list(per_page)
    total = await db[cfg["col"]].count_documents(query)
    return ok_envelope([serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total})


@router.get("/{entity}/{id_}")
async def get_entity(entity: str, id_: str,
                     user: dict = Depends(current_user)):
    """Master data detail — readable by any authenticated user."""
    cfg = _get_entity(entity)
    db = get_db()
    d = await db[cfg["col"]].find_one({"id": id_, "deleted_at": None})
    if not d:
        raise NotFoundError(entity)
    return ok_envelope(serialize(d))


@router.post("/{entity}")
async def create_entity(entity: str, payload: dict,
                         user: dict = Depends(require_perm("admin.master_data.manage"))):
    cfg = _get_entity(entity)
    db = get_db()
    if cfg["uniq"]:
        code = payload.get(cfg["uniq"])
        if not code:
            raise ValidationError(f"Field '{cfg['uniq']}' wajib diisi", field=cfg["uniq"])
        if await db[cfg["col"]].find_one({cfg["uniq"]: code, "deleted_at": None}):
            raise ConflictError(f"{cfg['uniq']} '{code}' sudah ada", field=cfg["uniq"])
    doc = dict(payload)
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc["deleted_at"] = None
    doc["created_by"] = user["id"]
    doc.setdefault("active", True)
    try:
        await db[cfg["col"]].insert_one(doc)
    except DuplicateKeyError as e:
        # Belt-and-suspenders: index might still be non-partial in older deployments
        raise ConflictError(
            f"Duplicate key on {cfg['col']}: {e.details.get('keyValue', {})}",
            field=cfg["uniq"],
        )
    await audit_log(user_id=user["id"], entity_type=cfg["col"], entity_id=doc["id"],
                    action="create", after=serialize(doc))
    return ok_envelope(serialize(doc))


@router.patch("/{entity}/{id_}")
async def update_entity(entity: str, id_: str, payload: dict,
                         user: dict = Depends(require_perm("admin.master_data.manage"))):
    cfg = _get_entity(entity)
    db = get_db()
    before = await db[cfg["col"]].find_one({"id": id_, "deleted_at": None})
    if not before:
        raise NotFoundError(entity)
    patch = dict(payload)
    # Don't allow id, audit, code uniqueness conflicts in patch
    for k in ("id", "created_at", "created_by", "deleted_at"):
        patch.pop(k, None)
    if cfg["uniq"] and cfg["uniq"] in patch:
        new_code = patch[cfg["uniq"]]
        if new_code != before.get(cfg["uniq"]):
            if await db[cfg["col"]].find_one({cfg["uniq"]: new_code, "deleted_at": None, "id": {"$ne": id_}}):
                raise ConflictError(f"{cfg['uniq']} '{new_code}' sudah ada", field=cfg["uniq"])
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    patch["updated_by"] = user["id"]
    after = await db[cfg["col"]].find_one_and_update({"id": id_}, {"$set": patch}, return_document=True)
    await audit_log(user_id=user["id"], entity_type=cfg["col"], entity_id=id_,
                    action="update", before=serialize(before), after=serialize(after))
    return ok_envelope(serialize(after))


@router.delete("/{entity}/{id_}")
async def delete_entity(entity: str, id_: str,
                          user: dict = Depends(require_perm("admin.master_data.manage"))):
    cfg = _get_entity(entity)
    db = get_db()
    res = await db[cfg["col"]].update_one(
        {"id": id_, "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if not res.matched_count:
        raise NotFoundError(entity)
    await audit_log(user_id=user["id"], entity_type=cfg["col"], entity_id=id_, action="delete")
    return ok_envelope({"message": "Deleted"})
