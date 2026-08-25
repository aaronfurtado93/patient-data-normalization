"""Response shape for the patient-centric, discrepancy-annotated view built by
app/clinical_normalization/. See that package for how this is assembled and
implementation-logs/Knowledge.md for the data-quality catalog it surfaces.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DiscrepancyKind = Literal[
    "excluded_entered_in_error",
    "excluded_inactive_or_resolved",
    "invariant_violation",
    "missing_display",
    "dangling_reference",
    "code_system_mismatch",
    "unconfirmed_verification",
]


class Discrepancy(BaseModel):
    kind: DiscrepancyKind
    message: str


class ResourceCardItem(BaseModel):
    resource_type: str
    resource_id: str
    summary: str
    status: str | None = None
    # True if this item is excluded from "current fact" (entered-in-error/inactive/resolved) —
    # such items live in PatientCard.excluded, not their type-specific list. Kept here too so a
    # single ResourceCardItem is self-describing wherever it ends up.
    excluded: bool = False
    discrepancies: list[Discrepancy] = Field(default_factory=list)


class PossibleDuplicatePatient(BaseModel):
    """A flag, not a merge. Default/auto mode never combines two Patient resources or their
    clinical data into one card, however confidently they appear to match — that decision belongs
    to an authorized human reviewer (HIL/manual mode), not this pipeline. This model exists purely
    to point one patient's card at another's, so a reviewer sees the relationship without any data
    being silently merged, moved, or hidden on their behalf."""

    patient_id: str
    name: str | None = None
    birth_date: str | None = None
    identifiers: list[str] = Field(default_factory=list)
    note: str = (
        "Possible duplicate / related match — the bundle has no FHIR `link` element declaring "
        "this relationship. Inferred from overlapping demographics only; each patient's data "
        "stays on its own card. Merging is a manual, human-authorized action, not performed here."
    )


class PatientCard(BaseModel):
    """One card per `Patient` resource in the bundle — never one merged card per identity cluster.
    A resource is attributed to a card only when its own subject/patient reference points at this
    exact `patient_id`; `possible_duplicates` never changes what resources appear on this card,
    only what it points a reviewer toward."""

    patient_id: str
    name: str | None = None
    birth_date: str | None = None
    identifiers: list[str] = Field(default_factory=list)
    possible_duplicates: list[PossibleDuplicatePatient] = Field(default_factory=list)

    encounters: list[ResourceCardItem] = Field(default_factory=list)
    conditions: list[ResourceCardItem] = Field(default_factory=list)
    observations: list[ResourceCardItem] = Field(default_factory=list)
    medications_active: list[ResourceCardItem] = Field(default_factory=list)
    medications_past: list[ResourceCardItem] = Field(default_factory=list)
    allergies: list[ResourceCardItem] = Field(default_factory=list)

    # Every excluded resource across every type, in one place — per Assumptions.md, excluded
    # resources are kept visible/inspectable, not deleted from the response.
    excluded: list[ResourceCardItem] = Field(default_factory=list)

    # Sum of every discrepancy across every item, plus one per possible_duplicate — a single
    # number for the card header ("N discrepancies observed").
    discrepancy_count: int = 0

    # % of clinical resources on this card (across every bucket, including excluded) that are
    # BOTH non-excluded AND discrepancy-free. Deliberately does not fold in the possible-duplicate
    # flag — that's a reconciliation-status concern, kept in its own panel, not conflated into a
    # single number with per-resource data quality. 100 when there are no clinical resources at
    # all (nothing to be incomplete about).
    completeness_percentage: int = 100
