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

## Automated coverage

None yet. First candidates, once written:

- Backend: `GET /sample-bundle` — 200 case, 404 case (bundle path missing/misconfigured).
- Backend, once it exists: the normalization/reconciliation pipeline — canonical-patient
  selection, status-based exclusion bucketing, dangling-reference handling, date-precision
  handling — these are exactly the clinical-data-safety-relevant branches from `Assumptions.md`
  and the highest-value place for real unit tests in this project.
- Frontend: not yet planned in detail: likely component-level tests for the button
  enable/disable wiring once there's enough interactive logic to justify the setup cost.

## Still open

- Test framework choice (backend/frontend) — deferred until there's real logic to test.
- Whether/how the manual `curl`-based verification done each iteration gets formalized into a
  repeatable script vs. staying ad hoc per iteration.
