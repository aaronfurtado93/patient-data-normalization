# Iteration 02: Download/Load Sample File + Run Validation enablement

Built on top of Aaron's scaffolding of the button layout in
`frontend/app/patient-record-processing/page.tsx`. Scope per Aaron's instruction: only Download
Sample File, Load Sample File, and Run Validation-becomes-available are implemented this
iteration; Upload Custom File / Edit Mode / Download Output stay disabled (HIL-mode stretch goals).

**Backend (`backend/`)**

`backend/app/`

| File | Change | Description |
|---|---|---|
| `main.py` | modified | Added `GET /sample-bundle` — reads `inputdata/scenario1_fhir_bundle[78].json` (via the new read-only Compose mount) and returns it verbatim as JSON. Single endpoint backs both Download and Load on the frontend, no duplicated bundle copy. 404s cleanly if the file isn't where expected. |

**Frontend (`frontend/`)**

`frontend/app/patient-record-processing/`

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | Wired Download Sample File (fetch → Blob → client-side save via temporary `<a download>`) and Load Sample File (fetch → kept in `loadedBundle` state, shows resource count). Run Validation's `disabled` prop now tracks `!loadedBundle`; click handler is a placeholder message only — no validation logic yet, out of scope this iteration. Upload Custom File / Edit Mode / Download Output given a distinct disabled style, Validation Mode toggle added as an inert `<select disabled>` (Default / HIL (Coming Soon)). |

**repo-root/**

| File | Change | Description |
|---|---|---|
| `docker-compose.yml` | modified | Added a read-only `./inputdata:/app/inputdata:ro` mount on the backend, so `/sample-bundle` has something to read. Also added `WATCHFILES_FORCE_POLLING=true` on the backend — found the same host-kernel `inotify`/`EMFILE` issue Iteration 01 fixed for the frontend was also silently breaking `uvicorn --reload`'s watcher; fixed the same way (polling). |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `HLD.md` | modified | Added a Phase 02 Iteration 01/02 recap section and the `/sample-bundle` flow to the system-context diagram. Per Aaron's new standing instruction: HLD/LLD/TestPlan now updated incrementally each iteration going forward, not deferred. |
| `LLD.md` | added (was empty) | First real content — `/sample-bundle` contract (request/response/404/file-resolution assumption) and the Patient Record Processing page's state model. |
| `TestPlan.md` | added (was empty) | First real content — testing strategy (manual/scripted verification against the real running stack for now, automated tests once real normalization logic exists) and a per-iteration coverage log. |

**Decisions this iteration**

- **`Run Validation`'s click handler is a placeholder, not real validation logic.** Read Aaron's
  scope instruction ("Run Validation button becomes available once a file is loaded") as
  UI-state-wiring only, not "implement validation this iteration" — flagging this reading
  explicitly since it's a scope interpretation, not a data-safety call, in case that's not what
  was intended.
- No clinical-data-safety decisions — `/sample-bundle` returns the bundle completely unprocessed
  (no parsing into models, no filtering, no reconciliation); none of the Phase 00 data-handling
  rules are engaged yet since no normalization logic exists yet.

**Verification performed**

- `GET /sample-bundle` → 200, `resourceType: "Bundle"`, `entry` count = 17 (matches the known
  bundle) — confirms the volume mount and file-path resolution work inside the container.
- Frontend page renders all six buttons with their specified labels (`curl` + `grep`).
- Both frontend and backend live-reload re-verified end-to-end after adding the new backend env
  var (edited `main.py` and `page.tsx` on the host with the stack running, no rebuild, confirmed
  each change reached the running server within seconds); test markers reverted afterward.
- Interactive state (button enable/disable transitions, click handlers) is **not** covered by
  `curl` — relies on Aaron's manual browser testing per the established workflow for this
  iteration.

**Suggested commit message** (for Aaron to use, not run by the agent):
`feat: wire download/load sample file and run-validation enablement on patient record processing page`

---

## Major feedback: backend package structure (pre-proceed blocker)

**Feedback:** "Please follow organized packages folder structure to maintain different routes in
different files. Also add a proper AppError and global Exception handler package to handle
standard status code exceptions... Properly register error handlers via proper core package.
Added a few directories to populate the same correctly. refer core, routers"

**Backend (`backend/app/`)**

`backend/app/core/` (new)

| File | Change | Description |
|---|---|---|
| `__init__.py` | added | Re-exports the `AppError` hierarchy + `register_exception_handlers` for convenient importing. |
| `errors.py` | added | `AppError` base + `BadRequestError` (400) / `NotFoundError` (404) / `ServiceUnavailableError` (503) subclasses. Route code raises these instead of `HTTPException` directly. |
| `exception_handlers.py` | added | `register_exception_handlers(app)` — one place, called once from `main.py`. Handles `AppError`, `starlette.exceptions.HTTPException` (the **base** class — see gotcha below), `RequestValidationError`, and a catch-all `Exception`. Every error response comes back as `{"error": {"code": ..., "message": ...}}`; unexpected exceptions are logged server-side, never leaked in the response body. |

`backend/app/routers/` (new)

| File | Change | Description |
|---|---|---|
| `__init__.py` | added | `api_router` — aggregates every domain router; `main.py` includes only this. |
| `health.py` | added | `GET /health`, moved out of `main.py`. |
| `sample_bundle.py` | added | `GET /sample-bundle`, moved out of `main.py`; 404 case now raises `NotFoundError` instead of `HTTPException`. |

`backend/app/`

| File | Change | Description |
|---|---|---|
| `main.py` | modified | Reduced to pure wiring: create app, add CORS middleware, `register_exception_handlers(app)`, `app.include_router(api_router)`. No route or error-handling logic left in this file. |

**Bug found and fixed during verification:** the `HTTPException` handler was initially registered
on `fastapi.HTTPException`. Testing an unknown route (`GET /does-not-exist`) showed it still came
back as FastAPI's *default* `{"detail":"Not Found"}`, not our envelope — FastAPI's routing layer
raises Starlette's **base** `HTTPException` directly for cases like an unmatched route, and
`fastapi.HTTPException` is a subclass, so a handler registered only for the subclass never
matches. Fixed by importing `starlette.exceptions.HTTPException` and registering on that instead
(FastAPI's documented way to override these defaults). Re-verified after the fix — see below.

**Decisions this iteration**

- No clinical-data-safety decisions — this is a pure code-organization/error-handling
  infrastructure change; `/sample-bundle`'s behavior is unchanged except that its 404 now goes
  through `NotFoundError` instead of a raw `HTTPException`, same status code and message.

**Verification performed**

- `GET /health` → 200, `GET /sample-bundle` → 200 with 17 entries — both endpoints work identically
  post-restructure.
- `GET /does-not-exist` (unmatched route) → confirmed **before** the fix it returned FastAPI's
  default envelope (bug); **after** the fix it returns `{"error":{"code":"HTTPException","message":"Not
  Found"}}`.
- `AppError` path specifically verified over real HTTP: added a temporary route raising
  `NotFoundError("test message from AppError")`, confirmed it returned
  `{"error":{"code":"NotFoundError","message":"test message from AppError"}}` with status 404, then
  removed the temporary route and re-confirmed it was gone (404 via the `HTTPException` path) and
  the real endpoints were unaffected.
- Backend live-reload (from the previous feedback round's fix) continued to work throughout —
  every edit above was picked up by the running container without a manual rebuild.

**Suggested commit message:**
`refactor(backend): organize routes into app/routers, add AppError hierarchy and centralized exception handling in app/core`
