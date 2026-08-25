# High-Level Design — Centauri Clinical Snapshot

Draft for review (Phase 01). Architecture-level only — exact response field names, Pydantic model
shapes, and module-internal function signatures are `LLD.md`'s job, once this is confirmed. See
`project-plan/Assumptions.md` for the decisions this design encodes, and
`project-plan/ResearchNotes.md` / `implementation-logs/Knowledge.md` for the data-quality findings
driving the normalization requirements below.

## 1. Scope recap

- **MVP (auto-mode):** static bundle in → normalization/reconciliation pass → evaluation report out
  → frontend renders per-patient completeness.
- **Stretch (HIL/manual-mode):** user-uploaded bundle, same pipeline, plus in-browser editing and
  JSON download. Not designed in detail yet — the pipeline below is built so the stretch mode reuses
  it rather than forking it (upload replaces "load static file," everything downstream is the same).
- No database, no auth, no multi-patient support, single stateless request/response pass per
  `Assumptions.md`.

## 2. System context

```mermaid
flowchart LR
    User(["Clinician / Reviewer<br/>(browser)"])
    FE["Frontend<br/>Next.js + TypeScript + React"]
    BE["Backend<br/>FastAPI + Pydantic v2 + uvicorn"]
    Bundle[("inputdata/<br/>scenario1_fhir_bundle[78].json")]

    User -->|loads page| FE
    FE -->|"GET /patient-summary"| BE
    BE -->|reads once at startup| Bundle
    BE -->|JSON evaluation report| FE
    FE -->|renders snapshot| User
```

Both services run under Docker Compose (`docker compose up`/`down`), no other infrastructure. The
backend reads the bundle file from disk once at process startup, not per-request — see
`Assumptions.md` → Scope ("loaded once, statically").

## 3. Backend components

```mermaid
flowchart TB
    subgraph API["app/api/"]
        Endpoint["patient_summary.py<br/>GET /patient-summary"]
        Health["health.py<br/>GET /health"]
    end

    subgraph Norm["app/clinical_normalization/"]
        Loader["bundle_loader.py<br/>reads + parses the static bundle"]
        Recon["patient_reconciliation/<br/>canonical-patient selection,<br/>unresolved-duplicate flagging"]
        StatusFilter["status_filters.py<br/>entered-in-error / inactive / resolved<br/>→ excluded bucket, never dropped"]
        RefResolver["reference_resolver.py<br/>resolves in-bundle refs,<br/>labels dangling refs unresolved"]
        Assembler["snapshot_assembler.py<br/>groups current-fact resources into<br/>the response sections"]
    end

    subgraph Models["app/models/"]
        FhirModels["fhir.py — Pydantic v2 models for<br/>Patient/Condition/Observation/<br/>MedicationRequest/AllergyIntolerance<br/>(only fields the snapshot uses)"]
        ViewModels["snapshot.py — response-shape models<br/>(ReconciledPatient, section groups,<br/>ExcludedItem, UnresolvedFlag)"]
    end

    Endpoint --> Loader
    Loader --> FhirModels
    Loader --> Recon
    Recon --> StatusFilter
    StatusFilter --> RefResolver
    RefResolver --> Assembler
    Assembler --> ViewModels
    Assembler --> Endpoint
```

**Module naming** (per `Assumptions.md` → Process): the package is `clinical_normalization`, matching
the brief's own phrase ("normalization pass that produces a clean, deduplicated, safe-to-display
representation"); the duplicate-`Patient`-merge logic specifically lives in the narrower
`patient_reconciliation` submodule inside it.

**Pipeline order matters:** reconciliation (which patient is canonical) happens before status
filtering, so that a resource's exclusion reason and its patient-linkage flag can both be attached
independently — e.g. `medicationrequest-003` needs the "linked to unresolved duplicate" flag from
reconciliation *and* passes through status filtering as `active`, ending up in the medications
section with a flag rather than in the excluded bucket (per `Assumptions.md`).

## 4. Frontend components

```mermaid
flowchart TB
    Page["app/page.tsx<br/>fetches GET /patient-summary, renders sections"]
    Demo["components/snapshot/Demographics.tsx"]
    Problems["components/snapshot/ProblemList.tsx"]
    Meds["components/snapshot/MedicationList.tsx<br/>(active + past buckets)"]
    Allergies["components/snapshot/AllergyList.tsx"]
    Encounters["components/snapshot/EncounterList.tsx"]
    Observations["components/snapshot/ObservationList.tsx"]
    Excluded["components/snapshot/ExcludedItems.tsx<br/>collapsible, per Assumptions.md"]
    Flag["components/snapshot/UnresolvedFlag.tsx<br/>shared badge: duplicate-patient /<br/>unconfirmed / dangling-ref / code-mismatch"]

    Page --> Demo
    Page --> Problems
    Page --> Meds
    Page --> Allergies
    Page --> Encounters
    Page --> Observations
    Page --> Excluded
    Problems -.uses.-> Flag
    Meds -.uses.-> Flag
    Allergies -.uses.-> Flag
```

`UnresolvedFlag` is shared across sections rather than reimplemented per-section, since the same
"don't hide it, label it" treatment applies to several distinct cases (duplicate-patient linkage,
unconfirmed verification status, dangling reference, missing `display`, code/system mismatch).

## 5. Request flow (auto-mode)

```mermaid
sequenceDiagram
    participant U as Clinician (browser)
    participant FE as Frontend (Next.js)
    participant BE as Backend (FastAPI)
    participant N as clinical_normalization

    Note over BE,N: bundle loaded once at process startup
    U->>FE: open app
    FE->>BE: GET /patient-summary
    BE->>N: run pipeline (already-parsed bundle in memory)
    N->>N: reconcile patients (canonical vs unresolved duplicate)
    N->>N: filter by status (current-fact vs excluded)
    N->>N: resolve references (in-bundle vs dangling)
    N->>N: assemble response sections
    N-->>BE: ReconciledPatientSummary
    BE-->>FE: 200 JSON
    FE->>FE: render demographics / problems / meds / allergies / encounters / observations / excluded
    FE-->>U: patient snapshot
```

## 6. Response shape (high-level — LLD owns exact field names)

Per `Assumptions.md`, the response is grouped by:

- `patient` — canonical patient demographics, `duplicate_of`/unresolved flag if applicable
- `active_problems`
- `medications` — `active` and `past` (e.g. `status: stopped`) as distinct buckets, not merged
- `allergies`
- `encounters`
- `observations`
- `excluded` — entered-in-error / inactive / resolved / (any other never-current-fact) resources,
  each with type, id, and a human-readable exclusion reason — included in the payload, not just
  summarized as a count (per `Assumptions.md`)

Every item carries enough provenance (status, verification status, resolution notes, flags) for the
frontend to render uncertainty honestly rather than presenting normalized data as more certain than
the source.

## 7. Key architectural decisions (recap — see `Assumptions.md` for full rationale)

| Decision | Why |
|---|---|
| Static, in-memory bundle load at startup, no DB | Single stateless pass over one bundle; a DB is unused scaffolding for this scope. |
| Reconciliation runs before status filtering | A resource can need both a duplicate-linkage flag and a status-based bucket independently (`medicationrequest-003`). |
| Excluded resources returned in-payload, not just counted | Matches "say so rather than hiding it"; lets the frontend render them as inspectable, collapsed items. |
| No guessing/backfilling anywhere in `clinical_normalization` | Hard rule — missing `display`, dangling refs, partial dates are surfaced as-is, never inferred into something more complete. |
| Stretch mode reuses the same pipeline | Upload replaces the static-file read; reconciliation/filtering/assembly stages don't change. |

## 8. Open questions for review

- Exact `/patient-summary` JSON field names/nesting (deferred to `LLD.md`).
- Whether `past medications` and `excluded` are top-level response keys or nested under a single
  `sections`/`meta` wrapper — leaning top-level for frontend simplicity, not yet decided.
- Backend port/frontend port and exact Compose service names — placeholders until `docker-compose.yml`
  is written.
- Error handling shape if the bundle fails to parse at startup (fail fast vs. degrade) — not yet
  addressed, worth a decision before LLD.
