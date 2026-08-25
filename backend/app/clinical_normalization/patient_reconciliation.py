"""Patient identity matching — detection only, never merging.

Scope note: this project handles one bundle at a time (MVP, per Assumptions.md). `cluster_patients`
groups `Patient` resources believed to represent the *same person* using one explicit, auditable
rule (see `same_person`) — normalized family name match AND compatible `birthDate` values.
Deliberately **not** fuzzy/similarity-scored matching (no soundex, no edit distance, no given-name
matching) — every grouping decision has to be explainable as "these two match on X," not "these
two scored 0.87 similar."

**Critical: a cluster is used only to cross-reference cards, never to build one.** Default/auto
mode gives every `Patient` resource its own `PatientCard` with its own resources — full stop, no
exceptions, regardless of how confidently two patients match. `clinical_normalization/patient_card.py`
uses `cluster_patients` solely to populate each card's `possible_duplicates` list (pointing at the
*other* members of its cluster) — it never uses cluster membership to decide which resources belong
on which card. Combining two Patient records — or moving/attributing one's clinical data onto the
other's card — is an action reserved for an authorized human reviewer (HIL/manual mode), not
something this pipeline performs on its own. See `Assumptions.md` for the full reasoning; this
boundary was tightened after an initial implementation incorrectly merged matched patients into one
card, which this docstring exists partly to prevent recurring.

`completeness_score`/`reconcile_patients` (picking a "more complete" record within a matched group)
are kept here, defined but **currently unused by the default-mode card-building path** — they're
the natural building blocks for a future HIL "which record should I keep/merge" view, not something
that should silently influence what auto mode displays.
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


def _normalized_family_name(patient: Patient) -> str | None:
    for name in patient.name:
        if name.family:
            return name.family.strip().casefold()
    return None


def _birth_dates_compatible(a: str | None, b: str | None) -> bool:
    """True if the two FHIR date strings could describe the same date at different precisions —
    e.g. "1958" and "1958-03-12" (one is a component-wise prefix of the other), or an exact match.
    False (never a guessed match) if either is absent, or if any shared component differs."""
    if not a or not b:
        return False
    a_parts, b_parts = a.split("-"), b.split("-")
    shorter, longer = (a_parts, b_parts) if len(a_parts) <= len(b_parts) else (b_parts, a_parts)
    return shorter == longer[: len(shorter)]


def same_person(a: Patient, b: Patient) -> bool:
    """The one explicit rule this project uses to decide two Patient resources represent the same
    person: normalized family name matches AND birthDate values are compatible. Either signal
    missing on either patient means no match — absence is never treated as a match, per the
    project's "never guess" posture."""
    name_a, name_b = _normalized_family_name(a), _normalized_family_name(b)
    if name_a is None or name_b is None or name_a != name_b:
        return False
    return _birth_dates_compatible(a.birthDate, b.birthDate)


def cluster_patients(patients: list[Patient]) -> list[list[Patient]]:
    """Groups Patient resources into identity clusters via `same_person`, with transitive closure
    (if A matches B and B matches C, all three end up in one cluster even if A and C weren't
    compared directly as a compatible pair) — union-find over the match graph. A patient matching
    no one is its own single-member cluster. Order of the input list is preserved for the order
    clusters (and patients within a cluster) are returned in."""
    n = len(patients)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    for i in range(n):
        for j in range(i + 1, n):
            if same_person(patients[i], patients[j]):
                union(i, j)

    clusters: dict[int, list[Patient]] = {}
    for i, patient in enumerate(patients):
        clusters.setdefault(find(i), []).append(patient)

    return list(clusters.values())


def reconcile_patients(patients: list[Patient]) -> tuple[Patient, list[Patient]]:
    """Within a single identity cluster: returns (canonical, [every other member — each an
    unresolved probable duplicate, surfaced as such rather than merged or dropped])."""
    ranked = sorted(patients, key=completeness_score, reverse=True)
    return ranked[0], ranked[1:]
