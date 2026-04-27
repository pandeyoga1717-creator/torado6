"""Mongo client + collection helpers."""
import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger("aurora.db")

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def init_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongo_url, uuidRepresentation="standard")
    _db = _client[settings.db_name]
    await ensure_indexes()
    logger.info(f"DB ready: {settings.db_name}")


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("DB not initialized; call init_db() in lifespan")
    return _db


async def db_ping() -> bool:
    try:
        await get_db().command("ping")
        return True
    except Exception as e:  # noqa: BLE001
        logger.error(f"DB ping failed: {e}")
        return False


async def ensure_indexes() -> None:
    db = get_db()
    # Partial filter so soft-deleted docs don't trigger unique violation
    not_deleted = {"deleted_at": None}

    async def unique_partial(col_name: str, field: str):
        col = db[col_name]
        # Drop legacy non-partial index if exists, then create partial
        try:
            existing = await col.index_information()
            for name, info in existing.items():
                keys = info.get("key", [])
                if keys and len(keys) == 1 and keys[0][0] == field and info.get("unique"):
                    if "partialFilterExpression" not in info:
                        await col.drop_index(name)
                        break
        except Exception:  # noqa: BLE001
            pass
        await col.create_index(
            field, unique=True, partialFilterExpression=not_deleted, name=f"{field}_unique_partial",
        )

    # Users
    await unique_partial("users", "email")
    await db.users.create_index("id", unique=True)
    # Roles
    await unique_partial("roles", "code")
    await db.roles.create_index("id", unique=True)
    # Master collections (non-unique id index for fast lookup)
    for col in (
        "groups", "brands", "outlets", "items", "categories", "vendors",
        "employees", "chart_of_accounts", "tax_codes", "payment_methods",
        "bank_accounts", "number_series", "business_rules",
    ):
        await db[col].create_index("id", unique=True)
    # Code uniques (partial)
    for col, field in [
        ("brands", "code"), ("outlets", "code"), ("items", "code"),
        ("vendors", "code"), ("employees", "code"),
        ("chart_of_accounts", "code"), ("tax_codes", "code"),
        ("payment_methods", "code"), ("bank_accounts", "code"),
        ("number_series", "code"),
    ]:
        await unique_partial(col, field)
    # Audit, notifications
    await db.audit_log.create_index([("entity_type", 1), ("entity_id", 1), ("timestamp", -1)])
    await db.audit_log.create_index([("user_id", 1), ("timestamp", -1)])
    await db.notifications.create_index([("user_id", 1), ("read_at", 1), ("created_at", -1)])
    # Refresh tokens
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    logger.info("Indexes ensured")


def serialize(doc: Any) -> Any:
    """Recursively strip Mongo's _id and convert datetime to ISO."""
    from datetime import datetime
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "_id":
                continue
            out[k] = serialize(v)
        return out
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc
