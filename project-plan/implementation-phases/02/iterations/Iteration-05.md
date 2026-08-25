# Iteration 05: Upload Custom File

Built on Aaron's own edit to `page.tsx` (removed the "(Coming Soon, for HIL mode)" suffix from the
Upload Custom File button ahead of this iteration, signaling it was next). No backend changes
needed — `POST /validate` already accepts any bundle body, so "upload" is purely a client-side
concern: get a local file's JSON content into the same `loadedBundle` state Load Sample File uses.

**Frontend (`frontend/app/patient-record-processing/`)**

| File | Change | Description |
|---|---|---|
| `page.tsx` | modified | Added a hidden `<input type="file">` (triggered via `ref` by the now-active "Upload Custom File" button) and `handleFileSelected`, which reads the file client-side (`file.text()` → `JSON.parse` → check `resourceType === "Bundle"`), then calls a new shared `applyLoadedBundle()` helper (factored out of `handleLoad` so both paths share one "put a bundle into state, reset stale validation results" code path). Two client-side guard checks give fast, specific feedback (invalid JSON / wrong resourceType) via a new `uploadError` state, kept separate from `statusMessage` so a failed upload doesn't clobber a previously-successful load. Button restyled from `stretchButtonClass` (permanently disabled) to `primaryButtonClass` (real, with a `"loading"`/`"error"` `AsyncState` like the other buttons). |

**Decisions this iteration**

- **Client-side JSON/`resourceType` checks are explicitly not a substitute for `/validate`'s real structural validation** — they exist only to give immediate, specific feedback for the two most common "this obviously isn't a bundle" mistakes before a network round trip. Anything that passes both checks still goes through the exact same `/validate` pipeline as the sample bundle, with no special-casing. Flagging since it would be easy to mistake these for duplicating backend logic; they don't.
- No clinical-data-safety decisions — this iteration only changes how a bundle gets into browser state, not anything about reconciliation, exclusion, or discrepancy logic.

**Verification performed**

All via a real browser (`claude-in-chrome`'s `file_upload` tool, which uploads directly to the file
input element — the native OS file picker itself isn't something browser automation can drive):
- `backend/tests/fixtures/fully_valid_bundle.json` uploaded → "6 resources" loaded correctly, Run
  Validation reproduced the exact zero-discrepancy result already established for this fixture.
- A hand-written invalid-JSON file uploaded → correct error message, previous successfully-loaded
  bundle left untouched (Run Validation stayed enabled on the prior bundle rather than resetting).
- A hand-written valid-JSON/wrong-`resourceType` file uploaded → correct, specific error message.
- `backend/tests/fixtures/fully_invalid_bundle.json` uploaded → identical result to the direct
  `curl` verification of the same fixture (23 discrepancies, 3 structural errors, both duplicates,
  all 5 excluded items) — confirms upload and Load Sample File converge on identical downstream
  behavior.
- One false alarm during testing: a low-resolution screenshot appeared to show "0 resources"
  loaded; zooming into that region showed it actually read "6 resources" correctly — not a real
  bug, noted here only so the record doesn't look like a bug was silently swept aside.

**Suggested commit message** (for Aaron to use, not run by the agent):
`feat: implement Upload Custom File — client-side JSON read feeding the existing /validate pipeline`
