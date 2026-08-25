"""POST /validate — structural validation of a raw uploaded/sample FHIR bundle, plus the
patient-centric, discrepancy-annotated PatientCard(s) for UI rendering.

Logic lives in app/services/validation_service.py, shared with POST /reconcile (see reconcile.py)
so both routes run through the identical pipeline.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.models.validation import ValidationReport
from app.services.validation_service import run_validation

router = APIRouter(tags=["validation"])


@router.post("/validate", response_model=ValidationReport)
def validate_bundle(bundle: dict[str, Any]) -> ValidationReport:
    return run_validation(bundle)
