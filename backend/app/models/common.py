"""Shared FHIR R4 datatype building blocks, used across multiple resource models.

Kept intentionally permissive (every field optional, no cross-field validation) — this layer's job
is structural shape, not clinical-correctness. See `app/models/__init__.py` for the modeling rules
this follows.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Coding(BaseModel):
    system: str | None = None
    code: str | None = None
    # Missing display is expected and valid in this bundle — never guessed/backfilled here or
    # anywhere downstream. See Assumptions.md.
    display: str | None = None


class CodeableConcept(BaseModel):
    coding: list[Coding] = Field(default_factory=list)
    text: str | None = None


class Identifier(BaseModel):
    system: str | None = None
    value: str | None = None
    use: str | None = None


class Reference(BaseModel):
    reference: str | None = None
    display: str | None = None

    @property
    def resource_type(self) -> str | None:
        """"Patient/patient-001" -> "Patient". None if `reference` is absent or unexpectedly shaped."""
        if self.reference and "/" in self.reference:
            return self.reference.split("/", 1)[0]
        return None

    @property
    def resource_id(self) -> str | None:
        """"Patient/patient-001" -> "patient-001". None if `reference` is absent or unexpectedly shaped."""
        if self.reference and "/" in self.reference:
            return self.reference.split("/", 1)[1]
        return None


class Period(BaseModel):
    # Kept as raw strings, same rationale as other date/dateTime fields — see module docstring.
    start: str | None = None
    end: str | None = None


class HumanName(BaseModel):
    use: str | None = None
    family: str | None = None
    given: list[str] = Field(default_factory=list)


class ContactPoint(BaseModel):
    system: str | None = None
    value: str | None = None
    use: str | None = None


class Address(BaseModel):
    line: list[str] = Field(default_factory=list)
    city: str | None = None
    state: str | None = None
    postalCode: str | None = None
    country: str | None = None


class Quantity(BaseModel):
    value: float | None = None
    unit: str | None = None
    system: str | None = None
    code: str | None = None


class Meta(BaseModel):
    profile: list[str] = Field(default_factory=list)


class Extension(BaseModel):
    """Generic FHIR extension. Only the value[x] variants actually seen in this project's bundle
    are modeled (valueString, valueCoding) — a new variant would be added when encountered, not
    guessed ahead of time."""

    model_config = ConfigDict(populate_by_name=True)

    url: str
    extension: list[Extension] = Field(default_factory=list)
    valueString: str | None = None
    valueCoding: Coding | None = None


Extension.model_rebuild()
