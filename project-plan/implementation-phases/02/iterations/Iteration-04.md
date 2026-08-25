# Iteration 04: Patient card UI — hierarchical structure + discrepancy highlighting

Two scope-defining questions confirmed with Aaron before building, since this iteration directly
touches decisions already locked in `Assumptions.md`:
1. **Patient card model:** one canonical card (patient-001) with patient-002 shown as a flagged
   duplicate panel — not two independent equal cards.
2. **Discrepancy scope:** the full `Knowledge.md` catalog in one pass, not a smaller starter set.

**Backend (`backend/app/models/`)**

| File | Change | Description |
|---|---|---|
| `patient_card.py` | added | `Discrepancy`, `ResourceCardItem`, `PossibleDuplicatePatient`, `PatientCard` — the response shape for the hierarchical, discrepancy-annotated view. |
| `validation.py` | modified | Added `patient: PatientCard \| None` to `ValidationReport`. |

**Backend (`backend/app/clinical_normalization/`)** — new package

| File | Change | Description |
|---|---|---|
| `__init__.py` | added | Module-layout docstring. |
| `bundle_parser.py` | added | `parse_bundle_entries()` — moved out of `routers/validation.py` so structural validation and card-building share exactly one per-entry parsing pass. |
| `patient_reconciliation.py` | added | `completeness_score()` + `reconcile_patients()` — generic (not hardcoded-id) canonical-patient selection, explicitly scoped to one bundle at a time. |
| `status_filters.py` | added | Per-resource-type exclusion-reason functions (entered-in-error/inactive/resolved). `"stopped"` MedicationRequest deliberately excluded from this logic — it's the separate past-medications bucket. |
| `discrepancies.py` | added | `missing_display_discrepancies`, `code_system_mismatch_discrepancies`, `dangling_reference_discrepancy`, `invariant_violation_discrepancy` (con-3/ait-1), `unconfirmed_verification_discrepancy`. |
| `patient_card.py` | added | `build_patient_card()` — assembles everything above into one `PatientCard`. Explicit per-resource-type blocks (not a generic loop) for auditability. |

**Backend (`backend/app/routers/`)**

| File | Change | Description |
|---|---|---|
| `validation.py` | modified | Now uses `clinical_normalization.bundle_parser`/`patient_card` instead of inline parsing; response includes the new `patient` field. |

**Frontend (`frontend/components/patient-card/`)** — new directory

| File | Change | Description |
|---|---|---|
| `types.ts` | added | TypeScript mirror of `patient_card.py`'s models. |
| `ResourceSection.tsx` | added | Reusable collapsible bucket list; excluded items styled distinctly; Excluded section defaults open. |
| `PatientCard.tsx` | added | The card: header, discrepancy-count badge, possible-duplicate panel, seven `ResourceSection`s in fixed order. |

**Frontend (`frontend/app/patient-record-processing/`)**

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | `ValidationReport` type gained `patient: PatientCardData \| null`; renders `<PatientCard>` below the existing structural-validation summary when present. |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `Assumptions.md` | modified | Recorded the completeness-score algorithm, the permissive-invariant modeling decision (already noted in Iteration 03, cross-referenced), and the explicit discrepancy-detection scope boundary (what's deliberately NOT detected, and why). Closed the last "Still open" item (exact response schema) — resolved by `PatientCard`'s actual shape. |
| `LLD.md` | modified | Full `clinical_normalization` package writeup + updated `/validate` response shape + new frontend `patient-card` component section. |
| `TestPlan.md` | modified | Iteration 04 coverage log; flagged the single-Patient (no-duplicate) code path as currently untested in isolation. |

**Decisions this iteration**

- **Canonical-patient selection uses a generic completeness score**, not hardcoded ids — see
  `Assumptions.md` for the exact scoring and the explicit "one bundle at a time, not population-wide
  identity matching" scope boundary. This is the first time reconciliation logic actually runs, so
  flagging prominently even though it implements an already-agreed decision.
- **`Condition`/`AllergyIntolerance` models stay permissive on the `con-3`/`ait-1` invariants**
  (carried over from Iteration 03, now actually exercised): the violation is surfaced as a
  discrepancy, not rejected at parse time.
- **Discrepancy scope explicitly excludes** implausible-value detection and "missing reference
  range/reaction detail" flagging — both would require inventing clinical judgment this project
  isn't positioned to assert. See `Assumptions.md` for the full reasoning; flagging here since this
  is a place where "full catalog now" could have been read more broadly than intended.
- **`medicationrequest-003` continues to render in the canonical patient's active-medications
  list**, flagged with `unresolved_duplicate_patient_link` — implements the Phase 00 decision,
  generalized to any resource type (not medication-specific), though this bundle only exercises it
  for the one MedicationRequest.

**Verification performed**

- `GET /sample-bundle` → `POST /validate` on the real bundle: full JSON response inspected against
  every item in `Knowledge.md`'s catalog — all 18 discrepancies present, correctly attached, correct
  `kind`; `discrepancy_count: 18` cross-checked arithmetically.
- **Real browser verification via `claude-in-chrome`** (not just `curl`): navigated to
  `/patient-record-processing`, Load → Run Validation, confirmed the rendered card matches the API
  response exactly — header, discrepancy badge, duplicate panel, all seven sections, Excluded
  auto-expanded with all four items and their reasons visible. Manually expanded Conditions and
  confirmed a clean item (hypertension, zero discrepancies) renders correctly alongside a flagged
  one (E11.9, two discrepancies) in the same list — screenshots taken at each step.
- Backend container rebuilt cleanly; no regressions to `/health`, `/sample-bundle`, or the
  structural-validation fields of `/validate`.

**Suggested commit message** (for Aaron to use, not run by the agent):
`feat: add patient reconciliation, discrepancy detection, and patient card UI`
