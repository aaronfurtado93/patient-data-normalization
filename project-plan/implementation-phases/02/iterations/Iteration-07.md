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
