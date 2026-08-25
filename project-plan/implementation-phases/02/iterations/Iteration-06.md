# Iteration 06: Completeness indicator (MVP gap-closing)

Triggered by Aaron asking "have we covered the must have from project plan?" — checking
`ProjectPlan.md`'s Must Have list against the actual build surfaced one real gap: the MVP goal says
the frontend should display "each patient record and its completeness based on evaluation report,"
but the UI only showed a discrepancy count, never anything literally framed as "completeness."
Confirmed with Aaron (one clarifying question) before building: add an explicit completeness
indicator rather than treat the discrepancy count as already satisfying this.

**Backend (`backend/app/models/`)**

| File | Change | Description |
|---|---|---|
| `patient_card.py` | modified | Added `completeness_percentage: int = 100` to `PatientCard`, with a docstring distinguishing it from `patient_reconciliation.completeness_score` (a different metric, same word). |

**Backend (`backend/app/clinical_normalization/`)**

| File | Change | Description |
|---|---|---|
| `patient_card.py` | modified | Computes it last, after every bucket is finalized: `round(100 * clean_items / total_items)` across all seven buckets (including `excluded`); `clean_items` = non-excluded AND discrepancy-free. `100` when there are no clinical resources. |

**Frontend (`frontend/components/patient-card/`)**

| File | Change | Description |
|---|---|---|
| `types.ts` | modified | Added `completeness_percentage: number`. |
| `PatientCard.tsx` | modified | New badge in the header (always shown, unlike the discrepancy badge which only shows if > 0), color-coded green/amber/red on a fixed threshold scale (visual only, not clinical). |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `ProjectPlan.md` | modified | Added an explicit MVP-coverage status table answering Aaron's question directly and durably, plus called out the two places the literal wording was narrowed (single-canonical-card, and this iteration's completeness definition) with pointers to `Assumptions.md`. |
| `Assumptions.md` | modified | Full definition of `completeness_percentage`, explicitly distinguished from the reconciliation-scoring `completeness_score` to prevent future confusion between the two "completeness" concepts in this codebase. |
| `LLD.md` | modified | Computation detail + verified values. |
| `TestPlan.md` | modified | Verification record. |

**Decisions this iteration**

- **Completeness is defined narrowly**: % of the canonical patient's clinical resources that are
  non-excluded and discrepancy-free. Deliberately does **not** attempt "how much of a complete
  medical history is present" (would require clinical judgment this project has no grounds to
  assert) and deliberately does **not** fold in the possible-duplicate flag (kept as its own panel,
  not blended into one number). Confirmed with Aaron before building rather than assumed.
- No clinical-data-safety decisions beyond the above — this is a display-layer addition computed
  entirely from data the pipeline already produces; no new clinical interpretation introduced.

**Verification performed**

- Real bundle → `33` — hand-verified against the actual bucket contents (5 clean of 15 total), not
  just trusted from reading the code.
- `fully_valid_bundle.json` → `100`; `fully_invalid_bundle.json` → `10` (1 clean of 10) — both
  hand-verified the same way.
- Rendered value in a real browser (`claude-in-chrome`) matches the API exactly — "33% complete,"
  red badge (< 50% threshold).

**Suggested commit message** (for Aaron to use, not run by the agent):
`feat: add completeness_percentage to PatientCard, closing an MVP-goal gap`

---

## Second pass: multiple distinct patients displayed as individual cards

**Feedback:** "As part of iteration 06 I also want to handle cases where payload may contain
multiple patients so I want to allow for multiple patient records to be displayed as individual
cards."

This directly revisits an Iteration 04 decision (every non-canonical `Patient` in a bundle is
treated as a duplicate of the canonical one) — a real clinical-data-safety judgment call, not a
styling change. Asked one clarifying question before building: what determines "same person"
(→ one card, flagged duplicate) vs. "different people" (→ separate cards)? Confirmed: normalized
family name match + compatible `birthDate`, no fuzzy/similarity scoring.

**Backend (`backend/app/clinical_normalization/`)**

| File | Change | Description |
|---|---|---|
| `patient_reconciliation.py` | modified | Added `same_person()` (the one explicit match rule) and `cluster_patients()` (union-find transitive grouping over it, order-preserving). Docstring rewritten — no longer claims this "does not attempt generic multi-patient identity matching"; it now does, narrowly. |
| `patient_card.py` | modified | Split the single big function into `_build_card_for_cluster()` (unchanged per-resource-type logic, now scoped to a cluster's member ids) and `build_patient_cards()` (clusters the bundle's patients, builds one card per cluster). |

**Backend (`backend/app/models/`)**

| File | Change | Description |
|---|---|---|
| `validation.py` | modified | `patient: PatientCard \| None` → `patients: list[PatientCard]`. |

**Backend (`backend/app/routers/`)**

| File | Change | Description |
|---|---|---|
| `validation.py` | modified | Calls `build_patient_cards()`, returns the list as `patients`. |

**Frontend (`frontend/`)**

| File | Change | Description |
|---|---|---|
| `components/patient-card/types.ts` | modified | `patient` → `patients: PatientCardData[]`. |
| `app/patient-record-processing/page.tsx` | modified | Maps `validationReport.patients` to one `<PatientCard>` per entry, keyed by `patient_id`. |

**Backend (`backend/tests/fixtures/`)**

| File | Change | Description |
|---|---|---|
| `multiple_distinct_patients_bundle.json` | added | New fixture — the only existing test inputs (real bundle + both prior fixtures) all happen to have every extra Patient match the canonical one, so none of them exercised the new "different people, separate cards" path at all. This one does: two Whitfield-pattern duplicates + one unrelated Garcia patient. |

**Decisions this iteration**

- **The `same_person` match rule is deliberately narrow and non-fuzzy** (family name + compatible
  birthDate only — no identifier/MRN-sharing signal, no similarity scoring). Confirmed with Aaron
  before building. The broader "also match on shared identifier" option was presented and declined.
- **This supersedes Iteration 04's implicit single-cluster assumption** — flagging explicitly since
  it's a reversal of prior stated scope ("not generic multi-patient identity matching... out of
  scope"), not an extension of it. `Assumptions.md` updated to reflect the current rule rather than
  leaving the superseded claim standing.
- No change to any per-resource discrepancy/exclusion logic — `_build_card_for_cluster` is the same
  logic as before, just re-scoped to run once per cluster instead of once globally.

**Verification performed**

- **Regression first**: real bundle + both pre-existing fixtures re-run through `/validate` —
  byte-identical `completeness_percentage`/`discrepancy_count`/`possible_duplicates` counts to
  before this change, confirming zero behavior change for any single-cluster bundle.
- New fixture verified via raw JSON: exactly 2 `patients` entries, correct duplicate panel on the
  Whitfield cluster, zero cross-contamination of resources between clusters.
- Re-verified in a real browser (`claude-in-chrome`, uploaded via `file_upload`): both cards render
  correctly side-by-side, matching the API response exactly.

**Suggested commit message:**
`feat: cluster patients by identity so genuinely distinct patients render as separate cards`

---

## Third pass: correcting an auto-merge mistake in the second pass

**Major Observation from Aaron:** the second pass above still *combined* related-matching patients
into one card. That's wrong for Default/auto mode — grouping/merging patient data is something "a
authorized system user will do manually," not something this pipeline should do on its own.
Duplicate/related-match detection stays (confirmed: still wanted, `patient_reconciliation.py`
named as the reference entry point) — only the *merging* was wrong.

This is a real correction, not a refinement — flagging plainly rather than framing it as a natural
next step.

**Backend (`backend/app/clinical_normalization/`)**

| File | Change | Description |
|---|---|---|
| `patient_reconciliation.py` | modified | Docstring rewritten to state the boundary as load-bearing: `cluster_patients` is for cross-referencing only, never for deciding resource attribution. `completeness_score`/`reconcile_patients` explicitly marked as unused by the default-mode path (kept for a possible future HIL view). |
| `patient_card.py` | modified | `_build_card_for_cluster()` → `_build_card_for_patient()`: one card per `Patient` resource, strict subject-equality attribution (`patient_ref_id == patient.id`, no cluster membership). `build_patient_cards()` now builds one card per patient, using `cluster_patients` solely to populate each card's `possible_duplicates`. Removed the `linked_patient_discrepancy` closure entirely — no longer meaningful once nothing is cross-attributed. |

**Backend (`backend/app/models/`)**

| File | Change | Description |
|---|---|---|
| `patient_card.py` | modified | Removed `unresolved_duplicate_patient_link` from `DiscrepancyKind` (nothing generates it any more — a resource simply lives on its actual subject's card). Docstrings on `PossibleDuplicatePatient`/`PatientCard` rewritten to state the no-merge guarantee explicitly, partly so this doesn't quietly regress again. |

**Backend (`backend/tests/fixtures/`)**

| File | Change | Description |
|---|---|---|
| `three_patients_fully_valid_bundle.json` | added | 3 unrelated patients, full resource complement each, all clean — per Aaron's explicit spec. |
| `three_patients_partially_valid_bundle.json` | added | 2 loosely-matching + 1 unrelated, deliberately uneven resource coverage/quality — per Aaron's explicit spec, designed to hand-predict 67%/50%/80% completeness before running (confirmed exact match). |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `Assumptions.md` | modified | Corrected the second-pass entry to state the no-merge rule plainly; marked the Phase 00 `medicationrequest-003` bullet as superseded (it now lives on `patient-002`'s own card, not flagged under `patient-001`'s); folded the no-subject case into the existing orphaned-reference "Still open" item. |
| `LLD.md`, `TestPlan.md` | modified | Full correction writeup + verification record. |

**Decisions this iteration**

- **This is a correction of a real mistake**, not a new design choice — recorded as such in
  `Assumptions.md` rather than presented as if the third pass were always the plan.
- **`medicationrequest-003`'s Phase 00 disposition is superseded**: it no longer shows under
  `patient-001` flagged as duplicate-linked; it shows on `patient-002`'s own card as an ordinary
  active medication, with the possible-duplicate relationship visible via `patient-002`'s own
  `possible_duplicates` panel instead. Flagging explicitly since this was one of the project's
  oldest, most-referenced decisions (dating to Phase 00) — not something to let go stale silently.
- **No change to per-resource discrepancy/exclusion logic** — every `discrepancies.py`/
  `status_filters.py` check behaves identically; only resource *attribution* (which card a resource
  appears on) changed.

**Verification performed**

- Real bundle re-verified from scratch: 2 cards (not 1), `medicationrequest-003` confirmed on
  `patient-002`'s card specifically, combined discrepancy totals (`16 + 2 = 18`) reconciling
  exactly with the pre-correction single-card total — confirms the fix redistributes discrepancies
  correctly rather than losing or duplicating any.
- Both pre-existing multi-patient-adjacent fixtures re-checked:
  `multiple_distinct_patients_bundle.json`'s Whitfield pair now correctly produces 2 cards (was 1).
- Both new fixtures matched hand-predicted values exactly (`100%`×3 for the fully-valid case;
  `67%`/`50%`/`80%` for the partially-valid case) — predicted before running, not fitted after.
- Real browser verification (`claude-in-chrome`, `file_upload`) for the partially-valid fixture:
  three cards render correctly, completeness badges match, duplicate panels correctly symmetric
  between only the two matching patients.

**Suggested commit message:**
`fix: never merge matched patients in Default mode — one card per Patient resource, always`
