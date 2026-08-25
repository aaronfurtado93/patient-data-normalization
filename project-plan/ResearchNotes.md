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

---

## Condition, Observation, MedicationRequest, AllergyIntolerance: bundle vs FHIR R4 spec

Follow-up flagged in a previous pass, now done against the actual shipped bundle
(`inputdata/scenario1_fhir_bundle[78].json`, verified 2026-08-25 — matches the `Knowledge.md`
catalog exactly on every previously-documented item; no drift between working copy and catalog).

### Condition

Reference: [hl7.org/fhir/R4/condition.html](https://www.hl7.org/fhir/R4/condition.html)

- Invariant **`con-3`**: `Condition.clinicalStatus` SHALL NOT be present if `verificationStatus` is
  `entered-in-error`. **`condition-002` (asthma) violates this** — it has both `clinicalStatus:
  inactive` and `verificationStatus: entered-in-error` at once. This isn't just a data-quality style
  issue (missing display, dangling ref) — it's the bundle itself being non-conformant to a FHIR R4
  invariant. Reinforces the existing exclusion rule (never trust `clinicalStatus` once
  `verificationStatus` says `entered-in-error`) but the *reason* is now precise: the source data
  contradicts the spec's own constraint, so `clinicalStatus` on that resource can't be treated as
  meaningful at all.
- None of the three conditions populate `category` (spec allows 0..*, but the FHIR US Core-style
  convention of tagging `problem-list-item` vs `encounter-diagnosis` is absent everywhere) —
  spec-legal, but means the app can't distinguish "problem list" conditions from
  "diagnosed-at-this-encounter" ones by category; would need to infer from context if surfaced.
- `severity`, `bodySite`, `stage`, `evidence`, `note`, `recordedDate`, `recorder`, `asserter` — absent
  on all three, all spec-legal (0..* / 0..1).
- `condition-001` is the "clean" baseline: full clinicalStatus+verificationStatus, coding with
  display, valid `encounter` reference, full-precision `onsetDateTime`.

### Observation

Reference: [hl7.org/fhir/R4/observation.html](https://www.hl7.org/fhir/R4/observation.html)

- `status` is 1..1 required-binding; `entered-in-error` (used by `observation-004`) is itself a
  **legal** value in that binding — its exclusion from "current fact" is a business rule this app
  applies, not a spec violation the source data commits (unlike the Condition/AllergyIntolerance
  invariant hits above).
- `effectiveDateTime` uses the FHIR `dateTime` type, which permits the same partial precision as
  `date` (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or full timestamp). `observation-002`'s `"2020"` is
  spec-valid year-only precision, not malformed — same handling as `Patient.birthDate` partial
  dates.
- Only `observation-001` (BP panel) populates `category`; the other three don't. Spec-legal (0..*),
  but means category-based grouping (e.g. "vital signs" vs "labs") can't be done consistently across
  all observations in this bundle.
- `referenceRange`, `interpretation`, `bodySite`, `method`, `device` — absent on all four,
  spec-legal. No observation in this bundle carries a normal/abnormal interpretation flag — if the
  snapshot wants to indicate "this value is out of range," it would have to compute that itself, not
  read it off the resource.
- `observation-003`'s `performer` reference to `Practitioner/practitioner-999` isn't just a dangling
  reference to a missing *entry* — there is no `Practitioner` resource of any kind anywhere in this
  17-entry bundle. Worth stating precisely: this is "resource type entirely absent," not "one
  specific practitioner record happens to be missing."

### MedicationRequest

Reference: [hl7.org/fhir/R4/medicationrequest.html](https://www.hl7.org/fhir/R4/medicationrequest.html)

- `status` required-binding values seen: `active` (001), `stopped` (002), `active` (003).
  **`stopped` is a legal, intentional status** — distinct in kind from `entered-in-error`. It
  represents real prescribing history (a medication that was deliberately discontinued), not a
  data-quality defect. See `Assumptions.md` — this is now modeled as its own "past medications"
  bucket, separate from both the active-meds list and the entered-in-error/inactive exclusion
  bucket.
- `authoredOn` is `dateTime` type; `medicationrequest-002`'s `"2022"` is spec-valid year-only
  precision.
- **No `MedicationRequest` in the bundle populates `requester`** (0..1, who prescribed it) —
  spec-legal absence, but means prescriber attribution is unanswerable from this data for all three
  medications, not just the ones with other gaps. Worth surfacing as a completeness note if the
  snapshot shows medications with any "prescribed by" framing.
- `medicationrequest-002` and `-003` have no `encounter` link (0..1, spec-legal); only `-001` ties
  back to a specific visit.

### AllergyIntolerance

Reference: [hl7.org/fhir/R4/allergyintolerance.html](https://www.hl7.org/fhir/R4/allergyintolerance.html)

- Invariant **`ait-1`**: `AllergyIntolerance.clinicalStatus` SHALL NOT be present if
  `verificationStatus` is `entered-in-error`. **`allergyintolerance-002` (latex) violates this** —
  same pattern as `condition-002`'s `con-3` violation above. Two independent invariant violations of
  the identical shape (a resolved/inactive `clinicalStatus` co-occurring with an
  `entered-in-error` `verificationStatus`) across two different resource types is worth calling out
  as a *pattern* in this synthetic bundle, not two unrelated one-offs — it's exactly the shape the
  exclusion-bucket rule exists to catch, and the bundle author appears to have deliberately
  constructed both cases the same way.
- **No `AllergyIntolerance` in the bundle populates `reaction`** (0..*, manifestation/severity of the
  allergic reaction itself) — spec-legal absence, but means none of the three allergies (including
  the confirmed, high-criticality penicillin one) carry any detail on what the reaction actually
  is/was. Worth a completeness note per allergy rather than silence, per the "say so rather than
  hiding it" framing already used elsewhere.
- `type` (allergy vs. intolerance) and `category` (food/medication/environment/biologic) — absent on
  all three, spec-legal.
- **`allergyintolerance-001` (Penicillin): `system` is `http://snomed.info/sct` but `code` is
  `"7980-2"`.** That digit-dash-digit shape matches the LOINC codes used elsewhere in this bundle
  (`4548-4`, `8480-6`, `8462-4`), not a SNOMED CT SCTID, which is normally a longer pure-numeric
  string — consistent with the other two allergy codes in this same bundle (`300916003`,
  `91936005`). This reads as a **system/code mismatch in the source data**, not a missing-display
  case — new issue category, see `Knowledge.md` catalog update. Per `Assumptions.md`: shown as-is,
  flagged as a data-quality issue, not corrected or reinterpreted, and the code is not treated as
  invalidating the (present) `display: "Penicillin"` value that ships with it.
