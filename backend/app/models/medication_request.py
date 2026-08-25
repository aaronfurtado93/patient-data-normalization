"""MedicationRequest."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import CodeableConcept, Reference


class DosageInstruction(BaseModel):
    text: str | None = None


class MedicationRequest(BaseModel):
    resourceType: Literal["MedicationRequest"] = "MedicationRequest"
    id: str
    # Required binding includes "stopped" (medicationrequest-002) as a legal, non-error status —
    # distinct from "entered-in-error". See Assumptions.md's "past medications" bucket decision.
    status: str
    intent: str
    medicationCodeableConcept: CodeableConcept | None = None
    subject: Reference | None = None
    encounter: Reference | None = None
    # Raw string — partial precision (e.g. medicationrequest-002's "2022") is spec-valid. See
    # app/models/__init__.py.
    authoredOn: str | None = None
    dosageInstruction: list[DosageInstruction] = Field(default_factory=list)
