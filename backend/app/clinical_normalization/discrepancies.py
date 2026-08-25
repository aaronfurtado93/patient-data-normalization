"""The rest of the data-quality catalog beyond status-based exclusion (see status_filters.py):
missing coding display, dangling references, code/system mismatches, FHIR invariant violations,
and unconfirmed verification status. See implementation-logs/Knowledge.md for the catalog this
implements — deliberately does not go beyond what's documented there (e.g. no "implausible value"
or "missing reference range" detection, which would require inventing clinical thresholds this
project has no authority to assert — see Iteration-04.md for the reasoning).
"""

from __future__ import annotations

import re

from app.models.common import CodeableConcept, Reference
from app.models.patient_card import Discrepancy

# Matches this bundle's LOINC code shape (e.g. "4548-4", "7980-2") — used to flag a coding whose
# `system` says SNOMED CT but whose `code` looks LOINC-shaped, not a SNOMED CT SCTID (normally a
# longer pure-numeric string). See Knowledge.md — confirmed case: allergyintolerance-001.
_LOINC_SHAPED_CODE = re.compile(r"^\d+-\d+$")
_SNOMED_SYSTEM = "http://snomed.info/sct"


def missing_display_discrepancies(concept: CodeableConcept | None) -> list[Discrepancy]:
    if concept is None:
        return []
    return [
        Discrepancy(
            kind="missing_display",
            message=f"Coding {coding.system or '?'} {coding.code or '?'} has no display provided.",
        )
        for coding in concept.coding
        if coding.display is None
    ]


def code_system_mismatch_discrepancies(concept: CodeableConcept | None) -> list[Discrepancy]:
    if concept is None:
        return []
    return [
        Discrepancy(
            kind="code_system_mismatch",
            message=(
                f"Code {coding.code!r} is shaped like a LOINC code but declared under system "
                f"{coding.system} (SNOMED CT). Shown as-is, not corrected or reinterpreted."
            ),
        )
        for coding in concept.coding
        if coding.system == _SNOMED_SYSTEM and coding.code and _LOINC_SHAPED_CODE.match(coding.code)
    ]


def dangling_reference_discrepancy(
    reference: Reference | None, known_ids: set[tuple[str | None, str | None]], field_name: str
) -> Discrepancy | None:
    if reference is None or reference.reference is None:
        return None
    if (reference.resource_type, reference.resource_id) in known_ids:
        return None
    return Discrepancy(
        kind="dangling_reference",
        message=f'"{field_name}" reference {reference.reference!r} does not resolve to a resource in the bundle.',
    )


def invariant_violation_discrepancy(
    clinical_status: CodeableConcept | None, verification_status: CodeableConcept | None, invariant: str
) -> Discrepancy | None:
    """con-3 (Condition) / ait-1 (AllergyIntolerance): clinicalStatus SHALL NOT be present when
    verificationStatus is entered-in-error. Both being non-null with verificationStatus ==
    entered-in-error means the source data itself violates this — not just clinically stale."""
    if clinical_status is None:
        return None
    verification_code = verification_status.coding[0].code if verification_status and verification_status.coding else None
    if verification_code != "entered-in-error":
        return None
    return Discrepancy(
        kind="invariant_violation",
        message=f"Violates FHIR invariant {invariant}: clinicalStatus is present while verificationStatus is entered-in-error.",
    )


def unconfirmed_verification_discrepancy(verification_status: CodeableConcept | None) -> Discrepancy | None:
    if verification_status is None or not verification_status.coding:
        return None
    if verification_status.coding[0].code != "unconfirmed":
        return None
    return Discrepancy(kind="unconfirmed_verification", message="Verification status is unconfirmed.")
