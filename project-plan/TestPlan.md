# Test Plan — Centauri Clinical Snapshot

Written incrementally per Phase 02 iteration, alongside `LLD.md` — covers what's actually been
built and how it's actually been verified so far, not a full test suite planned up front. No
automated test suite exists yet (see "Automated coverage" below); verification to date has been
manual/scripted `curl` checks against the running Docker Compose stack, done at the end of each
iteration before handing back for review.

## Strategy

- **Primary verification method for now: run the real stack, hit it for real.** Given the small
  scope and short timeline, `docker compose up` + `curl`/browser checks against actual running
  containers has caught real bugs a mocked/unit-only approach would have missed twice already (the
  missing volume mounts and the `inotify`/`EMFILE` host-kernel limits in Iteration 01 — neither is
  the kind of thing a unit test would surface, both were only visible by actually running the
  containers and exercising them).
- **Automated tests get added once there's normalization/reconciliation logic to test** — that's
  where the actual clinical-data-safety-relevant branching lives (exclusion-bucket logic, duplicate
  handling, dangling-reference resolution, etc. — see `Assumptions.md`), and where unit tests earn
  their keep. Pure routing/layout/scaffolding iterations (01, 02 so far) don't have much
  branching logic worth unit-testing yet.
- **No test framework chosen yet** for either side — likely `pytest` (backend) and a lightweight
  React testing setup (frontend), decided when Iteration 03 or later actually introduces logic
  worth unit-testing. Not decided prematurely.

## Coverage so far (manual, per iteration)

### Phase 01 — Scaffolding

- `docker compose up --build`: both containers build and start.
- `GET /health` → `200 {"status": "ok"}`.
- `/` (frontend) loads, reaches backend.
- Tailwind: confirmed compiled utility classes present in the served CSS.

### Phase 02 — Iteration 01

- `GET /` and `GET /patient-record-processing` → `200`, expected heading/widget markup present
  (`curl` + `grep`).
- Home link (header) and breadcrumb link both confirmed present and pointing to `/`.
- Live-reload: edited a page file on the host with the stack already running (no rebuild),
  confirmed via `curl` that the edit reached the served page within seconds, for both frontend
  (`WATCHPACK_POLLING`) and backend (`WATCHFILES_FORCE_POLLING`).

### Phase 02 — Iteration 02

- `GET /sample-bundle` → `200`, `resourceType: "Bundle"`, `entry` count matches the known bundle
  (17) — confirms the read-only `inputdata/` mount and file-path resolution actually work inside
  the container, not just locally.
- Frontend page markup confirms all six buttons render with their iteration-02-specified labels
  (`Download Sample File`, `Load Sample File`, `Run Validation`, and the three disabled
  `(Coming Soon, for HIL mode)` buttons).
- Interactive state (button enabling/disabling, click handlers) not yet covered by an automated
  or scripted check — `curl` can't exercise client-side React state. Relies on Aaron's manual
  browser testing for this iteration, per the established workflow.

### Phase 02 — Iteration 03

- `GET /sample-bundle` piped into `POST /validate` on the real bundle → `valid: true`, exact
  per-resource-type counts matching the known bundle (`Patient: 2, Encounter: 2, Condition: 3,
  Observation: 4, MedicationRequest: 3, AllergyIntolerance: 3`), zero errors.
- `/validate` error paths tested directly: non-Bundle request body → `400` via `BadRequestError`;
  a bundle with an unsupported `resourceType` (`Procedure`) and a resource missing a required
  field (`Condition` without `id`) → both reported as separate entries in one response, confirming
  one bad entry doesn't prevent reporting on the rest.
- Backend package restructure (routers/core split from the previous iteration) re-verified as
  still working after adding the new `models/` package and `validation` router.

### Phase 02 — Iteration 04

- `POST /validate` on the real bundle → every one of the 18 discrepancies catalogued in
  `Knowledge.md` present exactly once, attached to the correct resource, with the correct `kind`
  (verified via full JSON inspection, not spot-checked): the duplicate-patient flag, both invariant
  violations (`con-3`/`ait-1`), all four missing-`display` cases, both dangling references
  (encounter + performer), the code/system mismatch, the unconfirmed-verification flag, and the
  `medicationrequest-003` duplicate-link flag. `discrepancy_count: 18` cross-checked arithmetically
  against the per-item counts.
- **Full interactive flow re-verified in a real browser** via `claude-in-chrome`: Load → Run
  Validation → confirmed the rendered `PatientCard` matches the API response — name/DOB/identifiers
  header, "18 discrepancies observed" badge, the possible-duplicate panel, all seven collapsible
  sections present with correct counts, the Excluded section auto-expanded showing all four
  excluded items with their reasons, and (via manually expanding Conditions) confirmed a
  non-excluded item's discrepancies render correctly alongside a clean zero-discrepancy item in the
  same list.

### Phase 02 — Iteration 04 refinement: hand-built edge-case fixtures

Two fixtures added at `backend/tests/fixtures/` for manual review and future automated-test use
(no test framework chosen yet — see below):

- **`fully_valid_bundle.json`** — one Patient (no duplicate), one of each other resource type, all
  clean (confirmed/active/final statuses, every coding has a `display`, every reference resolves).
  Verified: `discrepancy_count: 0`, `possible_duplicates: []`, zero structural errors. **This is
  the first verification of the single-Patient/no-duplicate code path** — previously flagged here
  as untested in isolation (the real bundle always has two Patients).
- **`fully_invalid_bundle.json`** — three Patients (two duplicates), one instance of every
  discrepancy kind, three resources whose subject points at the *other* duplicate (not just
  MedicationRequest, which is the only case the real bundle exercises), a `Condition` whose subject
  points at a patient not in the bundle at all, and three structural-error entries (missing
  `resource`, unsupported `resourceType`, resource missing a required field). Verified against the
  running backend: `valid: false`, 3 structural errors, `discrepancy_count: 23`, every expected
  discrepancy present.
- **Finding from building this:** a resource whose subject matches neither the canonical patient
  nor any flagged duplicate (the `Condition` case above) is silently absent from the entire
  response — not in its type bucket, not in `excluded`, no trace at all. Works as coded, but cuts
  against the project's "never silently drop" posture; not yet decided whether this needs its own
  discrepancy kind. See `Assumptions.md`/Iteration follow-up.

### Phase 02 — Iteration 05: Upload Custom File

All verification done in a real browser via `claude-in-chrome`'s `file_upload` tool (uploads
directly to the file input element, bypassing the native OS picker the automation can't otherwise
see) — not `curl`, since this is entirely client-side file-reading logic with no dedicated backend
endpoint to hit directly:

- Uploaded `backend/tests/fixtures/fully_valid_bundle.json` → correctly loaded ("6 resources"),
  Run Validation produced the identical zero-discrepancy result already verified for this fixture
  in Iteration 04's refinement pass.
- Uploaded a hand-written invalid-JSON file → `"broken.json" is not valid JSON.`, `loadedBundle`
  from the previous successful upload left untouched (confirmed Run Validation stayed enabled on
  the prior bundle rather than being reset by the failed attempt).
- Uploaded a hand-written valid-JSON-but-wrong-`resourceType` file (`{"resourceType": "Patient"}`)
  → `"wrong-type.json" does not look like a FHIR Bundle (resourceType must be "Bundle").`
- Uploaded `backend/tests/fixtures/fully_invalid_bundle.json` → identical result to the direct
  `curl` verification in the same iteration's refinement pass (23 discrepancies, 3 structural
  errors, both duplicates, all 5 excluded items) — confirms the upload path and the Load Sample
  File path converge on the exact same downstream behavior once a bundle is in state.

## Automated coverage

None yet. First candidates, once written:

- Backend: `GET /sample-bundle` — 200 case, 404 case (bundle path missing/misconfigured).
- Backend: `POST /validate` — now the strongest automated-test candidate that actually exists:
  non-Bundle body, unsupported resource type, per-field validation failures (missing required
  field, wrong type), and the happy path against the real sample bundle. Real branching logic now
  exists here, unlike the pure-passthrough `/sample-bundle`.
- Backend: `app/clinical_normalization/` — now built and the single highest-value place for real
  unit tests in this project (canonical-patient selection with 2+ patients and with only 1,
  status-exclusion per resource type including the "stopped ≠ excluded" distinction, every
  `discrepancies.py` check in isolation, the invariant-violation detection, the duplicate-patient-
  link flag). Currently only covered end-to-end (real bundle in, full response checked), but
  `backend/tests/fixtures/{fully_valid,fully_invalid}_bundle.json` now exist as ready-made inputs
  for exactly this once a framework is chosen — no per-function unit tests yet.
- Frontend: not yet planned in detail: likely component-level tests for the button
  enable/disable wiring once there's enough interactive logic to justify the setup cost.

## Still open

- Test framework choice (backend/frontend) — deferred until there's real logic to test.
- Whether/how the manual `curl`-based verification done each iteration gets formalized into a
  repeatable script vs. staying ad hoc per iteration.
