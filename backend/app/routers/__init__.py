"""Aggregates all domain routers into one include-able router.

Add a new resource as its own `<name>.py` module in this package (one file per route group, per
Aaron's feedback), then register it here rather than including it directly in `main.py`.
"""

from fastapi import APIRouter

from app.routers.health import router as health_router
from app.routers.reconcile import router as reconcile_router
from app.routers.sample_bundle import router as sample_bundle_router
from app.routers.validation import router as validation_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(sample_bundle_router)
api_router.include_router(validation_router)
api_router.include_router(reconcile_router)

__all__ = ["api_router"]
