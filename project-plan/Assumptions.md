# Assumptions

Assumptions made while planning this project, ahead of writing code. Each should be echoed in the
final `README.md` "key decisions" section so the reviewer sees the reasoning, not just the result.
Anything not yet decided is marked **open** rather than silently resolved.

## Data handling

- **`patient-001` is the canonical patient record.** It carries more complete data than
  `patient-002`: an SSN identifier, a full `birthDate` (vs year-only), and the US Core
  race/ethnicity extensions. `patient-002` is treated as an unresolved probable duplicate —
  surfaced as such, not silently merged into or dropped in favor of patient-001.
- **`medicationrequest-003` is shown in `patient-001`'s medication view, visibly flagged as linked
  to the unresolved duplicate (`patient-002`)** rather than treated as a confirmed active
  medication or silently omitted — e.g. "linked to an unresolved second patient record — verify
  before treating as active." Decided Phase 00 (2026-08-25); no longer open.
- **Any resource with a `status`/`clinicalStatus` of `entered-in-error`, or an inactive/resolved
  clinical status, is never presented as current clinical fact.** Excluded resources are kept in
  a separate bucket for transparency rather than deleted from the response entirely. Reinforced by
  the bundle itself: `condition-002` and `allergyintolerance-002` both violate FHIR invariants
  (`con-3` and `ait-1` respectively — `clinicalStatus` SHALL NOT be present when
  `verificationStatus` is `entered-in-error`) by carrying a stale `clinicalStatus` alongside an
  `entered-in-error` `verificationStatus`. Since the source data is already non-conformant here,
  `clinicalStatus` on an `entered-in-error` resource is treated as meaningless, not just outdated.
- **A missing coding `display` is never guessed or backfilled.** Where only `code` + `system` are
  present, the response shows those plainly (e.g. `LOINC 4548-4 — no display provided`) instead
  of inferring a human-readable label, from the AI assistant or otherwise.
- **A `code`/`system` mismatch (code shape doesn't match what its declared system normally
  produces) is flagged as a data-quality issue and shown as-is** — not corrected, not
  reinterpreted, and a `display` value present alongside it is still shown (the mismatch doesn't
  invalidate the rest of the coding). Confirmed case: `allergyintolerance-001` declares
  `http://snomed.info/sct` but carries a LOINC-shaped code (`7980-2`).
- **A medication with `status: stopped` is neither "active" nor treated like an
  entered-in-error/inactive exclusion.** It's real prescribing history — a deliberate discontinuation
  — so it's shown in its own **"past medications"** bucket, distinct from both the active-medications
  list and the excluded-resources bucket. Confirmed case: `medicationrequest-002` (Metformin).
- **Dangling references (pointing to a resource not present in the bundle) are resolved when
  possible and labeled unresolved when not** — never silently dropped, never a hard failure.
- **Partial dates (year-only) are displayed at their original precision**, not padded into a full
  date that would imply false certainty (e.g. `"2020"` stays `"2020"`, not `"2020-01-01"`).
- **US Core extensions (race/ethnicity) are modeled as demographic context**, not as clinical
  facts requiring reconciliation — no cross-checking against `patient-002`, which lacks them.
- **Canonical-patient selection is a generic completeness score, not a hardcoded id.** Implemented
  (Iteration 04) as: +10 for US Core profile conformance, +5 for an SSN identifier, +1 to +3 for
  `birthDate` precision (year/month/day), +1 per extension, +1 per identifier — the highest-scoring
  `Patient` in the bundle is canonical, every other one is an unresolved probable duplicate. This
  operationalizes the patient-001/patient-002 reasoning above without hardcoding those literal ids.
  **Explicitly scoped to one bundle at a time** (matches MVP scope). **Note this is a different
  "completeness" from `PatientCard.completeness_percentage` below** — this one scores a `Patient`
  resource's own demographic completeness, purely to pick a canonical record within an identity
  cluster; that one scores the canonical patient's clinical resources for the MVP's "display
  completeness" goal. Same word, deliberately different metrics for different purposes — not to be
  confused.
- **Multiple distinct patients in one bundle get one card each** (Iteration 06 — supersedes the
  earlier "any additional Patient is a duplicate of the canonical one" assumption from Iteration 04,
  which implicitly treated every bundle as containing exactly one person). Confirmed with Aaron
  before building, since this is a real clinical-data-safety judgment call (getting it wrong either
  merges two different real patients into one record, or splits a genuine duplicate into two).
  **The one explicit, auditable rule** (`patient_reconciliation.same_person`, deliberately not
  fuzzy/similarity-scored — no soundex, no edit distance, no given-name matching): two `Patient`
  resources are the same person if their normalized family names match **and** their `birthDate`
  values are compatible (exact match, or one is a component-wise prefix of the other at whatever
  precision each has — e.g. `"1958"` is compatible with `"1958-03-12"`). Either signal missing on
  either patient means **no** match — absence is never treated as a match. Matching is transitive
  (if A matches B and B matches C, all three cluster together). Patients matching no one get their
  own single-member cluster — their own card, no duplicate panel. Within each cluster, canonical
  selection is unchanged (`completeness_score`, highest wins). **Explicitly not attempted**: any
  broader/fuzzier signal (shared identifier, MRN-prefix relationship, given-name similarity) — the
  broader-matching option was considered and declined in favor of the narrower, more auditable rule.
- **`PatientCard.completeness_percentage`** (Iteration 06, closing a gap against
  `ProjectPlan.md`'s MVP wording — the discrepancy count alone wasn't a literal "completeness"
  indicator): % of the canonical patient's clinical resources (every encounter/condition/
  observation/medication/allergy, including excluded ones) that are **both** non-excluded **and**
  discrepancy-free. `100` when there are no clinical resources at all. Deliberately:
  - **Does not fold in the possible-duplicate flag** — that stays its own panel, not blended into
    one number that would conflate "is there a reconciliation concern" with "is the data itself
    clean."
  - **Is not a "how much of a complete medical history is present" score** — that would require
    clinical judgment (what *should* be present for this patient) this project has no grounds to
    assert. It only measures whether what *is* present in the bundle came through clean.
- **`Condition`/`AllergyIntolerance` Pydantic models don't enforce the `con-3`/`ait-1` FHIR
  invariants** they violate in this bundle — the violating resources still parse and are surfaced
  (flagged as `invariant_violation` discrepancies) rather than rejected as unparseable. Enforcing
  the invariant at the modeling layer would conflict with "surface the real data, never hide it."
- **Discrepancy detection is scoped to what's explicitly cataloged in `Knowledge.md`** — entered-
  in-error/inactive/resolved exclusion, FHIR invariant violations, missing `display`, dangling
  references, the SNOMED/LOINC code-shape mismatch, unconfirmed verification status, and the
  duplicate-patient link. **Deliberately does NOT** attempt to detect physiologically implausible
  values (e.g. the entered-in-error creatinine reading) or flag "missing reference range" /
  "missing reaction detail" as per-item issues — both would require inventing clinical thresholds
  or treating a uniform, bundle-wide absence as if it were a distinguishing problem, which this
  project has no authority to assert. Decided Iteration 04 (2026-08-25).

## Scope

- The bundle is **loaded once, statically** (from the provided JSON file), per "load the provided
  bundle" in the brief — not a general upload/ingest feature with edit/re-export.
- **No database or persistence layer.** The task is a single stateless normalize-and-render pass
  over one bundle; a DB would be unused scaffolding, not a requirement.
- **No code-graph or repo-analysis tooling (e.g. Graphify) in this build.** Not justified for a
  single-session, small-file-count project, and shouldn't consume the client-provided,
  budget-limited API key on tooling around the assignment rather than the assignment itself.
- **`/patient-summary` response shape is the candidate's call**, per the brief — grouped by
  demographics / active problems / medications (active + past, see above) / allergies / recent
  encounters / observations, with enough provenance per item (status, verification, resolution
  notes) for the frontend to render uncertainty honestly.
- **Excluded resources (entered-in-error / inactive / resolved / unresolved-duplicate-linked) ride
  along in the same `/patient-summary` API response**, in an `excluded` bucket carrying the
  resource type, id, and exclusion reason — not omitted in favor of a summary count. Decided
  Phase 00 (2026-08-25): matches the brief's "say so rather than hiding it" framing, and keeps the
  frontend able to render them as visibly flagged/collapsed items instead of just a number with no
  way to inspect what was excluded.
- **No auth, no multi-patient support.** Single synthetic patient, single bundle, matches the
  assignment as scoped. Noted in the README as a "would add with more time" item if relevant.

## Process

- **`docker compose up` / `docker compose down`** is the run method, to satisfy "if we cannot run
  it, we cannot evaluate it" without requiring manual environment setup.
- **AI agent never runs git operations** (commit/branch/push/merge) — all repo-state changes are
  made by Aaron by hand, per `GroundRules.md`. Read-only git commands are fine for context.
- **Every iteration produces a grouped change summary** (by root folder, then directory) before a
  manual commit, per `GroundRules.md` — so the eventual `AI_USAGE.md` can be written from those
  summaries rather than reconstructed from diffs after the fact.
- **Module naming**: the normalization work is named at the module level as
  `clinical_normalization` / `patient_normalization` (matches the brief's own phrase, "normalization
  pass that produces a clean, deduplicated, safe-to-display representation"); the specific
  duplicate-Patient-merge logic lives inside it as `patient_reconciliation`, since "reconciliation"
  correctly names that narrower piece but not the whole module.

## Still open

- ~~Exact `/patient-summary` response field names/nesting for the `excluded` bucket and the "past
  medications" bucket~~ — resolved Iteration 04: implemented as `PatientCard.excluded` and
  `PatientCard.medications_past` on `POST /validate`'s response (`backend/app/models/
  patient_card.py`). No longer open.
- Whether `POST /validate` is the final endpoint name/shape long-term, or gets renamed/split once
  HIL/manual-mode (custom upload, edit-and-resubmit) is built — not revisited yet, MVP naming has
  held so far.
- **A resource whose `subject`/`patient` reference matches neither the canonical patient nor any
  flagged duplicate is currently silently absent from `PatientCard`** — not in its type bucket, not
  in `excluded`, no trace at all. Found while building `backend/tests/fixtures/
  fully_invalid_bundle.json` (its `invalid-condition-2` exercises exactly this). Current behavior
  is intentional as originally coded (an unrelated resource "doesn't belong on this card"), but it
  cuts against the project's general "never silently drop, always say so" posture applied
  everywhere else. Not yet decided whether this needs its own discrepancy kind (e.g.
  `orphaned_patient_reference`) surfaced somewhere on the card — revisit before considering the
  discrepancy catalog complete.
