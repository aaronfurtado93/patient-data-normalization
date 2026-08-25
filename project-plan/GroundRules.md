# Ground Rules — AI-Assisted Work on This Assignment

These apply to every AI coding session (Claude or otherwise) working in the Centauri Clinical Snapshot repo, for the
duration of this take-home. They exist to keep a human hand on version control and to make every iteration auditable —
both of which feed directly into the "AI tool judgment" grading criterion in the brief.

## Rule 1 — No direct git operations by the AI agent

The AI agent must **never** run `git commit`, `git branch`, `git checkout -b`, `git push`,
`git merge`, `git rebase`, `git tag`, or any other git command that changes repo state or history.

- The agent may run **read-only** git commands when useful for context: `git status`, `git diff`,
  `git log`, `git show`.
- All commits, branches, pushes, and merges are performed by Aaron, by hand, after reviewing the agent's summary for
  that iteration.
- If the agent believes a commit point has been reached, it says so and stops — it does not act on that belief.

## Rule 2 — Every iteration ends with a change summary

At the end of each iteration (a coherent unit of work — one prompt/response cycle that produced file changes, not
necessarily one file), the agent must produce a summary of what changed, **grouped by root project folder (backend /
frontend) and then by directory within it**, before handing control back for a manual commit.

The summary must include, at minimum:

- Root project folder (`backend/` or `frontend/`; use `repo-root/` for top-level files like
  `README.md`, `docker-compose.yml`)
- Directory within that root
- File name and change type (added / modified / deleted)
- One-line description of what changed and why
- Any open questions or judgment calls made in that iteration (e.g. a data-safety decision) — these matter for
  `AI_USAGE.md` later

Format: a short markdown table per directory group, under a heading per root folder. See sample below.

## Rule 3 — Judgment calls get flagged inline, not buried

If an iteration involved a decision with clinical-data-safety implications (e.g. how to treat the duplicate Patient
records, whether to surface `medicationrequest-003`, how to render an unconfirmed allergy), the summary calls it out
explicitly under an **"Decisions this iteration"**
note, separate from the file table, so it's easy to lift into the README/AI_USAGE.md later without re-deriving it from
diffs.

---

## Sample summary output

*(Illustrative only — file names below are representative of what Phase 2 backend work would look like; not a commitment
to this exact structure.)*

### Iteration: Patient reconciliation + status filtering (backend)

**Backend (`backend/`)**

`backend/app/models/`

| File          | Change | Description                                                                                                           |
|---------------|--------|-----------------------------------------------------------------------------------------------------------------------|
| `patient.py`  | added  | Pydantic v2 model for FHIR `Patient`, plus a `ReconciledPatient` view type with a `duplicate_of` / `unresolved` field |
| `clinical.py` | added  | Models for `Condition`, `Observation`, `MedicationRequest`, `AllergyIntolerance` scoped to fields the snapshot uses   |

`backend/app/normalization/`

| File                   | Change | Description                                                                                                                                                       |
|------------------------|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `reconcile_patient.py` | added  | Picks `patient-001` as canonical (more complete demographic + US Core data), flags `patient-002` as an unresolved probable duplicate rather than merging silently |
| `status_filters.py`    | added  | Excludes `entered-in-error` / `inactive` resources from "current fact" lists; keeps them in a separate `excluded` bucket for transparency                         |

`backend/tests/normalization/`

| File                        | Change | Description                                                                                                     |
|-----------------------------|--------|-----------------------------------------------------------------------------------------------------------------|
| `test_reconcile_patient.py` | added  | Covers canonical-selection logic and the unresolved-duplicate flag                                              |
| `test_status_filters.py`    | added  | Covers exclusion of `entered-in-error`/`inactive` resources, confirms nothing marked current fact leaks through |

**Frontend (`frontend/`)** — no changes this iteration

**Decisions this iteration**

- Treated `patient-001` as canonical based on data completeness (SSN identifier, full `birthDate`, US Core
  race/ethnicity extensions present); `patient-002` is surfaced as an unresolved duplicate rather than merged or
  dropped. Documented for README.
- `medicationrequest-003` (subject: `patient-002`) is **not yet handled** — deferred to next iteration, flagged here so
  it isn't silently forgotten.

**Suggested commit message** (for Aaron to use, not run by the agent):
`backend: add patient reconciliation and status-filtering normalization`

---

### Iteration: patient-summary endpoint + snapshot page (backend + frontend)

**Backend (`backend/`)**

`backend/app/api/`

| File                 | Change | Description                                                                                                                                      |
|----------------------|--------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `patient_summary.py` | added  | `GET /patient-summary` endpoint; assembles reconciled patient + filtered problems/meds/allergies/encounters/observations into the response shape |

**Frontend (`frontend/`)**

`frontend/app/`

| File       | Change   | Description                                                                |
|------------|----------|----------------------------------------------------------------------------|
| `page.tsx` | modified | Replaced stub with real fetch to `/patient-summary`; renders five sections |

`frontend/components/snapshot/`

| File                 | Change | Description                                                                                          |
|----------------------|--------|------------------------------------------------------------------------------------------------------|
| `ProblemList.tsx`    | added  | Active problems section; unconfirmed/no-display codes rendered with a visible badge                  |
| `AllergyList.tsx`    | added  | Allergies section; unconfirmed verification status shown distinctly from confirmed                   |
| `UnresolvedFlag.tsx` | added  | Shared badge component for unresolved-reference / unconfirmed-verification / duplicate-patient cases |

**Repo root (`repo-root/`)** — no changes this iteration

**Decisions this iteration**

- `medicationrequest-003` is shown in the medication list but tagged with `UnresolvedFlag`
  ("linked to an unresolved second patient record — verify before treating as active") rather than silently included or
  excluded.

**Suggested commit message:**
`backend+frontend: wire patient-summary endpoint into snapshot UI`
