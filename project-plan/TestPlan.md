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

### Phase 02 — Iteration 06: completeness indicator (MVP gap-closing)

Triggered by checking `ProjectPlan.md`'s Must Have list — the frontend didn't literally surface
"completeness" anywhere (only a discrepancy count). Added `completeness_percentage` to
`PatientCard`, verified against three known-quantity inputs rather than trusting the formula in
isolation:

- Real bundle → `33` — hand-verified: 5 clean items (`encounter-001`, `condition-001`,
  `observation-001`, `medicationrequest-001`, `medicationrequest-002`) out of 15 total.
- `fully_valid_bundle.json` → `100` — all 6 items clean.
- `fully_invalid_bundle.json` → `10` — hand-verified: only `medicationrequest-003` (past
  medications, zero discrepancies) out of 10 total is clean.
- Rendered value re-confirmed in a real browser (`claude-in-chrome`) matches the API value exactly
  ("33% complete," red badge since < 50).

### Phase 02 — Iteration 06, second pass: multiple distinct patients

- **Regression check first, before anything new**: real bundle + both existing fixtures re-run
  through `/validate` — all three produced byte-identical `completeness_percentage`,
  `discrepancy_count`, and `possible_duplicates` counts to before the clustering change. Confirms
  the new code path doesn't alter behavior for any bundle containing only one identity cluster
  (which is all three of the previously-existing test inputs).
- New fixture `backend/tests/fixtures/multiple_distinct_patients_bundle.json` — two
  Whitfield-pattern Patient resources (same match rule as the real bundle) + one unrelated Garcia
  patient, each cluster with its own Condition (Garcia also a MedicationRequest). Verified via raw
  JSON: exactly 2 `patients` entries; Whitfield cluster carries its duplicate panel + only its own
  Condition; Garcia cluster carries zero duplicates + only her own Condition/Medication — no
  resource leaked across clusters.
- Re-verified in a real browser (`claude-in-chrome`, via `file_upload`): both cards render
  side-by-side with correct content, matching the API response exactly.

### Phase 02 — Iteration 06, third pass: correcting an auto-merge mistake

Aaron caught a real defect in the second pass: matched patients were being merged into one card in
Default/auto mode, which should never happen — merging is a human-authorized (HIL) action only.
Corrected, then re-verified from scratch rather than assuming the fix was complete:

- **Real bundle**: now produces 2 cards (was incorrectly 1). `medicationrequest-003` confirmed on
  `patient-002`'s own card, not cross-attributed to `patient-001`. Combined totals across both
  cards (`16 + 2 = 18` discrepancies) reconcile exactly with the pre-merge single-card total,
  confirming no discrepancy was lost or duplicated by the re-attribution.
- **Both existing single-cluster fixtures** re-run — unaffected (they only ever had one cluster,
  so one-card-per-cluster and one-card-per-patient-within-a-cluster coincide when the cluster has
  one member... except where it doesn't: `multiple_distinct_patients_bundle.json`'s Whitfield pair
  now correctly produces 2 cards instead of 1, cross-flagging each other).
- **Two purpose-built fixtures**, per Aaron's explicit spec:
  - `three_patients_fully_valid_bundle.json` — 3 unrelated patients (different family names, no
    match), each with one Encounter/Condition/Observation/MedicationRequest/AllergyIntolerance, all
    clean. Verified: exactly 3 cards, `100%` completeness each, `0` discrepancies each, `0`
    possible_duplicates each (confirms no false-positive matching between unrelated patients).
  - `three_patients_partially_valid_bundle.json` — 2 patients matching on name+birthDate (Wei
    Chen, full vs. month-precision DOB) + 1 unrelated (Yusuf Ibrahim), deliberately uneven resource
    coverage (Chen-1: Encounter+Condition+Observation only; Chen-2: Condition+MedicationRequest
    only; Ibrahim: full complement including one excluded AllergyIntolerance). Verified: exactly 3
    cards at `67%` / `50%` / `80%` completeness respectively (hand-predicted before running, then
    confirmed exact match) — the two Chen cards symmetrically list each other in
    `possible_duplicates`, Ibrahim lists none.
- Both new fixtures re-verified in a real browser (`claude-in-chrome`, via `file_upload`) — cards
  render correctly, matching the API responses exactly.

### Phase 02 — Iteration 07, step 1: Validation Mode toggle + merge icon

All verified in a real browser (`claude-in-chrome`), since this is pure client-side UI state with
no backend endpoint to hit directly:

- Dropdown starts enabled (was hardcoded `disabled` before), switches to "HIL" correctly
  (`form_input` tool, confirmed via the underlying `<select>` value change).
- After Run Validation: dropdown visibly locks (greyed background, disabled), value still reads
  "HIL" — confirms it's disabled, not reset.
- Merge icon renders next to both matching Wei Chen cards' possible-duplicate entries, and is
  absent from Yusuf Ibrahim's card (which has no possible duplicates) — using
  `three_patients_partially_valid_bundle.json`, already known to produce exactly this shape.
- Loading a new file (Load Sample File) after a locked run: dropdown re-enables, "HIL" selection
  preserved (not reset to "Default").
- Default mode, same fixture, re-verified in-browser (not just by code inspection of the
  `mode === "hil"` guard): merge icon absent from all three cards, including the two with
  `possible_duplicates` — confirms the guard actually works, not just reads correctly.
- Explicitly confirmed (per Aaron's side note during this step): loading/uploading a new file
  clears the previous validation results (structural summary + all patient cards) immediately —
  already correct via the existing `applyLoadedBundle` reset from Iteration 02/05, re-verified live
  rather than assumed still true after this step's changes.

### Phase 02 — Iteration 07, step 2: 3-pane MergeView

Verified in a real browser (`claude-in-chrome`) using `three_patients_partially_valid_bundle.json`
(HIL mode, the two matching Wei Chen cards):

- Merge icon click opens the overlay with correct A/B assignment (A = card clicked from).
- Default selections match each side's actual data exactly: Encounters/Conditions/Active
  Medications/Observations pre-checked where present; correctly empty ("(none)") where a bucket has
  no items on that side (chen-1 has no medication, chen-2 has no encounter/observation).
- Center "Merged Preview" pane correctly unions checked items — confirmed both Conditions (from
  each side) appear together when both are checked.
- Unchecking an item on one side immediately removes it from the center pane (confirmed: unchecked
  chen-1's "I10" condition, center dropped to just chen-2's "Essential (primary) hypertension").
- Switching a demographic radio (DOB, A→B) immediately updates the center pane's shown value.
- Discrepancy indicators (⚠ count) carry through onto each item's checklist row, not just in the
  original cards — useful context while deciding what to include.
- Reverse-pair check: closed the view, opened it from chen-2's card instead (A=chen-2, B=chen-1 —
  the reverse of the first open) — confirmed fresh default selections for the new pair (all items
  re-checked, DOB radio back to defaulting on A), proving the `key`-forced remount actually resets
  state for a genuinely different pair rather than carrying over stale selections.

### Phase 02 — Iteration 07, step 3: Reconcile and Apply Merge

Full round trip verified in a real browser (`claude-in-chrome`) on
`three_patients_partially_valid_bundle.json` (the two matching Wei Chen cards, default selections
— nothing unchecked, both demographics left on A):

- `POST /validate` and `POST /reconcile` re-confirmed identical for the same input via `curl`
  before any frontend testing (both return `cards: 1, completeness: 100` for
  `fully_valid_bundle.json`) — proves the factored-out `run_validation()` behaves the same from
  either route.
- Clicked "Reconcile and Apply Merge": confirmation message shown; structural summary correctly
  dropped from 3 to 2 patients with every other resource count preserved (nothing silently lost);
  merged Wei Chen card at 60% complete / 2 discrepancies (hand-verified: 3 of 5 items clean,
  matches exactly); no duplicate panel remains on the merged card; **Yusuf Ibrahim's card
  confirmed completely unchanged** (still 80%/3 discrepancies) — the merge only touched its target
  pair, re-validating the whole bundle didn't perturb an unrelated patient's numbers.
- A real bug was caught live during this step, unrelated to the code I wrote: a stray trailing `/`
  appeared in `validation_service.py` on disk mid-session (same class of accidental corruption seen
  once before in `SKILL.md`) — confirmed it crashed the backend's reload with a `SyntaxError`
  (checked the logs to be sure, not assumed), fixed it, confirmed clean recovery before continuing.

**Unchecked-item case, also verified**: reopened the merge view, unchecked chen-1's Encounter,
applied. UI showed 50% complete / **3** discrepancies on the merged card — didn't match my own
quick hand-prediction (I expected 2), so rather than trust either the UI or my arithmetic, replayed
the exact same reconcile call directly against the backend (Python script reconstructing the same
bundle `lib/reconcile.ts` would have built, POSTed to `/reconcile`). **The UI was right, my
hand-prediction was wrong**: unchecking the Encounter orphaned `tp-partial-condition-chen1`'s
`encounter` reference (it pointed at the now-dropped Encounter) — the backend correctly flagged
this as a **new dangling-reference discrepancy**, on top of that condition's pre-existing
missing-display one. This is real, valuable confirmation of the design: a merge selection can have
second-order effects (orphaning a reference) that only the actual backend pipeline catches
correctly — client-side approximation would have missed it, same as my own hand-check did.

Not yet tested: `/reconcile`'s error path (network failure / non-2xx) in-browser — the code path
exists (`applyMergeError` state, inline error display in `MergeView`) but wasn't exercised live
this step.

### Phase 02 — Iteration 07, step 4: section-level discrepancy warning

Verified in a real browser against the real bundle's two-patient response (patient-001/
patient-002): sections with zero discrepancies show no marker on the collapsed summary; sections
with discrepancies show the correct count — Conditions ⚠2, Allergies ⚠3, Observations ⚠2,
Excluded ⚠8 (matches the already-verified 18-discrepancy total), and correct singular/plural
grammar (patient-002's "Active Medications" shows "⚠ 1 discrepancy").

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
  `backend/tests/fixtures/{fully_valid,fully_invalid,multiple_distinct_patients,
  three_patients_fully_valid,three_patients_partially_valid}_bundle.json` now exist as ready-made
  inputs for exactly this once a framework is chosen — no per-function unit tests yet.
  `same_person()`/`cluster_patients()` specifically deserve direct unit coverage of their edge
  cases (no name at all, name matches but birthDate absent on one side, three-way transitive
  clustering) beyond what the fixtures exercise end-to-end. `_build_card_for_patient()`'s strict
  subject-equality attribution (no cluster-based cross-attribution) is also now a specific
  regression worth a permanent test, given it was wrong once already.
- Frontend: not yet planned in detail: likely component-level tests for the button
  enable/disable wiring once there's enough interactive logic to justify the setup cost.

## Still open

- Test framework choice (backend/frontend) — deferred until there's real logic to test.
- Whether/how the manual `curl`-based verification done each iteration gets formalized into a
  repeatable script vs. staying ad hoc per iteration.
