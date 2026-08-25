# Iteration 07: HIL merge process — step 1 of several

Stretch goal, explicitly being built as a sequence of small, independently-reviewed steps per
Aaron's direction: "Let's tread carefully and make small sets of changes... let us do it carefully
with more feedback on smaller sets of changes." This file will grow one section per step rather
than being written as if the whole feature landed at once.

## Step 1: Validation Mode toggle + merge icon (UI only, no merge logic yet)

**Scope, per Aaron's instruction:** enable the Validation Mode dropdown and allow switching to HIL
mode; lock it once Run Validation has run, until a new file is loaded/uploaded; add a merge icon to
patient cards that have possible duplicates. Nothing beyond that — no backend wiring, no actual
merge behavior.

**Frontend (`frontend/app/patient-record-processing/`)**

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | Added `validationMode: "default" \| "hil"` state. `<select>` is now controlled (`value`/`onChange`), `disabled={validationReport !== null}` (locks after Run Validation, unlocks automatically on new load since `applyLoadedBundle` already nulls `validationReport`). Passes `mode={validationMode}` to each `<PatientCard>`. Mode is UI-only — not yet sent to `/validate`. |

**Frontend (`frontend/components/patient-card/`)**

| File | Change | Description |
|---|---|---|
| `PatientCard.tsx` | modified | New `mode` prop. Added a small inline-SVG `MergeIcon` (git-merge-style glyph, no icon library). Renders next to each entry in a card's `possible_duplicates` panel, **only when `mode === "hil"`** — never in Default mode, matching `Assumptions.md`'s rule that Default mode doesn't even offer a merge action. Icon is currently inert (`title`/`aria-label` say "coming soon"); no click handler with real behavior yet. |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `Assumptions.md` | *(no change this step — nothing new to decide beyond what Iteration 06's third pass already established)* | |
| `LLD.md`, `TestPlan.md` | modified | Step-1 writeup + verification record. |
| `implementation-phases/02/Phase-02.md` | modified | Iteration 07 row added, marked "in progress" (multi-step). |

**Decisions this iteration**

- No new clinical-data-safety decisions — this step is UI affordance only, no merge logic exists to
  make a judgment call about yet. The load-bearing rule (Default mode never merges, HIL surfaces
  the option but doesn't act on it either — yet) was already established and recorded in
  `Assumptions.md` during Iteration 06's correction; this step just builds toward it in the UI.

**Verification performed** (all in a real browser via `claude-in-chrome`, since this is client-side
state with no backend endpoint to hit directly)

- Dropdown starts enabled, switches to "HIL" correctly (`form_input` tool).
- Locks (greyed, disabled) immediately after Run Validation, while still showing "HIL" as the
  selected value (confirms disabled, not reset).
- `three_patients_partially_valid_bundle.json` in HIL mode: merge icon appears next to both
  matching Wei Chen cards' possible-duplicate entries, absent from Yusuf Ibrahim's card (no
  possible duplicates).
- Same fixture, re-run in **Default** mode: merge icon absent from all three cards, including the
  two with `possible_duplicates` — confirms the `mode === "hil"` guard actually works in the
  browser, not just by reading the code.
- Loading a new file after a locked run: dropdown re-enables, "HIL" selection preserved.
- **Side note from Aaron mid-step**: explicitly re-verified that loading/uploading a new file
  clears the previous validation results (structural summary + all patient cards) immediately —
  this was already correct via the existing `applyLoadedBundle` reset (Iteration 02/05), confirmed
  live rather than assumed still true after this step's changes.

**Suggested commit message** (for Aaron to use, not run by the agent):
`feat: enable Validation Mode toggle (Default/HIL) and merge icon on cards with possible duplicates`

---

## Step 2: 3-pane compare/select view (MergeView)

**Scope, per Aaron's instruction:** "implement an expanded view that allows to compare the data
side-by-side and merge similar data points and also other related data points... Actually, 3 pane
merge system Patient A (LHS) | Merged Preview (center) | Patient B (RHS)." Explicitly deferred:
"we will take a look at cleaning up of data in a later step" — so no dedup logic, no backend call,
no actual merge persistence this step.

I asked a clarifying question about whether resources should be auto-paired across sides by
apparent clinical similarity before building; Aaron answered with the 3-pane spec directly, which
resolves the question on its own — no pairing needed, the center pane is just the union of
whatever's checked on either side.

**Frontend (`frontend/components/patient-card/`)**

| File | Change | Description |
|---|---|---|
| `MergeView.tsx` | added | The 3-pane overlay. Demographics: single-choice radio per field (Name/DOB/Identifiers), A default. Resource buckets: checkbox per item per side, checked by default except `excluded` (unchecked by default). Center pane = live union of checked items, flat/not deduplicated. "Apply Merge" button present but permanently disabled with an explanatory tooltip — same UI-boundary idiom as Edit Mode/Download Output. Reuses `Sidebar.tsx`'s `fixed inset-0` backdrop-overlay technique rather than introducing a new modal pattern. |
| `PatientCard.tsx` | modified | Merge icon's `onClick` now calls a new `onMergeClick` prop instead of being inert; tooltip text updated from "(coming soon)" to "Compare & merge with …" since it now does something real. |

**Frontend (`frontend/app/patient-record-processing/`)**

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | New `mergePair: { patientId, duplicateId } \| null` state. Looks up both full `PatientCardData` records from `validationReport.patients` (a single card's own props aren't enough — it doesn't have the other side's resources), renders `MergeView` with a `key` of both ids (forces a fresh mount/fresh default selections if the pair changes without closing first). `mergePair` is cleared by `applyLoadedBundle`, same as `validationReport`, so a stale comparison can't survive a new bundle load. |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `LLD.md`, `TestPlan.md` | modified | Full step-2 writeup + verification record, including a real bug I found and fixed in my own first draft before ever running it (wrong key in the center pane's combined list — see Decisions below). |

**Decisions this iteration**

- **No auto-pairing of resources across the two sides** — confirmed by the 3-pane spec itself, not
  a separate judgment call. Each side's items are independent; only the center pane's union
  reflects both.
- **Excluded resources default unchecked** in the merge selection (everything else defaults
  checked) — not explicitly specified by Aaron, a reasonable extension of "excluded = not current
  fact" to "shouldn't be in a merged record by default either." Flagging since it's an inference,
  not a stated instruction.
- **Center pane union is deliberately not deduplicated** — e.g. two independently-worded
  "hypertension" conditions from each side would both appear. Explicitly out of scope per Aaron's
  own framing ("cleaning up of data in a later step").
- Found and fixed a real bug in my own draft before running anything: the center pane's combined
  item list used a wrong key (passed a resource type where a patient id was expected) — would have
  caused duplicate-key React warnings and potential incorrect list behavior once both sides had
  checked items of the same resource type. Caught during my own read-through, not by testing.

**Verification performed** (all in a real browser via `claude-in-chrome`)

- Opened the view from chen-1's card: correct A/B assignment, defaults matching each side's actual
  data exactly (chen-1 has no medication, chen-2 has no encounter/observation — both correctly show
  "(none)" rather than a guessed/empty-but-wrong state).
- Center pane correctly unions both sides' checked Conditions.
- Unchecking chen-1's condition immediately removed it from the center pane, leaving only chen-2's.
- Switching the DOB radio from A to B immediately updated the center pane's shown value.
- **Reverse-pair check**: closed the view, reopened it from chen-2's card (A=chen-2, B=chen-1 this
  time) — confirmed genuinely fresh default selections for the new pair, not carried-over state,
  proving the `key`-forced remount works correctly rather than just being present in the code.

**Suggested commit message:**
`feat: add 3-pane compare/select merge view (Patient A | Merged Preview | Patient B)`

---

## Step 3: Reconcile and Apply Merge (actually applies it)

**Scope, per Aaron's instruction:** "we need to implement 'Reconcile and Apply Merge'... We already
have validators on the backend that are capable of verify the manually reconciled/merged record we
need to expose it via endpoint and invoke the correct validation. After merge is applied the
Patient Records on UI will also have to be updated with the correct completeness score and
discrepencies."

**Backend (`backend/app/services/`)** — new package

| File | Change | Description |
|---|---|---|
| `__init__.py` | added | Package docstring. |
| `validation_service.py` | added | `run_validation(bundle)` — the `/validate` pipeline (structural checks → `parse_bundle_entries` → `build_patient_cards`), factored out of the router so `/validate` and `/reconcile` share one implementation instead of two copies that could drift. |

**Backend (`backend/app/routers/`)**

| File | Change | Description |
|---|---|---|
| `reconcile.py` | added | `POST /reconcile` — thin wrapper around `run_validation()`. Kept as its own named endpoint (not just reusing `/validate`) so the two intents stay distinguishable in the API, even though the logic is identical today. |
| `validation.py` | modified | Reduced to a two-line wrapper around the same `run_validation()`. |
| `__init__.py` | modified | Registered the new router. |

**Frontend (`frontend/lib/`)** — new directory

| File | Change | Description |
|---|---|---|
| `reconcile.ts` | added | `buildReconciledBundle()` — builds the actual merged FHIR bundle from the *original* raw `loadedBundle` (the only place both patients' full resource content still exists — the display-only `PatientCardData` types don't carry it) plus the reviewer's selections. Merged Patient keeps A's id; B's Patient is dropped; unchecked items are removed from the bundle entirely, not just hidden; a kept B-subject resource has its reference rewritten to A. |

**Frontend (`frontend/components/patient-card/`)**

| File | Change | Description |
|---|---|---|
| `MergeView.tsx` | modified | "Reconcile and Apply Merge" button is now real: reports the reviewer's selections via a new `onApply` prop instead of being permanently disabled. New `applying`/`applyError` props (inline error shown in the view itself — a page-level banner would be hidden behind the modal overlay). |

**Frontend (`frontend/app/patient-record-processing/`)**

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | New `handleApplyMerge()`: builds the bundle via `buildReconciledBundle()`, POSTs to `/reconcile`, and on success **replaces both `loadedBundle` and `validationReport`** with the response — this is what makes every card (not just the merged one) reflect fresh completeness/discrepancy numbers, since the whole updated bundle is re-validated, not just the merged pair. |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `Assumptions.md` | modified | New entry: applying a merge is a real, in-memory, non-reversible-within-the-app data-mutating operation (bounded — stateless backend, nothing persisted); documents exactly what does and doesn't get merged (3 demographic fields swappable, everything else defaults to A; unchecked items dropped entirely, not just deduplicated). |
| `LLD.md`, `TestPlan.md` | modified | Full step-3 writeup, including a real finding from testing (see below). |

**Decisions this iteration**

- **Applying a merge can permanently drop more than "duplicates"** — unchecking any item, for any
  reason, removes it from the resulting bundle. This is broader than a narrow "dedup" action and is
  explicitly recorded in `Assumptions.md` rather than left implicit in the code.
- **Only 3 demographic fields (name/birthDate/identifiers) are actually chooseable** between A and
  B; everything else on the Patient resource (gender, telecom, address, `meta`, extensions)
  silently keeps A's value. A real current limitation of the compare UI, not an inferred "A is
  correct" judgment — flagged so it isn't mistaken for one.
- **`/reconcile` is a separate named endpoint from `/validate`**, not a query param or reused route,
  even though the logic is identical today — a deliberate API-design choice for future
  extensibility, not something Aaron explicitly specified either way.

**Verification performed**

- `curl`-level sanity check first: `/validate` and `/reconcile` confirmed to return identical
  results for the same input, proving the factored-out `run_validation()` behaves the same via
  either route.
- Fixed a real, unrelated corruption found mid-step: a stray trailing `/` appeared in
  `validation_service.py` on disk (same class of accidental corruption as the earlier `SKILL.md`
  incident) — confirmed via the backend logs that it actually crashed the reload with a
  `SyntaxError` (not assumed), fixed it, confirmed clean recovery before continuing.
- Full round trip in a real browser, default selections (nothing unchecked): merge applied
  correctly, structural summary dropped from 3 to 2 patients with every other count preserved,
  merged card at 60%/2 discrepancies (hand-verified exactly), Yusuf Ibrahim's card **completely
  unchanged** — confirms the merge only touched its target pair, not the whole dataset.
- **Unchecked-item case, also verified**, and a genuine finding came out of it: unchecking chen-1's
  Encounter left `tp-partial-condition-chen1`'s `encounter` reference dangling — the merged card
  showed 3 discrepancies, which didn't match my own quick hand-prediction (I expected 2). Rather
  than trust either number blindly, replayed the exact reconcile call directly against the backend
  in Python — confirmed the **UI was correct and my hand-prediction was wrong**: the backend
  correctly flagged the newly-orphaned reference as a new `dangling_reference` discrepancy. Real
  evidence for why the merge re-runs the full backend pipeline rather than approximating the result
  client-side.

**Suggested commit message:**
`feat: implement Reconcile and Apply Merge — POST /reconcile endpoint + client-side bundle reconstruction`

---

## Step 4: warning marker on collapsed accordion sections

**Feedback:** "Major quality of life Observation: It is not easy to determine which collapsed
sections have discrepencies it would be nice to put a warning symbol on the accordion if it has
discrepencies in the section."

**Frontend (`frontend/components/patient-card/`)**

| File | Change | Description |
|---|---|---|
| `ResourceSection.tsx` | modified | The collapsed `<summary>` now shows `⚠ N discrepanc{y,ies}` (summed from every item's `discrepancies.length`) when the section contains any — same visual pattern as the per-item `⚠ N` badges already used in `MergeView.tsx`'s checklist, for consistency rather than inventing a new indicator style. No marker at all when a section is clean. |

**project-plan/**

| File | Change | Description |
|---|---|---|
| `LLD.md`, `TestPlan.md` | modified | Writeup + verification record. |

**Decisions this iteration** — none; pure display computation over data already present, no new clinical interpretation.

**Verification performed:** real browser, real bundle (patient-001/patient-002 response) — sections
with no discrepancies show no marker; sections with discrepancies show the correct count
(Conditions ⚠2, Allergies ⚠3, Observations ⚠2, Excluded ⚠8 — sums to the known 18-discrepancy
total for this bundle) and correct singular/plural grammar.

**Suggested commit message:**
`feat: show discrepancy count warning on collapsed accordion sections`
