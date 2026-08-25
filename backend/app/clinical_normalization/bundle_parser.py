"""Turns raw bundle JSON into typed resources, bucketed by resourceType.

Shared by /validate's structural report and clinical_normalization's card-building, so there's
exactly one place that walks bundle.entry and decides what parses — the two callers never
disagree about what counts as a valid entry.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ValidationError

from app.models.bundle import RESOURCE_MODELS
from app.models.validation import ValidationIssue


def parse_bundle_entries(bundle: dict[str, Any]) -> tuple[dict[str, list[BaseModel]], list[ValidationIssue]]:
    """Returns (resources_by_type, errors).

    One error per problem entry — a bad entry never prevents the rest of the bundle from being
    parsed and reported on. Assumes the caller has already confirmed `bundle["resourceType"] ==
    "Bundle"`; this only cares about `entry`.
    """
    entries = bundle.get("entry")
    resources_by_type: dict[str, list[BaseModel]] = {}
    errors: list[ValidationIssue] = []

    if not isinstance(entries, list):
        return resources_by_type, errors

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
            parsed = model.model_validate(resource)
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

        resources_by_type.setdefault(resource_type, []).append(parsed)

    return resources_by_type, errors
