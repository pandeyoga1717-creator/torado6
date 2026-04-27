"""Auth service: register, login, refresh, logout, change pwd."""
import uuid
from datetime import datetime, timedelta, timezone

from core.audit import log as audit_log
from core.config import settings
from core.db import get_db, serialize
from core.exceptions import (
    ConflictError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    get_user_permissions,
)


async def _user_to_safe_dict(user: dict) -> dict:
    """Strip sensitive fields & include effective permissions."""
    safe = serialize(user)
    safe.pop("password_hash", None)
    safe.pop("failed_login_count", None)
    safe.pop("locked_until", None)
    perms = await get_user_permissions(user)
    safe["permissions"] = sorted(list(perms))
    return safe


async def login(email: str, password: str) -> dict:
    db = get_db()
    email_lc = email.lower().strip()
    user = await db.users.find_one({"email": email_lc, "deleted_at": None})
    if not user:
        raise UnauthorizedError("Email atau password salah", code="INVALID_CREDENTIALS")
    # Lockout check
    locked_until = user.get("locked_until")
    if locked_until:
        try:
            if datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
                raise UnauthorizedError(
                    "Akun terkunci sementara, coba lagi nanti", code="ACCOUNT_LOCKED"
                )
        except (TypeError, ValueError):
            pass
    if not verify_password(password, user.get("password_hash", "")):
        # Increment failed count, lockout if >= 5
        new_count = user.get("failed_login_count", 0) + 1
        update: dict = {"failed_login_count": new_count}
        if new_count >= 5:
            update["locked_until"] = (datetime.now(timezone.utc)
                                       + timedelta(minutes=15)).isoformat()
        await db.users.update_one({"id": user["id"]}, {"$set": update})
        raise UnauthorizedError("Email atau password salah", code="INVALID_CREDENTIALS")
    if user.get("status") != "active":
        raise UnauthorizedError("Akun dinonaktifkan", code="USER_DISABLED")

    # Reset fails, set last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "last_login_at": datetime.now(timezone.utc).isoformat(),
            "failed_login_count": 0,
            "locked_until": None,
        }},
    )

    perms = await get_user_permissions(user)
    access = create_access_token(user["id"], {
        "email": user["email"],
        "name": user["full_name"],
    })
    refresh, jti, exp = create_refresh_token(user["id"])
    await db.refresh_tokens.insert_one({
        "id": str(uuid.uuid4()), "jti": jti, "user_id": user["id"],
        "expires_at": exp,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "revoked_at": None,
    })
    await audit_log(user_id=user["id"], entity_type="auth", entity_id=user["id"],
                    action="login")

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": await _user_to_safe_dict(user),
    }


async def refresh_session(refresh_token: str) -> dict:
    db = get_db()
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise UnauthorizedError("Wrong token type")
    jti = payload.get("jti")
    rec = await db.refresh_tokens.find_one({"jti": jti})
    if not rec or rec.get("revoked_at"):
        raise UnauthorizedError("Refresh token revoked", code="REFRESH_REVOKED")
    user = await db.users.find_one({"id": payload["sub"], "deleted_at": None})
    if not user or user.get("status") != "active":
        raise UnauthorizedError("User not found or disabled")
    access = create_access_token(user["id"], {
        "email": user["email"], "name": user["full_name"],
    })
    return {"access_token": access, "token_type": "bearer"}


async def logout(user_id: str, refresh_token: str | None = None) -> None:
    db = get_db()
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti")
            if jti:
                await db.refresh_tokens.update_one(
                    {"jti": jti},
                    {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
                )
        except Exception:  # noqa: BLE001
            pass
    await audit_log(user_id=user_id, entity_type="auth", entity_id=user_id, action="logout")


async def change_password(user_id: str, old_password: str, new_password: str) -> None:
    if len(new_password) < 8:
        raise ValidationError("Password minimal 8 karakter", field="new_password")
    db = get_db()
    user = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not user:
        raise NotFoundError("User")
    if not verify_password(old_password, user.get("password_hash", "")):
        raise UnauthorizedError("Password lama salah", code="INVALID_CREDENTIALS")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(new_password),
                 "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await audit_log(user_id=user_id, entity_type="user", entity_id=user_id,
                    action="change_password")


async def me(user: dict) -> dict:
    return await _user_to_safe_dict(user)
