"""POST /validate — structural validation of a FHIR bundle against this project's Pydantic models.

Scope for this iteration (confirmed with Aaron before writing this): does the bundle parse into
the resource models we support? Reports per-resource-type counts and one issue per failing entry,
rather than aborting on the first bad one. Deeper data-quality flagging (entered-in-error,
dangling references, missing display, duplicate-patient detection, etc. — see
implementation-logs/Knowledge.md) is deliberately NOT done here; that's the
reconciliation/normalization pipeline's job, a later iteration.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import ValidationError

from app.core.errors import BadRequestError
from app.models.bundle import RESOURCE_MODELS
from app.models.validation import ValidationIssue, ValidationReport

router = APIRouter(tags=["validation"])


@router.post("/validate", response_model=ValidationReport)
def validate_bundle(bundle: dict[str, Any]) -> ValidationReport:
    if bundle.get("resourceType") != "Bundle":
        raise BadRequestError('Request body must be a FHIR Bundle (resourceType: "Bundle").')

    entries = bundle.get("entry")
    if not isinstance(entries, list):
        raise BadRequestError('Bundle must have an "entry" array.')

    resource_counts: dict[str, int] = {}
    errors: list[ValidationIssue] = []

    for index, entry in enumerate(entries):
        resource = entry.get("resource") if isinstance(entry, dict) else None
        if not isinstance(resource, dict):
            errors.append(
                ValidationIssue(
                    entry_index=index,
                    resource_type=None,
                    resource_id=None,
                    message='Entry is missing a "resource" object.',
                )
            )
            continue

        resource_type = resource.get("resourceType")
        resource_id = resource.get("id")
        model = RESOURCE_MODELS.get(resource_type)

        if model is None:
            errors.append(
                ValidationIssue(
                    entry_index=index,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    message=f"Unsupported resource type: {resource_type!r}.",
                )
            )
            continue

        try:
            model.model_validate(resource)
        except ValidationError as exc:
            detail = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
            errors.append(
                ValidationIssue(
                    entry_index=index,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    message=detail,
                )
            )
            continue

        resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1

    return ValidationReport(valid=not errors, resource_counts=resource_counts, errors=errors)
