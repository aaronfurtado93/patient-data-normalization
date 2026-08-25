"""Per-resource-type "is this current clinical fact, or must it be excluded" logic.

Never presented as current fact: entered-in-error status/verificationStatus, or inactive/resolved
clinicalStatus. Excluded resources are still returned by patient_card.py (its `excluded` bucket),
never silently dropped — per Assumptions.md. `MedicationRequest.status == "stopped"` is
deliberately NOT an exclusion here — it's the separate "past medications" bucket, handled by the
caller (patient_card.py), since a deliberate discontinuation is real history, not a data error.
"""

from __future__ import annotations

from app.models.allergy_intolerance import AllergyIntolerance
from app.models.common import CodeableConcept
from app.models.condition import Condition
from app.models.encounter import Encounter
from app.models.observation import Observation


def _first_code(concept: CodeableConcept | None) -> str | None:
    if concept is None or not concept.coding:
        return None
    return concept.coding[0].code


def encounter_exclusion_reasons(resource: Encounter) -> list[str]:
    if resource.status == "entered-in-error":
        return [f"status: {resource.status}"]
    return []


def condition_exclusion_reasons(resource: Condition) -> list[str]:
    reasons: list[str] = []
    verification_code = _first_code(resource.verificationStatus)
    clinical_code = _first_code(resource.clinicalStatus)
    if verification_code == "entered-in-error":
        reasons.append("verificationStatus: entered-in-error")
    if clinical_code in ("inactive", "resolved"):
        reasons.append(f"clinicalStatus: {clinical_code}")
    return reasons


def observation_exclusion_reasons(resource: Observation) -> list[str]:
    if resource.status == "entered-in-error":
        return [f"status: {resource.status}"]
    return []


def medication_request_exclusion_reasons(status: str) -> list[str]:
    if status == "entered-in-error":
        return [f"status: {status}"]
    return []


def allergy_intolerance_exclusion_reasons(resource: AllergyIntolerance) -> list[str]:
    reasons: list[str] = []
    verification_code = _first_code(resource.verificationStatus)
    clinical_code = _first_code(resource.clinicalStatus)
    if verification_code == "entered-in-error":
        reasons.append("verificationStatus: entered-in-error")
    if clinical_code in ("resolved", "inactive"):
        reasons.append(f"clinicalStatus: {clinical_code}")
    return reasons
