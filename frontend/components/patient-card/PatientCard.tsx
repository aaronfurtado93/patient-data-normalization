import type { PatientCardData } from "./types";
import ResourceSection from "./ResourceSection";

export default function PatientCard({ patient }: { patient: PatientCardData }) {
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{patient.name ?? "Unnamed patient"}</h2>
          <p className="text-sm text-slate-500">
            {patient.patient_id}
            {patient.birth_date ? ` · DOB ${patient.birth_date}` : ""}
            {patient.identifiers.length > 0 ? ` · ${patient.identifiers.join(", ")}` : ""}
          </p>
        </div>
        {patient.discrepancy_count > 0 && (
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {patient.discrepancy_count} discrepanc{patient.discrepancy_count === 1 ? "y" : "ies"} observed
          </span>
        )}
      </div>

      {patient.possible_duplicates.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          {patient.possible_duplicates.map((dup) => (
            <div key={dup.patient_id} className="text-sm text-amber-900">
              <p className="font-medium">⚠ Possible duplicate: {dup.patient_id}</p>
              <p className="mt-0.5">
                {dup.name ?? "Unnamed"}
                {dup.birth_date ? `, DOB ${dup.birth_date}` : ""}
                {dup.identifiers.length > 0 ? ` · ${dup.identifiers.join(", ")}` : ""}
              </p>
              <p className="mt-1 text-xs text-amber-700">{dup.note}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <ResourceSection title="Encounters" items={patient.encounters} />
        <ResourceSection title="Conditions" items={patient.conditions} />
        <ResourceSection title="Active Medications" items={patient.medications_active} />
        <ResourceSection title="Past Medications" items={patient.medications_past} />
        <ResourceSection title="Allergies" items={patient.allergies} />
        <ResourceSection title="Observations" items={patient.observations} />
        <ResourceSection
          title="Excluded (not shown as current fact)"
          items={patient.excluded}
          defaultOpen
        />
      </div>
    </div>
  );
}
