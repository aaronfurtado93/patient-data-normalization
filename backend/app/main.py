"""Centauri Clinical Snapshot API — app entrypoint.

This file only wires things together. Route logic lives in `app/routers/` (one file per
resource/domain); error handling is centralized in `app/core/` (the `AppError` hierarchy +
exception handlers, registered once here) — no route should raise `HTTPException` directly or
register its own exception handler.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import register_exception_handlers
from app.routers import api_router

app = FastAPI(title="Centauri Clinical Snapshot API")

# Wide open for local dev scaffolding — no auth/multi-origin concerns per Assumptions.md scope.
# Revisit if this ever leaves localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router)
