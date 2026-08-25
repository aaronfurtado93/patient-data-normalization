"""Patient — see ResearchNotes.md for the full spec-vs-bundle element comparison this is based on."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import Address, ContactPoint, Extension, HumanName, Identifier, Meta, Reference


class PatientLink(BaseModel):
    """The FHIR spec's own mechanism for declaring two Patient resources related/duplicate.

    Modeled even though it's absent on both patients in this bundle (per ResearchNotes.md) — its
    absence is exactly the signal that patient-001/patient-002 duplication is *inferred*, not a
    resolution of a declared link. Worth being able to represent if it's ever actually present.
    """

    other: Reference
    type: Literal["replaced-by", "replaces", "refer", "seealso"]


class Patient(BaseModel):
    resourceType: Literal["Patient"] = "Patient"
    id: str
    meta: Meta | None = None
    extension: list[Extension] = Field(default_factory=list)
    identifier: list[Identifier] = Field(default_factory=list)
    active: bool | None = None
    name: list[HumanName] = Field(default_factory=list)
    telecom: list[ContactPoint] = Field(default_factory=list)
    gender: str | None = None
    # Raw string, not a date type — FHIR birthDate allows year-only precision (e.g. "1958" on
    # patient-002). See app/models/__init__.py.
    birthDate: str | None = None
    address: list[Address] = Field(default_factory=list)
    link: list[PatientLink] = Field(default_factory=list)
