"""Assembles a PatientCard: the canonical patient + every resource in the bundle that references
it (or a flagged duplicate), bucketed by type, with discrepancies attached per item.

Deliberately written as explicit per-resource-type blocks rather than one generic loop — more
boilerplate, but each block is auditable on its own for a project where getting this logic wrong
has real clinical-data-safety implications. See implementation-logs/Knowledge.md for the catalog
this surfaces and Assumptions.md for the data-handling rules behind each bucket.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.clinical_normalization import discrepancies as disc
from app.clinical_normalization import status_filters
from app.clinical_normalization.patient_reconciliation import reconcile_patients
from app.models.allergy_intolerance import AllergyIntolerance
from app.models.common import Reference
from app.models.condition import Condition
from app.models.encounter import Encounter
from app.models.medication_request import MedicationRequest
from app.models.observation import Observation
from app.models.patient import Patient
from app.models.patient_card import Discrepancy, PatientCard, PossibleDuplicatePatient, ResourceCardItem


def _patient_display_name(patient: Patient) -> str | None:
    if not patient.name:
        return None
    name = patient.name[0]
    parts = [*name.given, name.family] if name.family else list(name.given)
    return " ".join(p for p in parts if p) or None


def _patient_identifiers(patient: Patient) -> list[str]:
    return [identifier.value for identifier in patient.identifier if identifier.value]


def _known_ids(resources_by_type: dict[str, list[BaseModel]]) -> set[tuple[str | None, str | None]]:
    known: set[tuple[str | None, str | None]] = set()
    for resource_type, resources in resources_by_type.items():
        for resource in resources:
            resource_id = getattr(resource, "id", None)
            if resource_id:
                known.add((resource_type, resource_id))
    return known


def _subject_patient_id(reference: Reference | None) -> str | None:
    return reference.resource_id if reference else None


def build_patient_card(resources_by_type: dict[str, list[BaseModel]]) -> PatientCard | None:
    patients: list[Patient] = resources_by_type.get("Patient", [])  # type: ignore[assignment]
    if not patients:
        return None

    canonical, duplicates = reconcile_patients(patients)
    duplicate_ids = {p.id for p in duplicates}
    known_ids = _known_ids(resources_by_type)

    card = PatientCard(
        patient_id=canonical.id,
        name=_patient_display_name(canonical),
        birth_date=canonical.birthDate,
        identifiers=_patient_identifiers(canonical),
        possible_duplicates=[
            PossibleDuplicatePatient(
                patient_id=dup.id,
                name=_patient_display_name(dup),
                birth_date=dup.birthDate,
                identifiers=_patient_identifiers(dup),
            )
            for dup in duplicates
        ],
    )

    # The duplicate flag itself counts as a discrepancy, even before any per-item ones.
    total_discrepancies = len(duplicates)

    def linked_patient_discrepancy(patient_ref_id: str | None) -> Discrepancy | None:
        if patient_ref_id is None or patient_ref_id == canonical.id or patient_ref_id not in duplicate_ids:
            return None
        return Discrepancy(
            kind="unresolved_duplicate_patient_link",
            message=(
                f"Linked to unresolved duplicate patient record ({patient_ref_id}), not the "
                f"canonical patient ({canonical.id}) — verify before treating as current."
            ),
        )

    def belongs_to_this_patient(patient_ref_id: str | None) -> bool:
        # A resource with no subject at all isn't excludable on that basis — surfaced rather than
        # silently dropped, per the project's "don't hide it" posture. A resource whose subject
        # points to some other, unrelated patient id doesn't belong on this card at all.
        return patient_ref_id is None or patient_ref_id == canonical.id or patient_ref_id in duplicate_ids

    # --- Encounters ---
    for enc in resources_by_type.get("Encounter", []):
        assert isinstance(enc, Encounter)
        patient_ref_id = _subject_patient_id(enc.subject)
        if not belongs_to_this_patient(patient_ref_id):
            continue

        item_discrepancies: list[Discrepancy] = [
            Discrepancy(kind="excluded_entered_in_error", message=reason)
            for reason in status_filters.encounter_exclusion_reasons(enc)
        ]
        excluded = bool(item_discrepancies)
        if link_disc := linked_patient_discrepancy(patient_ref_id):
            item_discrepancies.append(link_disc)

        summary = "Encounter"
        if enc.type and enc.type[0].coding:
            summary = enc.type[0].coding[0].display or enc.type[0].coding[0].code or summary

        item = ResourceCardItem(
            resource_type="Encounter",
            resource_id=enc.id,
            summary=summary,
            status=enc.status,
            excluded=excluded,
            discrepancies=item_discrepancies,
        )
        total_discrepancies += len(item_discrepancies)
        (card.excluded if excluded else card.encounters).append(item)

    # --- Conditions ---
    for cond in resources_by_type.get("Condition", []):
        assert isinstance(cond, Condition)
        patient_ref_id = _subject_patient_id(cond.subject)
        if not belongs_to_this_patient(patient_ref_id):
            continue

        exclusion_reasons = status_filters.condition_exclusion_reasons(cond)
        item_discrepancies = [
            Discrepancy(
                kind="excluded_inactive_or_resolved" if reason.startswith("clinicalStatus") else "excluded_entered_in_error",
                message=reason,
            )
            for reason in exclusion_reasons
        ]
        excluded = bool(item_discrepancies)

        if inv := disc.invariant_violation_discrepancy(cond.clinicalStatus, cond.verificationStatus, "con-3"):
            item_discrepancies.append(inv)
        item_discrepancies.extend(disc.missing_display_discrepancies(cond.code))
        if dangling := disc.dangling_reference_discrepancy(cond.encounter, known_ids, "encounter"):
            item_discrepancies.append(dangling)
        if link_disc := linked_patient_discrepancy(patient_ref_id):
            item_discrepancies.append(link_disc)

        summary = "Condition"
        if cond.code:
            if cond.code.text:
                summary = cond.code.text
            elif cond.code.coding:
                summary = cond.code.coding[0].display or cond.code.coding[0].code or summary

        item = ResourceCardItem(
            resource_type="Condition",
            resource_id=cond.id,
            summary=summary,
            status=cond.clinicalStatus.coding[0].code if cond.clinicalStatus and cond.clinicalStatus.coding else None,
            excluded=excluded,
            discrepancies=item_discrepancies,
        )
        total_discrepancies += len(item_discrepancies)
        (card.excluded if excluded else card.conditions).append(item)

    # --- Observations ---
    for obs in resources_by_type.get("Observation", []):
        assert isinstance(obs, Observation)
        patient_ref_id = _subject_patient_id(obs.subject)
        if not belongs_to_this_patient(patient_ref_id):
            continue

        item_discrepancies = [
            Discrepancy(kind="excluded_entered_in_error", message=reason)
            for reason in status_filters.observation_exclusion_reasons(obs)
        ]
        excluded = bool(item_discrepancies)

        item_discrepancies.extend(disc.missing_display_discrepancies(obs.code))
        for performer in obs.performer:
            if dangling := disc.dangling_reference_discrepancy(performer, known_ids, "performer"):
                item_discrepancies.append(dangling)
        if link_disc := linked_patient_discrepancy(patient_ref_id):
            item_discrepancies.append(link_disc)

        summary = "Observation"
        if obs.code and obs.code.coding:
            summary = obs.code.coding[0].display or obs.code.coding[0].code or summary

        item = ResourceCardItem(
            resource_type="Observation",
            resource_id=obs.id,
            summary=summary,
            status=obs.status,
            excluded=excluded,
            discrepancies=item_discrepancies,
        )
        total_discrepancies += len(item_discrepancies)
        (card.excluded if excluded else card.observations).append(item)

    # --- MedicationRequests (three-way: active / past / excluded) ---
    for med in resources_by_type.get("MedicationRequest", []):
        assert isinstance(med, MedicationRequest)
        patient_ref_id = _subject_patient_id(med.subject)
        if not belongs_to_this_patient(patient_ref_id):
            continue

        item_discrepancies = [
            Discrepancy(kind="excluded_entered_in_error", message=reason)
            for reason in status_filters.medication_request_exclusion_reasons(med.status)
        ]
        excluded = bool(item_discrepancies)

        item_discrepancies.extend(disc.missing_display_discrepancies(med.medicationCodeableConcept))
        if link_disc := linked_patient_discrepancy(patient_ref_id):
            item_discrepancies.append(link_disc)

        summary = "Medication"
        if med.medicationCodeableConcept and med.medicationCodeableConcept.coding:
            summary = med.medicationCodeableConcept.coding[0].display or med.medicationCodeableConcept.coding[0].code or summary

        item = ResourceCardItem(
            resource_type="MedicationRequest",
            resource_id=med.id,
            summary=summary,
            status=med.status,
            excluded=excluded,
            discrepancies=item_discrepancies,
        )
        total_discrepancies += len(item_discrepancies)
        if excluded:
            card.excluded.append(item)
        elif med.status == "stopped":
            card.medications_past.append(item)
        else:
            card.medications_active.append(item)

    # --- AllergyIntolerances ---
    for allergy in resources_by_type.get("AllergyIntolerance", []):
        assert isinstance(allergy, AllergyIntolerance)
        patient_ref_id = _subject_patient_id(allergy.patient)
        if not belongs_to_this_patient(patient_ref_id):
            continue

        exclusion_reasons = status_filters.allergy_intolerance_exclusion_reasons(allergy)
        item_discrepancies = [
            Discrepancy(
                kind="excluded_inactive_or_resolved" if reason.startswith("clinicalStatus") else "excluded_entered_in_error",
                message=reason,
            )
            for reason in exclusion_reasons
        ]
        excluded = bool(item_discrepancies)

        if inv := disc.invariant_violation_discrepancy(allergy.clinicalStatus, allergy.verificationStatus, "ait-1"):
            item_discrepancies.append(inv)
        item_discrepancies.extend(disc.missing_display_discrepancies(allergy.code))
        item_discrepancies.extend(disc.code_system_mismatch_discrepancies(allergy.code))
        if unconfirmed := disc.unconfirmed_verification_discrepancy(allergy.verificationStatus):
            item_discrepancies.append(unconfirmed)
        if link_disc := linked_patient_discrepancy(patient_ref_id):
            item_discrepancies.append(link_disc)

        summary = "Allergy"
        if allergy.code and allergy.code.coding:
            summary = allergy.code.coding[0].display or allergy.code.coding[0].code or summary

        item = ResourceCardItem(
            resource_type="AllergyIntolerance",
            resource_id=allergy.id,
            summary=summary,
            status=allergy.clinicalStatus.coding[0].code if allergy.clinicalStatus and allergy.clinicalStatus.coding else None,
            excluded=excluded,
            discrepancies=item_discrepancies,
        )
        total_discrepancies += len(item_discrepancies)
        (card.excluded if excluded else card.allergies).append(item)

    card.discrepancy_count = total_discrepancies
    return card
