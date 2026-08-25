# Low-Level Design — Centauri Clinical Snapshot

Written incrementally per Phase 02 iteration, against real code — not drafted ahead of it. Only
covers what's actually implemented; each iteration adds its section rather than speculating about
future ones.

## Backend

### Package structure

```
backend/app/
├── main.py            # wiring only: creates the app, registers middleware/exception
│                       # handlers, includes api_router. No route logic, no exception handling.
├── core/
│   ├── errors.py               # AppError hierarchy (BadRequestError, NotFoundError,
│   │                             ServiceUnavailableError, ...) — route code raises these,
│   │                             never fastapi.HTTPException directly.
│   └── exception_handlers.py   # register_exception_handlers(app) — one place, registered
│                                 once. Every error response (AppError, HTTPException — including
│                                 the base Starlette one FastAPI's routing raises internally for
│                                 e.g. unmatched routes, RequestValidationError, or a genuinely
│                                 unhandled Exception) comes back as
│                                 {"error": {"code": <str>, "message": <str>}}.
└── routers/
    ├── __init__.py     # api_router — aggregates every domain router; main.py includes only this.
    ├── health.py       # GET /health
    └── sample_bundle.py  # GET /sample-bundle
```

**Rule going forward:** one router module per resource/domain (not one giant `main.py` with every
route inline) — add a new `routers/<name>.py`, register it in `routers/__init__.py`. Route code
raises an `AppError` subclass for expected failure cases (e.g. `NotFoundError`); add a new subclass
to `core/errors.py` if none fits rather than reaching for `HTTPException`.

**Gotcha worth keeping documented:** the exception handler for "unhandled HTTP errors" must be
registered on `starlette.exceptions.HTTPException` (the base class), not `fastapi.HTTPException`
(a subclass) — FastAPI's own routing layer raises the *base* class directly for things like an
unmatched route, and a handler registered only for the subclass silently misses it (confirmed by
testing: an unknown route came back as FastAPI's default `{"detail":"Not Found"}` until fixed).

### `GET /health`

Returns `{"status": "ok"}`. No parameters, no auth. Liveness/connectivity check only.

### `GET /sample-bundle` (Iteration 02)

Returns the static sample bundle file verbatim as JSON — no parsing into Pydantic models, no
normalization, no filtering. Single source of truth for both the frontend's "Download Sample File"
and "Load Sample File" actions (see Frontend section below), rather than duplicating the bundle
into the frontend build.

- **Method/path:** `GET /sample-bundle`
- **Response 200:** the full contents of `inputdata/scenario1_fhir_bundle[78].json`, `Content-Type:
  application/json`.
- **Response 404:** `{"detail": "Sample bundle not found on the server."}` if the file isn't where
  expected (e.g. the Compose volume mount is missing).
- **File resolution:** `Path(__file__).resolve().parents[2] / "inputdata" /
  "scenario1_fhir_bundle[78].json"` — i.e. `backend/app/routers/sample_bundle.py` → `parents[2]` is
  the container's `/app` WORKDIR, where `docker-compose.yml` bind-mounts the repo's `inputdata/`
  read-only. **Only valid when run via Docker Compose** (per `Assumptions.md`'s "Compose is the run
  method" decision) — there's no fallback path for running `uvicorn` directly outside a container.
- **404 case now raises `NotFoundError`** (from `app.core.errors`), not `HTTPException` directly —
  comes back through the shared error envelope like any other `AppError`.

### `app/models/` — Pydantic v2 resource models (Iteration 03)

One module per FHIR resource type actually present in the bundle, plus shared building blocks.
Modeling rules are documented once in `app/models/__init__.py`'s docstring (worth reading in full)
— the two that matter most:

- Every `date`/`dateTime` field (`birthDate`, `onsetDateTime`, `effectiveDateTime`, `authoredOn`,
  `recordedDate`) is typed `str`, not Pydantic's `date`/`datetime` types, because FHIR allows
  partial precision (`"1958"`, `"2019"`, `"2020"`) that stdlib date types reject outright. This is
  the direct implementation of `Assumptions.md`'s "partial dates shown at original precision"
  rule — modeling them as anything else would silently violate it.
- `Condition`/`AllergyIntolerance` deliberately do **not** enforce the FHIR invariants they violate
  in this bundle (`con-3`/`ait-1` — see `Knowledge.md`) — the models stay permissive so the
  violating resources (`condition-002`, `allergyintolerance-002`) still parse and can be reported
  on, rather than being rejected as unparseable. Enforcing the invariant here would fight the
  project's own "surface the real data" posture.

```
app/models/
├── __init__.py              # modeling rules docstring — read this first
├── common.py                 # Coding, CodeableConcept, Identifier, Reference, Period,
│                               HumanName, ContactPoint, Address, Quantity, Meta, Extension
├── patient.py                 # Patient, PatientLink
├── encounter.py                # Encounter
├── condition.py                 # Condition
├── observation.py                # Observation, ObservationComponent
├── medication_request.py          # MedicationRequest, DosageInstruction
├── allergy_intolerance.py          # AllergyIntolerance
├── bundle.py                        # Bundle (discriminated-union entries) + RESOURCE_MODELS dict
└── validation.py                     # ValidationIssue, ValidationReport — /validate's response shape
```

`bundle.py` exposes resource typing two ways, deliberately:
- **`RESOURCE_MODELS`** (`dict[str, type[BaseModel]]`) — used by `/validate` to validate each
  bundle entry individually via `model.model_validate(...)`, so one malformed entry doesn't prevent
  reporting on the rest. This is what the endpoint actually uses.
- **`Bundle`** (with `AnyResource`, a `Field(discriminator="resourceType")` union) — the canonical
  typed shape of an entire bundle, for anywhere that wants all-or-nothing validation instead.

### `POST /validate` (Iteration 03)

Structural validation only — confirmed with Aaron before building: does the bundle parse into the
models above? Does **not** flag entered-in-error/inactive resources, dangling references, missing
`display`, or duplicate patients — that's the reconciliation/normalization pipeline's job, not yet
built.

- **Request body:** the full bundle as raw JSON (`dict[str, Any]` — not bound to the `Bundle`
  Pydantic model directly, so a malformed request doesn't produce FastAPI's generic 422 instead of
  this endpoint's own structured report).
- **400** (`BadRequestError`) if `resourceType != "Bundle"` or `entry` isn't an array — these are
  "not a bundle at all" cases, not per-resource issues, so they short-circuit before iterating.
- **200** always otherwise, with `ValidationReport`:
  - `valid: bool` — `not errors`.
  - `resource_counts: dict[str, int]` — successfully-parsed count per `resourceType`.
  - `errors: list[ValidationIssue]` — one entry per problem: `entry_index`, `resource_type` /
    `resource_id` (best-effort, `None` if unavailable), `message`. Covers three cases: entry
    missing a `resource` object, unsupported `resourceType` (not in `RESOURCE_MODELS`), and a
    resource that fails `model_validate` (message built from `ValidationError.errors()`, one
    `loc: msg` per violation, semicolon-joined).
- **Verified against the real bundle:** `GET /sample-bundle` piped into `POST /validate` returns
  `valid: true`, exact per-type counts (`Patient: 2, Encounter: 2, Condition: 3, Observation: 4,
  MedicationRequest: 3, AllergyIntolerance: 3`), zero errors — matches the known bundle contents
  from `Knowledge.md`. Also verified the three error paths directly (non-Bundle body → 400;
  unsupported resource type + a resource missing a required field → both reported in one
  response, not just the first).

### `app/clinical_normalization/` — reconciliation + discrepancy detection (Iteration 04)

Turns the resources `bundle_parser.py` successfully parsed into one `PatientCard` — the canonical
patient plus everything that references it (or a flagged duplicate), bucketed by type, with
discrepancies attached per item. See `implementation-logs/Knowledge.md` for the full data-quality
catalog this operationalizes and `Assumptions.md` for the reasoning behind each rule.

```
app/clinical_normalization/
├── __init__.py                # module-layout docstring — read first
├── bundle_parser.py            # parse_bundle_entries() — moved here from routers/validation.py
│                                 (Iteration 03) so /validate and patient_card.py share one
│                                 per-entry parsing pass, never disagreeing about what's valid.
├── patient_reconciliation.py    # reconcile_patients() — completeness-score canonical selection
├── status_filters.py             # *_exclusion_reasons() — entered-in-error/inactive/resolved,
│                                   per resource type. "stopped" MedicationRequest is NOT here —
│                                   handled as its own bucket by patient_card.py.
└── discrepancies.py               # missing_display, code_system_mismatch, dangling_reference,
                                     invariant_violation (con-3/ait-1), unconfirmed_verification
```

`patient_card.py`'s `build_patient_card()` is deliberately **explicit per-resource-type blocks**,
not one generic loop over "all resources" — more code, but each block (Encounter/Condition/
Observation/MedicationRequest/AllergyIntolerance) is independently auditable, which matters more
than DRY-ness for logic with real clinical-data-safety weight. Shared per-item logic (the
duplicate-patient-link check, "does this belong to this patient at all") is factored into two small
closures (`linked_patient_discrepancy`, `belongs_to_this_patient`) rather than duplicated six times.

**Canonical-patient selection** (`patient_reconciliation.completeness_score`): +10 US Core profile,
+5 SSN identifier, +1..+3 `birthDate` precision, +1 per extension, +1 per identifier — highest
score wins, every other `Patient` in the bundle becomes a `possible_duplicates` entry. See
`Assumptions.md` for why this is scoped to one bundle at a time, not generic identity matching.

**MedicationRequest is the one three-way bucket**: `excluded` (entered-in-error) /
`medications_past` (`status: stopped`) / `medications_active` (everything else) — every other
resource type is a simple two-way excluded/current-fact split.

**A resource whose subject points at the canonical patient's flagged duplicate** (only
`medicationrequest-003` in this bundle) still appears in the canonical patient's card, in its
normal bucket (active/past/excluded, same rules as any other item), but carries an
`unresolved_duplicate_patient_link` discrepancy — per `Assumptions.md`'s Phase 00 decision on
`medicationrequest-003` specifically, generalized to any resource type that might do this.

**Deliberately not detected** (see `Assumptions.md` for the reasoning): physiologically implausible
values, "no reference range available," "no reaction detail available" — these would require
inventing clinical thresholds or flagging a uniform bundle-wide absence as if it were
instance-specific, neither of which this project has grounds to assert.

### `POST /validate` response, updated (Iteration 04)

Same `valid`/`resource_counts`/`errors` as Iteration 03, plus:

- **`patient: PatientCard | None`** — `None` only if the bundle has no `Patient` resource at all.
  Built from whatever parsed successfully (structural errors are already reported separately in
  `errors`; unparseable entries simply don't appear in the card).

`PatientCard` shape (`app/models/patient_card.py`):
- `patient_id`, `name`, `birth_date`, `identifiers` — canonical patient's demographics.
- `possible_duplicates: list[PossibleDuplicatePatient]` — every other `Patient` resource found.
- `encounters` / `conditions` / `observations` / `medications_active` / `medications_past` /
  `allergies`: `list[ResourceCardItem]`, current-fact only.
- `excluded: list[ResourceCardItem]` — every excluded item across every type, in one place, each
  self-describing (`resource_type`, `excluded: true`, its exclusion-reason discrepancies).
- `discrepancy_count: int` — every discrepancy across every item, plus one per possible duplicate.

`ResourceCardItem`: `resource_type`, `resource_id`, `summary` (best-effort human-readable label —
`code.text` → `code.coding[0].display` → `code.coding[0].code` → a generic fallback like
`"Condition"`, never guessed further), `status`, `excluded: bool`, `discrepancies:
list[Discrepancy]` (`kind` + `message`).

**Verified against the real bundle:** every one of the 18 discrepancies documented in
`Knowledge.md` shows up exactly once, attached to the correct resource, with the correct `kind` —
see `Iteration-04.md` for the full verification record (structural JSON check + a real
browser-driven click-through).

**`completeness_percentage`** (Iteration 06): computed last, after every bucket is finalized —
`round(100 * clean_items / total_items)` where `total_items` is every item across all seven buckets
(including `excluded`) and `clean_items` is those with `excluded=False` and `discrepancies=[]`.
`100` if there are no clinical resources at all. See `Assumptions.md` for the full reasoning,
including why this is a *different* metric from `patient_reconciliation.completeness_score` (which
scores a `Patient` resource's demographic completeness for canonical-selection purposes, not the
same thing). Verified: real bundle → `33` (5 of 15 clean), `fully_valid_bundle.json` → `100`,
`fully_invalid_bundle.json` → `10` (1 of 10 clean) — all hand-checked against the actual bucket
contents, not just trusted from the code.

**Multiple distinct patients → multiple cards, never merged** (Iteration 06 — two passes, the
first of which was a real mistake caught by Aaron's review, corrected in the second): `POST
/validate`'s response field is `patients: list[PatientCard]`. **One card per `Patient` resource,
always** — matching two patients via `same_person()` never combines their cards or resources; it
only populates each matched patient's own `possible_duplicates` list, pointing at the other(s).
Merging is an action reserved for an authorized human (HIL/manual mode), not something this
pipeline performs. See `Assumptions.md` for the full correction history and reasoning — worth
reading in full since it documents a real design mistake, not just a feature addition.

`clinical_normalization/patient_reconciliation.py` has `same_person()` (the one explicit match
rule — normalized family name + compatible `birthDate`) and `cluster_patients()` (union-find
transitive grouping over that rule) — used **only** to build each card's `possible_duplicates`
list. `completeness_score`/`reconcile_patients` (picking a "more complete" record) remain defined
but are not called by the card-building path at all — no canonical/duplicate distinction exists in
default-mode output; every patient's card is built identically regardless of match status.

`patient_card.py`'s `_build_card_for_patient()` attributes a resource to a card if and only if its
own `subject`/`patient` reference equals that exact `patient_id` — strict equality, no cluster
membership involved. A resource with no subject, or one referencing an unrecognized patient id, is
silently absent from every card (see `Assumptions.md` "Still open" — an extension of the
pre-existing orphaned-reference gap, now also covering the no-subject case, since guessing which
of several possible cards a subject-less resource belongs on would violate the "never guess" rule).

Verified: the real bundle now correctly produces **2** cards (was wrongly 1 during the brief
merged-implementation window) — `patient-001` and `patient-002` each with only their own resources
(`medicationrequest-003` now correctly on `patient-002`'s own card, not cross-attributed to
`patient-001`'s), combined discrepancy totals reconciling exactly with the pre-change single-card
total (16+2=18). Both single-cluster fixtures regression-clean. Two new fixtures purpose-built for
this: `three_patients_fully_valid_bundle.json` (3 unrelated patients, full resource complement
each, zero discrepancies) → 3 cards, 100% each, no false-positive matches. `three_patients_
partially_valid_bundle.json` (2 loosely-matching + 1 unrelated, deliberately uneven resource
coverage and data quality per patient) → 3 cards at 67%/50%/80% completeness, the two matching
patients symmetrically flagging each other, the third flagging no one. All verified via raw JSON
and a real browser render.

## Frontend

### `components/patient-card/` (Iteration 04)

- `types.ts` — TypeScript mirror of `app/models/patient_card.py`. No shared-schema codegen at this
  project's scale; kept in sync by hand, flagged here so a future backend field change is easy to
  remember to mirror.
- `ResourceSection.tsx` — reusable collapsible (`<details>`/`<summary>`) list for one bucket;
  renders nothing if empty. Excluded items get a red-tinted row + "Excluded — not shown as current
  fact" label; every item's `discrepancies` render as `⚠ message` lines. The Excluded section opens
  by default (`defaultOpen`) — the whole point of that bucket is to not require hunting for it.
- `PatientCard.tsx` — the card itself: name/DOB/identifiers header, a `completeness_percentage`
  badge (always shown; color-coded green ≥90 / amber ≥50 / red below — a visual scale only, not a
  clinical judgment) plus a discrepancy-count badge (shown only if > 0) stacked underneath, the
  possible-duplicate panel (only shown if any), then one `ResourceSection` per bucket in a fixed
  order (Encounters, Conditions, Active Medications, Past Medications, Allergies, Observations,
  Excluded).

Rendered on `/patient-record-processing` below the existing structural-validation summary
(Iteration 03's valid/invalid badge + counts) — both stay visible; they answer different questions
("does it parse" vs. "what does the patient's record actually look like, with issues surfaced").
Iteration 06: `page.tsx` maps `validationReport.patients` (an array) to one `<PatientCard>` per
entry, keyed by `patient_id` — was a single optional card before.

### Layout (Iteration 01)

- `AppShell` (client component, holds sidebar open/closed state) → composes `Header` + `Sidebar` +
  `<main>`. Mounted once in `app/layout.tsx`, wraps every page.
- `Header` — hamburger button (plain CSS bars, no icon library) + app title, title is a `Link` to
  `/` (home button, added per Iteration 01 feedback).
- `Sidebar` — overlay drawer (`fixed`, backdrop click-to-close), menu items are a plain array
  (`MENU_ITEMS`) — currently one entry, trivial to extend.
- `Breadcrumb` — reusable, takes `{ label, href? }[]`; last item (no `href`) renders as
  non-clickable current-page text. Used on Patient Record Processing.

### Pages

- **`/` (Dashboard)** — heading + one `ProcessingWidget` card linking to
  `/patient-record-processing`.
- **`/patient-record-processing`** (Iteration 02) — client component, local state only (no global
  state manager; not warranted at this scale):
  - `downloadState`, `loadState`: `"idle" | "loading" | "error"`.
  - `loadedBundle: Record<string, unknown> | null` — raw bundle JSON once "Load Sample File"
    succeeds; drives `Run Validation`'s `disabled` prop (`!loadedBundle`).
  - `statusMessage: string | null` — single status line under the buttons; used for load
    success/failure and the Run Validation placeholder message.
  - `fetchSampleBundle()` — shared `fetch(BACKEND_URL + "/sample-bundle")` helper used by both
    Download and Load, so there's exactly one code path talking to the endpoint.
  - **Download**: fetches the bundle, wraps it in a `Blob`, triggers a client-side save via a
    temporary `<a download>` + `URL.createObjectURL` (revoked after click) — no backend
    `Content-Disposition` handling needed, keeps the endpoint itself content-negotiation-free.
  - **Load**: fetches the bundle into `loadedBundle` state, shows an entry count in
    `statusMessage` if `bundle.entry` is an array (defensive — doesn't assume shape beyond what's
    needed to display a count).
  - **Run Validation** (Iteration 03): enabled only once `loadedBundle` is set; POSTs it to
    `/validate` and renders the `ValidationReport` — valid/invalid badge, per-resource-type counts,
    and any `ValidationIssue`s. Network-level failures go to a separate `validationError` state,
    kept distinct from both the report's own `errors` array and the Load-related `statusMessage`.
  - **Upload Custom File** (Iteration 05): real, no backend round trip needed to "load" it — a
    hidden `<input type="file">` (triggered by a visible styled button via a `ref`, so the native
    file picker keeps the app's own button styling) reads the selected file client-side with
    `file.text()`, `JSON.parse`s it, and checks `resourceType === "Bundle"` before calling the same
    `applyLoadedBundle()` helper Load Sample File uses (factored out this iteration so both paths
    share one "put a bundle into state, reset any stale validation result" code path). Two
    client-side guard checks exist purely for fast, accurate feedback — **not** as a duplicate of
    `/validate`'s real structural validation, which still runs (and is authoritative) once Run
    Validation is clicked:
    - Invalid JSON → `"<filename>" is not valid JSON.` (separate `uploadError` state, doesn't
      touch `statusMessage` or clear a previously-successfully-loaded bundle).
    - Parses but `resourceType !== "Bundle"` → `"<filename>" does not look like a FHIR Bundle
      (resourceType must be "Bundle").`
    - Anything that clears both checks is handed to `/validate` exactly like the sample bundle is —
      no special-casing downstream; a messy uploaded bundle gets the same discrepancy treatment as
      a messy sample bundle would.
    - `event.target.value` is reset to `""` after reading the file, so re-selecting the same
      filename still fires `onChange` (otherwise the browser treats it as no change).
  - **Edit Mode / Download Output**: still permanently `disabled`, styled distinctly
    (`stretchButtonClass`) — the remaining HIL-mode stretch goals per `Assumptions.md`.
  - **Validation Mode toggle**: `<select disabled>`, `Default` / `HIL (Coming Soon)` — present but
    inert. Note: Upload Custom File works today under "Default" mode — `/validate` doesn't
    currently distinguish a mode at all, so an uploaded bundle is validated identically to the
    sample bundle. This toggle governs the *edit-in-place* HIL capability specifically, not
    whether upload/validate works.

## Not yet designed

- HIL/manual-mode: custom bundle upload, in-browser editing, download-output. Stretch scope, UI
  buttons exist as disabled placeholders; nothing behind them yet.
- Whether `/validate`'s name/shape survives once HIL mode needs to resubmit an *edited* patient
  card rather than just validating a freshly-uploaded bundle — noted as open in `Assumptions.md`.
