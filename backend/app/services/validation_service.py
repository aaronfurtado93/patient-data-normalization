"""The validation/discrepancy/completeness pipeline, factored out so `POST /validate` (raw
uploaded bundle) and `POST /reconcile` (a HIL merge result, built client-side) run through the
exact same logic rather than two copies that could quietly drift apart. See
app/clinical_normalization/ for the actual reconciliation/discrepancy logic this wires together.
"""

from __future__ import annotations

from typing import Any

from app.clinical_normalization.bundle_parser import parse_bundle_entries
from app.clinical_normalization.patient_card import build_patient_cards
from app.core.errors import BadRequestError
from app.models.validation import ValidationReport


def run_validation(bundle: dict[str, Any]) -> ValidationReport:
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