# Iteration 03: Pydantic v2 resource models + POST /validate endpoint

Scope confirmed with Aaron before building (two clarifying questions): the endpoint receives the
bundle as raw JSON in the POST body (not multipart upload), and this iteration is structural
validation only — does the bundle parse into our models? — not the deeper data-quality flagging
(entered-in-error, dangling refs, duplicate patients, etc.), which is the reconciliation pipeline's
job in a later iteration.

**Backend (`backend/app/models/`)** — new package

| File | Change | Description |
|---|---|---|
| `__init__.py` | added | Modeling-rules docstring (raw-string dates for partial-precision support, only-model-what's-present) — read first, referenced by every other module here. |
| `common.py` | added | Shared FHIR datatype building blocks: `Coding`, `CodeableConcept`, `Identifier`, `Reference` (with `resource_type`/`resource_id` helper properties), `Period`, `HumanName`, `ContactPoint`, `Address`, `Quantity`, `Meta`, `Extension`. |
| `patient.py` | added | `Patient`, `PatientLink` (the FHIR `link` element — modeled even though absent in this bundle, since its absence is exactly why patient-001/002 duplication is inferred, not resolved). |
| `encounter.py` | added | `Encounter` (`class_` aliased from FHIR's reserved-word `class`). |
| `condition.py` | added | `Condition` — deliberately doesn't enforce the `con-3` FHIR invariant it violates in this bundle (`condition-002`), so the violating resource still parses. |
| `observation.py` | added | `Observation`, `ObservationComponent`. |
| `medication_request.py` | added | `MedicationRequest`, `DosageInstruction`. |
| `allergy_intolerance.py` | added | `AllergyIntolerance` — same permissive-on-invariant-violation approach as `condition.py` (`ait-1`, `allergyintolerance-002`). |
| `bundle.py` | added | `RESOURCE_MODELS` dict (resourceType → model, used by `/validate`'s per-entry loop) + `Bundle`/`BundleEntry`/`AnyResource` (discriminated union, for all-or-nothing validation elsewhere). |
| `validation.py` | added | `ValidationIssue`, `ValidationReport` — `/validate`'s response shape. |

**Backend (`backend/app/routers/`)**

| File | Change | Description |
|---|---|---|
| `validation.py` | added | `POST /validate` — walks `entry` manually (not via the `Bundle` model directly) so one malformed entry doesn't prevent reporting on the rest. 400s via `BadRequestError` if the body isn't a Bundle at all; otherwise always 200 with a `ValidationReport` (counts + per-entry errors). |
| `__init__.py` | modified | Registered the new `validation_router` on `api_router`. |

**Frontend (`frontend/app/patient-record-processing/`)**

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | `Run Validation` now POSTs `loadedBundle` to `/validate` and renders the real `ValidationReport` — valid/invalid badge, per-resource-type counts, and a list of any `ValidationIssue`s (entry index, resource type/id, message). Separate `validationError` state for network-level failures, kept distinct from the report's own `errors` array and from the Load-related `statusMessage`. |

(Held back initially pending Aaron's review of the models/endpoint; wired in this same iteration
after Aaron confirmed "wire it now.")

**Decisions this iteration**

- **Validation scope confirmed as structural-only** (not data-quality flagging) — see scope note
  above. Explicit choice, not a silent narrowing.
- **`Condition`/`AllergyIntolerance` models don't enforce the `con-3`/`ait-1` FHIR invariants they
  violate in this bundle.** Flagging as a data-handling-adjacent call: enforcing those invariants
  would make `condition-002`/`allergyintolerance-002` fail to parse entirely, which conflicts with
  the project's "surface the real data, never hide it" posture — better to let them parse and flag
  the invariant violation later (already documented in `Assumptions.md`/`Knowledge.md`) than to
  reject them at the modeling layer.
- No other clinical-data-safety decisions — this is structural parsing only, no exclusion-bucket
  logic, no reconciliation, no interpretation of clinical meaning.

**Verification performed**

- `GET /sample-bundle` piped into `POST /validate` on the real bundle → `valid: true`, exact
  per-type counts matching `Knowledge.md`'s catalog (`Patient: 2, Encounter: 2, Condition: 3,
  Observation: 4, MedicationRequest: 3, AllergyIntolerance: 3`), zero errors.
- Error paths tested directly: non-Bundle body → 400 (`BadRequestError`, through the existing
  error-envelope machinery from Iteration 02's restructure); a bundle with an unsupported
  `resourceType` (`Procedure`) and a resource missing a required field (`Condition` without `id`)
  → both reported as separate `ValidationIssue` entries in one response, confirming multi-error
  reporting works rather than stopping at the first problem.
- Backend container rebuilt cleanly; `/health` and `/sample-bundle` reconfirmed unaffected by the
  new `models`/`validation` additions.
- **Full interactive flow verified in a real browser** (not just `curl`): navigated to
  `/patient-record-processing`, clicked Load Sample File ("Sample file loaded — 17 resources."),
  confirmed Run Validation went from disabled to enabled, clicked it, and confirmed the rendered
  report matched the API response exactly — green "Bundle is structurally valid." plus all six
  resource-type counts.

**Suggested commit message** (for Aaron to use, not run by the agent):
`feat: add Pydantic v2 resource models, POST /validate endpoint, and wire it into the Run Validation button`
