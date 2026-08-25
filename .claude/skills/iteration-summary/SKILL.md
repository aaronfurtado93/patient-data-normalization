---
name: iteration-summary
description: Produce the end-of-iteration change summary required by project-plan/GroundRules.md for this repo (patient-data-normalization / Centauri Clinical Snapshot), and file it as the next Iteration-<NN>.md under project-plan/implementation-phases/02/iterations/. Use this whenever a coherent unit of work (one prompt/response cycle that produced file changes) is finishing and control is about to hand back for a manual commit.
---

# Iteration Summary

Generates the grouped change summary `GroundRules.md` requires at the end of every iteration in
this repo, and writes it to the correct `Iteration-<NN>.md` file. This does **not** commit,
branch, or otherwise change repo state — read-only git only, per Rule 1 in `GroundRules.md`.

## Steps

1. **Inspect changes, read-only.** Run `git status` and `git diff` (plus `git diff --staged` if
   anything is staged) against the working tree. Do not run `git add`, `git commit`, or anything
   that mutates state.

2. **Group by root folder, then directory.** Root folders are `backend/`, `frontend/`; use
   `repo-root/` for top-level files (`README.md`, `docker-compose.yml`, `CLAUDE.md`, etc.) and
   `project-plan/` for planning-doc-only changes. Within each root, group by directory. Omit a root
   folder heading entirely if nothing changed there (mark it "no changes this iteration" per the
   sample in `GroundRules.md`, don't just drop it silently if it's one of backend/frontend).

3. **Build the file table per directory group**, columns: `File | Change | Description`.
   - Change is one of `added` / `modified` / `deleted`.
   - Description is one line: what changed and why (not just what — the *why* is the point).
   - If the "why" isn't obvious from the diff alone, ask before guessing rather than inventing a
     rationale — this summary is the audit trail, it needs to be accurate.

4. **Call out data-safety judgment calls separately**, under a `**Decisions this iteration**`
   heading, per Rule 3 of `GroundRules.md`. This covers anything touching: duplicate-patient
   handling, `entered-in-error`/inactive/resolved status treatment, unconfirmed verification
   status, dangling references, missing `coding.display`, date-precision handling, or any other
   call that affects what's shown as clinical fact vs. flagged/excluded. Cross-check against
   `project-plan/Assumptions.md` — if a decision contradicts or narrows something already recorded
   there, say so explicitly and note that `Assumptions.md` may need updating (don't edit it
   silently as a side effect of this skill).

5. **Add a suggested commit message** (for Aaron to use by hand — never run it): one line,
   conventional `area: summary` style, matching the scope of the iteration.

6. **Determine the iteration number.** List existing files in
   `project-plan/implementation-phases/02/iterations/` and use the next zero-padded number
   (`Iteration-01.md`, `Iteration-02.md`, …). If the directory is empty, this is `Iteration-01.md`.

7. **Write the file** to
   `project-plan/implementation-phases/02/iterations/Iteration-<NN>.md` using the template below.
   Also print the summary in the response so it's visible immediately, not just on disk.

8. **Stop there.** Do not stage, commit, or suggest running the suggested commit message yourself.
   Hand control back to Aaron.

## Template

```markdown
# Iteration <NN>: <short title>

**Backend (`backend/`)**

`backend/<dir>/`

| File | Change | Description |
|---|---|---|
| `<file>` | added/modified/deleted | <what and why> |

**Frontend (`frontend/`)** — no changes this iteration

**repo-root/** — no changes this iteration

**Decisions this iteration**

- <data-safety judgment call, with rationale, or omit this section entirely if none this iteration>

**Suggested commit message** (for Aaron to use, not run by the agent):
`<area>: <summary>`
```

## Notes

- If this iteration is pure planning-doc work (e.g. filling in `HLD.md`, `Assumptions.md`), still
  produce a summary — use `project-plan/` as the grouping root instead of `backend/`/`frontend/`.
- Keep this aligned with `AI_USAGE.md` and `project-plan/implementation-logs/AI_USAGE.detail-log.md`
  — after writing the iteration file, remind the user (don't edit automatically) that those usage
  log tables should get a row for this phase/iteration.
