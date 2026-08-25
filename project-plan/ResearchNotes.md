# Research Notes (for implementation)

Phase 0 output per `ProjectPlan.md`. Domain framing, FHIR spec cross-checks, and the full data-quality issue catalog for
the bundle actually shipped in this take-home (`scenario1_fhir_bundle[78].json`).

## Domain framing

This is a **patient-summary / reconciliation** problem — closer to a USCDI Common Clinical Data Set or International
Patient Summary view than to a PAS/prior-authorization workflow. No procedure codes, no admission/discharge dates, no
service-date-driven logic here. Prior PAS work (Diagnosis/Procedure codes, DOS/DOA/DOD) is adjacent domain knowledge but
the actual shape of this task is: reconcile a messy bundle → render a clinician-scannable snapshot.

---

## Patient resource: bundle vs FHIR R4 spec

Reference: [hl7.org/fhir/R4/patient.html](https://www.hl7.org/fhir/R4/patient.html)

### Base Patient element structure (spec)

| Element              | Cardinality | Type                | Notes                                                                                                                                                                       |
|----------------------|-------------|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| identifier           | 0..*        | Identifier          |                                                                                                                                                                             |
| active               | 0..1        | boolean             | modifier element                                                                                                                                                            |
| name                 | 0..*        | HumanName           |                                                                                                                                                                             |
| telecom              | 0..*        | ContactPoint        |                                                                                                                                                                             |
| gender               | 0..1        | code                | required binding: male \| female \| other \| unknown                                                                                                                        |
| birthDate            | 0..1        | date                | FHIR `date` allows YYYY, YYYY-MM, or YYYY-MM-DD precision                                                                                                                   |
| deceased[x]          | 0..1        | boolean \| dateTime | modifier element                                                                                                                                                            |
| address              | 0..*        | Address             |                                                                                                                                                                             |
| maritalStatus        | 0..1        | CodeableConcept     | extensible binding                                                                                                                                                          |
| multipleBirth[x]     | 0..1        | boolean \| integer  |                                                                                                                                                                             |
| photo                | 0..*        | Attachment          |                                                                                                                                                                             |
| contact              | 0..*        | BackboneElement     | guardian/emergency contact                                                                                                                                                  |
| communication        | 0..*        | BackboneElement     | language (1..1, required), preferred (0..1)                                                                                                                                 |
| generalPractitioner  | 0..*        | Reference           | Organization \| Practitioner \| PractitionerRole                                                                                                                            |
| managingOrganization | 0..1        | Reference           | custodian org                                                                                                                                                               |
| **link**             | 0..*        | BackboneElement     | `other` (1..1) + `type` (1..1: `replaced-by` \| `replaces` \| `refer` \| `seealso`) — **the spec's own mechanism for declaring two Patient resources as related/duplicate** |

Race, ethnicity, and organ-donor status are **not** in the base resource — they come in via jurisdiction-specific
profiles (US Core, in this bundle's case).

### What's actually present in the bundle

| Element                          | `patient-001`                | `patient-002`                                                            |
|----------------------------------|------------------------------|--------------------------------------------------------------------------|
| `meta.profile` (us-core-patient) | ✅                           | ❌                                                                       |
| `extension` (US Core race)       | ✅                           | ❌                                                                       |
| `extension` (US Core ethnicity)  | ✅                           | ❌                                                                       |
| `identifier`                     | MRN `48213` + SSN            | MRN `48213-A` only                                                       |
| `active`                         | `true`                       | `true`                                                                   |
| `name`                           | Whitfield, Dorothy M         | Whitfield, Dorothy *(no middle initial)*                                 |
| `telecom`                        | phone, `home`                | phone *(different number)*, `mobile`                                     |
| `gender`                         | `female`                     | `female`                                                                 |
| `birthDate`                      | `1958-03-12` (day precision) | `1958` (year precision — valid per spec, unusual in practice)            |
| `address`                        | full, incl. `country`        | missing `country`; street abbreviated ("Larkspur Ln" vs "Larkspur Lane") |
| `deceased[x]`                    | absent                       | absent                                                                   |
| `maritalStatus`                  | absent                       | absent                                                                   |
| `multipleBirth[x]`               | absent                       | absent                                                                   |
| `photo`                          | absent                       | absent                                                                   |
| `contact`                        | absent                       | absent                                                                   |
| `communication`                  | absent                       | absent                                                                   |
| `generalPractitioner`            | absent                       | absent                                                                   |
| `managingOrganization`           | absent                       | absent                                                                   |
| **`link`**                       | **absent**                   | **absent**                                                               |
