"""AllergyIntolerance.

Note: this bundle contains a real FHIR invariant violation (ait-1: clinicalStatus SHALL NOT be
present when verificationStatus is entered-in-error) on allergyintolerance-002 — same shape as
Condition's con-3 violation, see Knowledge.md. As with Condition, this model doesn't enforce that
invariant; it stays permissive so the violating resource still parses and can be reported on.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.models.common import CodeableConcept, Reference


class AllergyIntolerance(BaseModel):
    resourceType: Literal["AllergyIntolerance"] = "AllergyIntolerance"
    id: str
    clinicalStatus: CodeableConcept | None = None
    verificationStatus: CodeableConcept | None = None
    # Not validated against `system` here (e.g. allergyintolerance-001's SNOMED/LOINC code-shape
    # mismatch, see Knowledge.md) — structural parsing only, per this iteration's scope. Detecting
    # that kind of mismatch is a data-quality check for a later iteration, not a parse failure.
    code: CodeableConcept | None = None
    criticality: str | None = None
    patient: Reference | None = None
    # Raw string — partial precision (e.g. allergyintolerance-002's "2016") is spec-valid. See
    # app/models/__init__.py.
    recordedDate: str | None = None
