// Mirrors backend/app/models/patient_card.py — keep in sync manually (no shared schema codegen
// at this project's scale).

export type Discrepancy = {
  kind: string;
  message: string;
};

export type ResourceCardItem = {
  resource_type: string;
  resource_id: string;
  summary: string;
  status: string | null;
  excluded: boolean;
  discrepancies: Discrepancy[];
};

export type PossibleDuplicatePatient = {
  patient_id: string;
  name: string | null;
  birth_date: string | null;
  identifiers: string[];
  note: string;
};

export type PatientCardData = {
  patient_id: string;
  name: string | null;
  birth_date: string | null;
  identifiers: string[];
  possible_duplicates: PossibleDuplicatePatient[];
  encounters: ResourceCardItem[];
  conditions: ResourceCardItem[];
  observations: ResourceCardItem[];
  medications_active: ResourceCardItem[];
  medications_past: ResourceCardItem[];
  allergies: ResourceCardItem[];
  excluded: ResourceCardItem[];
  discrepancy_count: number;
  completeness_percentage: number;
};
