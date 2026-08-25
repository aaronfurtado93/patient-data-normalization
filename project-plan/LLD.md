# Low-Level Design — Centauri Clinical Snapshot

Written incrementally per Phase 02 iteration, against real code — not drafted ahead of it. Only
covers what's actually implemented; each iteration adds its section rather than speculating about
future ones.

## Backend

### `GET /health`

Returns `{"status": "ok"}`. No parameters, no auth. Liveness/connectivity check only.

### `GET /sample-bundle` (Iteration 02)

Returns the static sample bundle file verbatim as JSON — no parsing into Pydantic models, no
normalization, no filtering. Single source of truth for both the frontend's "Download Sample File"
and "Load Sample File" actions (see Frontend section below), rather than duplicating the bundle
into the frontend build.

- **Method/path:** `GET /sample-bundle`
- **Response 200:** the full contents of `inputdata/scenario1_fhir_bundle[78].json`, `Content-Type:
  application/json`.
- **Response 404:** `{"detail": "Sample bundle not found on the server."}` if the file isn't where
  expected (e.g. the Compose volume mount is missing).
- **File resolution:** `Path(__file__).resolve().parent.parent / "inputdata" /
  "scenario1_fhir_bundle[78].json"` — i.e. `backend/app/main.py` → `parent.parent` is the
  container's `/app` WORKDIR, where `docker-compose.yml` bind-mounts the repo's `inputdata/`
  read-only. **Only valid when run via Docker Compose** (per `Assumptions.md`'s "Compose is the run
  method" decision) — there's no fallback path for running `uvicorn` directly outside a container.

## Frontend

### Layout (Iteration 01)

- `AppShell` (client component, holds sidebar open/closed state) → composes `Header` + `Sidebar` +
  `<main>`. Mounted once in `app/layout.tsx`, wraps every page.
- `Header` — hamburger button (plain CSS bars, no icon library) + app title, title is a `Link` to
  `/` (home button, added per Iteration 01 feedback).
- `Sidebar` — overlay drawer (`fixed`, backdrop click-to-close), menu items are a plain array
  (`MENU_ITEMS`) — currently one entry, trivial to extend.
- `Breadcrumb` — reusable, takes `{ label, href? }[]`; last item (no `href`) renders as
  non-clickable current-page text. Used on Patient Record Processing.

### Pages

- **`/` (Dashboard)** — heading + one `ProcessingWidget` card linking to
  `/patient-record-processing`.
- **`/patient-record-processing`** (Iteration 02) — client component, local state only (no global
  state manager; not warranted at this scale):
  - `downloadState`, `loadState`: `"idle" | "loading" | "error"`.
  - `loadedBundle: Record<string, unknown> | null` — raw bundle JSON once "Load Sample File"
    succeeds; drives `Run Validation`'s `disabled` prop (`!loadedBundle`).
  - `statusMessage: string | null` — single status line under the buttons; used for load
    success/failure and the Run Validation placeholder message.
  - `fetchSampleBundle()` — shared `fetch(BACKEND_URL + "/sample-bundle")` helper used by both
    Download and Load, so there's exactly one code path talking to the endpoint.
  - **Download**: fetches the bundle, wraps it in a `Blob`, triggers a client-side save via a
    temporary `<a download>` + `URL.createObjectURL` (revoked after click) — no backend
    `Content-Disposition` handling needed, keeps the endpoint itself content-negotiation-free.
  - **Load**: fetches the bundle into `loadedBundle` state, shows an entry count in
    `statusMessage` if `bundle.entry` is an array (defensive — doesn't assume shape beyond what's
    needed to display a count).
  - **Run Validation**: enabled only once `loadedBundle` is set; click handler currently just sets
    a placeholder `statusMessage` — no validation logic exists yet (explicitly out of scope for
    Iteration 02, see `Iteration-02.md`).
  - **Upload Custom File / Edit Mode / Download Output**: permanently `disabled`, styled distinctly
    (`stretchButtonClass`) from the two active buttons — HIL-mode stretch goals per
    `Assumptions.md`.
  - **Validation Mode toggle**: `<select disabled>`, `Default` / `HIL (Coming Soon)` — present but
    inert, since HIL mode isn't built.

## Not yet designed

- `/patient-summary` (or equivalent) — the actual normalization/reconciliation pipeline and its
  response shape. Still open per `Assumptions.md`; will get its own LLD section once that iteration
  starts.
- What "Run Validation" actually does once implemented for real.
