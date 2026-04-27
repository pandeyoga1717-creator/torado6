"""Auth, JWT, RBAC dependency."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, Header

from .config import settings
from .db import get_db
from .exceptions import ForbiddenError, UnauthorizedError


# ---------- Password hashing ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"),
                         bcrypt.gensalt(rounds=settings.bcrypt_cost)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:  # noqa: BLE001
        return False


# ---------- JWT ----------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: str, claims: dict) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(minutes=settings.access_token_minutes)).timestamp()),
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at)."""
    jti = str(uuid.uuid4())
    exp = _now() + timedelta(days=settings.refresh_token_days)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": jti,
        "iat": int(_now().timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), jti, exp


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as e:
        raise UnauthorizedError("Token expired", code="TOKEN_EXPIRED") from e
    except jwt.InvalidTokenError as e:
        raise UnauthorizedError("Invalid token", code="INVALID_TOKEN") from e


# ---------- Current user dependency ----------
async def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise UnauthorizedError("Wrong token type")
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token claims")
    db = get_db()
    user = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not user:
        raise UnauthorizedError("User not found or disabled")
    if user.get("status") != "active":
        raise UnauthorizedError("User disabled")
    return user


# ---------- Permission resolution ----------
async def get_user_permissions(user: dict) -> set[str]:
    """Resolve effective permissions from role_ids."""
    db = get_db()
    role_ids = user.get("role_ids", [])
    if not role_ids:
        return set()
    cursor = db.roles.find({"id": {"$in": role_ids}})
    perms: set[str] = set()
    async for r in cursor:
        perms.update(r.get("permissions", []))
    return perms


def require_perm(*perms: str):
    """FastAPI dependency: ensures user has ALL given perms (or '*' super)​."""
    async def dep(user: dict = Depends(current_user)) -> dict:
        user_perms = await get_user_permissions(user)
        if "*" in user_perms:
            return user
        missing = [p for p in perms if p not in user_perms]
        if missing:
            raise ForbiddenError(
                f"Missing permission: {', '.join(missing)}",
                code="INSUFFICIENT_PERMISSION",
            )
        return user
    return dep


def require_any_perm(*perms: str):
    """FastAPI dependency: ensures user has AT LEAST ONE of the given perms (or '*' super)."""
    async def dep(user: dict = Depends(current_user)) -> dict:
        user_perms = await get_user_permissions(user)
        if "*" in user_perms:
            return user
        if any(p in user_perms for p in perms):
            return user
        raise ForbiddenError(
            f"Requires any of: {', '.join(perms)}",
            code="INSUFFICIENT_PERMISSION",
        )
    return dep


async def is_super(user: dict) -> bool:
    perms = await get_user_permissions(user)
    return "*" in perms


def enforce_outlet_scope(user: dict, outlet_id: str | None) -> None:
    """Raises if user cannot access outlet (super always passes)."""
    if not outlet_id:
        return
    if outlet_id in user.get("outlet_ids", []):
        return
    raise ForbiddenError("Outlet not in your scope", code="OUTLET_OUT_OF_SCOPE")
