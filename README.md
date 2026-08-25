# Overview

**Centauri Clinical Snapshot** reconciles a single messy FHIR R4 patient bundle into a
clinician-scannable snapshot: a normalized, deduplicated, safe-to-display view of one patient's
demographics, problems, medications, allergies, encounters, and observations.

The source bundle (`inputdata/scenario1_fhir_bundle[78].json`) is real-world-messy on purpose — two
`Patient` resources for the same person with no FHIR `link` between them, resources marked
`entered-in-error`/`inactive`/`resolved`, dangling references, missing coding `display` values, and
mixed date precision. The app's job is to surface that messiness honestly rather than paper over it:
nothing is guessed, backfilled, or silently dropped. See `project-plan/Assumptions.md` for the full
decision log and rationale, and `project-plan/ResearchNotes.md` /
`project-plan/implementation-logs/Knowledge.md` for the underlying FHIR spec-vs-bundle research.

**Scope for this build:**

- **MVP (auto-mode):** the backend loads the bundle once, statically, runs it through a
  normalization/reconciliation pass, and returns an evaluation report; the frontend renders each
  patient record's completeness from that report.
- **Stretch (HIL/manual-mode):** upload a custom FHIR-conformant bundle, get the same evaluation,
  expand sections to correct/complete data by hand, and download the auto-generated or edited JSON.

Domain framing is patient-summary/reconciliation (USCDI/IPS-shaped) — not a PAS/prior-authorization
workflow. No procedure codes, no admission/discharge/service-date logic.

**Stack:** FastAPI + Pydantic v2 + uvicorn (backend), Next.js + TypeScript + React (frontend),
Docker Compose (see `project-plan/Architecture.md` and `project-plan/HLD.md`).

# Setup and Run Instructions

> Phase 01 scaffolding: both services are a minimal runnable skeleton right now — a health-check
> backend and a placeholder frontend page that confirms it can reach the backend. No normalization
> pipeline or snapshot UI yet; that's Phase 02.

**Prerequisites:** Docker and Docker Compose. No other local tooling (Python/Node versions, etc.)
is required to run the app — the brief's "if we cannot run it, we cannot evaluate it" constraint is
handled entirely through Compose, by design (see `project-plan/Assumptions.md` → Process).

```bash
# from the repo root
docker compose up
```

This starts both services:

- **Backend** — FastAPI/uvicorn at **http://localhost:8010** (`/health`).
- **Frontend** — Next.js app at **http://localhost:3000**.

> Backend is mapped to host port `8010`, not `8000` — `8000` is commonly taken by other local dev
> servers, so this avoids a default collision. Container-internal port is still `8000`.

```bash
docker compose down
```

Stops and removes the containers. No database/volumes to worry about — the app is stateless, single
bundle, single pass.

# Features

* Patient Record Processing
  * Default (auto-mode)
    * loads the sample JSON
    * FE sends for processing
    * BE sends back evaluation report
    * FE to organize display each patient record and its completeness based on evaluation report 

