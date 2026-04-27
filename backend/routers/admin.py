"""/api/admin router — users, roles, audit log, permissions catalog, system settings."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel, EmailStr, Field

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError, ok_envelope
from core.perms_catalog import PERMISSIONS_CATALOG
from core.security import current_user, hash_password, require_perm
from repositories.base import Repo
from services import approval_service

router = APIRouter(prefix="/api/admin", tags=["admin"])

users_repo = Repo("users")
roles_repo = Repo("roles")


# ---------- USERS ----------
class UserCreateIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)
    role_ids: list[str] = []
    outlet_ids: list[str] = []
    brand_ids: list[str] = []
    phone: Optional[str] = None
    default_portal: Optional[str] = None
    status: str = "active"


class UserUpdateIn(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_ids: Optional[list[str]] = None
    outlet_ids: Optional[list[str]] = None
    brand_ids: Optional[list[str]] = None
    default_portal: Optional[str] = None
    status: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordResetIn(BaseModel):
    new_password: str = Field(min_length=8)


@router.get("/users")
async def list_users(
    q: Optional[str] = None,
    status: Optional[str] = None,
    role_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("admin.user.read")),
):
    db = get_db()
    query: dict = {"deleted_at": None}
    if status:
        query["status"] = status
    if role_id:
        query["role_ids"] = role_id
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"full_name": rx}, {"email": rx}]
    skip = (page - 1) * per_page
    items = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.users.count_documents(query)
    return ok_envelope([serialize(u) for u in items], {"page": page, "per_page": per_page, "total": total})


@router.post("/users")
async def create_user(payload: UserCreateIn, user: dict = Depends(require_perm("admin.user.create"))):
    db = get_db()
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise ConflictError(f"Email '{email}' sudah terdaftar", field="email")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "avatar_url": None,
        "status": payload.status,
        "role_ids": payload.role_ids,
        "outlet_ids": payload.outlet_ids,
        "brand_ids": payload.brand_ids,
        "default_portal": payload.default_portal,
        "last_login_at": None,
        "failed_login_count": 0,
        "locked_until": None,
        "mfa_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
        "created_by": user["id"],
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError as e:
        raise ConflictError(
            f"Email atau ID sudah ada: {e.details.get('keyValue', {})}",
            field="email",
        )
    await audit_log(user_id=user["id"], entity_type="user", entity_id=doc["id"], action="create", after=serialize(doc))
    res = serialize(doc)
    res.pop("password_hash", None)
    return ok_envelope(res)


@router.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(require_perm("admin.user.read"))):
    db = get_db()
    u = await db.users.find_one({"id": user_id, "deleted_at": None}, {"password_hash": 0})
    if not u:
        raise NotFoundError("User")
    return ok_envelope(serialize(u))


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateIn, user: dict = Depends(require_perm("admin.user.update"))):
    db = get_db()
    before = await db.users.find_one({"id": user_id, "deleted_at": None}, {"password_hash": 0})
    if not before:
        raise NotFoundError("User")
    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not patch:
        return ok_envelope(serialize(before))
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    patch["updated_by"] = user["id"]
    after = await db.users.find_one_and_update(
        {"id": user_id}, {"$set": patch},
        return_document=True, projection={"password_hash": 0},
    )
    await audit_log(user_id=user["id"], entity_type="user", entity_id=user_id,
                    action="update", before=serialize(before), after=serialize(after))
    return ok_envelope(serialize(after))


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, payload: PasswordResetIn,
                          user: dict = Depends(require_perm("admin.user.reset_password"))):
    db = get_db()
    u = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not u:
        raise NotFoundError("User")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.new_password),
                 "failed_login_count": 0, "locked_until": None,
                 "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await audit_log(user_id=user["id"], entity_type="user", entity_id=user_id,
                    action="reset_password")
    return ok_envelope({"message": "Password reset"})


@router.delete("/users/{user_id}")
async def disable_user(user_id: str, user: dict = Depends(require_perm("admin.user.disable"))):
    db = get_db()
    if user_id == user["id"]:
        raise ValidationError("Tidak dapat menonaktifkan diri sendiri")
    res = await db.users.update_one(
        {"id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat(),
                 "status": "disabled",
                 "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if not res.matched_count:
        raise NotFoundError("User")
    await audit_log(user_id=user["id"], entity_type="user", entity_id=user_id, action="disable")
    return ok_envelope({"message": "User disabled"})


# ---------- ROLES ----------
class RoleCreateIn(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    permissions: list[str] = []


class RoleUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None


@router.get("/roles")
async def list_roles(user: dict = Depends(require_perm("admin.role.manage"))):
    items, _ = await roles_repo.list({}, page=1, per_page=100, sort=[("name", 1)])
    return ok_envelope(items)


@router.post("/roles")
async def create_role(payload: RoleCreateIn, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    if await db.roles.find_one({"code": payload.code, "deleted_at": None}):
        raise ConflictError(f"Role code '{payload.code}' sudah ada", field="code")
    doc = {
        "id": str(uuid.uuid4()),
        "code": payload.code,
        "name": payload.name,
        "description": payload.description,
        "permissions": payload.permissions,
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
        "created_by": user["id"],
    }
    try:
        await db.roles.insert_one(doc)
    except DuplicateKeyError as e:
        raise ConflictError(
            f"Role code sudah ada: {e.details.get('keyValue', {})}",
            field="code",
        )
    await audit_log(user_id=user["id"], entity_type="role", entity_id=doc["id"], action="create", after=serialize(doc))
    return ok_envelope(serialize(doc))


@router.patch("/roles/{role_id}")
async def update_role(role_id: str, payload: RoleUpdateIn, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    before = await db.roles.find_one({"id": role_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Role")
    if before.get("is_system"):
        raise ValidationError("System role tidak dapat diubah")
    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    after = await db.roles.find_one_and_update(
        {"id": role_id}, {"$set": patch}, return_document=True,
    )
    await audit_log(user_id=user["id"], entity_type="role", entity_id=role_id,
                    action="update", before=serialize(before), after=serialize(after))
    return ok_envelope(serialize(after))


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    role = await db.roles.find_one({"id": role_id, "deleted_at": None})
    if not role:
        raise NotFoundError("Role")
    if role.get("is_system"):
        raise ValidationError("System role tidak dapat dihapus")
    # Check usage
    in_use = await db.users.count_documents({"role_ids": role_id, "deleted_at": None})
    if in_use:
        raise ValidationError(f"Role masih dipakai oleh {in_use} user")
    await db.roles.update_one({"id": role_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}})
    await audit_log(user_id=user["id"], entity_type="role", entity_id=role_id, action="delete")
    return ok_envelope({"message": "Role deleted"})


# ---------- PERMISSIONS CATALOG ----------
@router.get("/permissions")
async def permissions_catalog(user: dict = Depends(current_user)):
    return ok_envelope(PERMISSIONS_CATALOG)


# ---------- AUDIT LOG ----------
@router.get("/audit-log")
async def list_audit_log(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("admin.audit_log.read")),
):
    db = get_db()
    query: dict = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    skip = (page - 1) * per_page
    items = await db.audit_log.find(query).sort("timestamp", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.audit_log.count_documents(query)
    return ok_envelope([serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total})


# ---------- BUSINESS RULES — APPROVAL WORKFLOWS ----------
@router.get("/business-rules")
async def list_business_rules(
    rule_type: Optional[str] = "approval_workflow",
    entity_type: Optional[str] = None,
    user: dict = Depends(require_perm("admin.workflow.manage")),
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if rule_type:
        q["rule_type"] = rule_type
    if entity_type:
        q["rule_data.entity_type"] = entity_type
    items = await db.business_rules.find(q).sort([("rule_data.entity_type", 1), ("active", -1), ("version", -1)]).to_list(500)
    return ok_envelope([serialize(d) for d in items])


@router.get("/business-rules/{rule_id}")
async def get_business_rule(rule_id: str, user: dict = Depends(require_perm("admin.workflow.manage"))):
    db = get_db()
    doc = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Rule")
    return ok_envelope(serialize(doc))


@router.post("/business-rules")
async def create_business_rule(payload: dict = Body(...),
                                user: dict = Depends(require_perm("admin.workflow.manage"))):
    rt = payload.get("rule_type", "approval_workflow")
    if rt != "approval_workflow":
        raise ValidationError("Hanya rule_type='approval_workflow' yang didukung saat ini")
    return ok_envelope(await approval_service.create_workflow(payload, user=user))


@router.patch("/business-rules/{rule_id}")
async def update_business_rule(rule_id: str, payload: dict = Body(...),
                                user: dict = Depends(require_perm("admin.workflow.manage"))):
    return ok_envelope(await approval_service.update_workflow(rule_id, payload, user=user))


@router.delete("/business-rules/{rule_id}")
async def delete_business_rule(rule_id: str, user: dict = Depends(require_perm("admin.workflow.manage"))):
    await approval_service.delete_workflow(rule_id, user=user)
    return ok_envelope({"message": "Rule deleted"})


@router.post("/business-rules/seed-defaults")
async def seed_default_workflows(payload: dict = Body(default={}),
                                  user: dict = Depends(require_perm("admin.workflow.manage"))):
    n = await approval_service.seed_defaults(user_id=user["id"], overwrite=bool(payload.get("overwrite", False)))
    return ok_envelope({"inserted": n})


@router.get("/approval-entity-types")
async def approval_entity_types(user: dict = Depends(require_perm("admin.workflow.manage"))):
    return ok_envelope([
        {"value": "purchase_request",  "label": "Purchase Request (PR)"},
        {"value": "purchase_order",    "label": "Purchase Order (PO)"},
        {"value": "stock_adjustment",  "label": "Stock Adjustment"},
        {"value": "payment_request",   "label": "Payment Request (PAY)"},
        {"value": "employee_advance",  "label": "Employee Advance (EA)"},
    ])
