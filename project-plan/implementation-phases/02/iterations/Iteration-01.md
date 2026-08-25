# Iteration 01: Dashboard + hamburger sidebar + Patient Record Processing page

**Frontend (`frontend/`)**

`frontend/app/`

| File | Change | Description |
|---|---|---|
| `layout.tsx` | modified | Wraps all pages in the new `AppShell` (header + hamburger sidebar), so nav is consistent across every route rather than per-page. |
| `page.tsx` | modified | Replaced the Phase 01 connectivity-check placeholder with the real Dashboard: heading + one `ProcessingWidget` linking to Patient Record Processing. This is the default landing page (`/`), per this iteration's spec. |
| `patient-record-processing/page.tsx` | added | New route (`/patient-record-processing`). Stub content only — heading + note that bundle load/normalization UI is a later iteration — plus kept the backend `/health` connectivity check here (relocated from the old Dashboard placeholder) since this is the page that will eventually talk to the backend. |

`frontend/components/layout/`

| File | Change | Description |
|---|---|---|
| `Header.tsx` | added | Top bar: hamburger button (plain CSS bars, no icon library dependency) + app title. |
| `Sidebar.tsx` | added | Overlay drawer nav, single menu item ("Patient Record Processing" → `/patient-record-processing`), backdrop click-to-close. Menu list is a small array — trivial to extend as more pages land. |
| `AppShell.tsx` | added | Client component holding sidebar open/closed state, composes Header + Sidebar + `<main>`. Imported once into `layout.tsx` rather than per-page. |

`frontend/components/dashboard/`

| File | Change | Description |
|---|---|---|
| `ProcessingWidget.tsx` | added | The one Dashboard widget required this iteration — card linking to Patient Record Processing. |

**Backend (`backend/`)** — no changes this iteration

**project-plan/**

| File | Change | Description |
|---|---|---|
| `implementation-phases/02/Phase-02.md` | added | First iteration of Phase 02 — phase doc didn't exist yet, added scope/iteration-tracking table. |
| `implementation-phases/02/iterations/Iteration-01.md` | added | This file. |

**Decisions this iteration**

- None with clinical-data-safety implications — this iteration is routing/layout/navigation shell only. No bundle data, normalization, or reconciliation logic is touched; the Patient Record Processing page is a stub.

**Verification performed**

- Rebuilt the frontend container (`docker compose up -d --build frontend`) and confirmed via `curl`: `GET /` → 200 with "Dashboard", "Patient Record Processing" widget text, and the link's `href` present; `GET /patient-record-processing` → 200 with expected heading. Container logs show both routes compiling cleanly (no build/type errors).
- **Known caveat, not fixed this iteration:** the frontend container logs repeated `Watchpack Error: EMFILE: too many open files` (file-watcher/inotify limit inside the container). Initial compiles succeed regardless, but hot-reload during manual testing may occasionally miss a change — `docker compose restart frontend` works around it if that happens. Flagged rather than addressed, since it's a container resource-limit issue, not a code defect, and out of scope for "don't overengineer."

**Suggested commit message** (for Aaron to use, not run by the agent):
`frontend: add dashboard, hamburger sidebar nav, and patient-record-processing page`

---

## Manual testing feedback round 1

**Feedback:** "need home button or breadcrumb to navigate back to Dashboard"

**Frontend (`frontend/`)**

`frontend/components/layout/`

| File | Change | Description |
|---|---|---|
| `Header.tsx` | modified | App title now doubles as a home button — wrapped in a `Link` to `/`, clickable from any page. |
| `Breadcrumb.tsx` | added | Small reusable breadcrumb (`Dashboard / <current page>`), last crumb has no link (current page). |

`frontend/app/patient-record-processing/`

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | Added the `Breadcrumb` at the top of the page (`Dashboard → Patient Record Processing`). |

**Decisions this iteration** — none; pure navigation UX fix, no data handling involved.

**Verification performed:** rebuilt the frontend container; confirmed via `curl` that both the
header's home link (`href="/"`) and the breadcrumb's "Dashboard" link render on
`/patient-record-processing`.

**Suggested commit message:**
`frontend: add home link and breadcrumb navigation back to dashboard`

---

## Manual testing feedback round 2

**Feedback:** "looks like live reload is not working the way it works with Vite based react applications."

**Root cause found:** `docker-compose.yml` never mounted the source into either container — the
containers only ever had the code baked in at image-build time (`COPY . .` in each Dockerfile), so
`next dev`'s watcher was watching a copy of the source that could never change; every edit required
a full `docker compose up --build` to be seen at all. Separately, once bind-mounted, the watcher
still couldn't pick up changes — `EMFILE: too many open files` on `inotify` watches, which turned
out to be a **host-kernel** limit (`fs.inotify.max_user_watches`), not something a container
`ulimit`/`nofile` setting can raise (that governs open file descriptors generally, a different
resource) — confirmed by raising the container's `nofile` ulimit to 65536 and still seeing the
error.

**repo-root/**

| File | Change | Description |
|---|---|---|
| `docker-compose.yml` | modified | Added bind-mount volumes for both services (`./backend/app:/app/app`, `./frontend:/app` with anonymous volumes protecting the container's own `node_modules`/`.next`) so host edits actually reach the running containers. Added `ulimits.nofile` (65536) to both — turned out not to be the actual fix for the watcher issue, kept anyway since it's a reasonable ceiling regardless. Added `WATCHPACK_POLLING=true` to the frontend — the actual fix: polls for file changes instead of relying on `inotify`, avoiding the host sysctl limit entirely rather than requiring the user to raise it system-wide. |

**Decisions this iteration** — none with clinical-data-safety implications; infrastructure/dev-experience fix only.

**Verification performed:** with the stack running (no rebuild), edited `frontend/app/page.tsx` on
the host twice in a row and confirmed via `curl` each time that the change reached
`http://localhost:3000/` within a few seconds, with the container logs showing an automatic
recompile (`✓ Compiled in ...ms`) and no further `EMFILE` errors.

**Suggested commit message:**
`chore: mount source volumes and enable polling so frontend/backend hot-reload actually works in docker`
