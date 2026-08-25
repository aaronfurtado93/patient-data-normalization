"""Encounter."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.common import CodeableConcept, Coding, Period, Reference


class Encounter(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    resourceType: Literal["Encounter"] = "Encounter"
    id: str
    status: str
    # "class" is a reserved word in Python — aliased, not renamed away from the FHIR field name.
    class_: Coding | None = Field(default=None, alias="class")
    type: list[CodeableConcept] = Field(default_factory=list)
    subject: Reference | None = None
    period: Period | None = None
