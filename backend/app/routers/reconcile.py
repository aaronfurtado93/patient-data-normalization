"""POST /reconcile — validates a bundle representing an already-reconciled/merged patient record:
the result of a HIL "Compare & Merge" selection, built client-side (see frontend/lib/reconcile.ts)
from the two source patients' raw resources plus the reviewer's per-item/per-field choices.

Runs through the exact same pipeline as POST /validate (app/services/validation_service.
run_validation) — kept as its own named route rather than reusing /validate directly so the two
intents stay distinguishable in the API (raw upload validation vs. re-validating a HIL merge
result), even though the underlying logic is identical today. A natural place to add
reconciliation-specific checks later (e.g. confirming a merge didn't silently drop something it
shouldn't have) without touching /validate's contract.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.models.validation import ValidationReport
from app.services.validation_service import run_validation

router = APIRouter(tags=["reconcile"])


@router.post("/reconcile", response_model=ValidationReport)
def reconcile_bundle(bundle: dict[str, Any]) -> ValidationReport:
    return run_validation(bundle)
