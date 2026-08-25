# Phase 01 — Scaffolding

Sets up the runnable skeleton (repo docs, architecture design, Docker Compose, backend/frontend
project shells) that Phase 02's implementation iterations build on top of. No clinical-normalization
logic is written in this phase — that starts in Phase 02, informed by the HLD/LLD produced here.

## Goals

- [x] `README.md` — Project Overview and Setup/Run Instructions sections populated.
- [x] `HLD.md` — kept intentionally light per feedback: system context + Phase 01 scope only, no
      component/module/response-shape design (that's real Phase 02 work, done against actual code).
- [x] `docker-compose.yml` + backend/frontend Dockerfiles — runnable skeleton, verified end-to-end
      (`docker compose up`, backend `/health` returns 200, frontend page loads and reaches backend).
      Backend host port is `8010` (not `8000`) — avoids a local dev-server collision on this
      machine; container-internal port is still `8000`.
- [x] Backend project shell — FastAPI app, `/health` endpoint only, no normalization logic.
- [x] Frontend project shell — Next.js (app router, TS), one placeholder page that fetches
      `/health` on load to prove connectivity.
- [ ] `LLD.md` — deferred to Phase 02, designed against real normalization code rather than
      speculatively (this itself was a course-correction from the original sequencing below).
- [ ] `TestPlan.md` — testing strategy stub (still open from Phase 00, not yet started).

## Sequencing (revised)

Original plan below sequenced HLD → review → LLD → scaffolding. Feedback after the first HLD draft
(too dense, don't overengineer FE/BE yet) changed this: HLD got trimmed instead of extended, and the
runnable skeleton was built directly rather than waiting on LLD, since LLD has nothing real to
design against until Phase 02's normalization pipeline exists. Kept here for the record rather than
rewritten silently.

1. ~~Docs first (README, HLD)~~ — done, HLD later trimmed per feedback.
2. ~~HLD review/feedback before LLD or scaffolding code~~ — superseded: scaffolding built directly,
   LLD pushed to Phase 02.
3. ~~LLD once HLD confirmed~~ — deferred to Phase 02.
4. Docker Compose + backend/frontend skeletons — done this iteration, verified runnable.

## Notes

- Per `CLAUDE.md`/`GroundRules.md`: every response that modifies files in this phase gets a printed
  grouped change summary (not deferred to an `Iteration-<NN>.md` file — that numbering is Phase 02
  only, per Aaron's confirmation at Phase 00 kickoff).
