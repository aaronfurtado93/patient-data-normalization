import Breadcrumb from "@/components/layout/Breadcrumb";

// Iteration 07 enhancement: static User Guide page, linked from the Dashboard widget and the
// sidebar menu. Content mirrors current app behavior only — update this alongside any future
// change to Patient Record Processing's UI/flow so it never drifts from what the app actually
// does.
export default function UserGuidePage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "User Guide" }]} />
      <h1 className="text-2xl font-bold text-slate-900">User Guide</h1>
      <p className="mt-1 text-slate-600">
        How to load, validate, reconcile, and export patient bundles with Patient Record
        Processing.
      </p>

      <div className="mt-6 max-w-3xl space-y-8 text-sm leading-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Load a bundle</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Download Sample File</strong> saves the built-in sample FHIR bundle to your
              computer so you can inspect or edit it locally.
            </li>
            <li>
              <strong>Load Sample File</strong> loads that same sample bundle directly into the
              page — the fastest way to try the tool.
            </li>
            <li>
              <strong>Upload Custom File</strong> loads your own FHIR-conformant JSON bundle from
              disk. Nothing is sent to the server at this step — the file is only parsed in your
              browser.
            </li>
            <li>Loading any new file clears previous results and re-enables Validation Mode.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Choose a Validation Mode</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Default</strong> — read-only. Shows each patient&apos;s completeness and
              discrepancies; possible duplicate patients are flagged but never combined.
            </li>
            <li>
              <strong>HIL</strong> (Human-in-the-Loop) — adds the ability to manually merge
              possible-duplicate patients and to download a cleaned output bundle.
            </li>
            <li>
              The mode selector locks as soon as you click <strong>Run Validation</strong>. To
              switch modes afterward, load or upload a file again — this resets the page.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Run Validation</h2>
          <p className="mt-2">
            Sends the loaded bundle to the backend, which checks structural validity and returns
            one patient card per distinct Patient resource found — the app never merges patients
            on its own. Each card shows:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>A completeness percentage for that patient&apos;s clinical data.</li>
            <li>
              Collapsible sections (Encounters, Conditions, Observations, Medications, etc.) —
              a section with any discrepancies shows a ⚠ warning and count next to its title, even
              while collapsed.
            </li>
            <li>
              Resources with issues such as missing coding <code>display</code> text, dangling
              references, unconfirmed verification status, or entered-in-error/inactive status are
              shown as-is and labeled, never guessed at or auto-corrected.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            4. Merge possible duplicates (HIL mode only)
          </h2>
          <p className="mt-2">
            If the backend flags two Patient resources as a possible match (similar name and
            birth date), a merge icon appears on those cards. Clicking it opens a 3-pane compare
            view:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Patient A</strong> (left) and <strong>Patient B</strong> (right) — their raw data side by side.</li>
            <li>
              <strong>Merged Preview</strong> (center) — updates live as you choose which
              demographic fields to keep (name, birth date, identifiers — pick A or B per field)
              and check off which clinical items from each side to carry into the merged record.
            </li>
            <li>
              <strong>Reconcile and Apply Merge</strong> builds the merged bundle from your
              selections and re-runs the same backend validation used for the initial report —
              every card on the page updates to reflect the new completeness/discrepancies, not
              just the merged one.
            </li>
            <li>Unchecked items are dropped entirely; this can surface new discrepancies (for example, a Condition left pointing at an Encounter you excluded becomes a dangling reference) — the tool will flag that rather than hide it.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Download Output (HIL mode only)</h2>
          <p className="mt-2">
            Exports the current working bundle (post-merge if you applied one, otherwise as
            loaded/validated) as a clean FHIR R4 JSON file. Two checkboxes control what is
            included, both off by default so the default export is the cleanest cut:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Include items with discrepancies</strong> — off by default; leave unchecked to export only discrepancy-free clinical resources.</li>
            <li><strong>Include entries marked as Excluded</strong> — off by default; leave unchecked to omit entered-in-error/inactive/resolved-status resources.</li>
            <li>Patients themselves are always included.</li>
            <li>
              The downloaded file is named
              {" "}
              <code>fhir-r4-patient-record-&lt;yyyy&gt;-&lt;mm&gt;-&lt;dd&gt;-&lt;hh&gt;-&lt;mm&gt;-&lt;ss&gt;.json</code>,
              timestamped to when the download happened.
            </li>
            <li>Download Output is disabled outside HIL mode and until validation has run — hover it to see why.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
