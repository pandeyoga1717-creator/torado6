"""Aurora F&B — FastAPI entrypoint (Phase 2 Foundation).

This is the SINGLE source of truth for application wiring.
Routers live in /app/backend/routers/.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from core.db import close_db, init_db  # noqa: E402
from core.exceptions import AuroraException, error_envelope  # noqa: E402

# Routers
from routers import admin, ai, anomalies, approvals, auth, executive, finance, forecasting, hr, inventory, master, notifications, outlet, procurement, reports, search  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("aurora")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    # Seed default approval workflows (idempotent — only inserts if missing)
    try:
        from services.approval_service import seed_defaults as _seed_wf
        n = await _seed_wf(user_id="system", overwrite=False)
        if n:
            logger.info(f"Seeded {n} default approval workflow(s)")
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Approval workflow seed failed: {e}")
    logger.info("Aurora backend started")
    try:
        yield
    finally:
        await close_db()
        logger.info("Aurora backend shut down")


app = FastAPI(
    title="Aurora F&B API",
    version="0.2.0",
    description="Integrated F&B ERP for Torado Group (multi-brand, multi-outlet, single-tenant).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handlers — always return our envelope
@app.exception_handler(AuroraException)
async def aurora_exception_handler(_, exc: AuroraException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(exc.code, exc.message, exc.field),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope("HTTP_ERROR", str(exc.detail)),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    errs = [
        {
            "code": "VALIDATION_ERROR",
            "field": ".".join(str(p) for p in e.get("loc", []) if p != "body"),
            "message": e.get("msg", "invalid"),
        }
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"success": False, "data": None, "errors": errs, "meta": None},
    )


# Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(master.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(outlet.router)
app.include_router(procurement.router)
app.include_router(inventory.router)
app.include_router(approvals.router)
app.include_router(ai.router)
app.include_router(finance.router)
app.include_router(executive.router)
app.include_router(hr.router)
app.include_router(reports.router)
app.include_router(forecasting.router)
app.include_router(anomalies.router)


@app.get("/api/health")
async def health():
    """Liveness probe."""
    from core.db import db_ping
    db_ok = await db_ping()
    return {
        "success": True,
        "data": {
            "version": "0.2.0",
            "status": "ok",
            "db": "ok" if db_ok else "down",
        },
        "errors": None,
        "meta": None,
    }


@app.get("/api/")
async def root():
    return {"success": True, "data": {"app": "Aurora F&B", "version": "0.2.0"}, "errors": None, "meta": None}
