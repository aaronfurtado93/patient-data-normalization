# Assumptions

Assumptions made while planning this project, ahead of writing code. Each should be echoed in the
final `README.md` "key decisions" section so the reviewer sees the reasoning, not just the result.
Anything not yet decided is marked **open** rather than silently resolved.

## Data handling

- **`patient-001` and `patient-002` each get their own card** (see the "every Patient gets its own
  card" rule further down — this bullet is the original Phase 00 case study that rule
  generalizes). `patient-001` scores higher on completeness (SSN identifier, full `birthDate`, US
  Core race/ethnicity extensions) but that no longer makes it "the" record in any structural
  sense — `patient-002` is not merged into it, just cross-referenced as a possible match.
  **Superseded (Iteration 06, third pass):** `medicationrequest-003` was previously described here
  as shown under `patient-001`'s view with a "linked to unresolved duplicate" flag. It is not — it
  is shown on `patient-002`'s own card as an ordinary active medication (that's its actual
  `subject`), and `patient-002`'s card separately carries the possible-duplicate flag pointing at
  `patient-001`. No resource is ever displayed on a card other than the one its own reference names.
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
- **Every `Patient` resource in a bundle gets its own card, always — Default/auto mode never
  merges two patients' cards or resources, no matter how confidently they match.** (Iteration 06,
  third pass — **corrects** a same-day second-pass implementation that *did* merge matched patients
  into one card; that was a real mistake, caught by Aaron's review, not a deliberate design this
  supersedes casually.) Merging two patient records is an action reserved for an authorized human
  reviewer (HIL/manual mode) — this pipeline detects and flags a possible relationship, it does not
  act on it. This also **fully supersedes** Iteration 04's original "any additional Patient is a
  duplicate of the canonical one" assumption, which both merged unconditionally *and* implicitly
  assumed a bundle contains exactly one person — neither holds any more.
  - **The one explicit, auditable match rule** (`patient_reconciliation.same_person`, deliberately
    not fuzzy/similarity-scored — no soundex, no edit distance, no given-name matching): two
    `Patient` resources are flagged as a possible match if their normalized family names match
    **and** their `birthDate` values are compatible (exact match, or one is a component-wise prefix
    of the other at whatever precision each has — e.g. `"1958"` is compatible with `"1958-03-12"`).
    Either signal missing on either patient means **no** match — absence is never treated as a
    match. Matching is transitive for grouping purposes (if A matches B and B matches C, all three
    are cross-referenced) — but **matching only ever populates each matched patient's own
    `possible_duplicates` list**; it never changes which resources appear on which card. A resource
    is attributed to a card if and only if its own `subject`/`patient` reference points at that
    exact `patient_id` — matching a *different* patient (even a flagged duplicate) does not move a
    resource onto this card, and a resource with no subject at all, or one pointing at an
    unrecognized patient id, is silently absent from every card (an extension of the
    already-documented orphaned-reference gap below, now also covering the no-subject case).
  - **Explicitly not attempted**: any broader/fuzzier match signal (shared identifier, MRN-prefix
    relationship, given-name similarity) — considered and declined in favor of the narrower rule.
  - `completeness_score`/`reconcile_patients` (picking a "more complete" record within a matched
    group) remain defined in `patient_reconciliation.py` but are **not called** by the default-mode
    card-building path — kept as building blocks for a possible future HIL "which record should I
    merge/keep" view, not something that should silently influence what auto mode displays.
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
- **Applying a HIL merge ("Reconcile and Apply Merge") is a real, in-memory data-mutating
  operation** (Iteration 07, step 3) — it is not undoable within the app once clicked, only by
  reloading the original file. Still bounded, though: nothing is written to disk or persisted
  server-side (the backend stays stateless per the Scope section below); only the browser's
  in-memory `loadedBundle` changes, and reloading the sample/uploading a fresh file fully discards
  it. What actually happens:
  - The merged `Patient` keeps the LHS card's id ("A" — the card the merge icon was clicked from);
    the RHS ("B") `Patient` resource is dropped entirely. Only the three demographic fields the
    compare view exposes (name, birthDate, identifier) are chooseable between A/B — everything else
    on the Patient resource (gender, telecom, address, `meta`, extensions) silently keeps A's value
    regardless of B's, since there's no per-field control for those yet. A real, current UI
    limitation, not an inferred "A is always more correct" judgment.
  - **A resource is kept in the merged record if and only if its checkbox was checked** in the
    compare view — this is broader than "just dedup": unchecking *any* item (not only ones that
    look like a duplicate of something on the other side) permanently drops it from the result.
    The checklist is the actual final say on what survives, not merely a preview annotation.
  - `identifiers` is an all-or-nothing choice between A's whole list and B's whole list — no
    per-identifier merging (e.g. can't currently keep A's SSN and B's MRN together in one choice).
  - Re-validation after applying runs the exact same pipeline (`services.validation_service.
    run_validation`) as any other bundle — **every** patient card on screen is recomputed from the
    resulting bundle, not just the merged one, so unrelated patients' completeness/discrepancy
    numbers are confirmed unchanged rather than left stale.
- **Download Output produces a genuinely clean bundle by default** (Iteration 07, final step) —
  both filter checkboxes ("include items with discrepancies," "include entries marked as
  Excluded") default **off**, so the unmodified default download contains only current-fact,
  discrepancy-free clinical resources. Filters from the *current working bundle* (post-merge if a
  reconcile was applied, otherwise as loaded/validated), using the latest validation report's
  per-item classification — not a fresh re-derivation, so it always reflects what's on screen.
  - **Every `Patient` resource is always included**, regardless of either toggle — the toggles
    apply only to clinical resources (Encounter/Condition/Observation/MedicationRequest/
    AllergyIntolerance). A patient itself is never "excluded" or "has a discrepancy" in the same
    sense an individual clinical resource is (see `PatientCard`'s shape), so there's no equivalent
    toggle for omitting a patient — that would need a different, unasked-for decision (e.g. "leave
    out patient-002 entirely") this feature doesn't attempt.
  - The two toggles are independent, not layered: an excluded item is governed only by "include
    excluded," never by "include with discrepancies," even though every excluded item also carries
    at least one discrepancy (its exclusion reason) — checking only "include with discrepancies"
    does **not** pull excluded items back in.

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
- **A resource whose `subject`/`patient` reference doesn't match any `Patient` id in the bundle —
  or has no subject at all — is currently silently absent from every `PatientCard`**: not in its
  type bucket, not in `excluded`, no trace at all. Originally found while building `backend/tests/
  fixtures/fully_invalid_bundle.json` (`invalid-condition-2`); the no-subject case was folded into
  this same gap during Iteration 06's third pass (previously a subject-less resource defaulted onto
  the single existing card — with multiple cards now possible, guessing which one it belongs on
  would violate the "never guess" rule, so it's omitted instead, which then trips the "never
  silently drop" rule). Not yet decided whether either case needs its own discrepancy kind (e.g.
  `orphaned_patient_reference`) surfaced somewhere — revisit before considering the discrepancy
  catalog complete.
