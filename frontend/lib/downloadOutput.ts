// Iteration 07, final step: builds the "clean" FHIR R4 bundle for Download Output, from the
// *current* working bundle (post-merge if a reconcile was applied, otherwise as originally
// loaded) filtered by the latest validation report's discrepancy/excluded classification.
//
// Same reason as lib/reconcile.ts: PatientCardData/ResourceCardItem are display projections, not
// full FHIR resources — the actual resource content only still exists in the raw bundle
// (page.tsx's loadedBundle), so filtering happens by cross-referencing raw entries against the
// report's classification, not by trying to reconstruct resources from the display types.

import type { PatientCardData, ResourceCardItem } from "@/components/patient-card/types";

export type DownloadOutputOptions = {
  includeWithDiscrepancies: boolean;
  includeExcluded: boolean;
};

type ReportLike = { patients: PatientCardData[] };

function shouldInclude(item: ResourceCardItem, options: DownloadOutputOptions): boolean {
  // Excluded takes priority: an excluded item always has discrepancies too (its exclusion
  // reason), but "include excluded" is the more specific toggle for it.
  if (item.excluded) {
    return options.includeExcluded;
  }
  if (item.discrepancies.length > 0) {
    return options.includeWithDiscrepancies;
  }
  return true; // clean, non-excluded — always included
}

/**
 * Filters the raw working bundle down to a clean output bundle:
 * - Every Patient resource for every patient in the report is always included — the toggles
 *   apply to clinical resources, not to whether a patient itself appears.
 * - A clinical resource (Encounter/Condition/Observation/MedicationRequest/AllergyIntolerance) is
 *   included based on `shouldInclude` above, checked against every patient's buckets.
 * - Anything in the raw bundle that isn't a Patient and isn't attributable to any patient's
 *   buckets (shouldn't normally happen for a bundle that's already been through /validate or
 *   /reconcile) is dropped rather than guessed into the output.
 */
export function buildCleanOutputBundle(
  rawBundle: Record<string, unknown>,
  report: ReportLike,
  options: DownloadOutputOptions
): Record<string, unknown> {
  const patientIds = new Set<string>();
  const allowedResourceKeys = new Set<string>(); // `${resourceType}:${resourceId}`

  for (const patient of report.patients) {
    patientIds.add(patient.patient_id);
    const buckets: ResourceCardItem[][] = [
      patient.encounters,
      patient.conditions,
      patient.observations,
      patient.medications_active,
      patient.medications_past,
      patient.allergies,
      patient.excluded,
    ];
    for (const bucket of buckets) {
      for (const item of bucket) {
        if (shouldInclude(item, options)) {
          allowedResourceKeys.add(`${item.resource_type}:${item.resource_id}`);
        }
      }
    }
  }

  const rawEntries = Array.isArray(rawBundle.entry)
    ? (rawBundle.entry as { resource?: Record<string, unknown> }[])
    : [];

  const outputEntries = rawEntries.filter((entry) => {
    const resource = entry.resource;
    if (!resource) return false;
    if (resource.resourceType === "Patient") {
      return patientIds.has(resource.id as string);
    }
    return allowedResourceKeys.has(`${resource.resourceType}:${resource.id}`);
  });

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    total: outputEntries.length,
    entry: outputEntries,
  };
}
