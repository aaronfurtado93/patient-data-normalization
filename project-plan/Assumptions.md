# Assumptions

Assumptions made while planning this project, ahead of writing code. Each should be echoed in the
final `README.md` "key decisions" section so the reviewer sees the reasoning, not just the result.
Anything not yet decided is marked **open** rather than silently resolved.

## Data handling

- **`patient-001` is the canonical patient record.** It carries more complete data than
  `patient-002`: an SSN identifier, a full `birthDate` (vs year-only), and the US Core
  race/ethnicity extensions. `patient-002` is treated as an unresolved probable duplicate —
  surfaced as such, not silently merged into or dropped in favor of patient-001.
- **`medicationrequest-003`'s disposition is open.** It references `patient-002`, not the
  canonical patient. Current lean is: show it, but visibly flagged as linked to an unresolved
  secondary patient record rather than treated as a confirmed active medication. Final call and
  rationale go in the README.
- **Any resource with a `status`/`clinicalStatus` of `entered-in-error`, or an inactive/resolved
  clinical status, is never presented as current clinical fact.** Excluded resources are kept in
  a separate bucket for transparency rather than deleted from the response entirely.
- **A missing coding `display` is never guessed or backfilled.** Where only `code` + `system` are
  present, the response shows those plainly (e.g. `LOINC 4548-4 — no display provided`) instead
  of inferring a human-readable label, from the AI assistant or otherwise.
- **Dangling references (pointing to a resource not present in the bundle) are resolved when
  possible and labeled unresolved when not** — never silently dropped, never a hard failure.
- **Partial dates (year-only) are displayed at their original precision**, not padded into a full
  date that would imply false certainty (e.g. `"2020"` stays `"2020"`, not `"2020-01-01"`).
- **US Core extensions (race/ethnicity) are modeled as demographic context**, not as clinical
  facts requiring reconciliation — no cross-checking against `patient-002`, which lacks them.

## Scope

- The bundle is **loaded once, statically** (from the provided JSON file), per "load the provided
  bundle" in the brief — not a general upload/ingest feature with edit/re-export.
- **No database or persistence layer.** The task is a single stateless normalize-and-render pass
  over one bundle; a DB would be unused scaffolding, not a requirement.
- **No code-graph or repo-analysis tooling (e.g. Graphify) in this build.** Not justified for a
  single-session, small-file-count project, and shouldn't consume the client-provided,
  budget-limited API key on tooling around the assignment rather than the assignment itself.
- **`/patient-summary` response shape is the candidate's call**, per the brief — grouped by
  demographics / active problems / medications / allergies / recent encounters / observations,
  with enough provenance per item (status, verification, resolution notes) for the frontend to
  render uncertainty honestly.
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

## Still open — revisit during Phase 2

- Final disposition of `medicationrequest-003` (see above).
- Exact `/patient-summary` response schema (fields, nesting, how "excluded/unresolved" items are
  represented alongside "current fact" items).
- Whether excluded resources (entered-in-error, inactive, unresolved-duplicate-linked) are
  returned in the same API response for the frontend to render as flagged items, or omitted from
  the API and only noted in a summary/count — leaning toward including them, since "say so rather
  than hiding it" in the brief argues against omission.
