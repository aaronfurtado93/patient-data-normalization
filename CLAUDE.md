# CLAUDE.md — Clinical Snapshot (patient-data-normalization)

Project-specific rules for AI agents (Claude or otherwise) working in this repo. This file is the enforceable summary of
`project-plan/GroundRules.md` and `project-plan/Assumptions.md` — read those two in full at the start of a session; this
file exists so the rules travel with the repo context automatically instead of relying on memory.

## What this project is

A take-home: reconcile a single messy FHIR R4 bundle (`inputdata/scenario1_fhir_bundle[78].json`)
into a clinician-scannable patient snapshot. Domain framing is patient-summary/reconciliation (USCDI/IPS-shaped), not
PAS/prior-auth — no procedure codes, no admission/discharge/service dates.

- MVP: auto-mode — load the bundle, backend returns an evaluation report, frontend renders each patient record's
  completeness.
- Stretch: HIL/manual-mode — user uploads their own FHIR-conformant JSON, gets the same evaluation, can expand sections
  to correct/complete data, downloads auto-generated or edited JSON.

Stack: FastAPI + Pydantic v2 + uvicorn (backend), Next.js + TypeScript + React (frontend), Docker Compose
(`docker compose up`/`down` is the run method — see `project-plan/Architecture.md`).## Hard rules (non-negotiable)

1. **Never run git commands that change repo state or history** — no `commit`, `branch`,
   `checkout -b`, `push`, `merge`, `rebase`, `tag`, `add` for the purpose of committing, etc. Read-only git (`status`,
   `diff`, `log`, `show`) is fine and encouraged for context. All commits and branches are done by Aaron by hand after
   reviewing the iteration summary. If a commit point feels reached, say so and stop — don't act on it.
2. **Every iteration ends with a grouped change summary** before handing back control — see
   "Iteration summaries" below. Use the `/iteration-summary` skill for this rather than freehand.
3. **Judgment calls with clinical-data-safety implications get flagged explicitly**, under a
   "Decisions this iteration" heading, separate from the file-change table — not buried in a diff. Examples of the kind
   of call this covers: duplicate-patient handling, `entered-in-error`/ inactive resource treatment, unconfirmed
   verification status, dangling references, coding
   `display` gaps, date-precision handling.
4. **No guessing/backfilling of clinical data.** Missing `coding.display`, dangling references, and partial dates are
   shown as-is/labeled-unresolved — never inferred into something more complete or more certain than the source data
   actually is.

## Where things live

| Path                                                                 | Purpose                                                                                                                                                                                          |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `project-plan/ProjectPlan.md`, `TestPlan.md`, `HLD.md`, `LLD.md`     | Populated progressively as we build — include Mermaid diagrams where they clarify flow/architecture. Not written in one pass; add to them per phase.                                             |
| `project-plan/Assumptions.md`                                        | Canonical decision log — read before making a data-handling or scope judgment call; add to it, don't duplicate it elsewhere. Anything undecided is marked **open**, not silently resolved.       |
| `project-plan/ResearchNotes.md`, `implementation-logs/Knowledge.md`  | Domain research and the FHIR spec-vs-bundle data-quality catalog. Treat `Knowledge.md`'s catalog as canonical/most detailed; `ProjectPlan.md`'s Phase 0 section is a summary pointer to it.      |
| `project-plan/implementation-phases/00/Phase-00.md`                  | Research phase doc.                                                                                                                                                                              |
| `project-plan/implementation-phases/01/Phase-01.md`                  | Scaffolding phase doc.                                                                                                                                                                           |
| `project-plan/implementation-phases/02/Phase-02.md`                  | Implementation & iteration phase doc.                                                                                                                                                            |
| `project-plan/implementation-phases/02/iterations/Iteration-<NN>.md` | One file per iteration within Phase 02, zero-padded (`Iteration-01.md`, `Iteration-02.md`, …). Body follows the `GroundRules.md` sample format (grouped file table + Decisions this iteration).  |
| `AI_USAGE.md`                                                        | AI usage log tables — keep updated AI_USAGE.md per phase/iteration alongside the summary, will determine the content for AI_USAGE.md at the end of implementation cycles just before submitting. |
| `inputdata/`, `outputdata/`                                          | Sample bundle in, generated/normalized output out. Bundle is loaded once, statically — not a general upload/ingest pipeline for MVP.                                                             |

## Key standing decisions (see `Assumptions.md` for full rationale)

- `patient-001` is canonical (US Core profile, SSN identifier, full-precision `birthDate`, race/ethnicity extensions);
  `patient-002` is an **unresolved probable duplicate** — the bundle has no FHIR `link` element between them, so this is
  inference, not resolution of a declared link.
- `entered-in-error` / inactive / resolved-status resources are never shown as current clinical fact — excluded to a
  separate bucket, never silently dropped from the response.
- `medicationrequest-003` (linked to `patient-002`) disposition is still **open** — don't resolve it unilaterally; flag
  it if touched.
- No database, no auth, no multi-patient support, no repo-analysis tooling for MVP scope.
- Module naming: broader normalization work is `clinical_normalization`/`patient_normalization`; the
  duplicate-Patient-merge logic specifically is `patient_reconciliation`.

## Iteration summaries

Use the `iteration-summary` skill at the end of any iteration that changed files. It:

- Reads the current git diff/status (read-only) and groups changes by root folder (`backend/`, `frontend/`,
  `repo-root/`) then by directory within it, per `GroundRules.md`.
- Prompts for a one-line "what and why" per file if it can't be inf
- Writes/appends the result as the next `Iteration-<NN>.md` under
  `project-plan/implementation-phases/02/iterations/`, including a "Decisions this iteration"
  section and a suggested (not executed) commit message.
