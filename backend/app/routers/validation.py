"""POST /validate — structural validation of a FHIR bundle against this project's Pydantic
models, plus (Iteration 04, extended Iteration 06) one patient-centric, discrepancy-annotated
PatientCard per distinct patient in the bundle, for UI rendering.

Structural validation (valid/resource_counts/errors) is unchanged from Iteration 03. `patients` is
built via app/clinical_normalization/ from whatever parsed successfully — see that package for the
identity-clustering/reconciliation/exclusion/discrepancy logic and Knowledge.md for the
data-quality catalog it detects.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.clinical_normalization.bundle_parser import parse_bundle_entries
from app.clinical_normalization.patient_card import build_patient_cards
from app.core.errors import BadRequestError
from app.models.validation import ValidationReport

router = APIRouter(tags=["validation"])


@router.post("/validate", response_model=ValidationReport)
def validate_bundle(bundle: dict[str, Any]) -> ValidationReport:
    if bundle.get("resourceType") != "Bundle":
        raise BadRequestError('Request body must be a FHIR Bundle (resourceType: "Bundle").')

    if not isinstance(bundle.get("entry"), list):
        raise BadRequestError('Bundle must have an "entry" array.')

    resources_by_type, errors = parse_bundle_entries(bundle)
    resource_counts = {resource_type: len(items) for resource_type, items in resources_by_type.items()}
    patient_cards = build_patient_cards(resources_by_type)

    return ValidationReport(
        valid=not errors,
        resource_counts=resource_counts,
        errors=errors,
        patients=patient_cards,
    )
