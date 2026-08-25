"""Canonical-patient selection + unresolved-duplicate flagging.

Scope note: this project handles one bundle at a time (MVP, per Assumptions.md) — this does NOT
attempt generic multi-patient identity matching across unrelated people (fuzzy name/DOB matching
across a whole population would be a much larger, riskier undertaking, and isn't needed at this
scope). Any Patient resource beyond the most complete one found in the bundle is treated as a
possible duplicate of it. This generalizes the specific patient-001/patient-002 reasoning already
documented in Assumptions.md just far enough to avoid hardcoding those literal ids — not further.
"""

from __future__ import annotations

from app.models.patient import Patient

_US_CORE_PATIENT_PROFILE = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
_SSN_SYSTEM = "http://hl7.org/fhir/sid/us-ssn"


def _birth_date_precision_score(birth_date: str | None) -> int:
    """"1958" -> 1, "1958-03" -> 2, "1958-03-12" -> 3. More precision = more complete."""
    if not birth_date:
        return 0
    return len(birth_date.split("-"))


def completeness_score(patient: Patient) -> int:
    """Higher = more complete/spec-conformant. Mirrors the reasoning already documented in
    Assumptions.md for why patient-001 is canonical: US Core profile conformance, an SSN
    identifier, full-precision birthDate, and demographic extensions all count in its favor."""
    score = 0
    if patient.meta and _US_CORE_PATIENT_PROFILE in patient.meta.profile:
        score += 10
    if any(identifier.system == _SSN_SYSTEM for identifier in patient.identifier):
        score += 5
    score += _birth_date_precision_score(patient.birthDate)
    score += len(patient.extension)
    score += len(patient.identifier)
    return score


def reconcile_patients(patients: list[Patient]) -> tuple[Patient, list[Patient]]:
    """Returns (canonical, [every other Patient — each treated as an unresolved probable
    duplicate, surfaced as such rather than merged or dropped])."""
    ranked = sorted(patients, key=completeness_score, reverse=True)
    return ranked[0], ranked[1:]
