# AI Usage

I used Sonnet 5 throughout at medium reasoning effort, and planned to switch to a higher-consumption
model only if a task proved too complex (it never came to that). I kept a full per-prompt record of
every request, exactly what got built, how I verified it, and my own feedback in
[`project-plan/implementation-logs/AI_USAGE.detail-log.md`](project-plan/implementation-logs/AI_USAGE.detail-log.md).
This file is the condensed, submission-facing summary of that record. I paused per-prompt logging
for a short stretch partway through, and per my own instruction at the time, that stretch is left
out of this summary too.

## MVP coverage

I completed all four `ProjectPlan.md` Must Have items, plus the full HIL (Human-in-Loop) stretch goal:

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
| 00 | — | Research | Sonnet 5 | medium | I had the AI read the full sample bundle against the FHIR R4 spec and build the data-quality catalog (`Knowledge.md`) and `ResearchNotes.md`, then recorded the resulting data-handling decisions in `Assumptions.md`. I also had it author `CLAUDE.md` and the `iteration-summary` skill so the project's ground rules would carry forward automatically. |
| 01 | — | Scaffolding | Sonnet 5 | medium | I stood up a minimal runnable FastAPI + Next.js app under Docker Compose and verified it end-to-end in a browser. I fixed a host-port collision (backend moved to `8010`) and a container `inotify`/`EMFILE` live-reload issue, and added Tailwind CSS. |
| 02 | 01 | Dashboard shell | Sonnet 5 | medium | I built the header, hamburger sidebar, and Dashboard widget layout. I added breadcrumb/home navigation after my own manual testing turned up the gap, and fixed a second live-reload gap (missing bind mounts) I found the same way. |
| 02 | 02 | Sample bundle + backend restructure | Sonnet 5 | medium | I added `GET /sample-bundle` and wired up Download/Load Sample File. I asked for the backend to be restructured into `core`/`routers` packages with a centralized `AppError`/exception-handler system after reviewing the first pass, and caught a real bug during verification: the `HTTPException` handler was registered on the wrong base class. |
| 02 | 03 | Structural validation | Sonnet 5 | medium | I had `app/models/` built (Pydantic v2, one module per FHIR resource type) along with `POST /validate` (structural-only at this point), then wired up Run Validation end-to-end and verified it in a real browser. |
| 02 | 04 | Patient card + discrepancy detection | Sonnet 5 | medium | I had `app/clinical_normalization/` built: the reconciliation and discrepancy-detection pipeline covering missing `display`, dangling references, invariant violations, unconfirmed verification status, and entered-in-error/inactive/resolved exclusion, plus the frontend `PatientCard` UI. I asked for `fully_valid`/`fully_invalid` test fixtures, and while building them we found and logged the orphaned-reference silent-drop gap. |
| 02 | 05 | Upload Custom File | Sonnet 5 | medium | I had client-side file upload built with JSON/shape guard checks, keeping the real backend validation authoritative. I verified it against four different uploaded files, including a couple I wrote by hand specifically to be invalid. |
| 02 | 06 | Multi-patient support (one real correction) | Sonnet 5 | medium | I asked for support for a bundle containing more than one `Patient`. The first attempt incorrectly auto-merged matched/possible-duplicate patients into a single card, and I caught it: patient matching and merging are not the same thing, and merging is something only an authorized person should do by hand. I had it rewritten so every `Patient` resource always gets its own, strictly-attributed card, with matching used only to populate a `possible_duplicates` flag. Two purpose-built 3-patient fixtures confirmed the fix. |
| 02 | 07 | HIL merge process, built in reviewed steps | Sonnet 5 | medium | I asked for this to be built as small, independently-reviewed steps rather than one big change: (1) a switchable Validation Mode plus a merge icon, (2) a 3-pane Patient A / Merged Preview / Patient B compare view, (3) "Reconcile and Apply Merge" via `POST /reconcile`, which actually applies the merge and re-validates the whole bundle, (4) a discrepancy-count warning on collapsed sections, (5) Download Output (clean FHIR R4 export with opt-in discrepancy/excluded inclusion), which I later refined to gate to HIL mode with a timestamped filename, and (6) a discoverability hint for the mode lock plus a new in-app User Guide page/widget. One genuine second-order finding along the way: an unchecked merge item orphaned a different item's reference. I caught it because the UI's discrepancy count didn't match my own hand-prediction, and confirmed it by replaying the request directly against the backend. |
| 02 | 07 | Documentation sync | Sonnet 5 | medium | I asked for `HLD.md`/`LLD.md` to be brought current through Iteration 07 (both had drifted: `HLD.md` had stopped updating after Iteration 02, and `LLD.md` had a subsection contradicting its own later content), and had the current feature set and screenshots added to `README.md`. |

## Where my course-correction mattered

- **The multi-patient auto-merge mistake (Iteration 06) is the standout.** This was a real
  clinical-data-safety error: combining two patients' records without human authorization. I only
  caught it by reviewing the output closely, and I had it reversed right away.
- **An early HLD draft over-designed ahead of a runnable app.** I redirected this to "build the
  skeleton first, document incrementally" instead, which became the working pattern for the rest
  of the project.
- **A first-pass backend worked but wasn't organized the way I needed.** I asked for it to be
  redirected into a proper `core`/`routers`/`AppError` structure before I let further work proceed.
- **A couple of missing UX basics only showed up when I tested manually**, not from the build
  itself: back-navigation, and live reload actually working.
- **Download Output first shipped without the HIL-only gating its sibling feature (merge) already
  had.** I caught this and asked for a follow-up refinement pass to fix it.

See the detail log for the full record of each.
