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
    # Iteration 04: hierarchically bucketed patient data with discrepancies attached, for UI
    # rendering. Iteration 06: one PatientCard per distinct patient-identity cluster in the bundle
    # (was a single optional `patient` field before — renamed/pluralized since a bundle can now
    # produce more than one card). Empty list if the bundle has no Patient resource at all.
    patients: list[PatientCard] = Field(default_factory=list)
