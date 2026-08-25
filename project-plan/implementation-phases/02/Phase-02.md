# Phase 02 — Implementation & Iteration

Builds the actual product on top of Phase 01's runnable skeleton: the normalization/reconciliation
pipeline (backend) and the patient snapshot UI (frontend), delivered as a sequence of iterations —
one file per iteration under `implementation-phases/02/iterations/Iteration-<NN>.md`.

`LLD.md` and `TestPlan.md` are written as part of this phase (deferred here from Phase 01 per
Aaron's direction — designed against real code rather than speculatively) rather than up front.

## Iterations

| # | Focus | Status |
|---|---|---|
| 01 | Dashboard + Hamburger sidebar nav + Patient Record Processing page (routing/shell only, no normalization logic yet) | Done |
| 02 | Download/Load Sample File + Run Validation enablement; backend restructured into `core`/`routers` packages with `AppError` + centralized exception handling | Done |
| 03 | Pydantic v2 resource models (`app/models/`) + `POST /validate` structural validation endpoint, wired into Run Validation | Done |
| 04 | Patient reconciliation + full discrepancy detection (`app/clinical_normalization/`) + hierarchical, discrepancy-annotated Patient Card UI | Done |
| 05 | Upload Custom File — real, client-side JSON read + validation, feeds the same `/validate` pipeline as Load Sample File | Done |
| 06 | Completeness indicator; multiple distinct patients as separate cards (corrected from an initial auto-merge mistake — Default mode never merges) | Done |
| 07 | HIL-based merge process — stretch goal, being built as a sequence of small, separately-reviewed steps per Aaron's explicit "tread carefully" direction. Step 1: switchable Validation Mode dropdown (locks after Run Validation, unlocks on new file load) + merge icon on cards with possible duplicates (HIL mode only, not yet functional). | In progress |

## Notes

- Every iteration gets a printed grouped change summary in-chat (per `CLAUDE.md`) *and* an
  `Iteration-<NN>.md` file here, via the `iteration-summary` skill.
- `AI_USAGE.detail-log.md` gets a row per prompt, same as Phases 00/01.
