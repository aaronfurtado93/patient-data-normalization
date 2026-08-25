"""Observation."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import CodeableConcept, Quantity, Reference


class ObservationComponent(BaseModel):
    code: CodeableConcept | None = None
    valueQuantity: Quantity | None = None


class Observation(BaseModel):
    resourceType: Literal["Observation"] = "Observation"
    id: str
    status: str
    category: list[CodeableConcept] = Field(default_factory=list)
    code: CodeableConcept | None = None
    subject: Reference | None = None
    encounter: Reference | None = None
    performer: list[Reference] = Field(default_factory=list)
    # Raw string — partial precision (e.g. observation-002's "2020") is spec-valid. See
    # app/models/__init__.py.
    effectiveDateTime: str | None = None
    valueQuantity: Quantity | None = None
    component: list[ObservationComponent] = Field(default_factory=list)
