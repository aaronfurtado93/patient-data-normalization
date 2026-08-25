# Overview

**Centauri Clinical Snapshot** reconciles a single messy FHIR R4 patient bundle into a
clinician-scannable snapshot: a normalized, discrepancy-annotated, safe-to-display view of each
patient's demographics, problems, medications, allergies, encounters, and observations.

The source bundle (`inputdata/scenario1_fhir_bundle[78].json`) is real-world-messy on purpose — two
`Patient` resources for the same person with no FHIR `link` between them, resources marked
`entered-in-error`/`inactive`/`resolved`, dangling references, missing coding `display` values, and
mixed date precision. The app's job is to surface that messiness honestly rather than paper over
it: nothing is guessed, backfilled, or silently dropped, and nothing is merged without an explicit
human decision. See the [Decision Log](#decision-log--table-of-contents) below for the full
rationale behind each of those calls.

Domain framing is patient-summary/reconciliation (USCDI/IPS-shaped) — not a PAS/prior-authorization
workflow. No procedure codes, no admission/discharge/service-date logic.

**Stack:** FastAPI + Pydantic v2 + uvicorn (backend), Next.js + TypeScript + React (frontend),
Docker Compose.

# Setup and Run Instructions

**Prerequisites:** Docker and Docker Compose. No other local tooling (Python/Node versions, etc.)
is required to run the app —
handled entirely through Compose, by design (see [`Assumptions.md` → Process](project-plan/Assumptions.md#process)).

```bash
# from the repo root
docker compose up
```

This starts both services:

- **Backend** — FastAPI/uvicorn at **http://localhost:8010** (`/health`, interactive docs at `/docs`).
- **Frontend** — Next.js app at **http://localhost:3000**.

> Backend is mapped to host port `8010`, not `8000` — `8000` is commonly taken by other local dev
> servers, so this avoids a default collision. Container-internal port is still `8000`.

![Backend running — FastAPI interactive docs at /docs, showing /health, /sample-bundle, /validate, /reconcile](media/backend-up.png)

```bash
docker compose down
```

Stops and removes the containers. No database/volumes to worry about — the app is stateless, single
bundle per validation pass, no persistence between requests.

# Features

All of this lives under a single page, **Patient Record Processing** (`/patient-record-processing`),
reached from the Dashboard. A **User Guide** page (`/user-guide`) is available in-app with
step-by-step usage instructions for everything below.

![Dashboard — Patient Record Processing and User Guide widgets](media/front-end-landing-page.png)

### Loading a bundle

- **Download Sample File** — saves the built-in sample bundle to disk for local inspection.
- **Load Sample File** — loads the built-in sample bundle directly into the page.
- **Upload Custom File** — loads your own FHIR-conformant JSON bundle from disk; parsed
  client-side, no backend round trip to "load" it.
- Loading any new file clears all previous results and re-enables Validation Mode.

### Validation Mode

- **Default (auto-mode, MVP)** — read-only evaluation. Every distinct `Patient` resource always
  gets its own card; possible duplicate patients are flagged, never automatically combined —
  merging is a decision only a human reviewer makes.
- **HIL (Human-in-Loop, manual-mode, stretch)** — adds the ability to manually merge
  possible-duplicate patients and to export a cleaned output bundle.
- The mode selector locks as soon as **Run Validation** produces a report (with a visible inline
  hint plus a tooltip explaining why); loading a new file unlocks it again.

![HIL mode — merge icon with tooltip on a possible-duplicate card, Download Output enabled](media/front-end-hil-mode.png)

### Run Validation

Sends the loaded bundle to the backend, which checks structural validity (Pydantic v2 models) and
returns one patient card per distinct `Patient` resource found. Each card shows:

- A completeness percentage for that patient's clinical data.
- Collapsible sections (Encounters, Conditions, Active/Past Medications, Allergies, Observations,
  Excluded) — any section containing discrepancies shows a ⚠ warning and count next to its title,
  even while collapsed, so nothing needing attention is hidden behind a fold.
- Every discrepancy kind from the project's research catalog: `entered-in-error`/inactive/resolved
  status routed to a dedicated Excluded bucket (never shown as current fact, never silently
  dropped), FHIR invariant violations, missing coding `display` text, dangling references,
  SNOMED/LOINC code-shape mismatches, unconfirmed verification status, and possible-duplicate-
  patient flags — all shown as-is/labeled, never guessed into something more complete or certain
  than the source data.

![Default mode — three patient cards, completeness percentages, a possible-duplicate flag, and per-section discrepancy warnings](media/front-end-default-mode.png)

### Merge possible duplicates (HIL mode)

A merge icon appears on any card the backend flagged as a possible match (name + birth date). It
opens a 3-pane compare view:

- **Patient A** (left) / **Patient B** (right) — raw data side by side.
- **Merged Preview** (center) — live union, built from per-field demographic choices (name, birth
  date, identifiers — pick A or B) and per-item checkboxes on each side's clinical resources.
- **Reconcile and Apply Merge** — builds the actual merged FHIR bundle from your selections and
  re-runs the full backend validation pipeline against it, so every card on the page (not just the
  merged one) reflects the new completeness/discrepancies.

![3-pane Compare & Merge view — Patient A, live Merged Preview, Patient B](media/front-end-hil-merge.png)

### Download Output (HIL mode)

Exports the current working bundle (post-merge if applied, otherwise as loaded/validated) as a
clean FHIR R4 JSON file, filename `fhir-r4-patient-record-<yyyy>-<mm>-<dd>-<hh>-<mm>-<ss>.json`.
Two options, both off by default so the default export is the cleanest cut:

- **Include items with discrepancies**
- **Include entries marked as Excluded**

Patients themselves are always included.

# Decision Log — Table of Contents

Everything below is a genuine, reasoned decision, not an unstated default. Rather than restate all
of it here, this links straight to where each was made and why:

- **[`project-plan/Assumptions.md`](project-plan/Assumptions.md)** — the canonical decision log; read this first.
  - [Data handling](project-plan/Assumptions.md#data-handling) — what counts as current clinical fact vs. excluded/flagged (entered-in-error/inactive/resolved handling, the two-Patient duplicate stance, dangling references, missing `coding.display`, date precision, verification status).
  - [Scope](project-plan/Assumptions.md#scope) — what's explicitly in vs. out of this build.
  - [Process](project-plan/Assumptions.md#process) — how the app is meant to be run/evaluated.
  - [Still open](project-plan/Assumptions.md#still-open) — decisions deliberately left unresolved rather than guessed at, with the reasoning for why each is still open.
- **[`project-plan/ProjectPlan.md`](project-plan/ProjectPlan.md)** — the original brief-to-goals translation: what's Must Have (MVP/auto-mode) vs. Good to Have (HIL/manual-mode stretch).
- **[`project-plan/ResearchNotes.md`](project-plan/ResearchNotes.md)** — the FHIR-spec-vs-actual-bundle research this build's discrepancy detection is grounded in ([domain framing](project-plan/ResearchNotes.md#domain-framing), per-resource-type gap analysis).
- **[`project-plan/Architecture.md`](project-plan/Architecture.md)** — tooling/package/build-system choices and why.
- **[`project-plan/HLD.md`](project-plan/HLD.md)** — high-level design, updated per phase/iteration as the system grew.
- **[`project-plan/LLD.md`](project-plan/LLD.md)** — low-level design: backend package structure, API contracts, frontend component/state design, written incrementally alongside the real implementation rather than speculatively upfront.
- **[`project-plan/TestPlan.md`](project-plan/TestPlan.md)** — test strategy, the full manual verification record per iteration, and what's still open on the automated-coverage side.
- **[`project-plan/GroundRules.md`](project-plan/GroundRules.md)** — the working agreement this project was built under (no direct git operations by the AI agent, every iteration ends with a change summary, data-safety judgment calls get flagged inline rather than buried in a diff).
