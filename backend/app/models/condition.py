"""Condition.

Note: this bundle contains a real FHIR invariant violation (con-3: clinicalStatus SHALL NOT be
present when verificationStatus is entered-in-error) on condition-002 — see Knowledge.md. This
model doesn't enforce that invariant; it's deliberately permissive so the violating resource still
parses and can be reported on, rather than being rejected outright. Enforcing spec invariants here
would make the "no guessing/backfilling, surface the real data" posture harder, not easier.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import CodeableConcept, Reference


class Condition(BaseModel):
    resourceType: Literal["Condition"] = "Condition"
    id: str
    clinicalStatus: CodeableConcept | None = None
    verificationStatus: CodeableConcept | None = None
    code: CodeableConcept | None = None
    subject: Reference | None = None
    encounter: Reference | None = None
    # Raw string — partial precision (e.g. condition-003's "2019") is spec-valid. See
    # app/models/__init__.py.
    onsetDateTime: str | None = None
