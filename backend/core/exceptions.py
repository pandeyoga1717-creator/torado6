"""Custom exceptions and unified error envelope."""
from typing import Any


class AuroraException(Exception):
    status_code: int = 400
    code: str = "GENERIC_ERROR"

    def __init__(self, message: str, *, code: str | None = None,
                 status_code: int | None = None, field: str | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.field = field


class NotFoundError(AuroraException):
    status_code = 404
    code = "NOT_FOUND"


class UnauthorizedError(AuroraException):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AuroraException):
    status_code = 403
    code = "FORBIDDEN"


class ValidationError(AuroraException):
    status_code = 400
    code = "VALIDATION_ERROR"


class ConflictError(AuroraException):
    status_code = 409
    code = "CONFLICT"


def ok_envelope(data: Any = None, meta: dict | None = None) -> dict:
    return {"success": True, "data": data, "errors": None, "meta": meta}


def error_envelope(code: str, message: str, field: str | None = None) -> dict:
    err = {"code": code, "message": message}
    if field:
        err["field"] = field
    return {"success": False, "data": None, "errors": [err], "meta": None}
