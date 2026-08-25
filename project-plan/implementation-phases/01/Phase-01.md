# Phase 01 — Scaffolding

Sets up the runnable skeleton (repo docs, architecture design, Docker Compose, backend/frontend
project shells) that Phase 02's implementation iterations build on top of. No clinical-normalization
logic is written in this phase — that starts in Phase 02, informed by the HLD/LLD produced here.

## Goals

- [x] `README.md` — Project Overview and Setup/Run Instructions sections populated.
- [ ] `HLD.md` — high-level architecture (system context, component breakdown, data flow for
      auto-mode), with Mermaid diagrams. **Drafted this iteration — pending Aaron's review.**
- [ ] `LLD.md` — low-level design (module layout, `/patient-summary` response schema, Pydantic model
      shapes) — deferred until HLD is confirmed, since LLD depends on HLD decisions holding.
- [ ] `docker-compose.yml` + backend/frontend Dockerfiles — runnable skeleton per
      `project-plan/Architecture.md` (FastAPI/uvicorn + Next.js/TS/React).
- [ ] Backend project shell — FastAPI app structure (no normalization logic yet), health-check
      endpoint to confirm the container runs.
- [ ] Frontend project shell — Next.js app structure, stub page, confirms it can reach the backend.
- [ ] `TestPlan.md` — testing strategy stub (still open from Phase 00, not yet started).

## Sequencing

1. Docs first (README, HLD) — this iteration.
2. HLD review/feedback from Aaron before LLD or actual scaffolding code, since LLD and the
   Compose/service shells depend on HLD decisions (response shape direction, module boundaries).
3. LLD once HLD is confirmed.
4. Docker Compose + backend/frontend skeletons, informed by LLD.

## Notes

- Per `CLAUDE.md`/`GroundRules.md`: every response that modifies files in this phase gets a printed
  grouped change summary (not deferred to an `Iteration-<NN>.md` file — that numbering is Phase 02
  only, per Aaron's confirmation at Phase 00 kickoff).
