"""Response shape for the /validate endpoint. Structural validation only this iteration — see
Iteration-03.md for scope."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.patient_card import PatientCard


class ValidationIssue(BaseModel):
    entry_index: int
    resource_type: str | None
    resource_id: str | None
    message: str


class ValidationReport(BaseModel):
    valid: bool
    resource_counts: dict[str, int]
    errors: list[ValidationIssue] = Field(default_factory=list)
    # Iteration 04: the canonical patient's data, hierarchically bucketed with discrepancies
    # attached — built for UI rendering. None if the bundle has no Patient resource at all.
    patient: PatientCard | None = None
