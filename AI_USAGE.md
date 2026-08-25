# AI Usage

Sonnet 5 was used throughout at medium reasoning effort — switching to a higher-consumption model
only if a task proved too complex (never needed). Full per-prompt detail (every request, exactly
what was built, how it was verified, and Aaron's response) lives in
[`project-plan/implementation-logs/AI_USAGE.detail-log.md`](project-plan/implementation-logs/AI_USAGE.detail-log.md);
this file is the condensed, submission-facing summary of that record. Per Aaron's standing
instruction, any prompt/response that occurred while detail-log logging was explicitly paused is
excluded from this summary as well.

## MVP coverage

All four `ProjectPlan.md` Must Have items are done, plus the full HIL (Human-in-Loop) stretch goal:

| Item | Status | Where |
|---|---|---|
| Loads the sample JSON | ✅ | `GET /sample-bundle` (backend) + "Load Sample File" (frontend) |
| FE sends for processing | ✅ | "Run Validation" → `POST /validate` |
| BE sends back evaluation report | ✅ | `ValidationReport` (`valid`, `resource_counts`, `errors`, `patients`) |
| FE organizes/displays each patient record and its completeness | ✅ | One `PatientCard` per distinct patient, with an explicit `completeness_percentage` |
| Upload custom bundle, expand/correct data, download output (stretch) | ✅ | HIL mode: Upload Custom File, the 3-pane merge/compare view, Download Output |

## Summary by phase / iteration

| Phase | Iteration | AI Assistance | Model | Effort | Summary |
|---|---|---|---|---|---|
| 00 | — | Research | Sonnet 5 | medium | Read the full sample bundle against FHIR R4 spec, built the data-quality catalog (`Knowledge.md`) and `ResearchNotes.md`, recorded the resulting data-handling decisions in `Assumptions.md`. Authored `CLAUDE.md` and the `iteration-summary` skill to carry the project's ground rules forward automatically. |
| 01 | — | Scaffolding | Sonnet 5 | medium | Stood up a minimal runnable FastAPI + Next.js app under Docker Compose, verified end-to-end in a browser. Fixed a host-port collision (backend → `8010`) and a container `inotify`/`EMFILE` live-reload issue. Added Tailwind CSS. |
| 02 | 01 | Dashboard shell | Sonnet 5 | medium | Header/hamburger Sidebar/Dashboard widget layout; added breadcrumb/home navigation after manual-testing feedback; fixed a second live-reload gap (missing bind mounts) found the same way. |
| 02 | 02 | Sample bundle + backend restructure | Sonnet 5 | medium | `GET /sample-bundle`; Download/Load Sample File wired up. Restructured the backend into `core`/`routers` packages with a centralized `AppError`/exception-handler system after review feedback; fixed a real bug found during verification (the `HTTPException` handler was registered on the wrong base class). |
| 02 | 03 | Structural validation | Sonnet 5 | medium | `app/models/` (Pydantic v2, one module per FHIR resource type) and `POST /validate` (structural-only at this point); wired Run Validation end-to-end in a real browser. |
| 02 | 04 | Patient card + discrepancy detection | Sonnet 5 | medium | `app/clinical_normalization/` — the reconciliation and discrepancy-detection pipeline (missing `display`, dangling references, invariant violations, unconfirmed verification status, entered-in-error/inactive/resolved exclusion). Frontend `PatientCard` UI. Built `fully_valid`/`fully_invalid` test fixtures per Aaron's request; found and logged the orphaned-reference silent-drop gap while building them. |
| 02 | 05 | Upload Custom File | Sonnet 5 | medium | Client-side file upload with JSON/shape guard checks; the real backend validation stays authoritative. Verified against four different uploaded files including hand-crafted invalid ones. |
| 02 | 06 | Multi-patient support (one real correction) | Sonnet 5 | medium | Added support for a bundle containing more than one `Patient`. **First attempt incorrectly auto-merged matched/possible-duplicate patients into a single card** — Aaron caught this ("we must not combine and group the similar matching patient data... an authorized system user will do manually") and it was rewritten so every `Patient` resource always gets its own, strictly-attributed card; matching is used only to populate a `possible_duplicates` flag. Two purpose-built 3-patient fixtures confirmed the fix. |
| 02 | 07 | HIL merge process, built in reviewed steps | Sonnet 5 | medium | Built deliberately as small, independently-reviewed steps per Aaron's explicit direction: (1) switchable Validation Mode + merge icon, (2) 3-pane Patient A / Merged Preview / Patient B compare view, (3) `POST /reconcile` — "Reconcile and Apply Merge" actually applies the merge and re-validates the whole bundle, (4) discrepancy-count warning on collapsed sections, (5) Download Output (clean FHIR R4 export, opt-in discrepancy/excluded inclusion), refined afterward to gate to HIL mode with a timestamped filename, (6) a discoverability hint for the mode lock plus a new in-app User Guide page/widget. A genuine second-order finding along the way: an unchecked merge item orphaned a different item's reference — caught because the UI's discrepancy count didn't match a hand-prediction, confirmed by replaying the request directly against the backend. |
| 02 | 07 | Documentation sync | Sonnet 5 | medium | Brought `HLD.md`/`LLD.md` current through Iteration 07 (both had drifted — `HLD.md` stopped updating after Iteration 02, `LLD.md` had a subsection contradicting its own later content) and added the current feature set + screenshots to `README.md`. |

## Where Aaron's course-correction mattered

The multi-patient auto-merge mistake (Iteration 06) is the standout: a real clinical-data-safety
error — combining two patients' records without human authorization — that only Aaron's explicit
review caught and reversed. Beyond that, the project's shape was steered by several smaller but
real interventions: an early HLD draft that over-designed ahead of a runnable app (redirected to
"build the skeleton first, document incrementally"); a first-pass backend that worked but wasn't
organized the way the project needed (redirected into a proper `core`/`routers`/`AppError`
structure before further work was allowed); a couple of missing UX basics caught only through
Aaron's own manual testing (back-navigation, live reload actually working); and a Download Output
feature that first shipped without the HIL-only gating its sibling feature (merge) already had,
corrected in a follow-up refinement pass. See the detail log for the full record of each.
