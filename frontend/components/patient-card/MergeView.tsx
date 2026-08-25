import { useState } from "react";
import type { PatientCardData, ResourceCardItem } from "./types";

// Iteration 07, step 2: 3-pane compare-and-select view — Patient A (LHS) | Merged Preview (center)
// | Patient B (RHS). Per Aaron's spec. Deliberately does NOT attempt to pair up resources that
// might represent the same clinical fact across the two patients (e.g. two hypertension
// Conditions with different ids) — each side lists its own items independently; the center pane
// is simply the union of whatever's checked on either side. No backend call, no persistence, no
// actual bundle mutation — this is a preview/selection UI only. Applying/downloading a merge
// result, and any dedup of the resulting preview, is explicitly deferred ("cleaning up of data in
// a later step" — Aaron's words) — the disabled "Apply Merge" button below reflects that boundary
// visibly in the UI, not just in code comments.

type DemographicField = "name" | "birth_date" | "identifiers";
const DEMOGRAPHIC_FIELDS: { key: DemographicField; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "birth_date", label: "Date of Birth" },
  { key: "identifiers", label: "Identifiers" },
];

function demographicValue(patient: PatientCardData, field: DemographicField): string {
  if (field === "identifiers") {
    return patient.identifiers.length > 0 ? patient.identifiers.join(", ") : "—";
  }
  return patient[field] ?? "—";
}

type ResourceSectionKey =
  | "encounters"
  | "conditions"
  | "medications_active"
  | "medications_past"
  | "allergies"
  | "observations"
  | "excluded";

const RESOURCE_SECTIONS: { key: ResourceSectionKey; title: string; defaultIncluded: boolean }[] = [
  { key: "encounters", title: "Encounters", defaultIncluded: true },
  { key: "conditions", title: "Conditions", defaultIncluded: true },
  { key: "medications_active", title: "Active Medications", defaultIncluded: true },
  { key: "medications_past", title: "Past Medications", defaultIncluded: true },
  { key: "allergies", title: "Allergies", defaultIncluded: true },
  { key: "observations", title: "Observations", defaultIncluded: true },
  // Excluded (entered-in-error/inactive/resolved) items default OFF — they're not current fact on
  // either side, so a merged record shouldn't include them by default either.
  { key: "excluded", title: "Excluded (not shown as current fact)", defaultIncluded: false },
];

function itemKey(patientId: string, item: ResourceCardItem): string {
  return `${patientId}:${item.resource_type}:${item.resource_id}`;
}

function buildInitialSelection(patientA: PatientCardData, patientB: PatientCardData): Set<string> {
  const selected = new Set<string>();
  for (const { key, defaultIncluded } of RESOURCE_SECTIONS) {
    if (!defaultIncluded) continue;
    for (const item of patientA[key]) selected.add(itemKey(patientA.patient_id, item));
    for (const item of patientB[key]) selected.add(itemKey(patientB.patient_id, item));
  }
  return selected;
}

type MergeViewProps = {
  patientA: PatientCardData;
  patientB: PatientCardData;
  onClose: () => void;
};

export default function MergeView({ patientA, patientB, onClose }: MergeViewProps) {
  const [demographicChoice, setDemographicChoice] = useState<Record<DemographicField, "A" | "B">>({
    name: "A",
    birth_date: "A",
    identifiers: "A",
  });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() =>
    buildInitialSelection(patientA, patientB)
  );

  function toggleItem(patientId: string, item: ResourceCardItem) {
    const key = itemKey(patientId, item);
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={`Compare and merge ${patientA.patient_id} and ${patientB.patient_id}`}
        className="fixed inset-4 z-40 flex flex-col overflow-hidden rounded-lg bg-white shadow-xl md:inset-10"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Compare &amp; Merge</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-y-auto bg-slate-200">
          {/* Column headers */}
          <div className="bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{patientA.name ?? "Unnamed patient"}</p>
            <p className="text-xs text-slate-500">{patientA.patient_id}</p>
          </div>
          <div className="bg-slate-50 p-3 text-center">
            <p className="text-sm font-semibold text-slate-900">Merged Preview</p>
            <p className="text-xs text-slate-500">selection only — not saved</p>
          </div>
          <div className="bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{patientB.name ?? "Unnamed patient"}</p>
            <p className="text-xs text-slate-500">{patientB.patient_id}</p>
          </div>

          {/* Demographics */}
          {DEMOGRAPHIC_FIELDS.map(({ key, label }) => (
            <RowThreeUp
              key={key}
              label={label}
              left={
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`demo-${key}`}
                    checked={demographicChoice[key] === "A"}
                    onChange={() => setDemographicChoice((prev) => ({ ...prev, [key]: "A" }))}
                    className="mt-1"
                  />
                  <span>{demographicValue(patientA, key)}</span>
                </label>
              }
              center={<span className="text-slate-700">{demographicValue(demographicChoice[key] === "A" ? patientA : patientB, key)}</span>}
              right={
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`demo-${key}`}
                    checked={demographicChoice[key] === "B"}
                    onChange={() => setDemographicChoice((prev) => ({ ...prev, [key]: "B" }))}
                    className="mt-1"
                  />
                  <span>{demographicValue(patientB, key)}</span>
                </label>
              }
            />
          ))}

          {/* Resource sections */}
          {RESOURCE_SECTIONS.map(({ key, title }) => {
            const itemsA = patientA[key];
            const itemsB = patientB[key];
            if (itemsA.length === 0 && itemsB.length === 0) return null;

            const checkedFromA = itemsA.filter((item) => selectedItems.has(itemKey(patientA.patient_id, item)));
            const checkedFromB = itemsB.filter((item) => selectedItems.has(itemKey(patientB.patient_id, item)));

            return (
              <RowThreeUp
                key={key}
                label={`${title} (${itemsA.length + itemsB.length})`}
                left={
                  <ItemChecklist
                    items={itemsA}
                    patientId={patientA.patient_id}
                    selectedItems={selectedItems}
                    onToggle={toggleItem}
                  />
                }
                center={
                  checkedFromA.length + checkedFromB.length === 0 ? (
                    <span className="text-slate-400">(none selected)</span>
                  ) : (
                    <ul className="space-y-1">
                      {checkedFromA.map((item) => (
                        <li key={itemKey(patientA.patient_id, item)}>{item.summary}</li>
                      ))}
                      {checkedFromB.map((item) => (
                        <li key={itemKey(patientB.patient_id, item)}>{item.summary}</li>
                      ))}
                    </ul>
                  )
                }
                right={
                  <ItemChecklist
                    items={itemsB}
                    patientId={patientB.patient_id}
                    selectedItems={selectedItems}
                    onToggle={toggleItem}
                  />
                }
              />
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled
            title="Applying a merge (writing a combined, cleaned record) is a later step."
            className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Apply Merge (coming soon)
          </button>
        </div>
      </div>
    </>
  );
}

function RowThreeUp({
  label,
  left,
  center,
  right,
}: {
  label: string;
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <>
      <div className="col-span-3 bg-white px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="bg-white px-3 pb-3 text-sm text-slate-700">{left}</div>
      <div className="bg-white px-3 pb-3 text-sm">{center}</div>
      <div className="bg-white px-3 pb-3 text-sm text-slate-700">{right}</div>
    </>
  );
}

function ItemChecklist({
  items,
  patientId,
  selectedItems,
  onToggle,
}: {
  items: ResourceCardItem[];
  patientId: string;
  selectedItems: Set<string>;
  onToggle: (patientId: string, item: ResourceCardItem) => void;
}) {
  if (items.length === 0) {
    return <span className="text-slate-400">(none)</span>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={itemKey(patientId, item)}>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={selectedItems.has(itemKey(patientId, item))}
              onChange={() => onToggle(patientId, item)}
              className="mt-1"
            />
            <span>
              {item.summary}
              {item.excluded && <span className="ml-1 text-xs text-red-600">(excluded)</span>}
              {item.discrepancies.length > 0 && (
                <span className="ml-1 text-xs text-amber-600">⚠ {item.discrepancies.length}</span>
              )}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
