"""/api/auth router."""
from fastapi import APIRouter, Body, Depends, Header
from pydantic import BaseModel, EmailStr

from core.exceptions import ok_envelope
from core.security import current_user
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class ChangePwdIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
async def login(payload: LoginIn):
    data = await auth_service.login(payload.email, payload.password)
    return ok_envelope(data)


@router.post("/refresh")
async def refresh(payload: RefreshIn):
    data = await auth_service.refresh_session(payload.refresh_token)
    return ok_envelope(data)


@router.post("/logout")
async def logout(payload: RefreshIn | None = Body(default=None), user: dict = Depends(current_user)):
    await auth_service.logout(user["id"], payload.refresh_token if payload else None)
    return ok_envelope({"message": "Logged out"})


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return ok_envelope(await auth_service.me(user))


@router.post("/change-password")
async def change_pwd(payload: ChangePwdIn, user: dict = Depends(current_user)):
    await auth_service.change_password(user["id"], payload.old_password, payload.new_password)
    return ok_envelope({"message": "Password changed"})
