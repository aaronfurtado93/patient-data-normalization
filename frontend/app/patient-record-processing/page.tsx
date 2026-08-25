"use client";

import { useRef, useState } from "react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import PatientCard from "@/components/patient-card/PatientCard";
import MergeView, { type MergeSelections } from "@/components/patient-card/MergeView";
import type { PatientCardData } from "@/components/patient-card/types";
import { buildReconciledBundle } from "@/lib/reconcile";
import { buildCleanOutputBundle } from "@/lib/downloadOutput";

// Iteration 02: Download Sample File, Load Sample File, and Run Validation becoming available
// once a file is loaded. Upload Custom File / Edit Mode / Download Output are stretch (HIL mode)
// and stay disabled.
// Iteration 03: Run Validation now calls the real POST /validate endpoint (structural validation
// against the backend's Pydantic models) and renders the report — no longer a placeholder.
// Iteration 04: the report now also carries a patient-centric, discrepancy-annotated PatientCard
// (see components/patient-card/), rendered below the structural summary.
// Iteration 05: Upload Custom File is real — reads a local JSON file client-side (no backend round
// trip to "load" it; POST /validate already accepts any bundle body). Edit Mode / Download Output
// remain disabled — still HIL-mode stretch scope.
// Iteration 07, step 1: Validation Mode dropdown is now switchable (Default/HIL), locked once Run
// Validation has produced a report, re-enabled by loading a new file. Mode is UI state only — not
// sent to the backend.
// Iteration 07, step 2: the merge icon (HIL mode, on cards with possible_duplicates) now opens
// MergeView — a 3-pane compare/select UI (Patient A | Merged Preview | Patient B).
// Iteration 07, step 3: "Reconcile and Apply Merge" is real. lib/reconcile.ts builds an actual
// FHIR bundle from loadedBundle (the raw original — display types don't carry enough to
// reconstruct real resources) + the reviewer's selections; POSTed to the new POST /reconcile,
// which runs the exact same validation pipeline as /validate. On success, loadedBundle and
// validationReport are both replaced with the reconciled result, so every card (not just the
// merged one) reflects the update.
// Iteration 07, final step: Download Output is real — lib/downloadOutput.ts filters the current
// working bundle (post-merge if applied, otherwise as loaded/validated) against the latest
// validationReport's discrepancy/excluded classification, gated by two checkboxes (both default
// OFF, so the default download is genuinely "clean"). Per Aaron's refinement: restricted to HIL
// mode — the button stays visible but disabled+tooltipped outside HIL (matching this app's usual
// idiom), while the Download Options checkboxes are hidden entirely outside HIL, not just disabled.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const SAMPLE_BUNDLE_FILENAME = "scenario1_fhir_bundle[78].json";

type AsyncState = "idle" | "loading" | "error";

type ValidationIssue = {
  entry_index: number;
  resource_type: string | null;
  resource_id: string | null;
  message: string;
};

type ValidationReport = {
  valid: boolean;
  resource_counts: Record<string, number>;
  errors: ValidationIssue[];
  // Iteration 06: one card per distinct patient the backend identified in the bundle (was a
  // single optional `patient` before — renamed/pluralized to match).
  patients: PatientCardData[];
};

function formatTimestampForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

async function fetchSampleBundle(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BACKEND_URL}/sample-bundle`);
  if (!res.ok) {
    throw new Error(`backend returned ${res.status}`);
  }
  return res.json();
}

export default function PatientRecordProcessingPage() {
  const [downloadState, setDownloadState] = useState<AsyncState>("idle");
  const [loadState, setLoadState] = useState<AsyncState>("idle");
  const [loadedBundle, setLoadedBundle] = useState<Record<string, unknown> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<AsyncState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [validationState, setValidationState] = useState<AsyncState>("idle");
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationMode, setValidationMode] = useState<"default" | "hil">("default");
  // Iteration 07 step 2: which pair is currently open in the compare/merge view, if any.
  const [mergePair, setMergePair] = useState<{ patientId: string; duplicateId: string } | null>(null);
  // Iteration 07 step 3: state for the actual POST /reconcile call.
  const [applyingMerge, setApplyingMerge] = useState(false);
  const [applyMergeError, setApplyMergeError] = useState<string | null>(null);
  // Iteration 07 final step: Download Output settings — both default OFF so the default export is
  // genuinely clean (no discrepancy-flagged or excluded items) unless explicitly opted into.
  const [includeWithDiscrepancies, setIncludeWithDiscrepancies] = useState(false);
  const [includeExcluded, setIncludeExcluded] = useState(false);

  // Shared by Load Sample File and Upload Custom File — one place that puts a bundle into state
  // and resets whatever the previous bundle's validation run left behind.
  function applyLoadedBundle(bundle: Record<string, unknown>, sourceLabel: string) {
    setLoadedBundle(bundle);
    setValidationReport(null);
    setValidationError(null);
    setMergePair(null); // a comparison from the old bundle would reference stale/gone patients
    setApplyMergeError(null);
    const entryCount = Array.isArray(bundle.entry) ? bundle.entry.length : undefined;
    setStatusMessage(entryCount !== undefined ? `${sourceLabel} — ${entryCount} resources.` : sourceLabel);
  }

  async function handleDownload() {
    setDownloadState("loading");
    try {
      const bundle = await fetchSampleBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = SAMPLE_BUNDLE_FILENAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadState("idle");
    } catch {
      setDownloadState("error");
    }
  }

  async function handleLoad() {
    setLoadState("loading");
    try {
      const bundle = await fetchSampleBundle();
      applyLoadedBundle(bundle, "Sample file loaded");
      setLoadState("idle");
    } catch {
      setLoadState("error");
      setStatusMessage("Failed to load sample file — is the backend running?");
    }
  }

  function handleUploadClick() {
    setUploadError(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // reset so re-selecting the same file still fires onChange
    if (!file) {
      return;
    }

    setUploadState("loading");
    setUploadError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setUploadState("error");
      setUploadError(`"${file.name}" is not valid JSON.`);
      return;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Record<string, unknown>).resourceType !== "Bundle"
    ) {
      setUploadState("error");
      setUploadError(`"${file.name}" does not look like a FHIR Bundle (resourceType must be "Bundle").`);
      return;
    }

    applyLoadedBundle(parsed as Record<string, unknown>, `${file.name} loaded`);
    setUploadState("idle");
  }

  async function handleRunValidation() {
    if (!loadedBundle) {
      return;
    }
    setValidationState("loading");
    setValidationError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loadedBundle),
      });
      if (!res.ok) {
        throw new Error(`backend returned ${res.status}`);
      }
      const report: ValidationReport = await res.json();
      setValidationReport(report);
      setValidationState("idle");
    } catch {
      setValidationState("error");
      setValidationError("Validation request failed");
    }
  }

  async function handleApplyMerge(selections: MergeSelections) {
    if (!loadedBundle) {
      return;
    }
    setApplyingMerge(true);
    setApplyMergeError(null);
    try {
      const reconciledBundle = buildReconciledBundle(loadedBundle, selections);
      const res = await fetch(`${BACKEND_URL}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reconciledBundle),
      });
      if (!res.ok) {
        throw new Error(`backend returned ${res.status}`);
      }
      const report: ValidationReport = await res.json();
      // Both replaced together: loadedBundle so a further merge/re-run continues from the
      // reconciled state, validationReport so every card (not just the merged one) reflects the
      // backend's fresh completeness/discrepancy numbers for the updated bundle.
      setLoadedBundle(reconciledBundle);
      setValidationReport(report);
      setStatusMessage(`Merge applied — ${selections.patientBId} merged into ${selections.patientAId}.`);
      setMergePair(null);
    } catch (err) {
      setApplyMergeError(
        err instanceof Error && err.message.startsWith("Could not find")
          ? err.message
          : "Reconcile request failed"
      );
    } finally {
      setApplyingMerge(false);
    }
  }

  function handleDownloadOutput() {
    if (!loadedBundle || !validationReport) {
      return;
    }
    const cleanBundle = buildCleanOutputBundle(loadedBundle, validationReport, {
      includeWithDiscrepancies,
      includeExcluded,
    });
    const blob = new Blob([JSON.stringify(cleanBundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fhir-r4-patient-record-${formatTimestampForFilename(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const primaryButtonClass =
    "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300";

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Patient Record Processing" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Patient Record Processing</h1>
      <p className="mt-1 text-slate-600">
        Load a FHIR bundle, then run validation to see its completeness/reconciliation report.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloadState === "loading"}
          className={primaryButtonClass}
        >
          {downloadState === "loading" ? "Downloading..." : "Download Sample File"}
        </button>

        <button
          type="button"
          onClick={handleLoad}
          disabled={loadState === "loading"}
          className={primaryButtonClass}
        >
          {loadState === "loading" ? "Loading..." : "Load Sample File"}
        </button>

        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploadState === "loading"}
          className={primaryButtonClass}
        >
          {uploadState === "loading" ? "Uploading..." : "Upload Custom File"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Validation Mode
          <select
            value={validationMode}
            onChange={(e) => setValidationMode(e.target.value as "default" | "hil")}
            disabled={validationReport !== null}
            title={
              validationReport !== null
                ? "Locked after Run Validation — load a new file to change mode."
                : undefined
            }
            className={`rounded border px-2 py-1 ${
              validationReport !== null
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <option value="default">Default</option>
            <option value="hil">HIL</option>
          </select>
        </label>
        {validationReport !== null && (
          <span className="text-xs text-slate-500">
            To change validation mode, load/upload a file.
          </span>
        )}

        <button
          type="button"
          onClick={handleRunValidation}
          disabled={!loadedBundle || validationState === "loading"}
          className={primaryButtonClass}
        >
          {validationState === "loading" ? "Validating..." : "Run Validation"}
        </button>

        <button
          type="button"
          onClick={handleDownloadOutput}
          disabled={validationMode !== "hil" || !validationReport}
          title={
            validationMode !== "hil"
              ? "Download Output is available in HIL mode only."
              : !validationReport
                ? "Run Validation first."
                : undefined
          }
          className={primaryButtonClass}
        >
          Download Output
        </button>
      </div>

      {validationMode === "hil" && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          Download Options:
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeWithDiscrepancies}
              onChange={(e) => setIncludeWithDiscrepancies(e.target.checked)}
            />
            Include items with discrepancies
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeExcluded}
              onChange={(e) => setIncludeExcluded(e.target.checked)}
            />
            Include entries marked as Excluded
          </label>
        </div>
      )}

      {statusMessage && <p className="mt-4 text-sm text-slate-600">{statusMessage}</p>}
      {downloadState === "error" && (
        <p className="mt-2 text-sm text-red-600">Download failed</p>
      )}
      {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
      {validationError && <p className="mt-2 text-sm text-red-600">{validationError}</p>}

      {validationReport && (
        <div className="mt-6 max-w-xl rounded-md border border-slate-200 bg-white p-4">
          <p
            className={`text-sm font-semibold ${
              validationReport.valid ? "text-green-700" : "text-red-700"
            }`}
          >
            {validationReport.valid
              ? "Bundle is structurally valid."
              : "Bundle has structural validation issues."}
          </p>

          {Object.keys(validationReport.resource_counts).length > 0 && (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
              {Object.entries(validationReport.resource_counts).map(([type, count]) => (
                <div key={type} className="flex justify-between gap-2">
                  <dt>{type}</dt>
                  <dd className="font-medium text-slate-900">{count}</dd>
                </div>
              ))}
            </dl>
          )}

          {validationReport.errors.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm text-red-700">
              {validationReport.errors.map((err, index) => (
                <li key={index}>
                  Entry {err.entry_index}
                  {err.resource_type
                    ? ` (${err.resource_type}${err.resource_id ? ` / ${err.resource_id}` : ""})`
                    : ""}
                  : {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {validationReport?.patients.map((patient) => (
        <PatientCard
          key={patient.patient_id}
          patient={patient}
          mode={validationMode}
          onMergeClick={(duplicateId) => setMergePair({ patientId: patient.patient_id, duplicateId })}
        />
      ))}

      {mergePair &&
        (() => {
          const patientA = validationReport?.patients.find((p) => p.patient_id === mergePair.patientId);
          const patientB = validationReport?.patients.find((p) => p.patient_id === mergePair.duplicateId);
          if (!patientA || !patientB) {
            return null; // stale reference (shouldn't happen — applyLoadedBundle clears mergePair)
          }
          return (
            <MergeView
              key={`${patientA.patient_id}-${patientB.patient_id}`}
              patientA={patientA}
              patientB={patientB}
              onClose={() => setMergePair(null)}
              onApply={handleApplyMerge}
              applying={applyingMerge}
              applyError={applyMergeError}
            />
          );
        })()}
    </div>
  );
}
