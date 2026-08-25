"use client";

import { useRef, useState } from "react";
import Breadcrumb from "@/components/layout/Breadcrumb";
import PatientCard from "@/components/patient-card/PatientCard";
import type { PatientCardData } from "@/components/patient-card/types";

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

  // Shared by Load Sample File and Upload Custom File — one place that puts a bundle into state
  // and resets whatever the previous bundle's validation run left behind.
  function applyLoadedBundle(bundle: Record<string, unknown>, sourceLabel: string) {
    setLoadedBundle(bundle);
    setValidationReport(null);
    setValidationError(null);
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
      setValidationError("Validation request failed — is the backend running?");
    }
  }

  const primaryButtonClass =
    "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300";
  const stretchButtonClass =
    "cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400";

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
            disabled
            defaultValue="default"
            className="cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-2 py-1 text-slate-400"
          >
            <option value="default">Default</option>
            <option value="hil">HIL (Coming Soon)</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleRunValidation}
          disabled={!loadedBundle || validationState === "loading"}
          className={primaryButtonClass}
        >
          {validationState === "loading" ? "Validating..." : "Run Validation"}
        </button>

        <button type="button" disabled className={stretchButtonClass}>
          Edit Mode (Coming Soon, for HIL mode)
        </button>

        <button type="button" disabled className={stretchButtonClass}>
          Download Output (Coming Soon, for HIL mode)
        </button>
      </div>

      {statusMessage && <p className="mt-4 text-sm text-slate-600">{statusMessage}</p>}
      {downloadState === "error" && (
        <p className="mt-2 text-sm text-red-600">Download failed — is the backend running?</p>
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
        <PatientCard key={patient.patient_id} patient={patient} />
      ))}
    </div>
  );
}
