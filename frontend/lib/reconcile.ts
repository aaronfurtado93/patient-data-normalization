// Iteration 07, step 3: builds the raw FHIR bundle a HIL merge produces, from the *original*
// loaded bundle (which still has full resource content — the display-only ResourceCardItem/
// PatientCardData types from components/patient-card/types.ts don't carry enough to reconstruct a
// real resource) plus the reviewer's selections from MergeView. Sent to POST /reconcile for
// re-validation; the backend re-runs the exact same pipeline as /validate on it — nothing here
// computes completeness/discrepancies itself, that stays server-side, single source of truth.

export type DemographicField = "name" | "birth_date" | "identifiers";

export type MergeSelections = {
  patientAId: string;
  patientBId: string;
  demographicChoice: Record<DemographicField, "A" | "B">;
  // itemKey format from MergeView: `${patientId}:${resourceType}:${resourceId}`
  selectedItemKeys: Set<string>;
};

type RawEntry = { fullUrl?: string; resource?: Record<string, unknown> };

function entries(bundle: Record<string, unknown>): RawEntry[] {
  return Array.isArray(bundle.entry) ? (bundle.entry as RawEntry[]) : [];
}

function referencedPatientId(resource: Record<string, unknown>): string | undefined {
  const ref =
    (resource.subject as { reference?: string } | undefined)?.reference ??
    (resource.patient as { reference?: string } | undefined)?.reference;
  return ref?.startsWith("Patient/") ? ref.slice("Patient/".length) : undefined;
}

/**
 * Builds a new bundle where `patientBId` has been merged into `patientAId`:
 * - The merged Patient keeps `patientAId`, based on A's raw resource. Only the three fields
 *   MergeView actually exposes (name, birthDate, identifier) can be swapped to B's value — every
 *   other field (gender, telecom, address, meta, extensions) stays A's, since there's no UI yet to
 *   choose them individually. A real, current limitation, not a silent guess: nothing invents a
 *   value neither A nor B provided.
 * - `patientBId`'s own Patient resource is dropped entirely.
 * - Every other resource in the bundle unrelated to A or B is carried through unchanged.
 * - A resource whose subject/patient is A or B is kept only if its item key is in
 *   `selectedItemKeys`; a kept B-subject resource has its reference rewritten to point at A.
 *   An unchecked resource is dropped from the result, not just hidden — the reviewer's selection
 *   is the final say on what the merged record contains.
 */
export function buildReconciledBundle(
  rawBundle: Record<string, unknown>,
  selections: MergeSelections
): Record<string, unknown> {
  const { patientAId, patientBId, demographicChoice, selectedItemKeys } = selections;
  const allEntries = entries(rawBundle);

  const patientAResource = allEntries.find(
    (e) => e.resource?.resourceType === "Patient" && e.resource.id === patientAId
  )?.resource;
  const patientBResource = allEntries.find(
    (e) => e.resource?.resourceType === "Patient" && e.resource.id === patientBId
  )?.resource;

  if (!patientAResource) {
    throw new Error(`Could not find Patient/${patientAId} in the loaded bundle.`);
  }

  const mergedPatient: Record<string, unknown> = { ...patientAResource };
  if (demographicChoice.name === "B" && patientBResource) {
    mergedPatient.name = patientBResource.name;
  }
  if (demographicChoice.birth_date === "B" && patientBResource) {
    mergedPatient.birthDate = patientBResource.birthDate;
  }
  if (demographicChoice.identifiers === "B" && patientBResource) {
    mergedPatient.identifier = patientBResource.identifier;
  }

  const newEntries: RawEntry[] = [];

  for (const entry of allEntries) {
    const resource = entry.resource;
    if (!resource) continue;

    if (resource.resourceType === "Patient" && resource.id === patientAId) {
      newEntries.push({ ...entry, resource: mergedPatient });
      continue;
    }
    if (resource.resourceType === "Patient" && resource.id === patientBId) {
      continue; // dropped — merged into A
    }

    const refPatientId = referencedPatientId(resource);

    if (refPatientId !== patientAId && refPatientId !== patientBId) {
      newEntries.push(entry); // unrelated to this pair — untouched
      continue;
    }

    const key = `${refPatientId}:${resource.resourceType}:${resource.id}`;
    if (!selectedItemKeys.has(key)) {
      continue; // reviewer unchecked it — excluded from the merged record
    }

    if (refPatientId === patientBId) {
      const rewritten: Record<string, unknown> = { ...resource };
      if (rewritten.subject) {
        rewritten.subject = { ...(rewritten.subject as object), reference: `Patient/${patientAId}` };
      }
      if (rewritten.patient) {
        rewritten.patient = { ...(rewritten.patient as object), reference: `Patient/${patientAId}` };
      }
      newEntries.push({ ...entry, resource: rewritten });
    } else {
      newEntries.push(entry);
    }
  }

  return { ...rawBundle, entry: newEntries, total: newEntries.length };
}
